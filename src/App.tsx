import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateWorld, parseSequence } from "./core/world.mjs";
import { generateInterior, defaultInteriorConfig } from "./core/interior.mjs";
import { villageScene } from "./core/village.mjs";
import {
  loadProgress,
  saveProgress,
  evaluateAction,
  performAction,
} from "./core/progress.mjs";
import { createBattle, battleAction, finishBattle } from "./core/combat.mjs";
import { canStand } from "./game/physics.mjs";
import Game, { type GameHandle } from "./game/Game";
import Modal from "./components/Modal";
import { LocationContent } from "./components/Content";
import GenerationPanel, { downloadJSON } from "./components/GenerationPanel";
import Battle, { BattleIntro } from "./components/Battle";
import PuzzlePanel from "./components/PuzzlePanel";
import MysteryJournal from "./components/MysteryJournal";
import ExpeditionPanel from "./components/ExpeditionPanel";
import DialogueText from "./components/DialogueText";
import EncounterBattle from "./components/EncounterBattle";
import AudioSettings from "./components/AudioSettings";
import { completedDeviceIds, solveDeviceProgress } from "./core/activity-progress.mjs";
import DevicePanel from "./components/DevicePanel";
import CreaturePanel from "./components/CreaturePanel";
import { generateDevice } from "./core/devices.mjs";
import { CREATURE_KEY, readCreatureState, saveCreatureState, creatureAction, restockCreatureFood } from "./core/creatures.mjs";
import { GARDEN_ID, DEVICE_KEY, gardenVillage, gardenEntrance, gardenUnlocked, generateGarden, decorateAdventureScene } from "./core/destinations.mjs";
import { createAudioManager } from "./audio/audio.mjs";
import { travelEncounter } from "./core/encounters.mjs";
import { createDuel } from "./core/duel.mjs";
import { mysteryPlan, solveMystery, currentObjective, finishMysteryBoss, readMysteryPage, decorateMysteryScene } from "./core/mystery.mjs";
import { SAVE_BOOK_KEY, LEGACY_SAVE_KEY, freshSeed, restoreSaveBook, activeSlot, startExpedition, selectExpedition, storeActiveProgress, serializeSaveBook, expeditionInteriorConfig, mergeSaveBooks } from "./core/expeditions.mjs";
import { buildSession, readMystery, STORY_KEY, ENCOUNTER_KEY } from "./core/session.mjs";
import type {
  Resume,
  World,
  Location,
  Point,
  GameScene,
  GameObject,
  Progress,
  InteriorConfig,
  VillageConfig,
  BattleState,
} from "./types";

type Panel =
  | "journal"
  | "map"
  | "code"
  | "pause"
  | "interaction"
  | "quests"
  | "battle"
  | "mystery"
  | "puzzle"
  | "duel"
  | "audio"
  | "expeditions"
  | "device"
  | "creature"
  | null;

const defaultVillageConfig = (world: World): VillageConfig => ({
  algorithmVersion: 2,
  scope: "village",
  nodeCount: world.locations.length,
  sequence: [...world.sequence],
  layoutSeed: "resume-default",
  decorationSeed: "resume-default",
});
function configuredWorld(
  resume: Resume,
  config: VillageConfig,
  fallback: World,
): World {
  if (
    !config ||
    config.algorithmVersion !== 2 ||
    config.scope !== "village" ||
    config.nodeCount !== fallback.locations.length ||
    !Array.isArray(config.sequence)
  )
    throw Error(
      "Saved village settings do not match this résumé or algorithm version.",
    );
  parseSequence(config.sequence.join(", "), config.nodeCount);
  for (const seed of [config.layoutSeed, config.decorationSeed])
    if (typeof seed !== "string" || !seed.trim() || seed.length > 128)
      throw Error("Seeds must contain 1–128 characters.");
  return generateWorld(resume, config.sequence, {
    ...(config.layoutSeed === "resume-default"
      ? {}
      : { layoutSeed: config.layoutSeed }),
    ...(config.decorationSeed === "resume-default"
      ? {}
      : { decorationSeed: config.decorationSeed }),
  }) as World;
}

function SceneOverview({
  scene,
  tiny = false,
  onTravel,
}: {
  scene: GameScene;
  tiny?: boolean;
  onTravel?: (point: Point) => void;
}) {
  const nodes =
    scene.kind === "village"
      ? scene.locations?.map((l) => ({
          x: l.x,
          y: l.y,
          width: l.size.width,
          height: l.size.height,
          vertex: l.vertex,
          label: l.label,
          point: l.entrance,
        }))
      : scene.rooms?.map((r) => ({
          ...r,
          point: { x: r.x + r.width / 2, y: r.y + r.height / 2 },
        }));
  return (
    <svg
      className={tiny ? "tiny-overview" : "overview"}
      viewBox={`0 0 ${scene.bounds.width} ${scene.bounds.height}`}
      role="img"
      aria-label={
        scene.kind === "village" ? "Village tree map" : "Interior room graph"
      }
    >
      {scene.paths.map((p, i) => (
        <polyline
          key={i}
          points={p.points.map((pt) => `${pt.x},${pt.y}`).join(" ")}
        />
      ))}
      {nodes?.map((node) => (
        <g
          key={node.vertex}
          role={onTravel ? "button" : undefined}
          tabIndex={onTravel ? 0 : undefined}
          aria-label={`${node.vertex}: ${node.label}`}
          onClick={() => onTravel?.(node.point)}
          onKeyDown={(e) => {
            if (onTravel && !e.repeat && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onTravel(node.point);
            }
          }}
        >
          <rect x={node.x} y={node.y} width={node.width} height={node.height} />
          <text x={node.x + node.width / 2} y={node.y + node.height / 2 + 8}>
            {node.vertex === 999 ? "?" : node.vertex}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function App() {
  const [resume, setResume] = useState<Resume | null>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [interior, setInterior] = useState<GameScene | null>(null);
  const [loadError, setLoadError] = useState("");
  const [started, setStarted] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState("");
  const [nearby, setNearby] = useState<GameObject | null>(null);
  const [object, setObject] = useState<GameObject | null>(null);
  const [objectMessage, setObjectMessage] = useState("");
  const [toast, setToast] = useState("");
  const [reading, setReading] = useState(false);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [battleError, setBattleError] = useState("");
  const [journeyText, setJourneyText] = useState("");
  const [journeyError, setJourneyError] = useState("");
  const [book, setBook] = useState<any>(null);
  const [seed, setSeed] = useState("");
  const [expeditionError, setExpeditionError] = useState("");
  const [puzzleId, setPuzzleId] = useState("");
  const [duel, setDuel] = useState<any>(null);
  const [device, setDevice] = useState<any>(null);
  const [creature, setCreature] = useState<any>(null);
  const [creatureMessage, setCreatureMessage] = useState('');
  const bookRef = useRef<any>(null);
  const protectStoredBook = useRef(false);
  const trackerRef = useRef<any>(null);
  const sceneRef = useRef<GameScene | null>(null);
  const travelPending = useRef(0);
  const walkingSeconds = useRef(0);
  const panelRef = useRef<Panel>(panel); panelRef.current = panel;
  const startedRef = useRef(started); startedRef.current = started;
  const audioManager = useMemo(() => createAudioManager({ baseURL: import.meta.env.BASE_URL }), []);
  const game = useRef<GameHandle>(null);
  const defaults = useRef<World | null>(null);
  const initialPoint = useRef<Point | null>(null);
  const storageWarned = useRef(false);
  const progressRef = useRef<Progress | null>(null);
  progressRef.current = progress;
  const interiorRef = useRef<GameScene | null>(null);
  interiorRef.current = interior;
  const village = useMemo(
    () => (world ? (gardenVillage(world) as GameScene) : null),
    [world],
  );
  const plan = useMemo(() => resume && world && seed ? mysteryPlan(seed, resume, world) : null, [resume, world, seed]);
  const storyJSON = progress?.flags[STORY_KEY];
  const story: any = useMemo(() => resume && world && seed ? readMystery(typeof storyJSON === 'string' ? storyJSON : '', seed, resume, world) : null, [resume, world, seed, storyJSON]);
  const deviceJSON = progress?.flags[DEVICE_KEY];
  const completedDevices: string[] = useMemo(() => completedDeviceIds(deviceJSON), [deviceJSON]);
  const baseScene = interior || village;
  const scene = useMemo(() => baseScene && plan && story ? decorateAdventureScene(baseScene, plan, story, { completed: completedDevices, gardenRestored: Boolean(progress?.flags['v4:garden-restored']) }) as GameScene : baseScene, [baseScene, plan, story, completedDevices, progress?.flags['v4:garden-restored']]);
  const creatureJSON = progress?.flags[CREATURE_KEY];
  const creatureState = useMemo(() => seed ? readCreatureState(typeof creatureJSON === 'string' ? creatureJSON : '', seed) : null, [seed, creatureJSON]);
  sceneRef.current = scene;
  const focusGame = useCallback(() => requestAnimationFrame(() => { if (panelRef.current === null && startedRef.current) game.current?.focus(); }), []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all(
      ["resume", "world"].map((name) =>
        fetch(`./generated/${name}.json`, { signal: controller.signal }).then(
          (r) => {
            if (!r.ok) throw Error(`Could not load ${name}.`);
            return r.json();
          },
        ),
      ),
    )
      .then((values) => {
        const [r, defaultWorld] = values as [Resume, World];
        let savedBook = "", legacy = "";
        try { savedBook = localStorage.getItem(SAVE_BOOK_KEY) || ""; legacy = localStorage.getItem(LEGACY_SAVE_KEY) || ""; } catch { storageWarned.current = true; }
        const loadedBook = restoreSaveBook(savedBook, legacy, freshSeed());
        let nextBook = loadedBook.book;
        protectStoredBook.current = Boolean(loadedBook.preserveOriginal);
        let slot = activeSlot(nextBook);
        let session = buildSession(r, defaultWorld, slot);
        let sourceNotice = "";
        // A changed source starts a new slot; the earlier saved text remains intact.
        if (slot.save && session.requiresRecovery) {
          try { sourceNotice = "The earlier save needs recovery. A new expedition was started; its original text is kept in the earlier slot."; nextBook = startExpedition(nextBook, slot.seed, "Recovered expedition"); slot = activeSlot(nextBook); session = buildSession(r, defaultWorld, slot); }
          catch { protectStoredBook.current = true; }
        }
        bookRef.current = nextBook; setBook(nextBook); setSeed(slot.seed);
        audioManager.setSettings(nextBook.preferences.audio);
        trackerRef.current = session.tracker;
        defaults.current = defaultWorld;
        setResume(r); setWorld(session.world as World); setProgress(session.state as unknown as Progress); setInterior(session.interior as GameScene | null);
        initialPoint.current = session.point;
        setSelected(session.world.locations[0]?.id || "");
        setToast(loadedBook.warning || sourceNotice || session.warning || (storageWarned.current ? "Browser storage is unavailable; export your expedition save book to keep it." : ""));
      })
      .catch((e) => {
        if (e.name !== "AbortError") setLoadError(e.message);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!progress) return;
    try {
      if (!bookRef.current || protectStoredBook.current) return;
      const updated = storeActiveProgress(bookRef.current, saveProgress(progress));
      bookRef.current = updated;
      localStorage.setItem(SAVE_BOOK_KEY, serializeSaveBook(updated));
    } catch {
      if (!storageWarned.current) {
        storageWarned.current = true;
        setToast(
          "Browser storage is unavailable. Export your journey from the menu to keep it.",
        );
      }
    }
  }, [progress]);
  useEffect(() => {
    const context = panel === 'duel' ? duel?.status === 'victory' ? 'victory' : duel?.boss ? 'boss' : 'battle' : panel === 'battle' ? battle?.status === 'victory' ? 'victory' : 'battle' : ['puzzle', 'device'].includes(panel || '') ? 'puzzle' : panel === 'mystery' ? 'mystery' : interior ? 'interior' : 'village';
    if ((!started && panel !== 'audio') || panel === 'pause' || document.hidden) audioManager.suspend();
    else { void audioManager.unlock(); audioManager.setContext(context); }
    const visibility = () => { if (document.hidden) audioManager.suspend(); else if (startedRef.current && panelRef.current !== 'pause') { void audioManager.unlock(); audioManager.setContext(context); } };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [audioManager, started, panel, interior, duel?.status, duel?.boss, battle?.status]);
  useEffect(() => () => audioManager.dispose(), [audioManager]);
  useEffect(() => {
    if (scene && initialPoint.current) {
      const point = initialPoint.current;
      initialPoint.current = null;
      requestAnimationFrame(() => game.current?.teleport(point));
    }
  }, [scene]);
  useEffect(() => {
    if (!toast || !started) return;
    const timer = setTimeout(() => setToast(""), 8500);
    return () => clearTimeout(timer);
  }, [toast, started]);

  const settleEncounter = useCallback(() => {
    if (!trackerRef.current) return;
    trackerRef.current = { ...trackerRef.current, sinceEncounter: 0, sinceEncounterSeconds: 0, checkDistance: 0, checkSeconds: 0, areaSeconds: 0 };
    travelPending.current = 0; walkingSeconds.current = 0;
    setProgress(p => p ? { ...p, flags: { ...p.flags, [ENCOUNTER_KEY]: JSON.stringify(trackerRef.current) } } : p);
  }, []);
  const closePanel = useCallback(() => {
    if (panel === "duel" || panel === "battle") settleEncounter();
    if (panel === "battle" && battle) {
      const final =
        battle.status === "active"
          ? battleAction(battle, { type: "retreat" }).state
          : battle;
      setProgress((p) =>
        p ? (finishBattle(p, final) as unknown as Progress) : p,
      );
      setBattle(null);
    }
    setPanel(null);
    setObject(null);
    focusGame();
    if (panel === "duel") { setDuel(null); audioManager.effect("confirm"); }
  }, [panel, battle, focusGame, audioManager, settleEncounter]);
  const pause = useCallback(() => setPanel("pause"), []);
  const positionChanged = useCallback((point: Point) => {
    setProgress((p) =>
      p
        ? {
            ...p,
            flags: { ...p.flags, ...(trackerRef.current ? { [ENCOUNTER_KEY]: JSON.stringify(trackerRef.current) } : {}) },
            position: {
              scene: interiorRef.current ? "interior" : "village",
              ...(interiorRef.current
                ? { buildingId: interiorRef.current.buildingId }
                : {}),
              point,
            },
          }
        : p,
    );
  }, []);
  const leave = () => {
    audioManager.effect("door");
    if (!world || !village || !interior) return;
    const state = progressRef.current!;
    const house = world.locations.find((l) => l.id === interior.buildingId);
    const saved = {
      x: Number(state.flags["exterior:x"]),
      y: Number(state.flags["exterior:y"]),
    };
    const point =
      Number.isFinite(saved.x) &&
      Number.isFinite(saved.y) &&
      canStand(saved, village)
        ? saved
        : house?.entrance || gardenEntrance(world);
    setInterior(null);
    setNearby(null);
    setProgress((p) =>
      p ? { ...p, position: { scene: "village", point } } : p,
    );
    setPanel(null);
    setObject(null);
    initialPoint.current = point;
    focusGame();
  };
  const enter = (buildingId: string, stateOverride?: Progress) => {
    audioManager.effect("door");
    if (!resume || !world) return;
    const house = world.locations.find((l) => l.id === buildingId);
    if (!house && buildingId !== GARDEN_ID) return;
    const state = stateOverride || progressRef.current!;
    try {
      if (buildingId === GARDEN_ID) {
        const currentStory = readMystery(String(state.flags[STORY_KEY] || ''), seed, resume, world);
        if (!gardenUnlocked(currentStory)) { setToast('Restore the route tree and repair the bridge first.'); return; }
        const next = generateGarden(resume, seed) as GameScene;
        setProgress({ ...state, visited: [...new Set([...state.visited, GARDEN_ID])], position: { scene: 'interior', buildingId: GARDEN_ID, point: next.spawn }, flags: { ...state.flags, 'exterior:x': gardenEntrance(world).x, 'exterior:y': gardenEntrance(world).y } });
        setInterior(next); setNearby(null); setObject(null); setPanel(null); initialPoint.current = null; focusGame(); return;
      }
      if (!house) return;
      const config =
        state.configs.interiors[house.id] ||
        ((bookRef.current && !activeSlot(bookRef.current).legacy ? expeditionInteriorConfig(resume, house, seed) : defaultInteriorConfig(resume, house)) as InteriorConfig);
      const next = generateInterior(resume, house, config) as GameScene;
      initialPoint.current = null;
      const point = game.current?.getPosition() || house.entrance;
      setProgress({
        ...state,
        visited: [...new Set([...state.visited, house.id])],
        flags: { ...state.flags, "exterior:x": point.x, "exterior:y": point.y },
        configs: {
          ...state.configs,
          interiors: { ...state.configs.interiors, [house.id]: config },
        },
        position: {
          scene: "interior",
          buildingId: house.id,
          point: next.spawn,
        },
      });
      setInterior(next);
      setNearby(null);
      setPanel(null);
      setObject(null);
      setToast(
        `Entered ${house.label}.`,
      );
      focusGame();
    } catch (e) {
      setToast(
        e instanceof Error
          ? e.message
          : "This interior could not be generated.",
      );
    }
  };
  const execute = (target: GameObject, actionId: string) => {
    const declared = target.actions.find(action => action.id === actionId);
    audioManager.effect("interact");
    if (declared?.kind === 'garden') { enter(GARDEN_ID); return; }
    if (declared?.kind === 'creature') { setCreature(target.creatureEntity); setCreatureMessage(''); setPanel('creature'); return; }
    if (declared?.kind === 'pantry' && creatureState) { const stocked = restockCreatureFood(creatureState); setProgress(p => p ? { ...p, flags: { ...p.flags, [CREATURE_KEY]: saveCreatureState(stocked.state) } } : p); setObjectMessage('Treat pouch filled. Observe a creature, then offer its favourite food.'); return; }
    if (declared?.kind === 'garden-note') { setProgress(p => p ? { ...p, flags: { ...p.flags, 'v4:garden-note': true }, items: { ...p.items, 'moonseed-badge': 1 } } : p); setObjectMessage('“Leave room for the experiment that surprises you.” A moonseed badge joins your collection.'); return; }
    if (declared?.kind === 'device') { setDevice({ ...generateDevice(seed, String(declared.deviceType), String(declared.siteId || interior?.buildingId || 'village'), bookRef.current?.preferences.profile || 'calm'), siteId: String(declared.siteId || interior?.buildingId || 'village') }); setPanel('device'); return; }
    if (declared?.kind === "puzzle") { setPuzzleId(String(declared.puzzleId)); setPanel("puzzle"); return; }
    if (declared?.kind === "encounter" && story) {
      const key = String(declared.encounterKey || target.id);
      if (progress?.flags[`v3:visible:${key}`]) { setObjectMessage('The signal has settled. Its token is already in your collection.'); return; }
      const next = createDuel(`${seed}:visible:${key}`, String(declared.opponent || 'signal'), { storyStage: story.solved.length, knowledge: story.solved });
      setDuel({ ...next, visibleKey: key }); panelRef.current = 'duel'; setPanel('duel'); audioManager.effect('encounter'); return;
    }
    if (declared?.kind === "lore" && plan && story) {
      const result = readMysteryPage(story, plan, String(declared.pageId));
      setProgress(p => p ? { ...p, flags: { ...p.flags, [STORY_KEY]: JSON.stringify(result.state) } } : p);
      setObjectMessage(result.message); audioManager.effect("page"); return;
    }
    if (declared?.kind === "storytravel") { const house = world?.locations.find(l => l.id === declared.buildingId); if (house) travel(house); return; }
    if (declared?.kind === "storyboss" && plan && story) {
      if (plan.boss.prerequisites.some((id: string) => !story.solved.includes(id))) { setObjectMessage("The archive lock needs the five connected clues. Your journal points to the next device."); return; }
      setDuel(createDuel(`${seed}:indexer`, "guardian", { boss: true, storyStage: story.solved.length, knowledge: story.solved })); setPanel("duel"); audioManager.effect("encounter"); return;
    }
    const state = progressRef.current;
    if (!state) return;
    const result = performAction(state, target, actionId);
    setProgress(result.state as unknown as Progress);
    setObjectMessage(result.message);
    if (result.event === "discover") audioManager.effect("collect");
    const questCompleted =
      state.quests.fieldTrip !== "complete" &&
      result.state.quests.fieldTrip === "complete";
    if (result.event === 'discover') setToast(questCompleted ? 'Field note discovered · field key earned.' : 'Field note discovered.');
    if (result.event === "enter")
      enter(result.buildingId!, result.state as unknown as Progress);
    else if (result.event === "exit") leave();
    else if (result.event === "battle") {
      setBattle(null);
      setBattleError("");
      setPanel("battle");
    }
  };
  const interact = (target: GameObject) => {
    if (panelRef.current === "duel") return;
    setObject(target);
    setObjectMessage("");
    if (
      target.actions.length === 1 &&
      ["enter", "exit", "garden", "creature", "device"].includes(target.actions[0].kind)
    ) {
      execute(target, target.actions[0].id);
    } else setPanel("interaction");
  };
  const start = () => {
    void audioManager.unlock();
    setStarted(true);
    setPanel(null);
    if (!progress?.flags['v4:onboarded']) {
      setToast('WASD / arrows to walk. Click an object, or press E / Enter to use it.');
      setProgress(p => p ? { ...p, flags: { ...p.flags, 'v4:onboarded': true } } : p);
    }
    focusGame();
  };
  const travel = (house: Location) => {
    const leavingInterior = Boolean(interior);
    setInterior(null);
    setNearby(null);
    setStarted(true);
    setPanel(null);
    setObject(null);
    initialPoint.current = leavingInterior ? house.entrance : null;
    setProgress((p) =>
      p ? { ...p, position: { scene: "village", point: house.entrance } } : p,
    );
    if (!leavingInterior)
      requestAnimationFrame(() => game.current?.teleport(house.entrance));
    focusGame();
  };
  const travelGarden = () => {
    if (!world || !gardenUnlocked(story)) { setToast('The Glitch Garden opens after the route tree and bridge are restored.'); return; }
    const point = gardenEntrance(world); const changing = Boolean(interior);
    setInterior(null); setNearby(null); setObject(null); setPanel(null); setStarted(true);
    setProgress(p => p ? { ...p, position: { scene: 'village', point } } : p);
    initialPoint.current = changing ? point : null;
    if (!changing) requestAnimationFrame(() => game.current?.teleport(point));
    focusGame();
  };
  const openJournal = (id?: string, full = false) => {
    if (id) setSelected(id);
    setReading(full);
    setPanel("journal");
  };
  const applyVillage = (config: VillageConfig) => {
    if (!resume || !defaults.current) return;
    const next = configuredWorld(resume, config, defaults.current);
    const nextScene = villageScene(next) as GameScene;
    setWorld(next);
    setInterior(null);
    setNearby(null);
    setProgress((p) =>
      p
        ? {
            ...p,
            configs: { ...p.configs, village: config },
            position: { scene: "village", point: nextScene.spawn },
          }
        : p,
    );
    initialPoint.current = nextScene.spawn;
    setStarted(true);
  };
  const applyInterior = (config: InteriorConfig) => {
    if (!resume || !world) return;
    const house = world.locations.find((l) => l.id === config.buildingId)!;
    const next = generateInterior(resume, house, config) as GameScene;
    setProgress((p) =>
      p
        ? {
            ...p,
            configs: {
              ...p.configs,
              interiors: { ...p.configs.interiors, [house.id]: config },
            },
            ...(interior?.buildingId === house.id
              ? {
                  position: {
                    scene: "interior",
                    buildingId: house.id,
                    point: next.spawn,
                  },
                }
              : {}),
          }
        : p,
    );
    if (interior?.buildingId === house.id) {
      setInterior(next);
      setNearby(null);
    }
  };
  const finishMatch = () => {
    if (battle)
      setProgress((p) =>
        p ? (finishBattle(p, battle) as unknown as Progress) : p,
      );
    setBattle(null);
    setPanel(null);
    focusGame();
  };
  const beginMatch = (type: string) => {
    setBattle(createBattle(`${world?.seed}:${type}`, type) as BattleState);
    setBattleError("");
  };
  const battleChanged = (next: BattleState) => {
    setBattle(next);
    if (next.status !== "active")
      setProgress((p) =>
        p ? (finishBattle(p, next) as unknown as Progress) : p,
      );
  };
  const importJourney = () => {
    if (!defaults.current || !resume || !bookRef.current) return;
    try {
      const raw = JSON.parse(journeyText);
      const preserved = storeActiveProgress(bookRef.current, saveProgress(progressRef.current));
      let nextBook: any;
      if (raw.version === 3 && Array.isArray(raw.slots)) {
        const imported = restoreSaveBook(journeyText, '', 'imported');
        if (imported.warning) throw Error(imported.warning);
        for (const slot of imported.book.slots) {
          if (!slot.save) continue;
          const check = loadProgress(slot.save, resume);
          if (check.warning) throw Error(check.warning);
          const session = buildSession(resume, defaults.current, slot);
          if (session.warning && !session.warning.startsWith('Your position was moved')) throw Error(session.warning);
        }
        nextBook = mergeSaveBooks(preserved, imported.book);
      } else {
        const loaded = loadProgress(journeyText, resume);
        if (loaded.warning) throw Error(loaded.warning);
        const savedSeed = (loaded.state as unknown as Progress).flags['v3:seed'];
        nextBook = startExpedition(preserved, typeof savedSeed === 'string' ? savedSeed : 'imported-v2', 'Imported journey');
        nextBook = { ...nextBook, slots: nextBook.slots.map((slot: any) => slot.id === nextBook.activeId ? { ...slot, legacy: typeof savedSeed !== 'string', save: journeyText } : slot) };
      }
      adoptExpedition(nextBook);
      setJourneyError(''); setJourneyText('');
      setToast('Imported into new slots. Your previous expeditions have been kept.');
    } catch (e) { setJourneyError(e instanceof Error ? e.message : 'Could not import this journey. Existing saves are intact.'); }
  };

  const commitStory = (next: any) => setProgress(p => p ? { ...p, flags: { ...p.flags, [STORY_KEY]: JSON.stringify(next) } } : p);
  const submitPuzzle = (submission: any) => {
    if (!plan || !story) return { correct: false, message: 'The journal is not ready.' };
    const result = solveMystery(story, plan, puzzleId, submission);
    commitStory(result.state); audioManager.effect(result.correct ? 'puzzle' : 'interact');
    if (result.correct) setToast(puzzleId === 'bridge-repair' ? 'Canal bridge restored · the Glitch Garden is open.' : 'Clue restored.');
    return result;
  };
  const openStoryPuzzle = (id: string) => {
    const item = plan?.puzzles.find((p: any) => p.id === id);
    if (!item) return;
    if (story.solved.includes(id) || interior?.buildingId === item.buildingId) { setPuzzleId(id); setPanel('puzzle'); }
    else { const house = world?.locations.find(l => l.id === item.buildingId); if (house) travel(house); setToast(`Enter ${house?.label || 'the marked house'} and find ${item.title}.`); }
  };
  const duelChanged = (next: any) => {
    if (next.status !== "active") settleEncounter();
    if (duel && next !== duel) {
      if (next.enemy.hp < duel.enemy.hp) audioManager.effect('attack');
      if (next.lastEvent === 'guard') audioManager.effect('guard');
      if (next.player.hp < duel.player.hp) audioManager.effect('hit');
      if (next.status === 'defeat') audioManager.effect('lose');
    }
    setDuel(next);
    if (next.status !== 'victory') return;
    setProgress(p => {
      if (!p || p.flags[`v3:won:${next.id}`]) return p;
      const flags = { ...p.flags, [`v3:won:${next.id}`]: true, ...(next.visibleKey ? { [`v3:visible:${next.visibleKey}`]: true } : {}) };
      if (next.boss && plan && resume && world) flags[STORY_KEY] = JSON.stringify(finishMysteryBoss(readMystery(String(p.flags[STORY_KEY] || ''), seed, resume, world)));
      const item = next.boss ? 'archive-sigil' : next.rare ? 'prismatic-token' : 'signal-token';
      return { ...p, flags, items: { ...p.items, [item]: Math.min(999, (p.items[item] || 0) + 1) } };
    });
    audioManager.effect('win');
    setToast(next.boss ? 'The archive is restored. Open the journal to read the ending.' : next.rare ? 'A prismatic token joins your collection.' : 'A signal token joins your collection.');
  };
  const walkDistance = useCallback((distance: number, movementSeconds = distance / 78) => {
    if (!startedRef.current || panelRef.current || !trackerRef.current || !bookRef.current?.preferences.encounters) return;
    travelPending.current += distance; walkingSeconds.current += movementSeconds;
    if (travelPending.current < 16) return;
    const map = sceneRef.current; if (!map) return;
    let knowledge: string[] = []; try { knowledge = JSON.parse(String(progressRef.current?.flags[STORY_KEY] || '{}')).solved || []; } catch { /* Fresh clues are safe. */ }
    const result = travelEncounter(trackerRef.current, { distance: travelPending.current, sceneKind: map.kind, region: map.archetype || 'village', areaId: map.id, movementSeconds: walkingSeconds.current, profile: bookRef.current?.preferences.profile || 'calm', storyStage: knowledge.length, paused: false });
    travelPending.current = 0; walkingSeconds.current = 0; trackerRef.current = result.tracker;
    if (result.encounter) {
      const next = createDuel(result.encounter.id, result.encounter.opponent, { storyStage: knowledge.length, knowledge });
      next.enemy.name = result.encounter.title;
      const encounterDuel = { ...next, rare: result.encounter.rare };
      setProgress(p => p ? { ...p, flags: { ...p.flags, [ENCOUNTER_KEY]: JSON.stringify(result.tracker) } } : p);
      panelRef.current = 'duel';
      setDuel(encounterDuel); setPanel('duel'); audioManager.effect('encounter');
    }
  }, [audioManager]);
  const submitDevice = (submission: any) => {
    if (!device) return { correct: false, message: 'Choose a device.' };
    const result = solveDeviceProgress(progressRef.current!, device, submission);
    if (result.correct) { setProgress(result.state as unknown as Progress); audioManager.effect('puzzle'); }
    return result;
  };
  const actWithCreature = (action: string) => {
    if (!creature || !creatureState || !scene) return;
    const result = creatureAction(creatureState, creature, action, { scene, player: game.current?.getPosition() || progress!.position.point, areaId: scene.id });
    setProgress(p => p ? { ...p, flags: { ...p.flags, [CREATURE_KEY]: saveCreatureState(result.state) } } : p);
    setCreatureMessage(result.message); audioManager.effect(action === 'feed' ? 'collect' : 'interact');
  };
  const footstep = useCallback(() => audioManager.effect('footstep'), [audioManager]);
  const audioChanged = (settings: any) => {
    if (!bookRef.current) return;
    const next = { ...bookRef.current, preferences: { ...bookRef.current.preferences, audio: settings } };
    bookRef.current = next; setBook(next);
    try { if (!protectStoredBook.current) localStorage.setItem(SAVE_BOOK_KEY, serializeSaveBook(next)); } catch { /* The visible journey export remains available. */ }
  };
  const adoptExpedition = (nextBook: any) => {
    if (!resume || !defaults.current) return;
    const slot = activeSlot(nextBook), session = buildSession(resume, defaults.current, slot);
    if (slot.save && session.requiresRecovery) throw Error('This earlier save needs recovery and has been preserved. Export the save book, then start a fresh expedition.');
    bookRef.current = nextBook; setBook(nextBook); setSeed(slot.seed); trackerRef.current = session.tracker; travelPending.current = 0; walkingSeconds.current = 0;
    audioManager.setSettings(nextBook.preferences.audio);
    setWorld(session.world as World); setInterior(session.interior as GameScene | null); setProgress(session.state as unknown as Progress); setNearby(null); setObject(null); setDuel(null); setBattle(null);
    initialPoint.current = session.point;
    setExpeditionError(''); setPanel(null); setStarted(true); setToast(session.warning || `Expedition ready. Seed: ${slot.seed}. Every earlier save slot has been kept.`);
    requestAnimationFrame(() => { game.current?.teleport(session.point); initialPoint.current = null; });
    void audioManager.unlock(); focusGame();
  };
  const newExpedition = (newSeed: string) => {
    try { const preserved = progressRef.current ? storeActiveProgress(bookRef.current, saveProgress(progressRef.current)) : bookRef.current; adoptExpedition(startExpedition(preserved, newSeed)); }
    catch (e) { setExpeditionError(e instanceof Error ? e.message : 'This expedition could not be generated. Your previous save is intact.'); }
  };
  const switchExpedition = (id: string) => {
    try { const preserved = storeActiveProgress(bookRef.current, saveProgress(progressRef.current)); adoptExpedition(selectExpedition(preserved, id)); }
    catch (e) { setExpeditionError(e instanceof Error ? e.message : 'Could not open that expedition.'); }
  };

  const downloadProtectedSave = () => {
    try {
      const text = localStorage.getItem(SAVE_BOOK_KEY) || localStorage.getItem(LEGACY_SAVE_KEY);
      if (!text) { setToast('There is no earlier stored text to export.'); return; }
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'world-of-work-protected-original.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setToast('Browser storage is unavailable. Export your working expedition book instead.'); }
  };

  if (loadError)
    return (
      <main className="error-page">
        <h1>The village couldn’t load.</h1>
        <p>{loadError}</p>
        <a href="./portfolio.html">Read the portfolio</a>
        <a href="./resume.pdf" download>
          Download résumé
        </a>
      </main>
    );
  if (!resume || !world || !progress || !scene)
    return (
      <main className="boot">
        <div className="boot-sprite" />
        <p>Opening a new chapter…</p>
        <a href="./portfolio.html">Open the reading version</a>
      </main>
    );
  const current =
    world.locations.find((l) => l.id === selected) || world.locations[0];
  const recordCount = resume.sections.reduce(
    (total, s) => total + s.entries.length,
    0,
  );
  const sectionCount = new Set(
    progress.unlocked.map((id) => progress.recordSections[id]),
  ).size;
  const title =
    panel === "journal"
      ? reading
        ? "The complete portfolio"
        : "Your discovery journal"
      : panel === "map"
        ? interior
          ? "Interior room map"
          : "Your village map"
        : panel === "code"
          ? "The procedural forge"
          : panel === "interaction"
            ? object?.label || "Interaction"
            : panel === "quests"
              ? "Expedition notes"
              : panel === "battle"
                ? "Tactical sparring"
                : "Take a breather";

  return (
    <main className="app-shell" onClickCapture={event => { if ((event.target as Element).closest("button, summary")) audioManager.effect("menu"); }}>
      <header className="masthead">
        <a
          className="identity"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setStarted(false);
            setPanel(null);
          }}
        >
          <span className="identity-sprite" aria-hidden="true" />
          <span>
            <strong>{resume.name}</strong>
            <small>A WORLD OF WORK · V4</small>
          </span>
        </a>
        <nav aria-label="Portfolio navigation">
          <button className="mystery-nav" onClick={() => setPanel("mystery")}>Journal</button>
          <button className="portfolio-nav" onClick={() => openJournal(undefined, true)}>Portfolio</button>
          <a className="resume-link" href="./resume.pdf" download>
            Résumé ↓
          </a>
        </nav>
      </header>
      <section className="world-stage" aria-label="Procedural résumé RPG">
        <Game
          ref={game}
          scene={scene}
          active={started && panel === null}
          unlockedIds={progress.unlocked}
          openedIds={progress.opened}
          onInteract={interact}
          onPause={pause}
          onNearby={setNearby}
          onPosition={positionChanged}
          onTravel={walkDistance}
          onStep={footstep}
          creatureState={creatureState}
          creatureSeed={seed}
          creatureProfile={book?.preferences.profile || 'calm'}
        />
        {!started && (
          <div className="title-screen">
            <div className="title-card">
              <span className="eyebrow">AN ORIGINAL MYSTERY ADVENTURE</span>
              <h1>
                The Missing<br />Room
              </h1>
              <p>The map says the archive doesn’t exist. The archive disagrees.</p>
              <div className="seed-badge">Seed: {seed}</div>
              <div className="title-actions">
                <button className="button primary" onClick={start}>
                  {progress.visited.length
                    ? "Continue your journey"
                    : "Enter the village"}{" "}
                  →
                </button>
                <button
                  className="reading-link"
                  onClick={() => openJournal(undefined, true)}
                >
                  Just here to read? Open the portfolio ↗
                </button>
              </div>
              <button className="reading-link" onClick={() => setPanel("expeditions")}>New seed / saved expeditions ↗</button>
              <div className="title-note">
                Enter houses. Discover stories. Make new paths.
              </div>
            </div>
            <div className="title-caption">
              <span>
                {world.locations.length} houses · {recordCount} field notes
              </span>
              <span>Repair the bridge. Discover the Glitch Garden.</span>
            </div>
          </div>
        )}
        {started && (
          <>
            <div className="game-topline">
              <div>
                <span className="eyebrow">
                  {interior
                    ? `${interior.label} · ${interior.archetype}`
                    : "THE RÉSUMÉ VILLAGE"}
                </span>
                <button className="mystery-objective" onClick={() => setPanel("mystery")}>{plan && story ? currentObjective(story, plan).title : "Investigate the missing room"}</button>
              <span className="journey-count">
                  {progress.unlocked.length} / {recordCount} notes discovered ·{" "}
                  {progress.visited.length} houses entered
                </span>
                {interior && (
                  <button className="exit-interior" onClick={leave}>
                    Leave building ↗
                  </button>
                )}
              </div>
              <button
                className="menu-button"
                onClick={pause}
                aria-label="Pause and open menu"
              >
                Ⅱ <span>Menu</span>
              </button>
            </div>
            <aside className="mini-map" aria-label="Area map">
              <SceneOverview scene={scene} tiny />
              <button onClick={() => setPanel("map")}>
                {interior ? "Room map" : "Village map"} ↗
              </button>
            </aside>
            <div
              className={`interaction-prompt ${nearby ? "visible" : ""}`}
              aria-live="polite"
            >
              {nearby && (
                <>
                  <span>{nearby.label}</span>
                  <button
                    id="game-action-dispatch"
                    onClick={() => game.current?.interactNearby()}
                  >
                    <kbd>E</kbd> {nearby.actions[0]?.label || "Interact"}
                  </button>
                </>
              )}
            </div>
          </>
        )}
        {toast && (
          <div className="toast" role="status">
            <p>{toast}</p>
            <button aria-label="Dismiss feedback" onClick={() => setToast("")}>
              ×
            </button>
          </div>
        )}
      </section>
      <footer className="footer-bar"><span>The Missing Room · {completedDevices.length} experiments restored</span><details className="controls-help"><summary>Controls</summary><p>Walk: WASD / arrows. Use: E / Enter, or click an object. Run: Shift. Menu: Escape. In panels: WASD / arrows move focus, Enter selects, Tab reaches text fields. Touch controls appear on touch devices.</p></details></footer>
      {panel && (
        <Modal
          title={panel === "device" ? device?.title || "A CS device" : panel === "creature" ? creature?.name || "A creature" : panel === "mystery" ? "The missing-room journal" : panel === "puzzle" ? "An in-world puzzle" : panel === "duel" ? "An encounter" : panel === "audio" ? "Sound settings" : panel === "expeditions" ? "Expeditions and seeds" : title}
          onClose={closePanel}
          wide={["journal", "map", "code", "mystery", "puzzle", "duel", "expeditions", "device"].includes(panel)}
        >
          {panel === 'device' && device && <DevicePanel key={device.instanceId} device={device} completed={completedDevices.includes(device.challengeId)} onSubmit={submitDevice} onClose={closePanel} />}
          {panel === 'creature' && creature && creatureState && <CreaturePanel creature={creature} state={creatureState} onAction={actWithCreature} message={creatureMessage} onClose={closePanel} />}
          {panel === "mystery" && plan && story && <MysteryJournal plan={plan} state={story} gardenOpen={gardenUnlocked(story)} onGarden={travelGarden} onPuzzle={openStoryPuzzle} onTravel={(id: string) => { const house = world.locations.find(l => l.id === id); if (house) travel(house); }} />}
          {panel === "puzzle" && plan && story && <PuzzlePanel key={`${seed}:${puzzleId}`} puzzle={plan.puzzles.find((p: any) => p.id === puzzleId)} state={story} onSubmit={submitPuzzle} onClose={closePanel} />}
          {panel === "duel" && duel && <EncounterBattle battle={duel} onChange={duelChanged} onFinish={closePanel} />}
          {panel === "audio" && <AudioSettings manager={audioManager} onChange={audioChanged} />}
          {panel === "expeditions" && book && <ExpeditionPanel book={book} summary={`${world.locations.length} houses, ${world.locations.filter(location => world.edges.filter(edge => edge.from === location.vertex || edge.to === location.vertex).length === 1).length} road ends to explore. Your first clue waits in ${world.locations.find(location => location.id === plan?.puzzles[0].buildingId)?.label || 'the marked library'}.`} error={expeditionError} onStart={newExpedition} onSwitch={switchExpedition} onExport={() => downloadJSON(bookRef.current, 'world-of-work-v4-expeditions.json')} />}
          {panel === "journal" && (
            <div className="journal">
              <nav className="journal-nav" aria-label="Résumé sections">
                <div className="journal-owner">
                  <strong>{resume.name}</strong>
                  <span>
                    {reading
                      ? "Complete reading mode"
                      : `${progress.unlocked.length} discoveries`}
                  </span>
                </div>
                {world.locations.map((l) => (
                  <button
                    key={l.id}
                    aria-current={l.id === current.id ? "page" : undefined}
                    onClick={() => setSelected(l.id)}
                  >
                    <span>{String(l.vertex).padStart(2, "0")}</span>
                    {l.label}
                    <small>
                      {
                        l.recordIds.filter((id) =>
                          progress.unlocked.includes(id),
                        ).length
                      }
                      /{l.recordIds.length}
                    </small>
                  </button>
                ))}
                <a className="journal-download" href="./resume.pdf" download>
                  Original résumé ↓
                </a>
              </nav>
              <div className="journal-body">
                <div className="reading-mode">
                  <span>
                    {reading
                      ? "Every résumé entry is available here."
                      : "Entries unlock at their related objects."}
                  </span>
                  <button onClick={() => setReading((v) => !v)}>
                    {reading ? "Discovery journal" : "Read complete portfolio"}{" "}
                    ↗
                  </button>
                </div>
                <LocationContent
                  resume={resume}
                  location={current}
                  unlockedIds={progress.unlocked}
                  exploration={!reading}
                />
                <div className="journal-bottom">
                  <p>Transcribed from the original résumé.</p>
                  <button onClick={() => travel(current)}>
                    Visit this house →
                  </button>
                </div>
              </div>
            </div>
          )}
          {panel === "map" && (
            <div className="map-panel">
              <div className="map-heading">
                <h2>
                  {interior
                    ? "Rooms with a reason."
                    : "A place for every chapter."}
                </h2>
                <p>
                  {interior
                    ? "Numbered rooms follow your exact Prüfer tree. Doors connect rooms; furniture leaves clear routes."
                    : "Select a house to travel there, then enter through its door."}
                </p>
              </div>
              <SceneOverview
                scene={scene}
                onTravel={
                  interior
                    ? undefined
                    : (point) => {
                        const house = world.locations.find(
                          (l) =>
                            l.entrance.x === point.x &&
                            l.entrance.y === point.y,
                        );
                        if (house) travel(house);
                        else if (point.x === gardenEntrance(world).x && point.y === gardenEntrance(world).y) travelGarden();
                      }
                }
              />
              {interior ? (
                <>
                  <div className="room-legend">
                    {interior.rooms?.map((r) => (
                      <p key={r.vertex}>
                        <strong>{r.vertex}</strong> {r.label}
                      </p>
                    ))}
                  </div>
                  <div className="code-actions">
                    {interior.buildingId !== GARDEN_ID && <button
                      className="button secondary"
                      onClick={() => setPanel("code")}
                    >
                      Configure these rooms
                    </button>}
                    <button className="button secondary" onClick={leave}>
                      Return to village
                    </button>
                  </div>
                </>
              ) : (
                <div className="map-destinations">
                  <div><span className="map-number">?</span><strong>Glitch Garden</strong><button className="travel-link" disabled={!gardenUnlocked(story)} onClick={travelGarden}>{gardenUnlocked(story) ? 'Cross the restored bridge →' : 'Sealed · repair the bridge'}</button></div>
                  {world.locations.map((l) => (
                    <div key={l.id}>
                      <span className="map-number">{l.vertex}</span>
                      <button onClick={() => openJournal(l.id)}>
                        {l.label}
                      </button>
                      <button className="travel-link" onClick={() => travel(l)}>
                        Travel →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {panel === "code" && (
            <GenerationPanel
              resume={resume}
              world={defaults.current || world}
              villageConfig={
                progress.configs.village ||
                defaultVillageConfig(defaults.current || world)
              }
              interiorConfigs={progress.configs.interiors}
              initialBuilding={interior?.buildingId === GARDEN_ID ? undefined : interior?.buildingId}
              onVillage={applyVillage}
              onInterior={applyInterior}
            />
          )}
          {panel === "interaction" && object && (
            <div className="object-panel">
              <span className="eyebrow">
                {object.type.toUpperCase()} ·{" "}
                {interior ? interior.label : "VILLAGE"}
              </span>
              <h2>{object.label}</h2>
              {!objectMessage && <p>{object.hint}</p>}
              <div className="object-actions">
                {object.actions.map((action) => {
                  const condition = ["puzzle", "lore", "storyboss", "storytravel", "encounter", "garden", "device", "creature", "pantry", "garden-note"].includes(action.kind) ? { available: true, reason: "" } : evaluateAction(object, action, progress);
                  return (
                    <div key={action.id}>
                      <button
                        className="button secondary"
                        disabled={!condition.available}
                        onClick={() => execute(object, action.id)}
                      >
                        {action.label}
                      </button>
                      {!condition.available && (
                        <small>{condition.reason}</small>
                      )}
                    </div>
                  );
                })}
              </div>
              {objectMessage && (
                <div className="object-feedback" role="status"><DialogueText text={objectMessage} /></div>
              )}
              {object.recordIds.some((id) =>
                progress.unlocked.includes(id),
              ) && (
                <button
                  className="button primary"
                  onClick={() => {
                    const sourceId =
                      progress.recordSections[
                        object.recordIds.find((id) =>
                          progress.unlocked.includes(id),
                        )!
                      ];
                    const house = world.locations.find(
                      (l) => l.sectionId === sourceId,
                    );
                    if (house) openJournal(house.id);
                  }}
                >
                  Read discovered field note →
                </button>
              )}
              <button className="reading-link" onClick={closePanel}>
                Leave / cancel without cost
              </button>
            </div>
          )}
          {panel === "quests" && (
            <div className="quest-panel">
              <span className="eyebrow">SMALL DETOURS · REAL DISCOVERIES</span>
              <h2>Your expedition.</h2>
              <article>
                <h3>First field trip</h3>
                <p>Discover three field notes across two houses.</p>
                <div className="quest-metrics">
                  <span>{Math.min(3, progress.unlocked.length)} / 3 notes</span>
                  <span>{Math.min(2, sectionCount)} / 2 houses</span>
                  <strong>
                    {progress.quests.fieldTrip === "complete"
                      ? "Complete · key awarded"
                      : progress.quests.fieldTrip === "active"
                        ? "In progress"
                        : "Starts with your first discovery"}
                  </strong>
                </div>
                <p className="muted">
                  The key opens the Curiosity chest near the Archivist. It never
                  blocks résumé content.
                </p>
              </article>
              <article>
                <h3>A friendly challenge</h3>
                <p>
                  Visit the sparring mentor near the starting house for an
                  optional tactical match.
                </p>
                <strong>
                  {progress.defeated.length} / 3 partners challenged
                  successfully
                </strong>
              </article>
              <article>
                <h3>Your satchel</h3>
                {Object.keys(progress.items).length ? (
                  <ul>
                    {Object.entries(progress.items).map(([id, count]) => (
                      <li key={id}>
                        {id.replaceAll("-", " ")} × {count}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">
                    Room for a field key and a few memories.
                  </p>
                )}
              </article>
              <button
                className="button primary"
                onClick={() => setPanel("map")}
              >
                Find another house →
              </button>
            </div>
          )}
          {panel === "battle" &&
            (battle ? (
              <Battle
                battle={battle}
                onChange={battleChanged}
                onFinish={finishMatch}
                error={battleError}
                setError={setBattleError}
              />
            ) : (
              <BattleIntro onStart={beginMatch} />
            ))}
          {panel === "pause" && (
            <div className="pause-panel">
              <span className="eyebrow">
                YOUR JOURNEY SAVES IN THIS BROWSER
              </span>
              <h2>Take the scenic route.</h2>
              {protectStoredBook.current && <p role="alert" className="form-error">Autosave is paused to protect incompatible stored data. Export your working expedition book from Expeditions / seeds. <button className="reading-link" onClick={downloadProtectedSave}>Download the earlier stored data</button></p>}
              <button className="button primary" onClick={start}>
                Continue exploring →
              </button>
              <div className="pause-grid">
                <button className="button secondary" onClick={() => setPanel('mystery')}>Mystery journal</button>
                <button className="button secondary" onClick={() => setPanel('expeditions')}>Expeditions / seeds</button>
                <button className="button secondary" onClick={() => { void audioManager.unlock(); setPanel('audio'); }}>Music and sound</button>
                <button
                  className="button secondary"
                  onClick={() => openJournal()}
                >
                  Discovery journal
                </button>
                <button
                  className="button secondary"
                  onClick={() => openJournal(undefined, true)}
                >
                  Complete portfolio
                </button>
                <button
                  className="button secondary"
                  onClick={() => setPanel("map")}
                >
                  Map / fast travel
                </button>
                <button
                  className="button secondary"
                  onClick={() => setPanel("code")}
                >
                  Procedural forge
                </button>
                <button
                  className="button secondary"
                  onClick={() => setPanel("quests")}
                >
                  Quest progress
                </button>
                <button
                  className="button secondary"
                  onClick={() =>
                    downloadJSON(
                      {
                        ...progress,
                        position: {
                          ...progress.position,
                          point:
                            game.current?.getPosition() ||
                            progress.position.point,
                        },
                      },
                      "parshwa-world-v4-journey.json",
                    )
                  }
                >
                  Export journey save
                </button>
              </div>
              <details className="config-import">
                <summary>Import a journey or expedition book</summary>
                <label htmlFor="journey-json">Journey JSON</label>
                <textarea
                  id="journey-json"
                  rows={5}
                  value={journeyText}
                  maxLength={10000000}
                  onChange={(e) => setJourneyText(e.target.value)}
                  placeholder="Paste a version 2/3 journey or version 3 expedition book"
                />
                <p className="form-error" role="alert">
                  {journeyError}
                </p>
                <button className="button secondary" onClick={importJourney}>
                  Import into new slots
                </button>
              </details>
              <a href="./resume.pdf" className="reading-link" download>
                Download the original résumé
              </a>
              <button
                className="reading-link"
                onClick={() => {
                  setStarted(false);
                  setPanel(null);
                }}
              >
                Return to the title screen
              </button>
              <label className="exploration-profile">Exploration mood <select value={book?.preferences.profile || 'calm'} onChange={event => {
                const next = { ...bookRef.current, preferences: { ...bookRef.current.preferences, profile: event.target.value } };
                bookRef.current = next; setBook(next); travelPending.current = 0; walkingSeconds.current = 0;
                try { if (!protectStoredBook.current) localStorage.setItem(SAVE_BOOK_KEY, serializeSaveBook(next)); } catch { /* Export remains available. */ }
              }}><option value="calm">Calm · relaxed (~12 min between surprises)</option><option value="balanced">Balanced · occasional (~6 min)</option><option value="chaotic">Chaotic · lively (~2 min)</option></select></label>
              <label className="encounter-preference"><input type="checkbox" checked={book?.preferences.encounters !== false} onChange={event => {
                const next = { ...bookRef.current, preferences: { ...bookRef.current.preferences, encounters: event.target.checked } };
                bookRef.current = next; setBook(next); travelPending.current = 0; walkingSeconds.current = 0;
                try { if (!protectStoredBook.current) localStorage.setItem(SAVE_BOOK_KEY, serializeSaveBook(next)); } catch { /* Export remains available. */ }
              }} />Surprise encounters while walking (the story guardian stays available)</label>
              <details className="reset-journey">
                <summary>Replay this seed</summary>
                <p>Begin a fresh expedition with this seed. This journey and every earlier slot are kept.</p>
                {expeditionError && <p role="alert" className="form-error">{expeditionError}</p>}
                <button className="button secondary" onClick={() => newExpedition(seed)}>Replay in a new slot</button>
              </details>
            </div>
          )}
        </Modal>
      )}
    </main>
  );
}
