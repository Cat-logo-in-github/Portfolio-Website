import { villageScene } from './village.mjs';
import { generateInterior, defaultInteriorConfig, randomSequence } from './interior.mjs';
import { hashString, distanceToSegment } from './world.mjs';
import { decorateMysteryScene, placeSceneObjects } from './mystery.mjs';

export const GARDEN_ID = 'secret:glitch-garden';
export const DEVICE_KEY = 'v4:devices';
const villages = new WeakMap();
export function gardenUnlocked(story) {
  return Boolean(story?.solved?.includes('room-tree') && story.solved.includes('bridge-repair'));
}

/** A separate destination preserves the résumé's exact tree and record mapping. */
export function gardenVillage(world) {
  if (villages.has(world)) return villages.get(world);
  const base = villageScene(world);
  const anchor = [...world.locations].sort((a, b) => b.entrance.y - a.entrance.y || a.vertex - b.vertex)[0];
  const x = anchor.entrance.x + 128, y = Math.ceil(world.bounds.height / 16) * 16 + 112;
  const entrance = { x: x + 48, y: y + 112 };
  const landmark = { id: GARDEN_ID, vertex: 999, label: 'Glitch Garden', sectionId: '__fiction', type: 'research', buildingType: 'laboratory', importance: 1, size: { width: 96, height: 96 }, x, y, entrance, recordIds: [], variation: hashString(String(world.seed)) % 4, secret: true };
  const bounds = { width: Math.max(world.bounds.width, x + 160), height: y + 176 };
  const bridgeX = anchor.entrance.x, channelY = y - 48;
  const water = (id, left, width) => ({ id, type: 'water-strip', label: 'Canal', x: left, y: channelY, width, height: 32, solid: true, range: 0, interactAt: { x: left, y: channelY - 32 }, recordIds: [], hint: '', sprite: { sheet: 'town', index: 0 }, actions: [] });
  const bridge = { id: 'garden:bridge', type: 'repaired-bridge', label: 'Unfinished canal bridge', x: bridgeX - 24, y: channelY, width: 48, height: 32, solid: true, range: 34, interactAt: { x: bridgeX, y: channelY - 16 }, recordIds: [], hint: 'The route sketch and repaired network reconnect this crossing.', sprite: { sheet: 'town', index: 106 }, actions: [{ id: 'inspect', kind: 'inspect', label: 'Inspect crossing', message: 'Restore the route tree and repair the bridge device to reconnect the Glitch Garden.' }] };
  const door = { id: 'garden:door', type: 'door', label: 'Glitch Garden · sealed', x: entrance.x - 8, y: y + 80, width: 16, height: 16, solid: false, range: 43, interactAt: entrance, recordIds: [], hint: 'A greenhouse full of unfinished experiments. The bridge circuit seals its entrance.', sprite: { sheet: 'town', index: 85 }, buildingId: GARDEN_ID, actions: [{ id: 'enter', label: 'Enter Glitch Garden', kind: 'garden' }] };
  const paths = [...base.paths, { from: anchor.vertex, to: 999, points: [anchor.entrance, { x: bridgeX, y: entrance.y + 32 }, { x: entrance.x, y: entrance.y + 32 }, entrance] }];
  const decorations = base.decorations.filter(decoration => paths.at(-1).points.slice(1).every((end, index) => distanceToSegment(decoration, paths.at(-1).points[index], end) >= 44));
  const result = { ...base, bounds, decorations, locations: [...base.locations, landmark], paths, objects: [...base.objects, water('garden:water-left', 0, bridgeX - 24), water('garden:water-right', bridgeX + 24, bounds.width - bridgeX - 24), bridge, door], garden: { location: landmark, bridge, channelY } };
  villages.set(world, result); return result;
}

export function gardenEntrance(world) { return gardenVillage(world).garden.location.entrance; }
export function generateGarden(resume, seed) {
  const location = { id: GARDEN_ID, vertex: 1, label: 'Glitch Garden', sectionId: '__fiction', type: 'research', recordIds: [], importance: 1 };
  const fiction = { ...resume, sections: [...resume.sections, { id: '__fiction', type: 'research', label: 'Glitch Garden', entries: [] }] };
  const config = { ...defaultInteriorConfig(fiction, location), archetype: 'workshop', nodeCount: 4, sequence: randomSequence(4, `${seed}:garden:tree`), layoutSeed: `${hashString(seed)}:garden-layout`, decorationSeed: `${hashString(seed)}:garden-props` };
  const scene = generateInterior(fiction, location, config);
  const names = ['Arrival Conservatory', 'Relay Nursery', 'Debugging Glasshouse', 'Moonseed Observatory'];
  return { ...scene, label: 'Glitch Garden', habitat: 'glitch-garden', palette: 'glitch', rooms: scene.rooms.map((room, index) => ({ ...room, label: names[index] })), secret: true };
}

export function decorateAdventureScene(base, plan, story, activity = {}) {
  let scene = base.buildingId === GARDEN_ID ? { ...base, objects: [...base.objects] } : decorateMysteryScene(base, plan, story);
  scene = { ...scene, objects: scene.objects.filter(object => !object.id.startsWith('adventure:')).map(object => ({ ...object, actions: object.actions.filter(action => !action.adventureObjectId) })) };
  if (scene.kind === 'village') {
    const open = gardenUnlocked(story);
    scene = { ...scene, objects: scene.objects.map(object => object.id === 'garden:bridge' ? { ...object, solid: !open, label: open ? 'Restored canal bridge' : object.label, hint: open ? 'The canal crossing is restored.' : object.hint } : object.id === 'garden:door' ? { ...object, label: open ? 'Enter Glitch Garden' : 'Glitch Garden · sealed', hint: open ? 'The greenhouse is open. Its machines need a curious debugger.' : object.hint } : object) };
  }
  const completed = Array.isArray(activity.completed) ? activity.completed : [];
  const siteComplete = ['routing', 'scheduling', 'debugging', 'sorting'].some(type => completed.includes(`device:${type}:${hashString(scene.buildingId || '').toString(36)}`));
  if (scene.kind === 'interior') scene = { ...scene, powered: siteComplete, ...(scene.buildingId === GARDEN_ID && activity.gardenRestored ? { palette: 'glitch-restored', powered: true } : {}) };
  const definitions = [];
  if (scene.kind === 'village') {
    definitions.push({ id: 'adventure:rest-bench', type: 'bench', label: 'A quiet bench', hint: 'A little pause among the village flowers.', sprite: { sheet: 'town', index: 106 }, actions: [{ id: 'rest', kind: 'inspect', label: 'Take a quiet moment', message: 'Warm lamplight, a small breeze, and nowhere you have to hurry. Your discoveries will be here when you return.' }] });
    definitions.push({ id: 'adventure:book-exchange', type: 'bookshelf', label: 'Little village book exchange', hint: 'A shared shelf for unfinished stories.', sprite: { sheet: 'interior', index: 479 }, actions: [{ id: 'read', kind: 'inspect', label: 'Read the bookmark', message: '“Return a book when you can. Leave a question when you cannot.” The caretaker has underlined the second sentence.' }] });
    definitions.push({ id: 'adventure:pantry', type: 'chest', label: 'Community picnic basket', hint: 'Take a small pack of creature treats whenever supplies run low.', sprite: { sheet: 'dungeon', index: 89 }, actions: [{ id: 'stock', kind: 'pantry', label: 'Pack creature treats' }] });
  } else {
    const type = scene.buildingId === GARDEN_ID ? 'debugging' : scene.archetype === 'library' ? 'routing' : scene.archetype === 'home' ? 'sorting' : scene.archetype === 'studio' ? 'scheduling' : 'debugging';
    const titles = { sorting: 'The seed-packet shelf', routing: 'Packet relay', scheduling: 'Clockwork task desk', debugging: scene.buildingId === GARDEN_ID ? 'The Glitch Garden regulator' : 'Prototype diagnostic bench' };
    definitions.push({ id: `adventure:device:${scene.buildingId}`, type: 'computer', label: siteComplete ? `${titles[type]} · restored` : titles[type], hint: scene.buildingId === GARDEN_ID ? 'Observe the malfunction, test a repair, and bring the greenhouse back to life.' : 'An optional hands-on CS experiment.', sprite: { sheet: 'dungeon', index: siteComplete ? 55 : 54 }, actions: [{ id: 'device', kind: 'device', label: 'Experiment', deviceType: type, siteId: scene.buildingId }] });
    if (scene.buildingId === GARDEN_ID) definitions.push({ id: 'adventure:garden-note', type: 'bookshelf', label: 'The unfinished notebook', hint: 'A margin from the archive’s first experimental greenhouse.', sprite: { sheet: 'interior', index: 475 }, actions: [{ id: 'collect', kind: 'garden-note', label: 'Read the margin' }] });
  }
  return placeSceneObjects(scene, definitions, plan.seed, 'adventureObjectId');
}
