export type Link = { label: string; url: string };
export type Entry = {
  id: string;
  title: string;
  subtitle?: string;
  dates?: string;
  details: string[];
  links?: Link[];
};
export type Section = {
  id: string;
  type: string;
  label: string;
  entries: Entry[];
};
export type Resume = {
  schemaVersion: number;
  sourceHash: string;
  name: string;
  title: string;
  summary: string;
  contact: { email?: string; phone?: string; location?: string };
  links: Link[];
  sections: Section[];
  sourceText: string;
};
export type Point = { x: number; y: number };
export type Location = {
  id: string;
  vertex: number;
  label: string;
  sectionId: string;
  type: string;
  buildingType: string;
  importance: number;
  size: { width: number; height: number };
  x: number;
  y: number;
  entrance: Point;
  recordIds: string[];
  variation: number;
};
export type World = {
  schemaVersion: number;
  seed: string | number;
  sequence: number[];
  locations: Location[];
  edges: { from: number; to: number }[];
  paths: { from: number; to: number; points: Point[] }[];
  bounds: { width: number; height: number };
  spawn: Point;
  decorations: { x: number; y: number; kind: string; variant: number }[];
};
export type ObjectAction = {
  id: string;
  label: string;
  kind: string;
  recordIds?: string[];
  message?: string;
  once?: boolean;
  requires?: { item: string; quantity?: number };
  questId?: string;
  buildingId?: string;
  reward?:
    | string
    | { item?: string; quantity?: number; items?: Record<string, number> };
  [key: string]: unknown;
};
export type GameObject = {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  solid: boolean;
  range: number;
  interactAt: Point;
  recordIds: string[];
  hint: string;
  sprite: { sheet: "town" | "dungeon" | "interior"; index: number };
  actions: ObjectAction[];
  buildingId?: string;
  [key: string]: unknown;
};
export type Room = {
  vertex: number;
  role: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type GameScene = {
  id: string;
  kind: "village" | "interior";
  label: string;
  bounds: { width: number; height: number };
  spawn: Point;
  locations?: Location[];
  paths: { from: number; to: number; points: Point[] }[];
  decorations?: { x: number; y: number; kind: string; variant: number }[];
  objects: GameObject[];
  rooms?: Room[];
  tiles?: {
    x: number;
    y: number;
    kind: "floor" | "wall" | "corridor" | "door";
  }[];
  floor?: string[];
  exit?: Point;
  buildingId?: string;
  archetype?: string;
  config?: InteriorConfig;
  sequence?: number[];
  edges?: { from: number; to: number }[];
};
export type InteriorConfig = {
  algorithmVersion: 2;
  scope: "interior";
  buildingId: string;
  archetype: string;
  nodeCount: number;
  sequence: number[];
  layoutSeed: string;
  decorationSeed: string;
};
export type VillageConfig = {
  algorithmVersion: 2;
  scope: "village";
  nodeCount: number;
  sequence: number[];
  layoutSeed: string;
  decorationSeed: string;
};
export type Progress = {
  version: 2;
  resumeHash: string;
  unlocked: string[];
  visited: string[];
  opened: string[];
  items: Record<string, number>;
  flags: Record<string, unknown>;
  quests: Record<string, string>;
  position: {
    scene: "village" | "interior";
    buildingId?: string;
    point: Point;
  };
  configs: {
    village: VillageConfig | null;
    interiors: Record<string, InteriorConfig>;
  };
  stats: { battlesWon: number };
  completedActions: string[];
  defeated: string[];
  recordSections: Record<string, string>;
  [key: string]: unknown;
};
export type BattleState = {
  version: number;
  id?: string;
  status: "active" | "victory" | "defeat" | "retreated";
  turn: string;
  round: number;
  grid: { width: number; height: number; blocked: Point[] };
  player: {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    guard: boolean;
    focus: number;
  };
  enemy: {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    type: string;
    intent: string;
  };
  moved: boolean;
  acted: boolean;
  log: string[];
  [key: string]: unknown;
};
