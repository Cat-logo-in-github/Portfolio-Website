import { useEffect, useState } from 'react';
import { simulateDevice } from '../core/devices.mjs';
import './v4-puzzles.css';
import './v4-devices.css';

type Props = {
  device: any;
  onSubmit: (submission: any) => { correct: boolean; message: string; [key: string]: any };
  onClose: () => void;
  completed?: boolean;
};
const DIRECTIONS = ['N', 'E', 'S', 'W'];
const ARROWS: Record<string, string> = { N: '↑', E: '→', S: '↓', W: '←' };
const inputLabel = (inputs: any[], id: string) => inputs.find(input => input.id === id)?.label || id;
const formatArgument = (argument: string | number, data: any) => typeof argument === 'number' ? argument : data.modules.find((module: any) => module.id === argument)?.label || inputLabel(data.inputs, argument);

export default function DevicePanel({ device, onSubmit, onClose, completed = false }: Props) {
  const [directions, setDirections] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [sortingActions, setSortingActions] = useState<{ kind: string }[]>([]);
  const [patch, setPatch] = useState<{ moduleId: string; op: string } | null>(null);
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedCase, setSelectedCase] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [feedback, setFeedback] = useState({ correct: false, message: '' });
  const [hintCount, setHintCount] = useState(0);
  const [proved, setProved] = useState(false);
  const data = device.data;

  useEffect(() => {
    setDirections(Object.fromEntries((device.data.routers || []).map((router: any) => [router.id, router.direction])));
    setOrder([]); setSortingActions([]); setPatch(null); setSelectedModule(device.data.modules?.[0]?.id || ''); setSelectedCase(0);
    setResult(device.type === 'debugging' ? simulateDevice(device) : null);
    setFeedback({ correct: false, message: '' }); setHintCount(0); setProved(false);
  }, [device.instanceId]);

  const queue: any = device.type === 'scheduling' ? simulateDevice(device, { order }) : null;
  const shelf: any = device.type === 'sorting' ? simulateDevice(device, { actions: sortingActions }) : null;
  const totalDuration = device.type === 'scheduling' ? data.jobs.reduce((total: number, job: any) => total + job.duration, 0) : 0;
  const activeModule = data.modules?.find((module: any) => module.id === selectedModule);
  const activeCase = result?.tests?.[selectedCase];
  const run = () => {
    const submission = device.type === 'routing' ? { directions } : device.type === 'scheduling' ? { order } : device.type === 'sorting' ? { actions: sortingActions } : { patch };
    const simulation: any = simulateDevice(device, submission);
    setResult(simulation);
    if (device.type === 'debugging') setSelectedCase(Math.max(0, simulation.tests?.findIndex((test: any) => !test.pass) || 0));
    const response = onSubmit(submission);
    setFeedback(response);
    if (response.correct) setProved(true);
  };
  const reset = () => {
    setDirections(Object.fromEntries((data.routers || []).map((router: any) => [router.id, router.direction])));
    setOrder([]); setSortingActions([]); setPatch(null); setResult(device.type === 'debugging' ? simulateDevice(device) : null);
    setFeedback({ correct: false, message: '' }); setSelectedCase(0);
  };
  const moveJob = (index: number, direction: number) => {
    const next = [...order], destination = index + direction;
    if (destination < 0 || destination >= next.length) return;
    [next[index], next[destination]] = [next[destination], next[index]]; setOrder(next); setResult(null);
  };
  const sortStep = (kind: string) => { if (sortingActions.length >= data.maxActions) return; setSortingActions([...sortingActions, { kind }]); setFeedback({ correct: false, message: '' }); };

  return <section className={`puzzle-panel device-panel device-${device.type}`} aria-label={device.title}>
    <div className="puzzle-heading"><span className="eyebrow">OPTIONAL FIELD DEVICE · {device.profile.toUpperCase()}</span><h2>{device.title}</h2><p className="puzzle-goal">{device.goal}</p></div>
    {completed && <p className="puzzle-status success">Badge already collected · replay freely</p>}
    <details className="puzzle-help"><summary>How to play</summary><p>{device.instructions}</p><p>Retries and hints are free. This optional device does not block the story or portfolio.</p></details>

    {device.type === 'routing' && <section className="routing-workbench" aria-label="Editable packet routing grid">
      <div className="device-readout"><span>Hop limit <strong>{data.ttl}</strong></span><span>{data.checkpoint ? `Required relay ${data.checkpoint}` : 'Deliver to the mailbox'}</span></div>
      <div className="routing-grid" role="group" aria-label="Tap an arrow to rotate clockwise" style={{ gridTemplateColumns: `repeat(${data.width}, minmax(0, 1fr))` }}>
        {Array.from({ length: data.width * data.height }, (_, index) => {
          const x = index % data.width, y = Math.floor(index / data.width), id = `${x},${y}`;
          const traceIndex = result?.trace?.indexOf(id) ?? -1, router = data.routers.find((item: any) => item.id === id);
          const marker = id === data.source ? 'START' : id === data.target ? 'MAILBOX' : id === data.checkpoint ? 'RELAY' : `${x},${y}`;
          const className = `router-cell ${id === data.source ? 'router-source' : ''} ${id === data.target ? 'router-target' : ''} ${id === data.checkpoint ? 'router-relay' : ''} ${traceIndex >= 0 ? 'router-traced' : ''}`;
          if (!router) return <div key={id} className={`${className} ${id !== data.target ? 'router-broken' : ''}`} aria-label={id === data.target ? `Mailbox at ${id}` : `Broken tile at ${id}`}><small>{marker}</small><strong aria-hidden="true">{id === data.target ? '✉' : '×'}</strong>{traceIndex >= 0 && <span className="packet-step">{traceIndex}</span>}</div>;
          return <button type="button" key={id} className={className} style={{ animationDelay: `${Math.max(0, traceIndex) * .12}s` }} aria-label={`${marker === id ? 'Router' : marker} ${id}, points ${directions[id] || router.direction}. Rotate clockwise.`} onClick={() => { const direction = directions[id] || router.direction; setDirections({ ...directions, [id]: DIRECTIONS[(DIRECTIONS.indexOf(direction) + 1) % 4] }); setResult(null); setFeedback({ correct: false, message: '' }); }}><small>{marker}</small><strong aria-hidden="true">{ARROWS[directions[id] || router.direction]}</strong>{traceIndex >= 0 && <span className="packet-step">{traceIndex}</span>}</button>;
        })}
      </div>
      <p className="device-caption">Tap arrows to rotate. The packet follows one arrow per hop.</p>
      {result?.trace && <div className={`device-simulation ${result.correct ? 'success' : ''}`} aria-live="polite"><strong>{result.reason}</strong><p className="packet-trace">{result.trace.join(' → ')}</p></div>}
    </section>}

    {device.type === 'scheduling' && <section className="scheduling-workbench" aria-label="Single processor scheduling workbench">
      <div className="job-pool" role="group" aria-label="Available jobs">{data.jobs.map((job: any) => <button type="button" key={job.id} className="job-card" disabled={order.includes(job.id)} onClick={() => { setOrder([...order, job.id]); setResult(null); }}><span className="job-letter">{job.id}</span><strong>{job.label}</strong><span>{job.duration} ticks · finish by {job.deadline}</span><small>{job.requires.length ? `After ${job.requires.join(', ')}` : 'No prerequisites'}</small><span className="job-add">{order.includes(job.id) ? 'Queued' : '+ Add to queue'}</span></button>)}</div>
      <div className="processor-timeline" aria-label="Processor timeline in ticks"><span className="timeline-zero">0</span>{queue.steps?.map((step: any) => <div key={step.id} className={`timeline-job ${step.late || step.missing.length ? 'timeline-warning' : ''}`} style={{ flex: step.end - step.start }}><strong>{step.id}</strong><small>{step.start}–{step.end}</small></div>)}{(queue.total || 0) < totalDuration && <div className="timeline-empty" style={{ flex: totalDuration - (queue.total || 0) }}>idle queue</div>}</div>
      <ol className="processor-queue" aria-label="Editable run queue">{queue.steps?.map((step: any, index: number) => <li key={step.id}><div><strong>{step.id} · {step.label}</strong><span>{step.start}–{step.end} ticks{step.missing.length ? ` · needs ${step.missing.join(', ')} first` : step.late ? ' · misses deadline' : ' · on time'}</span></div><div className="queue-controls"><button type="button" aria-label={`Move job ${step.id} earlier`} disabled={index === 0} onClick={() => moveJob(index, -1)}>↑</button><button type="button" aria-label={`Move job ${step.id} later`} disabled={index === order.length - 1} onClick={() => moveJob(index, 1)}>↓</button><button type="button" aria-label={`Remove job ${step.id} from queue`} onClick={() => { setOrder(order.filter(id => id !== step.id)); setResult(null); }}>×</button></div></li>)}</ol>
      {!order.length && <p className="device-caption">Choose a job above to start the queue.</p>}
      {result && <p className={`device-simulation ${result.correct ? 'success' : ''}`} aria-live="polite">{result.reason}</p>}
    </section>}

    {device.type === 'debugging' && <section className="debugging-workbench" aria-label="Interconnected garden machine testbed">
      <p className="machine-spec"><strong>Required behavior:</strong> {data.spec}</p>
      <div className="machine-inputs" aria-label="Machine inputs">{data.inputs.map((input: any) => <span key={input.id}>{input.label}<strong>{activeCase?.inputs[input.id] ?? '—'}</strong></span>)}</div>
      <div className="machine-modules" role="group" aria-label="Select a machine module to repair">{data.modules.map((module: any) => {
        const probe = activeCase?.trace?.find((item: any) => item.id === module.id), currentOp = patch && patch.moduleId === module.id ? patch.op : module.op;
        return <button type="button" key={module.id} className={`machine-module ${module.id === selectedModule ? 'selected' : ''} ${patch?.moduleId === module.id ? 'patched' : ''}`} aria-pressed={module.id === selectedModule} onClick={() => setSelectedModule(module.id)}><small className="machine-wires">{module.args.map((argument: string | number) => formatArgument(argument, data)).join(' + ')} ↓</small><strong>{module.label}</strong><span className="machine-operator">{currentOp}</span><small className="machine-probe">Last probe output: <b>{probe?.value ?? '—'}</b>{patch?.moduleId === module.id ? ' · patch fitted' : ''}</small></button>;
      })}</div>
      {activeModule && <fieldset className="operator-selector"><legend>Patch {activeModule.label}</legend>{activeModule.allowed.map((op: string) => <button type="button" key={op} aria-pressed={patch && patch.moduleId === activeModule.id ? patch.op === op : activeModule.op === op} onClick={() => { setPatch({ moduleId: activeModule.id, op }); setFeedback({ correct: false, message: '' }); }}>{op}</button>)}<p>One replacement at a time. Run the testbed after each hypothesis.</p></fieldset>}
      <div className="testbed-heading"><h3>Regression cases</h3><span>{result?.passed || 0}/{data.cases.length} pass · tap a row to probe</span></div>
      <div className="testbed-scroll"><table className="testbed-table"><thead><tr><th>Probe</th>{data.inputs.map((input: any) => <th key={input.id}>{input.label}</th>)}<th>Want</th><th>Got</th><th>Result</th></tr></thead><tbody>{(result?.tests || []).map((test: any, index: number) => <tr key={index} className={selectedCase === index ? 'selected' : ''} onClick={() => setSelectedCase(index)}><td><button type="button" aria-label={`Probe test case ${index + 1}, ${test.pass ? 'passes' : 'fails'}`} aria-pressed={selectedCase === index} onClick={() => setSelectedCase(index)}>{index + 1}</button></td>{data.inputs.map((input: any) => <td key={input.id}>{test.inputs[input.id]}</td>)}<td>{test.expected}</td><td>{test.actual}</td><td>{test.pass ? 'Pass' : 'Fail'}</td></tr>)}</tbody></table></div>
      {activeCase && <div className="probe-log" aria-live="polite"><strong>Case {selectedCase + 1} signal trace</strong><ol>{activeCase.trace.map((probe: any) => <li key={probe.id}>{probe.label}: {probe.op}({probe.args.join(', ')}) → <b>{probe.value}</b></li>)}</ol></div>}
    </section>}

    {device.type === 'sorting' && <section className="sorting-workbench" aria-label="Stable insertion sort seed shelf">
      <div className="device-readout"><span>Sorted prefix <strong>{shelf.sorting.sortedCount}/{data.packets.length}</strong></span><span>{shelf.sorting.comparisons} comparisons · {shelf.sorting.shifts} slides</span></div>
      <div className="seed-shelf" role="list" aria-label="Seed packets from left to right">{shelf.sorting.slots.map((id: string | null, index: number) => {
        const packet = data.packets.find((item: any) => item.id === id);
        return <div key={index} role="listitem" className={`seed-slot ${index < shelf.sorting.sortedCount && packet ? 'seed-sorted' : ''} ${index === shelf.sorting.cursor ? 'seed-comparing' : ''} ${!packet ? 'seed-gap' : ''}`}><small className="seed-position">Shelf {index + 1}</small>{packet ? <><strong className="seed-id">{packet.id}</strong><span>{packet.label}</span><b>{packet.days} {packet.days === 1 ? 'day' : 'days'}</b></> : <><strong>↓</strong><span>Insertion gap</span></>}</div>;
      })}</div>
      <div className="held-seed">{shelf.sorting.held ? (() => { const packet = data.packets.find((item: any) => item.id === shelf.sorting.held); return <><span className="eyebrow">HELD PACKET</span><strong>{packet.id} · {packet.label}</strong><span>{packet.days} {packet.days === 1 ? 'day' : 'days'}</span></>; })() : <><span className="eyebrow">SHELF COMPLETE</span><strong>Every packet has its place.</strong><span>Equal values kept their original order.</span></>}</div>
      <p className="sorting-instruction" aria-live="polite">{shelf.reason}</p>
      <div className="sorting-controls" role="group" aria-label="Insertion sort operations"><button type="button" disabled={shelf.sorting.complete || shelf.sorting.cursor < 0 || shelf.sorting.comparison !== null} onClick={() => sortStep('compare')}>Compare packets</button><button type="button" disabled={shelf.sorting.complete || shelf.sorting.comparison !== 1} onClick={() => sortStep('shift')}>Slide left packet right →</button><button type="button" disabled={shelf.sorting.complete || shelf.sorting.cursor >= 0 && (shelf.sorting.comparison === null || shelf.sorting.comparison > 0)} onClick={() => sortStep('insert')}>Insert held packet ↓</button></div>
      <div className="sorting-tools"><button type="button" disabled={!sortingActions.length} onClick={() => { setSortingActions(sortingActions.slice(0, -1)); setFeedback({ correct: false, message: '' }); }}>Undo operation</button><button type="button" disabled={shelf.sorting.complete} onClick={() => sortStep(shelf.sorting.cursor >= 0 && shelf.sorting.comparison === null ? 'compare' : shelf.sorting.cursor >= 0 && shelf.sorting.comparison > 0 ? 'shift' : 'insert')}>Show one safe step</button></div>
      <details className="puzzle-help"><summary>Why keep equal packets in order?</summary><p>The letters identify the original packets. If A and C both take three days and A began first, a stable sort keeps A before C. Slide only strictly larger values; stop when the left value is equal.</p></details>
      <ol className="sorting-history" aria-label="Recent sorting operations">{shelf.history.slice(-5).map((operation: any, index: number) => <li key={sortingActions.length - 5 + index}>{operation.kind === 'compare' ? `Compare ${operation.left} with ${operation.held}: ${operation.comparison > 0 ? 'left is larger' : operation.comparison < 0 ? 'left is smaller' : 'equal — preserve order'}.` : operation.kind === 'shift' ? `Slide ${operation.packet} from shelf ${operation.from + 1} to ${operation.to + 1}.` : `Insert ${operation.packet} at shelf ${operation.at + 1}.`}</li>)}</ol>
    </section>}

    <div className="puzzle-actions device-actions"><button type="button" className="primary" onClick={run} disabled={device.type === 'scheduling' && order.length !== data.jobs.length || device.type === 'debugging' && !patch || device.type === 'sorting' && !shelf?.correct}>{device.type === 'routing' ? 'Send packet' : device.type === 'scheduling' ? 'Run schedule' : device.type === 'sorting' ? 'Check shelf' : 'Run testbed'}</button><button type="button" onClick={reset}>Reset workbench</button><button type="button" onClick={onClose}>Back</button></div>
    {feedback.message && <p className={`puzzle-feedback ${feedback.correct ? 'success' : ''}`} role="status">{feedback.correct ? 'Restored. Badge recorded; you can keep experimenting.' : feedback.message}</p>}
    {(proved || completed) && <details className="puzzle-learning"><summary>What you proved</summary><p>{device.learning}</p></details>}
    <div className="puzzle-hints"><button type="button" disabled={hintCount >= device.hints.length} onClick={() => setHintCount(Math.min(device.hints.length, hintCount + 1))}>Hint {Math.min(hintCount + 1, device.hints.length)}/{device.hints.length}</button>{hintCount > 0 && <p>{device.hints[hintCount - 1]}</p>}</div>
  </section>;
}
