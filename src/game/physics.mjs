const TILE = 16;
const floors = new WeakMap();
const barriers = new WeakMap();

/** Normalize direction so diagonal travel is exactly as fast as axial travel. */
export function movementVector(x, y, speed, dt) {
  const length = Math.hypot(x, y);
  return length
    ? { x: (x / length) * speed * dt, y: (y / length) * speed * dt }
    : { x: 0, y: 0 };
}

/** Decorations use center coordinates; collision follows their visible footprint. */
export function decorationBounds(decoration) {
  const size = decoration.kind === "tree" ? 32 : 16;
  const width = decoration.width ?? size,
    height = decoration.height ?? size;
  return {
    x: decoration.x - width / 2,
    y: decoration.y - height / 2,
    width,
    height,
  };
}

function obstacleRects(scene) {
  if (barriers.has(scene)) return barriers.get(scene);
  const result = (scene.locations || []).map((location) => ({
    x: location.x,
    y: location.y,
    width: location.size.width,
    height: location.size.height,
  }));
  for (const decoration of scene.decorations || []) {
    if (
      decoration.solid === false ||
      ["flower", "flowers", "grass", "path"].includes(decoration.kind)
    )
      continue;
    result.push(decorationBounds(decoration));
  }
  for (const object of scene.objects || [])
    if (object.solid) {
      result.push({
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
      });
    }
  barriers.set(scene, result);
  return result;
}

function floorSet(scene) {
  if (scene.kind !== "interior") return null;
  if (floors.has(scene)) return floors.get(scene);
  const result = new Set(
    scene.floor ||
      (scene.tiles || [])
        .filter((tile) => tile.kind !== "wall")
        .map((tile) => `${tile.x / TILE},${tile.y / TILE}`),
  );
  floors.set(scene, result);
  return result;
}

function circleTouchesRect(point, radius, rect) {
  const dx = point.x - Math.max(rect.x, Math.min(rect.x + rect.width, point.x));
  const dy =
    point.y - Math.max(rect.y, Math.min(rect.y + rect.height, point.y));
  return (
    dx * dx + dy * dy < radius * radius ||
    (radius === 0 && dx === 0 && dy === 0)
  );
}

/** Player feet are a five-pixel circle. Walls, furniture, trees and rocks are solid. */
export function canStand(point, scene, radius = 5) {
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    !Number.isFinite(radius) ||
    radius < 0
  )
    return false;
  if (
    point.x < radius ||
    point.y < radius ||
    point.x > scene.bounds.width - radius ||
    point.y > scene.bounds.height - radius
  )
    return false;
  const floor = floorSet(scene);
  if (floor) {
    // Check every tile touched by the foot circle, including diagonally adjacent walls.
    for (
      let y = Math.floor((point.y - radius) / TILE);
      y <= Math.floor((point.y + radius) / TILE);
      y++
    ) {
      for (
        let x = Math.floor((point.x - radius) / TILE);
        x <= Math.floor((point.x + radius) / TILE);
        x++
      ) {
        if (
          !floor.has(`${x},${y}`) &&
          circleTouchesRect(point, radius, {
            x: x * TILE,
            y: y * TILE,
            width: TILE,
            height: TILE,
          })
        )
          return false;
      }
    }
  }
  return !obstacleRects(scene).some((rect) =>
    circleTouchesRect(point, radius, rect),
  );
}

/** Substeps prevent tunneling at low frame rates; axis resolution allows wall sliding. */
export function movePlayer(point, delta, scene) {
  const result = { ...point };
  if (![delta.x, delta.y].every(Number.isFinite)) return result;
  const steps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(delta.x), Math.abs(delta.y)) / 4),
  );
  for (let i = 0; i < steps; i++) {
    const x = { x: result.x + delta.x / steps, y: result.y };
    if (canStand(x, scene)) result.x = x.x;
    const y = { x: result.x, y: result.y + delta.y / steps };
    if (canStand(y, scene)) result.y = y.y;
  }
  return result;
}

/** Check the open path to an interaction point, so E cannot reach through a wall. */
export function hasLineOfSight(from, to, scene) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(length / 3));
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    if (
      !canStand(
        {
          x: from.x + (to.x - from.x) * ratio,
          y: from.y + (to.y - from.y) * ratio,
        },
        scene,
        0,
      )
    )
      return false;
  }
  return true;
}

/** Objects declare their own usable side and range; only reachable candidates win. */
export function nearestObject(point, scene, defaultRange = 32) {
  let nearest = null,
    distance = Infinity;
  for (const object of scene.objects || []) {
    if (!object.actions?.length) continue;
    const target = object.interactAt || {
      x: object.x + object.width / 2,
      y: object.y + object.height + 8,
    };
    const d = Math.hypot(point.x - target.x, point.y - target.y);
    if (
      d <= (object.range ?? defaultRange) &&
      d < distance &&
      hasLineOfSight(point, target, scene)
    ) {
      distance = d;
      nearest = object;
    }
  }
  return nearest;
}

/** Compatibility for the original village utilities and tests. */
export function nearestLocation(point, world, range = 55) {
  let nearest = null,
    distance = range;
  for (const location of world.locations || []) {
    const d = Math.hypot(
      point.x - location.entrance.x,
      point.y - location.entrance.y,
    );
    if (d < distance && hasLineOfSight(point, location.entrance, world)) {
      distance = d;
      nearest = location;
    }
  }
  return nearest;
}
