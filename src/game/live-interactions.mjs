import { nearestObject } from './physics.mjs';
import { nearestCreature, creatureObject } from '../core/creatures.mjs';

/** Resolve moving actors at activation time, rather than reusing a HUD snapshot. */
export function liveNearby(point, scene, simulation) {
  const object = nearestObject(point, scene), entity = nearestCreature(simulation, point, scene);
  if (!entity) return object;
  if (!object || Math.hypot(entity.x - point.x, entity.y - point.y) < Math.hypot(object.interactAt.x - point.x, object.interactAt.y - point.y)) return creatureObject(entity);
  return object;
}
export function liveObject(id, scene, simulation) {
  const entity = simulation?.entities.find(entity => entity.id === id && entity.sceneId === scene.id);
  return entity ? creatureObject(entity) : scene.objects.find(object => object.id === id) || null;
}
export function liveObjects(scene, simulation) {
  return (simulation?.entities || []).filter(entity => entity.sceneId === scene.id).map(creatureObject);
}
