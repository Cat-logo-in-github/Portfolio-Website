import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWorld } from '../src/core/world.mjs';
import { generateInterior } from '../src/core/interior.mjs';
import { normalizeSeed, createSaveBook, activeSlot, startExpedition, selectExpedition, storeActiveProgress, serializeSaveBook, restoreSaveBook, expeditionVillageConfig, expeditionInteriorConfig, mergeSaveBooks } from '../src/core/expeditions.mjs';

const resume = { name: 'Example', sections: [{ id: 'projects', type: 'projects', label: 'Projects', entries: [{ id: 'entry-1', title: 'An actual project', details: ['A supplied detail.'] }] }] };
test('seeded village and room configurations reproduce and vary without changing content', () => {
  const a = expeditionVillageConfig(resume, 'reed'), b = expeditionVillageConfig(resume, 'reed'), c = expeditionVillageConfig(resume, 'cedar');
  assert.deepEqual(a, b); assert.notDeepEqual(a, c);
  const w = generateWorld(resume, a.sequence, a), l = w.locations.find(l => l.sectionId === 'projects');
  const room = expeditionInteriorConfig(resume, l, 'reed');
  assert.deepEqual(generateInterior(resume, l, room), generateInterior(resume, l, expeditionInteriorConfig(resume, l, 'reed')));
  assert.notDeepEqual(room, expeditionInteriorConfig(resume, l, 'cedar'));
});
test('new expeditions preserve earlier progress even when replaying the same seed', () => {
  let book = storeActiveProgress(createSaveBook('', 'reed'), '{"progress":1}');
  book = startExpedition(book, 'reed');
  assert.equal(activeSlot(book).save, ''); assert.equal(book.slots[0].save, '{"progress":1}');
  const switched = selectExpedition(book, book.slots[0].id); assert.equal(activeSlot(switched).save, '{"progress":1}');
});
test('version 2 journeys are retained in a dedicated migration slot', () => { const book = createSaveBook('{"version":2}', 'ignored'); assert.equal(activeSlot(book).legacy, true); assert.equal(activeSlot(book).save, '{"version":2}'); });
test('save-book round trips settings, slots and active state safely', () => { const book = startExpedition(createSaveBook('', 'reed'), 'cedar'); assert.deepEqual(restoreSaveBook(serializeSaveBook(book), '', 'fallback').book, book); });
test('invalid and future saves preserve original storage and explain recovery', () => { for (const json of ['{', '{"version":99}', '{"version":3,"slots":[]}']) { const result = restoreSaveBook(json, '', 'fallback'); assert.equal(result.preserveOriginal, true); assert.ok(result.warning); } });
test('bad seeds and unknown slots are rejected without silent changes', () => { for (const value of ['', ' '.repeat(5), 'a'.repeat(65), 12]) assert.throws(() => normalizeSeed(value)); assert.throws(() => selectExpedition(createSaveBook('', 'reed'), 'missing')); });

test('imported books append new IDs without replacing current slots or preferences', () => {
  const existing = storeActiveProgress(createSaveBook('', 'reed'), 'existing');
  const incoming = startExpedition(storeActiveProgress(createSaveBook('', 'cedar'), 'imported'), 'birch');
  const merged = mergeSaveBooks(existing, incoming);
  assert.deepEqual(merged.slots[0], existing.slots[0]); assert.equal(merged.slots.length, 3);
  assert.equal(new Set(merged.slots.map(slot => slot.id)).size, 3);
  assert.equal(activeSlot(merged).seed, 'birch'); assert.equal(merged.slots[1].save, 'imported');
  assert.deepEqual(merged.preferences, existing.preferences);
  let full = existing; for (let i = 0; i < 11; i++) full = startExpedition(full, `slot-${i}`);
  assert.throws(() => mergeSaveBooks(full, incoming), /preserved/); assert.equal(full.slots[0].save, 'existing');
});
