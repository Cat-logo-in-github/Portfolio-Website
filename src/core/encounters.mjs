/** Distance-paced encounters. Seeded rolls advance only when a real walk crosses a check. */
function hash(text) { let value = 2166136261; for (const ch of String(text)) { value ^= ch.charCodeAt(0); value = Math.imul(value, 16777619); } return value >>> 0; }
function roll(seed, index, stream) { return hash(`${seed}:${index}:${stream}`) / 4294967296; }
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
  return { version: 3, seed: String(seed), travelled: 0, sinceEncounter: 0, checkDistance: 0, checks: 0, encounters: 0, lastOpponent: '', lastRegion: '', activeRegion: '', regionDistance: 0 };
}

export function travelEncounter(tracker, options = {}) {
  if (!tracker || tracker.version !== 3 || typeof tracker.seed !== 'string' || ['travelled', 'sinceEncounter', 'checkDistance', 'checks', 'encounters'].some(key => !Number.isFinite(tracker[key]) || tracker[key] < 0)) return { tracker: createEncounterTracker(tracker?.seed || 'expedition') };
  const distance = options.distance;
  if (options.paused || !['village', 'interior'].includes(options.sceneKind) || !Number.isFinite(distance) || distance <= 0) return { tracker };
  // Large teleports/reporting glitches cannot count as a long expedition walk.
  if (distance > 80) return { tracker };
  const next = { ...tracker, travelled: tracker.travelled + distance, sinceEncounter: tracker.sinceEncounter + distance, checkDistance: tracker.checkDistance + distance };
  const region = String(options.region || options.sceneKind).toLowerCase();
  const area = typeof options.areaId === 'string' && options.areaId ? options.areaId.slice(0, 500) : region;
  const activeRegion = `${options.sceneKind}:${region}:${area}`;
  next.regionDistance = tracker.activeRegion === activeRegion ? (tracker.regionDistance || 0) + distance : distance;
  next.activeRegion = activeRegion;
  const cooldown = next.encounters ? 520 : 440;
  if (next.sinceEncounter < cooldown || next.checkDistance < 96 || next.regionDistance < 128) return { tracker: next };
  next.checkDistance = 0; next.checks++;
  const probability = region.includes('forest') || region.includes('danger') ? .58 : options.sceneKind === 'interior' ? .32 : .40;
  // A bounded drought breaker guarantees a surprise eventually without immediate repeats.
  const encounterNow = roll(next.seed, next.checks, region) < probability || next.sinceEncounter >= 900;
  if (!encounterNow) return { tracker: next };
  let table = tables[region] || (region.includes('archive') ? tables.archive : tables[options.sceneKind]);
  table = table.filter(opponent => opponent !== next.lastOpponent);
  const opponent = table[Math.floor(roll(next.seed, next.checks, 'opponent') * table.length)] || 'signal';
  const rare = (options.storyStage || 0) >= 1 && roll(next.seed, next.checks, 'rare') < .12;
  next.encounters++; next.sinceEncounter = 0; next.checkDistance = 0; next.lastOpponent = opponent; next.lastRegion = region;
  return { tracker: next, encounter: {
    id: `encounter:${next.seed}:${next.encounters}`, opponent, title: `${rare ? 'Prismatic ' : ''}${names[opponent]}`,
    message: opponent === 'mimic' ? 'The footnote grew teeth. It would like you to cite your sources.' : opponent === 'signal' ? 'A damaged transmission gathers into a restless shape.' : 'Something stirs beside the route. It has a pattern you can learn.',
    rare, boss: false, region
  } };
}
