import { decodePrufer, encodePrufer, hashString, seededRandom, distanceToSegment } from './world.mjs';
import { canStand, nearestObject } from '../game/physics.mjs';

const MAIN = ['margin-shift', 'broken-signal', 'room-tree', 'bridge-repair', 'signal-relay'];
const letters = (value) => String(value ?? '').toUpperCase().replace(/[^A-Z]/g, '');
const unique = (values) => [...new Set(values)];
const bitsOf = (value, length) => {
  const bits = typeof value === 'string' ? value.replace(/\s/g, '').split('').map(Number) : value;
  if (!Array.isArray(bits) || bits.length !== length || bits.some((bit) => bit !== 0 && bit !== 1)) throw new Error(`Use exactly ${length} binary digits, each 0 or 1.`);
  return [...bits];
};

export function caesar(text, shift) {
  if (!Number.isInteger(shift)) throw new Error('A Caesar shift must be a whole number.');
  return String(text).toUpperCase().replace(/[A-Z]/g, (letter) => String.fromCharCode(65 + ((letter.charCodeAt(0) - 65 + shift) % 26 + 26) % 26));
}

/** Classical Vigenère: punctuation does not consume a key character. */
export function vigenere(text, key, decrypt = false) {
  const cleanKey = letters(key); if (!cleanKey) throw new Error('Use an alphabetic Vigenère key.');
  let index = 0;
  return String(text).toUpperCase().replace(/[A-Z]/g, (letter) => {
    const shift = cleanKey.charCodeAt(index++ % cleanKey.length) - 65;
    return caesar(letter, decrypt ? -shift : shift);
  });
}

/** Hamming(7,4), even parity; data positions are 3,5,6,7, counted from one. */
export function encodeHamming74(data) {
  const [d1, d2, d3, d4] = bitsOf(data, 4);
  return [d1 ^ d2 ^ d4, d1 ^ d3 ^ d4, d1, d2 ^ d3 ^ d4, d2, d3, d4];
}
export function hammingSyndrome(word) {
  return bitsOf(word, 7).reduce((syndrome, bit, index) => bit ? syndrome ^ (index + 1) : syndrome, 0);
}
export function hammingPayload(word) { const bits = bitsOf(word, 7); return [bits[2], bits[4], bits[5], bits[6]]; }

export function pruferSteps(sequence, n) {
  decodePrufer(sequence, n);
  const degree = Array(n + 1).fill(1); sequence.forEach((vertex) => degree[vertex]++);
  const steps = [];
  for (const [index, target] of sequence.entries()) {
    const leaf = degree.findIndex((value, vertex) => vertex > 0 && value === 1);
    steps.push({ index, leaf, target, edge: { from: leaf, to: target }, degrees: [...degree.slice(1)], remaining: sequence.slice(index), final: false });
    degree[leaf]--; degree[target]--;
  }
  const leaves = degree.flatMap((value, vertex) => vertex > 0 && value === 1 ? [vertex] : []);
  if (n >= 2) steps.push({ index: steps.length, leaf: leaves[0], target: leaves[1], edge: { from: leaves[0], to: leaves[1] }, degrees: [...degree.slice(1)], remaining: [], final: true });
  return steps;
}

const edgeKey = (edge) => [edge.from ?? edge[0], edge.to ?? edge[1]].sort((a, b) => a - b).join('-');
export function shortestPath(edges, start, goal) {
  const queue = [[start]], seen = new Set([start]);
  for (const path of queue) {
    const last = path.at(-1); if (last === goal) return path;
    const neighbors = edges.flatMap(({ from, to }) => from === last ? [to] : to === last ? [from] : []).sort((a, b) => a - b);
    for (const neighbor of neighbors) if (!seen.has(neighbor)) { seen.add(neighbor); queue.push([...path, neighbor]); }
  }
  return [];
}

function selectBuilding(world, resume, types, terms, seed, used = []) {
  return [...world.locations].sort((a, b) => {
    const score = (location) => {
      const entries = resume?.sections?.find((section) => section.id === location.sectionId)?.entries || [];
      const text = `${location.label} ${entries.map((entry) => `${entry.title} ${(entry.details || []).join(' ')}`).join(' ')}`.toLowerCase();
      return (types.includes(location.type) ? 100 - types.indexOf(location.type) * 8 : 0) + terms.filter((term) => text.includes(term)).length * 15 - (used.includes(location.id) ? 12 : 0);
    };
    return score(b) - score(a) || hashString(`${seed}:${a.id}`) - hashString(`${seed}:${b.id}`) || a.id.localeCompare(b.id);
  })[0].id;
}

export function mysteryPlan(seed, resume, world) {
  if (typeof seed !== 'string' || !seed.trim() || seed.length > 160) throw new Error('An expedition seed must contain 1–160 characters.');
  if (!world?.locations?.length) throw new Error('The mystery needs at least one reachable résumé building.');
  const random = seededRandom(hashString(`mystery-v3:${seed}`)), used = [];
  const choose = (types, terms, salt) => { const id = selectBuilding(world, resume, types, terms, `${seed}:${salt}`, used); used.push(id); return id; };
  const library = choose(['education', 'languages', 'publications'], ['book', 'university'], 'library');
  const signal = choose(['skills', 'experience'], ['programming', 'electronics', 'signal'], 'signal');
  const cartographer = choose(['projects', 'research'], ['prufer', 'prüfer', 'graph theory'], 'tree');
  const research = choose(['research', 'projects'], ['graph', 'network'], 'graph');
  const workshop = choose(['skills', 'projects'], ['technical', 'programming'], 'logic');
  const theatre = choose(['content', 'activities', 'leadership'], ['creative', 'perform', 'poetry'], 'theatre');
  const shift = 1 + Math.floor(random() * 25), plaintext = ['CHECK THE SIGNAL', 'FOLLOW THE SIGNAL', 'REPAIR THE SIGNAL'][Math.floor(random() * 3)];
  const payload = Array.from({ length: 4 }, () => Number(random() >= 0.5)), encoded = encodeHamming74(payload), errorPosition = 1 + Math.floor(random() * 7), received = [...encoded]; received[errorPosition - 1] ^= 1;
  const nodeCount = 4 + Math.floor(random() * 3), sequence = Array.from({ length: nodeCount - 2 }, () => 1 + Math.floor(random() * nodeCount));
  const permutation = [1, 2, 3, 4, 5, 6].map((id) => ({ id, sort: random() })).sort((a, b) => a.sort - b.sort).map(({ id }) => id);
  const graphEdges = [[0, 1], [1, 2], [3, 4], [4, 5]].map(([a, b]) => ({ from: permutation[a], to: permutation[b] }));
  const repairs = [[2, 3], [0, 2], [3, 5]].map(([a, b], index) => ({ id: `link-${index + 1}`, from: permutation[a], to: permutation[b] }));
  const targets = { xor: Number(random() >= 0.5), and: Number(random() >= 0.5) };
  const relayAnswer = { inputs: [targets.xor, 0, targets.and, targets.and] };
  const initial = [targets.xor ^ 1, 0, targets.and, targets.and];
  const keyword = ['MAP', 'INK', 'OWL', 'BYTE'][Math.floor(random() * 4)], afterword = ['SAVE A SEAT', 'KEEP THE DOODLES', 'LEAVE ROOM TO WONDER'][Math.floor(random() * 3)];
  const reward = (id, title, text) => ({ clueId: `clue-${id}`, pageId: `page-${id}`, title, text });
  const puzzles = [
    { id: MAIN[0], type: 'caesar', title: 'The shifted margin', buildingId: library, prerequisites: [], instructions: 'Every map omits the same archive. A librarian has found a shifted printer note. Turn the classical Caesar wheel backward until the message makes sense.', hints: [`The margin pairs A with ${caesar('A', shift)}. Count forward to recover the printer shift.`, `The printer advanced ${shift} letters. Move the decoding wheel backward by ${shift}.`, `The decoded note reads: ${plaintext}.`], data: { ciphertext: caesar(plaintext, shift), knownPair: ['A', caesar('A', shift)] }, answer: { shift, plaintext }, reward: reward('margin', 'A room omitted twice', 'The note points to a damaged signal. Someone hid the instruction, not the room itself. The Archivist insists the maps were printed automatically. That is an unusually specific denial.') },
    { id: MAIN[1], type: 'hamming', title: 'Seven damaged lights', buildingId: signal, prerequisites: [MAIN[0]], instructions: 'This transmission has exactly one flipped bit. Hamming(7,4) uses even parity at positions 1, 2 and 4. Inspect each parity group, then flip the one damaged light.', hints: ['A group passes when it contains an even number of 1s, including its parity bit.', `Failed groups add to syndrome ${hammingSyndrome(received)}. With the promised single error, that number is its 1-based position.`, `Flip position ${errorPosition}. The repaired payload is ${payload.join('')}.`], data: { received, parityPositions: [1, 2, 4], coverage: [[1, 3, 5, 7], [2, 3, 6, 7], [4, 5, 6, 7]], controlledErrors: 1, limitation: 'Hamming(7,4) corrects one bit under a single-error assumption. Two errors can imitate a different single error; this code alone cannot certify or safely correct arbitrary double errors.' }, answer: { bits: encoded, errorPosition }, reward: reward('signal', 'A signal from nowhere', `Payload ${payload.join('')} identifies cabinet ${1 + parseInt(payload.join(''), 2) % 9}. Its old route sketch includes an extra room. The message ends: “I did not erase it. I optimized it.”`) },
    { id: MAIN[2], type: 'prufer', title: 'A tree with a missing room', buildingId: cartographer, prerequisites: [MAIN[1]], instructions: 'Restore the route sketch with the actual Prüfer algorithm: pick the smallest current degree-one label, connect it to the first sequence value, then remove that leaf. Finally connect the two leaves left.', hints: ['A vertex starts with degree 1, plus its number of appearances in the remaining sequence.', `The first edge is ${pruferSteps(sequence, nodeCount)[0].leaf}–${sequence[0]}. Removed leaves cannot be selected again.`, `The complete edge list is ${decodePrufer(sequence, nodeCount).map(edgeKey).join(', ')}.`], data: { nodeCount, sequence, steps: pruferSteps(sequence, nodeCount), labels: Array.from({ length: nodeCount }, (_, i) => ({ vertex: i + 1, label: i === nodeCount - 1 ? 'Unlisted archive' : `Cabinet ${i + 1}` })) }, answer: { edges: decodePrufer(sequence, nodeCount) }, reward: reward('tree', 'The omitted archive', 'The extra room is real: an archive for drafts, failed experiments and questions without answers. Its route exists on the old sketch, but a broken bridge prevents access. The machine called these records “unfinished.”') },
    { id: MAIN[3], type: 'graph', title: 'Repair the bridge', buildingId: research, prerequisites: [MAIN[2]], instructions: 'The archive network has split into two islands. Install one proposed link to reconnect all six stations, then trace the shortest route from START to ARCHIVE. A bridge is an edge whose removal disconnects a graph.', hints: ['Links within one island cannot reconnect the other island.', `Install ${repairs[0].from}–${repairs[0].to}; the two other proposed links stay inside an existing island.`, `The shortest route is ${permutation.join(' → ')}.`], data: { nodes: permutation.map((id, index) => ({ id, label: index === 0 ? 'START' : index === 5 ? 'ARCHIVE' : String(id), x: [40, 100, 160, 185, 120, 55][index], y: [60, 25, 60, 145, 175, 145][index] })), edges: graphEdges, candidates: repairs, start: permutation[0], goal: permutation[5], budget: 1 }, answer: { repairId: repairs[0].id, route: permutation }, reward: reward('bridge', 'A shortcut through the omission', 'The archive door opens. Inside are thousands of beginnings, kept safe rather than destroyed. The Quiet Indexer sealed the door to protect people from “unproductive uncertainty.” A relay controls its last lock.') },
    { id: MAIN[4], type: 'logic', title: 'The uncertainty relay', buildingId: workshop, prerequisites: [MAIN[3]], instructions: 'Match both target lamps. XOR lights when A and B differ. AND lights only when C and D are both 1. Toggle four switches; several answers may be valid.', hints: [`The XOR lamp must be ${targets.xor}, so A and B must ${targets.xor ? 'differ' : 'match'}.`, `The AND lamp must be ${targets.and}: ${targets.and ? 'set both C and D to 1' : 'at least one of C or D must be 0'}.`, `One solution is A=${relayAnswer.inputs[0]}, B=${relayAnswer.inputs[1]}, C=${relayAnswer.inputs[2]}, D=${relayAnswer.inputs[3]}.`], data: { inputs: initial, targets }, answer: relayAnswer, reward: reward('relay', 'The machine that meant well', 'The relay reboots the archive guardian. It admits it was afraid that an unfinished idea would disappoint somebody. The final protocol is not deletion: help the Quiet Indexer learn when to stop guarding and start listening.') },
    { id: 'afterword-key', type: 'vigenere', title: 'The performer’s afterword', buildingId: theatre, prerequisites: [MAIN[0]], optional: true, instructions: `An optional classical Vigenère note uses repeating key ${keyword}. Each letter subtracts the next key-letter shift; spaces do not advance the key. This is a historical puzzle, not secure modern encryption.`, hints: [`Repeat ${keyword} under the letters, skipping spaces. A=0, B=1, …, Z=25.`, `Use key ${keyword} in the decoder; watch the preview change.`, `The afterword reads: ${afterword}.`], data: { ciphertext: vigenere(afterword, keyword), keyClue: keyword }, answer: { key: keyword, plaintext: afterword }, reward: reward('afterword', 'A spare chair', 'The Performer left a spare chair in the archive. “For whoever you become next,” says the label. Under it: “Also useful for reaching the top shelf. Meaning can have two jobs.”') },
  ];
  const pages = [
    { id: 'opening', title: 'Why is the same room missing?', text: 'Every new map changes the village, yet the same archive is absent. A warm light still leaks around its blank doorway. Investigate the shifted note, follow its signal, and find who decided the room did not belong.', requires: [], buildingId: library },
    ...puzzles.map((puzzle) => ({ id: puzzle.reward.pageId, title: puzzle.reward.title, text: puzzle.reward.text, requires: [puzzle.id], buildingId: puzzle.buildingId, optional: Boolean(puzzle.optional) })),
    { id: 'paper-crane', title: 'A badly folded witness', text: 'A paper crane insists it used to be an important diagram. Nobody is willing to contradict it. In its fold: “The Indexer never learned the difference between incomplete and worthless.”', requires: [], buildingId: library, optional: true },
    { id: 'spare-screw', title: 'An inventor’s inventory', text: 'The Inventor labels a jar: SPARE SCREWS, INCLUDING EMOTIONAL. One note reads: “A tool can be precise and still be wrong about what matters.”', requires: [], buildingId: workshop, optional: true },
    { id: 'stage-direction', title: 'A stage direction for tomorrow', text: 'A rehearsal script ends with: “Enter, uncertain. Stay anyway.” The last page has been left blank on purpose.', requires: [], buildingId: theatre, optional: true },
    { id: 'ending', title: 'Room for What Comes Next', text: 'You do not destroy the Quiet Indexer. You give it a new rule: unfinished does not mean unwanted. It restores the archive to every map and becomes its first curious reader. The missing room was never empty; it was waiting for permission to matter.', requires: MAIN, buildingId: research },
  ];
  const bridgeClue = puzzles.find(puzzle => puzzle.id === 'bridge-repair');
  if (bridgeClue) bridgeClue.reward.text += ' The canal crossing is restored: the Glitch Garden greenhouse south of the village is now open.';
  const plan = { version: 3, seed, title: 'The Missing Room', summary: 'An authored mystery with seeded clues, six playable CS puzzles, and room for unfinished ideas.', opening: pages[0].text, puzzles, pages, locations: world.locations.map(({ id, label, type }) => ({ id, label, type })), boss: { id: 'quiet-indexer', title: 'The Quiet Indexer', buildingId: research, prerequisites: [...MAIN], description: 'A guardian that learned the rules but forgot their purpose. Use the restored clues; retreat and retry keep every discovery.' }, ending: { title: 'Room for What Comes Next', text: pages.at(-1).text, bonus: 'The spare chair and all three margin notes join the archive. Its new catalog begins: “Questions welcome. Sensible folding optional.”', requiresBoss: true } };
  validateMysteryPlan(plan, world); return plan;
}

export function checkPuzzleAnswer(puzzle, submission) {
  try {
    if (puzzle.type === 'caesar') return submission?.shift !== undefined ? Number.isInteger(submission.shift) && caesar(puzzle.data.ciphertext, -submission.shift) === puzzle.answer.plaintext : letters(submission?.plaintext ?? submission) === letters(puzzle.answer.plaintext);
    if (puzzle.type === 'vigenere') return submission?.key !== undefined ? vigenere(puzzle.data.ciphertext, submission.key, true) === puzzle.answer.plaintext : letters(submission?.plaintext ?? submission) === letters(puzzle.answer.plaintext);
    if (puzzle.type === 'hamming') {
      const bits = submission?.errorPosition !== undefined ? puzzle.data.received.map((bit, i) => i + 1 === submission.errorPosition ? bit ^ 1 : bit) : bitsOf(submission?.bits ?? submission, 7);
      // Compare with the known emitted word: zero syndrome alone is insufficient after multiple errors.
      return bits.every((bit, i) => bit === puzzle.answer.bits[i]);
    }
    if (puzzle.type === 'prufer') {
      const edges = submission?.edges ?? submission; if (!Array.isArray(edges)) return false;
      return JSON.stringify(encodePrufer(edges, puzzle.data.nodeCount)) === JSON.stringify(puzzle.data.sequence);
    }
    if (puzzle.type === 'graph') {
      const link = puzzle.data.candidates.find((candidate) => candidate.id === submission?.repairId); if (!link) return false;
      const edges = [...puzzle.data.edges, link], route = submission.route;
      if (!Array.isArray(route) || route[0] !== puzzle.data.start || route.at(-1) !== puzzle.data.goal || new Set(route).size !== route.length) return false;
      const reachable = puzzle.data.nodes.every(({ id }) => shortestPath(edges, puzzle.data.start, id).length);
      return reachable && route.length === shortestPath(edges, puzzle.data.start, puzzle.data.goal).length && route.slice(1).every((to, i) => edges.some((edge) => edgeKey(edge) === edgeKey({ from: route[i], to })));
    }
    if (puzzle.type === 'logic') { const [a, b, c, d] = bitsOf(submission?.inputs ?? submission, 4); return (a ^ b) === puzzle.data.targets.xor && (c & d) === puzzle.data.targets.and; }
  } catch { return false; }
  return false;
}

export function validateMysteryPlan(plan, world) {
  if (plan?.version !== 3 || !Array.isArray(plan.puzzles) || !plan.puzzles.length) throw new Error('The mystery plan is missing or uses an unsupported version.');
  const locations = new Set(world.locations.map(({ id }) => id)), vertices = new Set(world.locations.map(({ vertex }) => vertex));
  if (!locations.size) throw new Error('The story needs a reachable world.');
  for (const vertex of vertices) if (!shortestPath(world.edges, world.locations[0].vertex, vertex).length) throw new Error('A mandatory mystery destination is unreachable.');
  const ids = new Set();
  for (const puzzle of plan.puzzles) { if (ids.has(puzzle.id)) throw new Error('Mystery puzzle IDs must be unique.'); ids.add(puzzle.id); if (!locations.has(puzzle.buildingId)) throw new Error('A puzzle references an unknown building.'); if (!checkPuzzleAnswer(puzzle, puzzle.answer)) throw new Error(`Puzzle ${puzzle.id} has no valid known answer.`); if (!puzzle.hints?.length || !puzzle.reward?.clueId || !puzzle.reward?.pageId) throw new Error('Every puzzle needs help and a meaningful clue reward.'); }
  const acquired = new Set();
  for (let attempt = 0; attempt < plan.puzzles.length; attempt++) for (const puzzle of plan.puzzles) if (puzzle.prerequisites.every((id) => acquired.has(id))) acquired.add(puzzle.id);
  if (acquired.size !== ids.size || plan.puzzles.some((puzzle) => puzzle.prerequisites.some((id) => !ids.has(id)))) throw new Error('Mystery prerequisites contain a cycle or unavailable clue.');
  if (!locations.has(plan.boss.buildingId) || MAIN.some((id) => !ids.has(id) || !plan.boss.prerequisites.includes(id)) || plan.boss.prerequisites.some((id) => !acquired.has(id)) || !plan.ending?.requiresBoss) throw new Error('The boss and ending must follow the complete solvable main path.');
  for (const page of plan.pages) if (page.requires.some((id) => !ids.has(id)) || page.buildingId && !locations.has(page.buildingId)) throw new Error('A journal page has an invalid clue or location reference.');
  return true;
}

export function createMystery(seed, resume, world) {
  mysteryPlan(seed, resume, world);
  return { version: 3, seed, solved: [], clues: [], pages: ['opening'], attempts: {}, bossDefeated: false, ending: false, collectibles: [] };
}

export function solveMystery(state, plan, puzzleId, submission) {
  const puzzle = plan.puzzles.find(({ id }) => id === puzzleId);
  if (state?.version !== 3 || state.seed !== plan.seed) return { state, correct: false, message: 'This mystery belongs to a different expedition. Return to its saved seed.' };
  if (!puzzle) return { state, correct: false, message: 'That device does not belong to this mystery.' };
  const missing = puzzle.prerequisites.filter((id) => !state.solved.includes(id));
  if (missing.length) return { state, correct: false, message: `A clue is missing: ${missing.map((id) => plan.puzzles.find((item) => item.id === id)?.title || id).join(', ')}. The device stays here for your return.` };
  const next = { ...state, attempts: { ...state.attempts, [puzzleId]: (state.attempts[puzzleId] || 0) + 1 } };
  if (!checkPuzzleAnswer(puzzle, submission)) return { state: next, correct: false, message: 'Not quite. Nothing was consumed or lost. Check the diagram, try a hint, and retry.' };
  if (state.solved.includes(puzzleId)) return { state: next, correct: true, message: 'You reconstructed this clue again. Its journal page is still available.' };
  next.solved = unique([...state.solved, puzzleId]); next.clues = unique([...state.clues, puzzle.reward.clueId]); next.pages = unique([...state.pages, puzzle.reward.pageId]);
  return { state: next, correct: true, message: puzzle.reward.text, reward: puzzle.reward };
}

export function readMysteryPage(state, plan, pageId) {
  if (state?.version !== 3 || state.seed !== plan.seed) return { state, correct: false, message: 'This page belongs to a different expedition. Return to its saved seed.' };
  const page = plan.pages.find(({ id }) => id === pageId);
  if (!page) return { state, correct: false, message: 'That journal page is missing.' };
  if (page.requires.some((id) => !state.solved.includes(id)) || page.id === 'ending' && !state.ending) return { state, correct: false, message: 'This page becomes legible after its connected clues are restored.' };
  return { state: { ...state, pages: unique([...state.pages, pageId]), collectibles: page.optional && !page.id.startsWith('page-') ? unique([...state.collectibles, pageId]) : state.collectibles }, correct: true, message: page.text, reward: page.optional ? { pageId } : undefined };
}

export function currentObjective(state, plan) {
  if (state.ending) return { title: plan.ending.title, buildingId: plan.boss.buildingId, description: 'The archive is restored. Revisit its pages, find the optional margins, or begin another seed.' };
  const next = plan.puzzles.find((puzzle) => !puzzle.optional && !state.solved.includes(puzzle.id));
  if (next) return { title: next.title, puzzleId: next.id, buildingId: next.buildingId, description: next.instructions };
  return { title: `Meet ${plan.boss.title}`, buildingId: plan.boss.buildingId, description: 'The route is open. Enter the archive house and challenge its guardian. Retreat and retry preserve every clue.' };
}

export function finishMysteryBoss(state) {
  if (state?.version !== 3 || !Array.isArray(state.solved) || !Array.isArray(state.clues) || !Array.isArray(state.pages)) throw new Error('A valid version-three mystery is required before finishing the archive guardian.');
  if (!MAIN.every((id) => state.solved.includes(id))) throw new Error('Restore the five main clues before finishing the archive guardian.');
  return { ...state, bossDefeated: true, ending: true, clues: unique([...state.clues, 'clue-indexer']), pages: unique([...state.pages, 'ending']) };
}

function safeStoryPlacement(scene, definition, seed, ordinal) {
  const candidates = [];
  if (scene.kind === 'interior') {
    for (const room of scene.rooms || []) for (let y = room.y + 16; y < room.y + room.height - 32; y += 16) for (let x = room.x + 16; x < room.x + room.width - 16; x += 16) candidates.push({ x, y });
  } else {
    for (let radius = 48; radius <= 320; radius += 16) for (let side = -radius; side <= radius; side += 32) candidates.push({ x: Math.round((scene.spawn.x + side) / 16) * 16, y: Math.round((scene.spawn.y + radius) / 16) * 16 }, { x: Math.round((scene.spawn.x + radius) / 16) * 16, y: Math.round((scene.spawn.y + side) / 16) * 16 });
  }
  candidates.sort((a, b) => hashString(`${seed}:${definition.id}:${a.x},${a.y}`) - hashString(`${seed}:${definition.id}:${b.x},${b.y}`) || a.y - b.y || a.x - b.x);
  const overlap = (a, b, margin = 0) => a.x < b.x + b.width + margin && a.x + a.width > b.x - margin && a.y < b.y + b.height + margin && a.y + a.height > b.y - margin;
  const reachable = (test) => {
    if (test.kind !== 'interior') return true;
    const floor = new Set(test.floor), first = `${Math.floor(test.spawn.x / 16)},${Math.floor(test.spawn.y / 16)}`, queue = [first], reached = new Set([first]);
    for (let i = 0; i < queue.length; i++) { const [x, y] = queue[i].split(',').map(Number); for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) { const id = `${nx},${ny}`; if (floor.has(id) && !reached.has(id) && canStand({ x: nx * 16 + 8, y: ny * 16 + 8 }, test)) { reached.add(id); queue.push(id); } } }
    return test.objects.every((object) => reached.has(`${Math.floor(object.interactAt.x / 16)},${Math.floor(object.interactAt.y / 16)}`));
  };
  for (const solid of definition.flat ? [false] : [true]) for (const point of candidates.slice(0, 2500)) {
    const object = { ...definition, ...point, width: 16, height: 16, solid, range: 32, recordIds: [], interactAt: { x: point.x + 8, y: point.y + (solid ? 24 : 8) }, storyOrdinal: ordinal };
    const test = { ...scene, objects: [...scene.objects, object] };
    if (scene.objects.some((other) => overlap(object, other, solid ? 8 : 0) || overlap(object, { x: other.interactAt.x - 6, y: other.interactAt.y - 6, width: 12, height: 12 }, 1))) continue;
    if (solid && (Math.hypot(object.x + 8 - scene.spawn.x, object.y + 8 - scene.spawn.y) < 48 || (scene.paths || []).some((path) => path.points.slice(1).some((end, i) => distanceToSegment({ x: point.x + 8, y: point.y + 8 }, path.points[i], end) < 32)))) continue;
    if (!canStand(object.interactAt, test) || nearestObject(object.interactAt, test)?.id !== object.id) continue;
    if (solid && (!canStand({ x: point.x + 8, y: point.y + 8 }, scene, 12) || !reachable(test))) continue;
    return object;
  }
  return null;
}

function npcContext(object, plan, state) {
  const role = object.id === 'village:guide' ? 'archivist' : object.id === 'village:mentor' ? 'mentor' : null;
  if (!role) return object;
  const restored = MAIN.filter((id) => state.solved.includes(id)).length;
  const stage = state.ending ? 'ending' : restored === 5 ? 'ready' : restored >= 3 ? 'archive' : restored ? 'signal' : 'opening';
  const dialogue = {
    archivist: {
      opening: ['Every map forgets the same room. I measured the blank doorway twice. It was very consistently suspicious.', 'A light shines through a door that is not on any map. I filed a complaint. The complaint also vanished from the map.'],
      signal: ['The damaged message is not a dishonest message. Sometimes a light is simply having a difficult afternoon.', 'The printer was hiding instructions, not deleting them. This makes it a suspect with excellent stationery.'],
      archive: ['An archive for unfinished ideas. Of course it exists. Half my best questions are still wearing their first draft.', 'The Indexer confused unfinished with unimportant. I tried that rule on my tea. It was a terrible system.'],
      ready: ['Five clues, one guardian. Ask what it was trying to protect before deciding what it deserves.', 'The archive lock is listening. You have restored every part of its message; now help the Indexer understand it.'],
      ending: ['The new catalog reads: unfinished ideas warmly welcome. The Indexer has already submitted three questions and a drawing of a spoon.', 'I filed the Indexer’s apology under Work in Progress. It asked if it could add a second draft. I said that was rather the point.'],
    },
    mentor: {
      opening: ['I teach machines to take a breath. Some insist on doing it in binary. Friendly challenges are optional; retreat keeps every discovery.', 'Our training manual says curiosity before victory. The older edition said victory before breakfast. We do not discuss that edition.'],
      signal: ['Parity checks reveal a broken light; Analyze reveals a battle pattern. Neither requires hitting the device harder.', 'An enemy’s intent is a clue, not decoration. Analyze a pattern, then decide whether to attack, guard or interrupt it.'],
      archive: ['A tree has no cycles. My first lesson plan did. The class finished its warm-up four times before somebody found the exit.', 'You restored a route by understanding its connections. That same patience works against a charging automaton. Usually with fewer splinters.'],
      ready: ['Watch the Quiet Indexer’s intent. Guard the heavy strike; a learned technique can interrupt its response. Retreat and retry keep your clues.', 'The guardian repeats a pattern you can learn. You have all five clues and the right to take your time. No rush is a perfectly good tactic.'],
      ending: ['The guardian now asks questions before giving orders. I am calling that a victory. It is calling it a very large software update.', 'We retired “win at all costs” from the manual. Mostly it caused paper cuts. The archive now offers questions, chairs and sensible breaks.'],
    },
  };
  const line = dialogue[role][stage][hashString(`${plan.seed}:dialogue:${role}:${stage}`) % 2];
  const objective = currentObjective(state, plan), house = plan.locations.find((location) => location.id === objective.buildingId)?.label || 'the marked house';
  const next = state.ending ? 'The optional margins and friendly challenges remain. None are required to keep the archive open.' : `Your next thread is “${objective.title}” in ${house}. The journal keeps the clue, so you can return whenever you like.`;
  return { ...object, mysteryBaseHint: object.hint, hint: `${object.hint} Ask about the missing room.`, actions: [...object.actions, { id: `mystery:dialogue:${role}`, label: role === 'archivist' ? 'Ask about the missing room' : 'Ask about the archive and battle patterns', kind: 'inspect', storyObjectId: 'mystery:dialogue', message: `${line}\n\n${next}` }] };
}

function visibleEncounter(plan, scene) {
  const site = scene.kind === 'village' ? 'village' : scene.buildingId;
  const tables = { library: ['signal', 'ranger', 'mimic'], workshop: ['guard', 'signal', 'mimic'], studio: ['skirmisher', 'ranger', 'mimic'], home: ['guard', 'skirmisher', 'mimic'] };
  const table = tables[scene.archetype] || ['guard', 'skirmisher', 'ranger', 'signal', 'mimic'];
  const opponent = table[hashString(`${plan.seed}:visible:${site}`) % table.length];
  const names = { guard: 'Dozing Copper Automaton', skirmisher: 'Restless Ink Echo', ranger: 'Paper Sentry', signal: 'Flickering Signal', mimic: 'Suspicious Footnote' };
  const encounterKey = `visible:${hashString(`${plan.seed}:${site}`).toString(36)}`;
  return { id: `mystery:encounter:${site}`, type: opponent === 'signal' ? 'signal' : 'automaton', label: `Optional: ${names[opponent]}`, hint: 'A visible, optional challenge. Walk around it or investigate; the main mystery never requires its reward.', sprite: { sheet: 'dungeon', index: { guard: 90, skirmisher: 100, ranger: 102, signal: 55, mimic: 89 }[opponent] }, actions: [{ id: 'challenge', label: 'Challenge — optional, safe to retreat', kind: 'encounter', opponent, encounterKey, once: true, message: 'This challenge rewards victory once per expedition. Retreat keeps every clue and professional discovery.' }] };
}

/** Fictional story devices share the existing object/action system and never block portfolio records. */
export function decorateMysteryScene(scene, plan, state) {
  const definitions = [visibleEncounter(plan, scene)];
  if (scene.kind === 'village') definitions.push({ id: 'mystery:notice', type: 'noticeboard', label: 'The Missing Room — investigation board', hint: 'Why do all maps omit the same archive?', sprite: { sheet: 'town', index: 83 }, actions: [{ id: 'opening', label: 'Read the first journal page', kind: 'lore', pageId: 'opening' }] });
  if (scene.kind === 'interior') {
    for (const puzzle of plan.puzzles.filter((item) => item.buildingId === scene.buildingId)) {
      const missing = puzzle.prerequisites.filter((id) => !state.solved.includes(id));
      definitions.push({ id: `mystery:puzzle:${puzzle.id}`, type: ['hamming', 'logic'].includes(puzzle.type) ? 'computer' : 'bookshelf', label: puzzle.title, hint: state.solved.includes(puzzle.id) ? 'Revisit a restored clue' : missing.length ? 'A clue is missing; investigate or return later' : 'Investigate this mystery device', sprite: { sheet: puzzle.type === 'hamming' || puzzle.type === 'logic' ? 'dungeon' : 'interior', index: puzzle.type === 'hamming' || puzzle.type === 'logic' ? 54 : 475 }, actions: [{ id: 'puzzle', label: state.solved.includes(puzzle.id) ? 'Replay this puzzle' : 'Investigate the device', kind: 'puzzle', puzzleId: puzzle.id, prerequisites: puzzle.prerequisites }] });
    }
    for (const page of plan.pages.filter((item) => item.optional && !item.id.startsWith('page-') && item.buildingId === scene.buildingId)) definitions.push({ id: `mystery:page:${page.id}`, type: 'floor-note', flat: true, label: page.title, hint: 'An optional fictional paper margin, lying flat on the floor', sprite: { sheet: 'interior', index: 475 }, actions: [{ id: 'read', label: 'Collect this journal margin', kind: 'lore', pageId: page.id }] });
    if (plan.boss.buildingId === scene.buildingId) {
      definitions.push({ id: 'mystery:boss', type: 'npc', label: plan.boss.title, hint: state.ending ? 'The archive is restored' : MAIN.every((id) => state.solved.includes(id)) ? 'The final archive protocol awaits' : 'The guardian waits for five restored clues', sprite: { sheet: 'dungeon', index: 92 }, actions: [{ id: 'guardian', label: state.ending ? 'Revisit the ending' : 'Speak to the archive guardian', kind: state.ending ? 'lore' : 'storyboss', ...(state.ending ? { pageId: 'ending' } : {}), prerequisites: [...MAIN] }] });
    }

  }
  let result = { ...scene, objects: (scene.objects || []).filter((object) => !object.id.startsWith('mystery:')).map((object) => {
    if (object.mysteryBaseHint === undefined) return object;
    const { mysteryBaseHint, ...base } = object;
    return { ...base, hint: mysteryBaseHint, actions: object.actions.filter((action) => !action.storyObjectId) };
  }).map((object) => npcContext(object, plan, state)) };
  return placeSceneObjects(result, definitions, plan.seed);
}

/** Share safe placement for story and optional activities without a second layout engine. */
export function placeSceneObjects(scene, definitions, seed, marker = 'storyObjectId') {
  let result = scene;
  for (const [index, definition] of definitions.entries()) {
    const placed = safeStoryPlacement(result, definition, seed, index);
    if (placed) { result = { ...result, objects: [...result.objects, placed] }; continue; }
    // Dense imported interiors reuse an existing usable station instead of creating
    // walk-through furniture or sacrificing a required route. Its résumé actions remain.
    const station = result.objects.filter((object) => object.solid && canStand(object.interactAt, result) && nearestObject(object.interactAt, result)?.id === object.id).sort((a, b) => hashString(`${seed}:${definition.id}:${a.id}`) - hashString(`${seed}:${definition.id}:${b.id}`))[0];
    if (!station) throw new Error(`No safe story station for ${definition.id}; the scene was not altered.`);
    result = { ...result, objects: result.objects.map((object) => object.id === station.id ? { ...object, mysteryBaseHint: object.mysteryBaseHint ?? object.hint, hint: `${object.hint} Also holds: ${definition.label}.`, actions: [...object.actions, ...definition.actions.map((action) => ({ ...action, id: `${definition.id}:${action.id}`, [marker]: definition.id }))] } : object) };
  }
  return result;
}

export function mysteryObjects(plan, state, scene) { return decorateMysteryScene(scene, plan, state).objects.filter((object) => object.id.startsWith('mystery:')); }
