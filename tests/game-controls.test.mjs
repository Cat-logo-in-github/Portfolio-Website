import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_ANIMATIONS, characterFrame, facingFromMovement, npcFrame } from '../src/game/animation.mjs';
import { canStand, movePlayer } from '../src/game/physics.mjs';
import { findWalkPath, canInteractWith, objectAtPoint, sceneGeometryChanged } from '../src/game/navigation.mjs';

const scene = { id: 'test', kind: 'village', bounds: { width: 240, height: 160 }, paths: [], objects: [{ id: 'wall', type: 'desk', x: 96, y: 24, width: 32, height: 80, solid: true, range: 32, interactAt: { x: 112, y: 120 }, actions: [{ id: 'inspect' }] }] };

test('four authored directional walk cycles have distinct source rows/columns and proper action bounds', () => {
  const directions = ['down', 'up', 'left', 'right'];
  assert.equal(new Set(directions.map(direction => JSON.stringify(characterFrame('walk', direction, 125)))).size, 4);
  for (const [state, animation] of Object.entries(CHARACTER_ANIMATIONS)) for (const direction of directions) for (const elapsed of [0, 80, 160, 240, 10000]) {
    const frame = characterFrame(state, direction, elapsed);
    assert.ok(frame.x >= 0 && frame.x + frame.width <= 170, `${state} x`);
    assert.ok(frame.y >= 0 && frame.y + frame.height <= 153, `${state} y`);
    assert.equal(frame.x % 17, 0); assert.equal(frame.y % 17, 0);
    assert.deepEqual(characterFrame(state, direction, elapsed, true), characterFrame(state, direction, 0, true));
  }
  assert.equal(facingFromMovement(0, -1), 'up'); assert.equal(facingFromMovement(-1, 0), 'left');
  assert.equal(facingFromMovement(0, 0, 'right'), 'right');
  assert.deepEqual(npcFrame('archivist', 100000, true, true), npcFrame('archivist', 0, true, true));
});

test('click-to-walk routes safely around visible props using actual movement collision', () => {
  const start = { x: 48, y: 56 }, end = { x: 176, y: 56 }, path = findWalkPath(start, end, scene);
  assert.ok(path?.length > 1); let point = start;
  for (const next of path) {
    assert.equal(canStand(next, scene), true);
    point = movePlayer(point, { x: next.x - point.x, y: next.y - point.y }, scene);
    assert.ok(Math.hypot(point.x - next.x, point.y - next.y) < 0.01);
  }
  assert.deepEqual(point, end);
  assert.equal(findWalkPath(start, { x: 112, y: 56 }, scene), null);
  assert.equal(findWalkPath(start, end, scene, 1), null, 'search has a hard bound');
  assert.equal(objectAtPoint({ x: 110, y: 60 }, scene)?.id, 'wall');
  assert.equal(canInteractWith({ x: 112, y: 120 }, scene.objects[0], scene), true);
  assert.equal(canInteractWith({ x: 112, y: 8 }, scene.objects[0], scene), false);
});

test('click-to-walk never bridges disconnected interior floors', () => {
  const interior = { id: 'inside', kind: 'interior', bounds: { width: 160, height: 96 }, floor: ['1,1', '2,1', '6,1', '7,1'], objects: [], paths: [] };
  assert.equal(findWalkPath({ x: 24, y: 24 }, { x: 104, y: 24 }, interior), null);
});

test('story state updates preserve geometry while genuine generation changes reset the scene', () => {
  assert.equal(sceneGeometryChanged(scene, { ...scene, objects: [...scene.objects, { id: 'clue' }] }), false);
  assert.equal(sceneGeometryChanged(scene, { ...scene, id: 'another-room' }), true);
  assert.equal(sceneGeometryChanged(scene, { ...scene, paths: [] }), true);
  assert.equal(sceneGeometryChanged(scene, { ...scene, bounds: { width: 320, height: 160 } }), true);
});
