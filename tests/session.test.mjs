import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceResume } from './helpers/resume.mjs';
import { generateWorld } from '../src/core/world.mjs';
import { generateInterior, defaultInteriorConfig } from '../src/core/interior.mjs';
import { villageScene } from '../src/core/village.mjs';
import { createProgress, saveProgress } from '../src/core/progress.mjs';
import { createSaveBook, activeSlot, startExpedition, selectExpedition, storeActiveProgress, serializeSaveBook, restoreSaveBook, expeditionVillageConfig, expeditionInteriorConfig } from '../src/core/expeditions.mjs';
import { createMystery, solveMystery, finishMysteryBoss, decorateMysteryScene } from '../src/core/mystery.mjs';
import { buildSession, readMystery, restoreTracker, STORY_KEY, ENCOUNTER_KEY } from '../src/core/session.mjs';
import { createEncounterTracker, travelEncounter } from '../src/core/encounters.mjs';
import { canStand } from '../src/game/physics.mjs';

const resume = sourceResume();
const defaultWorld = generateWorld(resume);
const sceneFor = (session) => decorateMysteryScene(session.interior || villageScene(session.world), session.plan, session.mystery);
const commit = (book, state) => storeActiveProgress(book, saveProgress(state));

test('fresh slots use one deterministic session path with seed-derived village and interior settings', () => {
  const book = createSaveBook('', 'reed'), slot = activeSlot(book);
  const first = buildSession(resume, defaultWorld, slot), second = buildSession(resume, defaultWorld, slot);
  assert.deepEqual(first, second);
  assert.deepEqual(first.state.configs.village, expeditionVillageConfig(resume, slot.seed));
  assert.equal(first.mystery.seed, slot.seed); assert.equal(first.tracker.seed, slot.seed);
  assert.equal(canStand(first.point, sceneFor(first)), true);
  assert.equal(first.interior, null); assert.equal(slot.save, '');
  const other = buildSession(resume, defaultWorld, activeSlot(createSaveBook('', 'cedar')));
  assert.notDeepEqual(first.state.configs.village, other.state.configs.village);
  assert.notDeepEqual(first.world.locations.map(({ x, y }) => [x, y]), other.world.locations.map(({ x, y }) => [x, y]));
});

test('V2 migration retains professional discoveries, inventory, quests and custom interiors', () => {
  const previous = createProgress(resume), house = defaultWorld.locations.find((location) => location.type === 'projects');
  const config = { ...defaultInteriorConfig(resume, house), layoutSeed: 'my-v2-room', decorationSeed: 'my-v2-props' };
  const interior = generateInterior(resume, house, config), usableSide = interior.objects.find((object) => object.recordIds.length).interactAt;
  previous.unlocked = resume.sections.slice(0, 2).map((section) => section.entries[0].id);
  previous.visited = [house.id]; previous.items = { 'field-key': 2, 'curiosity-badge': 1 };
  previous.quests.fieldTrip = 'active'; previous.stats.battlesWon = 2;
  previous.configs.interiors[house.id] = config;
  previous.position = { scene: 'interior', buildingId: house.id, point: { ...usableSide } };
  const originalSave = saveProgress(previous), book = createSaveBook(originalSave, 'ignored');
  const restored = buildSession(resume, defaultWorld, activeSlot(book));
  assert.deepEqual(restored.world, defaultWorld, 'Legacy slots retain their original default village.');
  for (const field of ['unlocked', 'visited', 'items', 'quests', 'stats']) assert.deepEqual(restored.state[field], previous[field]);
  assert.deepEqual(restored.state.configs.interiors[house.id], config);
  assert.deepEqual(restored.point, usableSide); assert.equal(canStand(restored.point, sceneFor(restored)), true);
  assert.deepEqual(restored.interior.spawn, interior.spawn, 'Restoring position must not alter canonical room geometry or seeded story placement.');
  assert.equal(activeSlot(book).save, originalSave, 'Migration does not overwrite its source save.');
});

test('malformed mystery attempt counters recover to usable state without throwing on the next answer', () => {
  const seed = 'safe-attempts', fresh = createMystery(seed, resume, defaultWorld);
  const mutations = [undefined, null, [], 'broken', 2, { 'margin-shift': -1 }, { 'margin-shift': 1.5 }, { 'margin-shift': null }, { unknown: 1 }];
  for (const attempts of mutations) {
    const restored = readMystery(JSON.stringify({ ...fresh, attempts }), seed, resume, defaultWorld);
    assert.ok(restored.attempts && typeof restored.attempts === 'object' && !Array.isArray(restored.attempts));
    assert.ok(Object.entries(restored.attempts).every(([id, value]) => id === 'margin-shift' && Number.isSafeInteger(value) && value >= 0));
    const session = buildSession(resume, defaultWorld, activeSlot(createSaveBook('', seed)));
    const first = session.plan.puzzles[0];
    assert.doesNotThrow(() => solveMystery(restored, session.plan, first.id, first.answer));
  }
  const valid = { ...fresh, attempts: { 'margin-shift': 3, 'broken-signal': 0 } };
  assert.deepEqual(readMystery(JSON.stringify(valid), seed, resume, defaultWorld).attempts, valid.attempts);
});

test('mystery restore rejects corrupt dependencies, wrong seeds and premature endings', () => {
  const seed = 'story-recovery', fresh = createMystery(seed, resume, defaultWorld);
  for (const raw of ['{', JSON.stringify({ ...fresh, seed: 'another' }), JSON.stringify({ ...fresh, solved: ['bridge-repair'] }), JSON.stringify({ ...fresh, solved: ['not-a-device'] }), JSON.stringify({ ...fresh, ending: true }), JSON.stringify({ ...fresh, bossDefeated: true })]) assert.deepEqual(readMystery(raw, seed, resume, defaultWorld), fresh);
});

test('encounter pacing restores valid distance history and rejects malformed or foreign trackers', () => {
  const seed = 'walk-history'; let tracker = createEncounterTracker(seed);
  for (let i = 0; i < 20; i++) tracker = travelEncounter(tracker, { distance: 16, sceneKind: 'interior', region: 'library', paused: false }).tracker;
  assert.deepEqual(restoreTracker(JSON.stringify(tracker), seed), tracker);
  for (const raw of ['{', JSON.stringify({ ...tracker, version: 99 }), JSON.stringify({ ...tracker, seed: 'other' }), JSON.stringify({ ...tracker, travelled: -1 }), JSON.stringify({ ...tracker, checks: '3' }), JSON.stringify({ ...tracker, sinceEncounter: null }), JSON.stringify({ version: 3, seed })]) assert.deepEqual(restoreTracker(raw, seed), createEncounterTracker(seed));
});

test('save/reload validates the actual solid decorated scene while preserving canonical placements', () => {
  const seed = 'solid-restoration', book = createSaveBook('', seed), first = buildSession(resume, defaultWorld, activeSlot(book));
  const house = first.world.locations.find((location) => location.id === first.plan.puzzles[0].buildingId);
  const config = expeditionInteriorConfig(resume, house, seed), base = generateInterior(resume, house, config);
  const canonical = decorateMysteryScene(base, first.plan, first.mystery), machine = canonical.objects.find((object) => object.solid && object.id.startsWith('mystery:puzzle:'));
  assert.ok(machine, 'The seeded library should have a solid mystery device.');
  const formerlyEmpty = { x: machine.x + 8, y: machine.y + 8 };
  assert.equal(canStand(formerlyEmpty, base), true); assert.equal(canStand(formerlyEmpty, canonical), false);
  const saved = structuredClone(first.state);
  saved.configs.interiors[house.id] = config;
  saved.position = { scene: 'interior', buildingId: house.id, point: formerlyEmpty };
  const reloaded = buildSession(resume, defaultWorld, activeSlot(commit(book, saved))), scene = sceneFor(reloaded);
  assert.equal(canStand(reloaded.point, scene), true, 'A migration cannot spawn the player inside a new story device.');
  assert.deepEqual(reloaded.interior.spawn, base.spawn);
  const coordinates = (value) => value.objects.filter((object) => object.id.startsWith('mystery:')).map(({ id, x, y }) => ({ id, x, y }));
  assert.deepEqual(coordinates(scene), coordinates(canonical), 'Saving from another tile cannot move mystery devices.');
  assert.deepEqual(base.config, config); assert.deepEqual(saved.position.point, formerlyEmpty);
});

test('full main mystery, boss ending and encounter history survive save-book reload and seed switching', () => {
  const seed = 'complete-journey'; let book = createSaveBook('', seed), session = buildSession(resume, defaultWorld, activeSlot(book));
  const record = resume.sections[0].entries[0].id; session.state.unlocked = [record];
  for (const puzzle of session.plan.puzzles.filter((item) => !item.optional)) {
    const result = solveMystery(session.mystery, session.plan, puzzle.id, puzzle.answer); assert.equal(result.correct, true);
    session.state.flags[STORY_KEY] = JSON.stringify(result.state);
    book = commit(book, session.state); session = buildSession(resume, defaultWorld, activeSlot(book));
    assert.ok(session.mystery.solved.includes(puzzle.id)); assert.deepEqual(session.state.unlocked, [record]);
  }
  session.state.flags[STORY_KEY] = JSON.stringify(finishMysteryBoss(session.mystery));
  let tracker = createEncounterTracker(seed);
  for (let i = 0; i < 18; i++) tracker = travelEncounter(tracker, { distance: 16, sceneKind: 'village', paused: false }).tracker;
  session.state.flags[ENCOUNTER_KEY] = JSON.stringify(tracker); book = commit(book, session.state);
  const originalSlot = activeSlot(book).id, originalSave = activeSlot(book).save;
  const restoredBook = restoreSaveBook(serializeSaveBook(book), '', 'unused').book;
  const restored = buildSession(resume, defaultWorld, activeSlot(restoredBook));
  assert.equal(restored.mystery.ending, true); assert.equal(restored.mystery.bossDefeated, true);
  assert.ok(restored.mystery.pages.includes('ending')); assert.equal(restored.mystery.solved.length, 5);
  assert.deepEqual(restored.tracker, tracker); assert.deepEqual(restored.state.unlocked, [record]);
  const newBook = startExpedition(restoredBook, 'another-seed'), newSession = buildSession(resume, defaultWorld, activeSlot(newBook));
  assert.deepEqual(newSession.mystery.solved, []); assert.equal(newSession.mystery.ending, false);
  assert.equal(newBook.slots.find((slot) => slot.id === originalSlot).save, originalSave);
  const returned = buildSession(resume, defaultWorld, activeSlot(selectExpedition(newBook, originalSlot)));
  assert.equal(returned.mystery.ending, true); assert.deepEqual(returned.state.unlocked, [record]);
});
