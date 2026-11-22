// T010: notes (FR-001, FR-010). Expected values: fixtures/theory/notes.json (hand-derived).
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseNote, formatNote, midi, pitchClass } from '../src/index';
import fixture from '../../../fixtures/theory/notes.json';
import { expectErr, fmtNote, note, noteArb, pcn, pitchClassNoteArb, refMidi, refPc, spellN, unwrap } from './arbitraries';

describe('FR-001 spelled notes: parseNote', () => {
  it.each(fixture.spelled.values)('parses $text', (row) => {
    const n = unwrap(parseNote(row.text));
    expect(spellN(n)).toEqual({ letter: row.letter, accidental: row.accidental, octave: row.octave });
  });

  it('parses all 21 spelled roots in every octave 0-8', () => {
    for (const root of fixture.roots.values) {
      for (let octave = 0; octave <= 8; octave++) {
        const n = unwrap(parseNote(`${root.text}${octave}`));
        expect(spellN(n)).toEqual({ letter: root.letter, accidental: root.accidental, octave });
      }
    }
  });
});

describe('FR-001 pitch number: midi (octave follows the letter)', () => {
  it.each(fixture.spelled.values)('midi($text) = $midi', (row) => {
    expect(midi(note(row.text))).toBe(row.midi);
  });

  it('Cb4 = 59 (pitch of B3) and B#3 = 60 (pitch of C4)', () => {
    expect(midi(note('Cb4'))).toBe(59);
    expect(midi(note('B3'))).toBe(59);
    expect(midi(note('B#3'))).toBe(60);
    expect(midi(note('C4'))).toBe(60);
  });

  it('property: midi matches the published definition 12*(octave+1) + letter pc + accidental', () => {
    fc.assert(fc.property(noteArb(2), (n) => midi(n) === refMidi(n)), { numRuns: 500 });
  });
});

describe('FR-001 pitch class: pitchClass', () => {
  it.each(fixture.roots.values)('pitchClass($text) = $pitchClass', (row) => {
    expect(pitchClass(pcn(row.text))).toBe(row.pitchClass);
  });

  it.each(fixture.spelled.values)('pitchClass($text) = $pitchClass', (row) => {
    expect(pitchClass(note(row.text))).toBe(row.pitchClass);
  });

  it('property: pitchClass(note) = midi(note) mod 12 and is in 0..11', () => {
    fc.assert(
      fc.property(noteArb(2), (n) => {
        const pc = pitchClass(n);
        return pc === ((refMidi(n) % 12) + 12) % 12 && Number.isInteger(pc) && pc >= 0 && pc <= 11;
      }),
      { numRuns: 500 },
    );
  });

  it('property: pitchClass of a PitchClassNote matches the reference', () => {
    fc.assert(fc.property(pitchClassNoteArb(2), (p) => pitchClass(p) === refPc(p)), { numRuns: 300 });
  });
});

describe('FR-001 formatNote', () => {
  it.each(fixture.spelled.values)('formats $text in ascii (default)', (row) => {
    expect(formatNote(note(row.text))).toBe(row.text);
    expect(formatNote(note(row.text), 'ascii')).toBe(row.text);
  });

  it.each(fixture.unicode.values)('formats $text as $unicode in unicode style', (row) => {
    expect(formatNote(note(row.text), 'unicode')).toBe(row.unicode);
  });

  it('property: parseNote(formatNote(n)) round-trips every note with |accidental| <= 2', () => {
    fc.assert(
      fc.property(noteArb(2), (n) => {
        const text = formatNote(n);
        expect(text).toBe(fmtNote(n));
        expect(spellN(unwrap(parseNote(text)))).toEqual(n);
      }),
      { numRuns: 300 },
    );
  });
});

describe('FR-010 invalid note text is a typed error', () => {
  it.each(fixture.invalid.values)('rejects "$text" with $kind', (row) => {
    expectErr(parseNote(row.text), row.kind as 'InvalidNote' | 'TripleAccidental');
  });

  it('Edge Cases: anything needing a triple accidental is TripleAccidental, never a silent respelling', () => {
    for (const text of ['E###2', 'Abbb3', 'B###3', 'Fbbb4']) {
      expectErr(parseNote(text), 'TripleAccidental');
    }
  });
});
