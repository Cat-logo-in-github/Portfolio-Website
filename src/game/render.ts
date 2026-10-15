import type { GameObject, GameScene, Point } from "../types";
import { decorationBounds } from "./physics.mjs";
import { characterFrame, npcFrame } from './animation.mjs';
import { characterTexture } from './character-texture.mjs';

export type SpriteSheets = {
  town: HTMLImageElement;
  dungeon: HTMLImageElement;
  interior: HTMLImageElement;
  player?: HTMLImageElement;
  npc?: HTMLImageElement;
};
export type View = { left: number; top: number; width: number; height: number };
const TILE = 16;
const interiorFloors = new WeakMap<GameScene, Map<string, string>>();

function sprite(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  index: number,
  x: number,
  y: number,
  width = TILE,
  height = TILE,
  columns = 12,
  spacing = 0,
) {
  if (!sheet.complete || !sheet.naturalWidth) return;
  const stride = TILE + spacing;
  ctx.drawImage(
    sheet,
    (index % columns) * stride,
    Math.floor(index / columns) * stride,
    TILE,
    TILE,
    Math.round(x),
    Math.round(y),
    width,
    height,
  );
}

const visible = (view: View, x: number, y: number, w = 16, h = 16) =>
  x + w >= view.left - 16 &&
  y + h >= view.top - 16 &&
  x <= view.left + view.width + 16 &&
  y <= view.top + view.height + 16;

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color = "#f6edce",
) {
  ctx.font = "8px Pixel, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const width = ctx.measureText(text).width;
  ctx.fillStyle = "#20332eef";
  ctx.fillRect(
    Math.round(x - width / 2 - 5),
    Math.round(y - 7),
    Math.ceil(width + 10),
    15,
  );
  ctx.fillStyle = color;
  ctx.fillText(text, Math.round(x), Math.round(y + 1));
}

export function drawVillage(
  ctx: CanvasRenderingContext2D,
  scene: GameScene,
  sheets: SpriteSheets,
  view: View,
) {
  for (
    let y = Math.floor(view.top / TILE) * TILE;
    y < view.top + view.height + TILE;
    y += TILE
  ) {
    for (
      let x = Math.floor(view.left / TILE) * TILE;
      x < view.left + view.width + TILE;
      x += TILE
    ) {
      const hash = Math.abs(((x * 73856093) ^ (y * 19349663)) >>> 0);
      sprite(
        ctx,
        sheets.town,
        hash % 31 === 0 ? 2 : hash % 9 === 0 ? 1 : 0,
        x,
        y,
      );
    }
  }
  for (const path of scene.paths) {
    ctx.beginPath();
    path.points.forEach((point, i) =>
      i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
    );
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "#849254";
    ctx.lineWidth = 28;
    ctx.stroke();
    ctx.strokeStyle = "#d6ae75";
    ctx.lineWidth = 22;
    ctx.stroke();
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1],
        b = path.points[i],
        length = Math.hypot(b.x - a.x, b.y - a.y);
      for (let d = 0; d <= length; d += 14) {
        const t = length ? d / length : 0;
        sprite(
          ctx,
          sheets.town,
          25,
          a.x + (b.x - a.x) * t - 8,
          a.y + (b.y - a.y) * t - 8,
        );
      }
    }
  }
  for (const decoration of scene.decorations || []) {
    const bounds = decorationBounds(decoration);
    if (!visible(view, bounds.x, bounds.y, bounds.width, bounds.height))
      continue;
    const variation = Number(decoration.variant || 0);
    const index =
      decoration.kind === "tree"
        ? [4, 5, 3][variation % 3]
        : decoration.kind === "rock"
          ? 30
          : ["flower", "flowers"].includes(decoration.kind)
            ? 2
            : [28, 27, 29][variation % 3];
    sprite(
      ctx,
      sheets.town,
      index,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
    );
  }
  for (const location of scene.locations || []) {
    if (
      !visible(
        view,
        location.x,
        location.y - 25,
        location.size.width,
        location.size.height + 25,
      )
    )
      continue;
    const cols = Math.max(3, Math.round(location.size.width / TILE)),
      rows = Math.max(3, Math.round(location.size.height / TILE));
    const orange = Number(location.variation) % 2 === 1,
      roof = orange ? 52 : 48,
      lower = orange ? 64 : 60,
      middle = Math.floor(cols / 2);
    ctx.fillStyle = "#43544555";
    ctx.fillRect(
      location.x + 5,
      location.y + 6,
      location.size.width,
      location.size.height,
    );
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        let index;
        if (row === 0)
          index = col === 0 ? roof : col === cols - 1 ? roof + 2 : roof + 1;
        else if (row === 1)
          index =
            col === 0
              ? lower
              : col === cols - 1
                ? lower + 2
                : col === middle
                  ? lower + 3
                  : lower + 1;
        else if (row === rows - 1)
          index =
            col === middle
              ? 85
              : col === 0
                ? 72
                : col === cols - 1
                  ? 75
                  : col % 2
                    ? 84
                    : 73;
        else index = col === 0 ? 76 : col === cols - 1 ? 79 : col % 2 ? 88 : 77;
        sprite(
          ctx,
          sheets.town,
          index,
          location.x + col * TILE,
          location.y + row * TILE,
        );
      }
    label(
      ctx,
      `${location.vertex} · ${location.label}`,
      location.x + location.size.width / 2,
      location.y - 14,
    );
  }
}

function floorMap(scene: GameScene) {
  const cached = interiorFloors.get(scene);
  if (cached) return cached;
  const floor = new Map<string, string>();
  for (const key of scene.floor || []) floor.set(key, "floor");
  // The generator's tiles use world pixels; its compact floor keys use tile coordinates.
  for (const tile of scene.tiles || [])
    if (tile.kind !== "wall")
      floor.set(`${tile.x / TILE},${tile.y / TILE}`, tile.kind);
  interiorFloors.set(scene, floor);
  return floor;
}

export function drawInterior(
  ctx: CanvasRenderingContext2D,
  scene: GameScene,
  sheets: SpriteSheets,
  view: View,
) {
  const floor = floorMap(scene),
    fromX = Math.floor(view.left / TILE) - 1,
    fromY = Math.floor(view.top / TILE) - 1;
  const maxX = Math.ceil((view.left + view.width) / TILE) + 1,
    maxY = Math.ceil((view.top + view.height) / TILE) + 1;
  const stone =
    scene.archetype === "arena" ||
    scene.archetype === "guild" ||
    scene.archetype === "workshop";
  for (let y = fromY; y < maxY; y++)
    for (let x = fromX; x < maxX; x++) {
      const key = `${x},${y}`,
        kind = floor.get(key),
        px = x * TILE,
        py = y * TILE;
      if (kind) {
        const hash = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
        sprite(
          ctx,
          sheets.dungeon,
          stone ? (hash % 11 === 0 ? 24 : 0) : hash % 19 === 0 ? 49 : 48,
          px,
          py,
        );
        if (kind === "corridor") {
          ctx.fillStyle = "#2a2b3025";
          ctx.fillRect(px, py, TILE, TILE);
        }
        if (kind === "door") {
          ctx.fillStyle = "#d4aa6a";
          ctx.fillRect(px, py + 7, TILE, 2);
          ctx.fillStyle = "#745544";
          ctx.fillRect(px, py, 2, TILE);
          ctx.fillRect(px + 14, py, 2, TILE);
        }
      } else {
        const adjacent = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ].some(([dx, dy]) => floor.has(`${x + dx},${y + dy}`));
        if (adjacent) {
          sprite(
            ctx,
            stone ? sheets.dungeon : sheets.town,
            stone ? 14 : 73,
            px,
            py,
          );
          ctx.fillStyle = "#1a242a80";
          ctx.fillRect(px, py + 12, TILE, 4);
          if (floor.has(`${x},${y + 1}`)) {
            ctx.fillStyle = "#ecdcb844";
            ctx.fillRect(px, py + 12, TILE, 1);
          }
        }
      }
    }
  for (const room of scene.rooms || []) {
    if (!visible(view, room.x, room.y, room.width, room.height)) continue;
    // A shallow rug in public rooms gives each function a recognizable focal area.
    const color =
      room.role.includes("reading") || room.role.includes("research")
        ? "#526aa32d"
        : room.role.includes("arena") || room.role.includes("spar")
          ? "#a94f482d"
          : "#9c705b20";
    ctx.fillStyle = color;
    ctx.fillRect(
      room.x + 16,
      room.y + 16,
      Math.max(0, room.width - 32),
      Math.max(0, room.height - 32),
    );
    label(ctx, room.label, room.x + room.width / 2, room.y - 7, "#e5d9be");
  }
}

function fallbackFurniture(
  ctx: CanvasRenderingContext2D,
  object: GameObject,
  sheets: SpriteSheets,
  opened: boolean,
) {
  const { x, y, width, height, type } = object;
  if (type === "door") {
    sprite(ctx, sheets.town, 74, x, y, width, height);
    return;
  }
  const index =
    (
      {
        computer: 54,
        bookshelf: 75,
        researchdesk: 72,
        trophy: 82,
        lectern: 66,
        artboard: 63,
        desk: 72,
        bed: 68,
        chest: opened ? 92 : 89,
        lamp: 29,
        table: 72,
        workbench: 75,
        counter: 72,
      } as Record<string, number>
    )[type] ?? object.sprite.index;
  sprite(ctx, sheets.dungeon, index, x, y, width, height);
  // Existing prop tiles placed on tables make the station's function easier to read.
  if (["researchdesk", "desk", "workbench"].includes(type))
    sprite(
      ctx,
      sheets.town,
      type === "workbench" ? 118 : 83,
      x + width / 2 - 5,
      y - 2,
      10,
      10,
    );
  if (type === "bed") {
    sprite(ctx, sheets.dungeon, 68, x, y, width, Math.min(16, height));
    sprite(
      ctx,
      sheets.dungeon,
      81,
      x,
      y + Math.min(16, height),
      width,
      Math.max(0, height - 16),
    );
  }
}

function furniture(
  ctx: CanvasRenderingContext2D,
  object: GameObject,
  sheets: SpriteSheets,
  opened: boolean,
) {
  if (!sheets.interior.complete || !sheets.interior.naturalWidth) {
    fallbackFurniture(ctx, object, sheets, opened);
    return;
  }
  const { x, y, width, height, type } = object;
  if (type === "door") {
    sprite(ctx, sheets.town, 74, x, y, width, height);
    return;
  }
  const tile = (index: number, px = x, py = y, w = width, h = height) =>
    sprite(ctx, sheets.interior, index, px, py, w, h, 27, 1);
  const table = () => {
    if (width <= 16) tile(5);
    else {
      tile(0, x, y, 16, height);
      for (let px = x + 16; px < x + width - 16; px += 16)
        tile(1, px, y, 16, height);
      tile(2, x + width - 16, y, 16, height);
    }
  };
  if (type === "bed") {
    if (height <= 16) tile(197);
    else {
      tile(197, x, y, width, 16);
      for (let py = y + 16; py < y + height - 16; py += 16)
        tile(200, x, py, width, 16);
      tile(230, x, y + height - 16, width, 16);
    }
  } else if (type === "bookshelf") tile(479);
  else if (type === "chest")
    sprite(ctx, sheets.dungeon, opened ? 92 : 89, x, y, width, height);
  else if (type === "computer") {
    table();
    sprite(ctx, sheets.dungeon, 54, x + width / 2 - 6, y, 12, 12);
  } else if (["desk", "researchdesk", "lectern"].includes(type)) {
    table();
    tile(475, x + width / 2 - 6, y + 1, 12, 12);
  } else if (type === "workbench") {
    table();
    sprite(ctx, sheets.town, 118, x + width / 2 - 6, y, 12, 12);
  } else if (type === "table") table();
  else if (type === "counter") tile(365);
  else if (type === "artboard") tile(344);
  else if (type === "lamp") tile(178);
  else if (type === "trophy")
    sprite(ctx, sheets.dungeon, 82, x, y, width, height);
  else tile(object.sprite.index);
}

export function drawObject(
  ctx: CanvasRenderingContext2D,
  object: GameObject,
  sheets: SpriteSheets,
  nearbyId: string,
  unlockedIds: string[],
  openedIds: string[],
  view: View,
  timeMs = 0,
  reducedMotion = false,
) {
  if (
    !visible(
      view,
      object.x - 4,
      object.y - 16,
      object.width + 8,
      object.height + 20,
    )
  )
    return;
  const opened = openedIds.includes(object.id),
    unlocked =
      object.recordIds.length > 0 &&
      object.recordIds.every((id) => unlockedIds.includes(id));
  if (object.solid) {
    ctx.fillStyle = "#171c2445";
    ctx.fillRect(object.x + 2, object.y + 2, object.width, object.height);
  }
  if (object.type === 'npc' && sheets.npc?.complete && sheets.npc.naturalWidth) {
    const frame = npcFrame(object.id, timeMs, nearbyId === object.id, reducedMotion);
    ctx.drawImage(sheets.npc, frame.x, frame.y, frame.width, frame.height, Math.round(object.x), Math.round(object.y), object.width, object.height);
  } else if (object.sprite.sheet === "interior")
    furniture(ctx, object, sheets, opened);
  else {
    const index = object.type === "chest" && opened ? 92 : object.sprite.index;
    sprite(
      ctx,
      sheets[object.sprite.sheet],
      index,
      object.x,
      object.y,
      object.width,
      object.height,
    );
  }
  if (unlocked || opened) {
    ctx.fillStyle = "#90d6ac";
    ctx.fillRect(object.x + object.width - 4, object.y - 4, 3, 3);
  } else if (object.recordIds.length) {
    ctx.fillStyle = "#efd578";
    ctx.fillRect(object.x + object.width / 2 - 1, object.y - 5, 3, 3);
  }
  if (object.actions.some(action => ['puzzle', 'storyboss', 'storytravel', 'lore'].includes(action.kind))) {
    const center = object.x + object.width / 2, offset = reducedMotion ? 0 : Math.round(Math.sin(timeMs / 300) * .75);
    ctx.fillStyle = '#c7b5ff'; ctx.beginPath(); ctx.moveTo(center, object.y - 10 + offset); ctx.lineTo(center + 3, object.y - 7 + offset); ctx.lineTo(center, object.y - 4 + offset); ctx.lineTo(center - 3, object.y - 7 + offset); ctx.closePath(); ctx.fill();
  }
  if (object.id === nearbyId) {
    const target = object.interactAt;
    ctx.strokeStyle = "#ffe5a0";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      object.x - 1,
      object.y - 1,
      object.width + 2,
      object.height + 2,
    );
    ctx.fillStyle = "#ffe5a0";
    ctx.fillRect(target.x - 4, target.y - 1, 8, 2);
    label(
      ctx,
      object.label,
      object.x + object.width / 2,
      object.y - 13,
      "#ffe5a0",
    );
  }
}

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  sheets: SpriteSheets,
  point: Point,
  facing: string,
  state = 'idle',
  elapsedMs = 0,
  reducedMotion = false,
) {
  ctx.fillStyle = "#293c3266";
  ctx.beginPath();
  ctx.ellipse(point.x, point.y + 1, 6, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  const texture = characterTexture(sheets.player);
  if (texture) {
    const frame = characterFrame(state, facing, elapsedMs, reducedMotion);
    ctx.drawImage(texture, frame.x, frame.y, frame.width, frame.height, Math.round(point.x - 8), Math.round(point.y - 15), 16, 16);
  } else {
    ctx.save(); ctx.translate(Math.round(point.x), Math.round(point.y - 12)); ctx.scale(facing === 'left' ? -1 : 1, 1); sprite(ctx, sheets.dungeon, 98, -8, -4); ctx.restore();
  }
}
