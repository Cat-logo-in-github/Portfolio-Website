import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDINAL_CONNECTIONS, connectionMask, connectionShape, terrainQuarterTiles, roadTiles } from '../src/core/connections.mjs';
import { generateInterior, defaultInteriorConfig } from '../src/core/interior.mjs';
import { canStand, movePlayer } from '../src/game/physics.mjs';

const fixture = { sections: [{ id: 'projects', label: 'Projects', type: 'projects', entries: [{ id: 'prototype', title: 'Prototype', details: ['Built a working prototype.'] }] }] };
const building = { id: 'location-projects', sectionId: 'projects', type: 'projects', label: 'Projects' };

test('every cardinal road/corridor connection has a stable mask and an existing-asset quarter layout', () => {
  for (let mask = 0; mask < 16; mask++) {
    const occupied = new Set(['0,0']);
    for (const direction of CARDINAL_CONNECTIONS) if (mask & direction.bit) occupied.add(`${direction.dx},${direction.dy}`);
    assert.equal(connectionMask(occupied, 0, 0), mask);
    const quads = terrainQuarterTiles(mask); assert.equal(quads.length, 4);
    assert.ok(quads.every(index => [12, 13, 14, 24, 25, 26, 36, 37, 38].includes(index)));
  }
  for (const mask of [1, 2, 4, 8]) assert.equal(connectionShape(mask), 'end');
  for (const mask of [3, 6, 9, 12]) assert.equal(connectionShape(mask), 'corner');
  for (const mask of [5, 10]) assert.equal(connectionShape(mask), 'straight');
  for (const mask of [7, 11, 13, 14]) assert.equal(connectionShape(mask), 'tee');
  assert.equal(connectionShape(15), 'cross'); assert.equal(connectionShape(0), 'isolated');
});

test('roads join all orientations and end flush at an aligned building front', () => {
  const paths = [[{ x: 64, y: 64 }, { x: 64, y: 128 }], [{ x: 32, y: 96 }, { x: 128, y: 96 }]].map(points => ({ points }));
  const road = roadTiles(paths), occupied = new Set(road.map(tile => `${tile.x / 16},${tile.y / 16}`));
  assert.ok(road.some(tile => tile.mask === 15));
  assert.equal(Math.min(...road.map(tile => tile.y)), 48, 'entrance road begins exactly16px before its endpoint');
  for (const tile of road) assert.equal(tile.mask, connectionMask(occupied, tile.x / 16, tile.y / 16));
  assert.throws(() => roadTiles([{ points: [{ x: 0, y: 0 }, { x: 16, y: 16 }] }]), /orthogonal/);
});

test('generated exit door is a real boundary opening with walkable floor on both sides', () => {
  for (const archetype of ['home', 'library', 'workshop', 'studio']) for (const layoutSeed of ['boundary-A', 'boundary-B']) {
    const config = { ...defaultInteriorConfig(fixture, building), archetype, nodeCount: 5, sequence: [1, 3, 3], layoutSeed };
    const scene = generateInterior(fixture, building, config), entry = scene.entrance, foyer = scene.rooms[0];
    assert.equal(entry.door.y + 16, foyer.y); assert.equal(scene.exit.y, foyer.y - 8);
    assert.equal(canStand(entry.inside, scene), true); assert.equal(canStand(entry.outside, scene), true);
    const through = movePlayer(entry.inside, { x: entry.outside.x - entry.inside.x, y: entry.outside.y - entry.inside.y }, scene);
    assert.deepEqual(through, entry.outside);
    assert.equal(canStand({ x: scene.exit.x - 16, y: scene.exit.y }, scene), false, 'wall beside the opening remains solid');
    const door = scene.objects.find(object => object.actions.some(action => action.kind === 'exit'));
    assert.equal(door.x, entry.door.x); assert.equal(door.y, entry.door.y); assert.deepEqual(door.interactAt, entry.inside);
    const floor = new Set(scene.floor);
    for (const tile of scene.tiles.filter(tile => tile.kind !== 'wall')) assert.equal(tile.mask, connectionMask(floor, tile.x / 16, tile.y / 16));
    for (const tile of scene.tiles.filter(tile => tile.kind === 'door')) assert.ok(['horizontal', 'vertical'].includes(tile.orientation));
  }
});
