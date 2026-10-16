import { generateWorld, hashString, seededRandom } from './world.mjs';
import { defaultInteriorConfig, randomSequence } from './interior.mjs';

export const SAVE_BOOK_KEY = 'parshwa-world:expeditions:v3';
export const LEGACY_SAVE_KEY = 'parshwa-world:journey:v2';
export const EXPEDITION_VERSION = 4;
export const MAX_EXPEDITIONS = 12;

export function normalizeSeed(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 64) throw Error('Enter a seed with 1–64 characters.');
  return value.trim();
}

/** Fresh randomness selects a shareable seed; generation itself is entirely seeded. */
export function freshSeed() {
  const bytes = new Uint32Array(2);
  globalThis.crypto.getRandomValues(bytes);
  return `field-${bytes[0].toString(36)}-${bytes[1].toString(36)}`;
}

export function expeditionVillageConfig(resume, seed) {
  seed = normalizeSeed(seed);
  const count = generateWorld(resume).locations.length;
  const random = seededRandom(hashString(`expedition-v3:${seed}:village-topology`));
  return { algorithmVersion: 2, scope: 'village', nodeCount: count, sequence: Array.from({ length: Math.max(0, count - 2) }, () => 1 + Math.floor(random() * count)), layoutSeed: `v3:${seed}:layout`, decorationSeed: `v3:${seed}:decoration` };
}

export function expeditionInteriorConfig(resume, location, seed) {
  seed = normalizeSeed(seed);
  const base = defaultInteriorConfig(resume, location);
  const identity = hashString(location.id).toString(36);
  const prefix = `v3:${seed}:${identity}`;
  return { ...base, sequence: randomSequence(base.nodeCount, `${prefix}:topology`), layoutSeed: `${prefix}:rooms`, decorationSeed: `${prefix}:props` };
}

export function createSaveBook(legacySave = '', seed = freshSeed()) {
  const legacy = typeof legacySave === 'string' && legacySave.length > 0;
  const slot = { id: legacy ? 'legacy-v2' : 'expedition-1', seed: legacy ? 'legacy-v2' : normalizeSeed(seed), name: legacy ? 'Your version 2 journey' : 'First expedition', legacy, save: legacy ? legacySave : '' };
  return { version: 3, activeId: slot.id, slots: [slot], preferences: { audio: { master: 0.6, music: 0.35, sfx: 0.6, muted: false }, encounters: true, profile: 'calm' } };
}

export function activeSlot(book) {
  const slot = book.slots.find(s => s.id === book.activeId);
  if (!slot) throw Error('Choose an existing expedition.');
  return slot;
}

export function startExpedition(book, seed, name = '') {
  if (book.slots.length >= MAX_EXPEDITIONS) throw Error(`You already have ${MAX_EXPEDITIONS} expeditions. Export your save book to keep a backup. Existing saves have been preserved.`);
  seed = normalizeSeed(seed);
  let counter = book.slots.length + 1;
  while (book.slots.some(s => s.id === `expedition-${counter}`)) counter++;
  const slot = { id: `expedition-${counter}`, seed, name: name.trim().slice(0, 80) || `Expedition ${counter}`, legacy: false, save: '' };
  return { ...book, activeId: slot.id, slots: [...book.slots, slot] };
}

export function selectExpedition(book, id) {
  if (!book.slots.some(s => s.id === id)) throw Error('That expedition is not in this save book.');
  return { ...book, activeId: id };
}

export function storeActiveProgress(book, save) {
  if (typeof save !== 'string' || save.length > 1000000) throw Error('The journey save is too large.');
  return { ...book, slots: book.slots.map(s => s.id === book.activeId ? { ...s, save } : s) };
}

export function serializeSaveBook(book) { return JSON.stringify(book); }

export function restoreSaveBook(json, legacySave = '', seed = freshSeed()) {
  if (!json) return { book: createSaveBook(legacySave, seed) };
  try {
    if (typeof json !== 'string' || json.length > 10000000) throw Error('The save book is invalid or too large.');
    const raw = JSON.parse(json);
    if (!raw || raw.version !== 3 || !Array.isArray(raw.slots) || !raw.slots.length || raw.slots.length > MAX_EXPEDITIONS) throw Error('Unsupported expedition save-book version.');
    const ids = new Set();
    const slots = raw.slots.map(s => {
      if (!s || typeof s.id !== 'string' || !/^[a-z0-9-]{1,60}$/.test(s.id) || ids.has(s.id)) throw Error('Invalid expedition identifier.');
      ids.add(s.id);
      if (typeof s.save !== 'string' || s.save.length > 1000000 || typeof s.name !== 'string' || s.name.length > 80) throw Error('Invalid journey content.');
      return { id: s.id, seed: normalizeSeed(s.seed), name: s.name, legacy: s.legacy === true, save: s.save };
    });
    if (!ids.has(raw.activeId)) throw Error('The active expedition is missing.');
    const audio = raw.preferences?.audio || {};
    const volume = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
    return { book: { version: 3, activeId: raw.activeId, slots, preferences: { audio: { master: volume(audio.master, .6), music: volume(audio.music, .35), sfx: volume(audio.sfx, .6), muted: audio.muted === true }, encounters: raw.preferences?.encounters !== false, profile: ['calm', 'balanced', 'chaotic'].includes(raw.preferences?.profile) ? raw.preferences.profile : 'calm' } } };
  } catch (e) { return { book: createSaveBook(legacySave, seed), warning: `The expedition list could not be loaded: ${e.message} The original stored text has not been deleted; export or back it up before replacing it.`, preserveOriginal: true }; }
}

/** Imported expeditions receive fresh IDs; no existing slot is replaced. */
export function mergeSaveBooks(book, imported) {
  if (!imported || imported.version !== 3 || !Array.isArray(imported.slots)) throw Error('Import a version 3 expedition save book.');
  if (book.slots.length + imported.slots.length > MAX_EXPEDITIONS) throw Error(`Import would exceed ${MAX_EXPEDITIONS} slots. Your current expeditions have been preserved.`);
  const added = []; let activeId = book.activeId, counter = 1;
  for (const slot of imported.slots) {
    while ([...book.slots, ...added].some(value => value.id === `imported-${counter}`)) counter++;
    const id = `imported-${counter++}`;
    added.push({ ...slot, id }); if (slot.id === imported.activeId) activeId = id;
  }
  return { ...book, activeId, slots: [...book.slots, ...added] };
}
