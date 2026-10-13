import test from 'node:test';
import assert from 'node:assert/strict';
import { movementVector, canStand, movePlayer, nearestLocation } from '../src/game/physics.mjs';

const world = { bounds: { width: 500, height: 400 }, locations: [{ id: 'home', x: 80, y: 80, size: { width: 64, height: 48 }, entrance: { x: 112, y: 150 } }] };
test('diagonal movement has equal speed and neutral input stops', () => { assert.ok(Math.abs(Math.hypot(...Object.values(movementVector(1, 1, 100, 1))) - 100) < 1e-10); assert.deepEqual(movementVector(0, 0, 100, 1), { x: 0, y: 0 }); });
test('foot collision rejects buildings and world bounds; entrance is accessible', () => { assert.equal(canStand({ x: 100, y: 100 }, world), false); assert.equal(canStand({ x: 112, y: 150 }, world), true); assert.equal(canStand({ x: 1, y: 1 }, world), false); });
test('large deltas cannot tunnel through a building', () => { const result = movePlayer({ x: 50, y: 100 }, { x: 160, y: 0 }, world); assert.ok(result.x <= 75); });
test('axis resolution permits sliding past walls', () => { const result = movePlayer({ x: 74, y: 100 }, { x: 8, y: 10 }, world); assert.ok(result.x < 80); assert.ok(Math.abs(result.y - 110) < 1e-10); });
test('interaction range selects nearest entrance and excludes distant houses', () => { assert.equal(nearestLocation({ x: 112, y: 150 }, world).id, 'home'); assert.equal(nearestLocation({ x: 450, y: 350 }, world), null); });
