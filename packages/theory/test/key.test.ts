// T063: keys and diatonic chords (FR-007, FR-038, SC-001). Expected values: fixtures/theory/keys.json
// (stacked thirds on the major / natural-minor scale, cross-checked two ways) and US5 scenarios 1-2
// written out by hand below.
import { describe, it, expect } from 'vitest';
import { keys, diatonicChords } from '../src/index';
import type { DiatonicChord, Key } from '../src/index';
import fixture from '../../../fixtures/theory/keys.json';
import { fmtPc, pcn, spell, unwrap } from './arbitraries';

type FxChord = { numeral: string; root: string; qualityId: string; symbol: string; tones: string[]; functions: string[] };
type FxKey = { tonic: string; mode: 'major' | 'minor'; triads: FxChord[]; sevenths: FxChord[]; harmonicMinor?: { triads: FxChord[]; sevenths: FxChord[] } };
const KEYS = fixture.values as FxKey[];

const keyOf = (k: FxKey): Key => ({ tonic: pcn(k.tonic), mode: k.mode });
const view = (c: DiatonicChord): FxChord => ({
  numeral: c.numeral,
  root: fmtPc(spell(c.root)),
  qualityId: c.qualityId,
  symbol: c.symbol,
  tones: c.tones.map((t) => fmtPc(spell(t))),
  functions: [...c.functions],
});
const label = (k: FxKey) => `${k.tonic} ${k.mode}`;

describe('FR-007 the 30 keys', () => {
  it('keys() returns exactly the 15 major and 15 minor key signatures', () => {
    const got = keys().map((k) => `${fmtPc(spell(k.tonic))} ${k.mode}`).sort();
    expect(got).toHaveLength(30);
    expect(got).toEqual(KEYS.map(label).sort());
  });

  it('includes the enharmonic pairs and the 7-accidental spellings (FR-038)', () => {
    const got = new Set(keys().map((k) => `${fmtPc(spell(k.tonic))} ${k.mode}`));
    for (const k of ['B major', 'Cb major', 'F# major', 'Gb major', 'C# major', 'Db major', 'G# minor', 'Ab minor', 'D# minor', 'Eb minor', 'A# minor', 'Bb minor']) {
      expect(got).toContain(k);
    }
  });
});

describe('US5 scenario 1: G major (hand-written)', () => {
  const g: Key = { tonic: pcn('G'), mode: 'major' };
  it('triads: I G, ii Am, iii Bm, IV C, V D, vi Em, vii° F#dim', () => {
    const r = unwrap(diatonicChords(g, { sevenths: false, harmonicMinor: false }));
    expect(r.map((c) => `${c.numeral} ${c.symbol}`)).toEqual(['I G', 'ii Am', 'iii Bm', 'IV C', 'V D', 'vi Em', 'vii° F#dim']);
  });
  it('sevenths: Imaj7 Gmaj7, ii7 Am7, iii7 Bm7, IVmaj7 Cmaj7, V7 D7, vi7 Em7, viiø7 F#m7b5', () => {
    const r = unwrap(diatonicChords(g, { sevenths: true, harmonicMinor: false }));
    expect(r.map((c) => `${c.numeral} ${c.symbol}`)).toEqual([
      'Imaj7 Gmaj7', 'ii7 Am7', 'iii7 Bm7', 'IVmaj7 Cmaj7', 'V7 D7', 'vi7 Em7', 'viiø7 F#m7b5',
    ]);
  });
});

describe('US5 scenario 2: A minor (hand-written)', () => {
  const a: Key = { tonic: pcn('A'), mode: 'minor' };
  it('triads: i Am, ii° Bdim, III C, iv Dm, v Em, VI F, VII G', () => {
    const r = unwrap(diatonicChords(a, { sevenths: false, harmonicMinor: false }));
    expect(r.map((c) => `${c.numeral} ${c.symbol}`)).toEqual(['i Am', 'ii° Bdim', 'III C', 'iv Dm', 'v Em', 'VI F', 'VII G']);
  });
  it('sevenths: i7 Am7, iiø7 Bm7b5, IIImaj7 Cmaj7, iv7 Dm7, v7 Em7, VImaj7 Fmaj7, VII7 G7', () => {
    const r = unwrap(diatonicChords(a, { sevenths: true, harmonicMinor: false }));
    expect(r.map((c) => `${c.numeral} ${c.symbol}`)).toEqual([
      'i7 Am7', 'iiø7 Bm7b5', 'IIImaj7 Cmaj7', 'iv7 Dm7', 'v7 Em7', 'VImaj7 Fmaj7', 'VII7 G7',
    ]);
  });
  it('harmonic-minor alternatives add V E and vii° G#dim (triads), V7 E7 and vii°7 G#dim7 (sevenths)', () => {
    const t = unwrap(diatonicChords(a, { sevenths: false, harmonicMinor: true })).map((c) => `${c.numeral} ${c.symbol}`);
    expect(t).toEqual(expect.arrayContaining(['V E', 'vii° G#dim', 'v Em', 'VII G']));
    const s = unwrap(diatonicChords(a, { sevenths: true, harmonicMinor: true })).map((c) => `${c.numeral} ${c.symbol}`);
    expect(s).toEqual(expect.arrayContaining(['V7 E7', 'vii°7 G#dim7', 'v7 Em7', 'VII7 G7']));
  });
});

describe('FR-007 / SC-001 all 30 keys against the fixture', () => {
  it.each(KEYS)('$tonic $mode: 7 triads in degree order', (k) => {
    const r = unwrap(diatonicChords(keyOf(k), { sevenths: false, harmonicMinor: false }));
    expect(r.map(view)).toEqual(k.triads);
  });

  it.each(KEYS)('$tonic $mode: 7 sevenths in degree order', (k) => {
    const r = unwrap(diatonicChords(keyOf(k), { sevenths: true, harmonicMinor: false }));
    expect(r.map(view)).toEqual(k.sevenths);
  });

  it.each(KEYS.filter((k) => k.mode === 'minor'))('$tonic minor: harmonic-minor alternatives are added, natural-minor chords kept', (k) => {
    const tri = unwrap(diatonicChords(keyOf(k), { sevenths: false, harmonicMinor: true })).map(view);
    expect(tri.slice(0, 7)).toEqual(k.triads);
    expect(tri).toEqual(expect.arrayContaining(k.harmonicMinor!.triads));
    expect(tri).toHaveLength(9);
    const sev = unwrap(diatonicChords(keyOf(k), { sevenths: true, harmonicMinor: true })).map(view);
    expect(sev.slice(0, 7)).toEqual(k.sevenths);
    expect(sev).toEqual(expect.arrayContaining(k.harmonicMinor!.sevenths));
    expect(sev).toHaveLength(9);
  });

  it('G# harmonic minor V7 is D#7 with F## (Edge Cases)', () => {
    const r = unwrap(diatonicChords({ tonic: pcn('G#'), mode: 'minor' }, { sevenths: true, harmonicMinor: true })).map(view);
    const v7 = r.find((c) => c.numeral === 'V7')!;
    expect(v7.symbol).toBe('D#7');
    expect(v7.tones).toEqual(['D#', 'F##', 'A#', 'C#']);
  });

  it('A# harmonic minor vii°7 is G##dim7 = G## B# D# F#', () => {
    const r = unwrap(diatonicChords({ tonic: pcn('A#'), mode: 'minor' }, { sevenths: true, harmonicMinor: true })).map(view);
    const vii = r.find((c) => c.numeral === 'vii°7')!;
    expect(vii.symbol).toBe('G##dim7');
    expect(vii.tones).toEqual(['G##', 'B#', 'D#', 'F#']);
  });
});

