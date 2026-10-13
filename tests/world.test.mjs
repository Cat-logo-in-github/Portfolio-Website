import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePrufer, encodePrufer, parseSequence, generateWorld, scoreSection, sizeForImportance, distanceToSegment } from '../src/core/world.mjs';

function sequences(n) {
  const length = Math.max(0, n - 2);
  const result = [];
  function walk(prefix) {
    if (prefix.length === length) { result.push(prefix); return; }
    for (let value = 1; value <= n; value++) walk([...prefix, value]);
  }
  walk([]);
  return result;
}

function fixture(n = 5) {
  return {
    schemaVersion: 1,
    sourceHash: 'source-digest',
    sections: Array.from({ length: n }, (_, i) => ({
      id: `section-${i + 1}`, type: i % 2 ? 'projects' : 'experience', label: `Section ${i + 1}`,
      entries: [{ id: `record-${i + 1}`, title: `Real record ${i + 1}`, details: ['A documented accomplishment.'], links: [] }],
    })),
  };
}

function assertTree(edges, n) {
  assert.equal(edges.length, Math.max(0, n - 1));
  if (!n) return;
  const neighbors = Array.from({ length: n + 1 }, () => []);
  const seenEdges = new Set();
  for (const { from, to } of edges) {
    assert.notEqual(from, to);
    assert.ok(from >= 1 && from <= n && to >= 1 && to <= n);
    const key = [from, to].sort((a, b) => a - b).join('-');
    assert.ok(!seenEdges.has(key));
    seenEdges.add(key);
    neighbors[from].push(to); neighbors[to].push(from);
  }
  const seen = new Set([1]), queue = [1];
  for (const vertex of queue) for (const neighbor of neighbors[vertex]) {
    if (!seen.has(neighbor)) { seen.add(neighbor); queue.push(neighbor); }
  }
  assert.equal(seen.size, n, 'Every location must be reachable.');
}

function segmentsIntersect(a, b, c, d) {
  const overlap = (a1, a2, b1, b2) => Math.max(Math.min(a1, a2), Math.min(b1, b2)) <= Math.min(Math.max(a1, a2), Math.max(b1, b2));
  if (a.x === b.x && c.x === d.x) return a.x === c.x && overlap(a.y, b.y, c.y, d.y);
  if (a.y === b.y && c.y === d.y) return a.y === c.y && overlap(a.x, b.x, c.x, d.x);
  const vertical = a.x === b.x ? [a, b] : [c, d];
  const horizontal = a.x === b.x ? [c, d] : [a, b];
  return overlap(vertical[0].x, vertical[0].x, horizontal[0].x, horizontal[1].x) && overlap(horizontal[0].y, horizontal[0].y, vertical[0].y, vertical[1].y);
}

function roadHitsHouse(a, b, location, radius = 12) {
  const l = location.x - radius, r = location.x + location.size.width + radius;
  const t = location.y - radius, bottom = location.y + location.size.height + radius;
  if (a.x === b.x) return a.x > l && a.x < r && Math.max(Math.min(a.y, b.y), t) < Math.min(Math.max(a.y, b.y), bottom);
  return a.y > t && a.y < bottom && Math.max(Math.min(a.x, b.x), l) < Math.min(Math.max(a.x, b.x), r);
}

function assertWorldGeometry(world) {
  assertTree(world.edges, world.locations.length);
  assert.equal(world.paths.length, world.edges.length);
  for (const location of world.locations) {
    assert.equal(location.buildingType, 'house');
    assert.ok(location.x >= 0 && location.y >= 0);
    assert.ok(location.x + location.size.width <= world.bounds.width);
    assert.ok(location.entrance.y < world.bounds.height);
    for (const other of world.locations) if (other.vertex > location.vertex) {
      const overlapX = Math.max(location.x, other.x) < Math.min(location.x + location.size.width, other.x + other.size.width);
      const overlapY = Math.max(location.y, other.y) < Math.min(location.y + location.size.height, other.y + other.size.height);
      assert.ok(!(overlapX && overlapY), 'Buildings must not overlap.');
    }
  }
  for (const [index, path] of world.paths.entries()) {
    assert.deepEqual({ from: path.from, to: path.to }, world.edges[index]);
    assert.deepEqual(path.points[0], world.locations[path.from - 1].entrance);
    assert.deepEqual(path.points.at(-1), world.locations[path.to - 1].entrance);
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1], b = path.points[i];
      assert.ok(a.x === b.x || a.y === b.y, 'Roads have orthogonal traversable segments.');
      assert.ok(b.x >= 0 && b.y >= 0 && b.x <= world.bounds.width && b.y <= world.bounds.height);
      for (const location of world.locations) assert.ok(!roadHitsHouse(a, b, location), 'A road must not cross a building, including its walking clearance.');
    }
    for (const other of world.paths.slice(index + 1)) {
      if ([path.from, path.to].some((vertex) => [other.from, other.to].includes(vertex))) continue;
      for (let i = 1; i < path.points.length; i++) for (let j = 1; j < other.points.length; j++) {
        assert.ok(!segmentsIntersect(path.points[i - 1], path.points[i], other.points[j - 1], other.points[j]), 'Roads for unrelated graph edges must not cross or touch.');
      }
    }
  }
  for (const decoration of world.decorations) {
    assert.ok(decoration.x > 0 && decoration.y > 0 && decoration.x < world.bounds.width && decoration.y < world.bounds.height);
    for (const path of world.paths) for (let i = 1; i < path.points.length; i++) {
      assert.ok(distanceToSegment(decoration, path.points[i - 1], path.points[i]) >= 44, 'Decoration must preserve road clearance.');
    }
    for (const location of world.locations) {
      assert.ok(Math.hypot(decoration.x - location.entrance.x, decoration.y - location.entrance.y) > 44, 'Decoration must preserve interaction zones.');
    }
  }
}

test('Prüfer encoder/decoder round-trip every sequence for 0 through 6 vertices', () => {
  for (let n = 0; n <= 6; n++) for (const sequence of sequences(n)) {
    const edges = decodePrufer(sequence, n);
    assertTree(edges, n);
    assert.deepEqual(encodePrufer(edges, n), sequence);
  }
});

test('known labeled tree uses the standard smallest-leaf convention', () => {
  assert.deepEqual(decodePrufer([4, 4, 4, 5], 6), [{ from: 1, to: 4 }, { from: 2, to: 4 }, { from: 3, to: 4 }, { from: 4, to: 5 }, { from: 5, to: 6 }]);
  assert.deepEqual(decodePrufer([], 0), []);
  assert.deepEqual(decodePrufer([], 1), []);
  assert.deepEqual(decodePrufer([], 2), [{ from: 1, to: 2 }]);
});

test('sequence parser gives helpful errors and accepts accessible input forms', () => {
  assert.deepEqual(parseSequence(' 2, 2, 4, 1 ', 6), [2, 2, 4, 1]);
  assert.deepEqual(parseSequence('[2 2\n4 1]', 6), [2, 2, 4, 1]);
  assert.deepEqual(parseSequence('', 1), []);
  assert.deepEqual(parseSequence('', 2), []);
  for (const value of ['2, 2', '2,2,4,7', '2,2,4,0', '2,2,4,-1', '2,2,4,1.5', '2,,4,1', '2,2,4,1e0', '2,2,4,Infinity']) assert.throws(() => parseSequence(value, 6), /exactly|vertex label|empty value/);
  for (const sequence of [[1], [3], [0], [-1], [1.5], [NaN]]) assert.throws(() => decodePrufer(sequence, 2));
  assert.throws(() => decodePrufer([1, 0], 4), /1 to 4/);
  assert.throws(() => decodePrufer([], -1), /non-negative integer/);
  assert.throws(() => decodePrufer([], 2.5), /non-negative integer/);
});

test('encoder rejects invalid relationships instead of producing misleading codes', () => {
  assert.throws(() => encodePrufer([{ from: 1, to: 1 }], 2), /self-loops/);
  assert.throws(() => encodePrufer([{ from: 1, to: 2 }, { from: 2, to: 1 }], 3), /duplicates/);
  assert.throws(() => encodePrufer([{ from: 1, to: 2 }, { from: 2, to: 3 }, { from: 3, to: 1 }], 4), /cycle/);
  assert.throws(() => encodePrufer([{ from: 1, to: 4 }], 2), /endpoint/);
  assert.throws(() => encodePrufer([], 3), /exactly 2 edges/);
});

test('content and accomplishment counts determine bounded house sizes', () => {
  const modest = { type: 'experience', entries: [{ title: 'One role', details: [] }] };
  const substantial = { type: 'experience', entries: Array.from({ length: 10 }, () => ({ title: 'Documented role', details: ['A', 'B', 'C'] })) };
  const verbose = { type: 'about', entries: [{ title: 'Profile', details: ['Word '.repeat(20000)] }] };
  assert.ok(scoreSection(substantial) > scoreSection(modest));
  assert.ok(sizeForImportance(scoreSection(substantial)).width > sizeForImportance(scoreSection(modest)).width);
  assert.ok(scoreSection(substantial) <= 100 && scoreSection(verbose) <= 40);
  assert.ok(scoreSection({ ...substantial, type: 'skills' }) <= 48);
  for (const score of [-10, 12, 34, 35, 54, 55, 74, 75, 100, 10000]) {
    const size = sizeForImportance(score);
    assert.ok(size.width >= 48 && size.width <= 96 && size.height >= 64 && size.height <= 96);
    assert.equal(size.width % 16, 0); assert.equal(size.height % 16, 0);
  }
  assert.throws(() => sizeForImportance(Infinity), /finite number/);
});

test('default generation is repeatable and derives its seed from normalized content', () => {
  const resume = fixture(7);
  const a = generateWorld(resume), b = generateWorld(structuredClone(resume));
  assert.deepEqual(a, b);
  assert.deepEqual(a, generateWorld({ ...resume, sourceHash: 'different PDF encoding', sourceText: 'Whitespace differs.' }));
  const changed = structuredClone(resume);
  changed.sections[0].entries[0].details.push('Another real accomplishment.');
  assert.notEqual(generateWorld(changed).seed, a.seed);
  assert.deepEqual(resume, fixture(7), 'Generation must not mutate the source résumé.');
});

test('custom codes change topology and spatial layout while keeping résumé references', () => {
  const resume = fixture(5);
  const a = generateWorld(resume, [1, 1, 1]), b = generateWorld(resume, [2, 3, 4]);
  assert.notDeepEqual(a.edges, b.edges);
  assert.notDeepEqual(a.locations.map(({ x, y }) => ({ x, y })), b.locations.map(({ x, y }) => ({ x, y })));
  assert.deepEqual(a.locations.map(({ sectionId, recordIds }) => ({ sectionId, recordIds })), b.locations.map(({ sectionId, recordIds }) => ({ sectionId, recordIds })));
  assert.throws(() => generateWorld(resume, [1, 1]), /exactly 3/);
  assert.throws(() => generateWorld(resume, 123), /array of vertex labels/);
});

test('location generation handles missing sections, new sections, and real about/contact fields', () => {
  assert.equal(generateWorld(fixture(1)).locations.length, 1);
  assert.equal(generateWorld(fixture(2)).locations.length, 2);
  const resume = fixture(3);
  const initialIds = generateWorld(resume).locations.map((location) => location.id);
  resume.sections.push({ id: 'awards', type: 'awards', label: 'Awards', entries: [{ id: 'award-1', title: 'Recorded award', details: [] }] });
  const added = generateWorld(resume);
  assert.equal(added.locations.length, 4);
  assert.deepEqual(added.locations.slice(0, 3).map((location) => location.id), initialIds);
  resume.sections.splice(1, 1);
  assert.equal(generateWorld(resume).locations.length, 3);
  const personal = generateWorld({ name: 'Actual Name', title: 'Actual Role', contact: { email: 'real@example.com' }, sections: [] });
  assert.deepEqual(personal.locations.map((location) => location.sectionId), ['__about', '__contact']);
  assert.throws(() => generateWorld({ sections: [] }), /No meaningful résumé content/);
  assert.throws(() => generateWorld({ sections: [{ type: 'projects', entries: [{ id: 'record', title: 'Project' }] }] }), /stable identifier/);
  assert.throws(() => generateWorld({ sections: [...fixture(1).sections, ...fixture(1).sections] }), /Duplicate résumé section/);
});

test('all labeled trees through five vertices have bounded, non-overlapping, unambiguous walkable routes', () => {
  for (let n = 1; n <= 5; n++) for (const sequence of sequences(n)) assertWorldGeometry(generateWorld(fixture(n), sequence));
});

test('larger stars and chains remain walkable with bounded deterministic decoration', () => {
  for (const n of [12, 25]) {
    const resume = fixture(n);
    const star = generateWorld(resume, Array(n - 2).fill(1));
    const chain = generateWorld(resume, Array.from({ length: n - 2 }, (_, i) => i + 2));
    assertWorldGeometry(star); assertWorldGeometry(chain);
    assert.ok(new Set(chain.locations.map((location) => location.x)).size > 1, 'A long chain should not become a single straight building line.');
    assert.ok(star.decorations.length < 800 && chain.decorations.length < 800);
  }
});

test('mixed maximum-size houses and a non-first profile root preserve corridor clearance', () => {
  const resume = fixture(8);
  resume.sections.forEach((section, i) => {
    section.entries = Array.from({ length: 12 }, (_, j) => ({ id: `record-${i}-${j}`, title: 'A substantial documented role', details: ['Accomplishment one', 'Accomplishment two', 'Accomplishment three'], links: [] }));
  });
  resume.sections[5].type = 'profile';
  for (const sequence of [[1, 1, 1, 1, 1, 1], [2, 3, 4, 5, 6, 7], [8, 6, 3, 6, 3, 8]]) {
    const world = generateWorld(resume, sequence);
    assertWorldGeometry(world);
    assert.equal(world.locations[0].size.width, 96);
    assert.equal(world.spawn.x, world.locations[5].entrance.x);
  }
});
