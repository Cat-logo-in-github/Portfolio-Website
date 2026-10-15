import { useEffect, useRef, useState } from 'react';

export default function DialogueText({ text }: { text: string }) {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [count, setCount] = useState(reduced ? text.length : 0);
  useEffect(() => {
    if (reduced) { setCount(text.length); return; }
    setCount(0);
    const started = performance.now();
    const timer = setInterval(() => { const next = Math.min(text.length, Math.floor((performance.now() - started) / 8)); setCount(next); if (next >= text.length) clearInterval(timer); }, 32);
    timerRef.current = timer;
    return () => { clearInterval(timer); timerRef.current = null; };
  }, [text, reduced]);
  return <div className="dialogue-text"><p aria-hidden="true">{text.slice(0, count)}</p><span className="sr-only">{text}</span>{count < text.length && <button className="dialogue-skip reading-link" onClick={() => { if (timerRef.current) clearInterval(timerRef.current); setCount(text.length); }}>Show full text ↵</button>}</div>;
}
