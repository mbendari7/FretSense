/**
 * T051, T059, T067 (generator part): drill question generation and judging
 * [FR-030, FR-031, FR-035, FR-036, FR-041, FR-056, FR-057, FR-058, FR-061, SC-011].
 * Written test-after: the implementation already existed. Every expected position is recomputed
 * here by brute force from the profile's open strings (MIDI = 12·(octave + 1) + letter + accidental,
 * plus the fret), with interval sizes and chord-function offsets taken from standard theory tables
 * typed out below, never from the implementation.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { presetById, presets, validateProfile, type FretPosition, type InstrumentProfile, type Note } from '@fretsense/theory';
import { generateQuestions, intervalName, judgeTap, validateSettings } from './generate';
import { mulberry32 } from '../prng';
import { DrillSession } from './session';
import { DRILL_LABELS, type DrillSettings, type Question } from './types';

// ---------- independent reference helpers ----------
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
/** String 1 is the highest pitched (FR-008): it is the last entry of the low → high tuning. */
const openMidi = (p: InstrumentProfile, s: number) => noteMidi(p.tuning[p.stringCount - s]!);
const posMidi = (p: InstrumentProfile, pos: FretPosition) => openMidi(p, pos.string) + pos.fret;
const pcOf = (m: number) => ((m % 12) + 12) % 12;
const SEMITONES: Record<string, number> = { m2: 1, M2: 2, m3: 3, M3: 4, P4: 5, A4: 6, d5: 6, P5: 7, m6: 8, M6: 9, m7: 10, M7: 11, P8: 12 };
const FN_SEMITONES: Record<string, number> = { R: 0, b3: 3, '3': 4, '5': 7, b7: 10, '7': 11 };
const QUALITY_FNS: Record<string, string[]> = { major: ['R', '3', '5'], minor: ['R', 'b3', '5'], dom7: ['R', '3', '5', 'b7'], maj7: ['R', '3', '5', '7'], min7: ['R', 'b3', '5', 'b7'] };
const ROOT_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const key = (p: FretPosition) => `${p.string}:${p.fret}`;
const sortPos = (xs: readonly FretPosition[]) => [...xs].map(key).sort();

function brute(p: InstrumentProfile, strings: readonly number[], from: number, to: number, test: (m: number) => boolean): FretPosition[] {
  const out: FretPosition[] = [];
  for (const s of strings) {
    if (s < 1 || s > p.stringCount) continue;
    for (let f = Math.max(0, from); f <= Math.min(to, p.fretCount); f++) if (test(openMidi(p, s) + f)) out.push({ string: s, fret: f });
  }
  return out;
}

// ---------- instruments: all 7 presets plus generated valid profiles (FR-061, SC-011) ----------
const SHARP: [string, -1 | 0 | 1][] = [['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]];
const toNote = (m: number): Note => {
  const [letter, accidental] = SHARP[pcOf(m)]!;
  return { letter: letter as Note['letter'], accidental, octave: Math.floor(m / 12) - 1 };
};
const RANGES = { guitar: { lo: 28, hi: 64, min: 6, max: 8 }, bass: { lo: 21, hi: 48, min: 4, max: 6 } } as const; // FR-053: guitar E1–E4, bass A0–C3

const generatedProfile: fc.Arbitrary<InstrumentProfile> = fc
  .constantFrom('guitar' as const, 'bass' as const)
  .chain((family) => {
    const r = RANGES[family];
    return fc.record({
      family: fc.constant(family),
      n: fc.integer({ min: r.min, max: r.max }),
      low: fc.integer({ min: r.lo, max: r.lo + 8 }),
      steps: fc.array(fc.integer({ min: 1, max: 7 }), { minLength: 7, maxLength: 7 }),
      frets: fc.integer({ min: 12, max: 24 }),
    });
  })
  .map(({ family, n, low, steps, frets }) => {
    const ms = [low];
    for (let i = 1; i < n; i++) ms.push(ms[i - 1]! + steps[i - 1]!);
    return validateProfile({ family, tuning: ms.map(toNote), fretCount: frets });
  })
  .filter((r) => r.ok)
  .map((r) => (r as { ok: true; value: InstrumentProfile }).value);

const PRESET_PROFILES = presets().map((p) => p.profile);
const anyProfile = fc.oneof(fc.constantFrom(...PRESET_PROFILES), generatedProfile);

const rangeFor = (p: InstrumentProfile) =>
  fc.record({
    strings: fc.subarray(Array.from({ length: p.stringCount }, (_, i) => i + 1), { minLength: 1 }),
    a: fc.integer({ min: 0, max: p.fretCount }),
    b: fc.integer({ min: 0, max: p.fretCount }),
    seed: fc.integer({ min: 0, max: 0xffffffff }),
    count: fc.integer({ min: 5, max: 8 }),
  });

function gen(p: InstrumentProfile, s: DrillSettings, seed = 1, adaptive = false): Question[] {
  const r = generateQuestions({ profile: p, settings: s, rng: mulberry32(seed), histories: new Map(), adaptive });
  if (!r.ok) throw new Error(r.reason);
  return r.questions;
}
/** Searches seeds 1..50 for a generated question matching pred (generation is random). */
function findQ(p: InstrumentProfile, s: DrillSettings, pred: (q: Question) => boolean): Question | undefined {
  for (let seed = 1; seed <= 50; seed++) {
    const q = gen(p, s, seed).find(pred);
    if (q) return q;
  }
  return undefined;
}
const base = (type: DrillSettings['type'], p: InstrumentProfile, over: Partial<DrillSettings> = {}): DrillSettings => ({
  type, strings: Array.from({ length: p.stringCount }, (_, i) => i + 1), fromFret: 0, toFret: Math.min(12, p.fretCount), count: 20, octaveMode: 'any', ...over,
});

const std6 = presetById('guitar6-standard')!.profile;
const bass4 = presetById('bass4-standard')!.profile;
const bass5 = presetById('bass5-beadg')!.profile;
const dropD = presetById('guitar6-drop-d')!.profile;

// =============================================================================================
describe('FR-061 / SC-011 note-finding: every question answerable, over presets and generated instruments', () => {
  it('property', () => {
    fc.assert(
      fc.property(
        anyProfile.chain((p) => fc.tuple(fc.constant(p), rangeFor(p), fc.subarray([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], { minLength: 1 }), fc.boolean())),
        ([p, r, notes, exact]) => {
          const from = Math.min(r.a, r.b);
          const to = Math.max(r.a, r.b);
          const s: DrillSettings = { type: 'note-finding', strings: r.strings, fromFret: from, toFret: to, count: r.count, octaveMode: exact ? 'exact' : 'any', notes };
          const answerable = r.strings.some((str) => brute(p, [str], from, to, (m) => notes.includes(pcOf(m))).length > 0);
          const v = validateSettings(p, s);
          expect(v.ok).toBe(answerable); // rejected exactly when no question is possible
          if (!v.ok) {
            expect(v.reason.length).toBeGreaterThan(0);
            return;
          }
          const qs = gen(p, s, r.seed);
          expect(qs).toHaveLength(r.count);
          for (const q of qs) {
            expect(q.prompt.drillType).toBe('note-finding');
            if (q.prompt.drillType !== 'note-finding') continue;
            const str = q.promptedString!;
            expect(r.strings).toContain(str);
            expect(notes).toContain(q.prompt.pitchClass);
            expect(q.steps).toHaveLength(1);
            const valid = q.steps[0]!.valid;
            expect(valid.length).toBeGreaterThan(0);
            for (const v2 of valid) {
              expect(v2.string).toBe(str);
              expect(v2.fret).toBeGreaterThanOrEqual(from);
              expect(v2.fret).toBeLessThanOrEqual(to);
              expect(pcOf(posMidi(p, v2))).toBe(q.prompt.pitchClass);
            }
            if (exact) {
              expect(q.prompt.midi).not.toBeNull();
              expect(valid).toHaveLength(1);
              expect(posMidi(p, valid[0]!)).toBe(q.prompt.midi);
            } else {
              const targetPc = q.prompt.pitchClass; // narrowed above; closures lose the narrowing
              expect(sortPos(valid)).toEqual(sortPos(brute(p, [str], from, to, (m) => pcOf(m) === targetPc)));
            }
            expect(q.text).not.toMatch(/\b(Cb|Fb|E#|B#)/); // FR-031: never prompted
            expect(q.itemKey).toBe(`nf|${p.geometryId}|${str}|${q.prompt.pitchClass}`);
          }
        },
      ),
      { numRuns: 150 },
    );
  });
});

describe('FR-030 / FR-031 note-finding behaviour', () => {
  it('US3-5: naturals only, strings 1–3, frets 0–5 → every prompt satisfies all three and is answerable', () => {
    const naturals = [0, 2, 4, 5, 7, 9, 11];
    const qs = gen(std6, base('note-finding', std6, { strings: [1, 2, 3], fromFret: 0, toFret: 5, notes: naturals, count: 100 }), 42);
    for (const q of qs) {
      expect([1, 2, 3]).toContain(q.promptedString);
      if (q.prompt.drillType === 'note-finding') expect(naturals).toContain(q.prompt.pitchClass);
      expect(q.steps[0]!.valid.length).toBeGreaterThan(0);
      for (const v of q.steps[0]!.valid) expect(v.fret).toBeLessThanOrEqual(5);
    }
  });

  it('US3-3: the judge accepts only the prompted string (same pitch on another string is not correct)', () => {
    const [q] = gen(std6, base('note-finding', std6, { strings: [6], notes: [7], count: 5 }));
    // G on string 6 (low E, E2 = MIDI 40) is fret 3 (G2) and fret 15 (G3). String 4 fret 5 is G3 on another string.
    expect(judgeTap(q!, 0, { string: 6, fret: 3 })).toBe(true);
    expect(judgeTap(q!, 0, { string: 4, fret: 5 })).toBe(false); // G3, wrong string
    expect(judgeTap(q!, 0, { string: 6, fret: 4 })).toBe(false); // G#
  });

  it('US3-6: exact octave, "Find G3 on string 5": only fret 10 is correct, fret 22 (G4) is not; any octave accepts both', () => {
    // String 5 is A2 = MIDI 45; G3 = 55 → fret 10; G4 = 67 → fret 22 (22-fret preset).
    const s = base('note-finding', std6, { strings: [5], notes: [7], fromFret: 0, toFret: 22, octaveMode: 'exact', count: 40 });
    const qs = gen(std6, s, 7);
    const g3 = qs.find((q) => q.prompt.drillType === 'note-finding' && q.prompt.midi === 55);
    expect(g3).toBeDefined();
    expect(judgeTap(g3!, 0, { string: 5, fret: 10 })).toBe(true);
    expect(judgeTap(g3!, 0, { string: 5, fret: 22 })).toBe(false);
    expect(g3!.text).toContain('G3');
    const [any] = gen(std6, { ...s, octaveMode: 'any' }, 7);
    expect(judgeTap(any!, 0, { string: 5, fret: 10 })).toBe(true);
    expect(judgeTap(any!, 0, { string: 5, fret: 22 })).toBe(true);
  });

  it('US3-9: 5-string BEADG exact octave "Find E1 on string 5": only fret 5, not fret 17 (E2)', () => {
    // String 5 is B0 = MIDI 23; E1 = 28 → fret 5; E2 = 40 → fret 17 (20 frets).
    const qs = gen(bass5, base('note-finding', bass5, { strings: [5], notes: [4], fromFret: 0, toFret: 20, octaveMode: 'exact', count: 40 }), 3);
    const e1 = qs.find((q) => q.prompt.drillType === 'note-finding' && q.prompt.midi === 28);
    expect(e1).toBeDefined();
    expect(judgeTap(e1!, 0, { string: 5, fret: 5 })).toBe(true);
    expect(judgeTap(e1!, 0, { string: 5, fret: 17 })).toBe(false);
  });

  it.each([
    // FR-030 examples. Punctuation is not pinned ("string 6, low E" or "string 6 (low E)"); the words are.
    // "low"/"high" mark the instrument's lowest- and highest-pitched strings, and no others.
    ['6-string Standard, string 6', std6, 6, /string 6[,( ]+low E\b/],
    ['6-string Standard, string 1', std6, 1, /string 1[,( ]+high E\b/],
    ['5-string BEADG, string 5', bass5, 5, /string 5[,( ]+low B\b/],
    ['Drop D guitar, string 4 (neither lowest nor highest)', dropD, 4, /string 4[,( ]+D\b/],
  ] as const)('FR-030 prompt names the string by number, open note and low/high: %s', (_l, p, str, re) => {
    const [q] = gen(p, base('note-finding', p, { strings: [str], notes: [7], count: 5 }));
    expect(q!.text).toMatch(re);
  });

});

describe('FR-061 unanswerable settings are rejected before the drill starts, with a reason', () => {
  it.each([
    ['no strings', base('note-finding', std6, { strings: [] })],
    ['a string the instrument does not have', base('note-finding', std6, { strings: [7] })],
    ['F on string 1 at fret 0 only (string 1 is E)', base('note-finding', std6, { strings: [1], fromFret: 0, toFret: 0, notes: [5] })],
    ['an octave up on one string within 5 frets', base('interval', std6, { strings: [1], fromFret: 0, toFret: 5, intervals: ['P8'], direction: 'up' })],
    // FR-056: the 5th is 7 semitones above the root, so on one string it is 7 frets away; frets 0–3 can never hold it.
    ['a root–fifth–octave inside frets 0–3 of one string', base('root-fifth-octave', bass4, { strings: [1], fromFret: 0, toFret: 3 })],
    ['count 4', base('note-finding', std6, { count: 4 })],
    ['count 101', base('note-finding', std6, { count: 101 })],
  ])('%s', (_l, s) => {
    const prof = s.type === 'root-fifth-octave' ? bass4 : std6;
    const v = validateSettings(prof, s);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason.length).toBeGreaterThan(5);
    const g = generateQuestions({ profile: prof, settings: s, rng: mulberry32(1), histories: new Map(), adaptive: false });
    expect(g.ok).toBe(false);
  });

  it('count bounds 5 and 100 are accepted (FR-031)', () => {
    expect(validateSettings(std6, base('note-finding', std6, { count: 5 })).ok).toBe(true);
    expect(validateSettings(std6, base('note-finding', std6, { count: 100 })).ok).toBe(true);
  });
});

// =============================================================================================
const ALL_INTERVALS = Object.keys(SEMITONES);

describe('FR-061 / FR-035 interval drill: exact target pitch, every question answerable', () => {
  it('property: valid answers are exactly the positions sounding ref ± interval in the allowed area', () => {
    fc.assert(
      fc.property(
        anyProfile.chain((p) => fc.tuple(fc.constant(p), rangeFor(p), fc.subarray(ALL_INTERVALS, { minLength: 1 }), fc.constantFrom('up' as const, 'down' as const, 'both' as const))),
        ([p, r, ivs, dir]) => {
          const from = Math.min(r.a, r.b);
          const to = Math.max(r.a, r.b);
          const s: DrillSettings = { type: 'interval', strings: r.strings, fromFret: from, toFret: to, count: r.count, octaveMode: 'any', intervals: ivs, direction: dir };
          const dirs = dir === 'both' ? ['up', 'down'] : [dir];
          const area = brute(p, r.strings, from, to, () => true);
          const answerable = ivs.some((iv) => dirs.some((d) => area.some((ref) => {
            const t = posMidi(p, ref) + (d === 'up' ? 1 : -1) * SEMITONES[iv]!;
            return area.some((x) => posMidi(p, x) === t);
          })));
          const v = validateSettings(p, s);
          expect(v.ok).toBe(answerable);
          if (!v.ok) return;
          for (const q of gen(p, s, r.seed)) {
            const [, name, d] = q.itemKey.split('|');
            expect(ivs).toContain(name);
            expect(dirs).toContain(d);
            const ref = q.reference[0]!;
            expect(r.strings).toContain(ref.string);
            expect(ref.fret).toBeGreaterThanOrEqual(from);
            expect(ref.fret).toBeLessThanOrEqual(to);
            const target = posMidi(p, ref) + (d === 'up' ? 1 : -1) * SEMITONES[name!]!;
            const valid = q.steps[0]!.valid;
            expect(valid.length).toBeGreaterThan(0);
            expect(sortPos(valid)).toEqual(sortPos(brute(p, r.strings, from, to, (m) => m === target)));
          }
        },
      ),
      { numRuns: 150 },
    );
  });

  it('US4-1: reference C3 at string 5 fret 3, M3 up → every E3 position, and only E3', () => {
    const q = findQ(std6, base('interval', std6, { intervals: ['M3'], direction: 'up', count: 100 }), (x) => x.reference[0]!.string === 5 && x.reference[0]!.fret === 3);
    expect(q).toBeDefined();
    // E3 = MIDI 52: string 6 fret 12, string 5 fret 7, string 4 fret 2.
    expect(sortPos(q!.steps[0]!.valid)).toEqual(['4:2', '5:7', '6:12']);
    expect(judgeTap(q!, 0, { string: 2, fret: 5 })).toBe(false); // E4: right letter, wrong octave
  });

  it('US4-2: with the set {m3, M3, P5} only those intervals are asked', () => {
    for (const q of gen(std6, base('interval', std6, { intervals: ['m3', 'M3', 'P5'], direction: 'both', count: 100 }), 5)) {
      expect(['m3', 'M3', 'P5']).toContain(q.itemKey.split('|')[1]);
    }
  });

  it('direction "down" asks only downward intervals', () => {
    for (const q of gen(std6, base('interval', std6, { intervals: ['P5'], direction: 'down', count: 30 }), 5)) {
      expect(q.itemKey).toBe('iv|P5|down');
      expect(posMidi(std6, q.steps[0]!.valid[0]!)).toBe(posMidi(std6, q.reference[0]!) - 7);
    }
  });

  it('FR-035 defaults when the settings omit them: {M2, m3, M3, P4, P5, P8}, direction up', () => {
    const { intervals: _i, direction: _d, ...rest } = base('interval', std6, { count: 100 });
    const seen = new Set(gen(std6, rest as DrillSettings, 9).map((q) => q.itemKey));
    for (const k of seen) expect(['iv|M2|up', 'iv|m3|up', 'iv|M3|up', 'iv|P4|up', 'iv|P5|up', 'iv|P8|up']).toContain(k);
  });
});

// =============================================================================================
describe('FR-061 / FR-036 chord-tone drill', () => {
  it('property: valid answers are exactly the positions of the named tone inside the question’s FR-036 window [s, s + 3] on the chosen strings', () => {
    fc.assert(
      fc.property(
        anyProfile.chain((p) => fc.tuple(
          fc.constant(p), rangeFor(p),
          fc.subarray(['C', 'D', 'E', 'F', 'G', 'A', 'B'], { minLength: 1 }),
          fc.subarray(Object.keys(QUALITY_FNS), { minLength: 1 }),
          // R is covered by its own test below; here the non-root functions are chosen explicitly.
          fc.subarray(['b3', '3', '5', 'b7', '7'], { minLength: 1 }),
        )),
        ([p, r, roots, qualities, functions]) => {
          const from = Math.min(r.a, r.b);
          const to = Math.max(r.a, r.b);
          const s: DrillSettings = { type: 'chord-tone', strings: r.strings, fromFret: from, toFret: to, count: r.count, octaveMode: 'any', roots, qualities, functions };
          const v = validateSettings(p, s);
          if (!v.ok) {
            // Rejected only if truly no (root, quality, function) tone is in the area.
            const any = roots.some((rt) => qualities.some((ql) => QUALITY_FNS[ql]!.filter((fn) => functions.includes(fn)).some((fn) =>
              brute(p, r.strings, from, to, (m) => pcOf(m) === pcOf(ROOT_PC[rt]! + FN_SEMITONES[fn]!)).length > 0)));
            expect(any).toBe(false);
            return;
          }
          for (const q of gen(p, s, r.seed)) {
            if (q.prompt.drillType !== 'chord-tone') throw new Error('wrong drill type');
            const { root, qualityId, function: fn } = q.prompt;
            expect(roots).toContain(root);
            expect(qualities).toContain(qualityId);
            expect(QUALITY_FNS[qualityId]).toContain(fn);
            expect(functions).toContain(fn);
            const tone = pcOf(ROOT_PC[root]! + FN_SEMITONES[fn]!);
            // FR-036: an inclusive window [s, s + w − 1], default w = 4, chosen so it fits the fret range.
            const w = q.window;
            expect(w, 'chord-tone question states its window').toBeDefined();
            expect(w!.from).toBeGreaterThanOrEqual(from);
            expect(w!.to).toBeLessThanOrEqual(to);
            expect(w!.to).toBeGreaterThanOrEqual(w!.from);
            expect(w!.to - w!.from + 1).toBeLessThanOrEqual(4);
            if (to - from + 1 >= 4) expect(w!.to - w!.from + 1).toBe(4);
            const valid = q.steps[0]!.valid;
            expect(valid.length).toBeGreaterThan(0); // FR-061: the window holds the tone
            expect(sortPos(valid)).toEqual(sortPos(brute(p, r.strings, w!.from, w!.to, (m) => pcOf(m) === tone)));
            expect(q.itemKey).toBe(`ct|${qualityId}|${fn}`);
          }
        },
      ),
      { numRuns: 120 },
    );
  });

  it('"b7 of A7" accepts G and only G', () => {
    const qs = gen(std6, base('chord-tone', std6, { roots: ['A'], qualities: ['dom7'], functions: ['b7'], count: 5 }));
    for (const q of qs) for (const v of q.steps[0]!.valid) expect(pcOf(posMidi(std6, v))).toBe(7);
  });

  it('"b3 of Cm" is Eb (pitch class 3)', () => {
    const qs = gen(std6, base('chord-tone', std6, { roots: ['C'], qualities: ['minor'], functions: ['b3'], count: 5 }));
    for (const q of qs) for (const v of q.steps[0]!.valid) expect(pcOf(posMidi(std6, v))).toBe(3);
  });

  it('FR-036: the root (R) is an askable function (it is in the default function set)', () => {
    const v = validateSettings(std6, base('chord-tone', std6, { roots: ['C'], qualities: ['major'], functions: ['R'] }));
    expect(v.ok).toBe(true);
  });

  it('FR-036 defaults when the settings omit roots: the 7 natural roots', () => {
    const { roots: _r, ...rest } = base('chord-tone', std6, { qualities: ['major'], count: 100 });
    const seen = new Set<string>();
    for (const seed of [1, 2, 3]) for (const q of gen(std6, rest as DrillSettings, seed)) if (q.prompt.drillType === 'chord-tone') seen.add(q.prompt.root);
    expect([...seen].sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });
});

// =============================================================================================
describe('FR-061 / FR-056 / FR-057 bass shape drills: exact pitches, answerable', () => {
  // T100a authorised change (spec.md FR-057, 2026-11-22): "Steps are numbered from 1 in ascending
  // order, one per chord tone in FR-005 order; the root is Step 1 and is played by the user, not
  // given." and "FR-056 uses the same indicator with three fixed steps, numbered by tone and not by
  // tap order: Step 1 root ("R"), Step 2 5th ("5"), Step 3 octave". So these questions carry no
  // reference; steps[0] is the root. These tests used to read the root from q.reference.
  const midiOf = (p: InstrumentProfile) => (x: FretPosition) => posMidi(p, x);
  const inArea = (x: FretPosition, strings: readonly number[], from: number, to: number) => strings.includes(x.string) && x.fret >= from && x.fret <= to;
  const span = (...xs: FretPosition[]) => Math.max(...xs.map((x) => x.fret)) - Math.min(...xs.map((x) => x.fret));

  it('property (arpeggio): no reference; one step per chord tone in FR-005 order, Step 1 the root; every step is every position of one exact pitch', () => {
    fc.assert(
      fc.property(anyProfile.chain((p) => fc.tuple(fc.constant(p), rangeFor(p), fc.subarray(Object.keys(QUALITY_FNS), { minLength: 1 }))), ([p, r, qualities]) => {
        const from = Math.min(r.a, r.b);
        const to = Math.max(r.a, r.b);
        const s: DrillSettings = { type: 'arpeggio', strings: r.strings, fromFret: from, toFret: to, count: r.count, octaveMode: 'any', qualities };
        if (!validateSettings(p, s).ok) return;
        const m = midiOf(p);
        for (const q of gen(p, s, r.seed)) {
          expect(q.reference).toEqual([]);
          const ql = (q.prompt as { qualityId: string }).qualityId;
          const fns = QUALITY_FNS[ql]!;
          expect(q.steps.length, `${ql}: one step per chord tone`).toBe(fns.length);
          const w = q.window ?? { from, to };
          expect(w.from).toBeGreaterThanOrEqual(from);
          expect(w.to).toBeLessThanOrEqual(to);
          const root = q.steps[0]!.valid;
          expect(root.length).toBeGreaterThan(0);
          const rm = m(root[0]!);
          fns.forEach((f, i) => {
            const exact = brute(p, r.strings, w.from, w.to, (x) => x === rm + FN_SEMITONES[f]!);
            expect(sortPos(q.steps[i]!.valid), `${ql} step ${i + 1} (${f})`).toEqual(sortPos(exact));
          });
        }
      }),
      { numRuns: 80 },
    );
  });

  it('property (root-fifth-octave): no reference; 3 steps root, 5th, octave of exact pitches; every position completing a shape of span ≤ 3 is accepted', () => {
    fc.assert(
      fc.property(anyProfile.chain((p) => fc.tuple(fc.constant(p), rangeFor(p))), ([p, r]) => {
        const from = Math.min(r.a, r.b);
        const to = Math.max(r.a, r.b);
        const s: DrillSettings = { type: 'root-fifth-octave', strings: r.strings, fromFret: from, toFret: to, count: r.count, octaveMode: 'any', qualities: ['major'] };
        if (!validateSettings(p, s).ok) return;
        const m = midiOf(p);
        for (const q of gen(p, s, r.seed)) {
          expect(q.reference).toEqual([]);
          expect(q.steps.length).toBe(3);
          const [roots, fifths, octaves] = q.steps.map((st) => st.valid) as [FretPosition[], FretPosition[], FretPosition[]];
          for (const x of [...roots, ...fifths, ...octaves]) expect(inArea(x, r.strings, from, to), key(x)).toBe(true);
          expect(roots.length).toBeGreaterThan(0);
          const pc = pcOf(m(roots[0]!));
          for (const x of roots) expect(pcOf(m(x))).toBe(pc);
          // FR-041: a root–fifth–octave item is (root-fifth-octave, root pitch class).
          expect(q.itemKey).toBe(`rfo|${pc}`);
          // Exact pitches: each 5th / octave is 7 / 12 semitones above some accepted root.
          for (const x of fifths) expect(roots.some((y) => m(x) === m(y) + 7), `5th ${key(x)}`).toBe(true);
          for (const x of octaves) expect(roots.some((y) => m(x) === m(y) + 12), `octave ${key(x)}`).toBe(true);
          // FR-056 / FR-061: a playable shape exists, and every exact position completing one is accepted.
          let any = false;
          for (const y of roots) {
            const f5 = brute(p, r.strings, from, to, (x) => x === m(y) + 7);
            const f8 = brute(p, r.strings, from, to, (x) => x === m(y) + 12);
            for (const a of f5) for (const b of f8) {
              if (span(y, a, b) > 3) continue;
              any = true;
              expect(sortPos(fifths)).toContain(key(a));
              expect(sortPos(octaves)).toContain(key(b));
            }
          }
          expect(any, `rfo|${pc}: no shape spanning ≤ 4 frets`).toBe(true);
        }
      }),
      { numRuns: 80 },
    );
  });

  /** Taps in order until the session finishes the question; returns the finished result. */
  const play = (q: Question, taps: FretPosition[]) => {
    const session = new DrillSession([q], 0);
    for (const [i, t] of taps.entries()) {
      const r = session.tap(t, 100 * (i + 1));
      if (r?.finished) return r.finished;
    }
    return undefined;
  };
  const cQuestion = () => {
    const q = findQ(bass4, base('root-fifth-octave', bass4, { qualities: ['major'], count: 100 }),
      (x) => x.itemKey === 'rfo|0' && x.steps[0]!.valid.some((v) => v.string === 3 && v.fret === 3)); // A string fret 3 = C2 (MIDI 36)
    expect(q, 'no rfo|0 question whose Step 1 (the root) accepts C2 at string 3 fret 3').toBeDefined();
    return q!;
  };

  it('US6-1: C root–fifth–octave on 4-string EADG: C2, G2 and C3 played in any order are correct', () => {
    const c = cQuestion();
    const C2 = { string: 3, fret: 3 }, G2 = { string: 2, fret: 5 }, C3 = { string: 1, fret: 5 }; // 36, 43, 48
    expect([C2, G2, C3].map((x) => posMidi(bass4, x))).toEqual([36, 43, 48]);
    expect(play(c!, [C2, G2, C3])?.correct).toBe(true);
    expect(play(c!, [C3, C2, G2])?.correct).toBe(true);
    expect(play(c!, [G2, C3, C2])?.correct).toBe(true);
  });

  it('US6-1 / FR-056: C3 on the D string (fret 10) with C2 at fret 3 spans 8 frets, so the shape is incorrect', () => {
    const c = cQuestion();
    expect(posMidi(bass4, { string: 2, fret: 10 })).toBe(48);
    const r = play(c, [{ string: 3, fret: 3 }, { string: 2, fret: 5 }, { string: 2, fret: 10 }, { string: 1, fret: 5 }]);
    expect(r?.correct).toBe(false);
  });

  it('FR-056: the whole shape must span ≤ 4 frets — root fret 3, 5th open G string, octave fret 5 span 6 frets: incorrect', () => {
    // Root C2 at A string fret 3, 5th G2 at G string fret 0, octave C3 at G string fret 5: frets
    // {0, 3, 5}, max − min = 5 > 3.
    const c = cQuestion();
    expect(posMidi(bass4, { string: 1, fret: 0 })).toBe(43);
    const r = play(c, [{ string: 3, fret: 3 }, { string: 1, fret: 0 }, { string: 1, fret: 5 }, { string: 2, fret: 5 }]);
    expect(r?.correct).toBe(false);
  });

  it('US6-2: an Am7 arpeggio has 4 steps A, C, E, G ascending, the root A first, with no reference', () => {
    const qs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap((seed) => gen(bass4, base('arpeggio', bass4, { qualities: ['min7'], count: 50 }), seed));
    const a = qs.find((q) => q.steps[0]?.valid[0] && pcOf(posMidi(bass4, q.steps[0].valid[0])) === 9);
    expect(a).toBeDefined();
    expect(a!.reference).toEqual([]);
    expect(a!.steps).toHaveLength(4);
    const rm = posMidi(bass4, a!.steps[0]!.valid[0]!);
    for (const st of a!.steps) expect(new Set(st.valid.map((x) => posMidi(bass4, x))).size, 'each step is one exact pitch').toBe(1);
    expect(a!.steps.map((st) => posMidi(bass4, st.valid[0]!) - rm)).toEqual([0, 3, 7, 10]);
  });
});

// =============================================================================================
describe('FR-058 walking bass rules', () => {
  const s = (chords: { root: string; quality: string }[]): DrillSettings =>
    base('walking-bass', bass4, { key: { tonic: 'C', mode: 'major' }, chords, count: 20 });
  const bar1 = (chords: { root: string; quality: string }[]) => gen(bass4, s(chords), 1).find((q) => q.group.startsWith('C'))!;
  /** A position sounding pitch class pc on 4-string EADG, frets 0–12. */
  const at = (pc: number) => brute(bass4, [1, 2, 3, 4], 0, 12, (m) => pcOf(m) === pc)[0]!;

  it('R1: beat 1 is the chord root, and only the root', () => {
    const q = bar1([{ root: 'C', quality: 'major' }, { root: 'G', quality: 'major' }]);
    for (const v of q.steps[0]!.valid) expect(pcOf(posMidi(bass4, v))).toBe(0);
    expect(judgeTap(q, 0, at(0))).toBe(true);
    expect(judgeTap(q, 0, at(4))).toBe(false); // E is a chord tone but not the root
  });

  it('R2: beat 2 accepts a tone of the declared key’s scale (D over C in C major)', () => {
    const q = bar1([{ root: 'C', quality: 'major' }, { root: 'G', quality: 'major' }]);
    expect(judgeTap(q, 1, at(2))).toBe(true);
  });

  it('R3: beat 4 accepts a step of 1–2 semitones to the next root (G): F, F#, G#, A', () => {
    const q = bar1([{ root: 'C', quality: 'major' }, { root: 'G', quality: 'major' }]);
    for (const pc of [5, 6, 8, 9]) expect(judgeTap(q, 3, at(pc)), `pc ${pc}`).toBe(true);
  });

  it('R3: beat 4 accepts the next root’s perfect 5th above (D) or below (C)', () => {
    const q = bar1([{ root: 'C', quality: 'major' }, { root: 'G', quality: 'major' }]);
    expect(judgeTap(q, 3, at(2))).toBe(true); // D: P5 above G
    expect(judgeTap(q, 3, at(0))).toBe(true); // C: P5 below G
  });

  it('R3: beat 4 rejects a note that is neither a step nor a 5th from the next root', () => {
    const q = bar1([{ root: 'C', quality: 'major' }, { root: 'G', quality: 'major' }]);
    expect(judgeTap(q, 3, at(11))).toBe(false); // B: 4 semitones from G
    expect(judgeTap(q, 3, at(3))).toBe(false); // Eb
  });

  it('the progression loops: the last bar approaches bar 1', () => {
    const qs = gen(bass4, s([{ root: 'C', quality: 'major' }, { root: 'G', quality: 'major' }]), 1);
    const g = qs.find((q) => q.group.startsWith('G'))!;
    expect(judgeTap(g, 3, at(11))).toBe(true); // B → C is a semitone step
  });

  it('a progression has 2–8 chords: 1 or 9 chords are rejected', () => {
    expect(validateSettings(bass4, s([{ root: 'C', quality: 'major' }])).ok).toBe(false);
    expect(validateSettings(bass4, s(Array.from({ length: 9 }, () => ({ root: 'C', quality: 'major' })))).ok).toBe(false);
    expect(validateSettings(bass4, s(Array.from({ length: 8 }, () => ({ root: 'C', quality: 'major' })))).ok).toBe(true);
  });

  it('FR-061 property: every walking step has a valid answer inside the area', () => {
    fc.assert(
      fc.property(anyProfile.chain((p) => fc.tuple(fc.constant(p), rangeFor(p))), ([p, r]) => {
        const from = Math.min(r.a, r.b);
        const to = Math.max(r.a, r.b);
        const st: DrillSettings = { type: 'walking-bass', strings: r.strings, fromFret: from, toFret: to, count: r.count, octaveMode: 'any', key: { tonic: 'C', mode: 'major' }, chords: [{ root: 'C', quality: 'major' }, { root: 'A', quality: 'minor' }, { root: 'D', quality: 'minor' }, { root: 'G', quality: 'dom7' }] };
        if (!validateSettings(p, st).ok) return;
        for (const q of gen(p, st, r.seed)) {
          expect(q.steps).toHaveLength(4);
          for (const step of q.steps) {
            expect(step.valid.length).toBeGreaterThan(0);
            for (const v of step.valid) {
              expect(r.strings).toContain(v.string);
              expect(v.fret).toBeGreaterThanOrEqual(from);
              expect(v.fret).toBeLessThanOrEqual(to);
            }
          }
        }
      }),
      { numRuns: 60 },
    );
  });
});

describe('judgeTap', () => {
  it('an out-of-range step index is never correct', () => {
    const [q] = gen(std6, base('note-finding', std6, { strings: [6], notes: [7], count: 5 }));
    expect(judgeTap(q!, 5, { string: 6, fret: 3 })).toBe(false);
  });
});

// =============================================================================================
describe('FR-061 settings that name unknown theory objects are rejected or skipped, never crash', () => {
  it('interval: an unknown interval name is ignored; only unknown names → rejected with a reason', () => {
    for (const q of gen(std6, base('interval', std6, { intervals: ['X9', 'M3'], direction: 'up', count: 10 }))) expect(q.itemKey).toBe('iv|M3|up');
    const v = validateSettings(std6, base('interval', std6, { intervals: ['X9'], direction: 'up' }));
    expect(v.ok).toBe(false);
  });

  it('interval names read as standard theory names', () => {
    expect(intervalName('M3')).toBe('major 3rd');
    expect(intervalName('P5')).toBe('perfect 5th');
    expect(intervalName('A4')).toBe('augmented 4th');
    expect(intervalName('zz')).toBe('zz');
  });

  it('chord-tone: unknown qualities and roots are rejected with a reason', () => {
    expect(validateSettings(std6, base('chord-tone', std6, { roots: ['C'], qualities: ['nonsense'] })).ok).toBe(false);
    expect(validateSettings(std6, base('chord-tone', std6, { roots: ['H'], qualities: ['major'] })).ok).toBe(false);
  });

  it('FR-010: a root whose chord would need a triple accidental (Cb dim7 → Bbbb) is never asked', () => {
    expect(validateSettings(std6, base('chord-tone', std6, { roots: ['Cb'], qualities: ['dim7'] })).ok).toBe(false);
    for (const q of gen(std6, base('chord-tone', std6, { roots: ['Cb', 'C'], qualities: ['dim7'], count: 30 }))) {
      if (q.prompt.drillType === 'chord-tone') expect(q.prompt.root).toBe('C');
    }
  });

  it('FR-036 default qualities when omitted: {maj, min, 7}', () => {
    const { qualities: _q, ...rest } = base('chord-tone', std6, { roots: ['C'], count: 60 });
    for (const q of gen(std6, rest as DrillSettings)) if (q.prompt.drillType === 'chord-tone') expect(['major', 'minor', 'dom7']).toContain(q.prompt.qualityId);
  });

  it('bass shapes: an unknown quality is rejected; omitted qualities still give answerable questions', () => {
    expect(validateSettings(bass4, base('arpeggio', bass4, { qualities: ['nonsense'] })).ok).toBe(false);
    const { qualities: _q, ...rest } = base('root-fifth-octave', bass4, { count: 10 });
    for (const q of gen(bass4, rest as DrillSettings)) expect(q.steps.every((st) => st.valid.length > 0)).toBe(true);
  });

  it('walking bass: an unknown tonic or chord root is rejected; an unknown chord quality yields no bar for it', () => {
    const w = (over: Partial<DrillSettings>) => base('walking-bass', bass4, { key: { tonic: 'C', mode: 'major' }, chords: [{ root: 'C', quality: 'major' }, { root: 'G', quality: 'major' }], ...over });
    expect(validateSettings(bass4, w({ key: { tonic: 'H', mode: 'major' } })).ok).toBe(false);
    expect(validateSettings(bass4, w({ chords: [{ root: 'C', quality: 'major' }, { root: 'Q', quality: 'major' }] })).ok).toBe(false);
    const qs = gen(bass4, w({ chords: [{ root: 'C', quality: 'major' }, { root: 'G', quality: 'nonsense' }] }));
    for (const q of qs) expect(q.group.startsWith('C')).toBe(true);
    expect(validateSettings(bass4, w({ chords: [{ root: 'C', quality: 'nonsense' }, { root: 'G', quality: 'nonsense' }] })).ok).toBe(false);
  });

  it('walking bass in a minor key: beat 3 accepts the key’s scale tones (Ab over Cm in C minor)', () => {
    const s = base('walking-bass', bass4, { key: { tonic: 'C', mode: 'minor' }, chords: [{ root: 'C', quality: 'minor' }, { root: 'G', quality: 'minor' }], count: 20 });
    const q = gen(bass4, s).find((x) => x.group.startsWith('C'))!;
    const ab = brute(bass4, [1, 2, 3, 4], 0, 12, (m) => pcOf(m) === 8)[0]!;
    expect(judgeTap(q, 2, ab)).toBe(true);
  });

  it('walking bass with chords omitted still yields 4-beat bars', () => {
    const { chords: _c, ...rest } = base('walking-bass', bass4, { key: { tonic: 'C', mode: 'major' }, count: 5 });
    for (const q of gen(bass4, rest as DrillSettings)) expect(q.steps).toHaveLength(4);
  });

  it('every drill type has a display label', () => {
    for (const t of ['note-finding', 'interval', 'chord-tone', 'root-fifth-octave', 'arpeggio', 'walking-bass', 'chord-tone-lock'] as const) {
      expect(DRILL_LABELS[t].length).toBeGreaterThan(0);
    }
  });
});
