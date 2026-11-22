// T012: default black-key spelling (FR-019, Edge Cases) and the chromatic map (FR-060).
// Expected values: fixtures/theory/spelling.json.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { defaultSpelling, chromaticLabel, buildScale, buildChord, pitchClass } from '../src/index';
import fixture from '../../../fixtures/theory/spelling.json';
import scales from '../../../fixtures/theory/scales.json';
import chords from '../../../fixtures/theory/chords.json';
import { fmtPc, pcn, spell, unwrap } from './arbitraries';

const BLACK = [1, 3, 6, 8, 10] as const;
const WHITE = fixture.whiteKeyDefaults.values as Record<string, string>;
const SCALE_DEFAULTS = fixture.defaultSpelling.scales as Record<string, Record<string, string>>;
const CHORD_DEFAULTS = fixture.defaultSpelling.chords as Record<string, Record<string, string>>;
const SCALE_IDS = Object.keys(scales.formulas.values);
const QUALITY_IDS = Object.keys(chords.formulas.values);
const CHROMATIC = fixture.chromatic.values as Record<string, Record<string, { spelled: string; degree: string }>>;

const accidentalCount = (notes: { accidental: number }[]) => notes.reduce((s, n) => s + Math.abs(n.accidental), 0);

describe('FR-019 / Edge Cases default black-key spelling: scales', () => {
  for (const typeId of SCALE_IDS) {
    it.each(BLACK.map((pc) => [pc, SCALE_DEFAULTS[typeId]![pc]!] as const))(`${typeId}: pc %i -> %s`, (pc, expected) => {
      expect(fmtPc(spell(defaultSpelling(pc, { typeId })))).toBe(expected);
    });
  }

  it('spec examples: F# major and D# minor (ties go to sharps), Db major (5 flats beat 7 sharps)', () => {
    expect(fmtPc(spell(defaultSpelling(6, { typeId: 'major' })))).toBe('F#');
    expect(fmtPc(spell(defaultSpelling(3, { typeId: 'natural-minor' })))).toBe('D#');
    expect(fmtPc(spell(defaultSpelling(1, { typeId: 'major' })))).toBe('Db');
  });
});

describe('FR-019 / Edge Cases default black-key spelling: chords', () => {
  for (const qualityId of QUALITY_IDS) {
    it.each(BLACK.map((pc) => [pc, CHORD_DEFAULTS[qualityId]![pc]!] as const))(`${qualityId}: pc %i -> %s`, (pc, expected) => {
      expect(fmtPc(spell(defaultSpelling(pc, { qualityId })))).toBe(expected);
    });
  }
});

describe('Edge Cases default spelling rule, checked independently of the fixture table', () => {
  // The rule restated: among the sharp and flat spellings of a black key, fewer total accidentals
  // in the resulting tones wins (double = 2), ties go to sharps. This recomputes it from the
  // built scales/chords, so the fixture table and the builder must agree with the rule.
  const sharpOf = (pc: number) => pcn(({ 1: 'C#', 3: 'D#', 6: 'F#', 8: 'G#', 10: 'A#' } as Record<number, string>)[pc]!);
  const flatOf = (pc: number) => pcn(({ 1: 'Db', 3: 'Eb', 6: 'Gb', 8: 'Ab', 10: 'Bb' } as Record<number, string>)[pc]!);

  it('holds for every black key x scale type x chord quality', () => {
    for (const pc of BLACK) {
      for (const [ctx, build] of [
        ...SCALE_IDS.map((typeId) => [{ typeId }, (r: ReturnType<typeof pcn>) => buildScale(r, typeId)] as const),
        ...QUALITY_IDS.map((qualityId) => [{ qualityId }, (r: ReturnType<typeof pcn>) => buildChord(r, qualityId)] as const),
      ]) {
        const s = build(sharpOf(pc));
        const f = build(flatOf(pc));
        const sc = s.ok ? accidentalCount(s.value) : Infinity;
        const fcnt = f.ok ? accidentalCount(f.value) : Infinity;
        const expected = sc <= fcnt ? sharpOf(pc) : flatOf(pc);
        expect(spell(defaultSpelling(pc, ctx))).toEqual(expected);
      }
    }
  });
});

describe('Default spelling for white keys (assumption: natural letter, see fixture note)', () => {
  it.each(Object.entries(WHITE))('pc %s -> %s in every context', (pc, expected) => {
    for (const typeId of SCALE_IDS) expect(fmtPc(spell(defaultSpelling(Number(pc), { typeId })))).toBe(expected);
    for (const qualityId of QUALITY_IDS) expect(fmtPc(spell(defaultSpelling(Number(pc), { qualityId })))).toBe(expected);
  });

  it('property: the default spelling always has the requested pitch class', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 11 }), fc.constantFrom(...SCALE_IDS), (pc, typeId) => {
        expect(pitchClass(defaultSpelling(pc, { typeId }))).toBe(pc);
      }),
      { numRuns: 200 },
    );
  });
});

describe('FR-060 chromatic map relative to the context root', () => {
  it('in C: C Db D Eb E F F# G Ab A Bb B with degrees 1 b2 2 b3 3 4 #4 5 b6 6 b7 7', () => {
    const got = Array.from({ length: 12 }, (_, pc) => chromaticLabel(pcn('C'), pc));
    expect(got.map((g) => fmtPc(spell(g.spelled)))).toEqual(['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']);
    expect(got.map((g) => g.degree)).toEqual(['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7']);
  });

  it('double accidentals are allowed: Cb root, b6 = Abb', () => {
    const g = chromaticLabel(pcn('Cb'), 7);
    expect(fmtPc(spell(g.spelled))).toBe('Abb');
    expect(g.degree).toBe('b6');
  });

  for (const [root, table] of Object.entries(CHROMATIC)) {
    it(`root ${root}: all 12 pitch classes`, () => {
      for (const [pc, expected] of Object.entries(table)) {
        const g = chromaticLabel(pcn(root), Number(pc));
        expect({ spelled: fmtPc(spell(g.spelled)), degree: g.degree }).toEqual(expected);
      }
    });
  }

  it('property: the spelled note has the requested pitch class', () => {
    const roots = Object.keys(CHROMATIC);
    fc.assert(
      fc.property(fc.constantFrom(...roots), fc.integer({ min: 0, max: 11 }), (root, pc) => {
        expect(pitchClass(chromaticLabel(pcn(root), pc).spelled)).toBe(pc);
      }),
      { numRuns: 300 },
    );
  });

  it('notes inside a heptatonic major context agree with the map on 1 2 3 4 5 6 7 (sanity link FR-006 / FR-060)', () => {
    for (const root of Object.keys(CHROMATIC)) {
      const scale = unwrap(buildScale(pcn(root), 'major'));
      const labels = scale.map((n) => chromaticLabel(pcn(root), pitchClass(n)));
      expect(labels.map((l) => l.degree)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
      expect(labels.map((l) => fmtPc(spell(l.spelled)))).toEqual(scale.map((n) => fmtPc(spell(n))));
    }
  });
});
