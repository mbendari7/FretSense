/**
 * Test-only jsdom layout shim for T094 [FR-047, FR-049]. jsdom has no layout: clientWidth and
 * scrollWidth are 0 and scrollLeft never changes. These shims give every HTML element a 390 CSS px
 * client width (the spec's narrow-phone width), make an element that contains an <svg> as wide as
 * that svg's `width` attribute (the fretboard draws its neck in CSS px), and make scrollLeft /
 * scrollTo / scrollBy actually store a clamped scroll offset.
 *
 * Consequence for T095: the fretboard must decide overflow, the visible frets and jump targets from
 * its own scroll area's clientWidth / scrollWidth / scrollLeft and its own geometry (or the pure
 * helpers in fretboard/range.ts), not from getBoundingClientRect, which stays all zeros here.
 */
export const AREA_WIDTH = 390;

type Restore = () => void;

export function installLayoutMock(): Restore {
  const saved: [object, PropertyKey, PropertyDescriptor | undefined][] = [];
  const define = (target: object, key: PropertyKey, desc: PropertyDescriptor) => {
    saved.push([target, key, Object.getOwnPropertyDescriptor(target, key)]);
    Object.defineProperty(target, key, { configurable: true, ...desc });
  };
  const offsets = new WeakMap<Element, number>();
  const widthOf = (el: Element) => {
    const svg = el.querySelector('svg');
    const w = svg ? parseFloat(svg.getAttribute('width') ?? '0') : 0;
    return Math.max(AREA_WIDTH, Number.isFinite(w) ? w : 0);
  };
  const maxScroll = (el: Element) => Math.max(0, widthOf(el) - AREA_WIDTH);
  const setLeft = (el: Element, v: number) => offsets.set(el, Math.max(0, Math.min(maxScroll(el), Number.isFinite(v) ? v : 0)));

  define(HTMLElement.prototype, 'clientWidth', { get() { return AREA_WIDTH; } });
  define(HTMLElement.prototype, 'scrollWidth', { get(this: HTMLElement) { return widthOf(this); } });
  define(Element.prototype, 'scrollLeft', {
    get(this: Element) { return offsets.get(this) ?? 0; },
    set(this: Element, v: number) { setLeft(this, v); },
  });
  const scrollTo = function (this: Element, a?: number | ScrollToOptions, _b?: number) {
    if (typeof a === 'number') setLeft(this, a);
    else if (a && typeof a.left === 'number') setLeft(this, a.left);
  };
  const scrollBy = function (this: Element, a?: number | ScrollToOptions, _b?: number) {
    const cur = offsets.get(this) ?? 0;
    if (typeof a === 'number') setLeft(this, cur + a);
    else if (a && typeof a.left === 'number') setLeft(this, cur + a.left);
  };
  define(Element.prototype, 'scrollTo', { value: scrollTo, writable: true });
  define(Element.prototype, 'scroll', { value: scrollTo, writable: true });
  define(Element.prototype, 'scrollBy', { value: scrollBy, writable: true });
  // Not implemented by jsdom; a no-op so an implementation that calls it doesn't throw.
  define(Element.prototype, 'scrollIntoView', { value: () => undefined, writable: true });
  define(window, 'scrollTo', { value: () => undefined, writable: true });

  return () => {
    for (const [target, key, desc] of saved.reverse()) {
      if (desc) Object.defineProperty(target, key, desc);
      else delete (target as Record<PropertyKey, unknown>)[key];
    }
  };
}

/** Normalise display text: ♭/♯ to b/#, curly quotes to straight, collapse whitespace. */
export const norm = (s: string | null | undefined) =>
  (s ?? '').replace(/♭/g, 'b').replace(/♯/g, '#').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

/** Every element that is (or is inside) a live region, with its politeness. */
export function liveRegions(root: ParentNode): { el: Element; politeness: 'polite' | 'assertive' | 'off' }[] {
  const out: { el: Element; politeness: 'polite' | 'assertive' | 'off' }[] = [];
  root.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"], [role="marquee"], [role="timer"]').forEach((el) => {
    const live = el.getAttribute('aria-live');
    const role = el.getAttribute('role');
    const politeness = live === 'assertive' || live === 'polite' || live === 'off' ? live : role === 'alert' ? 'assertive' : role === 'marquee' || role === 'timer' ? 'off' : 'polite';
    out.push({ el, politeness });
  });
  return out;
}

/** True when the element is inside any live region (aria-live other than off, or a live role). */
export function isInLiveRegion(el: Element): boolean {
  const region = el.closest('[aria-live], [role="status"], [role="alert"], [role="log"]');
  return !!region && region.getAttribute('aria-live') !== 'off';
}

export function isAriaHidden(el: Element): boolean {
  return !!el.closest('[aria-hidden="true"]');
}

/** A fretboard position by FR-049 name grammar: "String N, open" (fret 0) or "String N, fret F". */
export function positionEl(root: ParentNode, string: number, fret: number): HTMLElement | undefined {
  const head = fret === 0 ? `String ${string}, open` : `String ${string}, fret ${fret}`;
  return [...root.querySelectorAll<HTMLElement>('[role="button"][aria-label]')].find((el) => {
    const n = el.getAttribute('aria-label')!;
    return n === head || n.startsWith(`${head},`);
  });
}

export function allPositions(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[role="button"][aria-label^="String "]')];
}
