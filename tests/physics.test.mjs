import test from "node:test";
import assert from "node:assert/strict";
import { sourceResume } from "./helpers/resume.mjs";
import {
  movementVector,
  canStand,
  movePlayer,
  nearestLocation,
  nearestObject,
  hasLineOfSight,
} from "../src/game/physics.mjs";

import { generateWorld, hashString, seededRandom } from "../src/core/world.mjs";
import {
  generateInterior,
  defaultInteriorConfig,
} from "../src/core/interior.mjs";
import { villageScene } from "../src/core/village.mjs";

const world = {
  bounds: { width: 500, height: 400 },
  locations: [
    {
      id: "home",
      x: 80,
      y: 80,
      size: { width: 64, height: 48 },
      entrance: { x: 112, y: 150 },
    },
  ],
};
test("diagonal movement has equal speed and neutral input stops", () => {
  assert.ok(
    Math.abs(Math.hypot(...Object.values(movementVector(1, 1, 100, 1))) - 100) <
      1e-10,
  );
  assert.deepEqual(movementVector(0, 0, 100, 1), { x: 0, y: 0 });
});
test("foot collision rejects buildings and world bounds; entrance is accessible", () => {
  assert.equal(canStand({ x: 100, y: 100 }, world), false);
  assert.equal(canStand({ x: 112, y: 150 }, world), true);
  assert.equal(canStand({ x: 1, y: 1 }, world), false);
});
test("large deltas cannot tunnel through a building", () => {
  const result = movePlayer({ x: 50, y: 100 }, { x: 160, y: 0 }, world);
  assert.ok(result.x <= 75);
});
test("axis resolution permits sliding past walls", () => {
  const result = movePlayer({ x: 74, y: 100 }, { x: 8, y: 10 }, world);
  assert.ok(result.x < 80);
  assert.ok(Math.abs(result.y - 110) < 1e-10);
});
test("interaction range selects nearest entrance and excludes distant houses", () => {
  assert.equal(nearestLocation({ x: 112, y: 150 }, world).id, "home");
  assert.equal(nearestLocation({ x: 450, y: 350 }, world), null);
});

const prop = (id, x, y, options = {}) => ({
  id,
  x,
  y,
  width: 16,
  height: 16,
  solid: true,
  range: 40,
  interactAt: { x: x + 8, y: y + 24 },
  actions: [{ id: "inspect", kind: "inspect" }],
  ...options,
});
const interior = (floor, objects = []) => ({
  kind: "interior",
  bounds: { width: 160, height: 160 },
  floor,
  objects,
});
const rectangleFloor = (x, y, width, height) =>
  Array.from({ length: height }, (_, j) =>
    Array.from({ length: width }, (_, i) => `${x + i},${y + j}`),
  ).flat();

test("visible trees, rocks, bushes and solid interactable props block movement; flowers stay walkable", () => {
  const map = {
    bounds: { width: 300, height: 200 },
    decorations: [
      { x: 40, y: 40, kind: "tree" },
      { x: 80, y: 40, kind: "rock" },
      { x: 120, y: 40, kind: "bush" },
      { x: 160, y: 40, kind: "flowers" },
    ],
    objects: [prop("well", 200, 32)],
  };
  for (const x of [40, 80, 120, 208])
    assert.equal(canStand({ x, y: 40 }, map), false);
  assert.equal(canStand({ x: 160, y: 40 }, map), true);
  assert.equal(
    canStand({ x: 20, y: 40 }, map),
    false,
    "the entire visible 32px tree is solid",
  );
  assert.equal(canStand({ x: 18, y: 40 }, map), true);
  const moved = movePlayer({ x: 20, y: 70 }, { x: 150, y: -30 }, map);
  assert.equal(
    canStand(moved, map),
    true,
    "large diagonal movement cannot enter a prop",
  );
});

test("interior movement stays on floor and cannot clip corners or furniture", () => {
  const map = interior(rectangleFloor(1, 1, 6, 6), [prop("bookshelf", 48, 48)]);
  assert.equal(canStand({ x: 24, y: 24 }, map), true);
  assert.equal(
    canStand({ x: 18, y: 24 }, map),
    false,
    "foot circle overlaps the west wall",
  );
  assert.equal(canStand({ x: 56, y: 56 }, map), false, "shelves are solid");
  assert.equal(
    canStand({ x: 8, y: 8 }, map),
    false,
    "void outside the floor is impassable",
  );
  const moved = movePlayer({ x: 24, y: 56 }, { x: 110, y: 0 }, map);
  assert.ok(moved.x <= 43);
  const missingCorner = interior(["1,1", "2,1", "1,2"]);
  assert.equal(
    canStand({ x: 30, y: 30 }, missingCorner),
    false,
    "circle collides with a diagonal wall corner",
  );
});

test("line of sight stops interactions through walls and furniture", () => {
  const floor = [...rectangleFloor(1, 1, 2, 5), ...rectangleFloor(4, 1, 2, 5)];
  const target = prop("shelf", 64, 16, {
    interactAt: { x: 72, y: 40 },
    range: 80,
  });
  const map = interior(floor, [target]);
  assert.equal(hasLineOfSight({ x: 24, y: 40 }, target.interactAt, map), false);
  assert.equal(nearestObject({ x: 24, y: 40 }, map), null);
  assert.equal(nearestObject({ x: 72, y: 56 }, map)?.id, "shelf");
  const open = interior(rectangleFloor(1, 1, 7, 7), [
    target,
    prop("cabinet", 48, 32, { actions: [] }),
  ]);
  assert.equal(
    nearestObject({ x: 24, y: 40 }, open),
    null,
    "a solid cabinet blocks the interaction ray",
  );
});

test("nearest object respects object-specific range and excludes decoration with no actions", () => {
  const readable = prop("book", 48, 48, { range: 20 });
  const map = interior(rectangleFloor(1, 1, 7, 7), [
    readable,
    prop("decor", 64, 64, { actions: [] }),
  ]);
  assert.equal(nearestObject({ x: 56, y: 72 }, map)?.id, "book");
  assert.equal(nearestObject({ x: 24, y: 72 }, map), null);
  assert.deepEqual(
    movePlayer({ x: 24, y: 24 }, { x: Number.NaN, y: 20 }, map),
    { x: 24, y: 24 },
  );
});

test("floor fallback accepts the generator’s world-pixel tile coordinates", () => {
  const map = {
    kind: "interior",
    bounds: { width: 128, height: 128 },
    tiles: [
      { x: 32, y: 32, kind: "floor" },
      { x: 48, y: 32, kind: "door" },
      { x: 32, y: 48, kind: "wall" },
    ],
    objects: [],
  };
  assert.equal(canStand({ x: 40, y: 40 }, map), true);
  assert.equal(canStand({ x: 56, y: 40 }, map), true);
  assert.equal(canStand({ x: 40, y: 56 }, map), false);
});

test("generated interiors remain reachable under the actual foot-circle movement and interaction rules", () => {
  const resume = {
    sourceHash: "collision-fixture",
    sections: ["education", "projects", "content", "awards"].map((type, i) => ({
      id: type,
      type,
      label: type,
      entries: Array.from({ length: 3 }, (_, j) => ({
        id: `${type}-${j}`,
        title: `${type} record ${j}`,
        details: ["Documented accomplishment."],
      })),
    })),
  };
  const world = generateWorld(resume);
  for (const location of world.locations)
    for (const nodeCount of [2, 5]) {
      const config = {
        ...defaultInteriorConfig(resume, location),
        nodeCount,
        sequence: nodeCount === 2 ? [] : [1, 3, 3],
      };
      const map = generateInterior(resume, location, config),
        floor = new Set(map.floor);
      const start = `${Math.floor(map.spawn.x / 16)},${Math.floor(map.spawn.y / 16)}`,
        reached = new Set([start]),
        queue = [start];
      assert.equal(canStand(map.spawn, map), true, `${location.label} spawn`);
      for (let i = 0; i < queue.length; i++) {
        const [x, y] = queue[i].split(",").map(Number),
          from = { x: x * 16 + 8, y: y * 16 + 8 };
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const next = `${x + dx},${y + dy}`;
          if (reached.has(next) || !floor.has(next)) continue;
          const destination = { x: (x + dx) * 16 + 8, y: (y + dy) * 16 + 8 };
          if (!canStand(destination, map)) continue;
          const moved = movePlayer(from, { x: dx * 16, y: dy * 16 }, map);
          if (
            Math.abs(moved.x - destination.x) > 1e-6 ||
            Math.abs(moved.y - destination.y) > 1e-6
          )
            continue;
          reached.add(next);
          queue.push(next);
        }
      }
      for (const object of map.objects) {
        assert.equal(
          canStand(object.interactAt, map),
          true,
          `${object.label} usable side`,
        );
        assert.ok(
          reached.has(
            `${Math.floor(object.interactAt.x / 16)},${Math.floor(object.interactAt.y / 16)}`,
          ),
          `${object.label} route`,
        );
        assert.equal(
          nearestObject(object.interactAt, map)?.id,
          object.id,
          `${object.label} selection`,
        );
        if (object.solid)
          assert.equal(
            canStand(
              {
                x: object.x + object.width / 2,
                y: object.y + object.height / 2,
              },
              map,
            ),
            false,
          );
      }
    }
});

test("custom village codes reserve every prop’s usable side and keep the roads walkable", () => {
  const resume = sourceResume();
  const n = generateWorld(resume).locations.length;
  for (let i = 0; i < 40; i++) {
    const random = seededRandom(hashString(`collision-village-${i}`));
    const sequence =
      i === 0
        ? undefined
        : i === 1
          ? Array(n - 2).fill(1)
          : i === 2
            ? Array(n - 2).fill(n)
            : Array.from({ length: n - 2 }, () => 1 + Math.floor(random() * n));
    const map = villageScene(
      generateWorld(resume, sequence, {
        layoutSeed: `village-${i}`,
        decorationSeed: `trees-${i}`,
      }),
    );
    assert.equal(canStand(map.spawn, map), true);
    for (const object of map.objects) {
      assert.equal(
        canStand(object.interactAt, map),
        true,
        `seed ${i}: ${object.id} usable side`,
      );
      assert.equal(
        nearestObject(object.interactAt, map)?.id,
        object.id,
        `seed ${i}: ${object.id} selection`,
      );
      if (object.solid)
        assert.equal(
          canStand(
            { x: object.x + object.width / 2, y: object.y + object.height / 2 },
            map,
          ),
          false,
        );
    }
    for (const path of map.paths)
      for (let segment = 1; segment < path.points.length; segment++) {
        const from = path.points[segment - 1],
          to = path.points[segment],
          steps = Math.max(
            1,
            Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 8),
          );
        for (let step = 0; step <= steps; step++) {
          const point = {
            x: from.x + ((to.x - from.x) * step) / steps,
            y: from.y + ((to.y - from.y) * step) / steps,
          };
          assert.equal(
            canStand(point, map),
            true,
            `seed ${i}: road ${path.from}-${path.to}`,
          );
        }
      }
  }
});
