import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export default function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab') {
        const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href], [tabindex="0"]') || []).filter(el => el.offsetParent !== null);
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [onClose]);
  useEffect(() => { panel.current?.querySelector<HTMLElement>('button, input, a, [tabindex="0"]')?.focus(); }, [title]);
  return <div className="modal-shade" onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div ref={panel} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><header className="modal-header"><span>{title}</span><button onClick={onClose} aria-label="Close panel">× <span className="escape-key">ESC</span></button></header>{children}</div></div>;
}
