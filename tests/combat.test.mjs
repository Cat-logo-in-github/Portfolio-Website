import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, battleAction, reachableMoves, canAttack, hasLineOfSight, enemyTurn, finishBattle } from '../src/core/combat.mjs';
import { createProgress, saveProgress, loadProgress } from '../src/core/progress.mjs';

const act = (state, type, extra = {}) => battleAction(state, { type, ...extra });
const adjacentBattle = (type = 'guard') => { const state = createBattle('practice', type); state.player.x = 4; state.player.y = 3; state.grid.blocked = []; return state; };
function assertLegal(state) {
  for (const actor of [state.player, state.enemy]) {
    assert.ok(actor.x >= 0 && actor.y >= 0 && actor.x < 7 && actor.y < 7);
    assert.ok(!state.grid.blocked.some(point => point.x === actor.x && point.y === actor.y));
  }
  assert.ok(state.player.x !== state.enemy.x || state.player.y !== state.enemy.y);
  assert.ok(state.player.hp >= 0 && state.enemy.hp >= 0);
}

test('battle configuration is deterministic, bounded and has distinct short opponents', () => {
  for (const type of ['guard', 'skirmisher', 'ranger']) for (let seed = 0; seed < 40; seed++) {
    const state = createBattle(seed, type);
    assert.deepEqual(state, createBattle(seed, type)); assertLegal(state);
    assert.equal(state.player.hp, 10); assert.ok(state.enemy.hp >= 6 && state.enemy.hp <= 9);
    assert.equal(state.grid.width, 7); assert.equal(state.player.focus, 2);
  }
  assert.throws(() => createBattle(1, 'unknown'), /guard, skirmisher, or ranger/);
});

test('movement uses legal BFS paths with obstacles, range and opponent collision', () => {
  const state = createBattle(10); state.grid.blocked = [{ x: 2, y: 3 }];
  const before = structuredClone(state);
  const moves = reachableMoves(state);
  assert.ok(!moves.some(point => point.x === 3 && point.y === 3), 'Two-step direct move cannot tunnel through an obstacle.');
  assert.ok(moves.some(point => point.x === 1 && point.y === 1));
  for (const point of moves) assert.ok(Math.abs(point.x - state.player.x) + Math.abs(point.y - state.player.y) <= 2);
  const invalid = act(state, 'move', { x: 5, y: 3 }); assert.equal(invalid.state, state); assert.ok(invalid.error);
  const valid = act(state, 'move', moves[0]); assert.equal(valid.error, undefined); assert.equal(valid.state.moved, true);
  assert.ok(act(valid.state, 'move', moves[1]).error);
  assert.deepEqual(state, before, 'Prior state remains unchanged.');
});

test('one action and one move are allowed, with an explicit End turn', () => {
  const state = adjacentBattle(); const first = act(state, 'attack');
  assert.equal(first.state.enemy.hp, 6); assert.equal(first.state.acted, true);
  assert.equal(first.state.turn, 'player'); assert.equal(first.state.round, 1);
  assert.ok(act(first.state, 'attack').error);
  const moved = act(first.state, 'move', reachableMoves(first.state)[0]); assert.equal(moved.error, undefined);
  const end = act(moved.state, 'end');
  assert.equal(end.state.round, 2); assert.equal(end.state.turn, 'player');
  assert.equal(end.state.moved, false); assert.equal(end.state.acted, false);
});

test('basic range and ranged focus honor charges and blocking line of sight', () => {
  let state = createBattle(1); assert.equal(canAttack(state), false);
  assert.ok(act(state, 'attack').error);
  state.player.x = 2; state.player.y = 3; state.grid.blocked = [];
  assert.equal(canAttack(state, 'focus'), true);
  state.grid.blocked = [{ x: 3, y: 3 }]; assert.equal(hasLineOfSight(state), false); assert.equal(canAttack(state, 'focus'), false);
  assert.ok(act(state, 'focus').error); assert.equal(state.player.focus, 2);
  state.grid.blocked = [];
  let first = act(state, 'focus').state; assert.equal(first.player.focus, 1); assert.equal(first.enemy.hp, 7);
  first = act(first, 'end').state; first.player.x = 2; first.player.y = 3;
  let second = act(first, 'focus').state; assert.equal(second.player.focus, 0);
  second = act(second, 'end').state; second.player.x = 2; second.player.y = 3;
  assert.match(act(second, 'focus').error, /charges/);
});

test('guard reduces damage for one enemy turn and then expires', () => {
  const unguarded = enemyTurn(adjacentBattle()); assert.equal(unguarded.player.hp, 7);
  const guarded = act(act(adjacentBattle(), 'guard').state, 'end').state;
  assert.equal(guarded.player.hp, 9); assert.equal(guarded.player.guard, false);
  assert.equal(enemyTurn(guarded).player.hp, 6);
});

test('AI has distinct guard, skirmisher and ranger positioning and safe fallback', () => {
  const guard = enemyTurn(createBattle(4, 'guard')); assert.deepEqual([guard.enemy.x, guard.enemy.y], [5, 3]);
  const skirmisher = enemyTurn(createBattle(4, 'skirmisher')); assert.ok(skirmisher.enemy.x < 5);
  const ranger = enemyTurn(adjacentBattle('ranger')); assert.ok(Math.abs(ranger.player.x - ranger.enemy.x) + Math.abs(ranger.player.y - ranger.enemy.y) >= 2);
  const trapped = createBattle(4, 'skirmisher'); trapped.grid.blocked = [{ x: 5, y: 2 }, { x: 4, y: 3 }, { x: 6, y: 3 }, { x: 5, y: 4 }];
  const fallback = enemyTurn(trapped); assert.equal(fallback.round, 2); assert.deepEqual([fallback.enemy.x, fallback.enemy.y], [5, 3]);
  assert.match(fallback.log.at(-1), /No legal attack/);
  for (const state of [guard, skirmisher, ranger, fallback]) assertLegal(state);
});

test('victory, defeat, simultaneous exhaustion and retreat are safe terminal states', () => {
  let state = adjacentBattle(); state.enemy.hp = 3;
  const victory = act(state, 'attack').state; assert.equal(victory.status, 'victory'); assert.equal(victory.enemy.hp, 0);
  assert.ok(act(victory, 'attack').error);
  state = adjacentBattle(); state.player.hp = 2;
  const defeat = act(state, 'end').state; assert.equal(defeat.status, 'defeat'); assert.equal(defeat.player.hp, 0);
  state = adjacentBattle(); state.player.hp = 0; state.enemy.hp = 0;
  assert.equal(act(state, 'end').state.status, 'defeat');
  const retreat = act(createBattle(1), 'retreat').state; assert.equal(retreat.status, 'retreated'); assert.equal(retreat.player.hp, 10);
});

test('victory rewards persist and cannot be farmed by replaying or rerolling opponents', () => {
  const resume = { sourceHash: 'resume', sections: [] }; let progress = createProgress(resume);
  progress.items['field-key'] = 1;
  for (const seed of [1, 1, 2, 3]) {
    const battle = adjacentBattle(); battle.id = `different-seed-${seed}`; battle.enemy.hp = 3;
    progress = finishBattle(progress, act(battle, 'attack').state);
  }
  assert.equal(progress.stats.battlesWon, 1); assert.equal(progress.items['sparring-badge'], 1);
  assert.equal(progress.items['field-key'], 1); assert.equal(progress.quests.sparring, 'complete');
  const restored = loadProgress(saveProgress(progress), resume).state;
  assert.deepEqual(restored, progress);
  assert.equal(finishBattle(progress, act(createBattle(1), 'retreat').state), progress);
});

test('invalid states/actions report errors without altering persistent exploration', () => {
  const valid = createBattle(1); const before = structuredClone(valid);
  assert.ok(act(valid, 'unknown').error); assert.deepEqual(valid, before);
  for (const invalid of [null, {}, { ...valid, version: 9 }, { ...valid, player: { ...valid.player, x: valid.enemy.x, y: valid.enemy.y } }, { ...valid, grid: { ...valid.grid, blocked: [{ x: -1, y: 2 }] } }, { ...valid, grid: { ...valid.grid, blocked: [null] } }]) {
    assert.ok(act(invalid, 'end').error); assert.deepEqual(reachableMoves(invalid), []); assert.equal(canAttack(invalid), false);
  }
});

test('many deterministic practice turns preserve valid geometry and bounded logs', () => {
  for (const type of ['guard', 'skirmisher', 'ranger']) for (let seed = 0; seed < 15; seed++) {
    let state = createBattle(seed, type);
    for (let turn = 0; turn < 10 && state.status === 'active'; turn++) {
      const moves = reachableMoves(state);
      if (moves.length) state = act(state, 'move', moves[seed % moves.length]).state;
      state = act(state, canAttack(state) ? 'attack' : canAttack(state, 'focus') ? 'focus' : 'guard').state;
      if (state.status === 'active') state = act(state, 'end').state;
      assertLegal(state); assert.ok(state.log.length <= 24);
    }
  }
});
