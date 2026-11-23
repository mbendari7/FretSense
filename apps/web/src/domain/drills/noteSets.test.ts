/**
 * T091a (red, test-first) [FR-031, FR-041, FR-037], from theory-checker T091 r1 findings #3 and #8.
 *
 * FR-031 (spec.md, quoted): "note set: naturals (7); naturals + sharps (C# D# F# G# A#);
 * naturals + flats (Db Eb Gb Ab Bb); all (17 spellings). Cb, Fb, E# and B# are never prompted.
 * With no saved settings for this drill, the defaults are: note set naturals, ..."
 *   => naturals = {C D E F G A B}; sharps = naturals + 5 sharps (12); flats = naturals + 5 flats (12);
 *      all = naturals + 5 sharps + 5 flats = 17 spellings. Every expected set below is typed out
 *      from that sentence, never read from the implementation.
 *
 * FR-032: within a question the prompt, revealed labels and feedback use the prompted spelling,
 * so the step's `spelled` and the context root must be the prompted spelling, and the accepted
 * positions are exactly the positions sounding that spelling's pitch class (brute force below).
 *
 * FR-041: the note-finding item stays (geometry id, string, pitch class), so C# and Db share an item.
 * FR-041 / FR-037: a root–fifth–octave item is (rfo, root pitch class); its summary group label must
 * have one stable spelling whatever chord quality was drawn (theory-checker #8: "Ab" vs "G#").
 *
 * API chosen (needs adding to DrillSettings in domain/drills/types.ts):
 *   readonly noteSet?: 'naturals' | 'sharps' | 'flats' | 'all';
 * Absent noteSet and absent notes => 'naturals' (FR-031 default). The legacy `notes: number[]`
 * (pitch classes, used by existing tests and lesson drill content) keeps working when noteSet is absent.
 */
import { describe, expect, it } from 'vitest';
import { presets, type FretPosition, type InstrumentProfile, type Note, type PitchClassNote } from '@fretsense/theory';
import { generateQuestions } from './generate';
import { mulberry32 } from '../prng';
import type { DrillSettings, Question } from './types';

type NoteSet = 'naturals' | 'sharps' | 'flats' | 'all';
type Settings = DrillSettings & { readonly noteSet?: NoteSet };

// ---------- independent reference helpers ----------
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
/** String 1 is the highest pitched (FR-008): the last entry of the low → high tuning. */
const openMidi = (p: InstrumentProfile, s: number) => noteMidi(p.tuning[p.stringCount - s]!);
const pcOf = (m: number) => ((m % 12) + 12) % 12;
const spellPc = (n: PitchClassNote) => pcOf(LETTER_PC[n.letter]! + n.accidental);
const name = (n: PitchClassNote) => n.letter + (n.accidental === 1 ? '#' : n.accidental === -1 ? 'b' : n.accidental === 0 ? '' : `?${n.accidental}`);
const unicode = (s: string) => s.replace('#', '♯').replace(/(?<=[A-G])b/, '♭');

const NATURALS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SHARPS = ['C#', 'D#', 'F#', 'G#', 'A#'];
const FLATS = ['Db', 'Eb', 'Gb', 'Ab', 'Bb'];
const EXPECTED: Record<NoteSet, string[]> = {
  naturals: NATURALS,
  sharps: [...NATURALS, ...SHARPS],
  flats: [...NATURALS, ...FLATS],
  all: [...NATURALS, ...SHARPS, ...FLATS],
};
const NEVER = ['Cb', 'Fb', 'E#', 'B#'];

const PRESETS = presets();
const allStrings = (p: InstrumentProfile) => Array.from({ length: p.stringCount }, (_, i) => i + 1);
const nf = (p: InstrumentProfile, over: Partial<Settings> = {}): Settings => ({
  type: 'note-finding', strings: allStrings(p), fromFret: 0, toFret: Math.min(12, p.fretCount), count: 100, octaveMode: 'any', ...over,
});

function gen(p: InstrumentProfile, s: Settings, seed: number): Question[] {
  const r = generateQuestions({ profile: p, settings: s as DrillSettings, rng: mulberry32(seed), histories: new Map(), adaptive: false });
  if (!r.ok) throw new Error(r.reason);
  return r.questions;
}
/** 5 seeds × 100 questions: every spelling of a 17-item set is drawn with overwhelming probability. */
const many = (p: InstrumentProfile, s: Settings) => [1, 2, 3, 4, 5].flatMap((seed) => gen(p, s, seed));
const spelledOf = (q: Question) => q.steps[0]!.spelled!;
const promptedNames = (qs: Question[]) => [...new Set(qs.map((q) => name(spelledOf(q))))].sort();

// =============================================================================================
describe('FR-031 note-finding default note set is the 7 naturals', () => {
  it.each(PRESETS.map((x) => [x.presetId, x.profile] as const))('%s: no noteSet and no notes prompts exactly C D E F G A B', (_id, p) => {
    const qs = many(p, nf(p));
    expect(promptedNames(qs)).toEqual([...NATURALS].sort());
  });
});

describe('FR-031 note sets: prompts are spelled by the chosen set', () => {
  for (const set of ['naturals', 'sharps', 'flats', 'all'] as const) {
    it.each(PRESETS.map((x) => [x.presetId, x.profile] as const))(`${set}: %s prompts exactly the set's spellings`, (_id, p) => {
      const qs = many(p, nf(p, { noteSet: set }));
      expect(promptedNames(qs)).toEqual([...EXPECTED[set]].sort());
    });
  }

  it.each(PRESETS.map((x) => [x.presetId, x.profile] as const))('all: %s never prompts Cb, Fb, E# or B#', (_id, p) => {
    const names = promptedNames(many(p, nf(p, { noteSet: 'all', toFret: p.fretCount })));
    for (const n of NEVER) expect(names).not.toContain(n);
    expect(names).toHaveLength(17);
  });

  it('sharps never prompts a flat; flats never prompts a sharp (6-string Standard)', () => {
    const p = PRESETS.find((x) => x.presetId === 'guitar6-standard')!.profile;
    expect(promptedNames(many(p, nf(p, { noteSet: 'sharps' }))).filter((n) => n.endsWith('b'))).toEqual([]);
    expect(promptedNames(many(p, nf(p, { noteSet: 'flats' }))).filter((n) => n.endsWith('#'))).toEqual([]);
  });
});

describe('FR-031 / FR-032 each question is consistent with its prompted spelling', () => {
  it.each(PRESETS.map((x) => [x.presetId, x.profile] as const))('%s, all spellings: text, prompt pitch class, context root and accepted positions agree', (_id, p) => {
    for (const q of many(p, nf(p, { noteSet: 'all' }))) {
      const sp = spelledOf(q);
      const n = name(sp);
      const pc = spellPc(sp);
      expect(q.prompt).toMatchObject({ drillType: 'note-finding', pitchClass: pc });
      expect([`Find ${n} `, `Find ${unicode(n)} `].some((pre) => q.text.startsWith(pre)), `${q.text} should prompt ${n}`).toBe(true);
      expect(q.context?.root).toMatchObject({ letter: sp.letter, accidental: sp.accidental });
      const str = q.promptedString!;
      const expected: FretPosition[] = [];
      for (let f = 0; f <= Math.min(12, p.fretCount); f++) if (pcOf(openMidi(p, str) + f) === pc) expected.push({ string: str, fret: f });
      expect([...q.steps[0]!.valid].map((v) => `${v.string}:${v.fret}`).sort()).toEqual(expected.map((v) => `${v.string}:${v.fret}`).sort());
    }
  });

  it('letters and sharps on 6-string Standard string 5 (A) frets 0–1 asks only A or A# (never Bb)', () => {
    const p = PRESETS.find((x) => x.presetId === 'guitar6-standard')!.profile;
    const names = promptedNames(many(p, nf(p, { noteSet: 'sharps', strings: [5], fromFret: 0, toFret: 1 })));
    expect(names).toEqual(['A', 'A#']);
  });

  it('letters and flats on 6-string Standard string 5 (A) frets 0–1 asks only A or Bb (never A#)', () => {
    const p = PRESETS.find((x) => x.presetId === 'guitar6-standard')!.profile;
    const names = promptedNames(many(p, nf(p, { noteSet: 'flats', strings: [5], fromFret: 0, toFret: 1 })));
    expect(names).toEqual(['A', 'Bb']);
  });

  it('letters only on string 5 frets 1–1 (only A#/Bb sounds) is rejected with a reason (FR-061)', () => {
    const p = PRESETS.find((x) => x.presetId === 'guitar6-standard')!.profile;
    const r = generateQuestions({ profile: p, settings: nf(p, { noteSet: 'naturals', strings: [5], fromFret: 1, toFret: 1 }) as DrillSettings, rng: mulberry32(1), histories: new Map(), adaptive: false });
    expect(r.ok).toBe(false);
  });
});

describe('FR-041 note-finding items stay keyed by pitch class under every note set', () => {
  it('all spellings: C# and Db prompts on one string share the item nf|<geometry>|<string>|1', () => {
    const p = PRESETS.find((x) => x.presetId === 'guitar6-standard')!.profile;
    const qs = many(p, nf(p, { noteSet: 'all', strings: [5] }));
    const sharp = qs.find((q) => name(spelledOf(q)) === 'C#');
    const flat = qs.find((q) => name(spelledOf(q)) === 'Db');
    expect(sharp, 'C# should be prompted').toBeDefined();
    expect(flat, 'Db should be prompted').toBeDefined();
    expect(sharp!.itemKey).toBe(`nf|${p.geometryId}|5|1`);
    expect(flat!.itemKey).toBe(sharp!.itemKey);
  });
});

describe('FR-031 legacy pitch-class `notes` keeps working when no noteSet is given', () => {
  it('notes [7] prompts only G', () => {
    const p = PRESETS.find((x) => x.presetId === 'guitar6-standard')!.profile;
    expect(promptedNames(many(p, nf(p, { notes: [7], count: 20 })))).toEqual(['G']);
  });
});

// =============================================================================================
describe('FR-041 / FR-037 root–fifth–octave: one stable spelling per rfo|<pc> group label', () => {
  const QUALITIES = ['major', 'minor', 'dom7', 'min7'];
  it.each(PRESETS.map((x) => [x.presetId, x.profile] as const))('%s: every rfo item has exactly one group label, naming its root pitch class', (_id, p) => {
    const s: Settings = { type: 'root-fifth-octave', strings: allStrings(p), fromFret: 0, toFret: Math.min(12, p.fretCount), count: 100, octaveMode: 'any', qualities: QUALITIES };
    const byKey = new Map<string, Set<string>>();
    for (let seed = 1; seed <= 10; seed++) {
      for (const q of gen(p, s, seed)) {
        const set = byKey.get(q.itemKey) ?? new Set<string>();
        set.add(q.group);
        byKey.set(q.itemKey, set);
      }
    }
    expect(byKey.size).toBeGreaterThan(0);
    for (const [key, groups] of byKey) {
      expect([...groups], `${key} has more than one group label`).toHaveLength(1);
      const pc = Number(key.split('|')[1]);
      const m = /^Root ([A-G])(#|b|♯|♭)?$/.exec([...groups][0]!);
      expect(m, `group label "${[...groups][0]}" should be "Root <note>"`).not.toBeNull();
      const acc = m![2] === '#' || m![2] === '♯' ? 1 : m![2] === 'b' || m![2] === '♭' ? -1 : 0;
      expect(pcOf(LETTER_PC[m![1]!]! + acc)).toBe(pc);
    }
  });

  it('6-string Standard, major and minor: the pitch class 8 group is the same label for both qualities', () => {
    const p = PRESETS.find((x) => x.presetId === 'guitar6-standard')!.profile;
    const s: Settings = { type: 'root-fifth-octave', strings: allStrings(p), fromFret: 0, toFret: 12, count: 100, octaveMode: 'any', qualities: ['major', 'minor'] };
    const groups = new Set<string>();
    const quals = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      for (const q of gen(p, s, seed)) if (q.itemKey === 'rfo|8') { groups.add(q.group); quals.add((q.prompt as { qualityId?: string }).qualityId ?? ''); }
    }
    expect([...quals].sort()).toEqual(['major', 'minor']);
    expect([...groups]).toHaveLength(1);
  });
});
