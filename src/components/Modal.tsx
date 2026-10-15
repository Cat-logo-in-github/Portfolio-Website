import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { installMenuNavigation } from '../ui/menu-navigation.mjs';

export default function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (!panel.current) return;
    return installMenuNavigation(panel.current, () => close.current());
  }, []);
  return <div className="modal-shade" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panel} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      <header className="modal-header"><span>{title}</span><button type="button" data-menu-close onClick={onClose} aria-label="Close panel">× <span className="escape-key">ESC</span></button></header>
      {children}
    </div>
  </div>;
}
