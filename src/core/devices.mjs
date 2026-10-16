import { hashString, seededRandom } from './world.mjs';

export const DEVICE_TYPES = ['routing', 'scheduling', 'debugging', 'sorting'];
const PROFILES = ['calm', 'balanced', 'chaotic'];
const DIRECTIONS = ['N', 'E', 'S', 'W'];
const DELTA = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const cell = (x, y) => `${x},${y}`;
const shuffled = (items, random) => items.map((value) => ({ value, rank: random() })).sort((a, b) => a.rank - b.rank).map(({ value }) => value);

function identity(seed, type, site, profile) {
  const siteId = typeof site === 'string' ? site : site?.id || site?.siteId;
  if (typeof seed !== 'string' || !seed.trim() || seed.length > 160) throw new Error('A device seed needs 1–160 characters.');
  if (!DEVICE_TYPES.includes(type)) throw new Error(`Choose a device type: ${DEVICE_TYPES.join(', ')}.`);
  if (typeof siteId !== 'string' || !siteId || siteId.length > 240) throw new Error('A device needs a stable site identifier.');
  if (!PROFILES.includes(profile)) throw new Error('Choose the calm, balanced or chaotic profile.');
  return { version: 4, seed, type, siteId, siteLabel: typeof site === 'object' ? String(site.label || siteId) : siteId, profile, challengeId: `device:${type}:${hashString(siteId).toString(36)}` };
}

function routing(random, profile, fallback) {
  const width = fallback || profile === 'calm' ? 4 : 5, height = fallback || profile === 'calm' ? 3 : profile === 'chaotic' ? 5 : 4;
  const startY = fallback ? 1 : Math.floor(random() * height), endY = fallback ? 1 : Math.floor(random() * height);
  const source = cell(0, startY), target = cell(width - 1, endY);
  let x = 0, y = startY; const path = [source];
  while (x < width - 1 || y !== endY) {
    if (x < width - 1 && (y === endY || random() < .6)) x++; else y += Math.sign(endY - y);
    path.push(cell(x, y));
  }
  const reserved = new Set(path), blocked = [];
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) if (!reserved.has(cell(col, row)) && !fallback && random() < (profile === 'chaotic' ? .38 : .2)) blocked.push(cell(col, row));
  const routers = [];
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) if (!blocked.includes(cell(col, row)) && cell(col, row) !== target) routers.push({ id: cell(col, row), x: col, y: row, direction: cell(col, row) === source ? 'W' : DIRECTIONS[Math.floor(random() * 4)] });
  const directions = Object.fromEntries(routers.map((router) => [router.id, router.direction]));
  for (let i = 1; i < path.length; i++) { const [ax, ay] = path[i - 1].split(',').map(Number), [bx, by] = path[i].split(',').map(Number); directions[path[i - 1]] = bx > ax ? 'E' : bx < ax ? 'W' : by > ay ? 'S' : 'N'; }
  const checkpoint = !fallback && profile === 'chaotic' ? path[Math.floor(path.length / 2)] : null;
  return { title: 'Packet Post', goal: 'Rotate the routers and deliver one packet without a loop.', instructions: 'Each arrow forwards the packet one tile. Tap a router to rotate it clockwise, then Send packet. Avoid broken tiles; the hop limit prevents packets circulating forever.', hints: ['Follow the packet’s trace to the first wrong arrow.', `Begin at ${source}. The destination is ${target}${checkpoint ? `; pass relay ${checkpoint}` : ''}.`, `One working route is ${path.join(' → ')}.`], data: { width, height, source, target, blocked, routers, checkpoint, ttl: path.length + (profile === 'calm' ? 5 : 2) }, answer: { directions }, learning: 'Routing tables choose the next hop. A valid local arrow can still create a global loop; a hop limit bounds the damage.' };
}

function scheduling(random, profile, fallback) {
  const count = fallback || profile === 'calm' ? 4 : profile === 'chaotic' ? 6 : 5;
  const ids = Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i)), order = fallback ? ids : shuffled(ids, random);
  const labels = ['Scan seeds', 'Check moisture', 'Index beds', 'Pack samples', 'Log results', 'Close valves'];
  const durations = Object.fromEntries(ids.map((id) => [id, fallback ? 1 : 1 + Math.floor(random() * 3)]));
  let clock = 0;
  const jobs = order.map((id, index) => {
    clock += durations[id];
    const predecessors = index ? shuffled(order.slice(0, index), random).slice(0, profile === 'chaotic' && index > 2 ? 2 : random() < .75 ? 1 : 0).sort() : [];
    return { id, label: labels[id.charCodeAt(0) - 65], duration: durations[id], requires: predecessors, deadline: clock + (fallback ? 0 : profile === 'calm' ? 3 : profile === 'chaotic' ? 0 : 1) };
  });
  return { title: 'One Busy Processor', goal: 'Queue every job so dependencies and deadlines both hold.', instructions: 'One processor runs one complete job at a time. Add jobs to the timeline, or remove and reorder them. A required job must finish first; each deadline is the latest allowed finish time.', hints: ['Start with jobs that have no prerequisites. Watch the earliest deadline.', `A safe first job is ${order[0]}; it takes ${durations[order[0]]} time units.`, `One valid queue is ${order.join(' → ')}.`], data: { jobs: shuffled(jobs, random), timeUnit: 'ticks' }, answer: { order }, learning: 'A topological order respects dependencies, but deadlines add a second constraint. This non-preemptive processor cannot run two jobs at once or interrupt a running job.' };
}

function insertionAnswer(packets) {
  const order = [...packets], actions = [];
  for (let index = 1; index < order.length; index++) {
    const held = order[index]; let cursor = index - 1;
    while (cursor >= 0) {
      actions.push({ kind: 'compare' });
      if (order[cursor].days <= held.days) break;
      actions.push({ kind: 'shift' }); order[cursor + 1] = order[cursor]; cursor--;
    }
    actions.push({ kind: 'insert' }); order[cursor + 1] = held;
  }
  return { actions };
}

function sorting(random, profile, fallback) {
  const count = fallback || profile === 'calm' ? 5 : profile === 'chaotic' ? 7 : 6;
  const names = ['Moonseed', 'Silverfern', 'Cloudmint', 'Stargrass', 'Amberleaf', 'Dewbell', 'Sunmoss'];
  let days = fallback ? [3, 2, 3, 1, 2] : Array.from({ length: count }, () => 1 + Math.floor(random() * 5));
  days[2] = days[0];
  if (new Set(days).size === 1) days[count - 1] = days[0] % 5 + 1;
  if (days.every((value, index) => !index || days[index - 1] <= value)) days = [...days].reverse();
  const packets = days.map((value, index) => ({ id: String.fromCharCode(65 + index), label: names[index], days: value, originalIndex: index }));
  const stable = [...packets].sort((a, b) => a.days - b.days || a.originalIndex - b.originalIndex);
  return { title: 'The Patient Seed Shelf', goal: 'Insert each seed packet by sprouting time. Keep equal packets in their original order.', instructions: 'Hold the next packet. Compare it with the packet on its left. If the left packet takes more days, slide it right and compare again. Otherwise insert the held packet into the gap. Equal values stay in their original order: this is a stable insertion sort.', hints: ['Only the shelf left of the gap is sorted. Move strictly larger packets; never slide an equal packet past the held one.', `The first held packet is ${packets[1].id}: ${packets[1].days} days. Compare it with ${packets[0].id}: ${packets[0].days} days.`, `The final stable shelf is ${stable.map(packet => `${packet.id}(${packet.days})`).join(' → ')}. “Show one safe step” can guide every operation.`], data: { packets, metric: 'sprouting days', maxActions: 128 }, answer: insertionAnswer(packets), learning: `Stable insertion sort grows a sorted prefix one packet at a time, holding one packet while larger neighbors slide right. Equal values keep their original order. With ${count} packets, the ordinary algorithm needs at most ${count * (count - 1) / 2} comparisons; a pre-sorted shelf needs only ${count - 1}. Its worst-case work is quadratic, while its extra storage is one held packet.` };
}

function insertionSimulation(data, actions) {
  if (!Array.isArray(actions) || actions.length > data.maxActions) return { correct: false, reason: 'Use the bounded comparison and insertion controls.', history: [] };
  const byId = new Map(data.packets.map(packet => [packet.id, packet])), slots = data.packets.map(packet => packet.id);
  let pass = 1, held = slots[1], hole = 1, cursor = 0, comparison = null, comparisons = 0, shifts = 0;
  slots[hole] = null;
  const history = [];
  const view = () => ({ slots: [...slots], held, hole, cursor, pass, sortedCount: held === null ? slots.length : pass, comparison, comparisons, shifts, complete: held === null });
  for (const action of actions) {
    if (!action || !['compare', 'shift', 'insert'].includes(action.kind) || held === null) return { correct: false, reason: 'That operation is unavailable at this step.', sorting: view(), history };
    if (action.kind === 'compare') {
      if (cursor < 0) return { correct: false, reason: 'The packet reached the front; insert it into the gap.', sorting: view(), history };
      comparison = Math.sign(byId.get(slots[cursor]).days - byId.get(held).days); comparisons++;
      history.push({ kind: 'compare', left: slots[cursor], held, comparison });
    } else if (action.kind === 'shift') {
      if (cursor < 0 || comparison !== 1) return { correct: false, reason: 'Slide a left packet only after proving it is strictly larger. Equal packets keep their order.', sorting: view(), history };
      history.push({ kind: 'shift', packet: slots[cursor], from: cursor, to: hole });
      slots[hole] = slots[cursor]; slots[cursor] = null; hole = cursor; cursor--; comparison = null; shifts++;
    } else {
      if (cursor >= 0 && (comparison === null || comparison > 0)) return { correct: false, reason: 'Compare the left packet first; slide it if it is larger.', sorting: view(), history };
      history.push({ kind: 'insert', packet: held, at: hole }); slots[hole] = held; pass++;
      if (pass === slots.length) { held = null; hole = -1; cursor = -1; comparison = null; }
      else { held = slots[pass]; hole = pass; cursor = pass - 1; slots[hole] = null; comparison = null; }
    }
  }
  const stable = held === null && slots.every((id, index) => !index || byId.get(slots[index - 1]).days < byId.get(id).days || byId.get(slots[index - 1]).days === byId.get(id).days && byId.get(slots[index - 1]).originalIndex < byId.get(id).originalIndex);
  const reason = stable ? 'The shelf is sorted. Equal packets kept their original order.' : cursor < 0 ? 'At the front of the shelf: insert the held packet.' : comparison === null ? `Compare ${slots[cursor]} with held packet ${held}.` : comparison > 0 ? `${slots[cursor]} takes longer: slide it right.` : `${slots[cursor]} takes ${comparison === 0 ? 'the same time' : 'less time'}: insert the held packet after it.`;
  return { correct: stable, reason, sorting: view(), history };
}

const OPS = { NOT: (a) => Number(!a), PASS: (a) => a, AND: (a, b) => a & b, OR: (a, b) => a | b, XOR: (a, b) => a ^ b, GE: (a, b) => Number(a >= b), GT: (a, b) => Number(a > b), LE: (a, b) => Number(a <= b), LT: (a, b) => Number(a < b) };
function runProgram(modules, input, output, patch) {
  const values = { ...input }, trace = [];
  for (const module of modules) {
    const op = patch?.moduleId === module.id ? patch.op : module.op;
    if (!module.allowed.includes(op) || !OPS[op]) throw new Error('Choose an operator allowed by that module.');
    const args = module.args.map((arg) => typeof arg === 'number' ? arg : values[arg]);
    if (args.some((value) => !Number.isInteger(value))) throw new Error('A machine input is unavailable; the module graph must be acyclic.');
    const value = OPS[op](...args); values[module.id] = value; trace.push({ id: module.id, label: module.label, op, args, value });
  }
  return { value: values[output], trace };
}
function allCases(inputs) {
  let cases = [{}];
  for (const input of inputs) cases = cases.flatMap((previous) => input.values.map((value) => ({ ...previous, [input.id]: value })));
  return cases;
}
function debugging(random, profile, fallback) {
  const families = fallback || profile === 'calm' ? ['dew', 'echo'] : ['dew', 'sun', 'echo', 'climate'];
  const family = fallback ? 'dew' : families[Math.floor(random() * families.length)];
  const binary = (id, label) => ({ id, label, values: [0, 1] });
  const gate = (id, label, op, args) => ({ id, label, op, args, allowed: op === 'NOT' ? ['NOT', 'PASS'] : ['AND', 'OR', 'XOR'] });
  let inputs, modules, spec;
  if (family === 'dew') { inputs = [binary('wet', 'Soil wet'), binary('light', 'Daylight')]; modules = [gate('dry', 'Dry sensor', 'NOT', ['wet']), gate('bloom', 'Water pump', 'AND', ['dry', 'light'])]; spec = 'Pump only when the soil is dry and there is daylight.'; }
  else if (family === 'echo') { inputs = [binary('petals', 'Petals open'), binary('wind', 'Wind'), binary('frost', 'Frost')]; modules = [gate('flutter', 'Wing comparator', 'XOR', ['petals', 'wind']), gate('window', 'Frost guard', 'NOT', ['frost']), gate('bloom', 'Pollinator beacon', 'AND', ['flutter', 'window'])]; spec = 'Light the beacon when petals and wind differ, provided there is no frost.'; }
  else if (family === 'sun') { inputs = [binary('wet', 'Soil wet'), binary('light', 'Daylight'), binary('tank', 'Tank full')]; modules = [gate('dry', 'Dry sensor', 'NOT', ['wet']), gate('supply', 'Supply check', 'AND', ['light', 'tank']), gate('bloom', 'Irrigation motor', 'AND', ['dry', 'supply'])]; spec = 'Run irrigation only when soil is dry, daylight is present and the tank is full.'; }
  else { const low = 1 + Math.floor(random() * 2), high = low + 1; inputs = [{ id: 'temp', label: 'Temperature', values: [0, 1, 2, 3, 4] }, binary('lamp', 'Grow lamp')]; modules = [{ id: 'warm', label: 'Low thermostat', op: 'GE', args: ['temp', low], allowed: ['GE', 'GT', 'LE', 'LT'] }, { id: 'cool', label: 'High thermostat', op: 'LE', args: ['temp', high], allowed: ['GE', 'GT', 'LE', 'LT'] }, gate('band', 'Climate band', 'AND', ['warm', 'cool']), gate('bloom', 'Bloom chamber', 'AND', ['band', 'lamp'])]; spec = `Bloom only with the lamp on and temperature from ${low} through ${high}, including both endpoints.`; }
  const output = 'bloom', cases = allCases(inputs).map((input) => ({ inputs: input, expected: runProgram(modules, input, output).value }));
  const failures = [];
  for (const module of modules) for (const op of module.allowed.filter((value) => value !== module.op)) if (cases.some((sample) => runProgram(modules, sample.inputs, output, { moduleId: module.id, op }).value !== sample.expected)) failures.push({ moduleId: module.id, brokenOp: op, correctOp: module.op });
  const fault = failures[fallback ? 0 : Math.floor(random() * failures.length)];
  const broken = modules.map((module) => ({ ...module, args: [...module.args], allowed: [...module.allowed], op: module.id === fault.moduleId ? fault.brokenOp : module.op }));
  return { title: 'Glitch Garden Testbed', goal: 'Inspect the failing cases, then repair one machine module.', instructions: 'Exactly one module has the wrong operator. Select a machine, try a replacement operator, and run the full testbed. A repair must satisfy every input case, not only the first green result.', hints: ['Inspect a failing case and follow its intermediate values to the first incorrect module.', `Investigate ${modules.find((module) => module.id === fault.moduleId).label}. Its current operator is ${fault.brokenOp}.`, `Replace ${fault.moduleId} with ${fault.correctOp}, then rerun every case.`], data: { family, spec, inputs, modules: broken, output, cases }, answer: { patch: { moduleId: fault.moduleId, op: fault.correctOp } }, learning: 'Debugging means comparing observed behavior with a specification, testing a hypothesis, and rerunning regression cases. This finite model checks every allowed input combination, including boundary values.' };
}

export function simulateDevice(device, submission = {}) {
  try {
    const data = device.data;
    if (device.type === 'routing') {
      const directions = submission.directions || {}, routerMap = new Map(data.routers.map((router) => [router.id, router]));
      for (const [id, direction] of Object.entries(directions)) if (!routerMap.has(id) || !DIRECTIONS.includes(direction)) return { correct: false, reason: 'Use a valid direction for an existing router.', trace: [] };
      let position = data.source, passedRelay = !data.checkpoint; const trace = [], seen = new Set();
      for (let hops = 0; hops <= data.ttl; hops++) {
        trace.push(position); if (position === data.checkpoint) passedRelay = true;
        if (position === data.target) return { correct: passedRelay, reason: passedRelay ? 'Packet delivered.' : 'The packet bypassed the required relay.', trace, hops };
        if (seen.has(position)) return { correct: false, reason: `Loop detected at ${position}.`, trace, hops };
        if (hops === data.ttl) return { correct: false, reason: 'Hop limit reached before delivery.', trace, hops };
        seen.add(position); const router = routerMap.get(position);
        if (!router) return { correct: false, reason: `A broken tile at ${position} stopped the packet.`, trace, hops };
        const direction = directions[position] || router.direction, [dx, dy] = DELTA[direction];
        const x = router.x + dx, y = router.y + dy;
        if (x < 0 || y < 0 || x >= data.width || y >= data.height) return { correct: false, reason: `The router at ${position} sent the packet off the board.`, trace, hops };
        position = cell(x, y);
      }
    }
    if (device.type === 'scheduling') {
      const order = submission.order || [], known = new Map(data.jobs.map((job) => [job.id, job]));
      if (!Array.isArray(order) || new Set(order).size !== order.length || order.some((id) => !known.has(id))) return { correct: false, reason: 'Each job may appear exactly once.', steps: [] };
      let clock = 0; const complete = new Set(), steps = [];
      for (const id of order) { const job = known.get(id), start = clock; clock += job.duration; const missing = job.requires.filter((required) => !complete.has(required)); steps.push({ id, label: job.label, start, end: clock, late: clock > job.deadline, missing }); complete.add(id); }
      const omitted = order.length !== data.jobs.length, bad = steps.find((step) => step.late || step.missing.length);
      return { correct: !omitted && !bad, reason: bad ? bad.missing.length ? `Job ${bad.id} needs ${bad.missing.join(', ')} first.` : `Job ${bad.id} misses its deadline.` : omitted ? 'Add every job to the processor queue.' : 'Every job finished on time in dependency order.', steps, total: clock };
    }
    if (device.type === 'debugging') {
      const patch = submission.patch;
      if (patch && !data.modules.some((module) => module.id === patch.moduleId && module.allowed.includes(patch.op))) return { correct: false, reason: 'Choose one existing module and an allowed operator.', tests: [] };
      const tests = data.cases.map((sample) => { const result = runProgram(data.modules, sample.inputs, data.output, patch); return { ...sample, actual: result.value, pass: result.value === sample.expected, trace: result.trace }; });
      const passed = tests.filter((sample) => sample.pass).length;
      return { correct: Boolean(patch) && passed === tests.length, reason: `${passed}/${tests.length} test cases pass.`, tests, passed };
    }
    if (device.type === 'sorting') return insertionSimulation(data, submission.actions || []);
  } catch (error) { return { correct: false, reason: error.message || 'The device could not run this configuration.' }; }
  return { correct: false, reason: 'Unknown device type.' };
}

export function solveDevice(device, submission) {
  const result = simulateDevice(device, submission);
  return { ...result, message: result.correct ? `${device.title} restored. ${device.learning}` : result.reason, ...(result.correct ? { reward: device.reward, learning: device.learning, challengeId: device.challengeId, instanceId: device.instanceId } : {}) };
}

export function validateDevice(device) {
  if (device?.version !== 4 || !DEVICE_TYPES.includes(device.type) || typeof device.instanceId !== 'string' || !Array.isArray(device.hints) || !device.hints.length || device.hints.length > 5 || device.hints.some((hint) => typeof hint !== 'string' || !hint)) throw new Error('The optional device has an invalid version, identity or help data.');
  const expected = identity(device.seed, device.type, device.siteId, device.profile), data = device.data;
  if (device.challengeId !== expected.challengeId || !device.instanceId.startsWith(`${device.challengeId}:`) || device.rewardKey !== device.challengeId || device.reward?.id !== device.challengeId || device.reward.siteId !== device.siteId || device.reward.quantity !== 1 || !data) throw new Error('The device reward and challenge must share a stable site identity.');
  const integer = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;
  if (device.type === 'routing') {
    if (!integer(data.width, 2, 6) || !integer(data.height, 2, 6) || !integer(data.ttl, 1, 40) || !Array.isArray(data.routers) || !Array.isArray(data.blocked)) throw new Error('Routing must stay within a bounded grid and hop budget.');
    const validCell = (id) => typeof id === 'string' && /^\d+,\d+$/.test(id) && id.split(',').every((value, i) => integer(Number(value), 0, (i ? data.height : data.width) - 1));
    const ids = data.routers.map((router) => router.id), blocked = new Set(data.blocked);
    if (!validCell(data.source) || !validCell(data.target) || data.source === data.target || blocked.size !== data.blocked.length || data.blocked.some((id) => !validCell(id)) || blocked.has(data.source) || blocked.has(data.target) || new Set(ids).size !== ids.length || !ids.includes(data.source) || ids.includes(data.target) || ids.length + blocked.size !== data.width * data.height - 1 || data.routers.some((router) => !integer(router.x, 0, data.width - 1) || !integer(router.y, 0, data.height - 1) || router.id !== cell(router.x, router.y) || blocked.has(router.id) || !DIRECTIONS.includes(router.direction)) || data.checkpoint != null && (!validCell(data.checkpoint) || blocked.has(data.checkpoint))) throw new Error('Every routing tile must have one consistent role.');
  }
  if (device.type === 'scheduling') {
    if (!Array.isArray(data.jobs) || data.jobs.length < 3 || data.jobs.length > 6) throw new Error('The processor job set is malformed.');
    const ids = data.jobs.map((job) => job.id);
    if (new Set(ids).size !== ids.length || data.jobs.some((job) => typeof job.id !== 'string' || !job.id || !integer(job.duration, 1, 6) || !integer(job.deadline, 1, 40) || !Array.isArray(job.requires) || new Set(job.requires).size !== job.requires.length || job.requires.some((id) => id === job.id || !ids.includes(id)))) throw new Error('The processor needs unique bounded jobs and valid prerequisites.');
  }
  if (device.type === 'debugging') {
    if (!Array.isArray(data.inputs) || data.inputs.length < 1 || data.inputs.length > 4 || !Array.isArray(data.modules) || data.modules.length < 1 || data.modules.length > 5 || !Array.isArray(data.cases) || data.cases.length > 32) throw new Error('The testbed must cover a small, complete finite input domain.');
    const available = new Set();
    for (const input of data.inputs) {
      if (typeof input.id !== 'string' || !input.id || available.has(input.id) || !Array.isArray(input.values) || input.values.length < 1 || input.values.length > 5 || new Set(input.values).size !== input.values.length || input.values.some((value) => !integer(value, -100, 100))) throw new Error('A testbed input domain is malformed.');
      available.add(input.id);
    }
    for (const module of data.modules) {
      if (typeof module.id !== 'string' || !module.id || available.has(module.id) || !Array.isArray(module.allowed) || !module.allowed.length || !module.allowed.includes(module.op) || !Array.isArray(module.args) || module.allowed.some((op) => !Object.hasOwn(OPS, op) || OPS[op].length !== module.args.length) || module.args.some((arg) => typeof arg === 'number' ? !integer(arg, -100, 100) : !available.has(arg))) throw new Error('The machine modules must form an acyclic graph of supported operators.');
      available.add(module.id);
    }
    const key = (inputs) => data.inputs.map((input) => inputs?.[input.id]).join(','), domain = new Set(allCases(data.inputs).map(key));
    if (!data.modules.some((module) => module.id === data.output) || domain.size !== data.cases.length || new Set(data.cases.map((sample) => key(sample.inputs))).size !== domain.size || data.cases.some((sample) => !domain.has(key(sample.inputs)) || !integer(sample.expected, 0, 1))) throw new Error('Regression cases must cover each allowed input combination exactly once.');
  }
  if (device.type === 'sorting') {
    if (!Array.isArray(data.packets) || data.packets.length < 4 || data.packets.length > 7 || !integer(data.maxActions, 48, 256) || new Set(data.packets.map(packet => packet.id)).size !== data.packets.length || data.packets.some((packet, index) => typeof packet.id !== 'string' || !packet.id || typeof packet.label !== 'string' || !integer(packet.days, 1, 9) || packet.originalIndex !== index) || new Set(data.packets.map(packet => packet.days)).size === data.packets.length) throw new Error('The seed shelf needs bounded uniquely identified packets and stable equal-value pairs.');
  }
  if (!simulateDevice(device, device.answer).correct) throw new Error('The generated device has no known valid solution.');
  if (simulateDevice(device).correct) throw new Error('The device starts completed instead of offering a challenge.');
  return true;
}

function build(seed, type, site, profile, fallback) {
  const base = identity(seed, type, site, profile), random = seededRandom(hashString(`devices-v4:${seed}:${type}:${base.siteId}:${profile}:${fallback}`));
  const content = ({ routing, scheduling, debugging, sorting })[type](random, profile, fallback);
  const instanceId = `${base.challengeId}:${hashString(JSON.stringify({ seed, profile, data: content.data })).toString(36)}`;
  const device = { ...base, ...content, instanceId, rewardKey: base.challengeId, fallback, reward: { id: base.challengeId, item: `${type}-badge`, quantity: 1, siteId: base.siteId, stateChange: type === 'routing' ? 'network-online' : type === 'scheduling' ? 'processor-ready' : type === 'sorting' ? 'seed-shelf-ordered' : 'garden-restored' } };
  validateDevice(device); return device;
}

export function fallbackDevice(seed, type, site, profile = 'balanced') { return build(seed, type, site, profile, true); }
export function generateDevice(seed, type, site, profile = 'balanced') {
  identity(seed, type, site, profile);
  try { return build(seed, type, site, profile, false); }
  catch { return fallbackDevice(seed, type, site, profile); }
}
