import {
  decodePrufer,
  encodePrufer,
  hashString,
  seededRandom,
} from "./world.mjs";
import { connectionMask } from './connections.mjs';
import { roomComposition, furnitureParts, featureLabel } from './interior-style.mjs';

const TILE = 16;
const VERSION = 2;
const ARCHETYPES = ["home", "library", "workshop", "studio"];
const PRIVATE = new Set(["bedroom", "storage", "archive", "greenroom"]);
const REQUIRED = {
  home: "living",
  library: "reading",
  workshop: "workshop",
  studio: "stage",
};
const ROOM_SIZES = {
  foyer: [192, 176],
  living: [208, 192],
  study: [192, 176],
  bedroom: [176, 176],
  storage: [160, 176],
  reading: [224, 176],
  catalog: [208, 176],
  research: [224, 176],
  archive: [176, 176],
  workshop: [224, 176],
  assembly: [208, 176],
  stage: [224, 192],
  editing: [208, 176],
  rehearsal: [208, 176],
  greenroom: [176, 176],
};
const key = (x, y) => `${x},${y}`;
const tileAt = (point) =>
  key(Math.floor(point.x / TILE), Math.floor(point.y / TILE));
const sortKeys = (a, b) => {
  const [ax, ay] = a.split(",").map(Number),
    [bx, by] = b.split(",").map(Number);
  return ay - by || ax - bx;
};
const pointIn = (point, rectangle) =>
  point.x >= rectangle.x &&
  point.y >= rectangle.y &&
  point.x < rectangle.x + rectangle.width &&
  point.y < rectangle.y + rectangle.height;
const rectanglesOverlap = (a, b) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

export function archetypeFor(location) {
  const type = String(location?.type || "").toLowerCase();
  const label = String(location?.label || "").toLowerCase();
  if (
    [
      "education",
      "research",
      "publications",
      "languages",
      "certifications",
    ].includes(type)
  )
    return "library";
  if (
    ["content", "activities", "leadership"].includes(type) ||
    /creative|perform|music|art/.test(label)
  )
    return "studio";
  if (["projects", "skills", "experience", "work"].includes(type))
    return "workshop";
  return "home";
}

export function randomSequence(n, seed = "rooms") {
  if (!Number.isSafeInteger(n) || n < 2 || n > 10)
    throw new Error("Choose a room count from 2 to 10.");
  if (typeof seed !== "string" || seed.length > 160)
    throw new Error(
      "The topology seed must be a string of at most 160 characters.",
    );
  const random = seededRandom(hashString(`interior-topology:${seed}`));
  return Array.from({ length: n - 2 }, () => 1 + Math.floor(random() * n));
}

function entriesFor(resume, location) {
  if (
    !location ||
    typeof location.id !== "string" ||
    !location.id ||
    typeof location.sectionId !== "string"
  )
    throw new Error(
      "Choose a valid résumé building before generating an interior.",
    );
  const section = resume?.sections?.find(
    (item) => item.id === location.sectionId,
  );
  if (section) {
    if (!Array.isArray(section.entries))
      throw new Error("The selected résumé section has no valid record list.");
    const seen = new Set();
    for (const entry of section.entries) {
      if (
        !entry ||
        typeof entry.id !== "string" ||
        !entry.id ||
        seen.has(entry.id)
      )
        throw new Error(
          "Interior records must have unique, stable identifiers.",
        );
      seen.add(entry.id);
    }
    return section.entries;
  }
  if (location.sectionId === "__about")
    return [
      {
        id: "__profile",
        title: resume?.name || "Profile",
        details: [
          resume?.summary || resume?.title || "A home for this résumé.",
        ],
        virtual: true,
      },
    ];
  if (location.sectionId === "__contact")
    return [
      {
        id: "__contact-details",
        title: "Contact details",
        details: Object.values(resume?.contact || {}).filter(Boolean),
        virtual: true,
      },
    ];
  throw new Error(
    `Building ${location.id} references an unknown résumé section.`,
  );
}

export function defaultInteriorConfig(resume, location) {
  const entries = entriesFor(resume, location);
  const nodeCount = Math.max(
    3,
    Math.min(6, 3 + Math.floor(entries.length / 3)),
  );
  // The professional records, rather than PDF bytes or unrelated sections, seed this building.
  const source = `${location.id}:${JSON.stringify(entries.map(({ id, title, subtitle, dates, details }) => ({ id, title, subtitle, dates, details })))}`;
  const seed = String(hashString(source));
  return {
    algorithmVersion: VERSION,
    scope: "interior",
    buildingId: location.id,
    archetype: archetypeFor(location),
    nodeCount,
    sequence: randomSequence(nodeCount, seed),
    layoutSeed: seed,
    decorationSeed: seed,
  };
}

/** Imported configurations are validated, never repaired into another requested tree. */
export function validateInteriorConfig(config, location) {
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw new Error("Interior configuration must be a JSON object.");
  if (config.algorithmVersion !== VERSION)
    throw new Error(
      `Interior algorithm version ${config.algorithmVersion ?? "(missing)"} is unsupported. Use version ${VERSION}; older configurations must be reset explicitly.`,
    );
  if (config.scope !== "interior")
    throw new Error('This configuration must have scope "interior".');
  if (
    typeof config.buildingId !== "string" ||
    !config.buildingId ||
    config.buildingId.length > 240
  )
    throw new Error("The configuration needs a valid buildingId.");
  if (location && config.buildingId !== location.id)
    throw new Error(
      "This configuration belongs to a different building. Select that building before importing it.",
    );
  if (!ARCHETYPES.includes(config.archetype))
    throw new Error(`Choose a supported archetype: ${ARCHETYPES.join(", ")}.`);
  if (
    !Number.isSafeInteger(config.nodeCount) ||
    config.nodeCount < 2 ||
    config.nodeCount > 10
  )
    throw new Error("Choose a room count from 2 to 10.");
  for (const field of ["layoutSeed", "decorationSeed"])
    if (typeof config[field] !== "string" || config[field].length > 160)
      throw new Error(`${field} must be a string of at most 160 characters.`);
  decodePrufer(config.sequence, config.nodeCount);
  return {
    algorithmVersion: VERSION,
    scope: "interior",
    buildingId: config.buildingId,
    archetype: config.archetype,
    nodeCount: config.nodeCount,
    sequence: [...config.sequence],
    layoutSeed: config.layoutSeed,
    decorationSeed: config.decorationSeed,
  };
}

function semanticRooms(config, edges) {
  const degrees = Array(config.nodeCount + 1).fill(0);
  for (const { from, to } of edges) {
    degrees[from]++;
    degrees[to]++;
  }
  const candidates = Array.from(
    { length: config.nodeCount - 1 },
    (_, i) => i + 2,
  ).sort((a, b) => degrees[b] - degrees[a] || a - b);
  const roles = Array(config.nodeCount + 1).fill("");
  roles[1] = "foyer";
  roles[candidates.shift()] = REQUIRED[config.archetype];
  if (candidates.length && config.archetype !== "home")
    roles[candidates.shift()] = {
      library: "catalog",
      workshop: "assembly",
      studio: "editing",
    }[config.archetype];
  let leafIndex = 0;
  for (const vertex of candidates) {
    if (degrees[vertex] === 1) {
      roles[vertex] = {
        home: ["bedroom", "storage"],
        library: ["archive", "reading"],
        workshop: ["storage", "workshop"],
        studio: ["greenroom", "storage"],
      }[config.archetype][leafIndex++ % 2];
    } else
      roles[vertex] = {
        home: "study",
        library: "research",
        workshop: "assembly",
        studio: "rehearsal",
      }[config.archetype];
  }
  const roleTotals = new Map(); for (const role of roles.slice(1)) roleTotals.set(role, (roleTotals.get(role) || 0) + 1);
  const roleSeen = new Map();
  return Array.from({ length: config.nodeCount }, (_, i) => {
    const vertex = i + 1,
      role = roles[vertex];
    const variation =
      (hashString(`${config.layoutSeed}:dimensions:${vertex}`) % 2) * TILE;
    const [width, height] = ROOM_SIZES[role];
    roleSeen.set(role, (roleSeen.get(role) || 0) + 1);
    return {
      vertex,
      role,
      label: `${roomComposition(role).name}${roleTotals.get(role) > 1 ? ` ${roleSeen.get(role)}` : ''}`,
      x: 0,
      y: 0,
      width: width + variation,
      height: height + variation,
    };
  });
}

/** Two-tile furniture plus an adjacent interaction tile, outside a three-tile circulation cross. */
function furnitureSlots(room) {
  const cols = room.width / TILE,
    rows = room.height / TILE;
  const cx = Math.floor(cols / 2),
    cy = Math.floor(rows / 2);
  const zones = [
    [1, cx - 2, 1, cy - 2],
    [cx + 2, cols - 2, 1, cy - 2],
    [1, cx - 2, cy + 2, rows - 1],
    [cx + 2, cols - 2, cy + 2, rows - 1],
  ];
  const slots = [];
  for (const [left, right, top, bottom] of zones)
    for (let y = top; y + 2 <= bottom; y += 4)
      for (let x = left; x + 1 <= right; x += 4)
        slots.push({ x: room.x + x * TILE, y: room.y + y * TILE });
  return slots;
}

function layoutRooms(rooms, edges, config, entries) {
  const adjacent = Array.from({ length: rooms.length + 1 }, () => []);
  for (const { from, to } of edges) {
    adjacent[from].push(to);
    adjacent[to].push(from);
  }
  adjacent.forEach((list, vertex) =>
    list.sort(
      (a, b) =>
        hashString(`${config.layoutSeed}:order:${vertex}:${a}`) -
          hashString(`${config.layoutSeed}:order:${vertex}:${b}`) || a - b,
    ),
  );
  const order = [1],
    parent = Array(rooms.length + 1).fill(0),
    depth = Array(rooms.length + 1).fill(0),
    children = Array.from({ length: rooms.length + 1 }, () => []);
  for (const vertex of order)
    for (const child of adjacent[vertex])
      if (child !== parent[vertex]) {
        parent[child] = vertex;
        depth[child] = depth[vertex] + 1;
        children[vertex].push(child);
        order.push(child);
      }
  const functional = rooms.filter(
    (room) => room.vertex !== 1 && !PRIVATE.has(room.role),
  );
  const assignments = new Map(rooms.map((room) => [room.vertex, []]));
  entries.forEach((entry, i) =>
    assignments.get(functional[i % functional.length].vertex).push(entry),
  );
  for (const room of rooms) {
    const target = assignments.get(room.vertex).length + 1;
    // Repair capacity deterministically; no retries change the requested topology.
    let attempts = 0;
    while (furnitureSlots(room).length < target && attempts++ < 20) {
      if (room.width < 320) room.width += 32;
      else if (room.height < 256) room.height += 32;
      else break;
      room.width = Math.min(room.width, 320);
      room.height = Math.min(room.height, 256);
    }
    if (furnitureSlots(room).length < target)
      throw new Error(
        `Too many records for the selected ${rooms.length}-room interior. Increase the room count; no records were dropped.`,
      );
    // Separate outgoing doors by a wall tile. A high-degree public hall grows accordingly.
    room.width = Math.max(room.width, (children[room.vertex].length + 1) * 64);
    if (room.width > 640 || room.height > 256)
      throw new Error(
        "The requested room graph exceeds bounded interior dimensions.",
      );
  }
  const span = Array(rooms.length + 1).fill(0);
  for (const vertex of [...order].reverse())
    span[vertex] = Math.max(
      rooms[vertex - 1].width + 192,
      children[vertex].reduce((sum, child) => sum + span[child], 0),
    );
  const left = Array(rooms.length + 1).fill(64);
  const maxDepth = Math.max(...depth),
    levelY = [64];
  for (let level = 0; level < maxDepth; level++) {
    const vertices = order.filter((vertex) => depth[vertex] === level);
    levelY.push(
      levelY[level] +
        Math.max(...vertices.map((vertex) => rooms[vertex - 1].height)) +
        Math.max(...vertices.map((vertex) => children[vertex].length)) * 64 +
        128,
    );
  }
  for (const vertex of order) {
    const room = rooms[vertex - 1];
    const offset =
      ((hashString(`${config.layoutSeed}:position:${vertex}`) % 3) - 1) * TILE;
    room.x =
      left[vertex] + Math.floor((span[vertex] - room.width) / 32) * 16 + offset;
    room.y = levelY[depth[vertex]];
    let cursor =
      left[vertex] +
      Math.floor(
        (span[vertex] -
          children[vertex].reduce((sum, child) => sum + span[child], 0)) /
          32,
      ) *
        16;
    for (const child of children[vertex]) {
      left[child] = cursor;
      cursor += span[child];
    }
  }
  const routes = new Map();
  for (const vertex of order) {
    const room = rooms[vertex - 1];
    const centerX = room.x + Math.floor(room.width / TILE / 2) * TILE + 8;
    const sorted = [...children[vertex]].sort((a, b) => left[a] - left[b]);
    const departures = sorted.map((child, i) => ({
      child,
      port: centerX + (i - (sorted.length - 1) / 2) * 64,
      corridor: left[child] + 24,
    }));
    const leftward = departures.filter((edge) => edge.corridor < edge.port);
    const rightward = departures
      .filter((edge) => edge.corridor >= edge.port)
      .reverse();
    for (const edge of departures) {
      const target = rooms[edge.child - 1];
      const rank = (edge.corridor < edge.port ? leftward : rightward).indexOf(
        edge,
      );
      const fanY = room.y + room.height + 56 + rank * 64;
      const destination = {
        x: target.x + Math.floor(target.width / TILE / 2) * TILE + 8,
        y: target.y + Math.floor(target.height / TILE / 2) * TILE + 8,
      };
      routes.set(edge.child, [
        { x: edge.port, y: room.y + room.height - 24 },
        { x: edge.port, y: fanY },
        { x: edge.corridor, y: fanY },
        { x: edge.corridor, y: destination.y },
        destination,
      ]);
    }
  }
  const paths = edges.map(({ from, to }) => {
    const child = parent[to] === from ? to : from;
    const points = routes.get(child);
    return {
      from,
      to,
      points: parent[child] === from ? points : [...points].reverse(),
    };
  });
  const bounds = {
    width: span[1] + 128,
    height: Math.max(...rooms.map((room) => room.y + room.height)) + 64,
  };
  if (bounds.width > 8192 || bounds.height > 8192)
    throw new Error(
      "The interior exceeds the maximum world size. Try fewer rooms.",
    );
  return { paths, bounds, assignments };
}

function rasterize(rooms, paths, bounds, entrance) {
  const roomFloor = new Set(),
    floorKinds = new Map();
  const orientations = new Map();
  for (const room of rooms)
    for (let y = room.y / TILE; y < (room.y + room.height) / TILE; y++)
      for (let x = room.x / TILE; x < (room.x + room.width) / TILE; x++) {
        const tile = key(x, y);
        roomFloor.add(tile);
        floorKinds.set(tile, "floor");
      }
  const add = (x, y) => {
    if (
      x < 1 ||
      y < 1 ||
      (x + 1) * TILE >= bounds.width ||
      (y + 1) * TILE >= bounds.height
    )
      throw new Error("A corridor left the bounded interior.");
    if (!roomFloor.has(key(x, y))) floorKinds.set(key(x, y), "corridor");
  };
  for (const path of paths)
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1],
        b = path.points[i],
        dx = Math.sign(b.x - a.x),
        dy = Math.sign(b.y - a.y);
      const steps = Math.round(
        Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / TILE,
      );
      for (let step = 0; step <= steps; step++) {
        const x = Math.floor(a.x / TILE) + dx * step,
          y = Math.floor(a.y / TILE) + dy * step;
        for (let offset = -1; offset <= 1; offset++)
          add(x + (dy ? offset : 0), y + (dx ? offset : 0));
        if (step === 0 || step === steps)
          for (let sy = -1; sy <= 1; sy++)
            for (let sx = -1; sx <= 1; sx++) add(x + sx, y + sy);
      }
    }
  for (const [tile, kind] of floorKinds)
    if (kind === "corridor") {
      const [x, y] = tile.split(",").map(Number);
      if (
        [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ].some(([nx, ny]) => roomFloor.has(key(nx, ny)))
      )
        { floorKinds.set(tile, "door"); orientations.set(tile, roomFloor.has(key(x, y - 1)) || roomFloor.has(key(x, y + 1)) ? 'horizontal' : 'vertical'); }
    }
  for (const tile of entrance.floor) floorKinds.set(tile, tile === tileAt({ x: entrance.door.x + 8, y: entrance.door.y + 8 }) ? 'door' : 'corridor');
  orientations.set(tileAt({ x: entrance.door.x + 8, y: entrance.door.y + 8 }), entrance.door.orientation);
  const wall = new Set();
  for (const tile of floorKinds.keys()) {
    const [x, y] = tile.split(",").map(Number);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ])
      if (!floorKinds.has(key(nx, ny))) wall.add(key(nx, ny));
  }
  const floor = [...floorKinds.keys()].sort(sortKeys);
  const tiles = [
    ...floor.map((tile) => {
      const [x, y] = tile.split(",").map(Number);
      return { x: x * TILE, y: y * TILE, kind: floorKinds.get(tile), mask: connectionMask(floorKinds, x, y), ...(orientations.has(tile) ? { orientation: orientations.get(tile) } : {}) };
    }),
    ...[...wall].sort(sortKeys).map((tile) => {
      const [x, y] = tile.split(",").map(Number);
      return { x: x * TILE, y: y * TILE, kind: "wall" };
    }),
  ];
  return { floor, tiles };
}

function recordType(location, entry) {
  const text = `${entry.title || ""} ${entry.subtitle || ""}`.toLowerCase();
  if (
    /award|medal|champ|scholar|commendation/.test(text) ||
    location.type === "awards"
  )
    return "trophy";
  if (/teaching|tutor|mentor|oration/.test(text)) return "lectern";
  if (location.type === "research" || location.type === "publications")
    return "researchdesk";
  if (["education", "languages", "certifications"].includes(location.type))
    return "bookshelf";
  if (
    location.type === "projects" ||
    /programming|web development|computer|tools/.test(text)
  )
    return "computer";
  if (
    ["content", "activities"].includes(location.type) ||
    /creative|perform|poetry|actor|music/.test(text)
  )
    return "artboard";
  return "desk";
}

const SPRITES = {
  bookshelf: 479,
  researchdesk: 466,
  lectern: 365,
  artboard: 344,
  desk: 5,
  table: 5,
  bed: 197,
  chest: 232,
  lamp: 178,
  workbench: 365,
};
function baseObject(id, type, label, slot) {
  const sprite =
    type === "computer"
      ? { sheet: "dungeon", index: 54 }
      : type === "trophy"
        ? { sheet: "dungeon", index: 82 }
        : { sheet: "interior", index: SPRITES[type] ?? 5 };
  return {
    id,
    type,
    label,
    ...slot,
    width: 32,
    height: 32,
    solid: true,
    range: 48,
    interactAt: { x: slot.x + 8, y: slot.y + 40 },
    recordIds: [],
    hint: "Inspect",
    sprite,
    parts: furnitureParts(type, hashString(id) % 3),
    actions: [],
  };
}

function furnish(rooms, assignments, location, config) {
  const objects = [];
  for (const room of rooms) {
    const slots = furnitureSlots(room).sort(
      (a, b) =>
        hashString(
          `${config.layoutSeed}:furniture:${room.vertex}:${a.x},${a.y}`,
        ) -
          hashString(
            `${config.layoutSeed}:furniture:${room.vertex}:${b.x},${b.y}`,
          ) ||
        a.y - b.y ||
        a.x - b.x,
    );
    const used = new Set();
    for (const [index, entry] of assignments.get(room.vertex).entries()) {
      const type = recordType(location, entry),
        recordIds = entry.virtual ? [] : [entry.id];
      const object = baseObject(
        `${location.id}:record:${entry.id}`,
        type,
        entry.title || location.label,
        slots[index],
      );
      object.recordIds = recordIds;
      const subject =
        {
          computer: "terminal",
          researchdesk: "research desk",
          trophy: "trophy",
          bookshelf: "shelf",
          lectern: "lectern",
          artboard: "creative display",
          desk: "desk",
        }[type] || "display";
      const readLabel =
        {
          computer: "Open project notes",
          researchdesk: "Read research notes",
          trophy: "Examine achievement",
          bookshelf: "Read learning notes",
          lectern: "Read teaching notes",
          artboard: "View creative work",
          desk: "Read field notes",
        }[type] || "Read field notes";
      const sourceMessage = [
        entry.title,
        entry.subtitle,
        entry.dates,
        ...(entry.details || []),
      ]
        .filter((value) => typeof value === "string" && value.trim())
        .join("\n");
      object.hint = `Inspect ${subject}`;
      object.actions = [
        {
          id: "inspect",
          label: `Inspect ${subject}`,
          kind: "inspect",
          message: `The ${subject} holds notes for ${entry.title || location.label}. Choose “${readLabel}” to read them.`,
        },
        entry.virtual
          ? {
              id: "read",
              label: readLabel,
              kind: "inspect",
              message: sourceMessage,
            }
          : {
              id: "discover",
              label: readLabel,
              kind: "discover",
              recordIds,
              once: true,
              message: sourceMessage,
            },
      ];
      objects.push(object);
      used.add(index);
    }
    const available = slots
      .map((slot, index) => ({ slot, index }))
      .filter(({ index }) => !used.has(index));
    const random = seededRandom(
      hashString(`${config.decorationSeed}:props:${room.vertex}`),
    );
    const style = roomComposition(room.role);
    const shuffled = [...available].sort((a, b) => hashString(`${config.decorationSeed}:cluster:${room.vertex}:${a.index}`) - hashString(`${config.decorationSeed}:cluster:${room.vertex}:${b.index}`) || a.index - b.index);
    const count = Math.min(shuffled.length, Math.max(1, style.density - used.size));
    const placed = [...used].map(index => slots[index]);
    const offset = Math.floor(random() * style.features.length);
    const anchor = { foyer: 'arrival-bench', bedroom: 'bed', reading: 'reading-nook', catalog: 'archive-stack', research: 'researchdesk', archive: 'archive-stack', workshop: 'workbench', assembly: 'workbench', stage: 'music-corner', editing: 'computer', rehearsal: 'music-corner', greenroom: 'arrival-bench', living: 'reading-nook', study: 'desk', storage: 'parts-rack' }[room.role] || style.features[0];
    for (let i = 0; i < count; i++) {
      // Spread independent clusters around the usable perimeter; keep the central cross open.
      let best = 0;
      if (placed.length) for (let index = 1; index < shuffled.length; index++) {
        const score = candidate => Math.min(...placed.map(other => (candidate.slot.x - other.x) ** 2 + (candidate.slot.y - other.y) ** 2));
        if (score(shuffled[index]) > score(shuffled[best])) best = index;
      }
      const chosen = shuffled.splice(best, 1)[0]; placed.push(chosen.slot);
      const alternatives = style.features.filter(type => type !== anchor);
      const type = i === 0 ? anchor : alternatives[(offset + i - 1) % alternatives.length] || anchor;
      const object = baseObject(
        `${location.id}:furniture:${room.vertex}:${i}`,
        type,
        featureLabel(type),
        chosen.slot,
      );
      object.actions = [
        {
          id: "inspect",
          label: "Inspect",
          kind: "inspect",
          message: style.story,
        },
      ];
      objects.push(object);
    }
  }
  return objects;
}

/** Validates geometry and physical corridor-to-room incidence, not just abstract graph connectivity. */
export function validateInterior(interior) {
  if (!interior || interior.kind !== "interior")
    throw new Error("Expected an interior world.");
  const config = validateInteriorConfig(interior.config);
  if (
    !interior.bounds ||
    ![interior.bounds.width, interior.bounds.height].every(
      (number) =>
        Number.isSafeInteger(number) &&
        number % TILE === 0 &&
        number > 0 &&
        number <= 8192,
    )
  )
    throw new Error(
      "Interior bounds must be positive 16px-grid dimensions of at most 8192 pixels.",
    );
  if (
    !Array.isArray(interior.floor) ||
    !Array.isArray(interior.tiles) ||
    !Array.isArray(interior.objects) ||
    interior.objects.length > 141
  )
    throw new Error(
      "Interior floor, tiles and bounded object lists are required.",
    );
  if (
    !Array.isArray(interior.rooms) ||
    interior.rooms.length !== config.nodeCount
  )
    throw new Error("The generated room count differs from the configuration.");
  if (
    JSON.stringify(interior.sequence) !== JSON.stringify(config.sequence) ||
    JSON.stringify(encodePrufer(interior.edges, config.nodeCount)) !==
      JSON.stringify(config.sequence)
  )
    throw new Error(
      "The generated topology differs from the requested Prüfer sequence.",
    );
  if (
    !Array.isArray(interior.paths) ||
    interior.paths.length !== config.nodeCount - 1
  )
    throw new Error("Every room edge needs one physical corridor.");
  const degree = Array(config.nodeCount + 1).fill(0);
  for (const edge of interior.edges) {
    degree[edge.from]++;
    degree[edge.to]++;
  }
  const vertices = new Set(),
    roomTiles = new Map();
  for (const room of interior.rooms) {
    if (
      !Number.isSafeInteger(room.vertex) ||
      room.vertex < 1 ||
      room.vertex > config.nodeCount ||
      vertices.has(room.vertex)
    )
      throw new Error("Rooms need distinct labeled vertices.");
    vertices.add(room.vertex);
    if (
      ![room.x, room.y, room.width, room.height].every(
        (number) => Number.isSafeInteger(number) && number % TILE === 0,
      ) ||
      room.width < 128 ||
      room.height < 128 ||
      room.width > 640 ||
      room.height > 256
    )
      throw new Error(
        "Room geometry must remain within bounded 16px-grid dimensions.",
      );
    if (
      room.x < 16 ||
      room.y < 16 ||
      room.x + room.width > interior.bounds.width - 16 ||
      room.y + room.height > interior.bounds.height - 16
    )
      throw new Error("A room lies outside its world bounds.");
    if (PRIVATE.has(room.role) && degree[room.vertex] !== 1)
      throw new Error(
        "Private and storage rooms must be leaves, never through routes.",
      );
    for (const other of interior.rooms)
      if (other.vertex > room.vertex && rectanglesOverlap(room, other))
        throw new Error("Interior rooms overlap.");
    for (let y = room.y / TILE; y < (room.y + room.height) / TILE; y++)
      for (let x = room.x / TILE; x < (room.x + room.width) / TILE; x++)
        roomTiles.set(key(x, y), room.vertex);
  }
  if (
    interior.rooms.find((room) => room.vertex === 1)?.role !== "foyer" ||
    !interior.rooms.some((room) => room.role === REQUIRED[config.archetype])
  )
    throw new Error(
      "The archetype is missing its entrance or required functional room.",
    );
  const floor = new Set(interior.floor);
  if (floor.size !== interior.floor.length || floor.size > 50000)
    throw new Error(
      "Interior floor data is duplicated or exceeds the bounded tile budget.",
    );
  for (const tile of floor) {
    if (typeof tile !== "string" || !/^\d+,\d+$/.test(tile))
      throw new Error(
        "Floor keys must contain exactly two integer tile coordinates.",
      );
    const [x, y] = tile.split(",").map(Number);
    if (
      !Number.isSafeInteger(x) ||
      !Number.isSafeInteger(y) ||
      x < 0 ||
      y < 0 ||
      x * TILE >= interior.bounds.width ||
      y * TILE >= interior.bounds.height
    )
      throw new Error("A floor tile lies outside the interior.");
  }
  const seenTiles = new Set(),
    renderedFloor = new Set();
  for (const tile of interior.tiles) {
    if (
      ![tile.x, tile.y].every(
        (number) =>
          Number.isSafeInteger(number) && number % TILE === 0 && number >= 0,
      ) ||
      tile.x + TILE > interior.bounds.width ||
      tile.y + TILE > interior.bounds.height ||
      !["wall", "floor", "corridor", "door"].includes(tile.kind)
    )
      throw new Error(
        "Rendered tiles must use bounded pixel-grid coordinates and known kinds.",
      );
    const tileKey = key(tile.x / TILE, tile.y / TILE);
    if (seenTiles.has(tileKey)) throw new Error("Rendered tiles overlap.");
    seenTiles.add(tileKey);
    if (tile.kind === "wall" && floor.has(tileKey))
      throw new Error("A wall tile overlaps walkable floor.");
    if (tile.kind !== "wall") renderedFloor.add(tileKey);
  }
  if (
    renderedFloor.size !== floor.size ||
    [...floor].some((tile) => !renderedFloor.has(tile))
  )
    throw new Error("Rendered floor differs from collision floor.");
  for (const tile of roomTiles.keys())
    if (!floor.has(tile)) throw new Error("A room is missing walkable floor.");
  const blocked = new Set(),
    ids = new Set();
  for (const object of interior.objects) {
    if (!object.id || ids.has(object.id))
      throw new Error("Interior objects need stable, unique identifiers.");
    ids.add(object.id);
    if (
      ![object.x, object.y, object.width, object.height].every(
        (number) => Number.isSafeInteger(number) && number % TILE === 0,
      ) ||
      object.width < 16 ||
      object.height < 16
    )
      throw new Error("Furniture must use bounded grid rectangles.");
    if (object.solid && pointIn(object.interactAt, object))
      throw new Error("An interaction point is inside its solid object.");
    for (let y = object.y / TILE; y < (object.y + object.height) / TILE; y++)
      for (let x = object.x / TILE; x < (object.x + object.width) / TILE; x++) {
        const tile = key(x, y);
        if (!floor.has(tile))
          throw new Error("Furniture was placed outside the floor.");
        if (object.solid) {
          if (blocked.has(tile)) throw new Error("Solid furniture overlaps.");
          blocked.add(tile);
        }
      }
    if (!Array.isArray(object.actions) || !object.actions.length)
      throw new Error("Every interior object needs an explicit action.");
  }
  const traversable = (tile) => floor.has(tile) && !blocked.has(tile);
  const start = tileAt(interior.spawn);
  if (!traversable(start)) throw new Error("Interior spawn is blocked.");
  const reached = new Set([start]),
    queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i].split(",").map(Number);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      const next = key(nx, ny);
      if (traversable(next) && !reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
    }
  }
  for (const room of interior.rooms)
    if (
      !reached.has(
        tileAt({
          x: room.x + Math.floor(room.width / TILE / 2) * TILE + 8,
          y: room.y + Math.floor(room.height / TILE / 2) * TILE + 8,
        }),
      )
    )
      throw new Error("A required room is inaccessible.");
  for (const object of interior.objects)
    if (!reached.has(tileAt(object.interactAt)))
      throw new Error(
        `The interaction point at ${object.label} is inaccessible.`,
      );
  if (
    !reached.has(tileAt(interior.exit)) ||
    !interior.objects.some(
      (object) =>
        !object.solid &&
        object.actions.some((action) => action.kind === "exit"),
    )
  )
    throw new Error("The building exit is missing or inaccessible.");
  const entry = interior.entrance, foyer = interior.rooms.find(room => room.vertex === entry?.room);
  const exitObject = interior.objects.find(object => object.actions.some(action => action.kind === 'exit'));
  if (!entry || !foyer || entry.side !== 'north' || entry.door.y + TILE !== foyer.y || entry.door.x < foyer.x || entry.door.x + TILE > foyer.x + foyer.width
    || entry.door.x + 8 !== interior.exit.x || entry.door.y + 8 !== interior.exit.y || exitObject.x !== entry.door.x || exitObject.y !== entry.door.y
    || !reached.has(tileAt(entry.inside)) || !reached.has(tileAt(entry.outside)) || !pointIn(entry.inside, foyer) || pointIn(interior.exit, foyer)) {
    throw new Error('The exit must align with an open room boundary and clear floor on both sides.');
  }
  for (const [index, path] of interior.paths.entries()) {
    const edge = interior.edges[index];
    if (
      path.from !== edge.from ||
      path.to !== edge.to ||
      !pointIn(path.points[0], interior.rooms[path.from - 1]) ||
      !pointIn(path.points.at(-1), interior.rooms[path.to - 1])
    )
      throw new Error(
        "A corridor does not connect its requested room endpoints.",
      );
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1],
        b = path.points[i];
      if (a.x !== b.x && a.y !== b.y)
        throw new Error("Corridors must use orthogonal grid segments.");
      const steps = Math.round(
        Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / TILE,
      );
      for (let step = 0; step <= steps; step++)
        if (
          !traversable(
            tileAt({
              x: a.x + Math.sign(b.x - a.x) * step * TILE,
              y: a.y + Math.sign(b.y - a.y) * step * TILE,
            }),
          )
        )
          throw new Error("A required corridor is blocked.");
    }
  }
  // Remove room interiors: each remaining corridor component must join exactly one requested edge.
  const remaining = new Set([...floor].filter((tile) => !roomTiles.has(tile)));
  for (const tile of interior.entrance?.floor || []) remaining.delete(tile);
  const physicalEdges = [];
  while (remaining.size) {
    const first = remaining.values().next().value,
      component = [first],
      adjacentRooms = new Set();
    remaining.delete(first);
    for (let i = 0; i < component.length; i++) {
      const [x, y] = component[i].split(",").map(Number);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        const tile = key(nx, ny);
        if (roomTiles.has(tile)) adjacentRooms.add(roomTiles.get(tile));
        if (remaining.has(tile)) {
          remaining.delete(tile);
          component.push(tile);
        }
      }
    }
    if (adjacentRooms.size !== 2)
      throw new Error("Corridors created an unintended room junction.");
    physicalEdges.push([...adjacentRooms].sort((a, b) => a - b).join("-"));
  }
  const expected = interior.edges
    .map(({ from, to }) => [from, to].sort((a, b) => a - b).join("-"))
    .sort();
  if (JSON.stringify(physicalEdges.sort()) !== JSON.stringify(expected))
    throw new Error(
      "Physical room connectivity does not preserve the requested tree.",
    );
  return true;
}

export function generateInterior(resume, location, requestedConfig) {
  const config = validateInteriorConfig(
    requestedConfig ?? defaultInteriorConfig(resume, location),
    location,
  );
  const entries = entriesFor(resume, location);
  if (entries.length > 120)
    throw new Error(
      "This section exceeds the bounded 120-record interior limit. Its full content remains available in the journal.",
    );
  const edges = decodePrufer(config.sequence, config.nodeCount);
  const rooms = semanticRooms(config, edges);
  const { paths, bounds, assignments } = layoutRooms(
    rooms,
    edges,
    config,
    entries,
  );
  const foyer = rooms[0];
  const exit = {
    x: foyer.x + Math.floor(foyer.width / TILE / 2) * TILE + 8,
    y: foyer.y - 8,
  };
  const entrance = { room: foyer.vertex, side: 'north', inside: { x: exit.x, y: foyer.y + 8 }, outside: { x: exit.x, y: foyer.y - 24 }, door: { x: exit.x - 8, y: foyer.y - 16, width: 16, height: 16, orientation: 'horizontal' }, floor: [tileAt(exit), tileAt({ x: exit.x, y: foyer.y - 24 })] };
  const spawn = { x: exit.x, y: foyer.y + 24 };
  const { floor, tiles } = rasterize(rooms, paths, bounds, entrance);
  const objects = furnish(rooms, assignments, location, config);
  objects.push({
    id: `${location.id}:exit`,
    type: "door",
    label: "Village door",
    x: exit.x - 8,
    y: exit.y - 8,
    width: 16,
    height: 16,
    solid: false,
    range: 40,
    interactAt: { ...entrance.inside },
    recordIds: [],
    hint: "Leave building",
    sprite: { sheet: "town", index: 74 },
    actions: [{ id: "leave", label: "Leave building", kind: "exit" }],
  });
  const interior = {
    id: `interior-${location.id}`,
    kind: "interior",
    label: location.label,
    buildingId: location.id,
    archetype: config.archetype,
    config,
    algorithmVersion: VERSION,
    geometryVersion: 4,
    entrance,
    bounds,
    spawn,
    exit,
    rooms,
    sequence: [...config.sequence],
    edges,
    paths,
    tiles,
    floor,
    objects,
  };
  validateInterior(interior);
  return interior;
}
