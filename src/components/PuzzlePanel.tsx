import { useEffect, useState } from 'react';
import { caesar, vigenere, hammingSyndrome, hammingPayload } from '../core/mystery.mjs';
import { bridgeStatus } from '../core/bridge.mjs';
import BridgeBoard from './BridgeBoard';
import './v4-puzzles.css';

type Props = { puzzle: any; state: any; onSubmit: (submission: any) => { correct: boolean; message: string; [key: string]: any }; onClose: () => void };
const sameEdge = (a: any, b: any) => [a.from, a.to].sort().join('-') === [b.from, b.to].sort().join('-');
const GOALS: Record<string, string> = { caesar: 'Turn the wheel to recover the printer’s message.', vigenere: 'Use the repeating key to read the hidden afterword.', hamming: 'Find and flip the one damaged bit.', prufer: 'Rebuild the map, one smallest-leaf connection at a time.', graph: 'Connect the islands, then trace the shortest route to the archive.', logic: 'Toggle four switches to match both target lamps.' };

export default function PuzzlePanel({ puzzle, state, onSubmit, onClose }: Props) {
  const [shift, setShift] = useState(0), [key, setKey] = useState('');
  const [bits, setBits] = useState<number[]>(puzzle.data.received || []);
  const [inputs, setInputs] = useState<number[]>(puzzle.data.inputs || [0, 0, 0, 0]);
  const [edges, setEdges] = useState<{ from: number; to: number }[]>([]), [leaf, setLeaf] = useState<number | null>(null);
  const [repair, setRepair] = useState(''), [route, setRoute] = useState<number[]>([]), [coverage, setCoverage] = useState<number[]>([]);
  const [hintCount, setHintCount] = useState(0), [guided, setGuided] = useState(false), [feedback, setFeedback] = useState({ correct: false, message: '' });
  const [proof, setProof] = useState<any>(null);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  useEffect(() => { setShift(0); setKey(''); setBits(puzzle.data.received || []); setInputs(puzzle.data.inputs || [0, 0, 0, 0]); setEdges([]); setLeaf(null); setRepair(''); setRoute([]); setCoverage([]); setHintCount(0); setProof(null); setHoveredNode(null); setFeedback({ correct: false, message: '' }); }, [puzzle.id]);
  const missing = (puzzle.prerequisites || []).filter((id: string) => !state.solved.includes(id));
  const solved = state.solved.includes(puzzle.id);
  const step = puzzle.type === 'prufer' ? puzzle.data.steps[edges.length] : null;
  const word = bits.length === 7 ? bits : puzzle.data.received || [];
  let preview = '';
  if (puzzle.type === 'caesar') preview = caesar(puzzle.data.ciphertext, -shift);
  if (puzzle.type === 'vigenere' && /[a-z]/i.test(key)) preview = vigenere(puzzle.data.ciphertext, key, true);
  const installed = puzzle.type === 'graph' ? puzzle.data.candidates.find((item: any) => item.id === repair) : null;
  const network = puzzle.type === 'graph' ? [...puzzle.data.edges, ...(installed ? [installed] : [])] : [];
  const bridge = puzzle.type === 'graph' ? bridgeStatus(puzzle.data, repair, route) : null;
  let learning = '';
  // A successful full submission, rather than an individual guided step, reveals
  // the explanation. Revisited clues use their saved, validated solution.
  if (proof || solved) {
    const solution = proof || puzzle.answer;
    if (puzzle.type === 'caesar') {
      const amount = ((solution.shift % 26) + 26) % 26;
      learning = `You reversed a +${amount} shift by subtracting ${amount} modulo 26: wrap around the alphabet, with A=0. “${puzzle.data.ciphertext}” becomes “${caesar(puzzle.data.ciphertext, -amount)}”. Caesar has only 26 possible shifts, so trying every shift is enough to break it.`;
    } else if (puzzle.type === 'hamming') {
      const repaired = solution.bits, syndrome = hammingSyndrome(puzzle.data.received);
      learning = `The received word’s failed even-parity checks produced syndrome ${syndrome}, locating bit ${syndrome} under the promised single-error condition. Your repaired word ${repaired.join('')} passes all three checks. Reading data positions 3, 5, 6 and 7 recovers ${hammingPayload(repaired).join('')}. Zero syndrome alone cannot certify arbitrary multi-bit damage; Hamming(7,4) cannot safely correct double errors.`;
    } else if (puzzle.type === 'prufer') {
      const vertex = puzzle.data.sequence[0], frequency = puzzle.data.sequence.filter((value: number) => value === vertex).length;
      learning = `Label ${vertex} appears ${frequency} ${frequency === 1 ? 'time' : 'times'} in [${puzzle.data.sequence.join(', ')}], so its initial degree is 1 + ${frequency} = ${frequency + 1}. Removing the smallest available leaf at each step, then joining the last two leaves, produced ${solution.edges.length} edges for ${puzzle.data.nodeCount} vertices: exactly n − 1. The code determines a labeled tree’s connections; a separate layout chooses its coordinates.`;
    } else if (puzzle.type === 'graph') {
      const link = puzzle.data.candidates.find((candidate: any) => candidate.id === solution.repairId);
      learning = `Link ${link.from}–${link.to} joined the two islands so all ${puzzle.data.nodes.length} stations became reachable. It is a bridge: removing it disconnects them again. Your route ${solution.route.join(' → ')} uses ${solution.route.length - 1} hops, the shortest route in this unweighted network. Connectivity asks whether a route exists; shortest-path reasoning asks how few links it needs.`;
    } else if (puzzle.type === 'logic') {
      const valid = Array.from({ length: 16 }, (_, value) => value.toString(2).padStart(4, '0').split('').map(Number)).filter(([a, b, c, d]) => (a ^ b) === puzzle.data.targets.xor && (c & d) === puzzle.data.targets.and);
      const alternative = valid.find((values) => values.some((value, index) => value !== solution.inputs[index]))!;
      learning = `Your A,B,C,D = ${solution.inputs.join(',')} gives XOR=${puzzle.data.targets.xor} and AND=${puzzle.data.targets.and}. Another working setting is ${alternative.join(',')}; ${valid.length} settings satisfy these targets. XOR tests whether A and B differ, while AND requires both C and D to be 1. Different inputs can therefore produce equivalent outputs.`;
    } else if (puzzle.type === 'vigenere') {
      const repeatedKey = solution.key.toUpperCase();
      learning = `You repeated key ${repeatedKey}, subtracting shifts ${repeatedKey.split('').map((letter: string) => letter.charCodeAt(0) - 65).join(', ')} modulo 26 while skipping spaces. The result is “${vigenere(puzzle.data.ciphertext, repeatedKey, true)}”. Reusing a periodic key leaves patterns that can be analyzed by key position: Vigenère is an instructive historical cipher, not modern secure encryption.`;
    }
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const submission = puzzle.type === 'caesar' ? { shift } : puzzle.type === 'vigenere' ? { key } : puzzle.type === 'hamming' ? { bits: word } : puzzle.type === 'prufer' ? { edges } : puzzle.type === 'graph' ? { repairId: repair, route } : { inputs };
    const result = onSubmit(submission);
    setFeedback(result);
    if (result.correct) setProof(submission);
  };
  const connect = (vertex: number) => {
    if (!step || step.degrees[vertex - 1] === 0) return;
    if (leaf === null) { setLeaf(vertex); return; }
    if (leaf === step.leaf && vertex === step.target) { setEdges([...edges, { from: leaf, to: vertex }]); setLeaf(null); setFeedback({ correct: true, message: step.final ? 'The final leaves are connected. Submit the restored tree.' : `Connected ${leaf}–${vertex}. Leaf ${leaf} is removed; inspect the new degrees.` }); }
    else { setLeaf(null); setFeedback({ correct: false, message: step.final ? `The final leaves are ${step.leaf} and ${step.target}. Select ${step.leaf} first.` : `Use the smallest current leaf, then the first remaining sequence value. ${leaf}–${vertex} is not the next decoder edge.` }); }
  };
  const trace = (vertex: number) => {
    if (route.includes(vertex)) return;
    if (!repair) { setFeedback({ correct: false, message: 'Install a proposed link before tracing the route.' }); return; }
    if (!route.length && vertex !== puzzle.data.start) { setFeedback({ correct: false, message: `Begin at START, station ${puzzle.data.start}.` }); return; }
    if (route.length && !network.some((edge: any) => sameEdge(edge, { from: route.at(-1), to: vertex }))) { setFeedback({ correct: false, message: 'That station is not joined to your current station. Follow a visible link.' }); return; }
    if (!route.includes(vertex)) setRoute([...route, vertex]);
  };

  return <form className={`puzzle-panel puzzle-${puzzle.type}`} onSubmit={submit}>
    <div className="puzzle-heading"><span className="eyebrow">THE MISSING ROOM · {puzzle.optional ? "OPTIONAL DEVICE" : "STORY DEVICE"}</span><h2>{puzzle.title}</h2><p className="puzzle-goal">{GOALS[puzzle.type]}</p></div>
    {solved && <p className="puzzle-status success" role="status">Solved · replay any time</p>}
    {missing.length > 0 && <p className="puzzle-status" role="status">An earlier clue is missing. The journal shows where to find it.</p>}
    <details className="puzzle-help" onToggle={event => setGuided(event.currentTarget.open)}><summary>How to play</summary><p>{puzzle.instructions}</p><p className="muted">Fictional story devices; the full portfolio remains accessible. Hints and retries are free.</p></details>

    {(puzzle.type === 'caesar' || puzzle.type === 'vigenere') && <section className="cipher-device" aria-label="Classical cipher decoder"><div className="cipher-note"><span>ENCODED MARGIN</span><code>{puzzle.data.ciphertext}</code></div>{puzzle.type === 'caesar' ? <><p>The printer’s calibration mark: <strong>{puzzle.data.knownPair.join(' → ')}</strong>.</p><div className="cipher-wheel"><button type="button" aria-label="Decrease Caesar decoding shift" onClick={() => setShift((shift + 25) % 26)}>−</button><label>Decode backward by <input type="number" min="0" max="25" value={shift} onChange={event => setShift(Math.max(0, Math.min(25, Number(event.target.value) || 0)))} aria-label="Caesar shift" /> letters</label><button type="button" aria-label="Increase Caesar decoding shift" onClick={() => setShift((shift + 1) % 26)}>+</button></div>{guided && <p className="input-hint">A=0 through Z=25. Reverse the printer shift; wrap A back to Z. The calibration pair gives a complete, fair clue.</p>}</> : <><label htmlFor="vigenere-key">Repeating key</label><input id="vigenere-key" value={key} onChange={event => setKey(event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 20))} autoComplete="off" placeholder="Letters only" /><p className="input-hint">The margin names key <strong>{puzzle.data.keyClue}</strong>. Spaces do not advance its letters.</p></>}<div className="cipher-preview" aria-live="polite"><span>DECODED PREVIEW</span><code>{preview || 'Enter the key to listen to the margin.'}</code></div><p className="muted">Classical ciphers teach substitution; they are unsuitable for modern security.</p></section>}

    {puzzle.type === 'hamming' && <section className="hamming-device" aria-label="Hamming seven four parity console"><p>Received: <code>{puzzle.data.received.join(' ')}</code>. Exactly one light was damaged.</p><div className="hamming-bits">{word.map((bit: number, index: number) => <button type="button" key={index} className={`${[1, 2, 4].includes(index + 1) ? 'parity-bit' : 'data-bit'} ${coverage.includes(index + 1) ? 'covered' : ''}`} aria-label={`Position ${index + 1}, ${[1, 2, 4].includes(index + 1) ? 'parity' : 'data'} bit, value ${bit}. Toggle bit.`} aria-pressed={Boolean(bit)} onClick={() => setBits(word.map((value: number, i: number) => i === index ? value ^ 1 : value))}><small>{index + 1}</small><strong>{bit}</strong><span>{[1, 2, 4].includes(index + 1) ? `p${index + 1}` : 'data'}</span></button>)}</div><fieldset className="parity-checks"><legend>Inspect even-parity coverage</legend>{puzzle.data.coverage.map((positions: number[], index: number) => { const failed = positions.reduce((sum, position) => sum ^ word[position - 1], 0); return <button type="button" key={index} onClick={() => setCoverage(positions)} aria-pressed={coverage === positions}>p{[1, 2, 4][index]}: {positions.join(', ')} — {failed ? 'ODD / failed' : 'EVEN / passes'}</button>; })}</fieldset><p className="syndrome" aria-live="polite">Current syndrome: <strong>{word.length === 7 ? hammingSyndrome(word) : '—'}</strong>{guided && ' = sum of the failed parity-position numbers.'}</p>{guided && <p>A nonzero syndrome locates the damaged position only under the promised single-error condition. Flip that bit and check all three groups.</p>}<button type="button" onClick={() => { setBits([...puzzle.data.received]); setCoverage([]); }}>Reset received word</button><p className="input-hint">{puzzle.data.limitation}</p></section>}

    {puzzle.type === 'prufer' && <section className="prufer-device" aria-label="Interactive smallest-leaf tree decoder"><p>Original code: <code>[{puzzle.data.sequence.join(', ')}]</code></p><p>Remaining: <code>[{step?.remaining.join(', ') || ''}]</code> · {step ? step.final ? 'Final two leaves' : `Step ${edges.length + 1} of ${puzzle.data.steps.length}` : 'Tree complete'}</p><svg className="puzzle-graph" viewBox="0 0 300 220" role="img" aria-label={`${edges.length} edges reconstructed from the Prüfer sequence`}>{edges.map((edge, i) => { const point = (vertex: number) => ({ x: 150 + Math.cos((vertex - 1) * Math.PI * 2 / puzzle.data.nodeCount - Math.PI / 2) * 82, y: 110 + Math.sin((vertex - 1) * Math.PI * 2 / puzzle.data.nodeCount - Math.PI / 2) * 82 }); const a = point(edge.from), b = point(edge.to); return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="restored-edge" />; })}{puzzle.data.labels.map((node: any) => { const x = 150 + Math.cos((node.vertex - 1) * Math.PI * 2 / puzzle.data.nodeCount - Math.PI / 2) * 82, y = 110 + Math.sin((node.vertex - 1) * Math.PI * 2 / puzzle.data.nodeCount - Math.PI / 2) * 82; const disabled = !step || step.degrees[node.vertex - 1] === 0; return <g key={node.vertex} className={leaf === node.vertex || !disabled && hoveredNode === node.vertex ? "route-node" : ""} style={{ cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1 }} onClick={() => connect(node.vertex)} onPointerEnter={() => { if (!disabled) setHoveredNode(node.vertex); }} onPointerLeave={() => setHoveredNode(null)}><title>{disabled ? `Vertex ${node.vertex} removed or tree complete` : `Choose vertex ${node.vertex}`}</title><circle cx={x} cy={y} r="17" /><text x={x} y={y + 5} textAnchor="middle">{node.vertex}</text></g>; })}</svg><p>{leaf === null ? 'Select the smallest current leaf.' : `Leaf ${leaf} selected. Now select its neighbor.`}</p><div className="graph-node-buttons">{puzzle.data.labels.map((node: any) => <button key={node.vertex} type="button" disabled={!step || step.degrees[node.vertex - 1] === 0} aria-pressed={leaf === node.vertex} onClick={() => connect(node.vertex)}>{node.vertex}{guided && step && <small>degree {step.degrees[node.vertex - 1]}</small>}</button>)}</div><div className="puzzle-tools"><button type="button" disabled={!step} onClick={() => { if (step) { setEdges([...edges, step.edge]); setLeaf(null); setFeedback({ correct: true, message: `Guided step: connect ${step.leaf}–${step.target}${step.final ? ', the final leaves.' : ', then remove the leaf and consume the first code value.'}` }); } }}>Show one guided decoder step</button><button type="button" onClick={() => { setEdges([]); setLeaf(null); }}>Restart tree</button></div><ol className="decoder-log" aria-live="polite">{edges.map((edge, index) => <li key={index}>Connected {edge.from}–{edge.to}{index < puzzle.data.sequence.length ? `; removed leaf ${edge.from}` : '; connected final leaves'}.</li>)}</ol>{guided && <p className="input-hint">Every guided step changes the actual drawn graph. It preserves the smallest-leaf convention and consumes one sequence value, rather than treating the sequence as arbitrary coordinates.</p>}</section>}

    {puzzle.type === "graph" && <BridgeBoard data={puzzle.data} repair={repair} route={route} completed={Boolean(proof || solved)} onRepair={id => { setRepair(id); setRoute([]); setFeedback({ correct: false, message: "" }); }} onTrace={trace} onUndo={() => setRoute(route.slice(0, -1))} onReset={() => { setRepair(""); setRoute([]); setFeedback({ correct: false, message: "" }); }} />}

    {puzzle.type === 'logic' && <section className="logic-device" aria-label="AND and XOR switch relay"><div className="logic-switches">{['A', 'B', 'C', 'D'].map((label, index) => <button type="button" key={label} aria-label={`Switch ${label}, value ${inputs[index]}`} aria-pressed={Boolean(inputs[index])} onClick={() => setInputs(inputs.map((value, i) => i === index ? value ^ 1 : value))}><span>{label}</span><strong>{inputs[index]}</strong></button>)}</div><div className="logic-rails" aria-live="polite"><div><strong>A XOR B = {inputs[0] ^ inputs[1]}</strong><span>Target: {puzzle.data.targets.xor}</span><small>{(inputs[0] ^ inputs[1]) === puzzle.data.targets.xor ? 'MATCH' : 'NOT YET'}</small></div><div><strong>C AND D = {inputs[2] & inputs[3]}</strong><span>Target: {puzzle.data.targets.and}</span><small>{(inputs[2] & inputs[3]) === puzzle.data.targets.and ? 'MATCH' : 'NOT YET'}</small></div></div>{guided && <table className="logic-table"><caption>Two-input gate rules</caption><thead><tr><th scope="col">Inputs</th><th scope="col">XOR</th><th scope="col">AND</th></tr></thead><tbody>{[[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => <tr key={`${a}${b}`}><th scope="row">{a}, {b}</th><td>{a ^ b}</td><td>{a & b}</td></tr>)}</tbody></table>}</section>}

    <section className="puzzle-hints" aria-label="Graduated puzzle hints"><button type="button" disabled={hintCount >= puzzle.hints.length} onClick={() => setHintCount(hintCount + 1)}>Hint {Math.min(hintCount + 1, puzzle.hints.length)}/{puzzle.hints.length}</button><ol>{puzzle.hints.slice(0, hintCount).map((hint: string, index: number) => <li key={index}>{hint}</li>)}</ol></section>
    {feedback.message && (feedback.correct && (proof || solved) ? <details className="puzzle-clue"><summary>Clue restored · read the new journal note</summary><p>{feedback.message}</p></details> : <div className={`puzzle-feedback ${feedback.correct ? "success" : ""}`} role="status" aria-live="polite">{feedback.message}</div>)}
    {learning && <details className="puzzle-learning" aria-label="What you proved"><summary>What you proved</summary><p>{learning}</p></details>}
    <div className="puzzle-actions"><button className="button primary" type="submit" disabled={missing.length > 0 || Boolean(bridge && !bridge.ready)}>{puzzle.type === "graph" ? "Restore bridge" : "Check solution"}</button><button className="button secondary" type="button" onClick={onClose}>Back</button></div>
  </form>;
}
