/**
 * [T109][FR-048] validateSettings names the field a failure belongs to, so the UI can link the error
 * to its input without parsing the message: { ok:false, reason, field?: 'strings'|'frets'|'count' }.
 * Settings below are built by hand so each reaches exactly one rejection branch on guitar6-standard
 * (strings 1..6 = E B G D A E; MIDI of string 1 fret 0 = E4). Expected pitch facts are worked out
 * by hand in the comments, not read from the implementation.
 */
import { describe, expect, it } from 'vitest';
import { presetById } from '@fretsense/theory';
import { validateSettings } from './generate';
import type { DrillSettings } from './types';

const P = presetById('guitar6-standard')!.profile;
const base = (over: Partial<DrillSettings>): DrillSettings => ({
  type: 'note-finding', strings: [1, 2, 3, 4, 5, 6], fromFret: 0, toFret: 12, count: 20, octaveMode: 'any', ...over,
});
const fail = (s: DrillSettings) => {
  const v = validateSettings(P, s);
  if (v.ok) throw new Error('expected a rejection');
  return v as { ok: false; reason: string; field?: string };
};

describe('[T109][FR-048] validateSettings reports the offending field', () => {
  it('valid settings carry no field', () => {
    const v = validateSettings(P, base({}));
    expect(v.ok).toBe(true);
    expect('field' in v).toBe(false);
  });

  it.each([3, 4, 101, 500])('question count %i -> field "count"', (count) => {
    const v = fail(base({ count }));
    expect(v.reason).toMatch(/5 and 100/);
    expect(v.field).toBe('count');
  });

  it('no strings -> field "strings"', () => {
    const v = fail(base({ strings: [] }));
    expect(v.reason).toBe('Choose at least one string.');
    expect(v.field).toBe('strings');
  });

  it('only strings that do not exist on the instrument -> field "strings"', () => {
    expect(fail(base({ strings: [9] })).field).toBe('strings');
  });

  // Each rejection below asks for a range with no answer: a single open string (string 1, fret 0 = E).
  const frets: [string, Partial<DrillSettings>][] = [
    // A string fret 1 = A#/Bb, and the default note set is the 7 naturals: none fits.
    ['note-finding', { type: 'note-finding', strings: [5], fromFret: 1, toFret: 1 }],
    // one position cannot hold a perfect 5th above a reference
    ['interval', { type: 'interval', strings: [1], fromFret: 0, toFret: 0, intervals: ['P5'], direction: 'up' }],
    // D major = D F# A: no E, and E is the only note on string 1 fret 0
    ['chord-tone', { type: 'chord-tone', strings: [1], fromFret: 0, toFret: 0, roots: ['D'], qualities: ['major'], windowWidth: 1 }],
    // a root, its fifth and its octave need at least three positions
    ['root-fifth-octave', { type: 'root-fifth-octave', strings: [1], fromFret: 0, toFret: 0, qualities: ['major'] }],
    // a whole arpeggio cannot fit on one position
    ['arpeggio', { type: 'arpeggio', strings: [1], fromFret: 0, toFret: 0, qualities: ['major'] }],
    // C | Am | Dm | G: the Dm bar (D F A) has no tone on E
    ['chord-tone-lock', { type: 'chord-tone-lock', strings: [1], fromFret: 0, toFret: 0, key: { tonic: 'C', mode: 'major' } }],
  ];
  it.each(frets)('%s: a "widen the fret range" rejection -> field "frets"', (_t, over) => {
    const v = fail(base(over));
    expect(v.reason, `reached the wrong branch: ${v.reason}`).toMatch(/[Ww]iden the (fret )?range/);
    expect(v.field).toBe('frets');
  });
});
