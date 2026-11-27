/**
 * Test-only helpers for Phase 12 (T101-T110): parse styles.css text from disk and compute WCAG 2.x
 * contrast (run from apps/web: the CSS path is cwd-relative). The colour maths is written here from the WCAG 2.x definitions (relative luminance,
 * contrast ratio = (L1 + 0.05) / (L2 + 0.05)); it never imports implementation code.
 */
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

export interface Rule { readonly selectors: readonly string[]; readonly decls: ReadonlyMap<string, string>; readonly media: boolean; readonly order: number }

const css = readFileSync(resolvePath(process.cwd(), 'src/ui/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
export const CSS_TEXT = css;

function parseBlock(text: string, media: boolean, out: Rule[]): void {
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const header = text.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < text.length && depth > 0) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
    const body = text.slice(open + 1, j - 1);
    if (header.startsWith('@')) parseBlock(body, true, out);
    else {
      const decls = new Map<string, string>();
      for (const d of body.split(';')) {
        const k = d.indexOf(':');
        if (k > 0) decls.set(d.slice(0, k).trim(), d.slice(k + 1).trim());
      }
      out.push({ selectors: header.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), decls, media, order: out.length });
    }
    i = j;
  }
}
export const RULES: Rule[] = [];
parseBlock(css, false, RULES);

/** All rules (outside @media) whose selector list contains exactly `selector`, in file order. */
export const rulesFor = (selector: string, prop?: string): Rule[] =>
  RULES.filter((r) => !r.media && r.selectors.includes(selector) && (!prop || r.decls.has(prop)));
/** Value of `prop` from the LAST rule for `selector` that declares it. */
export function lastDecl(selector: string, prop: string): string | undefined {
  const rs = rulesFor(selector, prop);
  return rs.length ? rs[rs.length - 1]!.decls.get(prop) : undefined;
}

export type Theme = 'light' | 'dark';
const rootDecls = (): Map<string, string> => {
  const m = new Map<string, string>();
  for (const r of rulesFor(':root')) for (const [k, v] of r.decls) if (k.startsWith('--')) m.set(k, v);
  return m;
};
const darkDecls = (): Map<string, string> => {
  const m = new Map<string, string>();
  for (const r of rulesFor(".shell[data-theme='dark']")) for (const [k, v] of r.decls) if (k.startsWith('--')) m.set(k, v);
  return m;
};
export const definedInRoot = (token: string) => rootDecls().has(token);
export const redefinedInDark = (token: string) => darkDecls().has(token) || RULES.some((r) => r.media && r.decls.has(token) && r.selectors.some((s) => s.includes('.shell')));

/** Resolves a token (e.g. '--paper') to a concrete colour string for the theme; dark falls back to light. */
export function tokenValue(token: string, theme: Theme): string {
  const m = new Map(rootDecls());
  if (theme === 'dark') for (const [k, v] of darkDecls()) m.set(k, v);
  let v = m.get(token);
  if (v === undefined) throw new Error(`token ${token} is not defined for the ${theme} theme`);
  for (let n = 0; n < 8; n++) {
    const ref = /^var\((--[a-z0-9-]+)\)$/.exec(v);
    if (!ref) break;
    v = m.get(ref[1]!);
    if (v === undefined) throw new Error(`token ${ref[1]} is not defined`);
  }
  return v;
}
/** Resolves a value that is exactly var(--x) (or a raw colour) in the theme. */
export function resolve(value: string, theme: Theme): string {
  const ref = /^var\((--[a-z0-9-]+)\)$/.exec(value.trim());
  return ref ? tokenValue(ref[1]!, theme) : value.trim();
}
export const varName = (value: string | undefined): string | undefined => /var\((--[a-z0-9-]+)\)/.exec(value ?? '')?.[1];

export type RGBA = readonly [number, number, number, number];
export function parseColor(c: string): RGBA {
  const s = c.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) { const h = m[1]!; return [parseInt(h[0]! + h[0]!, 16), parseInt(h[1]! + h[1]!, 16), parseInt(h[2]! + h[2]!, 16), 1]; }
  m = /^#([0-9a-f]{6})$/.exec(s);
  if (m) { const h = m[1]!; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1]; }
  const r = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?\s*\)$/.exec(s);
  if (r) return [+r[1]!, +r[2]!, +r[3]!, r[4] === undefined ? 1 : +r[4]];
  throw new Error(`cannot parse colour "${c}"`);
}
const lin = (u8: number) => { const c = u8 / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const luminance = (c: RGBA) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export function contrast(a: string | RGBA, b: string | RGBA): number {
  const la = luminance(typeof a === 'string' ? parseColor(a) : a);
  const lb = luminance(typeof b === 'string' ? parseColor(b) : b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** Source-over compositing in sRGB, per channel (as browsers do). */
export function over(fg: RGBA, bg: RGBA): RGBA {
  const a = fg[3];
  return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
}
/** Contrast between two tokens in a theme. */
export const tokenContrast = (a: string, b: string, theme: Theme) => contrast(tokenValue(a, theme), tokenValue(b, theme));
/** Border colour of a rule: `border-color`, else the colour part of the `border` shorthand. */
export function borderColorOf(selector: string): string | undefined {
  const rs = rulesFor(selector).filter((r) => r.decls.has('border-color') || (r.decls.has('border') && r.decls.get('border') !== 'none'));
  const r = rs[rs.length - 1];
  if (!r) return undefined;
  return r.decls.get('border-color') ?? r.decls.get('border');
}

/** CSS specificity [ids, classes/attributes/pseudo-classes, types] as a comparable number. */
export function specificity(selector: string): number {
  const sel = selector.replace(/::?[a-z-]+\(([^)]*)\)/gi, (m, arg: string) => (/^:(not|is|has)/i.test(m) ? ` ${arg} ` : ' :x '));
  const ids = (sel.match(/#[\w-]+/g) ?? []).length;
  const cls = (sel.match(/\.[\w-]+|\[[^\]]*\]|(?<!:):[a-z-]+/gi) ?? []).length;
  const types = (sel.replace(/\[[^\]]*\]/g, '').match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length;
  return ids * 10000 + cls * 100 + types;
}
/**
 * The value of `prop` that wins for an element matched by every selector in `selectors` (outside
 * @media): highest specificity, ties broken by later file order.
 */
export function winningDecl(selectors: readonly string[], prop: string): string | undefined {
  let best: { spec: number; order: number; value: string } | undefined;
  for (const r of RULES) {
    if (r.media || !r.decls.has(prop)) continue;
    for (const sel of r.selectors) {
      if (!selectors.includes(sel)) continue;
      const spec = specificity(sel);
      if (!best || spec > best.spec || (spec === best.spec && r.order > best.order)) best = { spec, order: r.order, value: r.decls.get(prop)! };
    }
  }
  return best?.value;
}
