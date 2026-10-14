/** Small, pure, data-driven exploration state; never changes the source résumé. */
const VERSION = 2;
const QUEST_IDS = ["fieldTrip", "sparring"];
const QUEST_STATES = ["inactive", "active", "complete"];
const ACTION_KINDS = [
  "inspect",
  "discover",
  "quest",
  "open",
  "battle",
  "exit",
  "enter",
  "read",
  "light",
];
const unsafeKeys = new Set(["__proto__", "prototype", "constructor"]);
const clone = (value) => structuredClone(value);
const unique = (values) => [...new Set(values)];
const validKey = (value) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 180 &&
  !unsafeKeys.has(value);

function sourceRecords(resume) {
  const records = {};
  for (const section of resume?.sections || [])
    for (const entry of section.entries || []) {
      if (validKey(entry.id) && validKey(section.id))
        records[entry.id] = section.id;
    }
  return records;
}

export function createProgress(resume) {
  return {
    version: VERSION,
    resumeHash: String(resume?.sourceHash || ""),
    unlocked: [],
    visited: [],
    opened: [],
    items: {},
    flags: {},
    quests: { fieldTrip: "inactive", sparring: "inactive" },
    position: { scene: "village", point: { x: 0, y: 0 } },
    configs: { village: null, interiors: {} },
    stats: { battlesWon: 0 },
    recordSections: sourceRecords(resume),
    discoveredSections: {},
    completedActions: [],
    defeated: [],
  };
}

function marker(object, action) {
  return `${object.id}:${action.id}`;
}
function requiredQuantity(action) {
  return Number.isSafeInteger(action.requires?.quantity) &&
    action.requires.quantity > 0
    ? action.requires.quantity
    : 1;
}
function validProgress(state) {
  return (
    state?.version === VERSION &&
    ["unlocked", "visited", "opened", "completedActions", "defeated"].every(
      (field) => Array.isArray(state[field]),
    ) &&
    state.items &&
    typeof state.items === "object" &&
    state.flags &&
    typeof state.flags === "object" &&
    state.recordSections &&
    typeof state.recordSections === "object" &&
    state.quests &&
    QUEST_IDS.every((id) => QUEST_STATES.includes(state.quests[id]))
  );
}

export function evaluateAction(object, action, state) {
  if (
    !object ||
    !validKey(object.id) ||
    !action ||
    !validKey(action.id) ||
    !ACTION_KINDS.includes(action.kind)
  )
    return { available: false, reason: "This interaction is not defined." };
  if (!validProgress(state))
    return {
      available: false,
      reason: "Exploration state could not be loaded.",
    };
  if (
    action.requires?.quantity !== undefined &&
    (!Number.isSafeInteger(action.requires.quantity) ||
      action.requires.quantity <= 0)
  )
    return {
      available: false,
      reason: "This action has an invalid item requirement.",
    };
  if (action.kind === "open" && state.opened.includes(object.id))
    return { available: false, reason: "This container is already open." };
  if (action.once && state.completedActions.includes(marker(object, action)))
    return {
      available: false,
      reason: "You have already completed this action.",
    };
  if (
    action.requires &&
    (!validKey(action.requires.item) ||
      (state.items[action.requires.item] || 0) < requiredQuantity(action))
  ) {
    return {
      available: false,
      reason: `Requires ${requiredQuantity(action)} ${action.requires.item || "item"}${requiredQuantity(action) === 1 ? "" : "s"}.`,
    };
  }
  if (
    action.kind === "quest" &&
    action.questId &&
    !QUEST_IDS.includes(action.questId)
  )
    return { available: false, reason: "This quest is not available." };
  return { available: true };
}

function giveReward(state, reward) {
  if (!reward) return;
  const items =
    typeof reward === "string"
      ? { [reward]: 1 }
      : reward.item
        ? { [reward.item]: reward.quantity ?? 1 }
        : reward.items || reward;
  for (const [item, quantity] of Object.entries(items))
    if (
      validKey(item) &&
      Number.isSafeInteger(quantity) &&
      quantity > 0 &&
      quantity <= 100
    ) {
      state.items[item] = Math.min(999, (state.items[item] || 0) + quantity);
    }
}

function updateFieldTrip(state) {
  const discoveredSections = {};
  for (const id of state.unlocked) {
    const section = state.recordSections[id];
    if (section)
      discoveredSections[section] = (discoveredSections[section] || 0) + 1;
  }
  state.discoveredSections = discoveredSections;
  if (state.unlocked.length && state.quests.fieldTrip === "inactive")
    state.quests.fieldTrip = "active";
  if (
    state.unlocked.length >= 3 &&
    Object.keys(discoveredSections).length >= 2 &&
    state.quests.fieldTrip !== "complete"
  ) {
    state.quests.fieldTrip = "complete";
    if (!state.flags["fieldTrip:reward"]) {
      giveReward(state, { item: "field-key", quantity: 1 });
      state.flags["fieldTrip:reward"] = true;
      return " Field trip complete: three discoveries across two sections. You received a field key.";
    }
  }
  return "";
}

export function performAction(state, object, actionId) {
  const action = Array.isArray(object?.actions)
    ? object.actions.find((value) => value?.id === actionId)
    : undefined;
  const condition = evaluateAction(object, action, state);
  if (!condition.available) return { state, message: condition.reason };
  const next = clone(state);
  let message = action.message || object.hint || "You take a closer look.";
  let event;
  let recordIds;
  let buildingId;
  const key = marker(object, action);
  if (action.requires && ["open", "light"].includes(action.kind)) {
    next.items[action.requires.item] -= requiredQuantity(action);
    if (next.items[action.requires.item] === 0)
      delete next.items[action.requires.item];
  }
  if (action.kind === "discover") {
    recordIds = unique(
      (action.recordIds || object.recordIds || []).filter((id) =>
        Object.hasOwn(next.recordSections, id),
      ),
    );
    const fresh = recordIds.filter((id) => !next.unlocked.includes(id));
    next.unlocked = unique([...next.unlocked, ...recordIds]);
    event = "discover";
    if (!fresh.length)
      message =
        action.message ||
        "These field notes are already in your discovery journal.";
    message += updateFieldTrip(next);
  } else if (action.kind === "read") {
    recordIds = unique(
      (action.recordIds || object.recordIds || []).filter((id) =>
        Object.hasOwn(next.recordSections, id),
      ),
    );
  } else if (action.kind === "open") {
    next.opened.push(object.id);
    next.flags[`opened:${object.id}`] = true;
    message =
      action.message || "The field key turns. The container is now open.";
    recordIds = unique(
      (action.recordIds || object.recordIds || []).filter((id) =>
        Object.hasOwn(next.recordSections, id),
      ),
    );
    if (recordIds.length) {
      next.unlocked = unique([...next.unlocked, ...recordIds]);
      event = "discover";
      message += updateFieldTrip(next);
    }
  } else if (action.kind === "quest") {
    const quest = action.questId || "fieldTrip";
    if (next.quests[quest] === "complete")
      message =
        action.message || "You have completed this challenge. Well explored!";
    else {
      next.quests[quest] = "active";
      message =
        action.message ||
        (quest === "fieldTrip"
          ? "Find three résumé records in at least two sections. Your reward is one field key."
          : "Win an optional sparring challenge. There is no penalty for retreat or defeat.");
    }
    message += updateFieldTrip(next);
  } else if (action.kind === "battle") {
    event = "battle";
    if (next.quests.sparring === "inactive") next.quests.sparring = "active";
    message =
      action.message ||
      "An optional practice match: defeat and retreat have no lasting penalty.";
  } else if (action.kind === "enter") {
    event = "enter";
    buildingId = action.buildingId || object.buildingId || object.id;
    next.visited = unique([...next.visited, buildingId]);
  } else if (action.kind === "exit") {
    event = "exit";
    buildingId =
      action.buildingId || object.buildingId || next.position.buildingId;
  } else if (action.kind === "light") {
    next.flags[`lit:${object.id}`] = !next.flags[`lit:${object.id}`];
    message =
      action.message ||
      (next.flags[`lit:${object.id}`]
        ? "A warm light fills the room."
        : "You turn off the lamp.");
  }
  // Repeatable conversation/inspection must never duplicate a one-time reward.
  if (!next.completedActions.includes(key)) giveReward(next, action.reward);
  next.completedActions = unique([...next.completedActions, key]);
  return {
    state: next,
    message,
    ...(event ? { event } : {}),
    ...(recordIds ? { recordIds } : {}),
    ...(buildingId ? { buildingId } : {}),
  };
}

export function saveProgress(state) {
  if (!state || state.version !== VERSION)
    throw new Error("Cannot save an unsupported exploration state.");
  return JSON.stringify(state);
}

function sanitizedJson(value, depth = 0) {
  if (depth > 8) throw new Error("Saved configuration is too deeply nested.");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length <= 5000) return value;
  if (Array.isArray(value) && value.length <= 200)
    return value.map((item) => sanitizedJson(item, depth + 1));
  if (value && typeof value === "object" && Object.keys(value).length <= 200) {
    const result = {};
    for (const [key, item] of Object.entries(value))
      if (validKey(key)) result[key] = sanitizedJson(item, depth + 1);
    return result;
  }
  throw new Error("Saved configuration contains an invalid value.");
}

function stringList(value, name) {
  if (
    !Array.isArray(value) ||
    value.length > 3000 ||
    value.some((item) => !validKey(item))
  )
    throw new Error(`Saved ${name} list is malformed.`);
  return unique(value);
}

/** Restore a validated bounded state; geometry/config generation stays with the generator. */
export function loadProgress(json, resume) {
  const fallback = createProgress(resume);
  if (!json) return { state: fallback };
  try {
    if (typeof json !== "string" || json.length > 1000000)
      throw new Error("Save content is invalid or too large.");
    const raw = JSON.parse(json);
    if (!raw || raw.version !== VERSION)
      throw new Error("This save uses an unsupported version.");
    if (raw.resumeHash !== fallback.resumeHash)
      return {
        state: fallback,
        warning:
          "The résumé changed, so the exploration save was reset. All portfolio information remains available.",
      };
    const next = createProgress(resume);
    next.unlocked = stringList(raw.unlocked, "discoveries").filter((id) =>
      Object.hasOwn(next.recordSections, id),
    );
    next.visited = stringList(raw.visited, "visited buildings");
    next.opened = stringList(raw.opened, "opened containers");
    next.completedActions = stringList(
      raw.completedActions || [],
      "completed actions",
    );
    next.defeated = stringList(raw.defeated || [], "defeated opponents");
    if (!raw.items || typeof raw.items !== "object" || Array.isArray(raw.items))
      throw new Error("Saved inventory is malformed.");
    for (const [id, quantity] of Object.entries(raw.items)) {
      if (
        !validKey(id) ||
        !Number.isSafeInteger(quantity) ||
        quantity < 0 ||
        quantity > 999
      )
        throw new Error("Saved inventory contains an invalid item count.");
      if (quantity) next.items[id] = quantity;
    }
    if (!raw.flags || typeof raw.flags !== "object" || Array.isArray(raw.flags))
      throw new Error("Saved interaction flags are malformed.");
    for (const [id, value] of Object.entries(raw.flags))
      if (
        validKey(id) &&
        ["boolean", "string", "number"].includes(typeof value) &&
        (typeof value !== "number" || Number.isFinite(value))
      )
        next.flags[id] = value;
    for (const quest of QUEST_IDS) {
      if (!QUEST_STATES.includes(raw.quests?.[quest]))
        throw new Error("Saved quest state is invalid.");
      next.quests[quest] = raw.quests[quest];
    }
    const position = raw.position;
    if (
      !position ||
      !["village", "interior"].includes(position.scene) ||
      !Number.isFinite(position.point?.x) ||
      !Number.isFinite(position.point?.y) ||
      Math.abs(position.point.x) > 1000000 ||
      Math.abs(position.point.y) > 1000000
    )
      throw new Error("Saved player position is invalid.");
    if (position.scene === "interior" && !validKey(position.buildingId))
      throw new Error("Saved interior has no valid building identifier.");
    next.position = {
      scene: position.scene,
      point: { x: position.point.x, y: position.point.y },
      ...(position.buildingId ? { buildingId: position.buildingId } : {}),
    };
    next.configs = sanitizedJson(
      raw.configs || { village: null, interiors: {} },
    );
    if (
      !next.configs ||
      typeof next.configs !== "object" ||
      Array.isArray(next.configs) ||
      !next.configs.interiors ||
      typeof next.configs.interiors !== "object" ||
      Array.isArray(next.configs.interiors)
    )
      throw new Error("Saved generation configurations are invalid.");
    if (
      !Number.isSafeInteger(raw.stats?.battlesWon) ||
      raw.stats.battlesWon < 0 ||
      raw.stats.battlesWon > 999
    )
      throw new Error("Saved battle statistics are invalid.");
    next.stats.battlesWon = raw.stats.battlesWon;
    // Source-derived lookup is rebuilt, never trusted from browser storage.
    for (const id of next.unlocked) {
      const section = next.recordSections[id];
      next.discoveredSections[section] =
        (next.discoveredSections[section] || 0) + 1;
    }
    return { state: next };
  } catch (error) {
    return {
      state: fallback,
      warning: `The exploration save could not be restored: ${error.message} A fresh journey is ready.`,
    };
  }
}
