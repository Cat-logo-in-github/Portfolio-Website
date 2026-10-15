const CONTROL_SELECTOR = 'button, a[href], input, select, textarea, summary, [tabindex]';
const BUTTON_INPUTS = new Set(['button', 'submit', 'reset', 'checkbox', 'radio']);

/** Enumerate current controls without relying on layout measurements (works in DOM tests too). */
export function getMenuControls(panel) {
  const window = panel.ownerDocument.defaultView;
  return [...panel.querySelectorAll(CONTROL_SELECTOR)].filter(element => {
    if (element.matches(':disabled, [disabled], [aria-disabled="true"], input[type="hidden"]') || element.tabIndex < 0) return false;
    for (let ancestor = element; ancestor && ancestor !== panel.parentElement; ancestor = ancestor.parentElement) {
      if (ancestor.hidden || ancestor.hasAttribute('inert') || ancestor.getAttribute('aria-hidden') === 'true') return false;
      const style = window?.getComputedStyle(ancestor);
      if (style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse') return false;
      if (ancestor.tagName === 'DETAILS' && !ancestor.open) {
        const summary = [...ancestor.children].find(child => child.tagName === 'SUMMARY');
        if (!summary?.contains(element)) return false;
      }
    }
    if (element.tagName === 'SUMMARY') {
      const first = [...(element.parentElement?.children || [])].find(child => child.tagName === 'SUMMARY');
      if (first !== element) return false;
    }
    return true;
  });
}

function initialControl(panel, controls = getMenuControls(panel)) {
  return controls.find(element => element.hasAttribute('data-menu-initial') || element.hasAttribute('autofocus'))
    || controls.find(element => !element.hasAttribute('data-menu-close')) || controls[0] || panel;
}

function focusControl(element, scroll = false) {
  element?.focus({ preventScroll: true });
  if (scroll) element?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

function editsText(element) {
  return element?.isContentEditable || element?.closest?.('[contenteditable="true"], [contenteditable=""]')
    || ['TEXTAREA', 'SELECT'].includes(element?.tagName)
    || (element?.tagName === 'INPUT' && !BUTTON_INPUTS.has(element.type));
}

function activateControl(element) {
  if (typeof element.click === 'function') element.click();
  else element.dispatchEvent(new element.ownerDocument.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
}

/** Keyboard support belongs to this open panel; controls retain native editing behavior. */
export function handleMenuKey(event, panel, onClose) {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return false;
  const document = panel.ownerDocument, active = document.activeElement;
  if (!panel.contains(active)) return false;
  const key = event.key.toLowerCase();
  if (key === 'escape') {
    event.preventDefault(); event.stopPropagation();
    if (!event.repeat) onClose();
    return true;
  }
  const controls = getMenuControls(panel);
  if (key === 'tab') {
    event.preventDefault();
    const index = controls.indexOf(active), delta = event.shiftKey ? -1 : 1;
    const next = controls.length ? controls[(index + delta + controls.length) % controls.length] : panel;
    focusControl(next, true); return true;
  }
  if (active.tagName === 'INPUT' && ['checkbox', 'radio'].includes(active.type) && (key === 'enter' || key === ' ')) {
    event.preventDefault();
    if (!event.repeat) activateControl(active);
    return true;
  }
  if (editsText(active)) {
    if (key === 'enter' && event.repeat && active.tagName === 'INPUT') { event.preventDefault(); return true; }
    return false;
  }
  const movement = { arrowup: -1, arrowleft: -1, w: -1, a: -1, arrowdown: 1, arrowright: 1, s: 1, d: 1 }[key];
  if (movement) {
    event.preventDefault();
    const index = controls.indexOf(active), next = controls.length ? controls[(index + movement + controls.length) % controls.length] : panel;
    focusControl(next, true); return true;
  }
  if (key === 'enter' || key === ' ') {
    const target = active?.closest?.('button, a[href], summary, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]');
    if (target && panel.contains(target)) {
      event.preventDefault();
      if (!event.repeat) activateControl(target);
      return true;
    }
  }
  return false;
}

/** Trap focus while mounted, recover when controls disappear, and preserve it on ordinary updates. */
export function installMenuNavigation(panel, onClose) {
  const document = panel.ownerDocument, previous = document.activeElement;
  let lastControls = getMenuControls(panel), lastFocused = initialControl(panel, lastControls), disposed = false;
  const recover = () => {
    if (disposed) return;
    const controls = getMenuControls(panel);
    if (controls.includes(document.activeElement)) { lastFocused = document.activeElement; lastControls = controls; return; }
    const index = lastControls.indexOf(lastFocused);
    const sameContent = controls.some(element => lastControls.includes(element) && !element.hasAttribute('data-menu-close'));
    lastFocused = controls.includes(lastFocused) ? lastFocused
      : sameContent && index >= 0 && controls.length ? controls[Math.min(index, controls.length - 1)] : initialControl(panel, controls);
    lastControls = controls;
    focusControl(lastFocused);
  };
  const keyboard = event => handleMenuKey(event, panel, onClose);
  const focus = event => {
    if (panel.contains(event.target)) lastFocused = event.target;
    else recover();
  };
  document.addEventListener('keydown', keyboard);
  document.addEventListener('focusin', focus);
  const Observer = document.defaultView?.MutationObserver;
  const observer = Observer ? new Observer(recover) : null;
  observer?.observe(panel, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'aria-hidden', 'aria-disabled', 'style', 'class', 'open', 'tabindex'] });
  focusControl(lastFocused);
  return () => {
    disposed = true; observer?.disconnect(); document.removeEventListener('keydown', keyboard); document.removeEventListener('focusin', focus);
    if (previous?.isConnected && !previous.matches?.(':disabled')) focusControl(previous);
  };
}
