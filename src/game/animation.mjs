const WALK = {
  down: [[0, 0], [1, 0], [0, 0], [2, 0]], up: [[0, 1], [1, 1], [0, 1], [2, 1]],
  left: [[3, 0], [4, 0], [3, 0], [5, 0]], right: [[3, 1], [4, 1], [3, 1], [5, 1]],
};
const IDLE = { down: [[0, 0]], up: [[0, 1]], left: [[3, 0]], right: [[3, 1]] };
const HOLD = { down: [[0, 2], [1, 2], [2, 2]], up: [[0, 3], [1, 3], [2, 3]], left: [[3, 2], [4, 2]], right: [[3, 3], [4, 3]] };
export const CHARACTER_ANIMATIONS = {
  idle: { fps: 1, loop: true, frames: IDLE },
  walk: { fps: 8, loop: true, frames: WALK },
  // Running uses the authored directional gait at a faster cadence, rather than inventing frames.
  run: { fps: 13, loop: true, frames: WALK },
  interact: { fps: 7, loop: false, frames: HOLD },
  attack: { fps: 10, loop: false, frames: { down: [[0, 6], [1, 6]], up: [[0, 7], [1, 7]], left: [[2, 6], [3, 6]], right: [[2, 7], [3, 7]] } },
  guard: { fps: 5, loop: true, frames: { down: [[4, 6], [5, 6]], up: [[4, 7], [5, 7]], left: [[6, 6], [7, 6]], right: [[6, 7], [7, 7]] } },
  hurt: { fps: 8, loop: false, frames: { down: [[5, 3], [6, 3]], up: [[5, 3], [6, 3]], left: [[5, 3], [6, 3]], right: [[5, 3], [6, 3]] } },
  victory: { fps: 6, loop: true, frames: HOLD },
  defeat: { fps: 7, loop: false, frames: { down: [[6, 3], [7, 3], [8, 3], [9, 3]], up: [[6, 3], [7, 3], [8, 3], [9, 3]], left: [[6, 3], [7, 3], [8, 3], [9, 3]], right: [[6, 3], [7, 3], [8, 3], [9, 3]] } },
};

/** Authored frames are distinct in four directions; animation never changes collision. */
export function characterFrame(state = 'idle', facing = 'down', elapsedMs = 0, reducedMotion = false) {
  const animation = CHARACTER_ANIMATIONS[state] || CHARACTER_ANIMATIONS.idle;
  const frames = animation.frames[facing] || animation.frames.down;
  const clock = Math.floor(Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0) * animation.fps / 1000);
  const index = reducedMotion ? 0 : animation.loop ? clock % frames.length : Math.min(frames.length - 1, clock);
  const [column, row] = frames[index];
  return { x: column * 17, y: row * 17, width: 16, height: 16 };
}

export function facingFromMovement(x, y, previous = 'down') {
  if (!x && !y) return previous;
  return Math.abs(y) >= Math.abs(x) ? y < 0 ? 'up' : 'down' : x < 0 ? 'left' : 'right';
}

/** The separate villager sheet contains an actual blink and arm/working frames. */
export function npcFrame(id, elapsedMs, nearby = false, reducedMotion = false) {
  let phase = 0; for (const char of String(id)) phase = (phase * 31 + char.charCodeAt(0)) >>> 0;
  const time = Math.max(0, elapsedMs) + phase % 4000;
  const blink = !reducedMotion && time % 4200 > 3970;
  if (String(id).includes('mentor')) return { x: 2 * 16, y: (reducedMotion ? 0 : Math.floor(time / 650) % 4) * 16, width: 16, height: 16 };
  if (nearby) return { x: 0, y: blink ? 48 : 0, width: 16, height: 16 };
  return { x: 0, y: blink ? 48 : 0, width: 16, height: 16 };
}
