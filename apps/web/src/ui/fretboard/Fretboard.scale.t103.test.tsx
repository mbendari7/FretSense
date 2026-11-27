/**
 * T103 (red, test-first) [FR-048, FR-047]: fretboard sizes scale with the text-size setting.
 * Thresholds: WCAG 1.4.4 / 1.4.3 "large text" = 24 CSS px, or 18.66 px bold (14pt); 2.5.8 / FR-048
 * target size 44 x 44 CSS px. Contract: `fretboardMetrics(1|2|3)` and `TextSizeContext` (default 2) from
 * ./scale; the SVG text carries font-size attributes equal to the metrics. Only bounds are asserted.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { presetById, presets } from '@fretsense/theory';
import { Fretboard, type Marker } from './Fretboard';
import { TextSizeContext, fretboardMetrics } from './scale';
import { installLayoutMock } from '../__tests__/layout-mock';

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
afterEach(cleanup);

const SIZES = [1, 2, 3] as const;
const KEYS = ['labelPx', 'fretNumPx', 'nutNamePx', 'markerR', 'stringGap', 'minCell', 'openCell', 'nameW', 'hitW', 'hitH'] as const;

describe('[T103][FR-048] fretboardMetrics bounds', () => {
  it('returns every metric as a positive finite number', () => {
    for (const s of SIZES) for (const k of KEYS) {
      const v = fretboardMetrics(s)[k];
      expect(Number.isFinite(v) && v > 0, `${k} at size ${s}: ${v}`).toBe(true);
    }
  });
  it('labelPx >= 24 at the largest size', () => {
    expect(fretboardMetrics(3).labelPx).toBeGreaterThanOrEqual(24);
  });
  it.each(SIZES)('labelPx >= 18.67 (bold large text) at size %i', (s) => {
    expect(fretboardMetrics(s).labelPx).toBeGreaterThanOrEqual(18.67);
  });
  it('every metric is non-decreasing from size 1 to 3', () => {
    for (const k of KEYS) {
      const [a, b, c] = SIZES.map((s) => fretboardMetrics(s)[k]) as [number, number, number];
      expect(a, `${k}: 1 -> 2`).toBeLessThanOrEqual(b);
      expect(b, `${k}: 2 -> 3`).toBeLessThanOrEqual(c);
    }
  });
  describe.each(SIZES)('size %i geometry', (s) => {
    const m = () => fretboardMetrics(s);
    it('marker has room for a 2-glyph label such as "C♯": markerR*2 >= labelPx*1.6', () => {
      expect(m().markerR * 2).toBeGreaterThanOrEqual(m().labelPx * 1.6);
    });
    it('neighbouring markers never overlap: minCell and stringGap >= 2*markerR + 8', () => {
      expect(m().minCell).toBeGreaterThanOrEqual(2 * m().markerR + 8);
      expect(m().stringGap).toBeGreaterThanOrEqual(2 * m().markerR + 8);
    });
    it('hit target is at least 44 x 44 and fits inside a cell', () => {
      expect(m().hitW).toBeGreaterThanOrEqual(44);
      expect(m().hitH).toBeGreaterThanOrEqual(44);
      expect(m().hitW).toBeLessThanOrEqual(m().minCell);
      expect(m().hitH).toBeLessThanOrEqual(m().stringGap);
    });
    it('fret numbers and nut names are at least 0.75 x the label size (sizes 1-2)', () => {
      if (s === 3) return;
      expect(m().fretNumPx).toBeGreaterThanOrEqual(m().labelPx * 0.75);
      expect(m().nutNamePx).toBeGreaterThanOrEqual(m().labelPx * 0.75);
    });
    it('at the largest size fret numbers and nut names are at least 24 px (tasks.md T103)', () => {
      if (s !== 3) return;
      expect(m().fretNumPx).toBeGreaterThanOrEqual(24);
      expect(m().nutNamePx).toBeGreaterThanOrEqual(24);
    });
    it('the name column fits a 2-glyph nut name at ~0.65em per glyph: nameW >= nutNamePx*1.3 + 4', () => {
      expect(m().nameW).toBeGreaterThanOrEqual(m().nutNamePx * 1.3 + 4);
    });
  });
});

describe('[T103][FR-048] Fretboard reads the text size from TextSizeContext', () => {
  const profile = presetById('guitar6-standard')!.profile;
  const markers: Marker[] = [{ pos: { string: 2, fret: 3 }, kind: 'tone', label: 'C♯', name: 'C sharp' }];
  const draw = (size?: 1 | 2 | 3) => {
    const board = <Fretboard profile={profile} from={0} to={5} markers={markers} handedness="right" spacing="uniform" label="Neck" />;
    return render(size === undefined ? board : <TextSizeContext.Provider value={size}>{board}</TextSizeContext.Provider>);
  };

  it.each(SIZES)('size %i: label, fret-number and nut-name font-size attributes equal the metrics', (s) => {
    const { container } = draw(s);
    const m = fretboardMetrics(s);
    expect(Number(container.querySelector('.fb-label')!.getAttribute('font-size'))).toBe(m.labelPx);
    expect(Number(container.querySelector('.fb-fretnum')!.getAttribute('font-size'))).toBe(m.fretNumPx);
    expect(Number(container.querySelector('.fb-nutname')!.getAttribute('font-size'))).toBe(m.nutNamePx);
  });

  it('size 3: the rendered marker label is at least 24 px', () => {
    const { container } = draw(3);
    expect(Number(container.querySelector('.fb-label')!.getAttribute('font-size'))).toBeGreaterThanOrEqual(24);
  });

  it.each(SIZES)('size %i: every .fb-hit rect is hitW x hitH', (s) => {
    const { container } = draw(s);
    const m = fretboardMetrics(s);
    const hits = [...container.querySelectorAll('.fb-hit')];
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(Number(h.getAttribute('width'))).toBe(m.hitW);
      expect(Number(h.getAttribute('height'))).toBe(m.hitH);
    }
  });

  it('without a provider the default is size 2', () => {
    const { container } = draw();
    expect(Number(container.querySelector('.fb-label')!.getAttribute('font-size'))).toBe(fretboardMetrics(2).labelPx);
  });
});

describe.each(['left', 'right'] as const)('[T103][FR-047][FR-048] %s-handed neck at text size 3: hit targets', (hand) => {
  describe.each(presets().map((p) => [p.presetId, p.profile] as const))('%s', (_id, profile) => {
    const draw = () => render(
      <TextSizeContext.Provider value={3}>
        <Fretboard profile={profile} from={0} to={Math.min(12, profile.fretCount)} markers={[]} handedness={hand} spacing="uniform" label="Neck" />
      </TextSizeContext.Provider>,
    );
    const rects = (c: HTMLElement) => [...c.querySelectorAll('.fb-hit')].map((r) => ({
      x: +r.getAttribute('x')!, y: +r.getAttribute('y')!, w: +r.getAttribute('width')!, h: +r.getAttribute('height')!,
      name: r.closest('[aria-label]')?.getAttribute('aria-label') ?? '?',
    }));

    it('every .fb-hit rect is at least 44 x 44', () => {
      const rs = rects(draw().container);
      expect(rs.length).toBe(profile.stringCount * (Math.min(12, profile.fretCount) + 1));
      for (const r of rs) { expect(r.w, r.name).toBeGreaterThanOrEqual(44); expect(r.h, r.name).toBeGreaterThanOrEqual(44); }
    });

    it('no two .fb-hit rects overlap, including the fret-0 column', () => {
      const rs = rects(draw().container);
      const eps = 0.01;
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i]!, b = rs[j]!;
        const overlap = a.x < b.x + b.w - eps && b.x < a.x + a.w - eps && a.y < b.y + b.h - eps && b.y < a.y + a.h - eps;
        expect(overlap, `${a.name} overlaps ${b.name}`).toBe(false);
      }
    });
  });
});
