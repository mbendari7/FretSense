// T014: instrument profiles, presets and geometry ids (FR-009, FR-051, FR-052, FR-053, FR-010, SC-011).
// Expected values: fixtures/theory/instruments.json (hand-derived from FR-009 and research R6).
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { presets, validateProfile, geometryId, midi } from '../src/index';
import type { InstrumentFamily, InstrumentProfile, Note } from '../src/index';
import fixture from '../../../fixtures/theory/instruments.json';
import {
  FRET_MAX,
  FRET_MIN,
  STRING_COUNTS,
  expectErr,
  fmtNote,
  inputFromText,
  instrumentInputArb,
  note,
  refMidi,
  spellN,
  unwrap,
} from './arbitraries';

const PRESETS = fixture.presets.values;

describe('FR-009 / FR-052 built-in presets', () => {
  it('ships exactly the 7 presets', () => {
    expect(presets().map((p) => p.presetId).sort()).toEqual(PRESETS.map((p) => p.presetId).sort());
  });

  it.each(PRESETS)('$presetId: open strings, family, fret count, scale length, pitch range, geometry id', (row) => {
    const p = presets().find((x) => x.presetId === row.presetId);
    expect(p).toBeDefined();
    const prof = p!.profile;
    expect(prof.family).toBe(row.family);
    expect(prof.stringCount).toBe(row.tuning.length);
    expect(prof.tuning.map(spellN)).toEqual(row.tuning.map(note));
    expect(prof.tuning.map(midi)).toEqual(row.tuningMidi);
    expect(prof.fretCount).toBe(row.fretCount);
    expect(prof.scaleLengthMm).toBe(row.scaleLengthMm);
    expect(prof.pitchRange).toEqual(row.pitchRange);
    expect(prof.geometryId).toBe(row.geometryId);
  });

  it('every preset is itself a valid profile (validateProfile accepts it unchanged)', () => {
    for (const p of presets()) {
      const again = unwrap(
        validateProfile({ family: p.profile.family, tuning: p.profile.tuning, fretCount: p.profile.fretCount, scaleLengthMm: p.profile.scaleLengthMm }),
      );
      expect(again.geometryId).toBe(p.profile.geometryId);
      expect(again.pitchRange).toEqual(p.profile.pitchRange);
    }
  });

  it('presets are immutable data: mutating a returned list does not change the next call', () => {
    const first = presets() as unknown as { presetId: string }[];
    try {
      first.length = 0;
    } catch {
      // frozen arrays are fine
    }
    expect(presets()).toHaveLength(7);
  });
});

describe('FR-051 / FR-053 validateProfile: valid boundaries', () => {
  it.each(fixture.validProfiles.values)('accepts: $name', (row) => {
    const prof = unwrap(validateProfile(inputFromText(row.family, row.tuning, row.fretCount)));
    expect(prof.family).toBe(row.family);
    expect(prof.stringCount).toBe(row.tuning.length);
    expect(prof.fretCount).toBe(row.fretCount);
    expect(prof.tuning.map(spellN)).toEqual(row.tuning.map(note));
  });

  it('defaults the scale length when omitted: guitar 648 mm, bass 864 mm (FR-053)', () => {
    const g = unwrap(validateProfile(inputFromText('guitar', ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'], 22)));
    const b = unwrap(validateProfile(inputFromText('bass', ['E1', 'A1', 'D2', 'G2'], 20)));
    expect(g.scaleLengthMm).toBe(fixture.defaults.guitar.scaleLengthMm);
    expect(b.scaleLengthMm).toBe(fixture.defaults.bass.scaleLengthMm);
  });

  it('keeps a given scale length', () => {
    expect(unwrap(validateProfile(inputFromText('guitar', ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'], 22, 628))).scaleLengthMm).toBe(628);
  });

  it.each(STRING_COUNTS)('every allowed string count is accepted: $family x $stringCount, frets 12..24', ({ family, stringCount }) => {
    fc.assert(
      fc.property(instrumentInputArb({ family, stringCount }), (input) => {
        const prof = unwrap(validateProfile(input));
        expect(prof.stringCount).toBe(stringCount);
        expect(prof.fretCount).toBeGreaterThanOrEqual(FRET_MIN);
        expect(prof.fretCount).toBeLessThanOrEqual(FRET_MAX);
      }),
      { numRuns: 40 },
    );
  });
});

describe('FR-053 / FR-010 validateProfile: invalid input is InvalidProfile', () => {
  it.each(fixture.invalidProfiles.values)('rejects: $name', (row) => {
    expectErr(validateProfile(inputFromText(row.family, row.tuning, row.fretCount)), 'InvalidProfile');
  });

  it('rejects an empty tuning', () => {
    expectErr(validateProfile(inputFromText('guitar', [], 22)), 'InvalidProfile');
  });

  it('rejects a tuning note with a triple accidental or an invalid letter smuggled in as a value', () => {
    const bad = [note('E2'), note('A2'), note('D3'), note('G3'), note('B3'), { letter: 'E', accidental: 3, octave: 4 } as unknown as Note];
    expect(validateProfile({ family: 'guitar', tuning: bad, fretCount: 22 }).ok).toBe(false);
    const bad2 = [note('E2'), note('A2'), note('D3'), note('G3'), note('B3'), { letter: 'H', accidental: 0, octave: 4 } as unknown as Note];
    expect(validateProfile({ family: 'guitar', tuning: bad2, fretCount: 22 }).ok).toBe(false);
  });

  it('property: any tuning with an open string outside the family range is rejected', () => {
    fc.assert(
      fc.property(
        instrumentInputArb(),
        fc.boolean(),
        fc.integer({ min: 1, max: 6 }),
        (input, below, by) => {
          const range = fixture.familyRanges[input.family as InstrumentFamily];
          const tuning = [...input.tuning];
          if (below) tuning[0] = { letter: 'C', accidental: 0, octave: 0 }; // C0 = 12, below both ranges
          else tuning[tuning.length - 1] = midiNote(range.highMidi + by);
          expectErr(validateProfile({ ...input, tuning }), 'InvalidProfile');
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('FR-051 / research R6 geometryId', () => {
  it.each(PRESETS)('$presetId -> $geometryId', (row) => {
    expect(geometryId(row.family as InstrumentFamily, row.tuning.map(note))).toBe(row.geometryId);
  });

  it('enharmonically equal tunings get different ids (Eb2 vs D#2)', () => {
    const eb = geometryId('guitar', ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'].map(note));
    const ds = geometryId('guitar', ['D#2', 'G#2', 'C#3', 'F#3', 'A#3', 'D#4'].map(note));
    expect(eb).toBe('guitar:Eb2-Ab2-Db3-Gb3-Bb3-Eb4');
    expect(ds).toBe('guitar:D#2-G#2-C#3-F#3-A#3-D#4');
    expect(eb).not.toBe(ds);
  });

  it('family is part of the id', () => {
    const t = ['E1', 'A1', 'D2', 'G2', 'B2', 'E3'].map(note);
    expect(geometryId('guitar', t)).not.toBe(geometryId('bass', t));
  });

  it('fret count and scale length are excluded', () => {
    const t = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
    const a = unwrap(validateProfile(inputFromText('guitar', t, 12, 600)));
    const b = unwrap(validateProfile(inputFromText('guitar', t, 24, 648)));
    expect(a.geometryId).toBe(b.geometryId);
  });

  it('property: deterministic, canonical "<family>:<N1>-<N2>-..." form, matches validateProfile', () => {
    fc.assert(
      fc.property(instrumentInputArb(), (input) => {
        const id = geometryId(input.family, input.tuning);
        expect(geometryId(input.family, input.tuning.map((n) => ({ ...n })))).toBe(id);
        expect(id).toBe(`${input.family}:${input.tuning.map(fmtNote).join('-')}`);
        expect(unwrap(validateProfile(input)).geometryId).toBe(id);
      }),
      { numRuns: 150 },
    );
  });

  it('property: changing the spelling of one string (same pitch) changes the id', () => {
    fc.assert(
      fc.property(instrumentInputArb(), fc.nat(), (input, k) => {
        const idx = k % input.tuning.length;
        const original = input.tuning[idx]!;
        const alt = alternativeSpelling(original);
        if (!alt) return;
        const tuning = input.tuning.map((n, i) => (i === idx ? alt : n));
        expect(refMidi(alt)).toBe(refMidi(original));
        expect(geometryId(input.family, tuning)).not.toBe(geometryId(input.family, input.tuning));
      }),
      { numRuns: 150 },
    );
  });
});

describe('FR-051 derived pitchRange', () => {
  it('property: lowMidi = lowest open string, highMidi = highest open string + fretCount', () => {
    fc.assert(
      fc.property(instrumentInputArb(), (input) => {
        const prof: InstrumentProfile = unwrap(validateProfile(input));
        const ms = input.tuning.map(refMidi);
        expect(prof.pitchRange).toEqual({ lowMidi: Math.min(...ms), highMidi: Math.max(...ms) + input.fretCount });
      }),
      { numRuns: 150 },
    );
  });
});

// --- local helpers (reference only) --------------------------------------------------------------
function midiNote(m: number): Note {
  // natural or sharp spelling of a MIDI number
  const names: [Note['letter'], number][] = [['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]];
  const [letter, acc] = names[((m % 12) + 12) % 12]!;
  return { letter, accidental: acc as Note['accidental'], octave: Math.floor(m / 12) - 1 };
}

function alternativeSpelling(n: Note): Note | null {
  const m = refMidi(n);
  for (const letter of ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const) {
    for (const a of [-2, -1, 0, 1, 2] as const) {
      if (letter === n.letter) continue;
      for (const octave of [n.octave - 1, n.octave, n.octave + 1]) {
        const cand: Note = { letter, accidental: a, octave };
        if (refMidi(cand) === m) return cand;
      }
    }
  }
  return null;
}
