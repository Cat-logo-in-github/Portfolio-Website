/** Shared by the build pipeline and browser. All coordinates are world pixels. */
const GENERATION_VERSION = 1;
const TILE = 16;
const OUTER_MARGIN = 128;
const NODE_SPAN = 256;
const LEVEL_SPAN = 256;
const GATE_OFFSET = 160;

function assertVertexCount(n) {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('The location count must be a non-negative integer.');
}

function validateSequence(sequence, n) {
  assertVertexCount(n);
  if (!Array.isArray(sequence)) throw new Error('The Prüfer code must be an array of vertex labels.');
  const expected = Math.max(0, n - 2);
  if (sequence.length !== expected) {
    throw new Error(`This world has ${n} locations, so its Prüfer code needs exactly ${expected} ${expected === 1 ? 'value' : 'values'}; received ${sequence.length}.`);
  }
  for (let i = 0; i < sequence.length; i++) {
    if (!Number.isSafeInteger(sequence[i]) || sequence[i] < 1 || sequence[i] > n) {
      throw new Error(`Value ${i + 1} must be a whole-number vertex label from 1 to ${n}.`);
    }
  }
}

/** Standard smallest-leaf Prüfer decoding, with explicit 0/1/2-vertex cases. */
export function decodePrufer(sequence, n) {
  validateSequence(sequence, n);
  if (n < 2) return [];
  const degree = Array(n + 1).fill(1);
  for (const vertex of sequence) degree[vertex]++;
  const edges = [];
  for (const vertex of sequence) {
    let leaf = 1;
    while (degree[leaf] !== 1) leaf++;
    edges.push({ from: leaf, to: vertex });
    degree[leaf]--;
    degree[vertex]--;
  }
  const leaves = [];
  for (let vertex = 1; vertex <= n; vertex++) if (degree[vertex] === 1) leaves.push(vertex);
  edges.push({ from: leaves[0], to: leaves[1] });
  return edges;
}

/** Encode a validated labeled tree using the same smallest-leaf convention. */
export function encodePrufer(edges, n) {
  assertVertexCount(n);
  if (!Array.isArray(edges) || edges.length !== Math.max(0, n - 1)) {
    throw new Error(`A tree with ${n} vertices must contain exactly ${Math.max(0, n - 1)} edges.`);
  }
  const adjacent = Array.from({ length: n + 1 }, () => new Set());
  const component = Array.from({ length: n + 1 }, (_, i) => i);
  const find = (vertex) => {
    while (component[vertex] !== vertex) {
      component[vertex] = component[component[vertex]];
      vertex = component[vertex];
    }
    return vertex;
  };
  for (const edge of edges) {
    const from = Array.isArray(edge) ? edge[0] : edge?.from;
    const to = Array.isArray(edge) ? edge[1] : edge?.to;
    if (![from, to].every((v) => Number.isSafeInteger(v) && v >= 1 && v <= n)) {
      throw new Error(`Every edge endpoint must be a vertex label from 1 to ${n}.`);
    }
    if (from === to) throw new Error('Tree edges cannot contain self-loops.');
    if (adjacent[from].has(to)) throw new Error('Tree edges cannot contain duplicates.');
    if (find(from) === find(to)) throw new Error('The edges contain a cycle and do not form a tree.');
    component[find(from)] = find(to);
    adjacent[from].add(to);
    adjacent[to].add(from);
  }
  if (n > 0) for (let v = 2; v <= n; v++) {
    if (find(v) !== find(1)) throw new Error('The tree must connect every vertex.');
  }
  const sequence = [];
  for (let i = 0; i < Math.max(0, n - 2); i++) {
    let leaf = 1;
    while (adjacent[leaf].size !== 1) leaf++;
    const [neighbor] = adjacent[leaf];
    sequence.push(neighbor);
    adjacent[leaf].delete(neighbor);
    adjacent[neighbor].delete(leaf);
  }
  return sequence;
}

/** Accept comma-separated or whitespace-separated whole-number labels. */
export function parseSequence(text, n) {
  assertVertexCount(n);
  if (typeof text !== 'string') throw new Error('Enter the Prüfer code as comma-separated numbers.');
  let source = text.trim();
  if (source.startsWith('[') && source.endsWith(']')) source = source.slice(1, -1).trim();
  if (/^,|,$|,\s*,/.test(source)) throw new Error('Separate each vertex label with one comma or a space; do not leave an empty value.');
  const tokens = source ? source.split(/[,\s]+/) : [];
  if (tokens.some((token) => !/^\d+$/.test(token))) {
    throw new Error(`Use only whole-number vertex labels from 1 to ${n}, separated by commas or spaces.`);
  }
  const sequence = tokens.map(Number);
  validateSequence(sequence, n);
  return sequence;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cleanString = (value) => typeof value === 'string' ? value.trim() : '';
const entryText = (entry) => [entry?.title, entry?.subtitle, entry?.dates, ...(Array.isArray(entry?.details) ? entry.details : [])].map(cleanString).join(' ');
const hasEntryContent = (entry) => Boolean(entryText(entry).trim() || entry?.links?.length);

/** Entry counts and accomplishment counts dominate; verbose text contributes at most ten points. */
export function scoreSection(section) {
  const entries = (section?.entries || []).filter(hasEntryContent);
  const weights = { experience: 18, work: 18, projects: 14, education: 8, publications: 12, awards: 8, certifications: 6, volunteering: 6, skills: 0, profile: 0, summary: 0, about: 0, contact: 0, links: 0 };
  const type = cleanString(section?.type).toLowerCase();
  const words = entries.map(entryText).join(' ').trim().split(/\s+/).filter(Boolean).length;
  const details = entries.reduce((sum, entry) => sum + (entry.details || []).filter((detail) => cleanString(detail)).length, 0);
  const links = entries.reduce((sum, entry) => sum + (entry.links?.length || 0), 0);
  let score = 12 + (weights[type] ?? 5) + Math.min(8, entries.length) * 4 + Math.min(16, details) * 1.5 + Math.min(4, links) * 1.5 + Math.min(10, Math.sqrt(words));
  if (['skills', 'contact', 'links'].includes(type)) score = Math.min(score, 48);
  if (['profile', 'summary', 'about'].includes(type)) score = Math.min(score, 40);
  return Math.max(12, Math.min(100, Math.round(score)));
}

export function sizeForImportance(importance) {
  if (!Number.isFinite(importance)) throw new Error('Building importance must be a finite number.');
  if (importance < 35) return { width: 48, height: 64 };
  if (importance < 55) return { width: 64, height: 64 };
  if (importance < 75) return { width: 80, height: 80 };
  return { width: 96, height: 96 };
}

function locationsFromResume(resume, seed) {
  if (!resume || typeof resume !== 'object' || Array.isArray(resume)) throw new Error('World generation requires a normalized résumé object.');
  const sourceSections = Array.isArray(resume.sections) ? resume.sections : [];
  const sections = sourceSections.filter((section) => section && Array.isArray(section.entries) && section.entries.some(hasEntryContent));
  const seenSections = new Set();
  const seenRecords = new Set();
  for (const section of sections) {
    if (!cleanString(section.id)) throw new Error('Every résumé section needs a stable identifier before world generation.');
    if (seenSections.has(section.id)) throw new Error(`Duplicate résumé section identifier: ${section.id}.`);
    seenSections.add(section.id);
    for (const entry of section.entries) {
      if (!cleanString(entry.id)) throw new Error(`Every record in ${section.label || section.id} needs a stable identifier.`);
      if (seenRecords.has(entry.id)) throw new Error(`Duplicate résumé record identifier: ${entry.id}.`);
      seenRecords.add(entry.id);
    }
  }
  const types = new Set(sections.map((section) => section.type?.toLowerCase()));
  if (![...types].some((type) => ['about', 'profile', 'summary'].includes(type)) && [resume.name, resume.title, resume.summary].some(cleanString)) {
    sections.unshift({ id: '__about', label: 'About', type: 'about', entries: [{ id: '__profile', title: resume.name, subtitle: resume.title, details: [resume.summary].filter(Boolean) }] });
  }
  if (![...types].some((type) => ['contact', 'links'].includes(type)) && (Object.values(resume.contact || {}).some(cleanString) || resume.links?.length)) {
    sections.push({ id: '__contact', label: 'Contact', type: 'contact', entries: [{ id: '__contact-details', title: 'Contact', details: Object.values(resume.contact || {}).filter(cleanString), links: resume.links || [] }] });
  }
  if (!sections.length) throw new Error('No meaningful résumé content found. Check PDF extraction and section parsing before generating a world.');
  return sections.map((section, i) => {
    const importance = scoreSection(section);
    return {
      id: `location-${section.id}`,
      vertex: i + 1,
      label: cleanString(section.label) || cleanString(section.type) || 'Résumé section',
      sectionId: section.id,
      type: cleanString(section.type) || 'other',
      buildingType: 'house',
      importance,
      size: sizeForImportance(importance),
      x: 0,
      y: 0,
      entrance: { x: 0, y: 0 },
      recordIds: section.id.startsWith('__') ? [] : section.entries.filter(hasEntryContent).map((entry) => entry.id),
      variation: hashString(`${seed}:${section.id}`) % 4,
    };
  });
}

function defaultSequence(locations, random) {
  const weights = locations.map((location) => location.importance + 35);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return Array.from({ length: Math.max(0, locations.length - 2) }, () => {
    let point = random() * total;
    for (let i = 0; i < weights.length; i++) {
      point -= weights[i];
      if (point < 0) return i + 1;
    }
    return locations.length;
  });
}

function simplifyPoints(points) {
  const result = [];
  for (const point of points) {
    const last = result.at(-1);
    if (!last || last.x !== point.x || last.y !== point.y) result.push(point);
  }
  // Preserve junctions, but remove redundant collinear points for efficient drawing.
  for (let i = result.length - 2; i > 0; i--) {
    const a = result[i - 1], b = result[i], c = result[i + 1];
    if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) result.splice(i, 1);
  }
  return result;
}

/**
 * Ordered-subtree embedding. Each subtree owns a disjoint horizontal interval.
 * Roads join at a courtyard below the house, then follow the child's reserved
 * left corridor. This gives a planar orthogonal drawing without roads crossing
 * houses or roads joining unrelated branches. A chain receives a small zigzag.
 */
function layoutTree(locations, edges, seed) {
  const n = locations.length;
  const adjacency = Array.from({ length: n + 1 }, () => []);
  for (const { from, to } of edges) {
    adjacency[from].push(to);
    adjacency[to].push(from);
  }
  adjacency.forEach((list) => list.sort((a, b) => a - b));
  const root = locations.find((location) => ['about', 'profile', 'summary'].includes(location.type)) || locations.reduce((best, location) => location.importance > best.importance ? location : best, locations[0]);
  const children = Array.from({ length: n + 1 }, () => []);
  const parent = Array(n + 1).fill(0);
  const depth = Array(n + 1).fill(0);
  const order = [root.vertex];
  for (let i = 0; i < order.length; i++) {
    const vertex = order[i];
    for (const neighbor of adjacency[vertex]) if (neighbor !== parent[vertex]) {
      parent[neighbor] = vertex;
      depth[neighbor] = depth[vertex] + 1;
      children[vertex].push(neighbor);
      order.push(neighbor);
    }
  }
  const span = Array(n + 1).fill(NODE_SPAN);
  for (const vertex of [...order].reverse()) {
    if (children[vertex].length) span[vertex] = children[vertex].reduce((sum, child) => sum + span[child], 0);
  }
  const left = Array(n + 1).fill(OUTER_MARGIN);
  const gate = Array(n + 1).fill(0);
  for (const vertex of order) {
    let cursor = left[vertex];
    for (const child of children[vertex]) {
      left[child] = cursor;
      cursor += span[child];
    }
    const location = locations[vertex - 1];
    const offset = (hashString(`${seed}:position:${location.id}`) % 5 - 2) * TILE;
    const center = left[vertex] + span[vertex] / 2 + offset;
    location.x = center - location.size.width / 2;
    location.y = OUTER_MARGIN + depth[vertex] * LEVEL_SPAN;
    location.entrance = { x: center, y: location.y + location.size.height + TILE };
    gate[vertex] = location.y + GATE_OFFSET;
  }
  const paths = edges.map(({ from, to }) => {
    const child = parent[to] === from ? to : from;
    const ancestor = parent[child];
    const a = locations[ancestor - 1].entrance;
    const b = locations[child - 1].entrance;
    const corridor = left[child] + 32;
    let points = simplifyPoints([a, { x: a.x, y: gate[ancestor] }, { x: corridor, y: gate[ancestor] }, { x: corridor, y: gate[child] }, { x: b.x, y: gate[child] }, b]);
    if (ancestor !== from) points = points.reverse();
    return { from, to, points };
  });
  const maxDepth = Math.max(...depth);
  return {
    paths,
    bounds: { width: span[root.vertex] + OUTER_MARGIN * 2, height: OUTER_MARGIN * 2 + maxDepth * LEVEL_SPAN + GATE_OFFSET },
    spawn: { x: root.entrance.x, y: root.entrance.y + 20 },
  };
}

export function distanceToSegment(point, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const ratio = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
  return Math.hypot(point.x - a.x - ratio * dx, point.y - a.y - ratio * dy);
}

function decorateWorld(locations, paths, bounds, spawn, random) {
  const decorations = [];
  const kinds = ['tree', 'tree', 'bush', 'flowers', 'flowers', 'rock'];
  const grid = 48;
  const candidates = Math.ceil(bounds.width / grid) * Math.ceil(bounds.height / grid);
  // Sample a bounded count even for a résumé with a very large number of sections.
  const chance = Math.min(0.32, 500 / candidates);
  for (let y = 48; y < bounds.height - 48; y += grid) for (let x = 48; x < bounds.width - 48; x += grid) {
    if (random() > chance) continue;
    const point = { x: x + (Math.floor(random() * 3) - 1) * 8, y: y + (Math.floor(random() * 3) - 1) * 8 };
    if (Math.hypot(point.x - spawn.x, point.y - spawn.y) < 64) continue;
    if (locations.some((location) => point.x >= location.x - 48 && point.x <= location.x + location.size.width + 48 && point.y >= location.y - 48 && point.y <= location.entrance.y + 48)) continue;
    if (paths.some((path) => path.points.slice(1).some((end, i) => distanceToSegment(point, path.points[i], end) < 44))) continue;
    decorations.push({ ...point, kind: kinds[Math.floor(random() * kinds.length)], variant: Math.floor(random() * 4) });
  }
  return decorations;
}

/** Generate the exact same static model at build time and after a visitor edits the code. */
export function generateWorld(resume, selectedSequence) {
  const content = { generationVersion: GENERATION_VERSION, name: resume?.name, title: resume?.title, summary: resume?.summary, contact: resume?.contact, links: resume?.links, sections: resume?.sections };
  const seed = hashString(stableStringify(content));
  const locations = locationsFromResume(resume, seed);
  if (selectedSequence !== undefined) validateSequence(selectedSequence, locations.length);
  const sequence = selectedSequence === undefined ? defaultSequence(locations, seededRandom(seed)) : [...selectedSequence];
  const edges = decodePrufer(sequence, locations.length);
  const { paths, bounds, spawn } = layoutTree(locations, edges, seed);
  const decorations = decorateWorld(locations, paths, bounds, spawn, seededRandom(hashString(`${seed}:decorations:${sequence.join(',')}`)));
  return { schemaVersion: GENERATION_VERSION, seed, sequence, locations, edges, paths, bounds, spawn, decorations };
}
