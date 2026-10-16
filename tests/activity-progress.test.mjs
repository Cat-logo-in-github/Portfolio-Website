import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDevice } from '../src/core/devices.mjs';
import { completedDeviceIds, solveDeviceProgress } from '../src/core/activity-progress.mjs';
import { GARDEN_ID, DEVICE_KEY } from '../src/core/destinations.mjs';
import { createProgress, saveProgress, loadProgress } from '../src/core/progress.mjs';
const resume = { sourceHash: 'activity-fixture', sections: [] };
test('optional device rewards are once per site even after seed/profile rerolls', () => {
  const device = generateDevice('seed-a', 'routing', 'library', 'calm');
  const original = createProgress(resume), win = solveDeviceProgress(original, device, device.answer);
  assert.equal(win.correct, true); assert.equal(win.rewarded, true); assert.deepEqual(original.items, {});
  const rerolled = generateDevice('seed-b', 'routing', 'library', 'chaotic');
  assert.notEqual(device.instanceId, rerolled.instanceId);
  const again = solveDeviceProgress(win.state, rerolled, rerolled.answer);
  assert.equal(again.rewarded, false); assert.equal(again.state, win.state);
  const reloaded = loadProgress(saveProgress(win.state), resume).state;
  assert.equal(solveDeviceProgress(reloaded, device, device.answer).rewarded, false);
});
test('sorting completion survives reload and grants one badge per site despite seed and profile rerolls', () => {
  const initial = createProgress(resume); initial.items.keepsake = 2;
  const first = generateDevice('gentle-spring', 'sorting', 'home:seed-shelf', 'calm');
  const failed = solveDeviceProgress(initial, first, { actions: [] });
  assert.equal(failed.correct, false); assert.equal(failed.rewarded, false); assert.equal(failed.state, initial);
  const win = solveDeviceProgress(initial, first, first.answer);
  assert.equal(win.correct, true); assert.equal(win.rewarded, true);
  assert.equal(win.state.items['sorting-badge'], 1); assert.equal(win.state.items.keepsake, 2);
  assert.deepEqual(completedDeviceIds(win.state.flags[DEVICE_KEY]), [first.challengeId], 'sorting is retained by the completion whitelist');
  const loaded = loadProgress(saveProgress(win.state), resume);
  assert.equal(loaded.warning, undefined);
  assert.deepEqual(completedDeviceIds(loaded.state.flags[DEVICE_KEY]), [first.challengeId]);
  const rerolled = generateDevice('lively-autumn', 'sorting', 'home:seed-shelf', 'chaotic');
  assert.equal(rerolled.challengeId, first.challengeId); assert.notEqual(rerolled.instanceId, first.instanceId);
  const replay = solveDeviceProgress(loaded.state, rerolled, rerolled.answer);
  assert.equal(replay.correct, true); assert.equal(replay.rewarded, false); assert.equal(replay.state, loaded.state);
  assert.equal(replay.state.items['sorting-badge'], 1);
  const reloaded = loadProgress(saveProgress(replay.state), resume).state;
  assert.equal(solveDeviceProgress(reloaded, first, first.answer).rewarded, false);
  const anotherShelf = generateDevice('lively-autumn', 'sorting', 'home:another-shelf', 'chaotic');
  const secondSite = solveDeviceProgress(reloaded, anotherShelf, anotherShelf.answer);
  assert.equal(secondSite.rewarded, true); assert.equal(secondSite.state.items['sorting-badge'], 2);
  assert.equal(completedDeviceIds(secondSite.state.flags[DEVICE_KEY]).length, 2);
  assert.equal(secondSite.state.flags['v4:garden-restored'], undefined, 'a home shelf does not restore the secret garden');
  assert.deepEqual(initial.items, { keepsake: 2 }, 'the original professional state remains unchanged');
});
test('garden repair changes persistent environment only for a valid completed device', () => {
  const device = generateDevice('garden', 'debugging', GARDEN_ID, 'balanced'), state = createProgress(resume);
  const wrong = solveDeviceProgress(state, device, {});
  assert.equal(wrong.correct, false); assert.equal(wrong.state, state);
  const repaired = solveDeviceProgress(state, device, device.answer);
  assert.equal(repaired.state.flags['v4:garden-restored'], true);
  assert.equal(completedDeviceIds(repaired.state.flags[DEVICE_KEY]).length, 1);
});
test('malformed nested activity data recovers without losing professional state', () => {
  for (const json of ['{', '{}', '[null,3,"device:routing:abc","device:routing:abc"]', 'null']) {
    const state = createProgress(resume); state.flags[DEVICE_KEY] = json; state.items.keepsake = 2;
    const device = generateDevice('safe', 'scheduling', 'workshop', 'calm');
    const win = solveDeviceProgress(state, device, device.answer);
    assert.equal(win.correct, true); assert.equal(win.state.items.keepsake, 2);
    assert.ok(completedDeviceIds(win.state.flags[DEVICE_KEY]).includes(device.challengeId));
  }
});
