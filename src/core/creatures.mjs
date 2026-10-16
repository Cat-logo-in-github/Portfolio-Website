import { canStand, movePlayer, hasLineOfSight } from '../game/physics.mjs';
import { findWalkPath } from '../game/navigation.mjs';
import { distanceToSegment } from './world.mjs';

export const CREATURE_KEY = 'v4:creatures';
export const CREATURE_SPECIES = Object.freeze({
  mouse: { id: 'mouse', name: 'Margin Mouse', personality: 'curious', food: 'grain', habitats: ['village', 'home', 'library'], speed: 22, radius: 64, sprite: { sheet: 'dungeon', index: 124 }, hint: 'Curious about notebooks. Observe, then share a little grain.' },
  bat: { id: 'bat', name: 'Bookmark Bat', personality: 'shy', food: 'berry', habitats: ['library', 'archive', 'home', 'glitch-garden'], speed: 28, radius: 48, sprite: { sheet: 'dungeon', index: 120 }, hint: 'Give this shy reader space. Observe quietly before offering a berry.' },
  slime: { id: 'slime', name: 'Jelly Byte', personality: 'playful', food: 'berry', habitats: ['village', 'workshop', 'studio', 'glitch-garden'], speed: 30, radius: 88, sprite: { sheet: 'dungeon', index: 108 }, hint: 'A playful fictional slime. Observation and a berry earn its trust.' },
  spider: { id: 'spider', name: 'Clockwork Spider', personality: 'territorial', food: 'spark', habitats: ['workshop', 'research', 'glitch-garden'], speed: 18, radius: 40, sprite: { sheet: 'dungeon', index: 122 }, hint: 'Patrols a tiny, imaginary workshop territory. Observe, then offer a spark.' },
  gardenMouse: { id: 'gardenMouse', name: 'Garden Mouse', personality: 'foraging', food: 'berry', habitats: ['village', 'home', 'glitch-garden'], speed: 19, radius: 72, sprite: { sheet: 'dungeon', index: 124 }, hint: 'Follows flower patches and pauses to forage. Observe, then share a berry.' },
  moth: { id: 'moth', name: 'Lantern Moth', personality: 'guiding', food: 'spark', habitats: ['library', 'studio', 'glitch-garden'], speed: 25, radius: 68, sprite: { sheet: 'dungeon', index: 120 }, hint: 'A fictional lantern-wing drawn to lamps and reading spots. Observe, then offer a tiny spark.' }
});
export const CREATURE_ACTORS = Object.freeze({ ...CREATURE_SPECIES, caretaker: { id: 'caretaker', name: 'Roaming Caretaker', personality: 'helpful', food: null, tameable: false, speed: 20, radius: 60, sprite: { sheet: 'dungeon', index: 84 }, hint: 'The roads connect every house. Use the Journal for mystery clues, the Portfolio for the complete résumé, and the pantry for free creature snacks.' } });
const FOODS = ['grain', 'berry', 'spark'];
const clone = value => structuredClone(value);
const finitePoint = value => value && Number.isFinite(value.x) && Number.isFinite(value.y);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const safeKey = value => typeof value === 'string' && value.length > 0 && value.length < 300 && !['__proto__', 'constructor', 'prototype'].includes(value);
function hash(text) { let value = 2166136261; for (const ch of String(text)) { value ^= ch.charCodeAt(0); value = Math.imul(value, 16777619); } value ^= value >>> 16; value = Math.imul(value, 0x85ebca6b); return (value ^ value >>> 13) >>> 0; }
const unit = (seed, index, stream) => hash(`${seed}:${index}:${stream}`) / 4294967296;
export const creatureAreaId = scene => scene.buildingId || (scene.kind === 'village' ? 'village' : scene.id);
/** Traits belong to a stable individual, so redecorating never rerolls its habits. */
export function creatureTraits(seed, id, speciesId) {
  const species = CREATURE_ACTORS[speciesId] || CREATURE_SPECIES.mouse;
  const variation = stream => unit(`${seed}:${id}`, 0, stream);
  return {
    speed: species.speed * (.85 + variation('speed') * .3),
    wanderRadius: species.radius * (.8 + variation('radius') * .4),
    approachDistance: (species.personality === 'shy' ? 70 : 110) * (.85 + variation('approach') * .3),
    restTempo: .8 + variation('tempo') * .4
  };
}

export function createCreatureState(seed) { return { version: 1, seed: String(seed), food: { grain: 8, berry: 8, spark: 8 }, relationships: {}, companion: null }; }
export const saveCreatureState = state => JSON.stringify(state);
export function readCreatureState(json, seed) {
  const fresh = createCreatureState(seed);
  if (!json) return fresh;
  try {
    if (typeof json !== 'string' || json.length > 120000) return fresh;
    const raw = JSON.parse(json);
    if (raw?.version !== 1 || raw.seed !== fresh.seed || !raw.food || !raw.relationships || typeof raw.relationships !== 'object' || Array.isArray(raw.relationships) || Object.keys(raw.relationships).length > 128) return fresh;
    for (const food of FOODS) if (!Number.isSafeInteger(raw.food[food]) || raw.food[food] < 0 || raw.food[food] > 8) return fresh; else fresh.food[food] = raw.food[food];
    for (const [id, relation] of Object.entries(raw.relationships)) {
      if (!safeKey(id) || !relation || !Object.hasOwn(CREATURE_ACTORS, relation.species) || !safeKey(relation.homeArea)) continue;
      const observed = relation.observed === true, fed = relation.fed === true;
      const tameable = CREATURE_ACTORS[relation.species].tameable !== false;
      fresh.relationships[id] = { species: relation.species, homeArea: relation.homeArea, observed, fed: tameable && fed, bond: tameable ? Number(observed) + Number(fed) : 0, tamed: tameable && observed && fed };
    }
    const companion = raw.companion;
    if (companion && fresh.relationships[companion.id]?.tamed && ['follow', 'wait'].includes(companion.mode) && safeKey(companion.areaId)) fresh.companion = { id: companion.id, species: fresh.relationships[companion.id].species, mode: companion.mode, areaId: companion.areaId, ...(finitePoint(companion.point) ? { point: { x: companion.point.x, y: companion.point.y } } : {}) };
    return fresh;
  } catch { return fresh; }
}

function protectedPoint(point, scene, radius = 25) {
  if (distance(point, scene.spawn) < 40 || finitePoint(scene.exit) && distance(point, scene.exit) < 34) return true;
  return (scene.objects || []).some(object => finitePoint(object.interactAt) && distance(point, object.interactAt) < radius);
}
function safeSpawn(point, scene, others = [], allowNearPlayer = false) {
  return canStand(point, scene) && (allowNearPlayer || !protectedPoint(point, scene)) && others.every(other => distance(point, other) >= 27)
    && (allowNearPlayer || !(scene.paths || []).some(path => path.points.slice(1).some((end, index) => distanceToSegment(point, path.points[index], end) < (scene.kind === 'village' ? 23 : 14))));
}
function nearbyPoint(scene, origin, seed, others = [], spacing = 30) {
  for (let index = 0; index < 24; index++) {
    const angle = unit(seed, index, 'near-angle') * Math.PI * 2, radius = spacing + Math.floor(index / 8) * 16;
    const point = { x: Math.round(origin.x + Math.cos(angle) * radius), y: Math.round(origin.y + Math.sin(angle) * radius) };
    if (safeSpawn(point, scene, others, true)) return point;
  }
  return null;
}
function arrivalHabitat(scene, seed) {
  const points = [];
  for (let ring = 64; ring <= 176; ring += 16) for (let index = 0; index < 24; index++) {
    const angle = (index / 24 + unit(seed, ring, 'arrival-ring')) * Math.PI * 2;
    const point = { x: Math.round(scene.spawn.x + Math.cos(angle) * ring), y: Math.round(scene.spawn.y + Math.sin(angle) * ring) };
    if ((!scene.garden || point.y < scene.garden.channelY - 8) && distance(point, scene.spawn) >= 63 && distance(point, scene.spawn) <= 180) points.push(point);
  }
  return points;
}

export function spawnCreatures(scene, seed, state = createCreatureState(seed), player = scene.spawn, options = {}) {
  state = state?.version === 1 ? state : createCreatureState(seed);
  const areaId = creatureAreaId(scene), habitat = scene.habitat || scene.archetype || scene.kind;
  const eligible = Object.values(CREATURE_SPECIES).filter(species => species.habitats.includes(habitat));
  const choices = eligible.length ? eligible : [CREATURE_SPECIES.mouse];
  const counts = scene.kind === 'village' ? { calm: 4, balanced: 6, chaotic: 8 } : { calm: 2, balanced: 3, chaotic: 4 };
  const count = counts[options.profile] || counts.calm, candidates = [], entities = [];
  const arrivalCandidates = scene.kind === 'village' ? arrivalHabitat(scene, `${seed}:${areaId}`) : [];
  if (scene.kind === 'interior' && scene.floor?.length) {
    for (const tile of scene.floor) { const [x, y] = tile.split(',').map(Number); if (Number.isFinite(x) && Number.isFinite(y)) candidates.push({ x: x * 16 + 8, y: y * 16 + 8 }); }
    candidates.sort((a, b) => hash(`${seed}:${areaId}:${a.x},${a.y}`) - hash(`${seed}:${areaId}:${b.x},${b.y}`));
  } else {
    for (let index = 0; index < 1200; index++) candidates.push({ x: 32 + Math.floor(unit(`${seed}:${areaId}`, index, 'spawn-x') * Math.max(1, (scene.bounds.width - 64) / 16)) * 16, y: 32 + Math.floor(unit(`${seed}:${areaId}`, index, 'spawn-y') * Math.max(1, (scene.bounds.height - 64) / 16)) * 16 });
  }
  for (let index = 0; index < count; index++) {
    const species = choices[(index + hash(`${seed}:${areaId}:species`)) % choices.length];
    const preferred = index === 0 && arrivalCandidates.length ? [...arrivalCandidates, ...candidates] : candidates;
    const point = preferred.find(point => distance(point, player) > 40 && safeSpawn(point, scene, entities));
    if (!point) break;
    const id = `${areaId}:creature:${species.id}:${index}`;
    if (state.companion?.id === id && state.companion.mode === 'wait' && state.companion.areaId !== areaId) continue;
    entities.push({ id, species: species.id, name: species.name, preferredFood: species.food, personality: species.personality, areaId, sceneId: scene.id, x: point.x, y: point.y, home: { ...point }, target: { ...point }, path: [], facing: 'down', behavior: 'idle', sprite: { ...species.sprite }, solid: false, thinkAt: 0, decisions: 0 });
  }
  if (scene.kind === 'village') {
    const point = [...arrivalCandidates, ...candidates].find(point => distance(point, player) > 40 && safeSpawn(point, scene, entities));
    if (point) {
      const actor = CREATURE_ACTORS.caretaker;
      const waypoints = [...arrivalCandidates, ...candidates].filter(candidate => distance(point, candidate) > 24 && distance(point, candidate) < actor.radius && safeSpawn(candidate, scene, entities)).slice(0, 3);
      entities.push({ id: `${areaId}:caretaker`, species: actor.id, name: actor.name, preferredFood: null, personality: actor.personality, tameable: false, areaId, sceneId: scene.id, x: point.x, y: point.y, home: { ...point }, target: { ...point }, waypoints: [{ ...point }, ...waypoints], path: [], facing: 'down', behavior: 'patrol', sprite: { ...actor.sprite }, solid: false, thinkAt: 0, decisions: 0 });
    }
  }
  const companion = state.companion;
  if (companion && (companion.mode === 'follow' || companion.areaId === areaId)) {
    const existing = entities.find(entity => entity.id === companion.id);
    const species = CREATURE_SPECIES[companion.species];
    const others = entities.filter(entity => entity.id !== companion.id);
    const desired = companion.mode === 'wait' && finitePoint(companion.point) && distance(companion.point, player) >= 15 && safeSpawn(companion.point, scene, others, true) ? companion.point : nearbyPoint(scene, player, `${seed}:${companion.id}:arrival`, others);
    if (species && desired) {
      if (existing) Object.assign(existing, { x: desired.x, y: desired.y, target: { ...desired }, home: { ...desired } });
      else {
        if (entities.length >= 9) entities.splice(entities.findLastIndex(entity => entity.species !== 'caretaker'), 1);
        entities.push({ id: companion.id, species: species.id, name: species.name, preferredFood: species.food, personality: species.personality, areaId, sceneId: scene.id, x: desired.x, y: desired.y, home: { ...desired }, target: { ...desired }, path: [], facing: 'down', behavior: companion.mode, sprite: { ...species.sprite }, solid: false, thinkAt: 0, decisions: 0 });
      }
    }
  }
  return { version: 1, seed: String(seed), areaId, sceneId: scene.id, time: 0, entities: entities.slice(0, 9).map(entity => ({ ...entity, traits: creatureTraits(seed, entity.id, entity.species), rare: entity.species !== 'caretaker' && hash(`${seed}:${entity.id}:rare`) % 20 === 0 })) };
}

function chooseTarget(entity, simulation, scene, player, state) {
  const species = CREATURE_ACTORS[entity.species], companion = state.companion?.id === entity.id ? state.companion : null;
  const traits = entity.traits || creatureTraits(simulation.seed, entity.id, entity.species);
  if (companion?.mode === 'wait') return { ...entity, behavior: 'wait', path: [], target: { x: entity.x, y: entity.y } };
  let target = null, behavior = 'wander';
  if (species.tameable === false && entity.waypoints?.length > 1) {
    behavior = 'patrol'; target = entity.waypoints[(entity.decisions + 1) % entity.waypoints.length];
  } else if (companion?.mode === 'follow') {
    behavior = 'follow';
    if (distance(entity, player) > 34) target = nearbyPoint(scene, player, `${entity.id}:${entity.decisions}`, simulation.entities.filter(other => other.id !== entity.id), 26);
  } else if (species.personality === 'shy' && distance(entity, player) < traits.approachDistance) {
    behavior = 'shy'; const length = distance(entity, player) || 1;
    const flee = { x: entity.x + (entity.x - player.x) / length * 34, y: entity.y + (entity.y - player.y) / length * 34 };
    if (canStand(flee, scene) && distance(flee, entity.home) < traits.wanderRadius * 2) target = flee;
  } else if (species.personality === 'curious' && distance(entity, player) < traits.approachDistance && distance(entity, player) > 32) {
    behavior = 'curious'; target = nearbyPoint(scene, player, `${entity.id}:${entity.decisions}`, [], 35);
  } else if (species.personality === 'foraging') {
    const patches = (scene.decorations || []).filter(decoration => ['flower', 'flowers', 'grass'].includes(decoration.kind) && distance(decoration, entity.home) <= traits.wanderRadius * 2 && canStand(decoration, scene) && !protectedPoint(decoration, scene, 21));
    if (patches.length) { target = patches[entity.decisions % patches.length]; behavior = 'forage'; }
  } else if (species.personality === 'guiding') {
    const readingSpots = (scene.objects || []).filter(object => ['lamp', 'bookshelf', 'lectern'].includes(object.type) || object.actions?.some(action => ['read', 'discover'].includes(action.kind))).filter(object => finitePoint(object.interactAt) && distance(object.interactAt, entity.home) <= traits.wanderRadius * 2);
    for (const spot of readingSpots) {
      const point = [{ x: spot.interactAt.x - 24, y: spot.interactAt.y }, { x: spot.interactAt.x + 24, y: spot.interactAt.y }, { x: spot.interactAt.x, y: spot.interactAt.y + 24 }].find(point => canStand(point, scene) && !protectedPoint(point, scene, 20) && hasLineOfSight(point, spot.interactAt, scene));
      if (point) { target = point; behavior = 'point'; entity = { ...entity, lookAt: { ...spot.interactAt } }; break; }
    }
  }
  if (!target && !companion) for (let index = 0; index < 10; index++) {
    const phase = entity.decisions * 10 + index;
    const angle = unit(`${simulation.seed}:${entity.id}`, phase, 'angle') * Math.PI * 2;
    const radius = traits.wanderRadius * (.3 + unit(`${simulation.seed}:${entity.id}`, phase, 'radius') * .7);
    const point = { x: Math.round(entity.home.x + Math.cos(angle) * radius), y: Math.round(entity.home.y + Math.sin(angle) * radius) };
    if (canStand(point, scene) && !protectedPoint(point, scene, 21)) { target = point; break; }
  }
  let path = target ? findWalkPath(entity, target, scene, companion ? 700 : 180) : [];
  if (!path) path = [];
  return { ...entity, traits, target: target || { x: entity.x, y: entity.y }, path, behavior: path.length ? behavior : 'idle', thinkAt: simulation.time + (companion ? .7 : (1.2 + unit(entity.id, entity.decisions, 'rest') * 1.3) * traits.restTempo), decisions: entity.decisions + 1 };
}

export function stepCreatures(simulation, scene, player, dt, state, options = {}) {
  if (!simulation || simulation.version !== 1 || options.paused || !Number.isFinite(dt) || dt <= 0 || dt > .25) return simulation;
  if (simulation.sceneId !== scene.id) return spawnCreatures(scene, simulation.seed, state, player, options);
  state = state?.version === 1 ? state : createCreatureState(simulation.seed);
  const next = { ...simulation, time: simulation.time + dt, entities: [] };
  for (const source of simulation.entities.slice(0, 9)) {
    const species = CREATURE_ACTORS[source.species]; if (!species) continue;
    let entity = { ...source, traits: source.traits || creatureTraits(simulation.seed, source.id, source.species), path: source.path || [] };
    const companionMode = state.companion?.id === entity.id ? state.companion.mode : null;
    if (companionMode === 'wait') { entity.path = []; entity.behavior = 'wait'; }
    else if (simulation.time >= entity.thinkAt || companionMode === 'follow' && entity.behavior !== 'follow') entity = chooseTarget(entity, simulation, scene, player, state);
    let path = entity.path;
    while (path.length && distance(entity, path[0]) < 2) path = path.slice(1);
    if (!path.length && entity.path.length && ['forage', 'point'].includes(entity.behavior)) entity.thinkAt = next.time + 1.7 * entity.traits.restTempo;
    const goal = path[0];
    if (goal) {
      const remaining = distance(entity, goal), step = Math.min(remaining, entity.traits.speed * dt), dx = (goal.x - entity.x) / remaining * step, dy = (goal.y - entity.y) / remaining * step;
      const point = movePlayer(entity, { x: dx, y: dy }, scene);
      const clear = distance(point, player) > 15 && next.entities.every(other => distance(point, other) > 12) && simulation.entities.every(other => other.id === entity.id || distance(point, other) > 12);
      if (clear) { entity.x = point.x; entity.y = point.y; if (Math.abs(dx) >= Math.abs(dy)) entity.facing = dx < 0 ? 'left' : 'right'; else entity.facing = dy < 0 ? 'up' : 'down'; }
    }
    if (!goal && entity.behavior === 'point' && entity.lookAt) { const dx = entity.lookAt.x - entity.x, dy = entity.lookAt.y - entity.y; entity.facing = Math.abs(dx) >= Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down'; }
    next.entities.push({ ...entity, path });
  }
  return next;
}

export function nearestCreature(simulation, player, scene, range = 44) {
  return [...(simulation?.entities || [])].filter(entity => entity.sceneId === scene.id && distance(entity, player) <= range && hasLineOfSight(player, entity, scene)).sort((a, b) => distance(a, player) - distance(b, player) || a.id.localeCompare(b.id))[0] || null;
}
export function creatureObject(entity) {
  const species = CREATURE_ACTORS[entity.species];
  return { id: entity.id, type: 'creature', label: entity.name, creatureId: entity.id, species: entity.species, creature: entity, creatureEntity: entity, x: entity.x - 8, y: entity.y - 16, width: 16, height: 16, solid: false, range: 44, interactAt: { x: entity.x, y: entity.y }, recordIds: [], sprite: species.sprite, hint: species.hint, actions: [{ id: 'befriend', label: 'Meet this creature', kind: 'creature' }] };
}

export function creatureAction(state, entity, action, options = {}) {
  const species = CREATURE_ACTORS[entity?.species], scene = options.scene, player = options.player;
  if (!state || state.version !== 1 || !species || !safeKey(entity.id) || !scene || !finitePoint(player) || entity.sceneId !== scene.id || entity.areaId !== creatureAreaId(scene) || options.areaId && ![scene.id, entity.areaId].includes(options.areaId) || !canStand(entity, scene) || !canStand(player, scene) || distance(entity, player) > 44 || !hasLineOfSight(player, entity, scene)) return { state, message: 'Move beside this creature in its current area first.', error: 'out-of-range' };
  const next = clone(state), relation = next.relationships[entity.id] || { species: species.id, homeArea: entity.areaId, observed: false, fed: false, bond: 0, tamed: false };
  if (species.tameable === false) {
    if (action !== 'observe') return { state, message: 'The caretaker shares advice and follows a village patrol.', error: 'not-tameable' };
    relation.observed = true; relation.bond = 0; relation.tamed = false; next.relationships[entity.id] = relation;
    return { state: next, message: species.hint };
  }
  let message;
  if (action === 'observe') {
    if (relation.observed) return { state, message: relation.tamed ? 'You already know this friend. Choose Follow or let it enjoy its routine.' : 'You already know its habits. A suitable snack can earn the rest of its trust.' };
    relation.observed = true; message = species.hint;
  } else if (action === 'feed') {
    if (relation.fed) return { state, message: 'It has already enjoyed its snack. No food was spent.' };
    if (species.personality === 'shy' && !relation.observed) return { state, message: 'Observe quietly first; this shy creature needs to feel safe. No food was spent.' };
    if ((options.food ?? species.food) !== species.food) return { state, message: `It prefers ${species.food}. No food was spent.`, error: 'wrong-food' };
    if (!next.food[species.food]) return { state, message: 'Your snack pouch is empty. Refill it at the village pantry.', error: 'no-food' };
    next.food[species.food]--; relation.fed = true; message = `It accepts the ${species.food}.`;
  } else if (action === 'follow') {
    if (!relation.tamed) return { state, message: 'Observe and offer its favorite food first.', error: 'not-befriended' };
    next.companion = { id: entity.id, species: species.id, mode: 'follow', areaId: entity.areaId }; message = 'Your friend will follow through safe paths and join you after entering a new area.';
  } else if (action === 'wait') {
    if (next.companion?.id !== entity.id) return { state, message: 'Ask this friend to follow first.', error: 'not-companion' };
    next.companion = { ...next.companion, mode: 'wait', areaId: entity.areaId, point: { x: entity.x, y: entity.y } }; message = 'Your friend waits here. It never blocks a door or your movement.';
  } else if (action === 'release') {
    if (next.companion?.id === entity.id) next.companion = null;
    message = 'It returns to its own routine. Your friendship remains.';
  } else return { state, message: 'Choose Observe, Feed, Follow, Wait or Release.', error: 'invalid-action' };
  relation.bond = Number(relation.observed) + Number(relation.fed); relation.tamed = relation.bond >= 2; next.relationships[entity.id] = relation;
  if (relation.tamed && !state.relationships[entity.id]?.tamed) message += ' Befriended! You can now choose Follow.';
  return { state: next, message };
}

export function restockCreatureFood(state) { const next = clone(state); next.food = { grain: 8, berry: 8, spark: 8 }; return { state: next, message: 'Snack pouch refilled: eight grain, berries and sparks. The pantry is always free.' }; }
