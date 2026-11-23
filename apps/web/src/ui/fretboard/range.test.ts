/**
 * T094 (red, test-first) [FR-047]: pure helpers behind the fretboard's "Jump to frets" group and its
 * visible-range text indicator. jsdom has no layout, so the segmentation and wording live in a pure
 * module that T095 creates: `apps/web/src/ui/fretboard/range.ts`.
 *
 * Expected contract (chosen by test-writer for T095):
 *   export interface JumpSegment { readonly first: number; readonly last: number; readonly label: string; readonly name: string }
 *   export function jumpSegments(from: number, to: number, fitsPerSegment: number): JumpSegment[]
 *   export interface VisibleRange { readonly open: boolean; readonly first?: number; readonly last?: number }
 *   export function rangeText(view: VisibleRange, of: number): string
 *
 * Semantics:
 *  - `from`/`to` are the current range (the drill's fret range during a drill, otherwise the visible
 *    window, FR-015), inclusive.
 *  - rangeText's `view.open` is true when fret 0 is inside the current range (it is then always in
 *    view, in the nut column; FR-047 "fret 0 counts as in view only when it is inside the current
 *    range"); `view.first`/`view.last` are the fretted frets whose whole target is visible; `of` is
 *    the last fret of the current range. (The suggested (firstVisible, lastVisible, last) signature
 *    cannot express "Open and frets 7–12", so an object is used.)
 *  - `fitsPerSegment` is how many *fretted* frets (fret >= 1) fit fully in the scroll area beside the
 *    nut column at the current text size. Fret 0 lives in the always-visible nut column (FR-047:
 *    "the nut column (string names and fret 0) kept visible"), so when fret 0 is in the range it
 *    joins the first segment without using a slot. This is what makes the spec's own example
 *    consistent: 6 fretted frets fit => "Open–6", "7–12" and "Open and frets 1–6 of 12".
 *  - "fewest contiguous segments" (FR-047), filled greedily from the low end: every segment except
 *    the last holds exactly `fitsPerSegment` fretted frets. (The spec example "Open–6", "7–12" is
 *    greedy; a balanced split is not ruled out by the wording, flagged in the T094 report.)
 *
 * Every expected string below is quoted from spec.md FR-047:
 *  - labels "by their first and last fret, with fret 0 shown as Open (e.g. Open–6, 7–12)";
 *  - accessible name "contains its visible label and the word frets (e.g. Frets Open–6, Frets 7–12)";
 *  - single fret: visible labels "Open" or "12", names "Frets Open" or "Frets 12";
 *  - indicator "Open and frets 1–6 of 12", "Frets 7–12 of 12", "Open of 12", "Fret 12 of 12",
 *    where "of N" is the last fret of the current range.
 * The dash is U+2013 EN DASH, as written in the spec.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { jumpSegments, rangeText } from './range';

const DASH = '–';
const labels = (from: number, to: number, fits: number): string[] => jumpSegments(from, to, fits).map((s: { label: string }) => s.label);

describe('FR-047 jump segments: spec examples', () => {
  it('frets 0–12 with 6 fretted frets per view: "Open–6", "7–12"', () => {
    const segs = jumpSegments(0, 12, 6);
    expect(segs.map((s) => [s.first, s.last])).toEqual([[0, 6], [7, 12]]);
    expect(segs.map((s) => s.label)).toEqual([`Open${DASH}6`, `7${DASH}12`]);
    expect(segs.map((s) => s.name)).toEqual([`Frets Open${DASH}6`, `Frets 7${DASH}12`]);
  });

  it('a single-fret segment is labelled by that fret alone: "Open" / "Frets Open"', () => {
    const segs = jumpSegments(0, 0, 6);
    expect(segs).toEqual([{ first: 0, last: 0, label: 'Open', name: 'Frets Open' }]);
  });

  it('a single-fret segment is labelled by that fret alone: "12" / "Frets 12"', () => {
    const segs = jumpSegments(12, 12, 6);
    expect(segs).toEqual([{ first: 12, last: 12, label: '12', name: 'Frets 12' }]);
  });

  it('a trailing single fret becomes its own one-fret segment ("13")', () => {
    expect(labels(0, 13, 6)).toEqual([`Open${DASH}6`, `7${DASH}12`, '13']);
    expect(jumpSegments(0, 13, 6)[2]!.name).toBe('Frets 13');
  });
});

describe('FR-047 jump segments: fewest contiguous segments (table)', () => {
  // Expected rows worked by hand from the rule "fewest segments, each fitting fully, greedy from the
  // low end, fret 0 rides with the first segment".
  const rows: [number, number, number, string[]][] = [
    [0, 12, 12, [`Open${DASH}12`]],
    [0, 12, 20, [`Open${DASH}12`]],
    [0, 12, 4, [`Open${DASH}4`, `5${DASH}8`, `9${DASH}12`]],
    [0, 12, 5, [`Open${DASH}5`, `6${DASH}10`, `11${DASH}12`]],
    [0, 24, 8, [`Open${DASH}8`, `9${DASH}16`, `17${DASH}24`]],
    [0, 20, 6, [`Open${DASH}6`, `7${DASH}12`, `13${DASH}18`, `19${DASH}20`]],
    [5, 17, 4, [`5${DASH}8`, `9${DASH}12`, `13${DASH}16`, '17']],
    [3, 12, 10, [`3${DASH}12`]],
    [7, 12, 3, [`7${DASH}9`, `10${DASH}12`]],
    [0, 1, 1, [`Open${DASH}1`]],
    [0, 2, 1, [`Open${DASH}1`, '2']],
    [1, 3, 1, ['1', '2', '3']],
  ];
  it.each(rows)('jumpSegments(%i, %i, %i)', (from, to, fits, expected) => {
    expect(labels(from, to, fits)).toEqual(expected);
  });
});

describe('FR-047 jump segments: invariants (property tests)', () => {
  // Brute-force reference, written here independently: the number of fretted frets in [from, to].
  const fretted = (from: number, to: number) => {
    let n = 0;
    for (let f = Math.max(1, from); f <= to; f++) n++;
    return n;
  };
  const lbl = (f: number) => (f === 0 ? 'Open' : String(f));
  const range = fc
    .tuple(fc.integer({ min: 0, max: 24 }), fc.integer({ min: 0, max: 24 }), fc.integer({ min: 1, max: 24 }))
    .map(([a, b, fits]) => ({ from: Math.min(a, b), to: Math.max(a, b), fits }));

  it('segments are contiguous and cover exactly [from, to]', () => {
    fc.assert(fc.property(range, ({ from, to, fits }) => {
      const segs = jumpSegments(from, to, fits);
      expect(segs.length).toBeGreaterThan(0);
      expect(segs[0]!.first).toBe(from);
      expect(segs[segs.length - 1]!.last).toBe(to);
      for (let i = 0; i < segs.length; i++) {
        expect(segs[i]!.first).toBeLessThanOrEqual(segs[i]!.last);
        if (i > 0) expect(segs[i]!.first).toBe(segs[i - 1]!.last + 1);
      }
    }));
  });

  it('each segment fits (at most `fits` fretted frets) and the count is the minimum possible', () => {
    fc.assert(fc.property(range, ({ from, to, fits }) => {
      const segs = jumpSegments(from, to, fits);
      for (const s of segs) expect(fretted(s.first, s.last)).toBeLessThanOrEqual(fits);
      const minimum = Math.max(1, Math.ceil(fretted(from, to) / fits));
      expect(segs.length).toBe(minimum);
    }));
  });

  it('greedy from the low end: every segment but the last is full', () => {
    fc.assert(fc.property(range, ({ from, to, fits }) => {
      const segs = jumpSegments(from, to, fits);
      for (const s of segs.slice(0, -1)) expect(fretted(s.first, s.last)).toBe(fits);
    }));
  });

  it('labels name the first and last fret ("Open" for 0); one-fret segments name that fret alone', () => {
    fc.assert(fc.property(range, ({ from, to, fits }) => {
      for (const s of jumpSegments(from, to, fits)) {
        expect(s.label).toBe(s.first === s.last ? lbl(s.first) : `${lbl(s.first)}${DASH}${lbl(s.last)}`);
      }
    }));
  });

  it('WCAG 2.5.3: the accessible name contains the visible label and the word "frets"', () => {
    fc.assert(fc.property(range, ({ from, to, fits }) => {
      for (const s of jumpSegments(from, to, fits)) {
        expect(s.name).toBe(`Frets ${s.label}`);
        expect(s.name.includes(s.label)).toBe(true);
        expect(/\bfrets\b/i.test(s.name)).toBe(true);
      }
    }));
  });

  it('fret 0 appears only when it is inside the range', () => {
    fc.assert(fc.property(range, ({ from, to, fits }) => {
      const any = jumpSegments(from, to, fits).some((s) => s.label.includes('Open'));
      expect(any).toBe(from === 0);
    }));
  });
});

describe('FR-047 range indicator text', () => {
  // rangeText(view, of): view.open = fret 0 is inside the current range and in view (it sits in the
  // always-visible nut column); view.first/last = the fully visible fretted frets, if any.
  it('fret 0 in view: "Open and frets 1–6 of 12"', () => {
    expect(rangeText({ open: true, first: 1, last: 6 }, 12)).toBe(`Open and frets 1${DASH}6 of 12`);
  });
  it('fret 0 not in the range: "Frets 7–12 of 12"', () => {
    expect(rangeText({ open: false, first: 7, last: 12 }, 12)).toBe(`Frets 7${DASH}12 of 12`);
  });
  it('fret 0 in range stays in view while scrolled (nut column kept visible): "Open and frets 7–12 of 12"', () => {
    expect(rangeText({ open: true, first: 7, last: 12 }, 12)).toBe(`Open and frets 7${DASH}12 of 12`);
  });
  it('view of only fret 0: "Open of 12"', () => {
    expect(rangeText({ open: true }, 12)).toBe('Open of 12');
  });
  it('view of one fret: "Fret 12 of 12"', () => {
    expect(rangeText({ open: false, first: 12, last: 12 }, 12)).toBe('Fret 12 of 12');
  });
  it('one-fret form applies to any fret: "Fret 5 of 17"', () => {
    expect(rangeText({ open: false, first: 5, last: 5 }, 17)).toBe('Fret 5 of 17');
  });
  it('"of N" is the last fret of the current range, not the instrument fret count', () => {
    expect(rangeText({ open: false, first: 5, last: 9 }, 17)).toBe(`Frets 5${DASH}9 of 17`);
    expect(rangeText({ open: true, first: 1, last: 6 }, 20)).toBe(`Open and frets 1${DASH}6 of 20`);
  });
});
