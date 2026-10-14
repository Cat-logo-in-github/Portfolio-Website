import { distanceToSegment } from "./world.mjs";
import { canStand, nearestObject } from "../game/physics.mjs";

const sprite = (sheet, index) => ({ sheet, index });
const inspect = (message) => ({
  id: "inspect",
  label: "Inspect",
  kind: "inspect",
  message,
});
const intersects = (a, b, margin = 0) =>
  a.x < b.x + b.width + margin &&
  a.x + a.width > b.x - margin &&
  a.y < b.y + b.height + margin &&
  a.y + a.height > b.y - margin;

/** Interaction definitions use the same data/action system as interior furniture. */
export function villageScene(world) {
  const objects = [];
  for (const location of world.locations) {
    const hint = `Enter ${location.label}; use its related books, desks and displays to discover the field notes.`;
    objects.push({
      id: `${location.id}:door`,
      buildingId: location.id,
      type: "door",
      label: `Enter ${location.label}`,
      x: location.entrance.x - 8,
      y: location.y + location.size.height - 16,
      width: 16,
      height: 16,
      solid: false,
      range: 43,
      interactAt: { ...location.entrance },
      recordIds: [],
      hint,
      sprite: sprite("town", 74),
      actions: [
        {
          id: "enter",
          label: `Enter ${location.label}`,
          kind: "enter",
          buildingId: location.id,
          message: hint,
        },
      ],
    });
    objects.push({
      id: `${location.id}:sign`,
      buildingId: location.id,
      type: "sign",
      label: `${location.label} sign`,
      x: location.entrance.x + 30,
      y: location.entrance.y - 8,
      width: 16,
      height: 16,
      solid: true,
      range: 32,
      interactAt: { x: location.entrance.x + 30, y: location.entrance.y + 16 },
      recordIds: [],
      hint,
      sprite: sprite("town", 83),
      actions: [inspect(hint)],
    });
  }
  const root =
    world.locations.find((l) =>
      ["about", "profile", "summary"].includes(l.type),
    ) || world.locations[0];
  const clear = (rect) =>
    rect.x >= 24 &&
    rect.y >= 24 &&
    rect.x + rect.width < world.bounds.width - 24 &&
    rect.y + rect.height < world.bounds.height - 24 &&
    !world.locations.some((l) => intersects(rect, { ...l, ...l.size }, 12)) &&
    !objects.some((o) => o.solid && intersects(rect, o, 10)) &&
    // Later props cannot occupy the usable side of an earlier prop or a building entrance.
    !objects.some((o) =>
      intersects(
        rect,
        { x: o.interactAt.x - 6, y: o.interactAt.y - 6, width: 12, height: 12 },
        1,
      ),
    ) &&
    !world.decorations.some((d) =>
      intersects(rect, { x: d.x - 18, y: d.y - 18, width: 36, height: 36 }, 4),
    ) &&
    !world.paths.some((p) =>
      p.points
        .slice(1)
        .some(
          (b, i) =>
            distanceToSegment(
              { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
              p.points[i],
              b,
            ) <
            24 + Math.max(rect.width, rect.height) / 2,
        ),
    ) &&
    Math.hypot(
      rect.x + rect.width / 2 - world.spawn.x,
      rect.y + rect.height / 2 - world.spawn.y,
    ) > 38;
  const place = (definition, preferred) => {
    const origin = root.entrance;
    const offsets = [
      preferred,
      ...[-80, 80, -112, 112, -144, 144].flatMap((x) =>
        [32, 64, 96, 128, 160].map((y) => ({ x, y })),
      ),
    ];
    // Dense stars can use the lawns beside or above the starting house. Search bounded
    // rings in a fixed order; adding seed variation never removes essential NPCs.
    for (let distance = 32; distance <= 320; distance += 32) {
      for (let x = -distance; x <= distance; x += 32)
        offsets.push({ x, y: -distance }, { x, y: distance });
      for (let y = -distance + 32; y < distance; y += 32)
        offsets.push({ x: -distance, y }, { x: distance, y });
    }
    for (const offset of offsets) {
      const rect = {
        x: origin.x + offset.x,
        y: origin.y + offset.y,
        width: definition.width || 16,
        height: definition.height || 16,
      };
      if (!clear(rect)) continue;
      const point = {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height + 12,
      };
      const candidate = {
        solid: true,
        range: 36,
        recordIds: [],
        ...definition,
        ...rect,
        interactAt: point,
      };
      const testScene = {
        ...world,
        kind: "village",
        objects: [...objects, candidate],
      };
      if (
        !canStand(point, testScene) ||
        nearestObject(point, testScene)?.id !== candidate.id
      )
        continue;
      objects.push(candidate);
      return;
    }
    throw new Error(`No safe placement for village object ${definition.id}.`);
  };
  place(
    {
      id: "village:guide",
      type: "npc",
      label: "The Archivist",
      hint: "A friendly guide to the field notes.",
      sprite: sprite("dungeon", 84),
      actions: [
        inspect(
          "Welcome! Enter a house, approach a glowing object, then choose its relevant action. Inspect gives a clue; Read, Run or Examine reveals a field note. The reading version and original PDF are always available.",
        ),
        {
          id: "field-trip",
          label: "Accept: first field trip",
          kind: "quest",
          questId: "fieldTrip",
          message:
            "Discover three field notes across two houses. Curiosity earns a key for the village chest.",
        },
      ],
    },
    { x: -72, y: 40 },
  );
  place(
    {
      id: "village:board",
      type: "noticeboard",
      label: "Village notice board",
      width: 24,
      height: 24,
      hint: "A short, optional expedition.",
      sprite: sprite("town", 83),
      actions: [
        {
          id: "field-trip",
          label: "Take the field-trip quest",
          kind: "quest",
          questId: "fieldTrip",
          message:
            "Discover three field notes across two houses to earn a field key.",
        },
        inspect(
          "Books live in the library; projects sit at workshop terminals; awards belong on display. All houses can be visited in any order.",
        ),
      ],
    },
    { x: 64, y: 40 },
  );
  place(
    {
      id: "village:mentor",
      type: "npc",
      label: "Sparring mentor",
      hint: "Optional friendly battles. Defeat has no cost.",
      sprite: sprite("dungeon", 87),
      actions: [
        {
          id: "challenge",
          label: "Choose a friendly sparring match",
          kind: "battle",
          message:
            "Friendly sparring is optional. You can retreat at any time and keep every discovery.",
        },
        inspect(
          "Move up to two squares each turn. Attack next to your opponent, Guard to reduce damage, or use Focus at range. End turn lets the opponent act.",
        ),
      ],
    },
    { x: -112, y: 104 },
  );
  place(
    {
      id: "village:chest",
      type: "chest",
      label: "Curiosity chest",
      hint: "The Archivist’s field-trip key opens this chest.",
      sprite: sprite("dungeon", 89),
      actions: [
        inspect(
          "A small reward for exploring. The field-trip quest earns its key after three discoveries across two houses.",
        ),
        {
          id: "open",
          label: "Unlock with a field key",
          kind: "open",
          once: true,
          requires: { item: "field-key", quantity: 1 },
          reward: { item: "curiosity-badge", quantity: 1 },
          message:
            "The chest opens. You earned the Curiosity badge. Your discoveries stay in the journal.",
        },
      ],
    },
    { x: 96, y: 112 },
  );
  place(
    {
      id: "village:well",
      type: "well",
      label: "Old village well",
      width: 32,
      height: 32,
      hint: "A quiet corner of the village.",
      sprite: sprite("town", 104),
      actions: [
        inspect(
          "The water reflects a village made from a résumé. New codes change the paths; your discoveries remain your own.",
        ),
      ],
    },
    { x: 144, y: 56 },
  );
  return {
    ...world,
    id: `village:${world.seed}:${world.sequence.join("-")}`,
    kind: "village",
    label: "The résumé village",
    objects,
  };
}
