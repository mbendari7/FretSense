/**
 * T090 (red, test-first): canonical drill-type ids and item keys [FR-041; spec Key Entities
 * "Drill definition"; Clarifications 2026-11-22 "frozen encodings"; spec-reviewer r1 #18].
 *
 * Expected values come from spec.md only:
 *  - Key Entities: drill type is "one of exactly these ids: note-finding, interval, chord-tone,
 *    root-fifth-octave, arpeggio, walking-bass, chord-tone-lock".
 *  - FR-041 items: (geometry id, string, pitch class) note-finding; (interval, direction) interval;
 *    (quality, function) chord tone; (root-fifth-octave, root pitch class) root–fifth–octave;
 *    (drill type, quality of the chord the note is played over) arpeggio, walking-bass, chord-tone-lock.
 *
 * The spec defines the item *tuple*, not a string grammar, so keys are checked by the property
 * "two questions share an item key ⇔ they share the FR-041 tuple", with the tuple recomputed here
 * from the question's own prompt and positions by brute force.
 */
import { describe, expect, it } from 'vitest';
import { pitchClass, positionsOf, presetById, type InstrumentProfile, type Note } from '@fretsense/theory';
import { buildLine, lineAttempts } from './walkingBass';
import { generateQuestions } from './generate';
import { mulberry32 } from '../prng';
import { DRILL_LABELS, type DrillSettings, type Question } from './types';
import { DRILL_TYPES, ITEM_KEY_PATTERN, attemptSchema } from '../records';

const SPEC_DRILL_TYPES = ['note-finding', 'interval', 'chord-tone', 'root-fifth-octave', 'arpeggio', 'walking-bass', 'chord-tone-lock'] as const;
/** Widens a spec id to the settings type; the cast compiles even before T091 renames the union. */
const asType = (t: string) => t as DrillSettings['type'];

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const openMidi = (p: InstrumentProfile, s: number) => noteMidi(p.tuning[p.stringCount - s]!);
const allStrings = (p: InstrumentProfile) => Array.from({ length: p.stringCount }, (_, i) => i + 1);

function genMany(p: InstrumentProfile, s: DrillSettings, seeds = 6): Question[] {
  const out: Question[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const r = generateQuestions({ profile: p, settings: s, rng: mulberry32(seed), histories: new Map(), adaptive: false });
    if (!r.ok) throw new Error(r.reason);
    out.push(...r.questions);
  }
  return out;
}
const settings = (p: InstrumentProfile, type: string, over: Partial<DrillSettings> = {}): DrillSettings => ({
  type: asType(type), strings: allStrings(p), fromFret: 0, toFret: Math.min(12, p.fretCount), count: 20, octaveMode: 'any', ...over,
});
/** Asserts: same itemKey ⇔ same tuple, over every pair. */
function expectKeyMatchesTuple(qs: readonly Question[], tuple: (q: Question) => string) {
  expect(qs.length).toBeGreaterThan(1);
  const byKey = new Map<string, Set<string>>();
  const byTuple = new Map<string, Set<string>>();
  for (const q of qs) {
    const t = tuple(q);
    (byKey.get(q.itemKey) ?? byKey.set(q.itemKey, new Set()).get(q.itemKey)!).add(t);
    (byTuple.get(t) ?? byTuple.set(t, new Set()).get(t)!).add(q.itemKey);
  }
  for (const [k, ts] of byKey) expect([...ts], `item key ${k} mixes tuples`).toHaveLength(1);
  for (const [t, ks] of byTuple) expect([...ks], `tuple ${t} has several keys`).toHaveLength(1);
}


/**
 * T098: walking bass is one looping line (FR-058), not a generated question list. Its recorded items
 * come from lineAttempts on a filled line: each bar's slots hold that bar's chord root.
 */
function walkItems(p: InstrumentProfile, s: DrillSettings): { drillType: string; itemKey: string; prompt: { drillType: string }; context: { qualityId: string } }[] {
  const b = buildLine(p, s);
  if (!b.ok) throw new Error(b.reason);
  const entries = Array.from({ length: b.line.slotCount }, (_, i) => {
    const c = b.line.chords[Math.floor(i / 4)]!;
    return positionsOf(p, { pitchClass: pitchClass(c.root) }, { fromFret: b.line.fromFret, toFret: b.line.toFret, strings: b.line.strings })[0];
  });
  return lineAttempts(p, b.line, entries).map((a, i) => ({ drillType: 'walking-bass', itemKey: a.itemKey, prompt: a.prompt, context: { qualityId: b.line.chords[Math.floor(i / 4)]!.quality } }));
}

const std6 = presetById('guitar6-standard')!.profile;
const dropD = presetById('guitar6-drop-d')!.profile;
const bass4 = presetById('bass4-standard')!.profile;

// =============================================================================================
describe('Key Entities: drill-type ids are exactly the spec list', () => {
  it('DRILL_TYPES (persisted attempt drillType) is exactly the seven spec ids', () => {
    expect([...DRILL_TYPES].sort()).toEqual([...SPEC_DRILL_TYPES].sort());
  });

  it('DRILL_LABELS has a label for exactly the spec ids', () => {
    expect(Object.keys(DRILL_LABELS).sort()).toEqual([...SPEC_DRILL_TYPES].sort());
  });

  it.each(SPEC_DRILL_TYPES)('the attempt schema accepts drillType "%s"', (t) => {
    const r = attemptSchema.shape.drillType.safeParse(t);
    expect(r.success).toBe(true);
  });

  it.each(['root-fifth-octave', 'arpeggio', 'chord-tone-lock'] as const)('generated "%s" questions carry that drill type id', (t) => {
    const qs = genMany(bass4, settings(bass4, t, { qualities: ['major', 'minor'], key: { tonic: 'C', mode: 'major' } }), 1);
    for (const q of qs) {
      expect(q.drillType).toBe(t);
      expect(q.prompt.drillType).toBe(t);
    }
  });
  it('recorded "walking-bass" line attempts carry that drill type id (T098: one line, FR-058)', () => {
    for (const a of walkItems(bass4, settings(bass4, 'walking-bass', { key: { tonic: 'C', mode: 'major' } }))) {
      expect(a.drillType).toBe('walking-bass');
      expect(a.prompt.drillType).toBe('walking-bass');
    }
  });
});

// =============================================================================================
describe('FR-041 item keys follow the spec tuples', () => {
  it('note-finding: (geometry id, string, pitch class)', () => {
    const q6 = genMany(std6, settings(std6, 'note-finding'));
    const qd = genMany(dropD, settings(dropD, 'note-finding'));
    const qs = [...q6, ...qd];
    const n6 = q6.length;
    // the geometry is known from which instrument produced the question
    const tuples = new Map(qs.map((q, i) => [q, `${i < n6 ? std6.geometryId : dropD.geometryId}|${q.promptedString}|${q.steps[0]!.accepts[0]}`]));
    expectKeyMatchesTuple(qs, (q) => tuples.get(q)!);
    // Standard and Drop D share string 5 (A2) but are different geometries: keys never mix tunings.
    const a = qs.slice(0, n6).find((q) => q.promptedString === 5);
    const b = qs.slice(n6).find((q) => q.promptedString === 5 && q.steps[0]!.accepts[0] === a?.steps[0]!.accepts[0]);
    if (a && b) expect(a.itemKey).not.toBe(b.itemKey);
  });

  it('interval: (interval, direction), independent of the reference position', () => {
    const qs = genMany(std6, settings(std6, 'interval', { intervals: ['m3', 'M3', 'P5'], direction: 'both' }));
    expectKeyMatchesTuple(qs, (q) => (q.prompt.drillType === 'interval' ? q.prompt.interval : '?'));
  });

  it('chord-tone: (quality, function), independent of the root', () => {
    const qs = genMany(std6, settings(std6, 'chord-tone', { fromFret: 1, roots: ['C', 'D', 'Bb'], qualities: ['major', 'minor', 'dom7'] }));
    expectKeyMatchesTuple(qs, (q) => (q.prompt.drillType === 'chord-tone' ? `${q.prompt.qualityId}|${q.prompt.function}` : '?'));
  });

  it('root-fifth-octave: (root-fifth-octave, root pitch class) — different roots are different items', () => {
    const qs = genMany(bass4, settings(bass4, 'root-fifth-octave'));
    // T100a: FR-057 "Step 1 root ("R")" — the root is played as Step 1, not given as a reference.
    const rootPc = (q: Question) => { const r = q.steps[0]!.valid[0]!; return String((openMidi(bass4, r.string) + r.fret) % 12); };
    expect(new Set(qs.map(rootPc)).size).toBeGreaterThan(1); // the sample covers several roots
    expectKeyMatchesTuple(qs, rootPc);
  });

  it('arpeggio: (arpeggio, chord quality), independent of the root', () => {
    const qs = genMany(bass4, settings(bass4, 'arpeggio', { qualities: ['major', 'minor', 'dom7'] }));
    expectKeyMatchesTuple(qs, (q) => `arpeggio|${q.context?.qualityId}`);
  });

  it('walking-bass: (walking-bass, quality of the chord the note is played over)', () => {
    const qs = walkItems(bass4, settings(bass4, 'walking-bass', { key: { tonic: 'C', mode: 'major' }, chords: [{ root: 'C', quality: 'major' }, { root: 'A', quality: 'minor' }, { root: 'D', quality: 'minor' }, { root: 'G', quality: 'dom7' }] }));
    expectKeyMatchesTuple(qs as unknown as Question[], (q) => `walking-bass|${q.context?.qualityId}`);
  });

  it('different drill types never share an item key (arpeggio vs walking-bass over the same quality)', () => {
    const arp = genMany(bass4, settings(bass4, 'arpeggio', { qualities: ['minor'] }), 1);
    const walk = walkItems(bass4, settings(bass4, 'walking-bass', { key: { tonic: 'C', mode: 'major' }, chords: [{ root: 'A', quality: 'minor' }, { root: 'D', quality: 'minor' }] }));
    const a = new Set(arp.map((q) => q.itemKey));
    for (const q of walk) expect(a.has(q.itemKey)).toBe(false);
  });

  it.each(['note-finding', 'interval', 'chord-tone', 'root-fifth-octave', 'arpeggio', 'walking-bass', 'chord-tone-lock'] as const)(
    'every generated "%s" item key is accepted by the persisted attempt grammar (so it can be recorded)',
    (t) => {
      const p = t === 'note-finding' || t === 'interval' || t === 'chord-tone' ? std6 : bass4;
      const s = settings(p, t, t === 'chord-tone' ? { fromFret: 1 } : { qualities: ['major', 'minor'], key: { tonic: 'C', mode: 'major' } });
      const qs: { itemKey: string }[] = t === 'walking-bass' ? walkItems(p, s) : genMany(p, s, 1);
      for (const q of qs) expect(ITEM_KEY_PATTERN.test(q.itemKey), q.itemKey).toBe(true);
    },
  );
});
