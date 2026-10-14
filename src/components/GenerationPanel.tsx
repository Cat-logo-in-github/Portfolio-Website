import { useMemo, useState } from "react";
import { parseSequence, seededRandom, hashString } from "../core/world.mjs";
import {
  defaultInteriorConfig,
  randomSequence,
  generateInterior,
  validateInteriorConfig,
} from "../core/interior.mjs";
import type {
  Resume,
  World,
  Location,
  InteriorConfig,
  VillageConfig,
  GameScene,
} from "../types";

export function downloadJSON(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function GenerationPanel({
  resume,
  world,
  villageConfig,
  interiorConfigs,
  initialBuilding,
  onVillage,
  onInterior,
}: {
  resume: Resume;
  world: World;
  villageConfig: VillageConfig;
  interiorConfigs: Record<string, InteriorConfig>;
  initialBuilding?: string;
  onVillage: (config: VillageConfig) => void;
  onInterior: (config: InteriorConfig) => void;
}) {
  const [target, setTarget] = useState(initialBuilding || "village");
  const [nodeCount, setNodeCount] = useState(
    initialBuilding
      ? interiorConfigs[initialBuilding]?.nodeCount ||
          defaultInteriorConfig(
            resume,
            world.locations.find((l) => l.id === initialBuilding)!,
          ).nodeCount
      : world.locations.length,
  );
  const starting = initialBuilding
    ? interiorConfigs[initialBuilding] ||
      defaultInteriorConfig(
        resume,
        world.locations.find((l) => l.id === initialBuilding)!,
      )
    : villageConfig;
  const [sequence, setSequence] = useState(starting.sequence.join(", "));
  const [layoutSeed, setLayoutSeed] = useState(starting.layoutSeed);
  const [decorationSeed, setDecorationSeed] = useState(starting.decorationSeed);
  const [archetype, setArchetype] = useState(
    "archetype" in starting ? starting.archetype : "home",
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [importText, setImportText] = useState("");
  const [randomCount, setRandomCount] = useState(0);
  const location = world.locations.find((l) => l.id === target);
  const pick = (id: string) => {
    const config =
      id === "village"
        ? villageConfig
        : interiorConfigs[id] ||
          defaultInteriorConfig(
            resume,
            world.locations.find((l) => l.id === id)!,
          );
    setTarget(id);
    setNodeCount(config.nodeCount);
    setSequence(config.sequence.join(", "));
    setLayoutSeed(config.layoutSeed);
    setDecorationSeed(config.decorationSeed);
    if ("archetype" in config) setArchetype(config.archetype);
    setError("");
    setMessage("");
  };
  const configNow = (): VillageConfig | InteriorConfig => {
    const values = parseSequence(sequence, nodeCount);
    if (
      layoutSeed.length > 128 ||
      decorationSeed.length > 128 ||
      !layoutSeed.trim() ||
      !decorationSeed.trim()
    )
      throw Error("Both seeds must contain 1–128 characters.");
    return target === "village"
      ? {
          algorithmVersion: 2,
          scope: "village",
          nodeCount,
          sequence: values,
          layoutSeed,
          decorationSeed,
        }
      : {
          algorithmVersion: 2,
          scope: "interior",
          buildingId: target,
          archetype,
          nodeCount,
          sequence: values,
          layoutSeed,
          decorationSeed,
        };
  };
  const preview = useMemo(() => {
    if (!location) return null;
    try {
      return generateInterior(resume, location, configNow()) as GameScene;
    } catch {
      return null;
    }
  }, [
    target,
    nodeCount,
    sequence,
    layoutSeed,
    decorationSeed,
    archetype,
    resume,
  ]);
  const apply = (config: VillageConfig | InteriorConfig) => {
    if (config.algorithmVersion !== 2)
      throw Error(
        "This version supports algorithm version 2. Older configurations must be reset or recreated explicitly.",
      );
    if (config.scope === "village") {
      if (config.nodeCount !== world.locations.length)
        throw Error(
          `This résumé has ${world.locations.length} houses. Village node count must match the résumé.`,
        );
      parseSequence(config.sequence.join(", "), config.nodeCount);
      if (
        typeof config.layoutSeed !== "string" ||
        typeof config.decorationSeed !== "string" ||
        !config.layoutSeed.trim() ||
        !config.decorationSeed.trim() ||
        config.layoutSeed.length > 128 ||
        config.decorationSeed.length > 128
      )
        throw Error("Seeds must contain 1–128 characters.");
      onVillage(config);
    } else if (config.scope === "interior") {
      const house = world.locations.find((l) => l.id === config.buildingId);
      if (!house)
        throw Error(
          "This configuration refers to a building that is not in this résumé.",
        );
      validateInteriorConfig(config, house);
      generateInterior(resume, house, config);
      onInterior(config);
    } else throw Error("Configuration scope must be village or interior.");
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      apply(configNow());
      setError("");
      setMessage(
        "Configuration applied. Your discoveries and rewards are preserved.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid configuration.");
      setMessage("");
    }
  };
  const reset = () => {
    const defaults = location
      ? defaultInteriorConfig(resume, location)
      : {
          ...villageConfig,
          sequence: (world as World).sequence,
          layoutSeed: "resume-default",
          decorationSeed: "resume-default",
        };
    setNodeCount(defaults.nodeCount);
    setSequence(defaults.sequence.join(", "));
    setLayoutSeed(defaults.layoutSeed);
    setDecorationSeed(defaults.decorationSeed);
    if ("archetype" in defaults) setArchetype(defaults.archetype);
    setError("");
    setMessage("Default values restored in the editor. Apply to regenerate.");
  };
  const exportConfig = () => {
    try {
      const config = configNow();
      if (config.scope === "interior") validateInteriorConfig(config, location);
      downloadJSON(config, "parshwa-world-v2-config.json");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid configuration.");
    }
  };
  const newSequence = () => {
    if (
      !Number.isInteger(nodeCount) ||
      nodeCount < (location ? 2 : 1) ||
      nodeCount > (location ? 10 : world.locations.length)
    ) {
      setError("Choose a valid node count first.");
      return;
    }
    const count = randomCount + 1;
    setRandomCount(count);
    const seed = `${layoutSeed}:shuffle:${count}`;
    const random = seededRandom(hashString(seed));
    const values = location
      ? randomSequence(nodeCount, seed)
      : Array.from(
          { length: Math.max(0, nodeCount - 2) },
          () => 1 + Math.floor(random() * nodeCount),
        );
    setSequence(values.join(", "));
    setError("");
  };
  const importConfig = () => {
    try {
      if (importText.length > 10000) throw Error("Configuration is too large.");
      const config = JSON.parse(importText);
      apply(config);
      setTarget(config.scope === "village" ? "village" : config.buildingId);
      setNodeCount(config.nodeCount);
      setSequence(config.sequence.join(", "));
      setLayoutSeed(config.layoutSeed);
      setDecorationSeed(config.decorationSeed);
      if (config.archetype) setArchetype(config.archetype);
      setError("");
      setMessage(
        "Imported and applied. The exact requested tree is preserved.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not import configuration.",
      );
    }
  };
  return (
    <div className="generation-panel">
      <form onSubmit={submit}>
        <span className="eyebrow">PRÜFER TOPOLOGY + INDEPENDENT SEEDS</span>
        <h2>Make this world yours.</h2>
        <p>
          The code chooses the connections. The layout seed chooses the
          geometry; the decoration seed changes furniture variation. Identical
          settings reproduce the same map.
        </p>
        <label htmlFor="generation-target">Generate</label>
        <select
          id="generation-target"
          value={target}
          onChange={(e) => pick(e.target.value)}
        >
          <option value="village">
            Village · {world.locations.length} houses
          </option>
          {world.locations.map((l) => (
            <option value={l.id} key={l.id}>
              {l.label} · interior
            </option>
          ))}
        </select>
        <div className="generation-fields">
          <div>
            <label htmlFor="node-count">
              {location ? "Room count" : "House count"}
            </label>
            <input
              id="node-count"
              type="number"
              min={location ? 2 : world.locations.length}
              max={location ? 10 : world.locations.length}
              value={nodeCount}
              readOnly={!location}
              onChange={(e) => {
                setNodeCount(Number(e.target.value));
                setError("");
              }}
            />
          </div>
          {location && (
            <div>
              <label htmlFor="archetype">Interior style</label>
              <select
                id="archetype"
                value={archetype}
                onChange={(e) => setArchetype(e.target.value)}
              >
                {["home", "library", "workshop", "studio"].map((a) => (
                  <option value={a} key={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <label htmlFor="sequence">
          Prüfer sequence · {Math.max(0, nodeCount - 2)} values, labels 1–
          {nodeCount}
        </label>
        <input
          id="sequence"
          value={sequence}
          onChange={(e) => {
            setSequence(e.target.value);
            setError("");
          }}
          aria-invalid={Boolean(error)}
          aria-describedby="generation-error"
          autoComplete="off"
        />
        <div className="generator-small-actions">
          <button type="button" onClick={newSequence}>
            Generate valid random code
          </button>
          <button type="button" onClick={reset}>
            Restore defaults
          </button>
        </div>
        <div className="generation-fields">
          <div>
            <label htmlFor="layout-seed">Layout seed</label>
            <input
              id="layout-seed"
              value={layoutSeed}
              maxLength={128}
              onChange={(e) => setLayoutSeed(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="decoration-seed">Decoration seed</label>
            <input
              id="decoration-seed"
              value={decorationSeed}
              maxLength={128}
              onChange={(e) => setDecorationSeed(e.target.value)}
            />
          </div>
        </div>
        {!location && (
          <p className="input-hint">
            Village node count comes from the résumé. Every populated section
            stays represented.
          </p>
        )}
        <p id="generation-error" role="alert" className="form-error">
          {error}
        </p>
        <p className="generation-success" role="status">
          {message}
        </p>
        <div className="code-actions">
          <button type="submit" className="button primary">
            Generate {location ? "interior" : "village"} →
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={exportConfig}
          >
            Download configuration
          </button>
        </div>
      </form>
      {preview && (
        <div className="room-preview">
          <span className="eyebrow">ROOM GRAPH · EXACT REQUESTED TREE</span>
          <svg
            viewBox={`0 0 ${preview.bounds.width} ${preview.bounds.height}`}
            aria-label="Preview of generated room graph"
            role="img"
          >
            {preview.paths.map((p, i) => (
              <polyline
                key={i}
                points={p.points.map((pt) => `${pt.x},${pt.y}`).join(" ")}
              />
            ))}
            {preview.rooms?.map((room) => (
              <g key={room.vertex}>
                <rect
                  x={room.x}
                  y={room.y}
                  width={room.width}
                  height={room.height}
                />
                <text x={room.x + room.width / 2} y={room.y + room.height / 2}>
                  {room.vertex}
                </text>
              </g>
            ))}
          </svg>
          <p>
            {preview.rooms?.map((r) => `${r.vertex}: ${r.label}`).join(" · ")}
          </p>
          <p className="input-hint">
            Private rooms are assigned to leaf nodes. Public circulation,
            doorways and furniture access are validated without changing your
            code.
          </p>
        </div>
      )}
      <details className="config-import">
        <summary>Import a shared configuration</summary>
        <label htmlFor="config-json">Configuration JSON</label>
        <textarea
          id="config-json"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={5}
          maxLength={10000}
          placeholder="Paste exported version 2 configuration here"
        />
        <button
          type="button"
          className="button secondary"
          onClick={importConfig}
        >
          Validate and import
        </button>
      </details>
    </div>
  );
}
