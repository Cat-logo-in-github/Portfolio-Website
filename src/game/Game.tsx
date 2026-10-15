import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { GameObject, GameScene, Point } from '../types';
import { canStand, movementVector, movePlayer, nearestObject } from './physics.mjs';
import { canInteractWith, findWalkPath, objectAtPoint, sceneGeometryChanged } from './navigation.mjs';
import { facingFromMovement } from './animation.mjs';
import { drawInterior, drawObject, drawPlayer, drawVillage } from './render';
import type { SpriteSheets } from './render';

export type GameHandle = { focus: () => void; teleport: (point: Point) => void; getPosition: () => Point };
type Props = { scene: GameScene; active: boolean; unlockedIds: string[]; openedIds: string[]; onInteract: (object: GameObject) => void; onPause: () => void; onNearby: (object: GameObject | null) => void; onPosition?: (point: Point) => void; onTravel?: (distance: number) => void; onStep?: () => void };

const Game = forwardRef<GameHandle, Props>(function Game({ scene, active, unlockedIds, openedIds, onInteract, onPause, onNearby, onPosition, onTravel, onStep }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null), player = useRef<Point>({ ...scene.spawn });
  const keys = useRef(new Set<string>()), touch = useRef({ x: 0, y: 0 });
  const route = useRef<Point[]>([]), routeTarget = useRef<string | null>(null), interactUntil = useRef(0);
  const view = useRef({ left: 0, top: 0, scale: 3 }), geometry = useRef(scene);
  const latest = useRef({ scene, active, unlockedIds, openedIds, onInteract, onPause, onNearby, onPosition, onTravel, onStep });
  latest.current = { scene, active, unlockedIds, openedIds, onInteract, onPause, onNearby, onPosition, onTravel, onStep };
  const [assetError, setAssetError] = useState(false), [positionText, setPositionText] = useState(`Exploring ${scene.label}`), [nearbyObject, setNearbyObject] = useState<GameObject | null>(null);
  const focus = () => { if (latest.current.active && !document.querySelector('[role="dialog"][aria-modal="true"]')) canvas.current?.focus({ preventScroll: true }); };
  const teleport = (point: Point) => {
    const map = latest.current.scene; player.current = canStand(point, map) ? { ...point } : { ...map.spawn };
    keys.current.clear(); touch.current = { x: 0, y: 0 }; route.current = []; routeTarget.current = null;
  };
  const activate = (object: GameObject) => {
    if (!latest.current.active || !canInteractWith(player.current, object, latest.current.scene)) return;
    latest.current.onPosition?.({ ...player.current }); keys.current.clear(); touch.current = { x: 0, y: 0 }; route.current = []; routeTarget.current = null;
    interactUntil.current = performance.now() + 300; latest.current.onInteract(object);
  };
  useImperativeHandle(ref, () => ({ focus, teleport, getPosition: () => ({ ...player.current }) }), []);
  useEffect(() => {
    if (sceneGeometryChanged(geometry.current, scene) || !canStand(player.current, scene)) {
      teleport(scene.spawn); latest.current.onNearby(null); setNearbyObject(null); setPositionText(`Exploring ${scene.label}`);
    }
    geometry.current = scene;
  }, [scene]);
  useEffect(() => {
    if (!active) { keys.current.clear(); touch.current = { x: 0, y: 0 }; route.current = []; routeTarget.current = null; }
    else focus();
  }, [active]);

  useEffect(() => {
    const element = canvas.current!, ctx = element.getContext('2d');
    if (!ctx) { setAssetError(true); return; }
    let disposed = false, frame = 0, previous = 0, width = 0, height = 0, ratio = 1, nearbyId = '', positionSent = 0, stepDistance = 0;
    let camera = { ...player.current }, facing = 'down', observedScene = latest.current.scene, wasMoving = false, animationState = 'idle', animationSince = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const town = new Image(), dungeon = new Image(), interior = new Image(), playerSheet = new Image(), npc = new Image();
    const sheets: SpriteSheets = { town, dungeon, interior, player: playerSheet, npc };
    town.src = `${import.meta.env.BASE_URL}assets/tiny-town.png`; dungeon.src = `${import.meta.env.BASE_URL}assets/tiny-dungeon.png`; interior.src = `${import.meta.env.BASE_URL}assets/roguelike-indoors.png`;
    playerSheet.src = `${import.meta.env.BASE_URL}assets/explorer-actions.png`; npc.src = `${import.meta.env.BASE_URL}assets/villager-actions.png`;
    town.onerror = dungeon.onerror = () => { if (!disposed) setAssetError(true); };
    const resize = () => { const rect = element.getBoundingClientRect(); width = rect.width; height = rect.height; ratio = Math.min(window.devicePixelRatio || 1, 2); element.width = Math.round(width * ratio); element.height = Math.round(height * ratio); };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const clear = () => { keys.current.clear(); touch.current = { x: 0, y: 0 }; wasMoving = false; route.current = []; routeTarget.current = null; };
    const persist = () => { if (latest.current.active) latest.current.onPosition?.({ ...player.current }); };
    const blur = () => { persist(); clear(); };
    const keydown = (event: KeyboardEvent) => {
      if (!latest.current.active || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const key = event.key.toLowerCase(), interaction = ['e', ' ', 'enter'].includes(key);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'shift', ' ', 'enter', 'e', 'escape'].includes(key)) event.preventDefault();
      if (event.repeat && (interaction || key === 'escape')) return;
      if (interaction) { const object = nearestObject(player.current, latest.current.scene) as GameObject | null; if (object) activate(object); }
      else if (key === 'escape') { persist(); clear(); latest.current.onPause(); }
      else { keys.current.add(key); if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) { route.current = []; routeTarget.current = null; } }
    };
    const keyup = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    element.addEventListener('keydown', keydown); element.addEventListener('keyup', keyup); element.addEventListener('blur', blur); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', blur);
    const render = (now: number) => {
      if (disposed) return;
      const dt = Math.min((now - (previous || now)) / 1000, 0.05); previous = now;
      const state = latest.current, map = state.scene;
      if (map !== observedScene) { if (sceneGeometryChanged(observedScene, map)) { camera = { ...player.current }; wasMoving = false; } observedScene = map; nearbyId = ''; }
      let moving = false, running = false;
      if (state.active) {
        let x = touch.current.x + Number(keys.current.has('d') || keys.current.has('arrowright')) - Number(keys.current.has('a') || keys.current.has('arrowleft'));
        let y = touch.current.y + Number(keys.current.has('s') || keys.current.has('arrowdown')) - Number(keys.current.has('w') || keys.current.has('arrowup'));
        if (x || y) { route.current = []; routeTarget.current = null; }
        while (route.current.length && Math.hypot(route.current[0].x - player.current.x, route.current[0].y - player.current.y) < 0.5) route.current.shift();
        const waypoint = !x && !y ? route.current[0] : undefined;
        if (waypoint) { x = waypoint.x - player.current.x; y = waypoint.y - player.current.y; }
        running = keys.current.has('shift'); const speed = running ? 125 : 78;
        const delta = movementVector(x, y, waypoint ? Math.min(speed, Math.hypot(x, y) / Math.max(dt, 0.001)) : speed, dt), before = player.current;
        player.current = movePlayer(before, delta, map);
        const traveled = Math.hypot(player.current.x - before.x, player.current.y - before.y); moving = traveled > 0.01;
        if (x || y) facing = facingFromMovement(x, y, facing);
        if (moving) {
          state.onTravel?.(traveled); stepDistance += traveled;
          if (stepDistance >= 14) { stepDistance %= 14; state.onStep?.(); }
        } else if (waypoint && dt > 0) { route.current = []; routeTarget.current = null; setPositionText('That route is blocked. Try a closer floor tile or use the arrows.'); }
        const nearby = nearestObject(player.current, map) as GameObject | null;
        if ((nearby?.id || '') !== nearbyId) { nearbyId = nearby?.id || ''; state.onNearby(nearby); setNearbyObject(nearby); setPositionText(nearby ? `Near ${nearby.label}. Press E, Enter or Space to interact.` : `Exploring ${map.label}`); }
        if (!route.current.length && routeTarget.current) { const target = map.objects.find(object => object.id === routeTarget.current); routeTarget.current = null; if (target && canInteractWith(player.current, target, map)) activate(target); }
        if ((moving && now - positionSent > 500) || (!moving && wasMoving)) { positionSent = now; state.onPosition?.({ ...player.current }); }
        wasMoving = moving;
      } else wasMoving = false;
      const nextAnimation = now < interactUntil.current ? 'interact' : moving ? running ? 'run' : 'walk' : 'idle';
      if (nextAnimation !== animationState) { animationState = nextAnimation; animationSince = now; }
      const scale = width < 600 ? 2.5 : 3, halfW = width / scale / 2, halfH = height / scale / 2;
      const targetX = map.bounds.width < halfW * 2 ? map.bounds.width / 2 : Math.max(halfW, Math.min(map.bounds.width - halfW, player.current.x));
      const targetY = map.bounds.height < halfH * 2 ? map.bounds.height / 2 : Math.max(halfH, Math.min(map.bounds.height - halfH, player.current.y - 15));
      camera.x += (targetX - camera.x) * (reduced ? 1 : Math.min(1, dt * 10)); camera.y += (targetY - camera.y) * (reduced ? 1 : Math.min(1, dt * 10));
      const left = Math.round(camera.x - halfW), top = Math.round(camera.y - halfH), viewport = { left, top, width: width / scale, height: height / scale }; view.current = { left, top, scale };
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.fillStyle = map.kind === 'interior' ? '#202b31' : '#758c5d'; ctx.fillRect(0, 0, width, height);
      ctx.setTransform(ratio * scale, 0, 0, ratio * scale, -left * ratio * scale, -top * ratio * scale); ctx.imageSmoothingEnabled = false;
      if (map.kind === 'interior') drawInterior(ctx, map, sheets, viewport); else drawVillage(ctx, map, sheets, viewport);
      if (route.current.length) { const destination = route.current.at(-1)!; ctx.strokeStyle = '#fff1b0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(destination.x, destination.y, 5, 3, 0, 0, Math.PI * 2); ctx.stroke(); }
      const actors = map.objects.map(object => ({ depth: object.y + object.height, object })); let playerDrawn = false;
      for (const actor of actors.sort((a, b) => a.depth - b.depth || a.object.id.localeCompare(b.object.id))) {
        if (!playerDrawn && actor.depth > player.current.y) { drawPlayer(ctx, sheets, player.current, facing, animationState, now - animationSince, reduced); playerDrawn = true; }
        drawObject(ctx, actor.object, sheets, nearbyId, state.unlockedIds, state.openedIds, viewport, now, reduced);
      }
      if (!playerDrawn) drawPlayer(ctx, sheets, player.current, facing, animationState, now - animationSince, reduced);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); element.removeEventListener('keydown', keydown); element.removeEventListener('keyup', keyup); element.removeEventListener('blur', blur); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', blur); town.onerror = dungeon.onerror = null; };
  }, []);

  const hold = (x: number, y: number, event: React.PointerEvent<HTMLButtonElement>) => { if (!active) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); route.current = []; routeTarget.current = null; touch.current = { x, y }; };
  const release = () => { touch.current = { x: 0, y: 0 }; };
  const pointAt = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active || event.button > 0 || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
    focus(); const rect = event.currentTarget.getBoundingClientRect(), currentView = view.current;
    const point = { x: currentView.left + (event.clientX - rect.left) / currentView.scale, y: currentView.top + (event.clientY - rect.top) / currentView.scale }, map = latest.current.scene;
    const target = objectAtPoint(point, map) as GameObject | null;
    if (target && canInteractWith(player.current, target, map)) { activate(target); return; }
    const path = findWalkPath(player.current, target?.interactAt || point, map) as Point[] | null;
    route.current = path || []; routeTarget.current = path && target ? target.id : null;
    setPositionText(path ? target ? `Walking to ${target.label}` : 'Following the marked route' : 'No clear route. Tap a closer floor tile or use WASD / arrows.');
  };
  return <><canvas ref={canvas} role="img" aria-label={`Playable mystery RPG. ${positionText}. WASD or arrows move. E, Enter or Space interact. Click a floor tile to walk or an object to inspect. Escape opens the menu.`} tabIndex={active ? 0 : -1} onPointerDown={pointAt} /><span className="sr-only" aria-live="polite">{positionText}</span>{assetError && <div className="asset-error">The sprites couldn’t load. <a href="./portfolio.html">Read the portfolio</a> or open the journal.</div>}<div className={`touch-controls ${active ? '' : 'hidden'}`}><div className="dpad" aria-label="Movement controls">{[{ label: 'Move up', icon: '↑', x: 0, y: -1, name: 'up' }, { label: 'Move left', icon: '←', x: -1, y: 0, name: 'left' }, { label: 'Move down', icon: '↓', x: 0, y: 1, name: 'down' }, { label: 'Move right', icon: '→', x: 1, y: 0, name: 'right' }].map(d => <button type="button" key={d.name} className={d.name} aria-label={d.label} onPointerDown={event => hold(d.x, d.y, event)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>{d.icon}</button>)}</div><button type="button" className="touch-interact" disabled={!nearbyObject} aria-label={nearbyObject ? `Interact with ${nearbyObject.label}` : 'Approach an object to interact'} onClick={() => { const object = nearestObject(player.current, latest.current.scene) as GameObject | null; if (object) activate(object); }}><span className="touch-action-icon" aria-hidden="true">◇</span><span>{nearbyObject?.type === 'door' ? 'ENTER' : 'READ'}</span></button></div></>;
});
export default Game;
