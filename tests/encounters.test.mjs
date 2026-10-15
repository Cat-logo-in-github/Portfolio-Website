import test from 'node:test';
import assert from 'node:assert/strict';
import { createEncounterTracker, travelEncounter } from '../src/core/encounters.mjs';

function walk(seed, region = 'village') { let tracker = createEncounterTracker(seed); const found = []; for (let i = 0; i < 400; i++) { const result = travelEncounter(tracker, { distance: 16, sceneKind: region === 'village' ? 'village' : 'interior', region, storyStage: 2 }); tracker = result.tracker; if (result.encounter) found.push({ at: tracker.travelled, ...result.encounter }); } return found; }
test('encounters are deterministic, paced, bounded and do not immediately repeat', () => { const result = walk('same-seed'); assert.deepEqual(result, walk('same-seed')); assert.ok(result.length >= 5 && result.length <= 12); assert.ok(result[0].at >= 440); for (let i = 1; i < result.length; i++) { assert.ok(result[i].at - result[i - 1].at >= 520); assert.notEqual(result[i].opponent, result[i - 1].opponent); } });
test('paused menus, no travel and teleports cannot trigger battles', () => { const tracker = createEncounterTracker('safe'); for (const options of [{ distance: 600, sceneKind: 'village' }, { distance: 10, sceneKind: 'village', paused: true }, { distance: 0, sceneKind: 'interior' }, { distance: 10, sceneKind: 'menu' }, { distance: NaN, sceneKind: 'village' }]) assert.equal(travelEncounter(tracker, options).tracker, tracker); });
test('region tables and seeds produce different safe encounter series', () => { assert.notDeepEqual(walk('a'), walk('b')); const archive = walk('archive', 'archive'); assert.ok(archive.every(event => ['signal', 'ranger', 'mimic'].includes(event.opponent))); assert.ok(archive.every(event => event.id && event.message && event.title && !event.boss)); });
test('early travel has a protected minimum and old trackers recover safely', () => { let tracker = createEncounterTracker(1); for (let i = 0; i < 26; i++) { const result = travelEncounter(tracker, { distance: 16, sceneKind: 'village' }); tracker = result.tracker; assert.equal(result.encounter, undefined); } assert.equal(travelEncounter({ version: 1, seed: 'old' }, {}).tracker.version, 3); });

test('entering a different interior of the same archetype restarts entrance protection', () => {
  let tracker = travelEncounter(createEncounterTracker('libraries'), { distance: 16, sceneKind: 'interior', region: 'library', areaId: 'library-a' }).tracker;
  tracker = { ...tracker, sinceEncounter: 1000, checkDistance: 120, regionDistance: 500, encounters: 1 };
  for (let index = 1; index <= 7; index++) {
    const result = travelEncounter(tracker, { distance: 16, sceneKind: 'interior', region: 'library', areaId: 'library-b' });
    tracker = result.tracker; assert.equal(result.encounter, undefined); assert.equal(tracker.regionDistance, index * 16);
  }
  const result = travelEncounter(tracker, { distance: 16, sceneKind: 'interior', region: 'library', areaId: 'library-b' });
  assert.ok(result.encounter, 'The bounded drought breaker resumes after 128px inside the new area.');
  assert.equal(result.encounter.region, 'library', 'Area identity must not replace the region enemy table.');
  assert.ok(['signal', 'ranger', 'mimic'].includes(result.encounter.opponent));
});
