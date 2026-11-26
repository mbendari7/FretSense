/**
 * T098 (red, test-first) [FR-058, FR-040]: walking-bass line builder, judge, reveals, announcement and
 * attempts, as pure functions of (profile, line, entries).
 *
 * spec-us6-bass-patterns.md FR-058: progression of 2–8 chords, 4 beats each, declared key; built-in
 * | I | vi | ii | V | of diatonic triads in a major key picked from the 15 major keys; the progression loops
 * (the last bar approaches bar 1). Rules: (R1) beat 1 is the chord root; (R2) beats 2–3 are chord tones,
 * tones of the key's scale, or chromatic passing tones (a semitone between two such tones); (R3) beat 4 is
 * a step of 1–2 semitones to the next bar's beat-1 note, or its perfect 5th above or below; (R4) no leap
 * larger than an octave (an exact octave is allowed), including across bar lines. Messages are the spec's
 * exact sentences; reveals follow "Revealed notes"; attempts follow FR-040 (one per note).
 * Decided defaults (owner brief 2026-11-25): R2 passing tone = exactly 1 semitone from each neighbour and
 * strictly between them, with both neighbours entered and chord/key tones; R3 judged only once the next
 * bar's beat 1 exists (otherwise 'pending'); R4 compares slot i with slot i − 1 (and slot 0 with the last
 * slot when both are filled).
 *
 * Independent sources only. Pitches are MIDI = 12·(octave + 1) + letter: C2 = 36, D2 = 38, E2 = 40,
 * F2 = 41, G2 = 43, A1 = 33, B1 = 35, E1 = 28 (4-string bass open strings E1 A1 D2 G2 = 28 33 38 43,
 * string 4 lowest). Triads are typed out by hand: C = C E G; Am = A C E; Dm = D F A; G = G B D. The key
 * scale of C major is C D E F G A B.
 *
 * Hand-derived reference line over | C | Am | Dm | G | in C major (MIDI), 16 slots, every rule satisfied:
 *   bar 1 C : 36 40 43 35   C2 E2 G2 B1   (beat 4 B1 is 2 semitones above next root A1 = 33)
 *   bar 2 Am: 33 36 40 39   A1 C2 E2 Eb2  (beat 4 is 1 semitone above next root D2 = 38; beat 4 is not R2-judged)
 *   bar 3 Dm: 38 41 45 44   D2 F2 A2 G#2  (beat 4 is 1 semitone above next root G2 = 43)
 *   bar 4 G : 43 47 50 43   G2 B2 D3 G2   (beat 4 G2 is a perfect 5th = 7 semitones above bar 1's root C2 = 36, via the loop)
 * Every adjacent move (including 43 → 36 across the loop) is at most 8 semitones, so R4 never fires.
 */
import { describe, expect, it } from 'vitest';
import { assert as fcAssert, integer, property } from 'fast-check';
import { formatPitchClass, presets, presetById, type FretPosition, type InstrumentProfile, type Note } from '@fretsense/theory';
import { MAJOR_KEYS, buildLine, builtInProgression, judgeLine, lineAttempts, revealsFor, slotAnnouncement, type WalkingLine } from './walkingBass';
import type { DrillSettings } from './types';

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const noteMidi = (n: Note) => 12 * (n.octave + 1) + LETTER_PC[n.letter]! + n.accidental;
const openMidi = (p: InstrumentProfile, s: number) => noteMidi(p.tuning[p.stringCount - s]!);
const k = (x: FretPosition) => `${x.string}/${x.fret}`;
const byK = (a: FretPosition, b: FretPosition) => a.string - b.string || a.fret - b.fret;
const bass4 = presetById('bass4-standard')!.profile;
const allStrings = (p: InstrumentProfile) => Array.from({ length: p.stringCount }, (_, i) => i + 1);

/** A playable position for a MIDI pitch within frets 0–12: lowest fret, ties to the higher string number. */
function pos(p: InstrumentProfile, m: number, maxFret = 12): FretPosition {
  let best: FretPosition | undefined;
  for (let s = 1; s <= p.stringCount; s++) {
    const f = m - openMidi(p, s);
    if (f < 0 || f > maxFret) continue;
    if (!best || f < best.fret || (f === best.fret && s > best.string)) best = { string: s, fret: f };
  }
  if (!best) throw new Error(`MIDI ${m} not playable on frets 0–${maxFret}`);
  return best;
}
// Entries use frets 0–24 so the one very wide leap (D4 = 62 on bass4 = string 1 fret 19) can be expressed; the lowest fret is still preferred.
const entriesOf = (p: InstrumentProfile, mids: readonly (number | undefined)[]) => mids.map((m) => (m === undefined ? undefined : pos(p, m, 24)));

const BASE = [36, 40, 43, 35, 33, 36, 40, 39, 38, 41, 45, 44, 43, 47, 50, 43];
const withSlots = (changes: Record<number, number | undefined>, base: readonly (number | undefined)[] = BASE) =>
  base.map((m, i) => (i in changes ? changes[i] : m));
const NONE = Array.from({ length: 16 }, () => undefined as number | undefined);

const settings = (over: Partial<DrillSettings> = {}): DrillSettings => ({
  type: 'walking-bass', strings: allStrings(bass4), fromFret: 0, toFret: 12, count: 16, octaveMode: 'any', key: { tonic: 'C', mode: 'major' }, ...over,
});
function mk(p: InstrumentProfile, over: Partial<DrillSettings> = {}): WalkingLine {
  const r = buildLine(p, settings({ strings: allStrings(p), ...over }));
  if (!r.ok) throw new Error(r.reason);
  return r.line;
}
const lineC = () => mk(bass4);
const judge = (mids: readonly (number | undefined)[], line = lineC(), p = bass4) => judgeLine(p, line, entriesOf(p, mids));
const rules = (j: { broken: readonly { rule: string }[] }) => j.broken.map((b) => b.rule);
const msg = (j: { broken: readonly { rule: string; message: string }[] }, rule: string) => j.broken.find((b) => b.rule === rule)?.message;

describe('hand-derivation sanity (test fixtures, not the implementation)', () => {
  it('pos() matches the open-string arithmetic: C2 = string 3 fret 3, A1 = string 3 fret 0, E2 = string 2 fret 2', () => {
    expect(pos(bass4, 36)).toEqual({ string: 3, fret: 3 });
    expect(pos(bass4, 33)).toEqual({ string: 3, fret: 0 });
    expect(pos(bass4, 40)).toEqual({ string: 2, fret: 2 });
  });
});

describe('FR-058 MAJOR_KEYS and the built-in | I | vi | ii | V | progression', () => {
  it('lists the 15 major keys, Cb … C#', () => {
    expect(MAJOR_KEYS).toHaveLength(15);
    expect(new Set(MAJOR_KEYS)).toEqual(new Set(['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#']));
  });

  // Each row: major scale spelled by hand (circle of fifths), then I, vi, ii, V; minor chords end in "m".
  const TABLE: Record<string, string[]> = {
    C: ['C', 'Am', 'Dm', 'G'], G: ['G', 'Em', 'Am', 'D'], D: ['D', 'Bm', 'Em', 'A'], A: ['A', 'F#m', 'Bm', 'E'],
    E: ['E', 'C#m', 'F#m', 'B'], B: ['B', 'G#m', 'C#m', 'F#'], 'F#': ['F#', 'D#m', 'G#m', 'C#'], 'C#': ['C#', 'A#m', 'D#m', 'G#'],
    F: ['F', 'Dm', 'Gm', 'C'], Bb: ['Bb', 'Gm', 'Cm', 'F'], Eb: ['Eb', 'Cm', 'Fm', 'Bb'], Ab: ['Ab', 'Fm', 'Bbm', 'Eb'],
    Db: ['Db', 'Bbm', 'Ebm', 'Ab'], Gb: ['Gb', 'Ebm', 'Abm', 'Db'], Cb: ['Cb', 'Abm', 'Dbm', 'Gb'],
  };
  for (const [tonic, want] of Object.entries(TABLE)) {
    it(`${tonic} major: ${want.join(' ')}`, () => {
      const got = builtInProgression(tonic).map((c) => c.root + (c.quality === 'minor' ? 'm' : ''));
      expect(got).toEqual(want);
      expect(builtInProgression(tonic).map((c) => c.quality)).toEqual(['major', 'minor', 'minor', 'major']);
    });
  }
  it('the table covers every key in MAJOR_KEYS', () => {
    expect([...MAJOR_KEYS].sort()).toEqual(Object.keys(TABLE).sort());
  });
});

describe('FR-058 buildLine', () => {
  it('C major default: C Am Dm G, 16 slots, symbols and chord tones spelled by hand', () => {
    const line = lineC();
    expect(line.keyName).toBe('C major');
    expect(line.slotCount).toBe(16);
    expect(line.chords.map((c) => c.symbol)).toEqual(['C', 'Am', 'Dm', 'G']);
    expect(line.chords.map((c) => c.quality)).toEqual(['major', 'minor', 'minor', 'major']);
    expect(line.chords.map((c) => c.tones.map((t) => formatPitchClass(t)))).toEqual([['C', 'E', 'G'], ['A', 'C', 'E'], ['D', 'F', 'A'], ['G', 'B', 'D']]);
    expect(line.chords.map((c) => formatPitchClass(c.root))).toEqual(['C', 'A', 'D', 'G']);
    expect(line.strings).toEqual([1, 2, 3, 4]);
    expect([line.fromFret, line.toFret]).toEqual([0, 12]);
  });
  it('Eb major default progression and slotCount = 4 × chords for a custom 2- and 8-chord line', () => {
    expect(mk(bass4, { key: { tonic: 'Eb', mode: 'major' } }).chords.map((c) => c.symbol)).toEqual(['Eb', 'Cm', 'Fm', 'Bb']);
    const two = [{ root: 'A', quality: 'minor' }, { root: 'E', quality: 'major' }];
    expect(mk(bass4, { key: { tonic: 'A', mode: 'minor' }, chords: two }).slotCount).toBe(8);
    expect(mk(bass4, { key: { tonic: 'A', mode: 'minor' }, chords: two }).keyName).toBe('A minor');
    const eight = Array.from({ length: 8 }, () => ({ root: 'C', quality: 'major' }));
    expect(mk(bass4, { chords: eight }).slotCount).toBe(32);
  });
  it('rejects 1 chord, 9 chords, an unknown root and a missing key, each with a reason', () => {
    const one = [{ root: 'C', quality: 'major' }];
    const nine = Array.from({ length: 9 }, () => ({ root: 'C', quality: 'major' }));
    const bad = [{ root: 'C', quality: 'major' }, { root: 'H', quality: 'major' }];
    for (const over of [{ chords: one }, { chords: nine }, { chords: bad }]) {
      const r = buildLine(bass4, settings(over));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason.length).toBeGreaterThan(0);
    }
    const { key: _k, ...noKey } = settings();
    const r = buildLine(bass4, noKey as DrillSettings);
    expect(r.ok).toBe(false);
  });
});

describe('FR-058 judgeLine: US6 scenario 3, a fully correct line', () => {
  it('all 16 slots are ok with bar/beat numbering', () => {
    const js = judge(BASE);
    expect(js).toHaveLength(16);
    js.forEach((j, i) => {
      expect(j.slot).toBe(i);
      expect(j.bar).toBe(Math.floor(i / 4) + 1);
      expect(j.beat).toBe((i % 4) + 1);
      expect(j.state, `slot ${i}`).toBe('ok');
      expect(j.broken).toEqual([]);
    });
  });
  for (const preset of presets()) {
    it(`${preset.presetId}: the same line (shifted whole octaves to be playable) judges ok`, () => {
      const p = preset.profile;
      const shift = [0, 12, 24, -12, 36].find((d) => BASE.every((m) => { try { pos(p, m + d); return true; } catch { return false; } }));
      expect(shift, 'a playable octave shift exists').toBeDefined();
      const js = judge(BASE.map((m) => m + shift!), mk(p), p);
      expect(js.map((j) => j.state)).toEqual(Array(16).fill('ok'));
    });
  }
  it('empty slots are empty with no broken rules; judging does not mutate the entries and is repeatable', () => {
    const entries = Object.freeze(entriesOf(bass4, NONE));
    const js = judgeLine(bass4, lineC(), entries);
    expect(js.every((j) => j.state === 'empty' && j.broken.length === 0)).toBe(true);
    const full = Object.freeze(entriesOf(bass4, BASE));
    expect(judgeLine(bass4, lineC(), full)).toEqual(judgeLine(bass4, lineC(), full));
  });
});

describe('FR-058 R1 beat 1 is the chord root (any octave)', () => {
  it('bar 1 beat 1 played E in a C bar: exact message, named on slot 0 only for R1', () => {
    const js = judge(withSlots({ 0: 40 }));
    expect(js[0]!.state).toBe('broken');
    expect(rules(js[0]!)).toEqual(['R1']);
    expect(msg(js[0]!, 'R1')).toBe("Beat 1 is the chord's root (C); you played E.");
  });
  it('bar 2 beat 1 played C in an A minor bar names the bar-2 root A', () => {
    const js = judge(withSlots({ 4: 36 }));
    expect(msg(js[4]!, 'R1')).toBe("Beat 1 is the chord's root (A); you played C.");
    expect(js.filter((j) => j.state === 'broken').map((j) => j.slot)).toEqual([4]);
  });
  it('the root in another octave is accepted (A2 = 45 in bar 2, beat 4 adjusted to 46 so R3 holds)', () => {
    const js = judge(withSlots({ 3: 46, 4: 45 }));
    expect(js[4]!.state).toBe('ok');
    expect(js[3]!.state).toBe('ok');
  });
});

describe('FR-058 R2 beats 2–3: chord tones, key notes, or a chromatic passing tone', () => {
  it('a note outside the chord and the key breaks R2 with the exact message (G major, F natural)', () => {
    const gMajor = mk(bass4, { key: { tonic: 'G', mode: 'major' } }); // G Em Am D; F natural is not in G major (F# is)
    const js = judge([43, 41, 47, ...Array(13).fill(undefined)], gMajor);
    expect(js[1]!.state).toBe('broken');
    expect(rules(js[1]!)).toEqual(['R2']);
    expect(msg(js[1]!, 'R2')).toBe('Beats 2 and 3 are chord tones, notes of G major, or a semitone step between them; you played F.');
    expect(js[2]!.state).toBe('ok');
  });
  it('a key note that is not a chord tone is accepted (D over C)', () => {
    const js = judge(withSlots({ 1: 38 })); // D2 over C: in the C major scale
    expect(js[1]!.state).toBe('ok');
  });
  it('a chord tone from beat 3 of another bar is accepted; a non-key note on beat 4 is not R2-judged (bar 2 beat 4 = Eb)', () => {
    expect(judge(BASE)[7]!.state).toBe('ok');
  });
  it('chromatic passing tone D, D#, E (Dm bar beats 1–3): D# between D and E is ok; broken until the next neighbour exists', () => {
    const base = withSlots({}, NONE);
    const full = judge(withSlots({ 8: 38, 9: 39, 10: 40 }, base));
    expect(full[9]!.state).toBe('ok');
    expect(full[8]!.state).toBe('ok');
    expect(full[10]!.state).toBe('ok');
    const noNext = judge(withSlots({ 8: 38, 9: 39 }, base));
    expect(noNext[9]!.state).toBe('broken');
    expect(rules(noNext[9]!)).toEqual(['R2']);
    const noPrev = judge(withSlots({ 9: 39, 10: 40 }, base));
    expect(noPrev[9]!.state).toBe('broken');
  });
  it('descending passing tone E, D#, D: D# between 40 and 38 is ok', () => {
    const js = judge(withSlots({ 8: 38, 9: 40, 10: 39, 11: 38 }, NONE));
    expect(js[10]!.state).toBe('ok');
  });
  it('beat 3 passing tone F, F#, G with beat 4 as the upper neighbour (G = 43 is a key and chord tone of the next chord, a key note of the bar)', () => {
    const js = judge(withSlots({ 8: 38, 9: 41, 10: 42, 11: 43 }, NONE));
    expect(js[10]!.state).toBe('ok');
    expect(js[11]!.state).toBe('pending');
  });
  it('a neighbour that is not a chord or key tone invalidates the passing tone (beat 4 = G#)', () => {
    const js = judge(withSlots({ 8: 38, 9: 41, 10: 42, 11: 44 }, NONE));
    expect(js[10]!.state).toBe('broken');
    expect(rules(js[10]!)).toEqual(['R2']);
  });
  it('not strictly between the neighbours is broken: D, D#, D and D, D#, F', () => {
    expect(judge(withSlots({ 8: 38, 9: 39, 10: 38 }, NONE))[9]!.state).toBe('broken');
    expect(judge(withSlots({ 8: 38, 9: 39, 10: 41 }, NONE))[9]!.state).toBe('broken'); // 1 from D but 2 from F
  });
  it('entering the missing neighbour re-judges the passing tone (broken → ok)', () => {
    const before = judge(withSlots({ 8: 38, 9: 39 }, NONE));
    const after = judge(withSlots({ 8: 38, 9: 39, 10: 40 }, NONE));
    expect([before[9]!.state, after[9]!.state]).toEqual(['broken', 'ok']);
  });
});

describe('FR-058 R3 beat 4 leads into the next bar (loop included)', () => {
  it('bar 1 only: slot 3 is pending (next beat 1 missing), earlier slots ok, later slots empty', () => {
    const js = judge(withSlots({}, [36, 40, 43, 35, ...Array(12).fill(undefined)]));
    expect(js.slice(0, 4).map((j) => j.state)).toEqual(['ok', 'ok', 'ok', 'pending']);
    expect(js.slice(4).every((j) => j.state === 'empty')).toBe(true);
    expect(js[3]!.broken).toEqual([]);
  });
  it('once bar 2 beat 1 (A1 = 33) exists, slot 3 = B1 (35) is judged ok', () => {
    const js = judge(withSlots({}, [36, 40, 43, 35, 33, ...Array(11).fill(undefined)]));
    expect(js[3]!.state).toBe('ok');
  });
  // Brute force over the offset d = beat4 − next beat 1 (next beat 1 = A1 = 33, beat 3 = G2 = 43 so every case is R4-legal):
  // ok iff |d| ∈ {1, 2}, or d = +7 (the 5th above; a 5th below, d = −7, is covered separately).
  for (let d = -2; d <= 12; d++) {
    const okSet = [-2, -1, 1, 2, 7];
    it(`beat 4 ${d >= 0 ? '+' : ''}${d} semitones from the next root: ${okSet.includes(d) ? 'ok' : 'broken R3'}`, () => {
      const js = judge(withSlots({ 3: 33 + d }));
      if (okSet.includes(d)) {
        expect(js[3]!.state).toBe('ok');
      } else {
        expect(js[3]!.state).toBe('broken');
        expect(rules(js[3]!)).toEqual(['R3']);
      }
    });
  }
  it('a perfect 5th below the next root is also a lead-in (D2 = 38 into A2 = 45)', () => {
    const js = judge(withSlots({ 3: 38, 4: 45 }));
    expect(js[3]!.state).toBe('ok');
    expect(js[4]!.state).toBe('ok');
  });
  it('playing the next root itself: the "itself" message', () => {
    const js = judge(withSlots({ 3: 33 }));
    expect(msg(js[3]!, 'R3')).toBe("A lead-in is 1–2 semitones from the next bar's first note (A), or a perfect 5th away; you played A itself.");
  });
  it('a plain miss uses the other message (C against next root A)', () => {
    const js = judge(withSlots({ 3: 36 }));
    expect(msg(js[3]!, 'R3')).toBe("A lead-in is 1–2 semitones from the next bar's first note (A), or a perfect 5th away; you played C.");
  });
  it('a sixth-sharp F against next root A (8 semitones) is a plain miss naming F', () => {
    const js = judge(withSlots({ 3: 41 }));
    expect(msg(js[3]!, 'R3')).toBe("A lead-in is 1–2 semitones from the next bar's first note (A), or a perfect 5th away; you played F.");
  });
  it('the next beat 1 in another octave is not "itself" and is broken (A2 = 45 against A1 = 33)', () => {
    const js = judge(withSlots({ 3: 45 }));
    expect(js[3]!.state).toBe('broken');
    expect(rules(js[3]!)).toEqual(['R3']);
  });
  it('loop: bar 4 beat 4 is judged against bar 1 beat 1 (G2 = 43 is a 5th above C2 = 36: ok)', () => {
    expect(judge(BASE)[15]!.state).toBe('ok');
  });
  it('loop: bar 4 beat 4 = E2 (40) against C2 (36) is broken, naming the bar 1 root', () => {
    const js = judge(withSlots({ 15: 40 }));
    expect(js[15]!.state).toBe('broken');
    expect(msg(js[15]!, 'R3')).toBe("A lead-in is 1–2 semitones from the next bar's first note (C), or a perfect 5th away; you played E.");
  });
  it('loop: with bar 1 beat 1 missing, bar 4 beat 4 is pending', () => {
    const js = judge(withSlots({ 0: undefined }));
    expect(js[15]!.state).toBe('pending');
    expect(js[0]!.state).toBe('empty');
  });
});

describe('FR-058 R4 no leap larger than an octave (exact octave allowed)', () => {
  it('exactly 12 semitones is ok: C2 → C3 on beat 2', () => {
    const js = judge(withSlots({ 1: 48 }));
    expect(js[1]!.state).toBe('ok');
  });
  it('14 semitones: C2 → D3 names "a major 9th (14 semitones)"; only R4 is broken (D is a key note)', () => {
    const js = judge(withSlots({ 1: 50 }));
    expect(js[1]!.state).toBe('broken');
    expect(rules(js[1]!)).toEqual(['R4']);
    expect(msg(js[1]!, 'R4')).toBe('Moves between notes are at most an octave; you moved a major 9th (14 semitones).');
  });
  // FR-060: a note outside the key and chord is spelled by the fixed map from the context root
  // (in C: b2 = Db), so 13 semitones up from C2 is Db3, a minor 9th (owner-approved FR-060 wins
  // over the test-writer's C# assumption; ambiguity #1 in the T098 red report).
  it('13 semitones: C2 → Db3 breaks R2 and R4 in rule order, "a minor 9th (13 semitones)"', () => {
    const js = judge(withSlots({ 1: 49 }));
    expect(js[1]!.state).toBe('broken');
    expect(rules(js[1]!)).toEqual(['R2', 'R4']);
    expect(msg(js[1]!, 'R2')).toBe('Beats 2 and 3 are chord tones, notes of C major, or a semitone step between them; you played Db.');
    expect(msg(js[1]!, 'R4')).toBe('Moves between notes are at most an octave; you moved a minor 9th (13 semitones).');
  });
  it('13 semitones spelled C → C# (D major: C is b7 by FR-060, C# a key note) names "an augmented octave"', () => {
    const lineD = mk(bass4, { key: { tonic: 'D', mode: 'major' } });
    const js = judge(withSlots({ 0: 36, 1: 49 }), lineD);
    expect(msg(js[1]!, 'R4')).toBe('Moves between notes are at most an octave; you moved an augmented octave (13 semitones).');
  });
  it('beyond a double octave there is no interval name: C2 → D4 (26 semitones)', () => {
    const js = judge(withSlots({ 1: 62 }));
    expect(msg(js[1]!, 'R4')).toBe('Moves between notes are at most an octave; you moved 26 semitones.');
  });
  it('R4 is judged on the later slot only, and only against the immediately previous slot when it is filled', () => {
    // slot 1 empty: slot 2 (43) has no previous note, so no leap is judged even though slot 0 = 36 and slot 2 = 62 are 26 apart.
    const js = judge(withSlots({ 1: undefined, 2: 62 }, [36, ...Array(15).fill(undefined)]));
    expect(js[2]!.broken.some((b) => b.rule === 'R4')).toBe(false);
  });
  it('R4 across a bar line: bar 1 beat 4 → bar 2 beat 1 more than an octave breaks R4 on slot 4', () => {
    const js = judge(withSlots({ 3: 32, 4: 45 })); // G#1 → A2 = 13 semitones; slot 4 is the root A, so R1 holds
    expect(rules(js[4]!)).toContain('R4');
  });
  it('loop: bar 4 beat 4 → bar 1 beat 1 is R4-judged on slot 0 once both are filled (50 → 36 = 14: broken R4 on slot 0, R3 on slot 15)', () => {
    const js = judge(withSlots({ 15: 50 }));
    expect(rules(js[0]!)).toEqual(['R4']);
    expect(rules(js[15]!)).toEqual(['R3']);
  });
  it('loop: an exact octave across the loop (48 → 36) is R4-ok on slot 0 although R3 breaks on slot 15', () => {
    const js = judge(withSlots({ 15: 48 }));
    expect(js[0]!.state).toBe('ok');
    expect(rules(js[15]!)).toEqual(['R3']);
  });
  it('property: slot 1 breaks R4 iff |m − 36| > 12; slot 2 (43) iff |m − 43| > 12, for every beat-2 pitch m playable on frets 0–12', () => {
    fcAssert(property(integer({ min: 28, max: 55 }), (m) => {
      const js = judge(withSlots({ 1: m }));
      const r1 = js[1]!.broken.some((b) => b.rule === 'R4');
      const r2 = js[2]!.broken.some((b) => b.rule === 'R4');
      return r1 === Math.abs(m - 36) > 12 && r2 === Math.abs(m - 43) > 12;
    }), { numRuns: 100 });
  });
});

describe('FR-058 undo and re-entry re-judge the neighbours (judgeLine is pure)', () => {
  it('changing bar 2 beat 1 re-judges bar 1 beat 4: E (40) breaks R1 on slot 4 and R3 on slot 3; restoring A clears both', () => {
    const bad = judge(withSlots({ 4: 40 }));
    expect(rules(bad[4]!)).toContain('R1');
    expect(rules(bad[3]!)).toEqual(['R3']);
    const good = judge(BASE);
    expect(good[3]!.state).toBe('ok');
    expect(good[4]!.state).toBe('ok');
  });
  it('undo (removing the last note) turns the preceding beat 4 back to pending', () => {
    const js = judge(withSlots({ 4: undefined }, [36, 40, 43, 35, 33, ...Array(11).fill(undefined)]));
    expect(js[3]!.state).toBe('pending');
  });
  it('re-entering a middle slot re-judges the following slot for R4', () => {
    const bad = judge(withSlots({ 1: 55 })); // G3: chord tone, 19 from C2 ... slot 2 then is 12 below: ok, slot 1 is 19 above C2: broken
    expect(rules(bad[1]!)).toContain('R4');
    expect(bad[2]!.state).toBe('ok');
    expect(judge(withSlots({ 1: 40 }))[1]!.state).toBe('ok');
  });
});

describe('FR-058 revealed notes (bass4, strings 1–4, frets 0–5)', () => {
  const small = () => mk(bass4, { fromFret: 0, toFret: 5 });
  const reveal = (mids: readonly (number | undefined)[], slot: number, line = small()) =>
    revealsFor(bass4, line, entriesOf(bass4, mids), slot).slice().sort((a, b) => byK(a.pos, b.pos)).map((r) => `${k(r.pos)} ${r.caption}`);

  it('R1 (C bar, E played): the root positions only, "root of C": C2 3/3 and C3 1/5', () => {
    // C pitch class on frets 0–5: string 3 (A1 33) f3 = 36 and string 1 (G2 43) f5 = 48; string 4 needs f8, string 2 needs f10.
    expect(reveal(withSlots({ 0: 40 }), 0)).toEqual(['1/5 root of C', '3/3 root of C']);
  });
  it('R1 reveals only inside the line strings (strings 1–2 only: just 1/5)', () => {
    const line = mk(bass4, { fromFret: 0, toFret: 5, strings: [1, 2] });
    expect(reveal(withSlots({ 0: 40 }), 0, line)).toEqual(['1/5 root of C']);
  });
  it('R2 (C# between C and G, not a passing tone): every C E G position, "chord tone of C"', () => {
    // string 4: E f0, G f3; string 3: C f3; string 2: E f2, G f5; string 1: G f0, C f5. Neighbours 36 and 43 are 7 apart: no passing tone.
    expect(reveal(withSlots({ 1: 37 }), 1)).toEqual([
      '1/0 chord tone of C', '1/5 chord tone of C', '2/2 chord tone of C', '2/5 chord tone of C',
      '3/3 chord tone of C', '4/0 chord tone of C', '4/3 chord tone of C',
    ]);
  });
  it('R2 (G# in a Dm bar between D2 and E2): Dm chord tones plus the one passing position D#2 = 2/1', () => {
    // Dm = D F A: string 4: F f1, A f5; string 3: A f0, D f5; string 2: D f0, F f3; string 1: A f2. Passing tone between 38 and 40 is 39 = string 2 fret 1.
    expect(reveal(withSlots({ 8: 38, 9: 44, 10: 40 }, NONE), 9)).toEqual([
      '1/2 chord tone of Dm', '2/0 chord tone of Dm', '2/1 passing tone', '2/3 chord tone of Dm',
      '3/0 chord tone of Dm', '3/5 chord tone of Dm', '4/1 chord tone of Dm', '4/5 chord tone of Dm',
    ]);
  });
  it('R3 (C against next root A1): the lead-in options 1–2 semitones from A1 = 33 or a 5th away (31, 32, 34, 35, 40), "lead-in option"', () => {
    // 31 = 4/3, 32 = 4/4, 34 = 3/1, 35 = 3/2, 40 = 2/2 (26, a 5th below, is under the instrument; 33 itself is not an option).
    expect(reveal(withSlots({ 3: 36 }), 3)).toEqual([
      '2/2 lead-in option', '3/1 lead-in option', '3/2 lead-in option', '4/3 lead-in option', '4/4 lead-in option',
    ]);
  });
  it('an R4-only break reveals nothing', () => {
    expect(reveal(withSlots({ 1: 50 }), 1)).toEqual([]);
  });
  it('a pending slot, an ok slot and an empty slot reveal nothing', () => {
    expect(reveal([36, 40, 43, 35, ...Array(12).fill(undefined)], 3)).toEqual([]);
    expect(reveal(BASE, 5)).toEqual([]);
    expect(reveal(withSlots({ 5: undefined }), 5)).toEqual([]);
  });
  it('each position gets one caption (no duplicates)', () => {
    const r = revealsFor(bass4, small(), entriesOf(bass4, withSlots({ 8: 38, 9: 44, 10: 40 }, NONE)), 9);
    expect(new Set(r.map((x) => k(x.pos))).size).toBe(r.length);
  });
});

describe('FR-058 entry announcement', () => {
  it('"Bar 2, beat 3, Am" for slot 6, and the corners', () => {
    expect(slotAnnouncement(lineC(), 6)).toBe('Bar 2, beat 3, Am');
    expect(slotAnnouncement(lineC(), 0)).toBe('Bar 1, beat 1, C');
    expect(slotAnnouncement(lineC(), 15)).toBe('Bar 4, beat 4, G');
    expect(slotAnnouncement(lineC(), 8)).toBe('Bar 3, beat 1, Dm');
  });
});

describe('FR-040 lineAttempts: one attempt per note at Check line', () => {
  it('16 attempts, all correct for the reference line, with key, group and answer', () => {
    const entries = entriesOf(bass4, BASE);
    const at = lineAttempts(bass4, lineC(), entries);
    expect(at).toHaveLength(16);
    const sym = ['C', 'Am', 'Dm', 'G'];
    const quality = ['major', 'minor', 'minor', 'major'];
    at.forEach((a, i) => {
      expect(a.itemKey).toBe(`bs|walking-bass|${quality[Math.floor(i / 4)]}`);
      expect(a.group).toBe(sym[Math.floor(i / 4)]);
      expect(a.correct).toBe(true);
      expect(a.answer).toEqual([entries[i]]);
      expect(a.prompt).toEqual({
        drillType: 'walking-bass',
        key: { tonic: 'C', mode: 'major' },
        chords: [{ root: 'C', quality: 'major' }, { root: 'A', quality: 'minor' }, { root: 'D', quality: 'minor' }, { root: 'G', quality: 'major' }],
      });
    });
  });
  it('correct = the slot state is ok: a broken beat 1 is false and its neighbours stay true', () => {
    const at = lineAttempts(bass4, lineC(), entriesOf(bass4, withSlots({ 5: 40 }, withSlots({ 5: 36 })))); // slot 5 (bar 2 beat 2) = E: still a chord tone
    expect(at.every((a) => a.correct)).toBe(true);
    const bad = lineAttempts(bass4, lineC(), entriesOf(bass4, withSlots({ 8: 43 }))); // bar 3 beat 1 = G over Dm: R1 broken; slot 7 (39 → 43) breaks R3 too
    expect(bad[8]!.correct).toBe(false);
    expect(bad[7]!.correct).toBe(false);
    expect(bad[9]!.correct).toBe(true);
    expect(bad.filter((a) => !a.correct)).toHaveLength(2);
  });
  it('unavailable until every slot is filled: returns no attempts', () => {
    expect(lineAttempts(bass4, lineC(), entriesOf(bass4, withSlots({ 9: undefined })))).toEqual([]);
  });
  it('a sparse entries array (a hole, slot 15 filled) returns no attempts (code-reviewer T098 #5)', () => {
    const sparse: (FretPosition | undefined)[] = [];
    const full = entriesOf(bass4, BASE);
    sparse[0] = full[0];
    sparse[15] = full[15];
    expect(lineAttempts(bass4, lineC(), sparse)).toEqual([]);
  });
});

describe('FR-058 the built-in progression is for one of the 15 major keys (theory-checker T098 #4)', () => {
  it('a minor key with no chords is rejected with a reason', () => {
    const r = buildLine(bass4, settings({ key: { tonic: 'A', mode: 'minor' } }));
    expect(r.ok).toBe(false);
  });
  it('a theoretical major key (G#) with no chords is rejected with a reason, not a chord-count error', () => {
    const r = buildLine(bass4, settings({ key: { tonic: 'G#', mode: 'major' } }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('15 major keys');
  });
  it('a minor key with its own chords is accepted (lesson data)', () => {
    const r = buildLine(bass4, settings({ key: { tonic: 'A', mode: 'minor' }, chords: [{ root: 'A', quality: 'minor' }, { root: 'E', quality: 'major' }] }));
    expect(r.ok && r.line.keyName).toBe('A minor');
  });
});

describe('T098a CR-B3-7 R3 octave-away wording', () => {
  // | G | C | : bar 2 beat 1 = C (48 = C3 or 60 = C4); lead-in slot 3 = C2 (36), same pitch class.
  const gc = () => mk(bass4, { chords: [{ root: 'G', quality: 'major' }, { root: 'C', quality: 'major' }] });
  const head = "A lead-in is 1–2 semitones from the next bar's first note (C3), or a perfect 5th away; you played C2, the same note ";
  it('one octave away', () => {
    const js = judge([43, undefined, undefined, 36, 48, undefined, undefined, undefined], gc());
    expect(msg(js[3]!, 'R3')).toBe(head + 'an octave away.');
  });
  it('two octaves away', () => {
    const js = judge([43, undefined, undefined, 36, 60, undefined, undefined, undefined], gc());
    expect(msg(js[3]!, 'R3')).toBe(head.replace('(C3)', '(C4)') + 'two octaves away.');
  });
});
