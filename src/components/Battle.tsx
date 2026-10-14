import { battleAction, reachableMoves, canAttack } from "../core/combat.mjs";
import type { BattleState } from "../types";

const opponentInfo = {
  guard: {
    name: "The Guard",
    description: "Holds position and punishes close approaches.",
    sprite: 87,
  },
  skirmisher: {
    name: "The Skirmisher",
    description: "Moves quickly to find an opening.",
    sprite: 86,
  },
  ranger: {
    name: "The Ranger",
    description: "Keeps distance and needs a clear line of sight.",
    sprite: 99,
  },
};

export function BattleIntro({ onStart }: { onStart: (type: string) => void }) {
  return (
    <div className="battle-intro">
      <span className="eyebrow">OPTIONAL · FRIENDLY SPARRING</span>
      <h2>A little tactical thinking.</h2>
      <p>
        Choose a partner. Move up to two squares, take one action, then end your
        turn. Attack nearby, use Focus at range, or Guard against the next hit.
      </p>
      <p className="muted">
        Defeat and retreat cost nothing. Battles never block your résumé
        discoveries. Rewards are earned once per partner.
      </p>
      <div className="opponent-list">
        {Object.entries(opponentInfo).map(([id, info]) => (
          <button key={id} onClick={() => onStart(id)}>
            <strong>{info.name}</strong>
            <span>{info.description}</span>
            <small>Start friendly match →</small>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Battle({
  battle,
  onChange,
  onFinish,
  error,
  setError,
}: {
  battle: BattleState;
  onChange: (battle: BattleState) => void;
  onFinish: () => void;
  error: string;
  setError: (error: string) => void;
}) {
  const moves = reachableMoves(battle) as { x: number; y: number }[];
  const legal = new Set(moves.map((p) => `${p.x},${p.y}`));
  const blocked = new Set(battle.grid.blocked.map((p) => `${p.x},${p.y}`));
  const action = (type: string, x?: number, y?: number) => {
    const result = battleAction(battle, {
      type,
      ...(x === undefined ? {} : { x, y }),
    });
    setError(result.error || "");
    onChange(result.state as BattleState);
  };
  const active = battle.status === "active";
  return (
    <div className="battle-panel">
      <div className="battle-status">
        <div>
          <span className="eyebrow">YOU</span>
          <strong>
            {battle.player.hp} / {battle.player.maxHp} HP
          </strong>
          <span>
            {battle.player.focus} Focus ·{" "}
            {battle.player.guard ? "Guard raised" : "Ready"}
          </span>
        </div>
        <div className="round-counter">ROUND {battle.round}</div>
        <div>
          <span className="eyebrow">{battle.enemy.type.toUpperCase()}</span>
          <strong>
            {battle.enemy.hp} / {battle.enemy.maxHp} HP
          </strong>
          <span>{battle.enemy.intent || "Watching your next move"}</span>
        </div>
      </div>
      <div
        className="battle-grid"
        style={{ gridTemplateColumns: `repeat(${battle.grid.width}, 1fr)` }}
        role="group"
        aria-label="Tactical arena. Select a highlighted square to move."
      >
        {Array.from(
          { length: battle.grid.width * battle.grid.height },
          (_, i) => {
            const x = i % battle.grid.width,
              y = Math.floor(i / battle.grid.width),
              key = `${x},${y}`;
            const player = battle.player.x === x && battle.player.y === y,
              enemy = battle.enemy.x === x && battle.enemy.y === y;
            return (
              <button
                key={key}
                className={`battle-tile ${blocked.has(key) ? "blocked" : ""} ${legal.has(key) && active && !battle.moved ? "legal" : ""} ${player ? "player" : ""} ${enemy ? "enemy" : ""}`}
                disabled={!active || (!legal.has(key) && !enemy)}
                aria-label={
                  player
                    ? `Your position, column ${x + 1}, row ${y + 1}`
                    : enemy
                      ? `Opponent at column ${x + 1}, row ${y + 1}; attack if adjacent`
                      : blocked.has(key)
                        ? "Obstacle"
                        : `Move to column ${x + 1}, row ${y + 1}`
                }
                onClick={() =>
                  enemy ? action("attack") : action("move", x, y)
                }
              >
                {player ? (
                  <span className="battle-sprite explorer" />
                ) : enemy ? (
                  <span className={`battle-sprite ${battle.enemy.type}`} />
                ) : blocked.has(key) ? (
                  <span className="battle-obstacle" />
                ) : (
                  <span aria-hidden="true">
                    {legal.has(key) && active && !battle.moved ? "·" : ""}
                  </span>
                )}
              </button>
            );
          },
        )}
      </div>
      {active ? (
        <>
          <p className="battle-instructions">
            {battle.moved ? "Movement used." : "Move once, up to two squares."}{" "}
            {battle.acted
              ? "Action used; end your turn."
              : "Choose one action, then end turn."}
          </p>
          <div className="battle-actions">
            <button
              className="button secondary"
              disabled={battle.acted || !canAttack(battle)}
              onClick={() => action("attack")}
            >
              Attack · 3 damage
            </button>
            <button
              className="button secondary"
              disabled={battle.acted}
              onClick={() => action("guard")}
            >
              Guard · block 2
            </button>
            <button
              className="button secondary"
              disabled={battle.acted || !canAttack(battle, "focus")}
              onClick={() => action("focus")}
            >
              Focus · range 3
            </button>
            <button className="button primary" onClick={() => action("end")}>
              End turn →
            </button>
            <button className="reading-link" onClick={() => action("retreat")}>
              Retreat safely
            </button>
          </div>
        </>
      ) : (
        <div className="battle-result">
          <h2>
            {battle.status === "victory"
              ? "Well played!"
              : battle.status === "defeat"
                ? "A lesson for the next round."
                : "Back to the village."}
          </h2>
          <p>
            {battle.status === "victory"
              ? "Your friendly sparring achievement is saved."
              : "Your discoveries and items are safe. There is no penalty."}
          </p>
          <button className="button primary" onClick={onFinish}>
            Return to exploring →
          </button>
        </div>
      )}
      <p className="form-error" role="alert">
        {error}
      </p>
      <ol className="battle-log" aria-live="polite">
        {battle.log.slice(-4).map((line, i) => (
          <li key={`${battle.round}-${i}`}>{line}</li>
        ))}
      </ol>
    </div>
  );
}
