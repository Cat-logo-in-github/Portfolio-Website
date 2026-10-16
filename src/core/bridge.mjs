import { shortestPath } from './mystery.mjs';

export function bridgeStatus(data, repairId, route = []) {
  const link = data.candidates.find((candidate) => candidate.id === repairId);
  const edges = [...data.edges, ...(link ? [link] : [])];
  const unseen = new Set(data.nodes.map((node) => node.id));
  let components = 0;
  while (unseen.size) {
    const root = unseen.values().next().value; components++;
    for (const vertex of [...unseen]) if (shortestPath(edges, root, vertex).length) unseen.delete(vertex);
  }
  const shortest = shortestPath(edges, data.start, data.goal);
  const adjacent = (a, b) => edges.some(({ from, to }) => from === a && to === b || from === b && to === a);
  const validTrace = route.length > 0 && route[0] === data.start && new Set(route).size === route.length && route.every((vertex) => data.nodes.some((node) => node.id === vertex)) && route.slice(1).every((vertex, index) => adjacent(route[index], vertex));
  const complete = validTrace && route.at(-1) === data.goal;
  const ready = Boolean(link && components === 1 && complete && route.length === shortest.length);
  return { link, edges, components, shortest, hops: Math.max(0, route.length - 1), validTrace, complete, ready, next: data.nodes.filter(({ id }) => !route.includes(id) && (!route.length ? id === data.start : adjacent(route.at(-1), id))).map(({ id }) => id) };
}

/** Display coordinates remain separate from the requested graph and its labels. */
export function bridgePositions(data) {
  const xs = data.nodes.map(({ x }) => x), ys = data.nodes.map(({ y }) => y);
  const left = Math.min(...xs), top = Math.min(...ys), width = Math.max(...xs) - left || 1, height = Math.max(...ys) - top || 1;
  return new Map(data.nodes.map((node) => [node.id, { x: 15 + (node.x - left) / width * 70, y: 20 + (node.y - top) / height * 60 }]));
}
