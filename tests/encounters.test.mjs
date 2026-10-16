import test from 'node:test';
import assert from 'node:assert/strict';
import { createEncounterTracker, normalizeEncounterTracker, travelEncounter, ENCOUNTER_PROFILES } from '../src/core/encounters.mjs';
const step = (tracker, extras = {}) => travelEncounter(tracker, { distance: 78, movementSeconds: 1, sceneKind: 'village', areaId: 'main', storyStage: 2, ...extras });
function walk(seed, profile = 'calm', limit = 3600, region = 'village') {
  let tracker = createEncounterTracker(seed); const found = [];
  for (let seconds = 1; seconds <= limit; seconds++) { const result = step(tracker, { profile, sceneKind: region === 'village' ? 'village' : 'interior', region }); tracker = result.tracker; if (result.encounter) found.push({ at: tracker.activeSeconds, ...result.encounter }); }
  return { tracker, found };
}
test('Calm default protects the first eight minutes of eligible movement', () => {
  let tracker = createEncounterTracker('relaxed');
  for (let second = 0; second < 480; second++) { const result = step(tracker); tracker = result.tracker; assert.equal(result.encounter, undefined); }
  assert.equal(tracker.activeSeconds, 480); assert.equal(tracker.profile, 'calm');
});
test('Calm calibration averages approximately twelve active minutes without a fixed deadline', () => {
  const times = [];
  for (let seed = 0; seed < 100; seed++) { const run = walk(`calibration-${seed}`, 'calm', 2400); assert.ok(run.found.length); times.push(run.found[0].at); }
  const average = times.reduce((sum, value) => sum + value, 0) / times.length;
  assert.ok(average > 600 && average < 850, `Observed mean ${average}s should remain near the 720s baseline.`);
  assert.ok(new Set(times).size > 8, 'The baseline must not become a guaranteed battle on a timer.');
});
test('Calm, Balanced and Chaotic change actual eligible-time pacing deterministically', () => {
  const counts = ['calm', 'balanced', 'chaotic'].map(profile => walk('profile-comparison', profile).found.length);
  assert.ok(counts[0] < counts[1] && counts[1] < counts[2], counts.join(','));
  assert.deepEqual(walk('same-seed', 'balanced', 1500), walk('same-seed', 'balanced', 1500));
  assert.deepEqual(Object.values(ENCOUNTER_PROFILES).map(profile => profile.targetSeconds), [720, 360, 120]);
});
test('menus, pause, blocked input, large time gaps and teleports do not count', () => {
  const tracker = createEncounterTracker('safe');
  for (const options of [{ paused: true }, { sceneKind: 'menu' }, { distance: 0 }, { distance: 800 }, { movementSeconds: 60 }, { distance: 20, movementSeconds: .01 }, { movementSeconds: NaN }]) {
    const result = step(tracker, options); assert.equal(result.tracker, tracker); assert.equal(result.encounter, undefined);
  }
  let a = tracker, b = tracker;
  for (let second = 0; second < 500; second++) { a = step(a).tracker; b = step(b).tracker; b = step(b, { paused: true, movementSeconds: 1 }).tracker; b = step(b, { distance: 0, movementSeconds: 1 }).tracker; }
  assert.deepEqual(a, b);
});
test('encounter cooldown excludes immediate repeats and preserves region enemy tables', () => {
  const events = walk('archive-history', 'chaotic', 2400, 'archive').found; assert.ok(events.length > 5);
  for (let index = 0; index < events.length; index++) { assert.ok(['signal', 'ranger', 'mimic'].includes(events[index].opponent)); if (index) { assert.ok(events[index].at - events[index - 1].at >= 70); assert.notEqual(events[index].opponent, events[index - 1].opponent); } }
});
test('library A to library B restarts entrance protection independent from encounter region', () => {
  let tracker = step(createEncounterTracker('areas'), { sceneKind: 'interior', region: 'library', areaId: 'A' }).tracker;
  tracker = { ...tracker, sinceEncounterSeconds: 2000, checkSeconds: 29, areaSeconds: 100 };
  for (let second = 1; second < 20; second++) { const result = step(tracker, { sceneKind: 'interior', region: 'library', areaId: 'B' }); tracker = result.tracker; assert.equal(result.encounter, undefined); assert.equal(tracker.areaSeconds, second); }
});
test('legacy distance histories migrate without turning old distance into an overdue battle', () => {
  const legacy = { version: 3, seed: 'old', travelled: 20000, sinceEncounter: 899, checkDistance: 90, checks: 15, encounters: 4, lastOpponent: 'guard', regionDistance: 99 };
  const migrated = normalizeEncounterTracker(legacy, 'old'); assert.equal(migrated.encounters, 4); assert.equal(migrated.travelled, 20000); assert.equal(migrated.sinceEncounterSeconds, 0); assert.equal(step(migrated).encounter, undefined);
  assert.deepEqual(normalizeEncounterTracker({ ...legacy, checks: 'bad' }, 'old'), createEncounterTracker('old'));
  const restored = JSON.parse(JSON.stringify(walk('save', 'calm', 300).tracker)); assert.deepEqual(normalizeEncounterTracker(restored, 'save'), restored);
});
test('active movement seconds make walking and running pace-equivalent', () => {
  let slow = createEncounterTracker('speed'), fast = createEncounterTracker('speed');
  for (let i = 0; i < 2500; i++) { slow = step(slow, { distance: 3.9, movementSeconds: .05 }).tracker; fast = step(fast, { distance: 6.25, movementSeconds: .05 }).tracker; }
  assert.equal(slow.activeSeconds, fast.activeSeconds); assert.equal(slow.encounters, fast.encounters);
});
