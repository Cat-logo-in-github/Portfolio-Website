import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { GameObject, GameScene, Point } from "../types";
import {
  canStand,
  movementVector,
  movePlayer,
  nearestObject,
} from "./physics.mjs";
import { drawInterior, drawObject, drawPlayer, drawVillage } from "./render";
import type { SpriteSheets } from "./render";

export type GameHandle = {
  focus: () => void;
  teleport: (point: Point) => void;
  getPosition: () => Point;
};
type Props = {
  scene: GameScene;
  active: boolean;
  unlockedIds: string[];
  openedIds: string[];
  onInteract: (object: GameObject) => void;
  onPause: () => void;
  onNearby: (object: GameObject | null) => void;
  onPosition?: (point: Point) => void;
};

const Game = forwardRef<GameHandle, Props>(function Game(
  {
    scene,
    active,
    unlockedIds,
    openedIds,
    onInteract,
    onPause,
    onNearby,
    onPosition,
  },
  ref,
) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const player = useRef<Point>({ ...scene.spawn });
  const keys = useRef(new Set<string>());
  const touch = useRef({ x: 0, y: 0 });
  const latest = useRef({
    scene,
    active,
    unlockedIds,
    openedIds,
    onInteract,
    onPause,
    onNearby,
    onPosition,
  });
  latest.current = {
    scene,
    active,
    unlockedIds,
    openedIds,
    onInteract,
    onPause,
    onNearby,
    onPosition,
  };
  const [assetError, setAssetError] = useState(false);
  const [positionText, setPositionText] = useState(`Exploring ${scene.label}`);
  const [nearbyObject, setNearbyObject] = useState<GameObject | null>(null);
  const teleport = (point: Point) => {
    const map = latest.current.scene;
    player.current = canStand(point, map) ? { ...point } : { ...map.spawn };
    keys.current.clear();
    touch.current = { x: 0, y: 0 };
  };
  useImperativeHandle(
    ref,
    () => ({
      focus: () => canvas.current?.focus(),
      teleport,
      getPosition: () => ({ ...player.current }),
    }),
    [],
  );
  useEffect(() => {
    teleport(scene.spawn);
    latest.current.onNearby(null);
    setNearbyObject(null);
    setPositionText(`Exploring ${scene.label}`);
  }, [scene]);
  useEffect(() => {
    if (!active) {
      keys.current.clear();
      touch.current = { x: 0, y: 0 };
    } else canvas.current?.focus({ preventScroll: true });
  }, [active]);

  useEffect(() => {
    const element = canvas.current!;
    const ctx = element.getContext("2d");
    if (!ctx) {
      setAssetError(true);
      return;
    }
    let disposed = false,
      frame = 0,
      previous = 0,
      width = 0,
      height = 0,
      ratio = 1,
      nearbyId = "",
      positionSent = 0;
    let camera = { ...player.current },
      step = 0,
      direction = 1,
      observedScene = latest.current.scene,
      wasMoving = false;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const town = new Image(),
      dungeon = new Image(),
      interior = new Image();
    const sheets: SpriteSheets = { town, dungeon, interior };
    town.src = `${import.meta.env.BASE_URL}assets/tiny-town.png`;
    dungeon.src = `${import.meta.env.BASE_URL}assets/tiny-dungeon.png`;
    interior.src = `${import.meta.env.BASE_URL}assets/roguelike-indoors.png`;
    town.onerror = dungeon.onerror = () => {
      if (!disposed) setAssetError(true);
    };
    const resize = () => {
      const rect = element.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    const clear = () => {
      keys.current.clear();
      touch.current = { x: 0, y: 0 };
      wasMoving = false;
    };
    const persistPosition = () => {
      if (latest.current.active)
        latest.current.onPosition?.({ ...player.current });
    };
    const blur = () => {
      persistPosition();
      clear();
    };
    const interact = () => {
      if (!latest.current.active) return;
      const object = nearestObject(
        player.current,
        latest.current.scene,
      ) as GameObject | null;
      if (object) {
        persistPosition();
        clear();
        latest.current.onInteract(object);
      }
    };
    const keydown = (event: KeyboardEvent) => {
      if (!latest.current.active) return;
      const key = event.key.toLowerCase();
      if (
        [
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          "w",
          "a",
          "s",
          "d",
          "shift",
          " ",
          "e",
          "escape",
        ].includes(key)
      )
        event.preventDefault();
      if (event.repeat && ["e", " ", "escape"].includes(key)) return;
      if (key === "e" || key === " ") interact();
      else if (key === "escape") {
        persistPosition();
        clear();
        latest.current.onPause();
      } else keys.current.add(key);
    };
    const keyup = (event: KeyboardEvent) =>
      keys.current.delete(event.key.toLowerCase());
    element.addEventListener("keydown", keydown);
    element.addEventListener("keyup", keyup);
    element.addEventListener("blur", blur);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", blur);

    const render = (now: number) => {
      if (disposed) return;
      const dt = Math.min((now - (previous || now)) / 1000, 0.05);
      previous = now;
      const state = latest.current,
        map = state.scene;
      if (map !== observedScene) {
        observedScene = map;
        nearbyId = "";
        camera = { ...player.current };
        wasMoving = false;
      }
      let moving = false;
      if (state.active) {
        const x =
          touch.current.x +
          Number(keys.current.has("d") || keys.current.has("arrowright")) -
          Number(keys.current.has("a") || keys.current.has("arrowleft"));
        const y =
          touch.current.y +
          Number(keys.current.has("s") || keys.current.has("arrowdown")) -
          Number(keys.current.has("w") || keys.current.has("arrowup"));
        const delta = movementVector(
            x,
            y,
            keys.current.has("shift") ? 125 : 78,
            dt,
          ),
          before = player.current;
        player.current = movePlayer(before, delta, map);
        moving =
          Math.abs(before.x - player.current.x) +
            Math.abs(before.y - player.current.y) >
          0.01;
        if (x) direction = x < 0 ? -1 : 1;
        if (moving) step += dt * 9;
        const nearby = nearestObject(player.current, map) as GameObject | null;
        if ((nearby?.id || "") !== nearbyId) {
          nearbyId = nearby?.id || "";
          state.onNearby(nearby);
          setNearbyObject(nearby);
          setPositionText(
            nearby
              ? `Near ${nearby.label}. Press E to ${nearby.actions[0]?.label.toLowerCase() || "interact"}.`
              : `Exploring ${map.label}`,
          );
        }
        if ((moving && now - positionSent > 500) || (!moving && wasMoving)) {
          positionSent = now;
          state.onPosition?.({ ...player.current });
        }
        wasMoving = moving;
      } else wasMoving = false;
      const scale = width < 600 ? 2.5 : 3;
      const halfW = width / scale / 2,
        halfH = height / scale / 2;
      const targetX =
        map.bounds.width < halfW * 2
          ? map.bounds.width / 2
          : Math.max(
              halfW,
              Math.min(map.bounds.width - halfW, player.current.x),
            );
      const targetY =
        map.bounds.height < halfH * 2
          ? map.bounds.height / 2
          : Math.max(
              halfH,
              Math.min(map.bounds.height - halfH, player.current.y - 15),
            );
      camera.x += (targetX - camera.x) * (reduced ? 1 : Math.min(1, dt * 10));
      camera.y += (targetY - camera.y) * (reduced ? 1 : Math.min(1, dt * 10));
      const left = Math.round(camera.x - halfW),
        top = Math.round(camera.y - halfH),
        view = { left, top, width: width / scale, height: height / scale };
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = map.kind === "interior" ? "#202b31" : "#758c5d";
      ctx.fillRect(0, 0, width, height);
      ctx.setTransform(
        ratio * scale,
        0,
        0,
        ratio * scale,
        -left * ratio * scale,
        -top * ratio * scale,
      );
      ctx.imageSmoothingEnabled = false;
      if (map.kind === "interior") drawInterior(ctx, map, sheets, view);
      else drawVillage(ctx, map, sheets, view);
      const bob = moving && !reduced ? Math.round(Math.sin(step) * 1.5) : 0;
      const actors = map.objects.map((object) => ({
        depth: object.y + object.height,
        object,
      }));
      let playerDrawn = false;
      for (const actor of actors.sort(
        (a, b) => a.depth - b.depth || a.object.id.localeCompare(b.object.id),
      )) {
        if (!playerDrawn && actor.depth > player.current.y) {
          drawPlayer(ctx, sheets, player.current, direction, bob);
          playerDrawn = true;
        }
        drawObject(
          ctx,
          actor.object,
          sheets,
          nearbyId,
          state.unlockedIds,
          state.openedIds,
          view,
        );
      }
      if (!playerDrawn) drawPlayer(ctx, sheets, player.current, direction, bob);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      element.removeEventListener("keydown", keydown);
      element.removeEventListener("keyup", keyup);
      element.removeEventListener("blur", blur);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", blur);
      town.onerror = dungeon.onerror = null;
    };
  }, []);

  const hold = (
    x: number,
    y: number,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (!active) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    touch.current = { x, y };
  };
  const release = () => {
    touch.current = { x: 0, y: 0 };
  };
  const interactNearby = () => {
    const object = nearestObject(
      player.current,
      latest.current.scene,
    ) as GameObject | null;
    if (active && object) {
      onPosition?.({ ...player.current });
      onInteract(object);
    }
  };
  return (
    <>
      <canvas
        ref={canvas}
        role="img"
        aria-label={`Playable résumé RPG. ${positionText}. Use arrows or WASD to move, E or Space to interact, Escape for menu.`}
        tabIndex={active ? 0 : -1}
        onPointerDown={() => canvas.current?.focus()}
      />
      <span className="sr-only" aria-live="polite">
        {positionText}
      </span>
      {assetError && (
        <div className="asset-error">
          The sprites couldn’t load.{" "}
          <a href="./portfolio.html">Read the portfolio</a> or open the journal.
        </div>
      )}
      <div className={`touch-controls ${active ? "" : "hidden"}`}>
        <div className="dpad" aria-label="Movement controls">
          {[
            { label: "Move up", icon: "↑", x: 0, y: -1, name: "up" },
            { label: "Move left", icon: "←", x: -1, y: 0, name: "left" },
            { label: "Move down", icon: "↓", x: 0, y: 1, name: "down" },
            { label: "Move right", icon: "→", x: 1, y: 0, name: "right" },
          ].map((d) => (
            <button
              key={d.name}
              className={d.name}
              aria-label={d.label}
              onPointerDown={(event) => hold(d.x, d.y, event)}
              onPointerUp={release}
              onPointerCancel={release}
              onLostPointerCapture={release}
            >
              {d.icon}
            </button>
          ))}
        </div>
        <button
          className="touch-interact"
          disabled={!nearbyObject}
          aria-label={
            nearbyObject
              ? `Interact with ${nearbyObject.label}`
              : "Approach an object to interact"
          }
          onClick={interactNearby}
        >
          E
          <span>
            {nearbyObject?.actions[0]?.label.split(" ")[0]?.toUpperCase() ||
              "USE"}
          </span>
        </button>
      </div>
    </>
  );
});

export default Game;
