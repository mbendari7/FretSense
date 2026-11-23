/**
 * T094 (red, test-first) [FR-032a, FR-047, FR-049]: the Fretboard component.
 * Uses only the existing FretboardProps. Expected values are read off spec.md:
 *  - FR-032a: "the open-string name of every string is always shown at the nut column ... spelled
 *    exactly as the instrument's open-string notes (FR-051)"; "fret-0 positions are full answer
 *    targets ... whenever fret 0 is in the visible window".
 *  - FR-049 name grammar: "String N, fret F" ("String N, open" for fret 0), then the note, then ...
 *  - FR-047: when the neck is wider than its area: a scroll cue at each clipped edge, a text
 *    indicator ("Open and frets 1–6 of 12", "Frets 7–12 of 12", "of N" = last fret of the current
 *    range) that is a plain text node, reachable by screen reader, not a live region; a "Jump to
 *    frets" group whose controls split the current range into contiguous segments labelled by first
 *    and last fret ("Open" for 0), accessible name "Frets <label>" (WCAG 2.5.3); selecting one
 *    scrolls its first fret next to the nut column; jump controls never depend on the answer.
 *
 * Test hooks this file expects T095 to provide (state these in the implementation):
 *  - each nut-column open-string name is an element with `data-nut-string="<string number>"` whose
 *    text is the name (♭/♯ glyphs or b/# both accepted);
 *  - each clipped-edge cue is an element with `data-scroll-cue="left"` or `data-scroll-cue="right"`
 *    (physical edge), present only while that edge is clipped.
 * Pixel checks (44 × 44 CSS px targets, 3:1 contrast, cue shape, nut-column position on the right
 * in left-handed view, one-row jump layout at the largest text size) are left to Playwright.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { presetById, presets, type InstrumentProfile } from '@fretsense/theory';
import { Fretboard, type FretboardProps, type Marker } from './Fretboard';
import { allPositions, installLayoutMock, isAriaHidden, isInLiveRegion, norm, positionEl } from '../__tests__/layout-mock';

/**
 * Open-string names per built-in preset, string 1 (highest) first. Source: the preset definitions of
 * FR-009 (standard tunings: guitar E A D G B E low→high; Drop D lowers string 6 to D; Eb tuning is
 * every string a half step down, spelled with flats as named "Eb (half step down)"; DADGAD; bass
 * E A D G; bass Drop D; 5-string B E A D G). Written out here, not read from the theory package.
 */
const OPEN_NAMES: Record<string, string[]> = {
  'guitar6-standard': ['E', 'B', 'G', 'D', 'A', 'E'],
  'guitar6-drop-d': ['E', 'B', 'G', 'D', 'A', 'D'],
  'guitar6-eb': ['Eb', 'Bb', 'Gb', 'Db', 'Ab', 'Eb'],
  'guitar6-dadgad': ['D', 'A', 'G', 'D', 'A', 'D'],
  'bass4-standard': ['G', 'D', 'A', 'E'],
  'bass4-drop-d': ['G', 'D', 'A', 'D'],
  'bass5-beadg': ['G', 'D', 'A', 'E', 'B'],
};
const ALL = presets().map((p) => [p.presetId, p.profile] as const);
const DASH = '–';
const LABEL = 'Test neck';

function board(profile: InstrumentProfile, from: number, to: number, extra: Partial<FretboardProps> = {}) {
  const onTap = vi.fn();
  const utils = render(
    <Fretboard profile={profile} from={from} to={to} markers={[]} handedness="right" spacing="uniform" label={LABEL} onTap={onTap} {...extra} />,
  );
  return { ...utils, onTap };
}
const area = () => screen.getByRole('group', { name: LABEL });

let restore: () => void;
beforeAll(() => { restore = installLayoutMock(); });
afterAll(() => restore());
afterEach(() => cleanup());

describe('FR-032a nut column shows every open-string name in the instrument spelling', () => {
  it('every built-in preset has an expected row in this table', () => {
    for (const [id] of ALL) expect(OPEN_NAMES[id], `missing expected open names for ${id}`).toBeDefined();
  });

  describe.each(ALL)('%s', (id, profile) => {
    it('frets 0–12: one nut label per string, spelled as the instrument', () => {
      const { container } = board(profile, 0, Math.min(12, profile.fretCount));
      const nut = [...container.querySelectorAll('[data-nut-string]')];
      expect(nut.length).toBe(profile.stringCount);
      for (let n = 1; n <= profile.stringCount; n++) {
        const el = container.querySelector(`[data-nut-string="${n}"]`);
        expect(el, `nut label for string ${n}`).toBeTruthy();
        expect(norm(el!.textContent)).toBe(OPEN_NAMES[id]![n - 1]);
      }
    });

    it('window 5–12: the nut labels are still shown (part of the instrument, not the answer)', () => {
      const { container } = board(profile, 5, 12);
      for (let n = 1; n <= profile.stringCount; n++) {
        expect(norm(container.querySelector(`[data-nut-string="${n}"]`)?.textContent)).toBe(OPEN_NAMES[id]![n - 1]);
      }
    });
  });
});

describe('FR-032a / FR-049 fret-0 positions are full targets named "String N, open"', () => {
  describe.each(ALL)('%s', (_id, profile) => {
    it('with fret 0 in the window, every string has a fret-0 button named exactly "String N, open"', () => {
      const { container } = board(profile, 0, 12);
      for (let n = 1; n <= profile.stringCount; n++) {
        const el = positionEl(container, n, 0);
        expect(el, `fret-0 target on string ${n}`).toBeTruthy();
        expect(el!.getAttribute('aria-label')).toBe(`String ${n}, open`);
        expect(el!.getAttribute('aria-disabled')).not.toBe('true');
      }
      expect(allPositions(container).some((el) => /fret 0\b/.test(el.getAttribute('aria-label')!))).toBe(false);
    });

    it('tapping and pressing Enter on a fret-0 target both answer it', () => {
      const { container, onTap } = board(profile, 0, 12);
      const low = profile.stringCount;
      expect(positionEl(container, low, 0), `no target named "String ${low}, open"`).toBeTruthy();
      expect(positionEl(container, 1, 0), 'no target named "String 1, open"').toBeTruthy();
      fireEvent.click(positionEl(container, low, 0)!);
      expect(onTap).toHaveBeenLastCalledWith({ string: low, fret: 0 });
      fireEvent.keyDown(positionEl(container, 1, 0)!, { key: 'Enter' });
      expect(onTap).toHaveBeenLastCalledWith({ string: 1, fret: 0 });
    });

    it('fretted positions keep "String N, fret F"', () => {
      const { container } = board(profile, 0, 12);
      expect(positionEl(container, 1, 5)?.getAttribute('aria-label')).toBe('String 1, fret 5');
    });

    it('with the window starting above fret 0, there are no fret-0 targets', () => {
      const { container } = board(profile, 3, 12);
      expect(allPositions(container).some((el) => /, open\b/.test(el.getAttribute('aria-label')!))).toBe(false);
    });
  });
});

describe('FR-047 nothing extra when the neck fits its area', () => {
  it('frets 0–3 fit in 390 px: no cue, no range indicator, no "Jump to frets" group', () => {
    const { container } = board(presetById('guitar6-standard')!.profile, 0, 3);
    expect(container.querySelector('[data-scroll-cue]')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Jump to frets' })).toBeNull();
    expect(screen.queryByText(/ of 3$/)).toBeNull();
  });
});

/** Parses a jump label ("Open–6", "7–12", "Open", "12") into [first, last]. */
function parseLabel(label: string): [number, number] {
  const f = (s: string) => (s === 'Open' ? 0 : Number(s));
  const parts = label.split(DASH);
  return [f(parts[0]!), f(parts[parts.length - 1]!)];
}
function jumpButtons() {
  const group = screen.getByRole('group', { name: 'Jump to frets' });
  return within(group).getAllByRole('button');
}

describe('FR-047 "Jump to frets" group', () => {
  describe.each(ALL)('%s, frets 0–12 at 390 px', (_id, profile) => {
    it('is a group with the visible label "Jump to frets"', () => {
      board(profile, 0, 12);
      const group = screen.getByRole('group', { name: 'Jump to frets' });
      const visible = screen.getByText('Jump to frets');
      expect(isAriaHidden(visible)).toBe(false);
      expect(group.contains(visible) || group.getAttribute('aria-labelledby') === visible.id).toBe(true);
    });

    it('controls cover 0–12 in contiguous segments, first is "Open–…", last ends at 12', () => {
      board(profile, 0, 12);
      const btns = jumpButtons();
      expect(btns.length).toBeGreaterThanOrEqual(2);
      const segs = btns.map((b) => parseLabel((b.textContent ?? '').trim()));
      expect(norm(btns[0]!.textContent).startsWith(`Open${DASH}`)).toBe(true);
      expect(segs[0]![0]).toBe(0);
      expect(segs[segs.length - 1]![1]).toBe(12);
      for (let i = 1; i < segs.length; i++) expect(segs[i]![0]).toBe(segs[i - 1]![1] + 1);
    });

    it('WCAG 2.5.3: each accessible name is "Frets " + the visible label', () => {
      board(profile, 0, 12);
      for (const b of jumpButtons()) {
        const visible = (b.textContent ?? '').trim();
        expect(b.getAttribute('aria-label') ?? visible).toBe(`Frets ${visible}`);
        expect(screen.getByRole('button', { name: `Frets ${visible}` })).toBe(b);
      }
    });
  });

  it('window 5–17 on a 22-fret guitar: segments of that window only, no "Open"', () => {
    board(presetById('guitar6-standard')!.profile, 5, 17);
    const labels = jumpButtons().map((b) => (b.textContent ?? '').trim());
    expect(labels.some((l) => l.includes('Open'))).toBe(false);
    expect(parseLabel(labels[0]!)[0]).toBe(5);
    expect(parseLabel(labels[labels.length - 1]!)[1]).toBe(17);
  });

  it('selecting a later segment scrolls its first fret next to the nut column; "Open–…" scrolls back', () => {
    board(presetById('guitar6-standard')!.profile, 0, 12);
    const btns = jumpButtons();
    const second = btns[1]!;
    const k = parseLabel((second.textContent ?? '').trim())[0];
    fireEvent.click(second);
    expect(area().scrollLeft).toBeGreaterThan(0);
    fireEvent.scroll(area());
    expect(norm(screen.getByText(/ of 12$/).textContent).startsWith(`Open and frets ${k}${DASH}`)).toBe(true);
    fireEvent.click(btns[0]!);
    expect(area().scrollLeft).toBe(0);
  });

  it('never depends on the answer: same controls with and without revealed answer markers', () => {
    const profile = presetById('guitar6-standard')!.profile;
    board(profile, 0, 12);
    const before = jumpButtons().map((b) => b.textContent);
    cleanup();
    const markers: Marker[] = [10, 11, 12].map((f) => ({ pos: { string: 6, fret: f }, kind: 'revealed', label: 'D', name: 'answer' }));
    board(profile, 0, 12, { markers });
    expect(jumpButtons().map((b) => b.textContent)).toEqual(before);
  });
});

describe('FR-047 range indicator', () => {
  it('frets 0–12 at scroll 0: "Open and frets 1–N of 12", a plain text node, not a live region', () => {
    board(presetById('guitar6-standard')!.profile, 0, 12);
    const el = screen.getByText(new RegExp(`^Open and frets 1${DASH}\\d+ of 12$`));
    expect(isInLiveRegion(el)).toBe(false);
    expect(isAriaHidden(el)).toBe(false);
    expect(el.getAttribute('aria-live')).toBeNull();
  });

  it('updates as the area scrolls: at the far end "Open and frets K–12 of 12" (fret 0 stays in view in the nut column)', () => {
    board(presetById('guitar6-standard')!.profile, 0, 12);
    const a = area();
    a.scrollLeft = 100000;
    fireEvent.scroll(a);
    const text = norm(screen.getByText(/ of 12$/).textContent);
    const m = new RegExp(`^Open and frets (\\d+)${DASH}12 of 12$`).exec(text);
    expect(m, text).toBeTruthy();
    expect(Number(m![1])).toBeGreaterThan(1);
  });

  it('window 5–17: "Frets 5–N of 17" ("of N" is the range end, fret 0 is not in the range)', () => {
    board(presetById('guitar6-standard')!.profile, 5, 17);
    expect(screen.getByText(new RegExp(`^Frets 5${DASH}\\d+ of 17$`))).toBeTruthy();
  });

  it('left-handed view also shows the indicator and the jump group', () => {
    board(presetById('bass4-standard')!.profile, 0, 12, { handedness: 'left' });
    expect(screen.getByText(/^Open and frets .* of 12$/)).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Jump to frets' })).toBeTruthy();
  });
});

describe('FR-047 clipped-edge scroll cue (right-handed)', () => {
  it('at scroll 0 only the right edge is clipped', () => {
    const { container } = board(presetById('guitar6-standard')!.profile, 0, 12);
    expect(container.querySelector('[data-scroll-cue="right"]')).toBeTruthy();
    expect(container.querySelector('[data-scroll-cue="left"]')).toBeNull();
  });

  it('scrolled to the far end only the left edge is clipped', () => {
    const { container } = board(presetById('guitar6-standard')!.profile, 0, 12);
    const a = area();
    a.scrollLeft = 100000;
    fireEvent.scroll(a);
    expect(container.querySelector('[data-scroll-cue="left"]')).toBeTruthy();
    expect(container.querySelector('[data-scroll-cue="right"]')).toBeNull();
  });

  it('scrolled to the middle both edges are clipped', () => {
    const { container } = board(presetById('guitar6-standard')!.profile, 0, 22);
    const a = area();
    a.scrollLeft = Math.floor((a.scrollWidth - a.clientWidth) / 2);
    fireEvent.scroll(a);
    expect(container.querySelector('[data-scroll-cue="left"]')).toBeTruthy();
    expect(container.querySelector('[data-scroll-cue="right"]')).toBeTruthy();
  });
});
