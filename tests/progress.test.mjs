import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgress, evaluateAction, performAction, saveProgress, loadProgress } from '../src/core/progress.mjs';

const resume = { sourceHash: 'real-source-hash', sections: [
  { id: 'projects', entries: [{ id: 'project-a' }, { id: 'project-b' }] },
  { id: 'skills', entries: [{ id: 'skill-a' }, { id: 'skill-b' }] }
] };
const object = (id, kind, extra = {}) => ({ id, hint: 'A useful clue.', recordIds: [], actions: [{ id: kind, label: kind, kind, ...extra }] });
const act = (state, target) => performAction(state, target, target.actions[0].id);

test('inspection gives feedback without unlocking source records', () => {
  const original = createProgress(resume); const target = object('desk', 'inspect', { recordIds: ['project-a'] });
  const result = act(original, target);
  assert.equal(result.message, 'A useful clue.');
  assert.deepEqual(result.state.unlocked, []);
  assert.deepEqual(original, createProgress(resume), 'Actions must not mutate prior state.');
});

test('discovery unlocks only valid source records and repeat input does not duplicate progress', () => {
  const target = object('book', 'discover', { recordIds: ['project-a', 'invented', 'project-a'] });
  const a = act(createProgress(resume), target); const b = act(a.state, target);
  assert.deepEqual(a.recordIds, ['project-a']);
  assert.deepEqual(a.state.unlocked, ['project-a']);
  assert.deepEqual(b.state.unlocked, ['project-a']);
  assert.equal(b.event, 'discover');
  assert.deepEqual(b.state.discoveredSections, { projects: 1 });
  assert.equal(b.state.quests.fieldTrip, 'active');
});

test('field trip completes at three unique discoveries across two sections and awards one key', () => {
  let state = createProgress(resume);
  const board = object('board', 'quest', { questId: 'fieldTrip' });
  state = act(state, board).state;
  for (const id of ['project-a', 'project-b']) state = act(state, object(`book-${id}`, 'discover', { recordIds: [id] })).state;
  assert.equal(state.quests.fieldTrip, 'active'); assert.equal(state.items['field-key'], undefined);
  const third = object('skills-book', 'discover', { recordIds: ['skill-a'] });
  const completion = act(state, third);
  assert.equal(completion.state.quests.fieldTrip, 'complete');
  assert.equal(completion.state.items['field-key'], 1);
  assert.match(completion.message, /Field trip complete/);
  state = act(completion.state, third).state;
  state = act(state, board).state;
  state = act(state, object('extra-book', 'discover', { recordIds: ['skill-b'] })).state;
  assert.equal(state.items['field-key'], 1);
});

test('locked containers explain preconditions, consume one key, and reward once', () => {
  const chest = object('chest', 'open', { requires: { item: 'field-key', quantity: 1 }, reward: { item: 'curiosity-badge', quantity: 1 } });
  const before = createProgress(resume);
  assert.equal(evaluateAction(chest, chest.actions[0], before).available, false);
  assert.match(act(before, chest).message, /Requires 1 field-key/);
  before.items['field-key'] = 2;
  const first = act(before, chest);
  assert.equal(first.state.items['field-key'], 1);
  assert.equal(first.state.items['curiosity-badge'], 1);
  assert.deepEqual(first.state.opened, ['chest']);
  const repeated = act(first.state, chest);
  assert.equal(repeated.state, first.state);
  assert.equal(repeated.state.items['field-key'], 1);
  assert.equal(repeated.state.items['curiosity-badge'], 1);
});

test('once actions and repeatable dialogue rewards are idempotent', () => {
  const once = object('npc', 'inspect', { once: true, reward: { item: 'note', quantity: 1 } });
  const first = act(createProgress(resume), once);
  assert.equal(evaluateAction(once, once.actions[0], first.state).available, false);
  assert.equal(act(first.state, once).state.items.note, 1);
  const repeatable = object('friendly-npc', 'inspect', { reward: { items: { pebble: 1 } } });
  let state = act(first.state, repeatable).state;
  state = act(state, repeatable).state;
  assert.equal(state.items.pebble, 1);
});

test('enter, exit, lamps and optional battles produce reusable state/events', () => {
  let state = createProgress(resume);
  const door = { ...object('door-projects', 'enter'), buildingId: 'location-projects' };
  const entry = act(state, door); state = entry.state;
  assert.equal(entry.event, 'enter'); assert.equal(entry.buildingId, 'location-projects');
  assert.deepEqual(state.visited, ['location-projects']);
  assert.equal(act(state, { ...object('exit', 'exit'), buildingId: 'location-projects' }).event, 'exit');
  const lamp = object('lamp', 'light'); state = act(state, lamp).state;
  assert.equal(state.flags['lit:lamp'], true); state = act(state, lamp).state;
  assert.equal(state.flags['lit:lamp'], false);
  const battle = act(state, object('arena-trainer', 'battle'));
  assert.equal(battle.event, 'battle'); assert.equal(battle.state.quests.sparring, 'active');
});

test('save/reload preserves interiors, opened objects, rewards, quests and player position', () => {
  let state = createProgress(resume);
  state = act(state, object('book', 'discover', { recordIds: ['project-a', 'skill-a', 'project-b'] })).state;
  state = act(state, object('chest', 'open', { requires: { item: 'field-key' }, reward: 'curiosity-badge' })).state;
  state.position = { scene: 'interior', buildingId: 'location-projects', point: { x: 4, y: 7 } };
  state.configs = { village: { sequence: [1, 1] }, interiors: { 'location-projects': { algorithmVersion: 1, archetype: 'workshop', nodeCount: 4, sequence: [1, 2], layoutSeed: 42, decorationSeed: 7 } } };
  const restored = loadProgress(saveProgress(state), resume);
  assert.equal(restored.warning, undefined);
  assert.deepEqual(restored.state, state);
});

test('malformed/outdated saves reset safely and source relations cannot be forged', () => {
  for (const json of ['not json', '{}', '{"version":1}', JSON.stringify({ ...createProgress(resume), items: { key: -1 } }), JSON.stringify({ ...createProgress(resume), position: { scene: 'interior', point: { x: NaN, y: 2 } } })]) {
    const result = loadProgress(json, resume);
    assert.ok(result.warning); assert.deepEqual(result.state, createProgress(resume));
  }
  const stale = loadProgress(saveProgress(createProgress(resume)), { ...resume, sourceHash: 'new-source' });
  assert.match(stale.warning, /résumé changed/);
  const forged = createProgress(resume); forged.unlocked = ['project-a', 'invented']; forged.recordSections.invented = 'invented-section';
  forged.configs.interiors = JSON.parse('{"__proto__":{"polluted":true}}');
  const restored = loadProgress(saveProgress(forged), resume);
  assert.deepEqual(restored.state.unlocked, ['project-a']);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.hasOwn(restored.state.configs.interiors, '__proto__'), false);
});

test('unknown actions fail with feedback and direct reading does not gate essential content', () => {
  const state = createProgress(resume), target = object('document', 'read', { recordIds: ['project-a'] });
  assert.deepEqual(act(state, target).recordIds, ['project-a']);
  assert.deepEqual(act(state, target).state.unlocked, []);
  assert.equal(performAction(state, target, 'unknown').state, state);
  assert.equal(evaluateAction(target, { id: 'hack', kind: 'script' }, state).available, false);
  assert.equal(evaluateAction(target, target.actions[0], { version: 2 }).available, false);
  assert.equal(performAction(state, { id: 'malformed', actions: {} }, 'read').state, state);
});
