/**
 * Pure helpers for the fretboard's "Jump to frets" group and visible-range indicator (FR-047).
 * Fret 0 lives in the always-visible nut column, so it joins the first segment without using one of
 * the `fitsPerSegment` slots. The dash is U+2013 EN DASH, as written in the spec.
 */
const DASH = '–';

export interface JumpSegment {
  readonly first: number;
  readonly last: number;
  /** Visible label, e.g. "Open–6", "7–12", "Open", "12". */
  readonly label: string;
  /** Accessible name: "Frets " + label (WCAG 2.5.3). */
  readonly name: string;
}

export interface VisibleRange {
  /** Fret 0 is inside the current range (it is then always in view, in the nut column). */
  readonly open: boolean;
  /** First and last fretted frets whose whole target is visible, if any. */
  readonly first?: number;
  readonly last?: number;
}

const fretLabel = (f: number) => (f === 0 ? 'Open' : String(f));
const span = (a: number, b: number) => (a === b ? fretLabel(a) : `${fretLabel(a)}${DASH}${fretLabel(b)}`);

/** Splits [from, to] into the fewest contiguous segments, filled greedily from the low end. */
export function jumpSegments(from: number, to: number, fitsPerSegment: number): JumpSegment[] {
  const fits = Math.max(1, Math.floor(fitsPerSegment));
  const out: JumpSegment[] = [];
  const firstFretted = Math.max(1, from);
  if (firstFretted > to) {
    // Only fret 0 in the range.
    const label = span(from, to);
    return [{ first: from, last: to, label, name: `Frets ${label}` }];
  }
  for (let a = firstFretted; a <= to; a += fits) {
    const start = out.length === 0 ? from : a;
    const last = Math.min(to, a + fits - 1);
    const label = span(start, last);
    out.push({ first: start, last, label, name: `Frets ${label}` });
  }
  return out;
}

/** Indicator text: "Open and frets 1–6 of 12", "Frets 7–12 of 12", "Open of 12", "Fret 12 of 12". */
export function rangeText(view: VisibleRange, of: number): string {
  const has = view.first !== undefined && view.last !== undefined;
  if (!has) return view.open ? `Open of ${of}` : `No whole fret in view of ${of}`;
  const frets = view.first === view.last ? `${view.first}` : `${view.first}${DASH}${view.last}`;
  const single = view.first === view.last;
  if (view.open) return `Open and ${single ? 'fret' : 'frets'} ${frets} of ${of}`;
  return `${single ? 'Fret' : 'Frets'} ${frets} of ${of}`;
}
