import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Location, Point, World } from '../types';
import { movementVector, movePlayer, nearestLocation } from './physics.mjs';

export type GameHandle = { focus: () => void; teleport: (point: Point) => void };
type Props = { world: World; active: boolean; onInteract: (location: Location) => void; onPause: () => void; onNearby: (location: Location | null) => void };

const Game = forwardRef<GameHandle, Props>(function Game({ world, active, onInteract, onPause, onNearby }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const player = useRef<Point>({ ...world.spawn });
  const keys = useRef(new Set<string>());
  const touch = useRef({ x: 0, y: 0 });
  const latest = useRef({ world, active, onInteract, onPause, onNearby });
  latest.current = { world, active, onInteract, onPause, onNearby };
  const [assetError, setAssetError] = useState(false);
  const [positionText, setPositionText] = useState('At the village entrance');
  const teleport = (point: Point) => { player.current = { ...point }; keys.current.clear(); touch.current = { x: 0, y: 0 }; };
  useImperativeHandle(ref, () => ({ focus: () => canvas.current?.focus(), teleport }), []);
  useEffect(() => { teleport(world.spawn); onNearby(null); }, [world, onNearby]);
  useEffect(() => { if (!active) { keys.current.clear(); touch.current = { x: 0, y: 0 }; } }, [active]);

  useEffect(() => {
    const element = canvas.current!;
    const ctx = element.getContext('2d');
    if (!ctx) { setAssetError(true); return; }
    let disposed = false, frame = 0, previous = 0, width = 0, height = 0, ratio = 1, nearbyId = '';
    let camera = { ...player.current }, step = 0, direction = 1, observedWorld = latest.current.world;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const town = new Image(), dungeon = new Image();
    town.src = `${import.meta.env.BASE_URL}assets/tiny-town.png`;
    dungeon.src = `${import.meta.env.BASE_URL}assets/tiny-dungeon.png`;
    town.onerror = dungeon.onerror = () => { if (!disposed) setAssetError(true); };
    const resize = () => { const rect = element.getBoundingClientRect(); width = rect.width; height = rect.height; ratio = Math.min(window.devicePixelRatio || 1, 2); element.width = Math.round(width * ratio); element.height = Math.round(height * ratio); };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const clear = () => { keys.current.clear(); touch.current = { x: 0, y: 0 }; };
    const interact = () => { const location = nearestLocation(player.current, latest.current.world) as Location | null; if (location) latest.current.onInteract(location); };
    const keydown = (e: KeyboardEvent) => {
      if (!latest.current.active) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'shift', ' ', 'e', 'escape'].includes(k)) e.preventDefault();
      if (e.repeat && ['e', ' ', 'escape'].includes(k)) return;
      if (k === 'e' || k === ' ') interact();
      else if (k === 'escape') latest.current.onPause();
      else keys.current.add(k);
    };
    const keyup = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    element.addEventListener('keydown', keydown); element.addEventListener('keyup', keyup); element.addEventListener('blur', clear);
    window.addEventListener('blur', clear); document.addEventListener('visibilitychange', clear);
    const sprite = (image: HTMLImageElement, index: number, x: number, y: number, w = 16, h = 16) => { if (image.complete && image.naturalWidth) ctx.drawImage(image, index % 12 * 16, Math.floor(index / 12) * 16, 16, 16, Math.round(x), Math.round(y), w, h); };

    const render = (now: number) => {
      if (disposed) return;
      const dt = Math.min((now - (previous || now)) / 1000, 0.05); previous = now;
      const state = latest.current, map = state.world;
      if (map !== observedWorld) { observedWorld = map; nearbyId = ''; camera = { ...player.current }; }
      let moving = false;
      if (state.active) {
        const x = touch.current.x + Number(keys.current.has('d') || keys.current.has('arrowright')) - Number(keys.current.has('a') || keys.current.has('arrowleft'));
        const y = touch.current.y + Number(keys.current.has('s') || keys.current.has('arrowdown')) - Number(keys.current.has('w') || keys.current.has('arrowup'));
        moving = x !== 0 || y !== 0;
        const delta = movementVector(x, y, keys.current.has('shift') ? 125 : 78, dt);
        player.current = movePlayer(player.current, delta, map);
        if (x) direction = x < 0 ? -1 : 1;
        if (moving) step += dt * 9;
        const nearby = nearestLocation(player.current, map) as Location | null;
        if ((nearby?.id || '') !== nearbyId) { nearbyId = nearby?.id || ''; state.onNearby(nearby); setPositionText(nearby ? `Near ${nearby.label}` : 'Exploring the village'); }
      }
      const scale = width < 600 ? 2.3 : 3;
      const halfW = width / scale / 2, halfH = height / scale / 2;
      const targetX = Math.max(halfW, Math.min(map.bounds.width - halfW, player.current.x));
      const targetY = Math.max(halfH, Math.min(map.bounds.height - halfH, player.current.y - 15));
      camera.x += (targetX - camera.x) * (reduced ? 1 : Math.min(1, dt * 10));
      camera.y += (targetY - camera.y) * (reduced ? 1 : Math.min(1, dt * 10));
      const left = Math.round(camera.x - halfW), top = Math.round(camera.y - halfH);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.fillStyle = '#758c5d'; ctx.fillRect(0, 0, width, height);
      ctx.setTransform(ratio * scale, 0, 0, ratio * scale, -left * ratio * scale, -top * ratio * scale); ctx.imageSmoothingEnabled = false;
      for (let y = Math.floor(top / 16) * 16; y < top + height / scale + 16; y += 16) for (let x = Math.floor(left / 16) * 16; x < left + width / scale + 16; x += 16) {
        const h = Math.abs((x * 73856093 ^ y * 19349663) >>> 0);
        sprite(town, h % 31 === 0 ? 2 : h % 9 === 0 ? 1 : 0, x, y);
      }
      // The paths come directly from the decoded tree, with an existing dirt tile texture.
      for (const path of map.paths) {
        ctx.beginPath(); path.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#849254'; ctx.lineWidth = 28; ctx.stroke(); ctx.strokeStyle = '#d6ae75'; ctx.lineWidth = 22; ctx.stroke();
        for (let i = 1; i < path.points.length; i++) { const a = path.points[i - 1], b = path.points[i]; const length = Math.hypot(b.x - a.x, b.y - a.y); for (let d = 0; d <= length; d += 14) { const t = length ? d / length : 0; sprite(town, 25, a.x + (b.x - a.x) * t - 8, a.y + (b.y - a.y) * t - 8); } }
      }
      const visible = (x: number, y: number, w = 100, h = 100) => x + w >= left - 16 && y + h >= top - 16 && x <= left + width / scale + 16 && y <= top + height / scale + 16;
      for (const d of map.decorations) { if (!visible(d.x, d.y, 32, 32)) continue; const variation = Number(d.variant || 0); const index = d.kind === 'tree' ? [4, 5, 3][variation % 3] : d.kind === 'rock' ? 30 : ['flower', 'flowers'].includes(d.kind) ? 2 : [28, 27, 29][variation % 3]; const size = d.kind === 'tree' ? 32 : 16; sprite(town, index, d.x - size / 2, d.y - size / 2, size, size); }
      for (const location of map.locations) {
        if (!visible(location.x, location.y, location.size.width, location.size.height + 30)) continue;
        const cols = Math.max(3, Math.round(location.size.width / 16)), rows = Math.max(3, Math.round(location.size.height / 16));
        const orange = Number(location.variation) % 2 === 1, roof = orange ? 52 : 48, lower = orange ? 64 : 60, middle = Math.floor(cols / 2);
        ctx.fillStyle = '#43544555'; ctx.fillRect(location.x + 5, location.y + 6, location.size.width, location.size.height);
        for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
          let index;
          if (row === 0) index = col === 0 ? roof : col === cols - 1 ? roof + 2 : roof + 1;
          else if (row === 1) index = col === 0 ? lower : col === cols - 1 ? lower + 2 : col === middle ? lower + 3 : lower + 1;
          else if (row === rows - 1) index = col === middle ? 85 : col === 0 ? 72 : col === cols - 1 ? 75 : col % 2 ? 84 : 73;
          else index = col === 0 ? 76 : col === cols - 1 ? 79 : col % 2 ? 88 : 77;
          sprite(town, index, location.x + col * 16, location.y + row * 16);
        }
        // Labels are also available in the semantic journal and fast-travel menu.
        ctx.font = '7px Pixel, monospace'; const label = `${location.vertex} · ${location.label}`; const textWidth = ctx.measureText(label).width;
        const labelX = location.x + location.size.width / 2, labelY = location.y - 13;
        ctx.fillStyle = '#263e30'; ctx.fillRect(labelX - textWidth / 2 - 5, labelY - 7, textWidth + 10, 14); ctx.fillStyle = '#f5eccd'; ctx.textAlign = 'center'; ctx.fillText(label, labelX, labelY + 2);
        sprite(town, 70, location.entrance.x + 20, location.entrance.y - 3);
        if (nearbyId === location.id && state.active) { ctx.fillStyle = '#f2d179'; ctx.fillRect(location.entrance.x - 8, location.entrance.y - 3, 16, 4); }
      }
      const p = player.current, bob = moving && !reduced ? Math.round(Math.sin(step) * 1.5) : 0;
      ctx.fillStyle = '#293c3266'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y - 12 + bob)); ctx.scale(direction, 1); sprite(dungeon, 98, -8, -4); ctx.restore();
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); element.removeEventListener('keydown', keydown); element.removeEventListener('keyup', keyup); element.removeEventListener('blur', clear); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear); town.onerror = dungeon.onerror = null; };
  }, []);

  const hold = (x: number, y: number, e: React.PointerEvent<HTMLButtonElement>) => { if (!active) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); touch.current = { x, y }; };
  const release = () => { touch.current = { x: 0, y: 0 }; };
  return <><canvas ref={canvas} role="img" aria-label={`Playable résumé village. ${positionText}. Use arrows or WASD to move, E or Space to interact, Escape for menu.`} tabIndex={active ? 0 : -1} onPointerDown={() => canvas.current?.focus()} /><span className="sr-only" aria-live="polite">{positionText}</span>{assetError && <div className="asset-error">The artwork couldn’t load. <a href="./portfolio.html">Read the portfolio</a> or open the journal.</div>}<div className={`touch-controls ${active ? '' : 'hidden'}`}><div className="dpad" aria-label="Movement controls">{[{ label: 'Move up', icon: '↑', x: 0, y: -1, name: 'up' }, { label: 'Move left', icon: '←', x: -1, y: 0, name: 'left' }, { label: 'Move down', icon: '↓', x: 0, y: 1, name: 'down' }, { label: 'Move right', icon: '→', x: 1, y: 0, name: 'right' }].map(d => <button key={d.name} className={d.name} aria-label={d.label} onPointerDown={e => hold(d.x, d.y, e)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}> {d.icon} </button>)}</div><button className="touch-interact" aria-label="Interact with nearby house" onClick={() => { const l = nearestLocation(player.current, world) as Location | null; if (l) onInteract(l); }}>E<span>READ</span></button></div></>;
});

export default Game;
