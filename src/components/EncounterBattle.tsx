import { useEffect, useRef, useState } from 'react';
import { duelAction } from '../core/duel.mjs';
import { characterFrame } from '../game/animation.mjs';
import { characterTexture } from '../game/character-texture.mjs';

function ExplorerSprite({ pose }: { pose: string }) {
  const [time, setTime] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => { setTime(0); if (reduced) return; const started = performance.now(); const timer = setInterval(() => setTime(performance.now() - started), 75); return () => clearInterval(timer); }, [reduced, pose]);
  useEffect(() => { const asset = new Image(); asset.onload = () => { image.current = asset; setLoaded(true); }; asset.src = `${import.meta.env.BASE_URL}assets/explorer-actions.png`; return () => { asset.onload = null; }; }, []);
  const frame = characterFrame(pose, 'right', time, reduced);
  useEffect(() => { const ctx = canvas.current?.getContext('2d'); if (!ctx || !loaded || !image.current) return; ctx.clearRect(0, 0, 96, 96); ctx.imageSmoothingEnabled = false; ctx.drawImage(characterTexture(image.current), frame.x, frame.y, 16, 16, 0, 0, 96, 96); }, [frame.x, frame.y, loaded]);
  return <canvas ref={canvas} width={96} height={96} className="duel-explorer-art" />;
}

const sprites: Record<string, number> = { guard: 87, guardian: 87, skirmisher: 86, ranger: 99, signal: 84, mimic: 89 };

export default function EncounterBattle({ battle, onChange, onFinish }: { battle: any; onChange: (state: any) => void; onFinish: () => void }) {
  const [error, setError] = useState('');
  const [reaction, setReaction] = useState('reveal');
  const [pose, setPose] = useState('idle');
  const previous = useRef(battle);
  useEffect(() => {
    const old = previous.current; previous.current = battle;
    if (old === battle) return;
    const event = battle.status === 'victory' ? 'victory' : battle.status === 'defeat' ? 'defeat' : battle.lastEvent;
    setReaction(`${event}${battle.enemy.hp < old.enemy.hp ? ' enemy-hit' : ''}${battle.player.hp < old.player.hp ? ' player-hit' : ''}`);
    setPose(event === 'victory' ? 'victory' : event === 'defeat' ? 'defeat' : event === 'guard' ? 'guard' : battle.player.hp < old.player.hp ? 'hurt' : ['attack', 'special'].includes(event) ? 'attack' : 'interact');
    if (['victory', 'defeat'].includes(event)) return;
    const timer = setTimeout(() => { setReaction(''); setPose('idle'); }, 260);
    return () => clearTimeout(timer);
  }, [battle]);
  const action = (type: string) => { const result = duelAction(battle, { type }); setError(result.error || ''); if (!result.error) onChange(result.state); };
  const index = sprites[battle.enemy.type] ?? 84;
  const active = battle.status === 'active';
  const health = (actor: any, enemy = false) => <div className={`duel-health ${enemy ? 'enemy-health' : 'player-health'}`}><strong>{actor.name}</strong><div className="duel-health-track" role="progressbar" aria-label={`${actor.name} health`} aria-valuemin={0} aria-valuemax={actor.maxHp} aria-valuenow={actor.hp}><span style={{ width: `${actor.hp / actor.maxHp * 100}%` }} /></div><small>{actor.hp} / {actor.maxHp} HP{!enemy && ` · ${actor.specialCharges} technique · ${actor.potions} tonic`}</small></div>;
  return <section className={`encounter-battle ${battle.boss ? 'boss-duel' : ''}`} aria-label={battle.boss ? 'Mystery boss encounter' : 'Route encounter'}><div className="duel-caption"><span className="eyebrow">{battle.boss ? 'THE QUIET INDEXER' : 'A STRANGE ENCOUNTER'}</span><span>ROUND {battle.round}</span></div><div className={`duel-stage ${reaction}`}><div className="duel-moon" aria-hidden="true" />{health(battle.enemy, true)}<div className={`duel-enemy duel-type-${battle.enemy.type}`} aria-hidden="true"><span style={{ backgroundImage: `url(${import.meta.env.BASE_URL}assets/tiny-dungeon.png)`, backgroundPosition: `${-(index % 12) * 96}px ${-Math.floor(index / 12) * 96}px` }} /></div><div className="duel-player" aria-hidden="true"><ExplorerSprite pose={pose} /></div>{health(battle.player)}<div className="duel-player-platform" aria-hidden="true" /><div className="duel-enemy-platform" aria-hidden="true" />{reaction.includes('special') && <span className="duel-pulse" aria-hidden="true" />}</div><div className="duel-intent"><strong>Next response</strong><span>{battle.enemy.intent}</span></div>{battle.analyzed && <div className="duel-pattern" aria-label="Analyzed enemy pattern">{battle.enemy.pattern.map((step: string, i: number) => <span key={`${step}-${i}`} aria-current={i === battle.enemy.patternIndex % battle.enemy.pattern.length ? 'step' : undefined}>{step}</span>)}</div>}<div className="duel-message" role="log" aria-live="polite">{battle.log.slice(-3).map((line: string, i: number) => <p key={`${battle.round}-${i}`}>{line}</p>)}</div>{active ? <div className="duel-commands"><button onClick={() => action('attack')}><strong>Attack</strong><small>4 damage · expose bonus</small></button><button onClick={() => action('guard')}><strong>Guard</strong><small>Block 5 this response</small></button><button onClick={() => action('analyze')}><strong>Analyze</strong><small>Read pattern · find opening</small></button><button disabled={!battle.player.specialCharges} onClick={() => action('special')}><strong>{battle.knowledge.length ? 'Learned technique' : 'Focused strike'}</strong><small>{battle.player.specialCharges} charges · interrupt</small></button><button disabled={!battle.player.potions || battle.player.hp === battle.player.maxHp} onClick={() => action('item')}><strong>Practice tonic</strong><small>Restore 9 HP · one use</small></button><button onClick={() => action('escape')}><strong>Escape</strong><small>Always safe · no losses</small></button></div> : <div className="duel-outcome"><h2>{battle.status === 'victory' ? battle.boss ? 'The missing page returns.' : 'The pattern is broken!' : battle.status === 'defeat' ? 'A margin for another attempt.' : 'A sensible tactical footnote.'}</h2><p>{battle.status === 'victory' ? 'Return to the world to continue your expedition.' : 'You recover fully. Your discoveries and exploration items remain safe.'}</p><button className="button primary" onClick={onFinish}>Return to exploring →</button></div>}{error && <p className="form-error" role="alert">{error}</p>}<p className="duel-footnote">Commands resolve one response at a time. Retreat is always available. Animation never locks your controls.</p></section>;
}
