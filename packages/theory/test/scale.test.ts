// T012: scales (FR-003, FR-004, FR-006, FR-010, SC-001). Expected values: fixtures/theory/scales.json.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { scaleTypes, buildScale, degreeLabels } from '../src/index';
import type { Interval } from '../src/index';
import fixture from '../../../fixtures/theory/scales.json';
import { LETTERS, expectErr, fmtPc, pcn, spell, unwrap } from './arbitraries';

type Expected = string[] | { error: string };
const SPELLINGS = fixture.spellings.values as Record<string, Record<string, Expected>>;
const FORMULAS = fixture.formulas.values as Record<string, string[]>;
const SCALE_IDS = Object.keys(FORMULAS);
const ROOTS = fixture.roots.values;
const ivText = (i: Interval) => `${i.direction === 'down' ? '-' : ''}${i.quality}${i.number}`;
const withoutUnison = (xs: string[]) => xs.filter((x) => x !== 'P1');

describe('FR-003 scale catalogue', () => {
  it('has exactly the 12 scale types', () => {
    const ids = scaleTypes().map((s) => s.id);
    expect(ids).toHaveLength(12);
    expect([...ids].sort()).toEqual([...SCALE_IDS].sort());
  });

  it.each(SCALE_IDS)('%s has the FR-003 formula, a name and the right heptatonic flag', (id) => {
    const t = scaleTypes().find((s) => s.id === id);
    expect(t).toBeDefined();
    expect(withoutUnison(t!.formula.map(ivText))).toEqual(withoutUnison(FORMULAS[id]!));
    expect(typeof t!.name).toBe('string');
    expect(t!.name.length).toBeGreaterThan(0);
    expect(t!.heptatonic).toBe((fixture.heptatonic.values as Record<string, boolean>)[id]);
  });
});

describe('FR-003 / SC-001 buildScale: 21 roots x 12 scale types', () => {
  for (const id of SCALE_IDS) {
    describe(id, () => {
      it.each(ROOTS)('root %s', (root) => {
        const expected = SPELLINGS[id]![root]!;
        const r = buildScale(pcn(root), id);
        if (Array.isArray(expected)) {
          expect(unwrap(r).map((p) => fmtPc(spell(p)))).toEqual(expected);
        } else {
          expectErr(r, 'TripleAccidental');
        }
      });
    });
  }
});

describe('FR-004 / Edge Cases named spellings', () => {
  it.each(fixture.edgeCases.values)('$root $typeId = $notes', (row) => {
    expect(unwrap(buildScale(pcn(row.root), row.typeId)).map(fmtPc)).toEqual(row.notes);
  });
});

describe('FR-003 aliases', () => {
  it.each(Object.entries(fixture.aliases.values))('%s builds the same scale as %s', (alias, canonical) => {
    for (const root of ROOTS) {
      expect(buildScale(pcn(root), alias)).toEqual(buildScale(pcn(root), canonical));
    }
  });
});

describe('FR-010 unknown scale type', () => {
  it.each(['', 'Major', 'super-locrian', 'dorian ', 'bebop'])('"%s" is UnknownType', (id) => {
    expectErr(buildScale(pcn('C'), id), 'UnknownType');
  });
});

describe('FR-006 degree labels', () => {
  it.each(SCALE_IDS)('%s degree labels follow the formula', (id) => {
    const expected = (fixture.degreeLabels.values as Record<string, string[]>)[id];
    for (const root of ROOTS) {
      expect(degreeLabels(pcn(root), id)).toEqual(expected);
    }
  });
});

describe('FR-004 property: heptatonic scales use each letter exactly once, in order from the root', () => {
  const heptatonicIds = SCALE_IDS.filter((id) => (fixture.heptatonic.values as Record<string, boolean>)[id]);

  it('holds for every spelled root (|accidental| <= 1) and heptatonic type', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ROOTS), fc.constantFrom(...heptatonicIds), (root, id) => {
        const notes = unwrap(buildScale(pcn(root), id));
        expect(notes).toHaveLength(7);
        expect(new Set(notes.map((n) => n.letter)).size).toBe(7);
        const start = LETTERS.indexOf(pcn(root).letter);
        expect(notes.map((n) => n.letter)).toEqual(LETTERS.map((_, k) => LETTERS[(start + k) % 7]));
        expect(spell(notes[0]!)).toEqual(pcn(root));
      }),
      { numRuns: 300 },
    );
  });

  it('every built scale starts on its root and never contains a triple accidental', () => {
    for (const id of SCALE_IDS) {
      for (const root of ROOTS) {
        const r = buildScale(pcn(root), id);
        if (!r.ok) continue;
        expect(spell(r.value[0]!)).toEqual(pcn(root));
        for (const n of r.value) expect(Math.abs(n.accidental)).toBeLessThanOrEqual(2);
      }
    }
  });
});
