export const CARDINAL_CONNECTIONS = Object.freeze([{ bit: 1, dx: 0, dy: -1, name: 'north' }, { bit: 2, dx: 1, dy: 0, name: 'east' }, { bit: 4, dx: 0, dy: 1, name: 'south' }, { bit: 8, dx: -1, dy: 0, name: 'west' }]);
const key = (x, y) => `${x},${y}`;
export function connectionMask(occupied, x, y) {
  return CARDINAL_CONNECTIONS.reduce((mask, direction) => occupied.has(key(x + direction.dx, y + direction.dy)) ? mask | direction.bit : mask, 0);
}
export function connectionShape(mask) {
  const count = CARDINAL_CONNECTIONS.filter(direction => mask & direction.bit).length;
  return count === 4 ? 'cross' : count === 3 ? 'tee' : count === 2 ? mask === 5 || mask === 10 ? 'straight' : 'corner' : count === 1 ? 'end' : 'isolated';
}
/** Existing nine-patch dirt tiles are cropped by quadrant; all 16 cardinal masks are supported. */
export function terrainQuarterTiles(mask) {
  const north = Boolean(mask & 1), east = Boolean(mask & 2), south = Boolean(mask & 4), west = Boolean(mask & 8);
  return [!north && !west ? 12 : !north ? 13 : !west ? 24 : 25, !north && !east ? 14 : !north ? 13 : !east ? 26 : 25,
    !south && !west ? 36 : !south ? 37 : !west ? 24 : 25, !south && !east ? 38 : !south ? 37 : !east ? 26 : 25];
}
/** Roads are 32px wide and end flush with the building front, rather than short round line caps. */
export function roadTiles(paths, tileSize = 16) {
  const occupied = new Set();
  for (const path of paths || []) for (let i = 1; i < path.points.length; i++) {
    const from = path.points[i - 1], to = path.points[i];
    if (from.x !== to.x && from.y !== to.y) throw Error('Road segments must be orthogonal.');
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) / tileSize));
    for (let step = 0; step <= steps; step++) {
      const x = Math.round((from.x + (to.x - from.x) * step / steps) / tileSize), y = Math.round((from.y + (to.y - from.y) * step / steps) / tileSize);
      for (const dx of [-1, 0]) for (const dy of [-1, 0]) occupied.add(key(x + dx, y + dy));
    }
  }
  return [...occupied].map(value => { const [x, y] = value.split(',').map(Number); return { x: x * tileSize, y: y * tileSize, mask: connectionMask(occupied, x, y) }; }).sort((a, b) => a.y - b.y || a.x - b.x);
}
