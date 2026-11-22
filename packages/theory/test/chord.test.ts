// T012: chords (FR-005, FR-006, FR-010, SC-001). Expected values: fixtures/theory/chords.json.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { chordQualities, buildChord, chordSymbol, functionLabels, midi } from '../src/index';
import type { Interval } from '../src/index';
import fixture from '../../../fixtures/theory/chords.json';
import scales from '../../../fixtures/theory/scales.json';
import { expectErr, fmtPc, pcn, refSemitones, spell, unwrap } from './arbitraries';

type Expected = string[] | { error: string };
const SPELLINGS = fixture.spellings.values as Record<string, Record<string, Expected>>;
const FORMULAS = fixture.formulas.values as Record<string, string[]>;
const SUFFIX = fixture.symbolSuffix.values as Record<string, string>;
const FUNCTIONS = fixture.functionLabels.values as Record<string, string[]>;
const QUALITY_IDS = Object.keys(FORMULAS);
const ROOTS = scales.roots.values;
const ivText = (i: Interval) => `${i.direction === 'down' ? '-' : ''}${i.quality}${i.number}`;
const withoutUnison = (xs: string[]) => xs.filter((x) => x !== 'P1');

describe('FR-005 chord catalogue', () => {
  it('has exactly the 12 chord qualities', () => {
    const ids = chordQualities().map((q) => q.id);
    expect(ids).toHaveLength(12);
    expect([...ids].sort()).toEqual([...QUALITY_IDS].sort());
  });

  it.each(QUALITY_IDS)('%s has the FR-005 formula, symbol suffix and FR-006 functions', (id) => {
    const q = chordQualities().find((c) => c.id === id)!;
    expect(q).toBeDefined();
    expect(withoutUnison(q.formula.map(ivText))).toEqual(withoutUnison(FORMULAS[id]!));
    expect(q.symbolSuffix).toBe(SUFFIX[id]);
    expect(q.functions).toEqual(FUNCTIONS[id]);
  });
});

describe('FR-005 / SC-001 buildChord: 21 roots x 12 qualities (spelled by interval)', () => {
  for (const id of QUALITY_IDS) {
    describe(id, () => {
      it.each(ROOTS)('root %s', (root) => {
        const expected = SPELLINGS[id]![root]!;
        const r = buildChord(pcn(root), id);
        if (Array.isArray(expected)) expect(unwrap(r).map((p) => fmtPc(spell(p)))).toEqual(expected);
        else expectErr(r, 'TripleAccidental');
      });
    });
  }

  it('Cdim7 = C Eb Gb Bbb (FR-005, Edge Cases)', () => {
    expect(unwrap(buildChord(pcn('C'), 'dim7')).map(fmtPc)).toEqual(['C', 'Eb', 'Gb', 'Bbb']);
  });

  it('triple-accidental chords are typed errors: B# aug (F###), Cb dim7 (Bbbb), Fb dim7 (Ebbb)', () => {
    expectErr(buildChord(pcn('B#'), 'aug'), 'TripleAccidental');
    expectErr(buildChord(pcn('Cb'), 'dim7'), 'TripleAccidental');
    expectErr(buildChord(pcn('Fb'), 'dim7'), 'TripleAccidental');
  });

  it('unknown quality is UnknownType', () => {
    for (const id of ['', 'maj', 'min9', 'Dim7', 'm7b5 ']) expectErr(buildChord(pcn('C'), id), 'UnknownType');
  });
});

describe('FR-005 chordSymbol canonical symbols', () => {
  it('shown for C: C, Cm, Cdim, Caug, Csus2, Csus4, C7, Cmaj7, Cm7, Cm7b5, Cdim7, Cadd9', () => {
    expect(QUALITY_IDS.map((id) => chordSymbol(pcn('C'), id))).toEqual([
      'C', 'Cm', 'Cdim', 'Caug', 'Csus2', 'Csus4', 'C7', 'Cmaj7', 'Cm7', 'Cm7b5', 'Cdim7', 'Cadd9',
    ]);
  });

  it('every root x quality = root spelling + suffix (ascii default)', () => {
    for (const root of ROOTS) {
      for (const id of QUALITY_IDS) {
        expect(chordSymbol(pcn(root), id)).toBe(root + SUFFIX[id]);
        expect(chordSymbol(pcn(root), id, 'ascii')).toBe(root + SUFFIX[id]);
      }
    }
  });

  it('unicode style renders the root accidental as a flat/sharp sign', () => {
    expect(chordSymbol(pcn('F#'), 'major', 'unicode')).toBe('F♯');
    expect(chordSymbol(pcn('Bb'), 'minor', 'unicode')).toBe('B♭m');
    expect(chordSymbol(pcn('C'), 'maj7', 'unicode')).toBe('Cmaj7');
  });
});

describe('FR-006 chord-tone function labels', () => {
  it.each(QUALITY_IDS)('%s', (id) => {
    for (const root of ROOTS) expect(functionLabels(pcn(root), id)).toEqual(FUNCTIONS[id]);
  });
});

describe('FR-005 property: chord tones sit at the formula distances above the root', () => {
  it('each tone is the root raised by its formula interval (pitch-class check)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ROOTS), fc.constantFrom(...QUALITY_IDS), (root, id) => {
        const r = buildChord(pcn(root), id);
        if (!r.ok) return;
        const rootMidi = midi({ ...pcn(root), octave: 4 });
        r.value.forEach((tone, k) => {
          const expectedPc = (((rootMidi + refSemitones({ ...parse(FORMULAS[id]![k]!), direction: 'up' } as Interval)) % 12) + 12) % 12;
          expect((((midi({ ...spell(tone), octave: 4 })) % 12) + 12) % 12).toBe(expectedPc);
        });
      }),
      { numRuns: 300 },
    );
  });
});

function parse(text: string): Pick<Interval, 'quality' | 'number'> {
  return { quality: text[0] as Interval['quality'], number: Number(text.slice(1)) } as Pick<Interval, 'quality' | 'number'>;
}
