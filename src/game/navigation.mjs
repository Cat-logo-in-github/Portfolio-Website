import { canStand, hasLineOfSight, movePlayer } from './physics.mjs';
const STEP = 8;
const key = point => `${point.x},${point.y}`;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function segmentClear(from, to, scene) {
  const length = distance(from, to), steps = Math.max(1, Math.ceil(length / 4));
  for (let i = 0; i <= steps; i++) if (!canStand({ x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps }, scene)) return false;
  return true;
}

export function objectAtPoint(point, scene) {
  return [...scene.objects].reverse().find(object => point.x >= object.x && point.x <= object.x + object.width && point.y >= object.y - (object.type === 'npc' ? 5 : 0) && point.y <= object.y + object.height) || null;
}
export function canInteractWith(point, object, scene) {
  return object.actions?.length > 0 && distance(point, object.interactAt) <= (object.range || 32) && hasLineOfSight(point, object.interactAt, scene);
}

function gridAnchor(point, scene) {
  const center = { x: Math.round(point.x / STEP) * STEP, y: Math.round(point.y / STEP) * STEP }, candidates = [];
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) candidates.push({ x: center.x + x * STEP, y: center.y + y * STEP });
  return candidates.sort((a, b) => distance(point, a) - distance(point, b) || a.y - b.y || a.x - b.x).find(candidate => segmentClear(point, candidate, scene));
}

/** Bounded A*: taps follow the same foot-circle collision rules as the keyboard. */
export function findWalkPath(from, target, scene, limit = 5000) {
  if (!canStand(from, scene) || !canStand(target, scene)) return null;
  if (segmentClear(from, target, scene)) return [target];
  const start = gridAnchor(from, scene), end = gridAnchor(target, scene);
  if (!start || !end) return null;
  const startKey = key(start), endKey = key(end), open = [{ point: start, cost: 0, score: distance(start, end) }];
  const costs = new Map([[startKey, 0]]), parents = new Map(), points = new Map([[startKey, start]]), visited = new Set();
  const minX = Math.max(8, Math.min(from.x, target.x) - 160), minY = Math.max(8, Math.min(from.y, target.y) - 160);
  const maxX = Math.min(scene.bounds.width - 8, Math.max(from.x, target.x) + 160), maxY = Math.min(scene.bounds.height - 8, Math.max(from.y, target.y) + 160);
  while (open.length && visited.size < limit) {
    // The bound keeps this deliberately small; fixed tie breaks reproduce the same path.
    let best = 0; for (let i = 1; i < open.length; i++) if (open[i].score < open[best].score || (open[i].score === open[best].score && open[i].cost < open[best].cost)) best = i;
    const current = open.splice(best, 1)[0], currentKey = key(current.point);
    if (visited.has(currentKey)) continue;
    if (currentKey === endKey) {
      const path = [target]; let cursor = endKey;
      while (cursor !== startKey) { path.push(points.get(cursor)); cursor = parents.get(cursor); }
      path.push(start); return path.reverse().filter((point, index, all) => index === 0 || distance(point, all[index - 1]) > 0.01);
    }
    visited.add(currentKey);
    for (const [dx, dy] of [[0, -STEP], [-STEP, 0], [STEP, 0], [0, STEP]]) {
      const next = { x: current.point.x + dx, y: current.point.y + dy }, nextKey = key(next), cost = current.cost + STEP;
      if (next.x < minX || next.y < minY || next.x > maxX || next.y > maxY || visited.has(nextKey) || cost >= (costs.get(nextKey) ?? Infinity)) continue;
      const moved = movePlayer(current.point, { x: dx, y: dy }, scene);
      if (distance(moved, next) > 0.01) continue;
      costs.set(nextKey, cost); parents.set(nextKey, currentKey); points.set(nextKey, next);
      open.push({ point: next, cost, score: cost + Math.abs(next.x - end.x) + Math.abs(next.y - end.y) });
    }
  }
  return null;
}

/** Shallow story/object updates must never reset the avatar or camera. */
export function sceneGeometryChanged(previous, scene) {
  return !previous || previous.id !== scene.id || previous.kind !== scene.kind || previous.paths !== scene.paths
    || previous.floor !== scene.floor || previous.tiles !== scene.tiles || previous.config !== scene.config
    || previous.locations !== scene.locations || previous.bounds.width !== scene.bounds.width || previous.bounds.height !== scene.bounds.height;
}
