import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { fallbackDevice, generateDevice, solveDevice } from '../src/core/devices.mjs';

// Exercise the shipped component without a browser or a development server.
// Transpile only this component; its pure simulation stays the real core module.
const sourceUrl = new URL('../src/components/DevicePanel.tsx', import.meta.url);
let compiled = ts.transpileModule(await readFile(sourceUrl, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
compiled = compiled.replace(/import\s+['"][^'"]+\.css['"];?/g, '').replace(/from\s+['"]([^'"]+)['"]/g, (match, specifier) => {
  const url = specifier.startsWith('.') ? new URL(specifier, sourceUrl).href : import.meta.resolve(specifier);
  return `from ${JSON.stringify(url)}`;
});
const { default: DevicePanel } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

async function fixture(device) {
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', { pretendToBeVisual: true });
  const previous = {};
  for (const key of ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT']) {
    previous[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom.window[key], configurable: true, writable: true });
  }
  const root = createRoot(dom.window.document.getElementById('app')), submissions = [];
  await act(() => root.render(React.createElement(DevicePanel, { device, onClose() {}, onSubmit(submission) { submissions.push(structuredClone(submission)); return solveDevice(device, submission); } })));
  return {
    document: dom.window.document, submissions,
    async click(element) { assert.ok(element, 'the intended control exists'); assert.equal(element.disabled, false); await act(() => element.click()); },
    async close() { await act(() => root.unmount()); dom.window.close(); for (const [key, descriptor] of Object.entries(previous)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } },
  };
}
const buttonWithText = (document, text) => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === text);

test('router buttons change actual forwarding directions and sending the configured packet solves the device', async () => {
  const device = fallbackDevice('dom-routing', 'routing', 'post'), f = await fixture(device);
  try {
    for (const router of device.data.routers) {
      const goal = device.answer.directions[router.id];
      for (let turn = 0; turn < 4; turn++) {
        const button = [...f.document.querySelectorAll('button.router-cell')].find(element => element.getAttribute('aria-label').includes(` ${router.id},`));
        assert.ok(button);
        if (button.getAttribute('aria-label').includes(`points ${goal}.`)) break;
        await f.click(button);
      }
    }
    await f.click(buttonWithText(f.document, 'Send packet'));
    assert.equal(f.submissions.length, 1);
    assert.equal(solveDevice(device, f.submissions[0]).correct, true);
    assert.ok(f.document.querySelectorAll('.router-traced').length >= 4);
    assert.match(f.document.querySelector('.puzzle-feedback').textContent, /Badge recorded/);
    assert.ok(f.document.querySelector('.puzzle-learning'));
    await f.click(buttonWithText(f.document, 'Reset workbench'));
    assert.equal(f.document.querySelector('.packet-trace'), null);
  } finally { await f.close(); }
});

test('processor controls build and reorder the real queue before a full schedule can run', async () => {
  const device = fallbackDevice('dom-schedule', 'scheduling', 'home'), f = await fixture(device);
  try {
    assert.equal(buttonWithText(f.document, 'Run schedule').disabled, true);
    for (const id of device.answer.order) await f.click([...f.document.querySelectorAll('.job-card')].find(button => button.querySelector('.job-letter').textContent === id));
    assert.equal(f.document.querySelectorAll('.timeline-job').length, 4);
    await f.click(f.document.querySelector('button[aria-label="Move job B earlier"]'));
    assert.match(f.document.querySelector('.processor-queue li').textContent, /^B/);
    await f.click(f.document.querySelector('button[aria-label="Move job B later"]'));
    await f.click(buttonWithText(f.document, 'Run schedule'));
    assert.deepEqual(f.submissions[0].order, device.answer.order);
    assert.equal(solveDevice(device, f.submissions[0]).correct, true);
    await f.click(f.document.querySelector('button[aria-label="Remove job A from queue"]'));
    assert.equal(buttonWithText(f.document, 'Run schedule').disabled, true);
  } finally { await f.close(); }
});

test('debugging probes expose failed cases and a selected machine operator repairs the actual finite system', async () => {
  const device = generateDevice('dom-debug', 'debugging', 'garden'), f = await fixture(device);
  try {
    assert.equal(buttonWithText(f.document, 'Run testbed').disabled, true);
    assert.equal(f.document.querySelectorAll('.testbed-table tbody tr').length, device.data.cases.length);
    assert.match(f.document.querySelector('.testbed-table tbody').textContent, /Fail/);
    const patch = device.answer.patch, module = device.data.modules.find(item => item.id === patch.moduleId);
    await f.click([...f.document.querySelectorAll('.machine-module')].find(button => button.querySelector('strong').textContent === module.label));
    await f.click([...f.document.querySelectorAll('.operator-selector button')].find(button => button.textContent === patch.op));
    await f.click(buttonWithText(f.document, 'Run testbed'));
    assert.deepEqual(f.submissions[0], device.answer);
    assert.equal(f.document.querySelector('.testbed-table tbody').textContent.includes('Fail'), false);
    assert.equal(f.document.querySelectorAll('.probe-log li').length, device.data.modules.length);
    await f.click(f.document.querySelector('.testbed-table tbody tr:last-child button'));
    assert.match(f.document.querySelector('.probe-log strong').textContent, new RegExp(`Case ${device.data.cases.length}`));
  } finally { await f.close(); }
});

test('seed shelf controls compare, slide, undo and insert real packets while preserving tied order', async () => {
  const device = fallbackDevice('dom-sorting', 'sorting', 'garden'), f = await fixture(device);
  try {
    assert.equal(buttonWithText(f.document, 'Check shelf').disabled, true);
    assert.equal(buttonWithText(f.document, 'Slide left packet right →').disabled, true);
    await f.click(buttonWithText(f.document, 'Compare packets'));
    assert.equal(buttonWithText(f.document, 'Compare packets').disabled, true);
    await f.click(buttonWithText(f.document, 'Slide left packet right →'));
    assert.equal(f.document.querySelector('.seed-gap .seed-position').textContent, 'Shelf 1');
    await f.click(buttonWithText(f.document, 'Undo operation'));
    assert.equal(f.document.querySelector('.seed-gap .seed-position').textContent, 'Shelf 2');
    let count = 0;
    while (buttonWithText(f.document, 'Check shelf').disabled && count++ < 64) await f.click(buttonWithText(f.document, 'Show one safe step'));
    assert.ok(count < 64);
    assert.equal(f.document.querySelector('.seed-gap'), null);
    assert.deepEqual([...f.document.querySelectorAll('.seed-id')].map(packet => packet.textContent), ['D', 'B', 'E', 'A', 'C']);
    await f.click(buttonWithText(f.document, 'Check shelf'));
    assert.equal(solveDevice(device, f.submissions[0]).correct, true);
    assert.ok(f.document.querySelector('.puzzle-learning'));
    await f.click(buttonWithText(f.document, 'Reset workbench'));
    assert.equal(buttonWithText(f.document, 'Check shelf').disabled, true);
  } finally { await f.close(); }
});
