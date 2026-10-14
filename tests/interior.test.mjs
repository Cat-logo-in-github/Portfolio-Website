import test from "node:test";
import assert from "node:assert/strict";
import { sourceResume } from "./helpers/resume.mjs";
import { generateWorld, encodePrufer } from "../src/core/world.mjs";
import {
  archetypeFor,
  randomSequence,
  defaultInteriorConfig,
  validateInteriorConfig,
  generateInterior,
  validateInterior,
} from "../src/core/interior.mjs";
import { canStand, movePlayer, nearestObject } from "../src/game/physics.mjs";

function fixture(type = "projects", count = 3) {
  const entries = Array.from({ length: count }, (_, i) => ({
    id: `record-${i}`,
    title: `${type} record ${i}`,
    details: ["A genuine documented detail."],
    links: [],
  }));
  const resume = {
    name: "Real Person",
    sections: [{ id: "test-section", label: "Test section", type, entries }],
  };
  const location = {
    id: "location-test-section",
    sectionId: "test-section",
    label: "Test section",
    type,
    recordIds: entries.map((entry) => entry.id),
  };
  return { resume, location };
}

function configuration(
  resume,
  location,
  nodeCount,
  sequence,
  archetype = archetypeFor(location),
  layoutSeed = "layout-A",
  decorationSeed = "props-A",
) {
  return {
    ...defaultInteriorConfig(resume, location),
    archetype,
    nodeCount,
    sequence,
    layoutSeed,
    decorationSeed,
  };
}

function sequences(n) {
  const result = [];
  function walk(prefix) {
    if (prefix.length === n - 2) result.push(prefix);
    else for (let value = 1; value <= n; value++) walk([...prefix, value]);
  }
  walk([]);
  return result;
}

test("default archetypes derive from actual professional section purposes", () => {
  assert.equal(archetypeFor({ type: "profile" }), "home");
  assert.equal(archetypeFor({ type: "education" }), "library");
  assert.equal(archetypeFor({ type: "research" }), "library");
  assert.equal(archetypeFor({ type: "projects" }), "workshop");
  assert.equal(
    archetypeFor({ type: "skills", label: "Creative Skills" }),
    "studio",
  );
  assert.equal(archetypeFor({ type: "content" }), "studio");
});

test("versioned imported configs reject malformed values instead of changing topology", () => {
  const { resume, location } = fixture();
  const config = defaultInteriorConfig(resume, location);
  assert.deepEqual(
    validateInteriorConfig(JSON.parse(JSON.stringify(config)), location),
    config,
  );
  for (const mutation of [
    { algorithmVersion: 1 },
    { scope: "overworld" },
    { buildingId: "another-building" },
    { archetype: "castle" },
    { nodeCount: 1 },
    { nodeCount: 11 },
    { nodeCount: 3.5 },
    { layoutSeed: 42 },
    { decorationSeed: "x".repeat(161) },
    { sequence: [0, 1] },
    { sequence: [1.1, 1] },
    { sequence: [] },
  ])
    assert.throws(() =>
      validateInteriorConfig({ ...config, ...mutation }, location),
    );
  const cloned = validateInteriorConfig(config);
  cloned.sequence[0] = 9;
  assert.notDeepEqual(cloned.sequence, config.sequence);
});

test("random topology generation is seeded and supports two-room empty sequences", () => {
  assert.deepEqual(randomSequence(2, "same"), []);
  for (let n = 3; n <= 10; n++) {
    const sequence = randomSequence(n, "same");
    assert.deepEqual(sequence, randomSequence(n, "same"));
    assert.equal(sequence.length, n - 2);
    assert.ok(sequence.every((value) => value >= 1 && value <= n));
  }
  assert.notDeepEqual(randomSequence(10, "one"), randomSequence(10, "two"));
  assert.throws(() => randomSequence(1), /2 to 10/);
});

test("every small labeled tree has exact physical connectivity and logical semantics in four archetypes", () => {
  const { resume, location } = fixture();
  for (const archetype of ["home", "library", "workshop", "studio"])
    for (let n = 2; n <= 5; n++)
      for (const sequence of sequences(n)) {
        const config = configuration(resume, location, n, sequence, archetype);
        const interior = generateInterior(resume, location, config);
        assert.equal(validateInterior(interior), true);
        assert.deepEqual(encodePrufer(interior.edges, n), sequence);
        assert.equal(interior.rooms.length, n);
        assert.equal(interior.paths.length, n - 1);
        const degree = Array(n + 1).fill(0);
        interior.edges.forEach(({ from, to }) => {
          degree[from]++;
          degree[to]++;
        });
        for (const room of interior.rooms)
          if (
            ["bedroom", "storage", "archive", "greenroom"].includes(room.role)
          )
            assert.equal(degree[room.vertex], 1);
        assert.ok(
          interior.objects.some(
            (object) =>
              object.actions.some((action) => action.kind === "exit") &&
              !object.solid,
          ),
        );
      }
});

test("large stars, chains and random seeds terminate with reachable objects and exits", () => {
  const { resume, location } = fixture("education", 7);
  for (let n = 2; n <= 10; n++)
    for (const seed of ["seed-0", "seed-1", "seed-2"])
      for (const sequence of [
        Array(n - 2).fill(1),
        Array.from({ length: n - 2 }, (_, i) => i + 2),
        randomSequence(n, seed),
      ]) {
        const interior = generateInterior(
          resume,
          location,
          configuration(resume, location, n, sequence, "library", seed),
        );
        assert.equal(validateInterior(interior), true);
        assert.ok(
          interior.bounds.width <= 8192 &&
            interior.bounds.height <= 8192 &&
            interior.floor.length <= 50000,
        );
        assert.equal(
          interior.objects.filter((object) => object.recordIds.length).length,
          7,
        );
      }
});

test("full configurations reproduce interiors while decoration changes leave topology and furniture intact", () => {
  const { resume, location } = fixture("projects", 5);
  const config = defaultInteriorConfig(resume, location);
  const a = generateInterior(resume, location, config);
  assert.deepEqual(
    a,
    generateInterior(
      structuredClone(resume),
      structuredClone(location),
      JSON.parse(JSON.stringify(config)),
    ),
  );
  const b = generateInterior(resume, location, {
    ...config,
    decorationSeed: "different-props",
  });
  for (const field of [
    "rooms",
    "sequence",
    "edges",
    "paths",
    "floor",
    "tiles",
    "bounds",
    "spawn",
    "exit",
  ])
    assert.deepEqual(a[field], b[field]);
  assert.deepEqual(
    a.objects.filter((object) => object.recordIds.length),
    b.objects.filter((object) => object.recordIds.length),
  );
  assert.notDeepEqual(
    a.objects.filter((object) => object.id.includes(":furniture:")),
    b.objects.filter((object) => object.id.includes(":furniture:")),
  );
  const c = generateInterior(resume, location, {
    ...config,
    layoutSeed: "another-arrangement",
  });
  assert.deepEqual(a.edges, c.edges);
  assert.notDeepEqual(a.rooms, c.rooms);
});

test("record object IDs survive room count, archetype, topology and decoration changes", () => {
  const { resume, location } = fixture("projects", 5);
  const a = generateInterior(resume, location);
  const b = generateInterior(
    resume,
    location,
    configuration(
      resume,
      location,
      8,
      [2, 3, 3, 5, 7, 7],
      "studio",
      "other-layout",
      "other-decoration",
    ),
  );
  const recordIds = (interior) =>
    interior.objects
      .filter((object) => object.recordIds.length)
      .map((object) => object.id)
      .sort();
  assert.deepEqual(recordIds(a), recordIds(b));
  assert.deepEqual(
    a.objects.flatMap((object) => object.recordIds).sort(),
    resume.sections[0].entries.map((entry) => entry.id).sort(),
  );
  for (const object of a.objects.filter((object) => object.recordIds.length)) {
    assert.equal(object.solid, true);
    assert.ok(object.actions.some((action) => action.kind === "inspect"));
    assert.ok(
      object.actions.some(
        (action) => action.kind === "discover" && action.once,
      ),
    );
  }
});

test("semantic record objects correspond to education, research, teaching, awards and projects", () => {
  for (const [type, title, expected, readLabel] of [
    ["education", "University degree", "bookshelf", "Read learning notes"],
    [
      "research",
      "Visibility graph paper",
      "researchdesk",
      "Read research notes",
    ],
    ["experience", "Teaching assistant", "lectern", "Read teaching notes"],
    ["awards", "Gold medal", "trophy", "Examine achievement"],
    ["projects", "Graph pipeline", "computer", "Open project notes"],
  ]) {
    const { resume, location } = fixture(type, 1);
    resume.sections[0].entries[0].title = title;
    const object = generateInterior(resume, location).objects.find(
      (item) => item.recordIds.length,
    );
    assert.equal(object.type, expected);
    assert.equal(object.label, title);
    assert.ok(object.interactAt.y >= object.y + object.height);
    assert.equal(object.actions[0].kind, "inspect");
    assert.equal(
      object.actions[0].recordIds,
      undefined,
      "Inspection must not unlock a professional record.",
    );
    assert.equal(object.actions[1].kind, "discover");
    assert.equal(object.actions[1].label, readLabel);
    assert.equal(object.actions[1].once, true);
    assert.ok(
      object.actions[1].message.includes(title) &&
        object.actions[1].message.includes("A genuine documented detail."),
    );
  }
  const virtual = generateInterior(
    {
      name: "Actual Person",
      summary: "An actual source summary.",
      sections: [],
    },
    {
      id: "location-__about",
      sectionId: "__about",
      label: "About",
      type: "about",
    },
  );
  const profileObject = virtual.objects.find((object) =>
    object.id.includes(":record:"),
  );
  assert.ok(profileObject.actions.every((action) => action.kind === "inspect"));
  assert.ok(
    profileObject.actions[1].message.includes("An actual source summary."),
  );
});

test("validator catches unreachable exits, overlapping furniture and changed physical topology", () => {
  const { resume, location } = fixture();
  const initial = generateInterior(resume, location);
  const blockedExit = structuredClone(initial);
  blockedExit.exit = { x: 8, y: 8 };
  assert.throws(() => validateInterior(blockedExit), /exit/);
  const overlap = structuredClone(initial);
  const solids = overlap.objects.filter((object) => object.solid);
  solids[1].x = solids[0].x;
  solids[1].y = solids[0].y;
  assert.throws(() => validateInterior(overlap), /overlaps/);
  const changedCode = structuredClone(initial);
  changedCode.sequence[0] =
    (changedCode.sequence[0] % changedCode.rooms.length) + 1;
  assert.throws(() => validateInterior(changedCode), /topology/);
  const missingFloor = structuredClone(initial);
  missingFloor.floor = missingFloor.floor.filter(
    (tile) =>
      tile !==
      `${Math.floor(initial.spawn.x / 16)},${Math.floor(initial.spawn.y / 16)}`,
  );
  assert.throws(() => validateInterior(missingFloor), /floor/);
  const invalidBounds = structuredClone(initial);
  invalidBounds.bounds.width = NaN;
  assert.throws(() => validateInterior(invalidBounds), /bounds/);
});

test("bounded capacity fails clearly without silently dropping résumé records", () => {
  const { resume, location } = fixture("projects", 30);
  const config = configuration(resume, location, 2, []);
  assert.throws(
    () => generateInterior(resume, location, config),
    /Increase the room count/,
  );
  const tooMany = fixture("projects", 121);
  assert.throws(
    () => generateInterior(tooMany.resume, tooMany.location),
    /120-record/,
  );
  assert.throws(
    () => generateInterior(resume, { ...location, sectionId: "unknown" }),
    /unknown résumé section/,
  );
});

test("all actual résumé buildings generate interiors with one discoverable object per record", async () => {
  const resume = sourceResume();
  for (const location of generateWorld(resume).locations) {
    const interior = generateInterior(resume, location);
    assert.equal(validateInterior(interior), true);
    assert.deepEqual(
      interior.objects.flatMap((object) => object.recordIds).sort(),
      [...location.recordIds].sort(),
    );
    assert.equal(canStand(interior.spawn, interior), true);
    for (const object of interior.objects) {
      assert.equal(
        canStand(object.interactAt, interior),
        true,
        `Blocked usable side at ${object.id}.`,
      );
      assert.equal(
        nearestObject(object.interactAt, interior)?.id,
        object.id,
        `Ambiguous interaction at ${object.id}.`,
      );
    }
    for (const path of interior.paths) {
      let player = { ...path.points[0] };
      for (let i = 1; i < path.points.length; i++) {
        const a = path.points[i - 1],
          b = path.points[i],
          steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4);
        for (let step = 1; step <= steps; step++) {
          const target = {
            x: a.x + ((b.x - a.x) * step) / steps,
            y: a.y + ((b.y - a.y) * step) / steps,
          };
          player = movePlayer(
            player,
            { x: target.x - player.x, y: target.y - player.y },
            interior,
          );
          assert.ok(
            Math.hypot(player.x - target.x, player.y - target.y) < 1e-6,
            `Physical movement failed on ${location.label} corridor.`,
          );
        }
      }
    }
  }
});
