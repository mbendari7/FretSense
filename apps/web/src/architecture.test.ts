/** T001 (deviation: dependency-cruiser not installed): layer rules enforced by regex on import specifiers. */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const SRC = resolve(__dirname);
const DOMAIN = join(SRC, 'domain');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p);
    return /\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts') ? [p] : [];
  });
}
const files = walk(SRC);
const layer = (f: string) => relative(SRC, f).split(sep)[0];
function specifiers(f: string): string[] {
  const text = readFileSync(f, 'utf8');
  const out: string[] = [];
  const re = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
  for (let m = re.exec(text); m; m = re.exec(text)) out.push(m[1]!);
  return out;
}
/** Layer a relative specifier lands in, or null for packages. */
function targetLayer(f: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  return relative(SRC, resolve(dirname(f), spec)).split(sep)[0] ?? null;
}
function violations(inLayer: string, forbidden: string[]): string[] {
  const bad: string[] = [];
  for (const f of files.filter((x) => layer(x) === inLayer))
    for (const s of specifiers(f)) {
      const t = targetLayer(f, s);
      if (t && forbidden.includes(t)) bad.push(`${relative(SRC, f)} -> ${s}`);
    }
  return bad;
}

describe('T001 layer rules', () => {
  it('scanner finds > 30 source files (tree has 42)', () => expect(files.length).toBeGreaterThan(30));
  it('domain never imports application, infrastructure or ui', () => expect(violations('domain', ['application', 'infrastructure', 'ui'])).toEqual([]));
  it('application never imports infrastructure or ui', () => expect(violations('application', ['infrastructure', 'ui']).filter((v) => !/(^|[\\/])__tests__[\\/]/.test(v))).toEqual([])); // test-support helpers under __tests__/ may wire a repository
  it('infrastructure never imports ui', () => expect(violations('infrastructure', ['ui'])).toEqual([]));
  // code-reviewer 016 Phase 1 #1: path aliases would bypass the relative-path checks above.
  it('no path-alias imports (@/ or ~) anywhere in src', () => {
    const bad = files.flatMap((f) => specifiers(f).filter((s) => s.startsWith('@/') || s.startsWith('~')).map((s) => `${relative(SRC, f)} -> ${s}`));
    expect(bad).toEqual([]);
  });
  it('domain imports no UI or browser packages (react, react-dom, react-router, idb)', () => {
    const banned = /^(react|react-dom|react-router|idb)(\/|$)/;
    const bad = files.filter((x) => layer(x) === 'domain').flatMap((f) => specifiers(f).filter((s) => banned.test(s)).map((s) => `${relative(SRC, f)} -> ${s}`));
    expect(bad).toEqual([]);
  });
  it('domain/personal imports only domain/, @fretsense/theory or zod', () => {
    const bad: string[] = [];
    const personal = join(DOMAIN, 'personal');
    for (const f of files.filter((x) => x.startsWith(personal + sep)))
      for (const s of specifiers(f)) {
        if (s === '@fretsense/theory' || s.startsWith('@fretsense/theory/') || s === 'zod') continue;
        if (s.startsWith('.') && (resolve(dirname(f), s) + sep).startsWith(DOMAIN + sep)) continue;
        bad.push(`${relative(SRC, f)} -> ${s}`);
      }
    expect(bad).toEqual([]);
  });
});

describe('T001 gate r1 layer rules [FR-018]', () => {
  it('(a) every file under src/domain imports only relative domain modules, zod and @fretsense/theory', () => {
    const bad: string[] = [];
    for (const f of files.filter((x) => layer(x) === 'domain'))
      for (const s of specifiers(f)) {
        if (s === 'zod' || s === '@fretsense/theory' || s.startsWith('@fretsense/theory/')) continue;
        if (s.startsWith('.') && (resolve(dirname(f), s) + sep).startsWith(DOMAIN + sep)) continue;
        bad.push(`${relative(SRC, f)} -> ${s}`);
      }
    expect(bad).toEqual([]);
  });
  it('(b) src/ui never imports src/infrastructure (test files excluded)', () => {
    // Test-support helpers under __tests__/ (e.g. the drill harness) are test code and may wire a memory repository.
    expect(violations('ui', ['infrastructure']).filter((v) => !/(^|[\\/])__tests__[\\/]/.test(v))).toEqual([]);
  });
  it('(c) packages/theory/src imports nothing outside the package (relative specifiers only, staying inside)', () => {
    const THEORY = resolve(SRC, '..', '..', '..', 'packages', 'theory', 'src');
    const theoryFiles = walk(THEORY);
    expect(theoryFiles.length).toBeGreaterThan(3);
    const bad: string[] = [];
    for (const f of theoryFiles)
      for (const s of specifiers(f)) {
        if (s.startsWith('.') && (resolve(dirname(f), s) + sep).startsWith(THEORY + sep)) continue;
        bad.push(`${relative(THEORY, f)} -> ${s}`);
      }
    expect(bad).toEqual([]);
  });
  it('(d) no non-test file outside __tests__/ imports a __tests__/ path (test support stays test-only)', () => {
    const inTests = (f: string) => /(^|[\/])__tests__[\/]/.test(relative(SRC, f));
    const bad: string[] = [];
    for (const f of files.filter((x) => !inTests(x)))
      for (const s of specifiers(f)) if (/(^|[\/])__tests__([\/]|$)/.test(s)) bad.push(`${relative(SRC, f)} -> ${s}`);
    expect(bad).toEqual([]);
  });
});
