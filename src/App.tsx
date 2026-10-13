import { useCallback, useEffect, useRef, useState } from 'react';
import { generateWorld, parseSequence } from './core/world.mjs';
import Game, { type GameHandle } from './game/Game';
import Modal from './components/Modal';
import { LocationContent } from './components/Content';
import type { Resume, World, Location } from './types';

type Panel = 'journal' | 'map' | 'code' | 'pause' | null;

export default function App() {
  const [resume, setResume] = useState<Resume | null>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [loadError, setLoadError] = useState('');
  const [started, setStarted] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<string>('');
  const [nearby, setNearby] = useState<Location | null>(null);
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [sequence, setSequence] = useState('');
  const [codeError, setCodeError] = useState('');
  const [custom, setCustom] = useState(false);
  const game = useRef<GameHandle>(null);
  const defaults = useRef<World | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all(['resume', 'world'].map(name => fetch(`./generated/${name}.json`, { signal: controller.signal }).then(r => { if (!r.ok) throw Error(`Could not load ${name}.`); return r.json(); }))).then(([r, w]) => { setResume(r); setWorld(w); defaults.current = w; setSequence(w.sequence.join(', ')); setSelected(w.locations[0]?.id || ''); }).catch(e => { if (e.name !== 'AbortError') setLoadError(e.message); });
    return () => controller.abort();
  }, []);
  const closePanel = useCallback(() => { setPanel(null); }, []);
  const showLocation = useCallback((location: Location) => { setSelected(location.id); setVisited(v => new Set(v).add(location.id)); setPanel('journal'); }, []);
  const pause = useCallback(() => setPanel('pause'), []);
  const start = () => { setStarted(true); closePanel(); requestAnimationFrame(() => game.current?.focus()); };
  const travel = (location: Location) => { setStarted(true); closePanel(); game.current?.teleport(location.entrance); requestAnimationFrame(() => game.current?.focus()); };

  if (loadError) return <main className="error-page"><h1>The village couldn’t load.</h1><p>{loadError}</p><a href="./portfolio.html">Read the portfolio</a> <a href="./resume.pdf" download>Download résumé</a></main>;
  if (!resume || !world) return <main className="boot"><div className="boot-sprite" /><p>Gathering the field notes…</p><a href="./portfolio.html">Open the reading version</a></main>;
  const current = world.locations.find(l => l.id === selected) || world.locations[0];
  const openJournal = () => { setSelected(current.id); setPanel('journal'); };
  const regenerate = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = parseSequence(sequence, world.locations.length);
      const next = generateWorld(resume, parsed) as World;
      setWorld(next); setSequence(next.sequence.join(', ')); setCodeError(''); setCustom(true); setNearby(null); setStarted(true); closePanel(); requestAnimationFrame(() => game.current?.focus());
    } catch (e) { setCodeError(e instanceof Error ? e.message : 'Please enter a valid sequence.'); }
  };
  const restore = () => { if (defaults.current) { setWorld(defaults.current); setSequence(defaults.current.sequence.join(', ')); setCodeError(''); setCustom(false); setNearby(null); } };

  return <main className="app-shell">
    <header className="masthead"><a className="identity" href="#" onClick={e => { e.preventDefault(); setStarted(false); closePanel(); }}><span className="identity-sprite" aria-hidden="true" /><span><strong>{resume.name}</strong><small>A WORLD OF WORK</small></span></a><nav aria-label="Portfolio navigation"><button onClick={openJournal}>Journal</button><button onClick={() => setPanel('map')}>Village map</button><button className="code-nav" onClick={() => setPanel('code')}>World code</button><a className="resume-link" href="./resume.pdf" download>Résumé <span aria-hidden="true">↓</span></a></nav></header>
    <section className="world-stage" aria-label="Explorable résumé village">
      <Game ref={game} world={world} active={started && panel === null} onInteract={showLocation} onPause={pause} onNearby={setNearby} />
      {!started && <div className="title-screen"><div className="title-card"><span className="eyebrow">AN EXPLORABLE PORTFOLIO</span><h1>{resume.name.split(' ')[0]}<br />{resume.name.split(' ').slice(1).join(' ')}</h1><p>{resume.title}</p><div className="title-actions"><button className="button primary" onClick={start}>Enter the village <span aria-hidden="true">→</span></button><button className="reading-link" onClick={openJournal}>Just here to read? Open the journal ↗</button></div><div className="title-note"><span className="tiny-star" aria-hidden="true">✦</span> Every house holds a part of my story.</div></div><div className="title-caption"><span>{world.locations.length} destinations</span><span>One résumé. A living landscape.</span></div></div>}
      {started && <><div className="game-topline"><div><span className="eyebrow">{custom ? 'YOUR CUSTOM VILLAGE' : 'THE RÉSUMÉ VILLAGE'}</span><span className="journey-count">{visited.size} / {world.locations.length} field notes discovered</span></div><button className="menu-button" onClick={pause} aria-label="Pause and open menu">Ⅱ <span>Menu</span></button></div><aside className="mini-map" aria-label="Miniature village map"><svg viewBox={`0 0 ${world.bounds.width} ${world.bounds.height}`} aria-hidden="true">{world.paths.map((p, i) => <polyline key={i} points={p.points.map(pt => `${pt.x},${pt.y}`).join(' ')} />)}{world.locations.map(l => <rect key={l.id} x={l.x} y={l.y} width={l.size.width} height={l.size.height} className={visited.has(l.id) ? 'visited' : ''} />)}</svg><button onClick={() => setPanel('map')}>Open village map ↗</button></aside><div className={`interaction-prompt ${nearby ? 'visible' : ''}`} aria-live="polite">{nearby && <><span>{nearby.label}</span><button onClick={() => showLocation(nearby)}><kbd>E</kbd> Read field notes</button></>}</div></>}
    </section>
    <footer className="footer-bar"><div><kbd>WASD</kbd><span> / </span><kbd>↑↓←→</kbd> <span>to wander</span><span className="footer-separator">·</span><kbd>E</kbd><span> to read</span><span className="footer-separator">·</span><kbd>ESC</kbd><span> menu</span></div><button onClick={() => setPanel('code')}>A world grown from a Prüfer code <span aria-hidden="true">↗</span></button></footer>
    {panel && <Modal title={panel === 'journal' ? 'The field journal' : panel === 'map' ? 'Your village map' : panel === 'code' ? 'Grow a different world' : 'Take a breather'} onClose={closePanel} wide={panel === 'journal' || panel === 'map'}>
      {panel === 'journal' && <div className="journal"><nav className="journal-nav" aria-label="Résumé sections"><div className="journal-owner"><strong>{resume.name}</strong><span>{world.locations.length} field notes</span></div>{world.locations.map(l => <button key={l.id} aria-current={l.id === current.id ? 'page' : undefined} onClick={() => { setSelected(l.id); setVisited(v => new Set(v).add(l.id)); }}><span>{String(l.vertex).padStart(2, '0')}</span>{l.label}<small aria-label={visited.has(l.id) ? 'Read' : 'Unread'}>{visited.has(l.id) ? '✓' : ''}</small></button>)}<a className="journal-download" href="./resume.pdf" download>Original résumé ↓</a></nav><div className="journal-body"><LocationContent resume={resume} location={current} /><div className="journal-bottom"><p>Transcribed from the original résumé.</p><button onClick={() => travel(current)}>Visit this house →</button></div></div></div>}
      {panel === 'map' && <div className="map-panel"><div className="map-heading"><h2>A place for every chapter.</h2><p>Select a house to travel there, or open its field notes below.</p></div><svg className="overview" viewBox={`0 0 ${world.bounds.width} ${world.bounds.height}`} role="img" aria-label="Tree of houses connected by paths">{world.paths.map((p, i) => <polyline key={i} points={p.points.map(pt => `${pt.x},${pt.y}`).join(' ')} />)}{world.locations.map(l => <g key={l.id} role="button" tabIndex={0} aria-label={`Travel to ${l.label}`} onClick={() => travel(l)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); travel(l); } }}><rect x={l.x - 12} y={l.y - 12} width={l.size.width + 24} height={l.size.height + 24} rx="8" /><text x={l.x + l.size.width / 2} y={l.y + l.size.height / 2 + 9}>{l.vertex}</text></g>)}</svg><div className="map-destinations">{world.locations.map(l => <div key={l.id}><span className="map-number">{l.vertex}</span><button onClick={() => showLocation(l)}>{l.label}</button><button className="travel-link" onClick={() => travel(l)} aria-label={`Travel to ${l.label}`}>Travel →</button></div>)}</div></div>}
      {panel === 'code' && <form className="code-panel" onSubmit={regenerate}><span className="eyebrow">THE MATHEMATICS UNDER THE MEADOW</span><h2>Same story.<br />New paths.</h2><p>A Prüfer code is a compact way to describe a labeled tree. Each house is a vertex; the decoded tree determines the roads and the village layout.</p><div className="code-facts"><span><strong>{world.locations.length}</strong> houses</span><span><strong>{Math.max(0, world.locations.length - 2)}</strong> values</span><span><strong>1–{world.locations.length}</strong> valid labels</span></div><label htmlFor="sequence">Prüfer sequence</label><input id="sequence" value={sequence} onChange={e => { setSequence(e.target.value); setCodeError(''); }} aria-invalid={Boolean(codeError)} aria-describedby="sequence-hint sequence-error" autoComplete="off" /><p id="sequence-hint" className="input-hint">Enter {Math.max(0, world.locations.length - 2)} whole numbers from 1 to {world.locations.length}, separated by commas or spaces. Repeated labels are allowed.</p><p id="sequence-error" className="form-error" role="alert">{codeError}</p><div className="code-actions"><button className="button primary" type="submit">Generate world →</button><button className="button secondary" type="button" onClick={restore}>Restore default world</button></div><details><summary>Which house is which number?</summary><ol>{world.locations.map(l => <li key={l.id}>{l.label}</li>)}</ol></details><p className="muted">Current map: {custom ? 'visitor-created code' : 'deterministic résumé default'}. Your résumé content stays the same.</p></form>}
      {panel === 'pause' && <div className="pause-panel"><span className="eyebrow">YOU’RE ON VILLAGE TIME</span><h2>Take the scenic route.</h2><button className="button primary" onClick={start}>Continue exploring →</button><button className="button secondary" onClick={openJournal}>Read the journal</button><button className="button secondary" onClick={() => setPanel('map')}>Open map / fast travel</button><button className="button secondary" onClick={() => setPanel('code')}>Change world code</button><button className="reading-link" onClick={() => { setStarted(false); restore(); closePanel(); }}>Return to the title screen</button></div>}
    </Modal>}
  </main>;
}
