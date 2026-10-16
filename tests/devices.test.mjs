import test from 'node:test';
import assert from 'node:assert/strict';
import { DEVICE_TYPES, generateDevice, fallbackDevice, validateDevice, simulateDevice, solveDevice } from '../src/core/devices.mjs';

const profiles = ['calm', 'balanced', 'chaotic'];
const clone = value => structuredClone(value);

test('all seeded device families construct bounded, initially broken, fully solvable activities', () => {
  let fallbacks = 0;
  for (const type of DEVICE_TYPES) for (const profile of profiles) for (let seed = 0; seed < 40; seed++) {
    const device = generateDevice(`device-audit-${seed}`, type, { id: 'section:research', label: 'Research Workshop' }, profile);
    assert.equal(validateDevice(device), true);
    assert.equal(simulateDevice(device).correct, false);
    const answer = solveDevice(device, device.answer);
    assert.equal(answer.correct, true, `${type}/${profile}/${seed}: ${answer.message}`);
    assert.equal(answer.reward.quantity, 1);
    assert.equal(answer.reward.id, device.challengeId);
    assert.ok(device.hints.length >= 3);
    fallbacks += Number(device.fallback);
  }
  assert.equal(fallbacks, 0, 'normal constructive generation does not silently fall back');
});

test('site challenges persist across rerolls while seeded instances and profiles remain distinct', () => {
  for (const type of DEVICE_TYPES) {
    const first = generateDevice('spring', type, 'garden');
    assert.deepEqual(generateDevice('spring', type, 'garden'), first);
    const rerolled = generateDevice('autumn', type, 'garden');
    const profile = generateDevice('spring', type, 'garden', 'chaotic');
    const elsewhere = generateDevice('spring', type, 'library');
    assert.equal(first.challengeId, rerolled.challengeId);
    assert.equal(first.rewardKey, profile.rewardKey);
    assert.notEqual(first.instanceId, rerolled.instanceId);
    assert.notEqual(first.instanceId, profile.instanceId);
    assert.notEqual(first.challengeId, elsewhere.challengeId);
    assert.deepEqual(first.reward, rerolled.reward, 'rerolling cannot manufacture another reward identity');
  }
});

test('profiles and seeds change routing boards, job constraints and interconnected testbed structures', () => {
  const families = new Set(), moduleGraphs = new Set(), boards = new Set(), jobs = new Set();
  for (let seed = 0; seed < 70; seed++) {
    const route = generateDevice(`variation-${seed}`, 'routing', 'canal');
    const schedule = generateDevice(`variation-${seed}`, 'scheduling', 'home');
    const debug = generateDevice(`variation-${seed}`, 'debugging', 'garden');
    boards.add(JSON.stringify([route.data.source, route.data.target, route.data.blocked]));
    jobs.add(JSON.stringify(schedule.data.jobs.map(job => [job.id, job.duration, job.requires, job.deadline])));
    families.add(debug.data.family);
    moduleGraphs.add(JSON.stringify(debug.data.modules.map(module => [module.id, module.args])));
  }
  assert.ok(boards.size > 40);
  assert.ok(jobs.size > 60);
  assert.equal(families.size, 4);
  assert.ok(moduleGraphs.size >= 4, 'garden cases include serial, fork/join and boundary-comparison circuits');
  assert.equal(generateDevice('profile', 'routing', 'site', 'calm').data.width, 4);
  assert.equal(generateDevice('profile', 'routing', 'site', 'chaotic').data.height, 5);
  assert.equal(generateDevice('profile', 'scheduling', 'site', 'calm').data.jobs.length, 4);
  assert.equal(generateDevice('profile', 'scheduling', 'site', 'chaotic').data.jobs.length, 6);
});

test('packet forwarding detects loops, dead tiles, hop exhaustion and missing mandatory relays', () => {
  const device = fallbackDevice('routing-cases', 'routing', 'post');
  assert.match(simulateDevice(device).reason, /off the board/);
  const loop = simulateDevice(device, { directions: { '0,1': 'E', '1,1': 'W' } });
  assert.equal(loop.correct, false);
  assert.match(loop.reason, /Loop detected/);
  assert.deepEqual(loop.trace, ['0,1', '1,1', '0,1']);
  const stopped = clone(device); stopped.data.routers = stopped.data.routers.filter(router => router.id !== '1,1');
  assert.match(simulateDevice(stopped, { directions: { '0,1': 'E' } }).reason, /broken tile/);
  const limited = clone(device); limited.data.ttl = 1;
  assert.match(simulateDevice(limited, device.answer).reason, /Hop limit/);
  const relay = clone(device); relay.data.checkpoint = '0,0';
  assert.match(simulateDevice(relay, device.answer).reason, /bypassed/);
  assert.equal(simulateDevice(device, { directions: { nowhere: 'E' } }).correct, false);
  assert.equal(simulateDevice(device, { directions: { '0,1': 'UP' } }).correct, false);
});

test('packet routing accepts behavioral alternatives, rather than comparing to one stored answer', () => {
  const device = fallbackDevice('routing-alternatives', 'routing', 'post');
  const alternative = clone(device.answer);
  alternative.directions['0,0'] = alternative.directions['0,0'] === 'N' ? 'S' : 'N';
  assert.notDeepEqual(alternative, device.answer);
  assert.equal(solveDevice(device, alternative).correct, true, 'an unused router does not change the delivered route');
});

test('processor simulation enforces precedence and finish deadlines without overlapping jobs', () => {
  const device = fallbackDevice('processor-cases', 'scheduling', 'home');
  for (const job of device.data.jobs) { job.requires = []; job.deadline = 40; }
  device.data.jobs.find(job => job.id === 'C').requires = ['A'];
  const missing = simulateDevice(device, { order: ['C', 'A', 'B', 'D'] });
  assert.equal(missing.correct, false);
  assert.deepEqual(missing.steps[0].missing, ['A']);
  assert.equal(simulateDevice(device, { order: ['A', 'A', 'B', 'C'] }).correct, false);
  assert.equal(simulateDevice(device, { order: ['A', 'B', 'C'] }).correct, false);
  assert.equal(simulateDevice(device, { order: ['A', 'B', 'C', 'unknown'] }).correct, false);
  device.data.jobs.find(job => job.id === 'B').deadline = 1;
  assert.match(simulateDevice(device, { order: ['A', 'B', 'C', 'D'] }).reason, /deadline/);
  device.data.jobs.find(job => job.id === 'B').deadline = 40;
  const alternate = simulateDevice(device, { order: ['D', 'B', 'A', 'C'] });
  assert.equal(alternate.correct, true);
  assert.deepEqual(alternate.steps.map(step => [step.start, step.end]), [[0, 1], [1, 2], [2, 3], [3, 4]]);
});

test('debugging exposes intermediate machine signals and requires a single valid patch', () => {
  const device = fallbackDevice('debug-probes', 'debugging', 'garden');
  const initial = simulateDevice(device);
  assert.ok(initial.passed < initial.tests.length);
  assert.equal(initial.tests.length, 4);
  assert.ok(initial.tests.every(sample => sample.trace.length === device.data.modules.length));
  assert.ok(initial.tests.some(sample => !sample.pass));
  const repaired = solveDevice(device, device.answer);
  assert.equal(repaired.correct, true);
  assert.equal(repaired.passed, 4);
  assert.equal(repaired.reward.stateChange, 'garden-restored');
  assert.equal(simulateDevice(device, { patch: { moduleId: 'bloom', op: 'NOT' } }).correct, false);
  assert.equal(simulateDevice(device, { patch: { moduleId: 'unknown', op: 'AND' } }).correct, false);
  assert.equal(simulateDevice(device).correct, false, 'probing alone cannot silently complete the challenge');
});

test('boundary testbeds include both inclusive endpoints and catch an off-by-one thermostat', () => {
  let device;
  for (let seed = 0; seed < 40 && !device; seed++) {
    const candidate = generateDevice(`climate-${seed}`, 'debugging', 'garden');
    if (candidate.data.family === 'climate') device = candidate;
  }
  assert.ok(device, 'seeded families include a numeric boundary case');
  const correct = device.answer.patch;
  device.data.modules.find(module => module.id === correct.moduleId).op = correct.op;
  const thermostat = device.data.modules.find(module => module.id === 'warm');
  const low = thermostat.args[1], high = device.data.modules.find(module => module.id === 'cool').args[1];
  thermostat.op = 'GT'; device.answer = { patch: { moduleId: 'warm', op: 'GE' } };
  assert.equal(validateDevice(device), true);
  const failed = simulateDevice(device);
  assert.ok(failed.tests.find(sample => sample.inputs.temp === low && sample.inputs.lamp === 1 && !sample.pass));
  assert.ok(failed.tests.find(sample => sample.inputs.temp === high && sample.inputs.lamp === 1 && sample.pass));
  assert.equal(failed.tests.length, 10);
  assert.equal(solveDevice(device, device.answer).correct, true);
});

test('seed shelf operations perform a stable insertion sort and conserve every packet', () => {
  const device = fallbackDevice('seed-shelf', 'sorting', 'conservatory');
  const result = simulateDevice(device, device.answer), ordered = result.sorting.slots;
  assert.equal(result.correct, true);
  assert.equal(result.sorting.held, null);
  assert.equal(result.sorting.sortedCount, device.data.packets.length);
  assert.equal(new Set(ordered).size, device.data.packets.length);
  assert.deepEqual(ordered, ['D', 'B', 'E', 'A', 'C']);
  assert.ok(ordered.indexOf('A') < ordered.indexOf('C'), 'equal three-day packets preserve original order');
  assert.ok(ordered.indexOf('B') < ordered.indexOf('E'), 'equal two-day packets preserve original order');
  for (let length = 0; length <= device.answer.actions.length; length++) {
    const partial = simulateDevice(device, { actions: device.answer.actions.slice(0, length) });
    const visible = [...partial.sorting.slots.filter(Boolean), ...(partial.sorting.held ? [partial.sorting.held] : [])];
    assert.deepEqual([...visible].sort(), device.data.packets.map(packet => packet.id).sort());
    assert.equal(partial.correct, length === device.answer.actions.length);
  }
  assert.match(device.learning, /at most 10 comparisons/);
});

test('insertion comparisons control the next legal action and equal packets cannot be shifted past', () => {
  const device = fallbackDevice('sort-rules', 'sorting', 'conservatory');
  assert.equal(simulateDevice(device, { actions: [{ kind: 'shift' }] }).correct, false);
  assert.match(simulateDevice(device, { actions: [{ kind: 'insert' }] }).reason, /Compare/);
  assert.match(simulateDevice(device, { actions: [{ kind: 'compare' }, { kind: 'insert' }] }).reason, /slide it/);
  let equalPrefix;
  for (let length = 1; length < device.answer.actions.length; length++) {
    const prefix = device.answer.actions.slice(0, length), partial = simulateDevice(device, { actions: prefix });
    if (partial.sorting.comparison === 0) { equalPrefix = prefix; break; }
  }
  assert.ok(equalPrefix, 'duplicate packet values lead to a real equal comparison');
  const unstableAttempt = simulateDevice(device, { actions: [...equalPrefix, { kind: 'shift' }] });
  assert.equal(unstableAttempt.correct, false);
  assert.match(unstableAttempt.reason, /Equal packets keep their order/);
  assert.equal(simulateDevice(device, { order: ['D', 'B', 'E', 'A', 'C'] }).correct, false, 'a final order alone cannot bypass the interactive algorithm');
  assert.equal(simulateDevice(device, { actions: [{ kind: 'teleport' }] }).correct, false);
  assert.equal(simulateDevice(device, { actions: Array.from({ length: 129 }, () => ({ kind: 'compare' })) }).correct, false);
});

test('sorting accepts an extra valid comparison, with bounded histories and deterministic gentle helpers', () => {
  for (let seed = 0; seed < 30; seed++) {
    const device = generateDevice(`shelf-helper-${seed}`, 'sorting', 'garden', profiles[seed % profiles.length]);
    let actions = [], result = simulateDevice(device, { actions });
    for (let step = 0; !result.correct && step < 64; step++) {
      const state = result.sorting;
      const kind = state.cursor >= 0 && state.comparison === null ? 'compare' : state.cursor >= 0 && state.comparison > 0 ? 'shift' : 'insert';
      actions.push({ kind }); result = simulateDevice(device, { actions });
    }
    assert.equal(result.correct, true, `helper completes seed ${seed}`);
    assert.ok(actions.length <= device.data.maxActions);
    assert.deepEqual(actions, device.answer.actions);
    const alternative = { actions: [actions[0], { kind: 'compare' }, ...actions.slice(1)] };
    assert.equal(solveDevice(device, alternative).correct, true, 'rechecking an already compared pair is a valid behavioral alternative');
    assert.equal(simulateDevice(device, alternative).sorting.comparisons, result.sorting.comparisons + 1);
    assert.equal(solveDevice(device, device.answer).reward.stateChange, 'seed-shelf-ordered');
  }
});

test('validation rejects duplicate regression coverage, cyclic machines and inconsistent grid roles', () => {
  const debug = fallbackDevice('validation-debug', 'debugging', 'garden');
  debug.data.cases[1] = clone(debug.data.cases[0]);
  assert.throws(() => validateDevice(debug), /each allowed input combination/);
  const cyclic = fallbackDevice('validation-cycle', 'debugging', 'garden');
  cyclic.data.modules[0].args = ['bloom'];
  assert.throws(() => validateDevice(cyclic), /acyclic/);
  const route = fallbackDevice('validation-route', 'routing', 'post');
  route.data.routers[0].id = route.data.routers[1].id;
  assert.throws(() => validateDevice(route), /consistent role/);
  const huge = fallbackDevice('validation-bound', 'routing', 'post'); huge.data.ttl = 100000;
  assert.throws(() => validateDevice(huge), /bounded grid/);
  const schedule = fallbackDevice('validation-jobs', 'scheduling', 'home'); schedule.data.jobs[0].requires = ['missing'];
  assert.throws(() => validateDevice(schedule), /valid prerequisites/);
  const reward = fallbackDevice('validation-reward', 'routing', 'post'); reward.reward.quantity = 99;
  assert.throws(() => validateDevice(reward), /stable site identity/);
  const shelf = fallbackDevice('validation-shelf', 'sorting', 'garden'); shelf.data.packets[2].originalIndex = 0;
  assert.throws(() => validateDevice(shelf), /stable equal-value pairs/);
});

test('known-good fallbacks remain deterministic and solvable for every profile and type', () => {
  for (const type of DEVICE_TYPES) for (const profile of profiles) {
    const device = fallbackDevice('fallback-audit', type, 'site', profile);
    assert.equal(device.fallback, true);
    assert.equal(validateDevice(device), true);
    assert.equal(solveDevice(device, device.answer).correct, true);
    assert.deepEqual(device, fallbackDevice('fallback-audit', type, 'site', profile));
  }
});

test('invalid requests fail clearly and trials never mutate generated devices or supply failure rewards', () => {
  assert.throws(() => generateDevice('', 'routing', 'post'), /seed/);
  assert.throws(() => generateDevice('seed', 'quiz', 'post'), /device type/);
  assert.throws(() => generateDevice('seed', 'routing', ''), /site identifier/);
  assert.throws(() => generateDevice('seed', 'routing', 'post', 'impossible'), /profile/);
  for (const type of DEVICE_TYPES) {
    const device = generateDevice('no-mutation', type, 'site'), before = clone(device);
    const failed = solveDevice(device, {});
    assert.equal(failed.correct, false);
    assert.equal(failed.reward, undefined);
    solveDevice(device, device.answer);
    assert.deepEqual(device, before);
  }
});
