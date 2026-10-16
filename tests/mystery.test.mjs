import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceResume } from './helpers/resume.mjs';
import { generateWorld, decodePrufer } from '../src/core/world.mjs';
import { generateInterior, defaultInteriorConfig } from '../src/core/interior.mjs';
import { villageScene } from '../src/core/village.mjs';
import { canStand, nearestObject } from '../src/game/physics.mjs';
import { caesar, vigenere, encodeHamming74, hammingSyndrome, hammingPayload, pruferSteps, checkPuzzleAnswer, mysteryPlan, createMystery, validateMysteryPlan, solveMystery, finishMysteryBoss, readMysteryPage, currentObjective, decorateMysteryScene } from '../src/core/mystery.mjs';

const resume = sourceResume();
const world = generateWorld(resume);
const MAIN = ['margin-shift', 'broken-signal', 'room-tree', 'bridge-repair', 'signal-relay'];
function completed(seed = 'test-expedition') {
  const plan = mysteryPlan(seed, resume, world); let state = createMystery(seed, resume, world);
  for (const puzzle of plan.puzzles.filter((item) => !item.optional)) { const result = solveMystery(state, plan, puzzle.id, puzzle.answer); assert.equal(result.correct, true); state = result.state; }
  return { plan, state };
}

test('classical cipher implementations wrap correctly and Vigenère skips punctuation', () => {
  for (let shift = 0; shift < 26; shift++) assert.equal(caesar(caesar('A Z, Curiosity!', shift), -shift), 'A Z, CURIOSITY!');
  assert.equal(vigenere('ATTACKATDAWN', 'LEMON'), 'LXFOPVEFRNHR');
  assert.equal(vigenere('ATTACK AT DAWN!', 'LEMON'), 'LXFOPV EF RNHR!');
  assert.equal(vigenere('LXFOPV EF RNHR!', 'LEMON', true), 'ATTACK AT DAWN!');
  assert.throws(() => vigenere('NOTE', '123'), /alphabetic/);
});

test('Hamming(7,4) even parity corrects all controlled single errors for all sixteen payloads', () => {
  for (let number = 0; number < 16; number++) {
    const payload = number.toString(2).padStart(4, '0'), encoded = encodeHamming74(payload);
    assert.equal(hammingSyndrome(encoded), 0); assert.equal(hammingPayload(encoded).join(''), payload);
    for (let position = 1; position <= 7; position++) { const received = [...encoded]; received[position - 1] ^= 1; assert.equal(hammingSyndrome(received), position); const corrected = [...received]; corrected[position - 1] ^= 1; assert.deepEqual(corrected, encoded); }
  }
  assert.throws(() => encodeHamming74('1021'), /binary/); assert.throws(() => hammingSyndrome([1, 0]), /7 binary/);
});

test('Hamming puzzle never accepts a zero-syndrome miscorrection after a double error', () => {
  const encoded = encodeHamming74('1011'), damaged = [...encoded]; damaged[0] ^= 1; damaged[1] ^= 1;
  const misleading = [...damaged]; misleading[hammingSyndrome(damaged) - 1] ^= 1;
  assert.equal(hammingSyndrome(misleading), 0); assert.notDeepEqual(misleading, encoded);
  const puzzle = { type: 'hamming', data: { received: damaged }, answer: { bits: encoded } };
  assert.equal(checkPuzzleAnswer(puzzle, { bits: misleading }), false);
  assert.equal(checkPuzzleAnswer(puzzle, { bits: encoded }), true);
});

test('Prüfer story steps implement the real smallest-leaf algorithm and final connection', () => {
  for (let seed = 0; seed < 100; seed++) {
    const puzzle = mysteryPlan(`tree-${seed}`, resume, world).puzzles.find((item) => item.type === 'prufer');
    const steps = pruferSteps(puzzle.data.sequence, puzzle.data.nodeCount);
    assert.deepEqual(steps.map((step) => step.edge), decodePrufer(puzzle.data.sequence, puzzle.data.nodeCount));
    for (const step of steps) assert.equal(step.leaf, step.degrees.findIndex((degree) => degree === 1) + 1);
    assert.equal(steps.at(-1).final, true); assert.deepEqual(steps.at(-1).remaining, []);
  }
});

test('graph repair requires all-station connectivity and an actual shortest adjacent route', () => {
  const puzzle = mysteryPlan('network', resume, world).puzzles.find((item) => item.type === 'graph');
  assert.equal(checkPuzzleAnswer(puzzle, puzzle.answer), true);
  for (const candidate of puzzle.data.candidates.slice(1)) assert.equal(checkPuzzleAnswer(puzzle, { ...puzzle.answer, repairId: candidate.id }), false);
  assert.equal(checkPuzzleAnswer(puzzle, { ...puzzle.answer, route: [puzzle.data.start, puzzle.data.goal] }), false);
  assert.equal(checkPuzzleAnswer(puzzle, { ...puzzle.answer, route: [...puzzle.answer.route, puzzle.data.start] }), false);
});

test('logic relay accepts every valid assignment, including multiple legitimate solutions', () => {
  for (let seed = 0; seed < 12; seed++) {
    const puzzle = mysteryPlan(`logic-${seed}`, resume, world).puzzles.find((item) => item.type === 'logic'); let valid = 0;
    for (let value = 0; value < 16; value++) { const bits = value.toString(2).padStart(4, '0').split('').map(Number), [a, b, c, d] = bits; const expected = (a ^ b) === puzzle.data.targets.xor && (c & d) === puzzle.data.targets.and; assert.equal(checkPuzzleAnswer(puzzle, { inputs: bits }), expected); if (expected) valid++; }
    assert.ok(valid >= 2); assert.equal(checkPuzzleAnswer(puzzle, { inputs: puzzle.data.inputs }), false);
  }
});

test('seeded plans have a complete authored path and optional puzzles never gate the ending', () => {
  for (let seed = 0; seed < 60; seed++) {
    const name = `solvable-${seed}`, plan = mysteryPlan(name, resume, world);
    assert.deepEqual(plan, mysteryPlan(name, structuredClone(resume), structuredClone(world)));
    assert.equal(validateMysteryPlan(plan, world), true);
    let state = createMystery(name, resume, world);
    assert.equal(currentObjective(state, plan).puzzleId, MAIN[0]);
    for (const puzzle of plan.puzzles.filter((item) => !item.optional)) { assert.equal(currentObjective(state, plan).puzzleId, puzzle.id); const result = solveMystery(state, plan, puzzle.id, puzzle.answer); assert.equal(result.correct, true); state = result.state; }
    assert.equal(state.solved.includes('afterword-key'), false);
    assert.equal(currentObjective(state, plan).buildingId, plan.boss.buildingId);
    const ending = finishMysteryBoss(state); assert.equal(ending.ending, true); assert.equal(ending.bossDefeated, true); assert.ok(ending.pages.includes('ending'));
  }
  assert.notDeepEqual(mysteryPlan('one', resume, world).puzzles.map((puzzle) => puzzle.data), mysteryPlan('two', resume, world).puzzles.map((puzzle) => puzzle.data));
});

test('wrong answers, missing prerequisites and repeated answers are fair and do not duplicate rewards', () => {
  const plan = mysteryPlan('fair', resume, world), initial = createMystery('fair', resume, world);
  assert.throws(() => finishMysteryBoss(initial), /five main clues/);
  const locked = solveMystery(initial, plan, MAIN[1], plan.puzzles[1].answer); assert.equal(locked.correct, false); assert.equal(locked.state, initial);
  const wrong = solveMystery(initial, plan, MAIN[0], { plaintext: 'NOT THE ANSWER' }); assert.equal(wrong.correct, false); assert.deepEqual(wrong.state.solved, []); assert.equal(wrong.state.attempts[MAIN[0]], 1);
  const correct = solveMystery(wrong.state, plan, MAIN[0], plan.puzzles[0].answer); assert.equal(correct.correct, true); assert.equal(correct.state.solved.length, 1);
  const repeated = solveMystery(correct.state, plan, MAIN[0], plan.puzzles[0].answer); assert.deepEqual(repeated.state.clues, correct.state.clues); assert.deepEqual(repeated.state.pages, correct.state.pages);
  assert.deepEqual(initial.solved, []); assert.deepEqual(initial.attempts, {});
  assert.equal(solveMystery({ ...initial, seed: 'another' }, plan, MAIN[0], plan.puzzles[0].answer).correct, false);
});

test('collected lore is revisitable, optional margins have stable unique rewards and ending stays gated', () => {
  const { plan, state } = completed('margins');
  const initial = createMystery('margins', resume, world);
  assert.equal(readMysteryPage(initial, plan, 'page-bridge').correct, false);
  assert.equal(readMysteryPage(state, plan, 'ending').correct, false);
  const margin = readMysteryPage(initial, plan, 'paper-crane'); assert.equal(margin.correct, true); assert.deepEqual(margin.state.collectibles, ['paper-crane']);
  const again = readMysteryPage(margin.state, plan, 'paper-crane'); assert.deepEqual(again.state.collectibles, ['paper-crane']);
  assert.equal(readMysteryPage(finishMysteryBoss(state), plan, 'ending').correct, true);
});

test('plan validation rejects cycles, unknown locations, impossible answers and disconnected worlds', () => {
  const plan = mysteryPlan('validation', resume, world);
  const cycle = structuredClone(plan); cycle.puzzles[0].prerequisites = [MAIN[4]]; assert.throws(() => validateMysteryPlan(cycle, world), /cycle/);
  const location = structuredClone(plan); location.puzzles[0].buildingId = 'no-house'; assert.throws(() => validateMysteryPlan(location, world), /building/);
  const impossible = structuredClone(plan); impossible.puzzles[0].answer.shift = -1; assert.throws(() => validateMysteryPlan(impossible, world), /known answer/);
  assert.throws(() => validateMysteryPlan(plan, { ...world, edges: [] }), /unreachable/);
  const earlyBoss = structuredClone(plan); earlyBoss.boss.prerequisites = []; assert.throws(() => validateMysteryPlan(earlyBoss, world), /boss/);
});

test('story placement preserves geometry and every physical interaction across defaults and config extremes', () => {
  const { plan, state: solved } = completed('placement');
  const initial = createMystery('placement', resume, world), ending = finishMysteryBoss(solved);
  const snapshots = [initial, solved, ending];
  for (const location of world.locations) for (const variation of ['default', 'two-rooms', 'ten-rooms']) {
    const config = defaultInteriorConfig(resume, location);
    if (variation === 'two-rooms') Object.assign(config, { nodeCount: 2, sequence: [], layoutSeed: 'compact' });
    if (variation === 'ten-rooms') Object.assign(config, { nodeCount: 10, sequence: Array(8).fill(1), layoutSeed: 'star-hall' });
    const base = generateInterior(resume, location, config), original = structuredClone(base);
    for (const state of snapshots) {
      const scene = decorateMysteryScene(base, plan, state);
      for (const property of ['paths', 'rooms', 'floor', 'tiles', 'config', 'bounds', 'spawn']) assert.equal(scene[property], base[property], `Story changed ${property} reference.`);
      assert.deepEqual(decorateMysteryScene(scene, plan, state), scene, 'Repeated decoration must not duplicate actions or objects.');
      assert.equal(canStand(scene.spawn, scene), true);
      const visible = scene.objects.flatMap((object) => object.actions).filter((action) => action.kind === 'encounter');
      assert.equal(visible.length, 1, 'Each scene has one optional, visible encounter.');
      assert.equal(visible[0].once, true); assert.ok(visible[0].encounterKey.startsWith('visible:'));
      for (const object of scene.objects) { assert.equal(canStand(object.interactAt, scene), true, `Blocked ${object.id}`); assert.equal(nearestObject(object.interactAt, scene)?.id, object.id, `Ambiguous ${object.id}`); if (object.id.startsWith('mystery:') && object.type !== 'floor-note') assert.equal(object.solid, true); }
      for (const puzzle of plan.puzzles.filter((item) => item.buildingId === location.id)) assert.ok(scene.objects.some((object) => object.actions.some((action) => action.kind === 'puzzle' && action.puzzleId === puzzle.id)));
    }
    assert.deepEqual(base, original, 'Story decoration must not mutate the original scene.');
  }
  const village = villageScene(world), decorated = decorateMysteryScene(village, plan, initial);
  assert.ok(decorated.objects.some((object) => object.actions.some((action) => action.kind === 'lore' && action.pageId === 'opening')));
});

test('crowded scenes attach story actions to solid stations without replacing résumé actions', () => {
  const { plan, state } = completed('attachment');
  const location = world.locations.find((item) => item.id === plan.puzzles[0].buildingId);
  const base = generateInterior(resume, location), crowded = { ...base, rooms: [] };
  const decorated = decorateMysteryScene(crowded, plan, state);
  assert.equal(decorated.objects.length, crowded.objects.length);
  for (const object of crowded.objects) { const after = decorated.objects.find((item) => item.id === object.id); for (const action of object.actions) assert.ok(after.actions.some((item) => JSON.stringify(item) === JSON.stringify(action))); assert.equal(after.solid, object.solid); }
  assert.ok(decorated.objects.some((object) => object.actions.some((action) => action.kind === 'puzzle')));
  assert.deepEqual(decorateMysteryScene(decorated, plan, state), decorated);
});

test('one-building worlds still support every main device and a complete ending', () => {
  const smallResume = { sections: [{ id: 'only', type: 'projects', label: 'Only house', entries: [{ id: 'one', title: 'Real project', details: ['Actual detail.'] }] }] };
  const smallWorld = generateWorld(smallResume);
  for (const seed of ['small-one', 'small-two', 'small-three']) {
    const plan = mysteryPlan(seed, smallResume, smallWorld); let state = createMystery(seed, smallResume, smallWorld);
    const location = smallWorld.locations[0], config = { ...defaultInteriorConfig(smallResume, location), nodeCount: 2, sequence: [] };
    const scene = decorateMysteryScene(generateInterior(smallResume, location, config), plan, state);
    assert.equal(scene.objects.flatMap((object) => object.actions).filter((action) => action.kind === 'puzzle').length, 6);
    for (const puzzle of plan.puzzles.filter((item) => !item.optional)) state = solveMystery(state, plan, puzzle.id, puzzle.answer).state;
    assert.equal(finishMysteryBoss(state).ending, true);
  }
});

test('existing NPCs keep source actions and geometry while seed and clue stage change their fictional dialogue', () => {
  const { plan, state: solved } = completed('dialogue'), initial = createMystery('dialogue', resume, world), village = villageScene(world);
  const scenes = [initial, solved, finishMysteryBoss(solved)].map((state) => decorateMysteryScene(village, plan, state));
  for (const id of ['village:guide', 'village:mentor']) {
    const original = village.objects.find((object) => object.id === id), messages = [];
    for (const scene of scenes) {
      const npc = scene.objects.find((object) => object.id === id);
      for (const property of ['x', 'y', 'width', 'height', 'solid', 'sprite', 'interactAt', 'recordIds']) assert.equal(npc[property], original[property]);
      for (const action of original.actions) assert.ok(npc.actions.includes(action), 'The original quest and résumé guidance actions remain.');
      const dialogue = npc.actions.filter((action) => action.id.startsWith('mystery:dialogue:'));
      assert.equal(dialogue.length, 1); assert.equal(dialogue[0].kind, 'inspect'); messages.push(dialogue[0].message);
    }
    assert.equal(new Set(messages).size, 3, 'Opening, restored clues and ending have different contextual dialogue.');
  }
  const variants = new Set();
  for (let i = 0; i < 10; i++) { const seed = `character-${i}`, variant = decorateMysteryScene(village, mysteryPlan(seed, resume, world), createMystery(seed, resume, world)); variants.add(variant.objects.find((object) => object.id === 'village:guide').actions.find((action) => action.id.startsWith('mystery:dialogue:')).message); }
  assert.ok(variants.size >= 2);
});

test('visible challenges remain solid and no floating doors appear through story stages', () => {
  const seed = 'stable-stations', plan = mysteryPlan(seed, resume, world), states = [createMystery(seed, resume, world)];
  for (const puzzle of plan.puzzles.filter((item) => !item.optional)) states.push(solveMystery(states.at(-1), plan, puzzle.id, puzzle.answer).state);
  states.push(finishMysteryBoss(states.at(-1)));
  const encounterKeys = new Set();
  for (const location of world.locations) {
    const base = generateInterior(resume, location), stages = states.map((state) => decorateMysteryScene(base, plan, state));
    const positions = (scene) => scene.objects.map(({ id, x, y, width, height, solid }) => ({ id, x, y, width, height, solid }));
    const first = positions(stages[0]);
    for (const scene of stages) {
      assert.deepEqual(positions(scene), first, 'Story progress changes actions and hints without materializing solid props on the player.');
      const challenge = scene.objects.find((object) => object.actions.some((action) => action.kind === 'encounter'));
      assert.equal(challenge.solid, true); assert.equal(canStand(challenge.interactAt, scene), true);
      assert.equal(nearestObject(challenge.interactAt, scene)?.id, challenge.id);
      const action = challenge.actions.find((item) => item.kind === 'encounter');
      assert.ok(['guard', 'skirmisher', 'ranger', 'signal', 'mimic'].includes(action.opponent));
      encounterKeys.add(action.encounterKey);
    }
    assert.ok(stages.every(scene => !scene.objects.some(object => object.id === 'mystery:shortcut')), 'Secret access is a real boundary destination rather than floating room doors.');
  }
  assert.equal(encounterKeys.size, world.locations.length, 'Each building has its own once-only encounter reward key.');
});
