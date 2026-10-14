/** Compact tactical sparring. One move and one action, then explicit End turn. */
const TYPES = ["guard", "skirmisher", "ranger"];
const STATUS = ["active", "victory", "defeat", "retreated"];
const clone = (value) => structuredClone(value);
const key = (point) => `${point.x},${point.y}`;
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const same = (a, b) => a.x === b.x && a.y === b.y;
const neighbors = (point) => [
  { x: point.x, y: point.y - 1 },
  { x: point.x - 1, y: point.y },
  { x: point.x + 1, y: point.y },
  { x: point.x, y: point.y + 1 },
];

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function intent(type) {
  return type === "guard"
    ? "Holds position; advances one tile when you approach. Adjacent strike: 3 damage."
    : type === "skirmisher"
      ? "Closes in by up to two tiles, then strikes an adjacent target for 2 damage."
      : "Seeks a clear shot from two to three tiles away. Ranged shot: 2 damage.";
}

export function createBattle(seed, opponent = "guard") {
  if (!TYPES.includes(opponent))
    throw new Error("Choose a guard, skirmisher, or ranger opponent.");
  const value = hash(`${seed}:${opponent}`);
  const variants = [
    [
      { x: 3, y: 1 },
      { x: 3, y: 5 },
    ],
    [
      { x: 2, y: 2 },
      { x: 4, y: 4 },
    ],
    [
      { x: 3, y: 2 },
      { x: 3, y: 4 },
    ],
    [
      { x: 2, y: 4 },
      { x: 4, y: 2 },
    ],
  ];
  const hp = opponent === "guard" ? 9 : opponent === "skirmisher" ? 7 : 6;
  return {
    version: 1,
    id: `sparring-${opponent}-${value}`,
    seed: String(seed),
    opponent,
    status: "active",
    turn: "player",
    round: 1,
    grid: {
      width: 7,
      height: 7,
      blocked: clone(variants[value % variants.length]),
    },
    player: { x: 1, y: 3, hp: 10, maxHp: 10, guard: false, focus: 2 },
    enemy: {
      x: 5,
      y: 3,
      hp,
      maxHp: hp,
      type: opponent,
      intent: intent(opponent),
    },
    moved: false,
    acted: false,
    log: [
      "Optional practice match. Move up to two tiles, take one action, then end your turn. Retreat and defeat have no lasting penalty.",
    ],
  };
}

function inside(point, grid) {
  return (
    !!point &&
    !!grid &&
    Number.isSafeInteger(point.x) &&
    Number.isSafeInteger(point.y) &&
    point.x >= 0 &&
    point.y >= 0 &&
    point.x < grid.width &&
    point.y < grid.height
  );
}
function free(point, state, other) {
  return (
    inside(point, state.grid) &&
    !state.grid.blocked.some((block) => same(point, block)) &&
    (!other || !same(point, other))
  );
}

function validBattle(state) {
  if (
    !state ||
    state.version !== 1 ||
    !STATUS.includes(state.status) ||
    !["player", "enemy"].includes(state.turn)
  )
    return false;
  if (
    !state.grid ||
    state.grid.width !== 7 ||
    state.grid.height !== 7 ||
    !Array.isArray(state.grid.blocked) ||
    state.grid.blocked.length > 20 ||
    state.grid.blocked.some((point) => !inside(point, state.grid))
  )
    return false;
  if (
    !state.player ||
    !state.enemy ||
    !TYPES.includes(state.enemy.type) ||
    !free(state.player, state, state.enemy) ||
    !free(state.enemy, state, state.player)
  )
    return false;
  if (
    ![
      state.player.hp,
      state.player.maxHp,
      state.player.focus,
      state.enemy.hp,
      state.enemy.maxHp,
      state.round,
    ].every(Number.isSafeInteger)
  )
    return false;
  if (
    state.player.hp < 0 ||
    state.player.hp > state.player.maxHp ||
    state.enemy.hp < 0 ||
    state.enemy.hp > state.enemy.maxHp ||
    state.player.focus < 0 ||
    state.player.focus > 2 ||
    state.round < 1 ||
    state.round > 10000
  )
    return false;
  return (
    Array.isArray(state.log) &&
    state.log.length <= 24 &&
    state.log.every((value) => typeof value === "string") &&
    typeof state.moved === "boolean" &&
    typeof state.acted === "boolean"
  );
}

function append(state, text) {
  state.log = [...state.log.slice(-23), text];
}

function outcome(state) {
  // Simultaneous exhaustion is a defeat: no rewards are granted for a draw.
  if (state.player.hp <= 0) {
    state.status = "defeat";
    append(
      state,
      "Practice ends here. You recover immediately; your exploration progress is safe.",
    );
  } else if (state.enemy.hp <= 0) {
    state.status = "victory";
    append(
      state,
      "Victory! Your opponent salutes. Return to exploring whenever you are ready.",
    );
  }
  return state.status !== "active";
}

function reachable(state, start, budget, other) {
  const queue = [{ x: start.x, y: start.y, steps: 0 }],
    seen = new Set([key(start)]);
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (current.steps >= budget) continue;
    for (const next of neighbors(current))
      if (free(next, state, other) && !seen.has(key(next))) {
        seen.add(key(next));
        queue.push({ ...next, steps: current.steps + 1 });
      }
  }
  return queue;
}

export function reachableMoves(state) {
  if (
    !validBattle(state) ||
    state.status !== "active" ||
    state.turn !== "player" ||
    state.moved ||
    state.player.hp <= 0 ||
    state.enemy.hp <= 0
  )
    return [];
  return reachable(state, state.player, 2, state.enemy)
    .filter((point) => point.steps > 0)
    .map(({ x, y }) => ({ x, y }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Integer line tracing: walls block ranged focus and ranger shots. */
export function hasLineOfSight(state, from = state.player, to = state.enemy) {
  if (
    !state?.grid ||
    !Array.isArray(state.grid.blocked) ||
    !inside(from, state.grid) ||
    !inside(to, state.grid)
  )
    return false;
  let x = from.x,
    y = from.y;
  const dx = Math.abs(to.x - x),
    dy = Math.abs(to.y - y),
    sx = x < to.x ? 1 : -1,
    sy = y < to.y ? 1 : -1;
  let error = dx - dy;
  const obstacles = new Set(state.grid.blocked.map(key));
  while (x !== to.x || y !== to.y) {
    const twice = 2 * error;
    if (twice > -dy) {
      error -= dy;
      x += sx;
    }
    if (twice < dx) {
      error += dx;
      y += sy;
    }
    if ((x !== to.x || y !== to.y) && obstacles.has(`${x},${y}`)) return false;
  }
  return true;
}

export function canAttack(state, kind = "attack") {
  if (
    !validBattle(state) ||
    state.status !== "active" ||
    state.turn !== "player" ||
    state.acted ||
    state.player.hp <= 0 ||
    state.enemy.hp <= 0
  )
    return false;
  if (kind === "focus")
    return (
      state.player.focus > 0 &&
      distance(state.player, state.enemy) <= 3 &&
      hasLineOfSight(state)
    );
  return kind === "attack" && distance(state.player, state.enemy) === 1;
}

/** Safe, deterministic tactical evaluation; an unreachable target yields a wait. */
export function enemyTurn(state) {
  if (!validBattle(state)) return state;
  if (state.status !== "active") return state;
  const next = clone(state);
  if (outcome(next)) return next;
  next.turn = "enemy";
  const type = next.enemy.type;
  const startDistance = distance(next.enemy, next.player);
  let moved = false;
  let candidates = reachable(
    next,
    next.enemy,
    type === "guard" ? 1 : 2,
    next.player,
  );
  if (type === "guard" && startDistance > 3)
    candidates = candidates.filter((point) => point.steps === 0);
  const score = (point) => {
    const d = distance(point, next.player);
    if (type === "ranger")
      return d >= 2 && d <= 3 && hasLineOfSight(next, point, next.player)
        ? 100 - Math.abs(3 - d) * 10
        : -Math.abs(3 - d) * 5;
    return -d * 10;
  };
  candidates.sort(
    (a, b) =>
      score(b) - score(a) || a.steps - b.steps || a.y - b.y || a.x - b.x,
  );
  const chosen = candidates[0];
  if (chosen && !same(chosen, next.enemy)) {
    next.enemy.x = chosen.x;
    next.enemy.y = chosen.y;
    moved = true;
  }
  const d = distance(next.enemy, next.player);
  const attack =
    type === "ranger"
      ? d <= 3 && hasLineOfSight(next, next.enemy, next.player)
      : d === 1;
  if (attack) {
    const baseDamage = type === "guard" ? 3 : 2;
    const damage = Math.max(0, baseDamage - (next.player.guard ? 2 : 0));
    next.player.hp = Math.max(0, next.player.hp - damage);
    append(
      next,
      `${type === "ranger" ? "Ranger fires" : type === "guard" ? "Guard strikes" : "Skirmisher strikes"}${moved ? " after moving" : ""}: ${damage} damage${next.player.guard ? " (your guard absorbs 2)" : ""}.`,
    );
  } else
    append(
      next,
      moved
        ? `${type[0].toUpperCase() + type.slice(1)} repositions, but has no legal attack.`
        : `${type[0].toUpperCase() + type.slice(1)} holds position. No legal attack.`,
    );
  next.player.guard = false;
  next.enemy.intent = intent(type);
  if (!outcome(next)) {
    next.round++;
    next.turn = "player";
    next.moved = false;
    next.acted = false;
  }
  return next;
}

export function battleAction(state, action) {
  if (!validBattle(state))
    return {
      state,
      error:
        "This battle state is invalid. Return to the village and start a fresh practice match.",
    };
  if (state.status !== "active")
    return { state, error: "This practice match has ended." };
  if (state.turn !== "player") return { state, error: "Wait for your turn." };
  const next = clone(state);
  if (outcome(next)) return { state: next };
  if (!action || typeof action.type !== "string")
    return { state, error: "Choose a valid battle action." };
  if (action.type === "retreat") {
    next.status = "retreated";
    append(
      next,
      "You step away from practice. No items or exploration progress are lost.",
    );
    return { state: next };
  }
  if (action.type === "end") return { state: enemyTurn(next) };
  if (action.type === "move") {
    if (next.moved)
      return { state, error: "You have already moved this turn." };
    if (
      !reachableMoves(next).some(
        (point) => point.x === action.x && point.y === action.y,
      )
    )
      return {
        state,
        error:
          "Choose a highlighted reachable tile within two steps. You cannot move through walls or opponents.",
      };
    next.player.x = action.x;
    next.player.y = action.y;
    next.moved = true;
    append(next, `You move to (${action.x + 1}, ${action.y + 1}).`);
    return { state: next };
  }
  if (!["attack", "guard", "focus"].includes(action.type))
    return {
      state,
      error: "Choose move, attack, guard, focus, end turn, or retreat.",
    };
  if (next.acted)
    return {
      state,
      error:
        "You have already taken an action. You may move if you have not moved, then end your turn.",
    };
  if (action.type === "attack") {
    if (!canAttack(next))
      return { state, error: "Basic attack requires an adjacent opponent." };
    next.enemy.hp = Math.max(0, next.enemy.hp - 3);
    append(next, "You strike: 3 damage.");
  } else if (action.type === "focus") {
    if (!next.player.focus)
      return {
        state,
        error: "Your two focus charges are spent for this match.",
      };
    if (!canAttack(next, "focus"))
      return {
        state,
        error:
          "Focus requires an opponent within three tiles and a clear line of sight.",
      };
    next.player.focus--;
    next.enemy.hp = Math.max(0, next.enemy.hp - 2);
    append(next, "Focused pulse: 2 damage. One focus charge spent.");
  } else {
    next.player.guard = true;
    append(next, "You guard. The next enemy hit is reduced by 2 damage.");
  }
  next.acted = true;
  outcome(next);
  return { state: next };
}

/** Victory cosmetics are once per opponent archetype, independent of rerolled seeds. */
export function finishBattle(progress, battle) {
  if (
    !progress ||
    progress.version !== 2 ||
    !progress.flags ||
    !progress.items ||
    !progress.stats ||
    !progress.quests ||
    !Array.isArray(progress.defeated) ||
    !validBattle(battle) ||
    battle.status !== "victory" ||
    battle.player.hp <= 0 ||
    battle.enemy.hp > 0
  )
    return progress;
  const next = clone(progress);
  const opponent = battle.enemy.type;
  const marker = `sparring:${opponent}`;
  next.flags[`handled:${battle.id}`] = true;
  if (!next.defeated.includes(marker)) {
    next.defeated.push(marker);
    next.stats.battlesWon++;
    next.items["sparring-badge"] = (next.items["sparring-badge"] || 0) + 1;
  }
  next.quests.sparring = "complete";
  return next;
}
