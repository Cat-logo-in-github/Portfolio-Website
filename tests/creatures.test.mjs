import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATURE_SPECIES, CREATURE_ACTORS, creatureTraits, createCreatureState, readCreatureState, saveCreatureState, spawnCreatures, stepCreatures, nearestCreature, creatureObject, creatureAction, restockCreatureFood, creatureAreaId } from '../src/core/creatures.mjs';
import { canStand, hasLineOfSight } from '../src/game/physics.mjs';
import { generateWorld, distanceToSegment } from '../src/core/world.mjs';
import { villageScene } from '../src/core/village.mjs';
import { generateInterior, defaultInteriorConfig } from '../src/core/interior.mjs';

const pointDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const scene = (extras = {}) => ({ id: 'village:test', kind: 'village', bounds: { width: 640, height: 480 }, spawn: { x: 32, y: 32 }, paths: [{ points: [{ x: 32, y: 32 }, { x: 608, y: 32 }] }], decorations: [{ x: 320, y: 240, kind: 'tree' }], locations: [], objects: [{ id: 'board', x: 100, y: 100, width: 16, height: 16, solid: true, interactAt: { x: 108, y: 132 } }], ...extras });
const entity = (species = 'mouse', map = scene(), extras = {}) => ({ id: `${creatureAreaId(map)}:creature:${species}:0`, species, name: CREATURE_ACTORS[species].name, preferredFood: CREATURE_ACTORS[species].food, areaId: creatureAreaId(map), sceneId: map.id, x: 180, y: 180, home: { x: 180, y: 180 }, path: [], target: { x: 180, y: 180 }, thinkAt: 0, decisions: 0, behavior: 'idle', facing: 'down', solid: false, sprite: CREATURE_ACTORS[species].sprite, ...extras });
const opts = (map = scene(), extras = {}) => ({ scene: map, player: { x: 160, y: 180 }, areaId: map.id, ...extras });
function befriend(state, actor, options) { return creatureAction(creatureAction(state, actor, 'observe', options).state, actor, 'feed', options).state; }

test('habitat spawning is seeded, nonblocking, bounded and keeps roads and interaction sides clear', () => {
  const map = scene(), sourceObjects = structuredClone(map.objects), state = createCreatureState('garden');
  for (const profile of ['calm', 'balanced', 'chaotic']) {
    const a = spawnCreatures(map, 'garden', state, map.spawn, { profile });
    assert.deepEqual(a, spawnCreatures(map, 'garden', state, map.spawn, { profile }));
    assert.ok(a.entities.length >= 3 && a.entities.length <= 9);
    assert.equal(a.entities.filter(actor => actor.species === 'caretaker').length, 1);
    for (const actor of [a.entities[0], a.entities.find(actor => actor.species === 'caretaker')]) { assert.ok(pointDistance(actor, map.spawn) >= 63); assert.ok(pointDistance(actor, map.spawn) <= 180); }
    for (const actor of a.entities) {
      assert.equal(actor.solid, false); assert.equal(canStand(actor, map), true);
      assert.ok(pointDistance(actor, map.spawn) > 40);
      assert.ok(pointDistance(actor, map.objects[0].interactAt) >= 25);
      assert.ok(distanceToSegment(actor, map.paths[0].points[0], map.paths[0].points[1]) >= 23);
      for (const other of a.entities) if (other.id !== actor.id) assert.ok(pointDistance(actor, other) >= 27);
    }
  }
  assert.deepEqual(map.objects, sourceObjects);
  assert.ok(spawnCreatures(map, 'garden', state, map.spawn, { profile: 'chaotic' }).entities.length > spawnCreatures(map, 'garden', state, map.spawn).entities.length);
  assert.notDeepEqual(spawnCreatures(map, 'other', createCreatureState('other')), spawnCreatures(map, 'garden', state));
});

test('six fauna species use distinct habitat rules and persist stable IDs across decoration changes', () => {
  assert.equal(Object.keys(CREATURE_SPECIES).length, 6);
  const all = new Set();
  for (const archetype of ['home', 'library', 'workshop', 'studio', 'glitch-garden']) {
    const floor = Array.from({ length: 26 }, (_, y) => Array.from({ length: 36 }, (_, x) => `${x + 1},${y + 1}`)).flat();
    const map = scene({ id: `${archetype}:decor-a`, buildingId: `house:${archetype}`, kind: 'interior', archetype, floor });
    const sim = spawnCreatures(map, 'stable', createCreatureState('stable'), map.spawn, { profile: 'chaotic' });
    for (const actor of sim.entities) { all.add(actor.species); assert.ok(CREATURE_SPECIES[actor.species].habitats.includes(archetype)); }
    assert.deepEqual(sim.entities.map(actor => actor.id), spawnCreatures({ ...map, id: `${archetype}:decor-b`, decorations: [] }, 'stable', createCreatureState('stable'), map.spawn, { profile: 'chaotic' }).entities.map(actor => actor.id));
  }
  assert.deepEqual([...all].sort(), ['bat', 'gardenMouse', 'moth', 'mouse', 'slime', 'spider']);
});

test('real generated villages and interiors spawn on legal geometry without mutating essential objects', () => {
  const resume = { sourceHash: 'creature-fixture', sections: ['education', 'projects', 'content', 'experience'].map(type => ({ id: type, type, label: type, entries: [{ id: `${type}-1`, title: type, details: ['A factual record.'] }] })) };
  for (const seed of ['geometry-a', 'geometry-b']) {
    const world = generateWorld(resume, undefined, { layoutSeed: seed, decorationSeed: seed });
    const maps = [villageScene(world), ...world.locations.map(location => generateInterior(resume, location, defaultInteriorConfig(resume, location)))];
    for (const map of maps) {
      const before = JSON.stringify(map.objects), simulation = spawnCreatures(map, seed, createCreatureState(seed));
      for (const actor of simulation.entities) assert.equal(canStand(actor, map), true, `${map.id}: ${actor.id}`);
      if (map.kind === 'village') for (const actor of [simulation.entities[0], simulation.entities.find(actor => actor.species === 'caretaker')]) assert.ok(pointDistance(actor, map.spawn) <= 180, `${map.id}: a nearby living arrival habitat`);
      assert.equal(JSON.stringify(map.objects), before);
    }
  }
});

test('bounded simulation moves safely and deterministically, and pauses without ticking', () => {
  const map = scene(), state = createCreatureState('motion'); let a = spawnCreatures(map, 'motion', state), b = spawnCreatures(map, 'motion', state);
  const start = a.entities.map(actor => ({ x: actor.x, y: actor.y }));
  for (let i = 0; i < 240; i++) {
    a = stepCreatures(a, map, map.spawn, .05, state); b = stepCreatures(b, map, map.spawn, .05, state);
    assert.ok(a.entities.length <= 9);
    for (const actor of a.entities) {
      assert.equal(canStand(actor, map), true);
      for (const other of a.entities) if (other.id !== actor.id) assert.ok(pointDistance(actor, other) > 11.9);
    }
  }
  assert.deepEqual(a, b); assert.ok(a.entities.some((actor, index) => pointDistance(actor, start[index]) > 5));
  for (const dt of [0, -1, NaN, 5]) assert.equal(stepCreatures(a, map, map.spawn, dt, state), a);
  assert.equal(stepCreatures(a, map, map.spawn, .05, state, { paused: true }), a);
});

test('curious and shy behavior visibly respond to a nearby player', () => {
  const map = scene({ decorations: [], objects: [] }), state = createCreatureState('behavior'), player = { x: 220, y: 180 };
  for (const [species, expected] of [['mouse', 'curious'], ['bat', 'shy']]) {
    const actor = entity(species, map); let sim = { version: 1, seed: 'behavior', sceneId: map.id, areaId: 'village', time: 0, entities: [actor] };
    sim = stepCreatures(sim, map, player, .05, state);
    assert.equal(sim.entities[0].behavior, expected);
    assert.equal(species === 'mouse' ? pointDistance(sim.entities[0], player) < 40 : pointDistance(sim.entities[0], player) > 40, true);
  }
});

test('seeded individual traits vary within bounds and drive movement, roam radius, approach and rest', () => {
  const one = creatureTraits('traits', 'mouse:1', 'mouse'), two = creatureTraits('traits', 'mouse:2', 'mouse');
  assert.deepEqual(one, creatureTraits('traits', 'mouse:1', 'mouse')); assert.notDeepEqual(one, two);
  for (let i = 0; i < 100; i++) { const traits = creatureTraits('traits', `mouse:${i}`, 'mouse'); assert.ok(traits.speed >= 22 * .85 && traits.speed <= 22 * 1.15); assert.ok(traits.wanderRadius >= 64 * .8 && traits.wanderRadius <= 64 * 1.2); assert.ok(traits.restTempo >= .8 && traits.restTempo <= 1.2); }
  const map = scene({ objects: [], decorations: [] }), state = createCreatureState('traits');
  const tick = (actor, player = map.spawn) => stepCreatures({ version: 1, seed: 'traits', sceneId: map.id, areaId: 'village', time: 0, entities: [actor] }, map, player, .1, state).entities[0];
  const moving = entity('mouse', map, { path: [{ x: 260, y: 180 }], thinkAt: 99 });
  assert.ok(tick({ ...moving, traits: { ...one, speed: 25 } }).x > tick({ ...moving, traits: { ...one, speed: 19 } }).x);
  const wanderer = entity('slime', map), base = creatureTraits('traits', wanderer.id, 'slime');
  const near = tick({ ...wanderer, traits: { ...base, wanderRadius: 35, restTempo: .8 } });
  const far = tick({ ...wanderer, traits: { ...base, wanderRadius: 95, restTempo: 1.2 } });
  assert.ok(pointDistance(far.target, wanderer.home) > pointDistance(near.target, wanderer.home)); assert.ok(far.thinkAt > near.thinkAt);
  const mouse = entity('mouse', map), player = { x: 270, y: 180 };
  assert.equal(tick({ ...mouse, traits: { ...one, approachDistance: 110 } }, player).behavior, 'curious');
  assert.equal(tick({ ...mouse, traits: { ...one, approachDistance: 80 } }, player).behavior, 'wander');
  const rareCounts = Array.from({ length: 100 }, (_, i) => spawnCreatures(map, `rare:${i}`).entities.filter(actor => actor.rare).length).reduce((a, b) => a + b, 0);
  assert.ok(rareCounts > 0 && rareCounts < 60, 'Rare glimmers are deterministic cosmetic variants, not the default.');
});

test('cozy fauna forage at flowers or pause beside readable spots without making them solid', () => {
  const map = scene({ objects: [{ id: 'reading-lamp', type: 'lamp', x: 240, y: 150, width: 16, height: 16, solid: true, interactAt: { x: 248, y: 180 }, actions: [{ kind: 'light' }] }], decorations: [{ kind: 'flowers', x: 220, y: 200, solid: false }] }), state = createCreatureState('cozy');
  const tick = actor => stepCreatures({ version: 1, seed: 'cozy', sceneId: map.id, areaId: 'village', time: 0, entities: [actor] }, map, map.spawn, .1, state).entities[0];
  const forager = tick(entity('gardenMouse', map)); assert.equal(forager.behavior, 'forage'); assert.deepEqual({ x: forager.target.x, y: forager.target.y }, { x: 220, y: 200 });
  const guide = tick(entity('moth', map)); assert.equal(guide.behavior, 'point'); assert.deepEqual(guide.lookAt, map.objects[0].interactAt); assert.ok(pointDistance(guide.target, guide.lookAt) >= 20); assert.equal(canStand(guide.target, map), true);
  assert.equal(creatureObject(forager).solid, false); assert.equal(creatureObject(guide).solid, false);
});

test('interactions require the current area, proximity and an unobstructed usable position', () => {
  const map = scene(), actor = entity('mouse', map), state = createCreatureState('range');
  for (const options of [opts(map, { player: { x: 500, y: 180 } }), opts(map, { areaId: 'wrong' }), opts({ ...map, id: 'other' }), opts(map, { player: { x: NaN, y: 180 } }), opts(map, { player: { x: 108, y: 108 } })]) {
    const result = creatureAction(state, actor, 'feed', options); assert.equal(result.state, state); assert.equal(result.error, 'out-of-range'); assert.equal(state.food.grain, 8);
  }
  const wallMap = scene({ objects: [{ id: 'wall', x: 168, y: 150, width: 8, height: 60, solid: true }] });
  assert.equal(creatureAction(state, actor, 'feed', opts(wallMap)).error, 'out-of-range');
  assert.equal(nearestCreature({ entities: [actor] }, { x: 160, y: 180 }, wallMap), null);
  assert.equal(nearestCreature({ entities: [actor] }, { x: 160, y: 180 }, map)?.id, actor.id);
  const adapter = creatureObject(actor); assert.equal(adapter.creatureEntity, actor); assert.equal(adapter.actions[0].kind, 'creature'); assert.equal(adapter.solid, false);
});

test('valid feeding spends exactly one favorite snack and repeats or invalid attempts spend nothing', () => {
  const map = scene(), actor = entity('mouse', map); let state = createCreatureState('feeding');
  assert.equal(creatureAction(state, actor, 'feed', opts(map, { food: 'spark' })).error, 'wrong-food');
  assert.equal(state.food.grain, 8);
  state = creatureAction(state, actor, 'feed', opts(map)).state; assert.equal(state.food.grain, 7); assert.equal(state.food.berry, 8);
  assert.equal(creatureAction(state, actor, 'feed', opts(map)).state, state);
  const empty = { ...createCreatureState('empty'), food: { grain: 0, berry: 8, spark: 8 } };
  assert.equal(creatureAction(empty, actor, 'feed', opts(map)).error, 'no-food');
  assert.equal(creatureAction(empty, actor, 'dance', opts(map)).error, 'invalid-action');
});

test('one observation and one valid snack befriend each fauna; shy bats require a quiet first approach', () => {
  const map = scene();
  for (const species of Object.keys(CREATURE_SPECIES)) {
    const actor = entity(species, map); let state = createCreatureState('trust');
    assert.equal(creatureAction(state, actor, 'follow', opts(map)).error, 'not-befriended');
    if (species === 'bat') { assert.equal(creatureAction(state, actor, 'feed', opts(map)).state, state); assert.equal(state.food.berry, 8); }
    state = creatureAction(state, actor, 'observe', opts(map)).state;
    assert.equal(state.relationships[actor.id].bond, 1);
    assert.equal(creatureAction(state, actor, 'observe', opts(map)).state, state);
    state = creatureAction(state, actor, 'feed', opts(map)).state;
    assert.equal(state.relationships[actor.id].bond, 2); assert.equal(state.relationships[actor.id].tamed, true);
    assert.equal(creatureAction(state, actor, 'feed', opts(map)).state, state);
  }
});

test('a single friend can follow, wait safely across saves and be released without losing friendship', () => {
  const map = scene(), actor = entity('mouse', map), second = entity('slime', map); let state = befriend(createCreatureState('friend'), actor, opts(map));
  state = creatureAction(state, actor, 'follow', opts(map)).state; assert.equal(state.companion.id, actor.id);
  state = befriend(state, second, opts(map)); state = creatureAction(state, second, 'follow', opts(map)).state; assert.equal(state.companion.id, second.id);
  state = creatureAction(state, second, 'wait', opts(map)).state; assert.equal(state.companion.mode, 'wait');
  assert.deepEqual(readCreatureState(saveCreatureState(state), 'friend'), state);
  let sim = { version: 1, seed: 'friend', sceneId: map.id, areaId: 'village', time: 0, entities: [{ ...second, path: [{ x: 240, y: 180 }] }] };
  sim = stepCreatures(sim, map, map.spawn, .1, state); assert.equal(sim.entities[0].x, second.x); assert.equal(sim.entities[0].behavior, 'wait');
  state = creatureAction(state, second, 'release', opts(map)).state; assert.equal(state.companion, null); assert.equal(state.relationships[second.id].tamed, true);
});

test('followers join new areas safely while waiting friends stay in their own area; the population stays bounded', () => {
  const first = scene(), actor = entity('mouse', first); let state = befriend(createCreatureState('arrival'), actor, opts(first));
  state = creatureAction(state, actor, 'follow', opts(first)).state;
  const next = scene({ id: 'workshop:new', buildingId: 'house:workshop', kind: 'village' });
  let sim = spawnCreatures(next, 'arrival', state, next.spawn, { profile: 'chaotic' });
  assert.ok(sim.entities.length <= 9); const followed = sim.entities.find(other => other.id === actor.id); assert.ok(followed); assert.equal(canStand(followed, next), true); assert.ok(pointDistance(followed, next.spawn) >= 25);
  state = creatureAction(state, actor, 'wait', opts(first)).state;
  sim = spawnCreatures(next, 'arrival', state); assert.equal(sim.entities.some(other => other.id === actor.id), false);
  const native = spawnCreatures(first, 'arrival').entities.find(other => other.species !== 'caretaker');
  const elsewhere = { ...state, companion: { id: native.id, species: native.species, mode: 'wait', areaId: 'house:elsewhere', point: { x: 200, y: 200 } } };
  assert.equal(spawnCreatures(first, 'arrival', elsewhere).entities.some(other => other.id === native.id), false, 'A waiting friend must not appear a second time in its native area.');
});

test('untrusted saves reject invalid versions, seed changes and food while reconstructing bounded relationships', () => {
  const fresh = createCreatureState('load'), map = scene(), actor = entity('mouse', map), state = befriend(fresh, actor, opts(map));
  for (const json of ['{', JSON.stringify({ ...state, version: 99 }), JSON.stringify({ ...state, seed: 'other' }), JSON.stringify({ ...state, food: { grain: -1, berry: 8, spark: 8 } }), 'x'.repeat(120001)]) assert.deepEqual(readCreatureState(json, 'load'), fresh);
  const raw = { ...state, relationships: { ...state.relationships, impossible: { species: 'dragon', homeArea: 'village', observed: true, fed: true }, unearned: { species: 'mouse', homeArea: 'village', observed: false, fed: false, bond: 999, tamed: true } }, companion: { id: 'unearned', mode: 'follow', areaId: 'village' } };
  const restored = readCreatureState(JSON.stringify(raw), 'load'); assert.equal(restored.relationships.impossible, undefined); assert.equal(restored.relationships.unearned.bond, 0); assert.equal(restored.relationships.unearned.tamed, false); assert.equal(restored.companion, null);
});

test('the free pantry caps every snack at eight without affecting friendships', () => {
  const map = scene(), actor = entity('mouse', map); const state = befriend(createCreatureState('pantry'), actor, opts(map));
  const refilled = restockCreatureFood(state).state; assert.deepEqual(refilled.food, { grain: 8, berry: 8, spark: 8 }); assert.deepEqual(refilled.relationships, state.relationships); assert.deepEqual(restockCreatureFood(refilled).state, refilled);
});

test('a wandering caretaker patrols legal waypoints and offers tips without feeding or taming', () => {
  const map = scene(), state = createCreatureState('caretaker'), sim = spawnCreatures(map, 'caretaker', state), actor = sim.entities.find(other => other.species === 'caretaker');
  assert.ok(actor); assert.ok(actor.waypoints.length > 1); assert.equal(actor.sprite.index, 84);
  const player = { x: actor.x, y: actor.y + 20 }, options = opts(map, { player });
  assert.equal(hasLineOfSight(player, actor, map), true);
  const result = creatureAction(state, actor, 'observe', options); assert.match(result.message, /pantry/); assert.equal(result.state.relationships[actor.id].tamed, false); assert.deepEqual(result.state.food, state.food);
  assert.equal(creatureAction(state, actor, 'feed', options).error, 'not-tameable');
  const moved = stepCreatures(sim, map, map.spawn, .1, state).entities.find(other => other.id === actor.id); assert.equal(moved.behavior, 'patrol'); assert.ok(pointDistance(moved, actor) > 0);
});
