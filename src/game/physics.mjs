/** Normalize the direction so diagonal travel is exactly as fast as axial travel. */
export function movementVector(x, y, speed, dt) {
  const length = Math.hypot(x, y);
  return length ? { x: x / length * speed * dt, y: y / length * speed * dt } : { x: 0, y: 0 };
}

/** The player's collision shape is a small foot circle, not the whole sprite. */
export function canStand(point, world, radius = 5) {
  if (point.x < radius || point.y < radius || point.x > world.bounds.width - radius || point.y > world.bounds.height - radius) return false;
  return !world.locations.some(l => point.x + radius > l.x && point.x - radius < l.x + l.size.width && point.y + radius > l.y && point.y - radius < l.y + l.size.height);
}

/** Substeps prevent tunneling at low frame rates; axis resolution allows wall sliding. */
export function movePlayer(point, delta, world) {
  const result = { ...point };
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(delta.x), Math.abs(delta.y)) / 4));
  for (let i = 0; i < steps; i++) {
    const x = { x: result.x + delta.x / steps, y: result.y };
    if (canStand(x, world)) result.x = x.x;
    const y = { x: result.x, y: result.y + delta.y / steps };
    if (canStand(y, world)) result.y = y.y;
  }
  return result;
}

export function nearestLocation(point, world, range = 55) {
  let nearest = null, distance = range;
  for (const location of world.locations) {
    const d = Math.hypot(point.x - location.entrance.x, point.y - location.entrance.y);
    if (d < distance) { distance = d; nearest = location; }
  }
  return nearest;
}
