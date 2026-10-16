import { generateWorld, parseSequence } from './world.mjs';
import { generateInterior, defaultInteriorConfig } from './interior.mjs';
import { villageScene } from './village.mjs';
import { loadProgress } from './progress.mjs';
import { canStand } from '../game/physics.mjs';
import { expeditionVillageConfig, expeditionInteriorConfig } from './expeditions.mjs';
import { mysteryPlan, createMystery, validateMysteryPlan, decorateMysteryScene, finishMysteryBoss } from './mystery.mjs';
import { createEncounterTracker, normalizeEncounterTracker } from './encounters.mjs';
import { gardenVillage, generateGarden, gardenUnlocked, decorateAdventureScene, GARDEN_ID } from './destinations.mjs';

export const STORY_KEY = 'v3:mystery';
export const ENCOUNTER_KEY = 'v3:encounters';

export function worldFromConfiguration(resume, config, fallback) {
  if (!config || config.algorithmVersion !== 2 || config.scope !== 'village' || config.nodeCount !== fallback.locations.length || !Array.isArray(config.sequence)) throw Error('Village configuration does not match this résumé or generator version.');
  parseSequence(config.sequence.join(', '), config.nodeCount);
  for (const value of [config.layoutSeed, config.decorationSeed]) if (typeof value !== 'string' || !value.trim() || value.length > 128) throw Error('Seeds must contain 1–128 characters.');
  return generateWorld(resume, config.sequence, { ...(config.layoutSeed === 'resume-default' ? {} : { layoutSeed: config.layoutSeed }), ...(config.decorationSeed === 'resume-default' ? {} : { decorationSeed: config.decorationSeed }) });
}

export function readMystery(json, seed, resume, world) {
  const fresh = createMystery(seed, resume, world);
  if (!json) return fresh;
  try {
    const value = JSON.parse(json), plan = mysteryPlan(seed, resume, world);
    if (value.version !== 3 || value.seed !== seed || !Array.isArray(value.solved) || !Array.isArray(value.pages) || !Array.isArray(value.clues) || !Array.isArray(value.collectibles)) return fresh;
    const ids = new Set(plan.puzzles.map(p => p.id));
    if (value.solved.some(id => !ids.has(id)) || value.solved.length > 20 || value.pages.length > 80 || value.clues.length > 40 || value.collectibles.length > 40) return fresh;
    for (const id of value.solved) if (plan.puzzles.find(p => p.id === id).prerequisites.some(required => !value.solved.includes(required))) return fresh;
    if ((value.bossDefeated || value.ending) && plan.boss.prerequisites.some(id => !value.solved.includes(id)) || value.ending === true && value.bossDefeated !== true) return fresh;
    const pageIds = new Set(plan.pages.map(page => page.id));
    const clueIds = new Set([...plan.puzzles.map(puzzle => puzzle.reward.clueId), 'clue-indexer']);
    const strings = (values, allowed) => [...new Set(values.filter(id => typeof id === 'string' && allowed.has(id)))];
    const attempts = value.attempts && typeof value.attempts === 'object' && !Array.isArray(value.attempts)
      ? Object.fromEntries(Object.entries(value.attempts).filter(([id, count]) => ids.has(id) && Number.isSafeInteger(count) && count >= 0 && count <= 1000000)) : {};
    return { ...fresh, solved: [...new Set(value.solved)], pages: strings(value.pages, pageIds), clues: strings(value.clues, clueIds), collectibles: strings(value.collectibles, new Set(plan.pages.filter(page => page.optional && !page.id.startsWith('page-')).map(page => page.id))), attempts, bossDefeated: value.bossDefeated === true, ending: value.ending === true, seed, version: 3 };
  } catch { return fresh; }
}

export function restoreTracker(json, seed) {
  try { return normalizeEncounterTracker(JSON.parse(json || 'null'), seed); } catch { return createEncounterTracker(seed); }
}

/** One session path is shared by initial load, slot switching, and seed replay. */
export function buildSession(resume, defaultWorld, slot) {
  const loaded = loadProgress(slot.save, resume), state = loaded.state;
  const warnings = loaded.warning ? [loaded.warning] : [];
  let world = defaultWorld;
  if (!state.configs.village && !slot.legacy) state.configs.village = expeditionVillageConfig(resume, slot.seed);
  if (state.configs.village) {
    try { world = worldFromConfiguration(resume, state.configs.village, defaultWorld); }
    catch (e) { warnings.push(e.message); state.configs.village = slot.legacy ? null : expeditionVillageConfig(resume, slot.seed); world = state.configs.village ? worldFromConfiguration(resume, state.configs.village, defaultWorld) : defaultWorld; }
  }
  for (const [id, config] of Object.entries(state.configs.interiors)) {
    try { const location = world.locations.find(l => l.id === id); if (!location) throw Error('Missing building.'); generateInterior(resume, location, config); }
    catch { delete state.configs.interiors[id]; warnings.push('An incompatible interior configuration was reset; discoveries were retained.'); }
  }
  if (!slot.legacy) for (const location of world.locations) state.configs.interiors[location.id] ||= expeditionInteriorConfig(resume, location, slot.seed);
  const plan = mysteryPlan(slot.seed, resume, world); validateMysteryPlan(plan, world);
  const mystery = readMystery(state.flags[STORY_KEY], slot.seed, resume, world);
  let interior = null;
  if (state.position.scene === 'interior') {
    if (state.position.buildingId === GARDEN_ID) {
      if (gardenUnlocked(mystery)) interior = generateGarden(resume, slot.seed);
      else warnings.push('The Glitch Garden is sealed. Your position was returned to the village.');
    }
    const location = world.locations.find(l => l.id === state.position.buildingId);
    if (location) {
      const config = state.configs.interiors[location.id] || (slot.legacy ? defaultInteriorConfig(resume, location) : expeditionInteriorConfig(resume, location, slot.seed));
      state.configs.interiors[location.id] = config; interior = generateInterior(resume, location, config);
    }
  }
  const base = interior || gardenVillage(world);
  // Always place devices from the canonical spawn, then validate the saved feet.
  // Moving the spawn to the saved position would change seeded prop placement.
  const scene = decorateAdventureScene(base, plan, mystery);
  const point = canStand(state.position.point, scene) ? state.position.point : scene.spawn;
  if (point !== state.position.point && slot.save) warnings.push('Your position was moved to a safe entrance; every discovery was retained.');
  state.position = { scene: scene.kind, ...(interior ? { buildingId: interior.buildingId } : {}), point };
  // Preflight every story destination in both locked and fully opened states.
  // Invalid custom geometry fails before replacing the active expedition.
  const ready = finishMysteryBoss({ ...mystery, solved: plan.puzzles.map(puzzle => puzzle.id) });
  for (const id of new Set([...plan.puzzles.map(puzzle => puzzle.buildingId), plan.boss.buildingId])) {
    const location = world.locations.find(value => value.id === id);
    const config = state.configs.interiors[id] || (slot.legacy ? defaultInteriorConfig(resume, location) : expeditionInteriorConfig(resume, location, slot.seed));
    const target = interior?.buildingId === id ? interior : generateInterior(resume, location, config);
    decorateAdventureScene(target, plan, mystery); decorateAdventureScene(target, plan, ready);
  }
  decorateAdventureScene(generateGarden(resume, slot.seed), plan, ready);
  const tracker = restoreTracker(state.flags[ENCOUNTER_KEY], slot.seed);
  state.flags[STORY_KEY] = JSON.stringify(mystery); state.flags[ENCOUNTER_KEY] = JSON.stringify(tracker); state.flags['v3:seed'] = slot.seed;
  return { world, state, interior, point, mystery, plan, tracker, requiresRecovery: Boolean(loaded.warning), warning: [...new Set(warnings)].join(' ') };
}
