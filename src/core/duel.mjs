/** Fast command encounters; V2's optional grid sparring remains separate and intact. */
const identities = {
  guard: { name: 'Copper Automaton', hp: 12, pattern: ['charge', 'heavy', 'recover'] },
  skirmisher: { name: 'Ink Ambusher', hp: 10, pattern: ['jab', 'jab', 'feint'] },
  ranger: { name: 'Signal Wisp', hp: 11, pattern: ['pulse', 'charge', 'surge'] },
  signal: { name: 'Corrupted Signal', hp: 11, pattern: ['pulse', 'pulse', 'surge'] },
  mimic: { name: 'Footnote Mimic', hp: 12, pattern: ['feint', 'heavy', 'recover'] },
  guardian: { name: 'The Quiet Indexer', hp: 24, pattern: ['charge', 'heavy', 'pulse', 'surge', 'recover'] }
};
const telegraphs = { charge: 'Gathering energy; a heavy strike follows.', heavy: 'A heavy strike is coming. Guard or interrupt it.', recover: 'Cooling down. This is an opening.', jab: 'A quick ink jab is coming.', feint: 'A false opening hides a light strike.', pulse: 'A signal pulse is coming; its repeating pattern can be analyzed.', surge: 'The signal is about to surge. Guard or use a learned technique.' };
const damage = { charge: 0, heavy: 7, recover: 0, jab: 3, feint: 2, pulse: 3, surge: 6 };
const clone = value => structuredClone(value);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function add(state, message) { state.log = [...state.log.slice(-15), message]; }
function updateIntent(state) { state.enemy.intent = telegraphs[state.enemy.pattern[state.enemy.patternIndex % state.enemy.pattern.length]]; }

export function createDuel(seed, opponent = 'guard', options = {}) {
  const boss = Boolean(options.boss || opponent === 'guardian');
  const type = boss ? 'guardian' : Object.hasOwn(identities, opponent) ? opponent : 'signal';
  const identity = identities[type];
  const stage = Number.isSafeInteger(options.storyStage) ? clamp(options.storyStage, 0, 6) : 0;
  const knowledge = [...new Set((Array.isArray(options.knowledge) ? options.knowledge : []).filter(value => typeof value === 'string').slice(0, 30))];
  const hp = identity.hp + (boss ? 0 : Math.min(3, stage));
  const state = {
    version: 3, id: `duel:${String(seed)}:${type}`, seed: String(seed), opponent: type, boss, storyStage: stage,
    status: 'active', round: 1, turn: 'player', knowledge, analyzed: false,
    player: { name: 'The Explorer', hp: 24, maxHp: 24, guard: false, specialCharges: knowledge.length ? 2 : 1, potions: 1 },
    enemy: { type, name: identity.name, hp, maxHp: hp, pattern: [...identity.pattern], patternIndex: 0, intent: '', exposed: false },
    log: [boss ? 'The Quiet Indexer unfolds its altered pages. Its attacks follow the patterns you have already encountered.' : `A ${identity.name} appeared. Commands resolve quickly; escape is always safe.`],
    lastEvent: 'reveal', lastActor: 'enemy', analyzedTurns: 0
  };
  updateIntent(state); return state;
}

function valid(state) {
  return state?.version === 3 && ['active', 'victory', 'defeat', 'escaped'].includes(state.status)
    && state.player && state.enemy && Object.hasOwn(identities, state.enemy.type)
    && ['hp', 'maxHp', 'specialCharges', 'potions'].every(key => Number.isSafeInteger(state.player[key]) && state.player[key] >= 0)
    && state.player.maxHp > 0 && state.player.maxHp <= 50 && state.player.specialCharges <= 5 && state.player.potions <= 1
    && state.player.hp <= state.player.maxHp && Number.isSafeInteger(state.enemy.hp) && state.enemy.hp >= 0 && Number.isSafeInteger(state.enemy.maxHp) && state.enemy.maxHp > 0 && state.enemy.maxHp <= 60 && state.enemy.hp <= state.enemy.maxHp
    && Array.isArray(state.enemy.pattern) && state.enemy.pattern.length > 0 && state.enemy.pattern.length < 10
    && state.enemy.pattern.every(key => Object.hasOwn(damage, key)) && Number.isSafeInteger(state.enemy.patternIndex) && state.enemy.patternIndex >= 0
    && Number.isSafeInteger(state.round) && state.round > 0 && Array.isArray(state.log) && state.log.length <= 16 && state.log.every(value => typeof value === 'string') && Array.isArray(state.knowledge);
}

export function duelAction(state, action) {
  if (!valid(state)) return { state, error: 'This encounter could not be restored. Close it to return safely to exploring.' };
  if (state.status !== 'active') return { state, error: 'This encounter has ended.' };
  if (!state.player.hp || !state.enemy.hp) { const ended = clone(state); ended.status = !state.player.hp ? 'defeat' : 'victory'; ended.lastEvent = ended.status; return { state: ended }; }
  const type = action?.type;
  if (!['attack', 'guard', 'analyze', 'special', 'item', 'escape'].includes(type)) return { state, error: 'Choose Attack, Guard, Analyze, Technique, Item, or Escape.' };
  const next = clone(state); next.player.guard = false; next.lastActor = 'player'; next.lastEvent = type;
  if (type === 'escape') { next.status = 'escaped'; add(next, 'You slip out of the encounter. No discoveries or items are lost.'); return { state: next }; }
  if (type === 'item') {
    if (!next.player.potions) return { state, error: 'The practice tonic has already been used in this encounter.' };
    if (next.player.hp === next.player.maxHp) return { state, error: 'You are already at full health. Save the tonic for later.' };
    next.player.potions--; const healed = Math.min(9, next.player.maxHp - next.player.hp); next.player.hp += healed; add(next, `Practice tonic restores ${healed} HP. One tonic is supplied in each encounter.`);
  } else if (type === 'analyze') {
    next.analyzed = true; next.analyzedTurns = 2; next.enemy.exposed = true;
    add(next, `Pattern recorded: ${next.enemy.pattern.join(' → ')}. Your next strike gains 2 damage; the next two incoming attacks lose 1 damage.`);
  } else if (type === 'guard') {
    next.player.guard = true; add(next, 'You guard. This response loses 5 damage.');
  } else {
    let amount = type === 'special' ? 6 + (next.knowledge.length ? 1 : 0) : 4;
    if (type === 'special') {
      if (!next.player.specialCharges) return { state, error: 'No technique charges remain in this encounter.' };
      next.player.specialCharges--; next.enemy.interrupted = true;
      add(next, next.knowledge.length ? 'Learned technique: your repaired clues interrupt the enemy pattern.' : 'Focused strike interrupts this enemy response. Solve a device to gain another charge in future encounters.');
    }
    if (next.enemy.exposed) { amount += 2; next.enemy.exposed = false; }
    const enemyMove = next.enemy.pattern[next.enemy.patternIndex % next.enemy.pattern.length];
    if (enemyMove === 'recover') amount++;
    next.enemy.hp = Math.max(0, next.enemy.hp - amount); add(next, `${type === 'special' ? 'Technique' : 'Attack'} deals ${amount} damage.`);
    if (!next.enemy.hp) { next.status = 'victory'; next.lastEvent = 'victory'; add(next, next.boss ? `${next.enemy.name} settles into harmless ink. The archive can welcome its unfinished pages again.` : `${next.enemy.name} settles into harmless ink. You earn a keepsake token; your health recovers after the encounter.`); return { state: next }; }
  }
  const move = next.enemy.pattern[next.enemy.patternIndex % next.enemy.pattern.length];
  let incoming = damage[move];
  if (next.enemy.interrupted) { incoming = 0; next.enemy.interrupted = false; add(next, 'The pattern breaks; the enemy loses this response.'); }
  else {
    if (next.player.guard) incoming = Math.max(0, incoming - 5);
    if (next.analyzedTurns > 0) incoming = Math.max(0, incoming - 1);
    add(next, incoming ? `${next.enemy.name}: ${move}, ${incoming} damage${next.player.guard ? ' after guarding' : ''}.` : `${next.enemy.name} ${move === 'charge' ? 'charges its next attack' : move === 'recover' ? 'cools down' : 'cannot get past your defense'}.`);
  }
  if (next.analyzedTurns > 0 && damage[move] > 0) next.analyzedTurns--;
  next.player.hp = Math.max(0, next.player.hp - incoming);
  next.enemy.patternIndex++; next.round++; updateIntent(next);
  if (!next.player.hp) { next.status = 'defeat'; next.lastEvent = 'defeat'; add(next, 'The village catches you before the pages close. You recover without losing progress.'); }
  return { state: next };
}
