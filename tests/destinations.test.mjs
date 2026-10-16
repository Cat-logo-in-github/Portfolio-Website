import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceResume } from './helpers/resume.mjs';
import { generateWorld } from '../src/core/world.mjs';
import { createProgress, saveProgress } from '../src/core/progress.mjs';
import { createMystery, mysteryPlan, solveMystery } from '../src/core/mystery.mjs';
import { GARDEN_ID, gardenVillage, gardenEntrance, gardenUnlocked, generateGarden, decorateAdventureScene } from '../src/core/destinations.mjs';
import { canStand, movePlayer, nearestObject } from '../src/game/physics.mjs';
import { buildSession, STORY_KEY } from '../src/core/session.mjs';
const resume = sourceResume(), world = generateWorld(resume);
function states(seed) {
  const plan = mysteryPlan(seed, resume, world); let story = createMystery(seed, resume, world);
  const locked = structuredClone(story);
  for (const puzzle of plan.puzzles.filter(p => !p.optional)) story = solveMystery(story, plan, puzzle.id, puzzle.answer).state;
  return { plan, locked, open: story };
}
test('the real garden landmark and canal preserve the exact professional tree', () => {
  const original = structuredClone(world), base = gardenVillage(world), { plan, locked, open } = states('canal');
  assert.deepEqual(world, original); assert.equal(base.locations.length, world.locations.length + 1);
  const before = decorateAdventureScene(base, plan, locked), after = decorateAdventureScene(base, plan, open);
  assert.equal(gardenUnlocked(locked), false); assert.equal(gardenUnlocked(open), true);
  const bridge = base.garden.bridge, start = { x: bridge.x + 24, y: bridge.y - 12 };
  assert.equal(nearestObject(bridge.interactAt, before)?.id, bridge.id);
  assert.ok(movePlayer(start, { x: 0, y: 70 }, before).y < bridge.y);
  assert.ok(movePlayer(start, { x: 0, y: 70 }, after).y > bridge.y + bridge.height);
  for (const x of [8, bridge.x - 16, bridge.x + 64, base.bounds.width - 8]) {
    const pos = { x, y: bridge.y - 12 }; assert.ok(movePlayer(pos, { x: 0, y: 70 }, before).y < bridge.y);
  }
  assert.equal(canStand(gardenEntrance(world), after), true);
  const house = base.garden.location; assert.equal(canStand({ x: house.x + 48, y: house.y + 48 }, after), false);
  assert.equal(before.paths, after.paths); assert.equal(before.locations, after.locations);
});
test('secret entry is restored only after the actual persistent clue prerequisites', () => {
  const seed = 'garden-lock', { locked, open } = states(seed);
  const state = createProgress(resume); state.position = { scene: 'interior', buildingId: GARDEN_ID, point: { x: 80, y: 80 } };
  state.flags[STORY_KEY] = JSON.stringify(locked);
  let session = buildSession(resume, world, { seed, save: saveProgress(state), legacy: true });
  assert.equal(session.interior, null); assert.equal(session.state.position.scene, 'village');
  state.flags[STORY_KEY] = JSON.stringify(open);
  const expected = generateGarden(resume, seed); state.position.point = expected.spawn;
  session = buildSession(resume, world, { seed, save: saveProgress(state), legacy: true });
  assert.equal(session.interior.buildingId, GARDEN_ID); assert.deepEqual(session.point, expected.spawn);
  assert.equal(session.mystery.solved.length, 5); assert.equal(canStand(session.point, session.interior), true);
});
test('garden and optional devices reproduce, remain reachable, and never add fabricated records', () => {
  for (let i = 0; i < 12; i++) {
    const seed = `glasshouse-${i}`, { plan, open } = states(seed), one = generateGarden(resume, seed), two = generateGarden(resume, seed);
    assert.deepEqual(one, two); assert.equal(one.rooms.length, 4);
    const decorated = decorateAdventureScene(one, plan, open);
    assert.ok(decorated.objects.some(object => object.actions.some(action => action.kind === 'device')));
    for (const object of decorated.objects) {
      assert.equal(object.recordIds.length, 0); assert.ok(canStand(object.interactAt, decorated), object.id);
      if (object.actions.length) assert.equal(nearestObject(object.interactAt, decorated)?.id, object.id);
    }
    assert.ok(decorated.objects.some(object => object.actions.some(action => action.kind === 'exit')));
  }
});
