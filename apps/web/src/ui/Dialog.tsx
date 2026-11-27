import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';

/** Open dialogs, innermost last: only the topmost one guards focus and handles keys (stacked dialogs). */
const stack: HTMLElement[] = [];
const isTop = (el: HTMLElement | null) => !!el && stack[stack.length - 1] === el;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  /** id of the heading inside the dialog: it names the dialog and receives focus on open. */
  readonly titleId: string;
  /** Called on Escape (when allowed). The owner unmounts the dialog to close it. */
  readonly onClose: () => void;
  /** False while closing would interrupt work, e.g. while an import is being written. */
  readonly closeOnEscape?: boolean;
  /** Where focus goes on close; defaults to whatever was focused when the dialog opened. */
  readonly returnFocus?: RefObject<HTMLElement | null>;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * The one dialog primitive (T107, FR-048): focus moves to the heading on open, Tab and Shift+Tab stay
 * inside, Escape closes unless `closeOnEscape` is false, and focus returns to the opener on close.
 * Callers put the non-destructive action first, so a destructive action is never focused first.
 * Dialogs may stack: only the topmost guards focus and answers Escape and Tab.
 * Flat by design (DESIGN.md Flat Bench): a tonal scrim and a bordered panel, no shadow.
 */
export function Dialog({ titleId, onClose, closeOnEscape = true, returnFocus, className, children }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const returnRef = useRef(returnFocus);
  returnRef.current = returnFocus;
  const escape = useRef({ closeOnEscape, onClose });
  escape.current = { closeOnEscape, onClose };

  useLayoutEffect(() => {
    opener.current = document.activeElement;
    const self = panel.current;
    if (self) stack.push(self);
    const title = document.getElementById(titleId);
    if (title && panel.current?.contains(title)) {
      if (!title.hasAttribute('tabindex')) title.tabIndex = -1;
      title.focus({ preventScroll: true });
      title.scrollIntoView?.({ block: 'nearest' });
    } else panel.current?.focus({ preventScroll: true });

    // Focus that escapes (a click on the scrim, a programmatic move) is pulled back inside.
    const onFocusIn = (e: FocusEvent) => {
      const el = panel.current;
      if (el && isTop(el) && e.target instanceof Node && !el.contains(e.target)) (document.getElementById(titleId) ?? el).focus({ preventScroll: true });
    };
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      const at = self ? stack.lastIndexOf(self) : -1;
      if (at >= 0) stack.splice(at, 1);
      const back = returnRef.current?.current;
      const target = back?.isConnected ? back : opener.current;
      if (target instanceof HTMLElement && target.isConnected) target.focus({ preventScroll: true });
    };
  }, [titleId]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!isTop(panel.current)) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (escape.current.closeOnEscape) escape.current.onClose();
      return;
    }
    if (e.key !== 'Tab' || !panel.current) return;
    const title = document.getElementById(titleId);
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hidden);
    const ring = title && !items.includes(title) ? [title, ...items] : items;
    if (!ring.length) { e.preventDefault(); return; }
    const i = ring.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey ? (i <= 0 ? ring.length - 1 : i - 1) : (i < 0 || i === ring.length - 1 ? 0 : i + 1);
    e.preventDefault();
    ring[next]!.focus();
  }

  return (
    <div className="dialog-backdrop">
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`dialog${className ? ` ${className}` : ''}`} onKeyDown={onKeyDown}>
        {children}
      </div>
    </div>
  );
}
