/** Active-movement pacing. Menus, blocked frames and teleports never advance it. */
function hash(text) { let value = 2166136261; for (const ch of String(text)) { value ^= ch.charCodeAt(0); value = Math.imul(value, 16777619); } return value >>> 0; }
function roll(seed, index, stream) { let value = hash(`${seed}:${index}:${stream}`); value ^= value >>> 16; value = Math.imul(value, 0x85ebca6b); value ^= value >>> 13; value = Math.imul(value, 0xc2b2ae35); value ^= value >>> 16; return (value >>> 0) / 4294967296; }
export const ENCOUNTER_PROFILES = Object.freeze({
  calm: { label: 'Calm', targetSeconds: 720, cooldownSeconds: 480, checkInterval: 30, probability: .125, areaWarmupSeconds: 20 },
  balanced: { label: 'Balanced', targetSeconds: 360, cooldownSeconds: 210, checkInterval: 20, probability: 2 / 15, areaWarmupSeconds: 15 },
  chaotic: { label: 'Chaotic', targetSeconds: 120, cooldownSeconds: 60, checkInterval: 10, probability: 1 / 6, areaWarmupSeconds: 10 }
});
export const normalizeEncounterProfile = value => typeof value === 'string' && Object.hasOwn(ENCOUNTER_PROFILES, value.toLowerCase()) ? value.toLowerCase() : 'calm';
const tables = {
  village: ['guard', 'skirmisher', 'signal'],
  forest: ['skirmisher', 'mimic', 'signal'],
  archive: ['signal', 'ranger', 'mimic'],
  library: ['signal', 'ranger', 'mimic'],
  workshop: ['guard', 'mimic', 'signal'],
  interior: ['mimic', 'signal', 'guard']
};
const names = { guard: 'Copper Automaton', skirmisher: 'Ink Ambusher', ranger: 'Signal Wisp', signal: 'Corrupted Signal', mimic: 'Footnote Mimic' };

export function createEncounterTracker(seed) {
  return { version: 3, pacingVersion: 4, seed: String(seed), travelled: 0, sinceEncounter: 0, checkDistance: 0, checks: 0, encounters: 0, lastOpponent: '', lastRegion: '', activeRegion: '', regionDistance: 0, activeSeconds: 0, sinceEncounterSeconds: 0, checkSeconds: 0, areaSeconds: 0, profile: 'calm' };
}

export function normalizeEncounterTracker(value, seed = value?.seed || 'expedition') {
  const fresh = createEncounterTracker(seed);
  if (!value || value.version !== 3 || value.seed !== fresh.seed || ['travelled', 'sinceEncounter', 'checkDistance', 'checks', 'encounters'].some(key => !Number.isFinite(value[key]) || value[key] < 0) || !Number.isSafeInteger(value.checks) || !Number.isSafeInteger(value.encounters)) return fresh;
  const timingValid = ['activeSeconds', 'sinceEncounterSeconds', 'checkSeconds', 'areaSeconds'].every(key => Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= 1e9);
  if (value.pacingVersion === 4 && timingValid && normalizeEncounterProfile(value.profile) === value.profile) return value;
  return { ...fresh, travelled: value.travelled, sinceEncounter: value.sinceEncounter, checks: value.checks, encounters: value.encounters, lastOpponent: typeof value.lastOpponent === 'string' ? value.lastOpponent : '', lastRegion: typeof value.lastRegion === 'string' ? value.lastRegion : '' };
}

export function travelEncounter(tracker, options = {}) {
  tracker = normalizeEncounterTracker(tracker);
  const distance = options.distance;
  if (options.paused || !['village', 'interior'].includes(options.sceneKind) || !Number.isFinite(distance) || distance <= 0) return { tracker };
  const seconds = options.movementSeconds === undefined ? distance / 78 : options.movementSeconds;
  if (distance > 80 || !Number.isFinite(seconds) || seconds <= 0 || seconds > 2 || distance > 160 * seconds + .1) return { tracker };
  const profileName = normalizeEncounterProfile(options.profile), profile = ENCOUNTER_PROFILES[profileName];
  const next = { ...tracker, profile: profileName, travelled: tracker.travelled + distance, sinceEncounter: tracker.sinceEncounter + distance, checkDistance: tracker.checkDistance + distance, activeSeconds: tracker.activeSeconds + seconds, sinceEncounterSeconds: tracker.sinceEncounterSeconds + seconds };
  const region = String(options.region || options.sceneKind).toLowerCase();
  const area = typeof options.areaId === 'string' && options.areaId ? options.areaId.slice(0, 500) : region;
  const activeRegion = `${options.sceneKind}:${region}:${area}`;
  next.regionDistance = tracker.activeRegion === activeRegion ? (tracker.regionDistance || 0) + distance : distance;
  next.areaSeconds = tracker.activeRegion === activeRegion ? tracker.areaSeconds + seconds : seconds;
  next.activeRegion = activeRegion;
  const newlyEligible = Math.max(0, next.sinceEncounterSeconds - profile.cooldownSeconds) - Math.max(0, tracker.sinceEncounterSeconds - profile.cooldownSeconds);
  next.checkSeconds = (tracker.profile === profileName ? tracker.checkSeconds : 0) + newlyEligible;
  if (next.sinceEncounterSeconds < profile.cooldownSeconds || next.areaSeconds < profile.areaWarmupSeconds) { next.checkSeconds = 0; return { tracker: next }; }
  if (next.checkSeconds < profile.checkInterval) return { tracker: next };
  next.checkSeconds -= profile.checkInterval; next.checkDistance = 0; next.checks++;
  const regionWeight = region.includes('forest') || region.includes('danger') ? 1.1 : options.sceneKind === 'interior' ? .9 : 1;
  const encounterNow = roll(next.seed, next.checks, `${region}:pacing4`) < profile.probability * regionWeight;
  if (!encounterNow) return { tracker: next };
  let table = tables[region] || (region.includes('archive') ? tables.archive : tables[options.sceneKind]);
  table = table.filter(opponent => opponent !== next.lastOpponent);
  const opponent = table[Math.floor(roll(next.seed, next.checks, 'opponent') * table.length)] || 'signal';
  const rare = (options.storyStage || 0) >= 1 && roll(next.seed, next.checks, 'rare') < .12;
  next.encounters++; next.sinceEncounter = 0; next.checkDistance = 0; next.sinceEncounterSeconds = 0; next.checkSeconds = 0; next.lastOpponent = opponent; next.lastRegion = region;
  return { tracker: next, encounter: {
    id: `encounter:${next.seed}:${next.encounters}`, opponent, title: `${rare ? 'Prismatic ' : ''}${names[opponent]}`,
    message: opponent === 'mimic' ? 'The footnote grew teeth. It would like you to cite your sources.' : opponent === 'signal' ? 'A damaged transmission gathers into a restless shape.' : 'Something stirs beside the route. It has a pattern you can learn.',
    rare, boss: false, region
  } };
}
