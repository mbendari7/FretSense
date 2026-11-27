/**
 * Phase 12 Convergence, tokens and contrast (red, test-first): T101-T106 [FR-048, FR-013, FR-049].
 * Source of every threshold: WCAG 2.2 (1.4.3 text 4.5:1, 1.4.11 non-text 3:1, 2.4.13/1.4.11 focus
 * indicator 3:1). Ratios are computed by the independent helper in __tests__/css-parse.ts from the
 * WCAG relative-luminance formula, from the CSS text on disk (the implementation is never imported to
 * compute an expectation). Contract: the implementer's token and rule names are listed in the task brief.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { presetById } from '@fretsense/theory';
import { Fretboard, type Marker } from './fretboard/Fretboard';
import {
  RULES, borderColorOf, contrast, definedInRoot, lastDecl, over, parseColor, redefinedInDark, resolve, rulesFor, tokenContrast, tokenValue, varName, type Theme,
} from './__tests__/css-parse';

const THEMES: Theme[] = ['light', 'dark'];
afterEach(cleanup);

const KINDS = [
  { kind: 'tone', ink: '--mk-ink-light' },
  { kind: 'root', ink: '--mk-ink-light' },
  { kind: 'reference', ink: '--mk-ink-dark' },
  { kind: 'correct', ink: '--mk-ink-dark' },
  { kind: 'incorrect', ink: '--mk-ink-dark' },
] as const;

describe('[T101][FR-048][FR-013] marker labels meet 4.5:1 against their marker fill', () => {
  it('the neck-fixed label inks exist only in :root (never re-themed)', () => {
    for (const t of ['--mk-ink-light', '--mk-ink-dark', '--neck-ink', '--focus-on-dark']) {
      expect(definedInRoot(t), `${t} defined in :root`).toBe(true);
      expect(redefinedInDark(t), `${t} must not be redefined for dark`).toBe(false);
    }
  });

  describe.each(THEMES)('%s theme', (theme) => {
    it.each(KINDS.map((k) => [k.kind] as const))('marker kind %s: label fill vs marker fill >= 4.5', (kind) => {
      const labelFill = lastDecl(`.m-${kind} .fb-label`, 'fill');
      expect(labelFill, `rule ".m-${kind} .fb-label { fill }" is missing`).toBeDefined();
      expect(String(varName(labelFill)), 'label fill must be a --mk-ink-* token').toMatch(/^--mk-ink-(light|dark)$/);
      const markerFill = lastDecl(`.mk-${kind}`, 'fill');
      expect(markerFill, `.mk-${kind} fill`).toBeDefined();
      const ratio = contrast(resolve(labelFill!, theme), resolve(markerFill!, theme));
      expect(ratio, `${kind}: ${labelFill} on ${markerFill} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    });

    it.each([['ok'], ['bad']] as const)('.feedback.%s .fb-icon colour vs background >= 4.5', (state) => {
      const sel = `.feedback.${state} .fb-icon`;
      const fg = lastDecl(sel, 'color');
      const bg = lastDecl(sel, 'background');
      expect(fg, `${sel} color`).toBeDefined();
      expect(bg, `${sel} background`).toBeDefined();
      const ratio = contrast(resolve(fg!, theme), resolve(bg!, theme));
      expect(ratio, `${sel}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('meaning unchanged: each marker kind keeps its own shape (root rotated rect, reference/incorrect rects, correct/tone circles)', () => {
    const profile = presetById('guitar6-standard')!.profile;
    const markers: Marker[] = (['tone', 'root', 'reference', 'correct', 'incorrect'] as const).map((kind, i) => ({
      pos: { string: 1 + i, fret: 3 }, kind, label: 'C', name: kind,
    }));
    const { container } = render(<Fretboard profile={profile} from={0} to={5} markers={markers} handedness="right" spacing="uniform" label="Shapes" />);
    const shape = (k: string) => container.querySelector(`.mk-${k}`)!;
    expect(shape('root').tagName.toLowerCase()).toBe('rect');
    expect(shape('root').getAttribute('transform') ?? '').toMatch(/rotate\(45/);
    expect(shape('reference').tagName.toLowerCase()).toBe('rect');
    expect(shape('reference').getAttribute('transform')).toBeNull();
    expect(shape('incorrect').tagName.toLowerCase()).toBe('rect');
    expect(shape('correct').tagName.toLowerCase()).toBe('circle');
    expect(shape('tone').tagName.toLowerCase()).toBe('circle');
    expect(lastDecl('.mk-incorrect', 'stroke-dasharray'), 'incorrect stays dashed').toBeTruthy();
    expect(lastDecl('.mk-correct', 'stroke-dasharray')).toBeUndefined();
  });
});

describe('[T102][FR-048] labels drawn on the neck (revealed, outline) meet 4.5:1', () => {
  it.each([['.m-revealed .fb-label'], ['.m-outline .fb-label']])('%s: last matching rule fills with --neck-ink, never --ink', (sel) => {
    const rs = rulesFor(sel, 'fill');
    expect(rs.length).toBeGreaterThan(0);
    const last = rs[rs.length - 1]!.decls.get('fill')!;
    expect(last.trim()).toBe('var(--neck-ink)');
    for (const r of rs) expect(r.decls.get('fill'), 'no rule may use --ink for this label').not.toContain('--ink)');
  });

  it('no other later rule (any selector in the file) re-fills these labels differently', () => {
    // the old "review fixes" override `.m-revealed .fb-label, .m-outline .fb-label { fill: var(--ink) }`
    const all = rulesFor('.m-revealed .fb-label', 'fill').concat(rulesFor('.m-outline .fb-label', 'fill'));
    expect(all.every((r) => r.decls.get('fill') === 'var(--pearl)' || r.decls.get('fill') === 'var(--neck-ink)')).toBe(true);
  });

  describe.each(THEMES)('%s theme', (theme) => {
    it('--neck-ink vs --wood >= 4.5', () => {
      const r = tokenContrast('--neck-ink', '--wood', theme);
      expect(r, r.toFixed(2)).toBeGreaterThanOrEqual(4.5);
    });
    it('--neck-ink vs the revealed tint (--m-reveal at alpha 0.28 composited over --wood) >= 4.5', () => {
      const m = parseColor(tokenValue('--m-reveal', theme));
      const tint = over([m[0], m[1], m[2], 0.28], parseColor(tokenValue('--wood', theme)));
      const r = contrast(tokenValue('--neck-ink', theme), tint);
      expect(r, r.toFixed(2)).toBeGreaterThanOrEqual(4.5);
    });
  });
});

describe('[T104][FR-049][FR-048] focus indicator meets 3:1', () => {
  describe.each(THEMES)('%s theme', (theme) => {
    it.each([['--paper'], ['--surface']])('--focus vs %s >= 3', (bg) => {
      expect(definedInRoot('--focus')).toBe(true);
      const r = tokenContrast('--focus', bg, theme);
      expect(r, r.toFixed(2)).toBeGreaterThanOrEqual(3);
    });
  });
  it.each([['--wood'], ['--slate']])('--focus-on-dark vs %s (light-theme value) >= 3', (bg) => {
    const r = tokenContrast('--focus-on-dark', bg, 'light');
    expect(r, r.toFixed(2)).toBeGreaterThanOrEqual(3);
  });
  it('page focus ring uses --focus', () => {
    const v = (lastDecl(':focus-visible', 'outline') ?? '') + (lastDecl(':focus-visible', 'outline-color') ?? '');
    expect(v).toContain('var(--focus)');
  });
  it('.topbar :focus-visible uses --focus-on-dark', () => {
    const v = (lastDecl('.topbar :focus-visible', 'outline') ?? '') + (lastDecl('.topbar :focus-visible', 'outline-color') ?? '');
    expect(v, 'rule ".topbar :focus-visible" missing').toContain('var(--focus-on-dark)');
  });
  it('.fb-pos:focus-visible .fb-hit strokes with --focus-on-dark; .fb-open:focus-visible .fb-hit with --focus', () => {
    expect(lastDecl('.fb-pos:focus-visible .fb-hit', 'stroke')).toBe('var(--focus-on-dark)');
    expect(lastDecl('.fb-open:focus-visible .fb-hit', 'stroke'), 'rule for fret 0 on the surface-coloured open zone').toBe('var(--focus)');
  });
});

describe('[T105][FR-048] status text colours meet 4.5:1 in both themes', () => {
  describe.each(THEMES)('%s theme', (theme) => {
    it.each([['--danger-ink', '--paper'], ['--danger-ink', '--surface'], ['--ok-ink', '--paper'], ['--ok-ink', '--surface']])('%s on %s >= 4.5', (fg, bg) => {
      const r = tokenContrast(fg, bg, theme);
      expect(r, r.toFixed(2)).toBeGreaterThanOrEqual(4.5);
    });
  });
  it.each([
    ['.field-error', '--danger-ink'],
    ['button.danger', '--danger-ink'],
    ['.badge', '--ok-ink'],
    ['.progress-pill', '--ok-ink'],
    ['.steps li.correct', '--ok-ink'],
  ])('%s text colour is var(%s), not a raw hex or --m-ok', (sel, token) => {
    expect(lastDecl(sel, 'color')).toBe(`var(${token})`);
  });
});

describe('[T106][FR-048] control boundaries meet 3:1 non-text contrast', () => {
  describe.each(THEMES)('%s theme', (theme) => {
    it.each([['--paper'], ['--surface']])('--control-line vs %s >= 3', (bg) => {
      const r = tokenContrast('--control-line', bg, theme);
      expect(r, r.toFixed(2)).toBeGreaterThanOrEqual(3);
    });
  });
  it.each([
    ['button', 'buttons'],
    ['select', 'inputs and selects'],
    ['.segmented', 'segmented controls'],
  ])('%s border colour (%s) resolves to --control-line', (sel) => {
    expect(varName(borderColorOf(sel)), `border of "${sel}"`).toBe('--control-line');
  });
  it('button.danger border colour is --danger-ink', () => {
    expect(varName(borderColorOf('button.danger'))).toBe('--danger-ink');
  });
  it('the decorative --line token still exists', () => {
    expect(definedInRoot('--line')).toBe(true);
  });
});

describe('[T104][FR-049] selected-state outlines do not hide the focus ring', () => {
  it.each([[".root[aria-pressed='true']"], ['.wb-slot.now']])('%s:focus-visible sets outline-color var(--focus) and an outline-offset >= 2px', (sel) => {
    const f = `${sel}:focus-visible`;
    expect(lastDecl(f, 'outline-color'), `rule "${f}" missing`).toBe('var(--focus)');
    const off = lastDecl(f, 'outline-offset');
    expect(off, `${f} outline-offset`).toBeDefined();
    expect(parseFloat(off!)).toBeGreaterThanOrEqual(2);
    expect(off).toMatch(/px$/);
  });

  it('every .root / .wb-slot rule that sets an outline has a matching :focus-visible rule', () => {
    const outlined = RULES.filter((r) => !r.media && (r.decls.has('outline') || r.decls.has('outline-color')))
      .flatMap((r) => r.selectors).filter((s) => /\.(root|wb-slot)\b/.test(s) && !s.includes(':focus-visible'));
    expect(outlined.length).toBeGreaterThan(0);
    for (const s of outlined) expect(rulesFor(`${s}:focus-visible`, 'outline-color').length, `${s}:focus-visible`).toBeGreaterThan(0);
  });
});
