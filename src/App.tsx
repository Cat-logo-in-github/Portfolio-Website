import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateWorld, parseSequence } from "./core/world.mjs";
import { generateInterior, defaultInteriorConfig } from "./core/interior.mjs";
import { villageScene } from "./core/village.mjs";
import {
  createProgress,
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
  | null;
const SAVE_KEY = "parshwa-world:journey:v2";
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
            if (onTravel && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onTravel(node.point);
            }
          }}
        >
          <rect x={node.x} y={node.y} width={node.width} height={node.height} />
          <text x={node.x + node.width / 2} y={node.y + node.height / 2 + 8}>
            {node.vertex}
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
  const game = useRef<GameHandle>(null);
  const defaults = useRef<World | null>(null);
  const initialPoint = useRef<Point | null>(null);
  const storageWarned = useRef(false);
  const progressRef = useRef<Progress | null>(null);
  progressRef.current = progress;
  const interiorRef = useRef<GameScene | null>(null);
  interiorRef.current = interior;
  const village = useMemo(
    () => (world ? (villageScene(world) as GameScene) : null),
    [world],
  );
  const scene = interior || village;
  const focusGame = useCallback(
    () => requestAnimationFrame(() => game.current?.focus()),
    [],
  );

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
        let saved = "";
        try {
          saved = localStorage.getItem(SAVE_KEY) || "";
        } catch {
          storageWarned.current = true;
        }
        const loaded = loadProgress(saved, r);
        const state = loaded.state as unknown as Progress;
        let nextWorld = defaultWorld,
          restoredInterior: GameScene | null = null;
        let warning =
          loaded.warning ||
          (storageWarned.current
            ? "Browser storage is unavailable. This journey works for this visit; export a save to keep it."
            : "");
        if (state.configs.village) {
          try {
            nextWorld = configuredWorld(r, state.configs.village, defaultWorld);
          } catch (e) {
            state.configs.village = null;
            warning = `${e instanceof Error ? e.message : "Invalid village settings."} The default village was restored.`;
          }
        }
        // Every stored interior is regenerated and validated before accepting its settings.
        for (const [id, config] of Object.entries(state.configs.interiors)) {
          const house = nextWorld.locations.find((l) => l.id === id);
          try {
            if (!house) throw Error("Missing building.");
            generateInterior(r, house, config);
          } catch {
            delete state.configs.interiors[id];
            warning =
              "Some saved interior settings were incompatible and were reset. Discoveries remain saved.";
          }
        }
        if (state.position.scene === "interior") {
          const house = nextWorld.locations.find(
            (l) => l.id === state.position.buildingId,
          );
          if (house) {
            const config =
              state.configs.interiors[house.id] ||
              (defaultInteriorConfig(r, house) as InteriorConfig);
            restoredInterior = generateInterior(r, house, config) as GameScene;
            state.configs.interiors[house.id] = config;
          }
        }
        const nextScene =
          restoredInterior || (villageScene(nextWorld) as GameScene);
        const validPoint = canStand(state.position.point, nextScene)
          ? state.position.point
          : nextScene.spawn;
        state.position = {
          scene: nextScene.kind,
          ...(restoredInterior
            ? { buildingId: restoredInterior.buildingId }
            : {}),
          point: validPoint,
        };
        if (restoredInterior)
          restoredInterior = { ...restoredInterior, spawn: validPoint };
        else initialPoint.current = validPoint;
        defaults.current = defaultWorld;
        setResume(r);
        setWorld(nextWorld);
        setProgress(state);
        setInterior(restoredInterior);
        setSelected(nextWorld.locations[0]?.id || "");
        setToast(warning);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setLoadError(e.message);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!progress) return;
    try {
      localStorage.setItem(SAVE_KEY, saveProgress(progress));
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

  const closePanel = useCallback(() => {
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
  }, [panel, battle, focusGame]);
  const pause = useCallback(() => setPanel("pause"), []);
  const positionChanged = useCallback((point: Point) => {
    setProgress((p) =>
      p
        ? {
            ...p,
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
    if (!world || !village || !interior) return;
    const state = progressRef.current!;
    const house = world.locations.find((l) => l.id === interior.buildingId)!;
    const saved = {
      x: Number(state.flags["exterior:x"]),
      y: Number(state.flags["exterior:y"]),
    };
    const point =
      Number.isFinite(saved.x) &&
      Number.isFinite(saved.y) &&
      canStand(saved, village)
        ? saved
        : house.entrance;
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
    if (!resume || !world) return;
    const house = world.locations.find((l) => l.id === buildingId);
    if (!house) return;
    const state = stateOverride || progressRef.current!;
    try {
      const config =
        state.configs.interiors[house.id] ||
        (defaultInteriorConfig(resume, house) as InteriorConfig);
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
        `Entered ${house.label}. Approach a marked object and press E. Inspect gives a hint; the relevant action reveals its note.`,
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
    const state = progressRef.current;
    if (!state) return;
    const result = performAction(state, target, actionId);
    setProgress(result.state as unknown as Progress);
    setObjectMessage(result.message);
    const questCompleted =
      state.quests.fieldTrip !== "complete" &&
      result.state.quests.fieldTrip === "complete";
    setToast(
      result.event === "discover"
        ? `Field note discovered. You can read it here or in the journal.${questCompleted ? " Field trip complete! A field key is in your satchel." : ""}`
        : result.message,
    );
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
    setObject(target);
    setObjectMessage("");
    if (
      target.actions.length === 1 &&
      ["enter", "exit"].includes(target.actions[0].kind)
    ) {
      execute(target, target.actions[0].id);
    } else setPanel("interaction");
  };
  const start = () => {
    setStarted(true);
    setPanel(null);
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
    if (!defaults.current || !resume) return;
    try {
      const loaded = loadProgress(journeyText, resume);
      if (loaded.warning) throw Error(loaded.warning);
      const state = loaded.state as unknown as Progress;
      const restoredWorld = state.configs.village
        ? configuredWorld(resume, state.configs.village, defaults.current)
        : defaults.current;
      for (const [id, config] of Object.entries(state.configs.interiors)) {
        const house = restoredWorld.locations.find((l) => l.id === id);
        if (!house) throw Error("Save contains an unknown building.");
        generateInterior(resume, house, config);
      }
      let room: GameScene | null = null;
      if (state.position.scene === "interior") {
        const house = restoredWorld.locations.find(
          (l) => l.id === state.position.buildingId,
        );
        if (!house) throw Error("Saved interior no longer exists.");
        room = generateInterior(
          resume,
          house,
          state.configs.interiors[house.id] ||
            defaultInteriorConfig(resume, house),
        ) as GameScene;
      }
      const model = room || (villageScene(restoredWorld) as GameScene);
      const point = canStand(state.position.point, model)
        ? state.position.point
        : model.spawn;
      state.position.point = point;
      if (room) room = { ...room, spawn: point };
      initialPoint.current = room ? null : point;
      setWorld(restoredWorld);
      setInterior(room);
      setProgress(state);
      setNearby(null);
      setJourneyError("");
      setPanel(null);
      setStarted(true);
      setToast(
        "Journey restored. Discoveries, rewards and procedural settings are ready.",
      );
      requestAnimationFrame(() => {
        game.current?.teleport(point);
        initialPoint.current = null;
      });
      focusGame();
    } catch (e) {
      setJourneyError(
        e instanceof Error ? e.message : "Could not import this journey.",
      );
    }
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
                ? "Friendly tactical sparring"
                : "Take a breather";

  return (
    <main className="app-shell">
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
            <small>A WORLD OF WORK · V2</small>
          </span>
        </a>
        <nav aria-label="Portfolio navigation">
          <button onClick={() => openJournal()}>Journal</button>
          <button onClick={() => setPanel("map")}>Village map</button>
          <button className="code-nav" onClick={() => setPanel("code")}>
            Forge
          </button>
          <button className="quest-nav" onClick={() => setPanel("quests")}>
            Quests
          </button>
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
        />
        {!started && (
          <div className="title-screen">
            <div className="title-card">
              <span className="eyebrow">A SMALL PROCEDURAL RPG</span>
              <h1>
                {resume.name.split(" ")[0]}
                <br />
                {resume.name.split(" ").slice(1).join(" ")}
              </h1>
              <p>{resume.title}</p>
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
              <div className="title-note">
                Enter houses. Discover stories. Make new paths.
              </div>
            </div>
            <div className="title-caption">
              <span>
                {world.locations.length} houses · {recordCount} field notes
              </span>
              <span>Codes create the paths. Curiosity finds the stories.</span>
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
            <aside className="mini-map">
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
                    onClick={() => interact(nearby)}
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
      <footer className="footer-bar">
        <div>
          <kbd>WASD</kbd> / <kbd>↑↓←→</kbd>
          <span> wander</span>
          <span className="footer-separator">·</span>
          <kbd>E</kbd>
          <span> interact</span>
          <span className="footer-separator">·</span>
          <kbd>ESC</kbd>
          <span> menu</span>
        </div>
        <button onClick={() => setPanel("code")}>
          Village + interior Prüfer codes ↗
        </button>
      </footer>
      {panel && (
        <Modal
          title={title}
          onClose={closePanel}
          wide={["journal", "map", "code"].includes(panel)}
        >
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
                    <button
                      className="button secondary"
                      onClick={() => setPanel("code")}
                    >
                      Configure these rooms
                    </button>
                    <button className="button secondary" onClick={leave}>
                      Return to village
                    </button>
                  </div>
                </>
              ) : (
                <div className="map-destinations">
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
              initialBuilding={interior?.buildingId}
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
              <p>{object.hint}</p>
              <div className="object-actions">
                {object.actions.map((action) => {
                  const condition = evaluateAction(object, action, progress);
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
                <p className="object-feedback" role="status">
                  {objectMessage}
                </p>
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
              <button className="button primary" onClick={start}>
                Continue exploring →
              </button>
              <div className="pause-grid">
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
                      "parshwa-world-v2-journey.json",
                    )
                  }
                >
                  Export journey save
                </button>
              </div>
              <details className="config-import">
                <summary>Import a journey save</summary>
                <label htmlFor="journey-json">Journey JSON</label>
                <textarea
                  id="journey-json"
                  rows={5}
                  value={journeyText}
                  maxLength={1000000}
                  onChange={(e) => setJourneyText(e.target.value)}
                  placeholder="Paste an exported version 2 journey here"
                />
                <p className="form-error" role="alert">
                  {journeyError}
                </p>
                <button className="button secondary" onClick={importJourney}>
                  Validate and restore journey
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
              <details className="reset-journey">
                <summary>Start a fresh exploration</summary>
                <p>
                  This clears this browser’s discoveries and rewards. Export
                  your journey first if you want to keep it.
                </p>
                <button
                  className="button secondary"
                  onClick={() => {
                    const clean = createProgress(resume) as unknown as Progress;
                    clean.position.point = defaults.current!.spawn;
                    setProgress(clean);
                    setWorld(defaults.current);
                    setInterior(null);
                    setNearby(null);
                    setStarted(false);
                    setPanel(null);
                    initialPoint.current = clean.position.point;
                    requestAnimationFrame(() => {
                      game.current?.teleport(clean.position.point);
                      initialPoint.current = null;
                    });
                  }}
                >
                  Reset this journey
                </button>
              </details>
            </div>
          )}
        </Modal>
      )}
    </main>
  );
}
