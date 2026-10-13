export type Link = { label: string; url: string };
export type Entry = { id: string; title: string; subtitle?: string; dates?: string; details: string[]; links?: Link[] };
export type Section = { id: string; type: string; label: string; entries: Entry[] };
export type Resume = { schemaVersion: number; sourceHash: string; name: string; title: string; summary: string; contact: { email?: string; phone?: string; location?: string }; links: Link[]; sections: Section[]; sourceText: string };
export type Point = { x: number; y: number };
export type Location = { id: string; vertex: number; label: string; sectionId: string; type: string; buildingType: string; importance: number; size: { width: number; height: number }; x: number; y: number; entrance: Point; recordIds: string[]; variation: number };
export type World = { schemaVersion: number; seed: string | number; sequence: number[]; locations: Location[]; edges: { from: number; to: number }[]; paths: { from: number; to: number; points: Point[] }[]; bounds: { width: number; height: number }; spawn: Point; decorations: { x: number; y: number; kind: string; variant: number }[] };
