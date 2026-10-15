import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { getMenuControls, installMenuNavigation } from '../src/ui/menu-navigation.mjs';

function fixture(markup = '') {
  const dom = new JSDOM(`<!doctype html><body><button id="game">World</button><div role="dialog" aria-modal="true" tabindex="-1"><button data-menu-close id="close">Close</button>${markup}</div></body>`, { pretendToBeVisual: true });
  const { document, KeyboardEvent, MouseEvent } = dom.window, panel = document.querySelector('[role="dialog"]');
  document.getElementById('game').focus();
  let closed = 0;
  const dispose = installMenuNavigation(panel, () => closed++);
  const key = (value, options = {}) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options }));
  return { dom, document, panel, key, dispose, closed: () => closed, click: id => document.getElementById(id).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })) };
}

test('opening inspection focuses a usable action, supports WASD/arrows, and activates once per press', () => {
  const f = fixture('<button id="inspect">Inspect</button><button id="read">Read notes</button><button disabled id="locked">Locked</button>');
  let reads = 0; f.document.getElementById('read').addEventListener('click', () => reads++);
  assert.equal(f.document.activeElement.id, 'inspect');
  f.key('s'); assert.equal(f.document.activeElement.id, 'read');
  f.key('Enter'); f.key('Enter', { repeat: true }); assert.equal(reads, 1);
  f.key(' '); f.key(' ', { repeat: true }); assert.equal(reads, 2);
  f.key('ArrowLeft'); assert.equal(f.document.activeElement.id, 'inspect');
  f.key('w'); assert.equal(f.document.activeElement.id, 'close');
  f.key('Escape'); f.key('Escape', { repeat: true }); assert.equal(f.closed(), 1);
  f.dispose(); assert.equal(f.document.activeElement.id, 'game'); f.dom.window.close();
});

test('selects, textareas, sliders, toggles and closed details have correct focus and native editing', () => {
  const f = fixture('<input id="seed" value="save"><select id="archetype"><option>Library</option><option>Workshop</option></select><textarea id="json">{}</textarea><input type="range" id="volume"><input type="checkbox" id="mute"><details id="advanced"><summary id="summary">Advanced</summary><button id="nested">Import</button></details><button hidden id="hidden">Hidden</button><button style="display:none" id="css-hidden">Hidden too</button>');
  assert.deepEqual(getMenuControls(f.panel).map(e => e.id), ['close', 'seed', 'archetype', 'json', 'volume', 'mute', 'summary']);
  for (const id of ['seed', 'archetype', 'json', 'volume']) {
    const control = f.document.getElementById(id); control.focus();
    assert.equal(f.key('ArrowRight'), true, `${id} arrows remain native`);
    assert.equal(f.key('d'), true, `${id} text remains editable`);
    assert.equal(f.document.activeElement, control);
  }
  f.document.getElementById('seed').focus();
  assert.equal(f.key('Enter'), true, 'first Enter keeps native form behavior');
  assert.equal(f.key('Enter', { repeat: true }), false, 'held Enter cannot submit repeatedly');
  f.document.getElementById('mute').focus(); f.key('Enter'); assert.equal(f.document.getElementById('mute').checked, true);
  f.document.getElementById('summary').focus(); f.key(' '); assert.equal(f.document.getElementById('advanced').open, true);
  f.key('ArrowDown'); assert.equal(f.document.activeElement.id, 'nested');
  f.document.getElementById('summary').focus(); f.key('Enter'); assert.equal(f.document.getElementById('advanced').open, false);
  f.key('Tab'); assert.equal(f.document.activeElement.id, 'close');
  f.key('Tab', { shiftKey: true }); assert.equal(f.document.activeElement.id, 'summary');
  f.dispose(); f.dom.window.close();
});

test('mouse and touch-style click events work and ordinary state updates preserve focus', async () => {
  const f = fixture('<button id="inspect">Inspect</button><button id="read">Read notes</button><details id="details"><summary id="summary">Toggle me</summary><input id="value"></details>');
  let reads = 0; f.document.getElementById('read').addEventListener('click', () => reads++);
  f.click('read'); assert.equal(reads, 1);
  f.click('summary'); assert.equal(f.document.getElementById('details').open, true);
  f.document.getElementById('read').focus();
  f.document.getElementById('inspect').textContent = 'Inspected';
  await new Promise(resolve => f.dom.window.queueMicrotask(resolve));
  assert.equal(f.document.activeElement.id, 'read');
  // A delayed game-focus callback cannot take focus away from an open menu.
  f.document.getElementById('game').focus(); assert.equal(f.document.activeElement.id, 'read');
  f.document.getElementById('read').disabled = true;
  await new Promise(resolve => f.dom.window.queueMicrotask(resolve));
  assert.equal(f.document.activeElement.id, 'summary');
  f.dispose(); f.dom.window.close();
});

test('SVG map destinations and links activate while disabled/closed descendants never receive focus', () => {
  const f = fixture('<svg><g id="destination" role="button" tabindex="0"><rect width="20" height="20" /></g></svg><a id="link" href="#resume">Résumé</a><fieldset disabled><button id="disabled">No</button></fieldset><details><summary>Parent</summary><details open><summary>Hidden nested summary</summary><button id="nested-hidden">No</button></details></details>');
  let travels = 0; f.document.getElementById('destination').addEventListener('click', () => travels++);
  assert.equal(f.document.activeElement.id, 'destination'); f.key('Enter'); assert.equal(travels, 1);
  const controls = getMenuControls(f.panel).map(element => element.id);
  assert.equal(controls.includes('disabled'), false); assert.equal(controls.includes('nested-hidden'), false);
  f.dispose(); f.dom.window.close();
});

test('panel switching focuses a new useful control and disabled puzzle nodes advance locally', async () => {
  const f = fixture('<input type="checkbox" id="guided"><button id="node1">1</button><button id="node2">2</button><button id="solve">Solve</button>');
  f.document.getElementById('node1').focus();
  f.document.getElementById('node1').disabled = true;
  await new Promise(resolve => f.dom.window.queueMicrotask(resolve));
  assert.equal(f.document.activeElement.id, 'node2', 'completing a node continues at the next local choice');
  const close = f.document.getElementById('close');
  for (const child of [...f.panel.children]) if (child !== close) child.remove();
  const next = f.document.createElement('button'); next.id = 'new-panel-action'; next.textContent = 'Open new panel'; f.panel.append(next);
  await new Promise(resolve => f.dom.window.queueMicrotask(resolve));
  assert.equal(f.document.activeElement.id, 'new-panel-action', 'a different panel starts at its first meaningful action');
  f.dispose(); f.dom.window.close();
});

test('initial puzzle guidance toggles do not trap WASD or arrow navigation', () => {
  const f = fixture('<input type="checkbox" id="guided" checked><button id="decrease">Decrease shift</button><input type="number" id="shift" value="0"><input type="radio" id="choice"><select id="type"><option>Library</option></select><input type="range" id="sound">');
  assert.equal(f.document.activeElement.id, 'guided');
  f.key('s'); assert.equal(f.document.activeElement.id, 'decrease');
  f.key('ArrowUp'); assert.equal(f.document.activeElement.id, 'guided');
  f.key('Enter'); assert.equal(f.document.getElementById('guided').checked, false);
  f.key('Enter', { repeat: true }); assert.equal(f.document.getElementById('guided').checked, false);
  f.key(' '); assert.equal(f.document.getElementById('guided').checked, true);
  f.key(' ', { repeat: true }); assert.equal(f.document.getElementById('guided').checked, true);
  f.key('ArrowRight'); assert.equal(f.document.activeElement.id, 'decrease');
  f.document.getElementById('choice').focus(); f.key('a'); assert.equal(f.document.activeElement.id, 'shift');
  f.document.getElementById('choice').focus(); f.key('d'); assert.equal(f.document.activeElement.id, 'type');
  for (const id of ['shift', 'type', 'sound']) { f.document.getElementById(id).focus(); assert.equal(f.key('ArrowLeft'), true); assert.equal(f.document.activeElement.id, id); }
  f.dispose(); f.dom.window.close();
});
