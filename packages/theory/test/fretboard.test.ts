// T014: fretboard mapping and fret geometry (FR-008, FR-010, FR-062, SC-001, SC-011).
// Expected values: fixtures/theory/instruments.json and equal-temperament arithmetic
// (fret n raises the open string by n semitones; distance from the nut L * (1 - 2^(-n/12))).
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { presets, validateProfile, noteAt, positionsOf, fretX, midi, pitchClass } from '../src/index';
import type { FretPosition, InstrumentProfile } from '../src/index';
import fixture from '../../../fixtures/theory/instruments.json';
import {
  FRET_MAX,
  FRET_MIN,
  STRING_COUNTS,
  expectErr,
  inputFromText,
  instrumentInputArb,
  note,
  pcn,
  refMidi,
  spellN,
  unwrap,
} from './arbitraries';

const PRESETS = fixture.presets.values;
const presetProfile = (id: string): InstrumentProfile => {
  const p = presets().find((x) => x.presetId === id);
  if (!p) throw new Error(`preset ${id} missing`);
  return p.profile;
};
/** Open-string MIDI of string s (1 = highest pitched), from the profile's own tuning (low -> high). */
const openMidi = (prof: InstrumentProfile, s: number) => refMidi(prof.tuning[prof.stringCount - s]!);
const key = (p: FretPosition) => `${p.string}/${p.fret}`;
const sortPos = (ps: readonly FretPosition[]) => ps.map((p) => ({ string: p.string, fret: p.fret })).sort((a, b) => a.string - b.string || a.fret - b.fret);

/** Every profile under test: the 7 presets plus generated instruments (SC-011). */
const generatedProfileArb = instrumentInputArb().map((input) => unwrap(validateProfile(input)));

describe('FR-008 noteAt on every built-in preset', () => {
  it.each(PRESETS)('$presetId: fixture positions', (row) => {
    const prof = presetProfile(row.presetId);
    for (const pos of row.positions) {
      const n = unwrap(noteAt(prof, { string: pos.string, fret: pos.fret }));
      expect(midi(n)).toBe(pos.midi);
      expect(pitchClass(n)).toBe(pos.pitchClass);
    }
  });

  it.each(PRESETS)('$presetId: string 1 is the highest-pitched, open strings keep the tuning spelling', (row) => {
    const prof = presetProfile(row.presetId);
    const n = row.tuning.length;
    for (let s = 1; s <= n; s++) {
      const open = unwrap(noteAt(prof, { string: s, fret: 0 }));
      expect(spellN(open)).toEqual(note(row.tuning[n - s]!));
    }
  });

  it.each(PRESETS)('$presetId: SC-001 full mapping, every string x every fret 0..fretCount', (row) => {
    const prof = presetProfile(row.presetId);
    const n = row.tuning.length;
    for (let s = 1; s <= n; s++) {
      const open = row.tuningMidi[n - s]!;
      for (let f = 0; f <= row.fretCount; f++) {
        expect(midi(unwrap(noteAt(prof, { string: s, fret: f })))).toBe(open + f);
      }
    }
  });
});

describe('FR-008 / Edge Cases noteAt spelling context', () => {
  it('Eb tuning in Ab major: string 5 open = Ab', () => {
    const prof = presetProfile('guitar6-eb');
    const n = unwrap(noteAt(prof, { string: 5, fret: 0 }, { root: pcn('Ab'), typeId: 'major' }));
    expect({ letter: n.letter, accidental: n.accidental }).toEqual(pcn('Ab'));
    expect(midi(n)).toBe(44);
  });

  it('Eb tuning in E major: string 5 open (Ab2) is labelled G#2 in the context spelling', () => {
    const prof = presetProfile('guitar6-eb');
    const n = unwrap(noteAt(prof, { string: 5, fret: 0 }, { root: pcn('E'), typeId: 'major' }));
    expect(spellN(n)).toEqual(note('G#2'));
  });

  it('a chord context spells chord tones by the chord: standard tuning, string 6 fret 4 in E major triad = G#2', () => {
    const prof = presetProfile('guitar6-standard');
    expect(spellN(unwrap(noteAt(prof, { string: 6, fret: 4 }, { root: pcn('E'), qualityId: 'major' })))).toEqual(note('G#2'));
  });

  it('in-context notes keep the context spelling; outside notes follow FR-060 (standard tuning, low E string)', () => {
    const prof = presetProfile('guitar6-standard');
    const at = (fret: number, root: string) => spellN(unwrap(noteAt(prof, { string: 6, fret }, { root: pcn(root), typeId: 'major' })));
    // E2 + fret = MIDI 40 + fret. In C major: fret 0 E2 (3, inside), fret 2 = 42 F#2 (#4), fret 4 = 44 Ab2 (b6), fret 6 = 46 Bb2 (b7).
    expect(at(0, 'C')).toEqual(note('E2'));
    expect(at(2, 'C')).toEqual(note('F#2'));
    expect(at(4, 'C')).toEqual(note('Ab2'));
    expect(at(6, 'C')).toEqual(note('Bb2'));
    // In Ab major, open E (pc 4) is outside: b6 above Ab = Fb, so Fb2 (same pitch as E2).
    expect(at(0, 'Ab')).toEqual(note('Fb2'));
  });

  it('octave follows the letter: the open B3 string (MIDI 59) in Gb major is Cb4', () => {
    // Gb major contains Cb; same pitch as B3, but the letter is C, so the octave number is 4.
    const prof = presetProfile('guitar6-standard');
    const n = unwrap(noteAt(prof, { string: 2, fret: 0 }, { root: pcn('Gb'), typeId: 'major' }));
    expect(spellN(n)).toEqual(note('Cb4'));
    expect(midi(n)).toBe(59);
  });
});

describe('FR-010 noteAt rejects positions outside the profile', () => {
  it.each(PRESETS)('$presetId: string 0, string N+1, fret -1, fret fretCount+1, fractional', (row) => {
    const prof = presetProfile(row.presetId);
    const n = row.tuning.length;
    for (const pos of [
      { string: 0, fret: 0 },
      { string: n + 1, fret: 0 },
      { string: 1, fret: -1 },
      { string: 1, fret: row.fretCount + 1 },
      { string: 1, fret: 1.5 },
      { string: 1.5, fret: 1 },
    ]) {
      expectErr(noteAt(prof, pos), 'OutOfRange');
    }
  });
});

describe('FR-008 positionsOf', () => {
  it.each(fixture.positionsOf.values)('$presetId: $target in $range', (row) => {
    const prof = presetProfile(row.presetId);
    const got = positionsOf(prof, row.target as { pitchClass: number } | { midi: number }, row.range);
    expect(sortPos(got)).toEqual(sortPos(row.positions));
  });

  it('US5 scenario 3: every D, F# and A on 5-string BEADG (frets 0..20) is found on all 5 strings', () => {
    const prof = presetProfile('bass5-beadg');
    for (const pc of [2, 6, 9]) {
      const got = positionsOf(prof, { pitchClass: pc }, { fromFret: 0, toFret: prof.fretCount });
      expect(new Set(got.map((p) => p.string))).toEqual(new Set([1, 2, 3, 4, 5]));
    }
  });
});

describe('SC-011 properties over the 7 presets and >= 100 generated instruments', () => {
  const runs = { numRuns: 150 };

  const roundTrip = (prof: InstrumentProfile, pos: FretPosition) => {
    const n = unwrap(noteAt(prof, pos));
    expect(midi(n)).toBe(openMidi(prof, pos.string) + pos.fret);
    const exact = positionsOf(prof, { midi: midi(n) }, { fromFret: 0, toFret: prof.fretCount });
    expect(exact.map(key)).toContain(key(pos));
    const byPc = positionsOf(prof, { pitchClass: pitchClass(n) }, { fromFret: 0, toFret: prof.fretCount });
    expect(byPc.map(key)).toContain(key(pos));
  };

  const posArb = (prof: InstrumentProfile) =>
    fc.record({ string: fc.integer({ min: 1, max: prof.stringCount }), fret: fc.integer({ min: 0, max: prof.fretCount }) });

  it('noteAt / positionsOf round trip on every preset', () => {
    for (const p of presets()) {
      fc.assert(fc.property(posArb(p.profile), (pos) => roundTrip(p.profile, pos)), { numRuns: 50 });
    }
  });

  it('noteAt / positionsOf round trip on generated instruments', () => {
    fc.assert(
      fc.property(generatedProfileArb.chain((prof) => fc.tuple(fc.constant(prof), posArb(prof))), ([prof, pos]) => roundTrip(prof, pos)),
      runs,
    );
  });

  it('positionsOf returns exactly the brute-force set (pitch class and exact pitch, any window and string filter)', () => {
    const caseArb = fc.oneof(generatedProfileArb, fc.constantFrom(...presets().map((p) => p.profile))).chain((prof) =>
      fc.tuple(
        fc.constant(prof),
        fc.integer({ min: 0, max: prof.fretCount }),
        fc.integer({ min: 0, max: prof.fretCount }),
        fc.option(fc.subarray(Array.from({ length: prof.stringCount }, (_, k) => k + 1), { minLength: 1 }), { nil: undefined }),
        fc.oneof(
          fc.integer({ min: 0, max: 11 }).map((pc) => ({ pitchClass: pc })),
          fc.integer({ min: prof.pitchRange.lowMidi - 2, max: prof.pitchRange.highMidi + 2 }).map((m) => ({ midi: m })),
        ),
      ),
    );
    fc.assert(
      fc.property(caseArb, ([prof, a, b, strings, target]) => {
        const fromFret = Math.min(a, b);
        const toFret = Math.max(a, b);
        const range = strings ? { fromFret, toFret, strings } : { fromFret, toFret };
        const expected: FretPosition[] = [];
        for (let s = 1; s <= prof.stringCount; s++) {
          if (strings && !strings.includes(s)) continue;
          for (let f = fromFret; f <= toFret; f++) {
            const m = openMidi(prof, s) + f;
            if ('midi' in target ? m === target.midi : ((m % 12) + 12) % 12 === target.pitchClass) expected.push({ string: s, fret: f });
          }
        }
        expect(sortPos(positionsOf(prof, target, range))).toEqual(sortPos(expected));
      }),
      runs,
    );
  });

  it('every string count and every fret count 12..24 maps its last fret and rejects the next one', () => {
    for (const { family, stringCount } of STRING_COUNTS) {
      for (let fretCount = FRET_MIN; fretCount <= FRET_MAX; fretCount++) {
        const sample = fc.sample(instrumentInputArb({ family, stringCount }), { numRuns: 1, seed: stringCount * 100 + fretCount })[0]!;
        const prof = unwrap(validateProfile({ ...sample, fretCount }));
        expect(prof.stringCount).toBe(stringCount);
        for (let s = 1; s <= stringCount; s++) {
          expect(midi(unwrap(noteAt(prof, { string: s, fret: fretCount })))).toBe(openMidi(prof, s) + fretCount);
        }
        expectErr(noteAt(prof, { string: 1, fret: fretCount + 1 }), 'OutOfRange');
        expectErr(noteAt(prof, { string: stringCount + 1, fret: 0 }), 'OutOfRange');
      }
    }
  });

  it('noteAt is deterministic (FR-010)', () => {
    fc.assert(
      fc.property(generatedProfileArb.chain((prof) => fc.tuple(fc.constant(prof), posArb(prof))), ([prof, pos]) => {
        expect(noteAt(prof, pos)).toEqual(noteAt(prof, pos));
      }),
      { numRuns: 50 },
    );
  });
});

describe('FR-062 fretX', () => {
  const standardWith = (fretCount: number) => unwrap(validateProfile(inputFromText('guitar', ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'], fretCount)));

  it.each(fixture.fretX.values)('fretCount $fretCount, fret $fret: uniform $uniform, proportional $proportional', (row) => {
    const prof = standardWith(row.fretCount);
    expect(fretX(prof, row.fret, 'uniform')).toBeCloseTo(row.uniform, 5);
    expect(fretX(prof, row.fret, 'proportional')).toBeCloseTo(row.proportional, 5);
  });

  it('proportional: the 12th fret sits at half the scale length, i.e. 0.5 / (1 - 2^(-N/12)) after normalising', () => {
    for (let n = 12; n <= 24; n++) {
      expect(fretX(standardWith(n), 12, 'proportional')).toBeCloseTo(0.5 / (1 - 2 ** (-n / 12)), 9);
    }
  });

  it('proportional spacing is normalised, so it does not depend on the scale length', () => {
    const a = unwrap(validateProfile(inputFromText('bass', ['E1', 'A1', 'D2', 'G2'], 20, 760)));
    const b = unwrap(validateProfile(inputFromText('bass', ['E1', 'A1', 'D2', 'G2'], 20, 864)));
    for (let f = 0; f <= 20; f++) expect(fretX(a, f, 'proportional')).toBeCloseTo(fretX(b, f, 'proportional'), 12);
  });

  it('property: for both modes, fretX(0) = 0, fretX(last) = 1, strictly increasing, inside [0, 1]', () => {
    fc.assert(
      fc.property(fc.oneof(generatedProfileArb, fc.constantFrom(...presets().map((p) => p.profile))), fc.constantFrom<'uniform' | 'proportional'>('uniform', 'proportional'), (prof, mode) => {
        const xs = Array.from({ length: prof.fretCount + 1 }, (_, f) => fretX(prof, f, mode));
        expect(xs[0]).toBeCloseTo(0, 12);
        expect(xs[prof.fretCount]).toBeCloseTo(1, 12);
        for (let f = 1; f <= prof.fretCount; f++) expect(xs[f]!).toBeGreaterThan(xs[f - 1]!);
        for (const x of xs) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(1);
        }
      }),
      { numRuns: 120 },
    );
  });

  it('property: proportional fret gaps shrink up the neck (each gap is 2^(-1/12) of the previous)', () => {
    fc.assert(
      fc.property(generatedProfileArb, (prof) => {
        for (let f = 2; f <= prof.fretCount; f++) {
          const g1 = fretX(prof, f - 1, 'proportional') - fretX(prof, f - 2, 'proportional');
          const g2 = fretX(prof, f, 'proportional') - fretX(prof, f - 1, 'proportional');
          expect(g2 / g1).toBeCloseTo(2 ** (-1 / 12), 9);
        }
      }),
      { numRuns: 100 },
    );
  });
});
