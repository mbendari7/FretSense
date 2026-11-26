import {
  buildChord, buildScale, chordSymbol, chromaticLabel, formatPitchClass, intervalBetween, midiAt, mod,
  parsePitchClassNote, pitchClass, positionsOf,
  type FretPosition, type InstrumentProfile, type Interval, type PitchClassNote,
} from '@fretsense/theory';
import { itemKey } from '../records';
import { letterOctave } from './feedback';
import type { DrillSettings } from './types';

/** FR-058: the 15 major keys a user can pick for the built-in progression (7 flats → 7 sharps). */
export const MAJOR_KEYS: readonly string[] = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];

const parsePc = (s: string): PitchClassNote | undefined => {
  const r = parsePitchClassNote(s);
  return r.ok ? r.value : undefined;
};

/** FR-058 built-in | I | vi | ii | V | of diatonic triads (FR-007) in a major key. */
export function builtInProgression(tonic: string): { root: string; quality: string }[] {
  const t = parsePc(tonic);
  const sc = t ? buildScale(t, 'major') : undefined;
  if (!sc || !sc.ok) return [];
  const d = (i: number) => formatPitchClass(sc.value[i]!);
  return [
    { root: d(0), quality: 'major' },
    { root: d(5), quality: 'minor' },
    { root: d(1), quality: 'minor' },
    { root: d(4), quality: 'major' },
  ];
}

export interface WalkingChord {
  readonly root: PitchClassNote;
  readonly quality: string;
  readonly symbol: string;
  readonly tones: readonly PitchClassNote[];
}

export interface WalkingLine {
  readonly keyName: string;
  readonly key: { readonly tonic: PitchClassNote; readonly mode: 'major' | 'minor' };
  readonly scale: readonly PitchClassNote[];
  readonly chords: readonly WalkingChord[];
  readonly slotCount: number;
  readonly strings: readonly number[];
  readonly fromFret: number;
  readonly toFret: number;
}

type Fail = { ok: false; reason: string };

/** Builds the looping line for a walking-bass (or chord-tone lock) progression, FR-058/FR-059. */
export function buildLine(profile: InstrumentProfile, s: DrillSettings): { ok: true; line: WalkingLine } | Fail {
  const tonic = s.key ? parsePc(s.key.tonic) : undefined;
  if (!tonic || !s.key) return { ok: false, reason: 'The progression needs a key.' };
  const mode = s.key.mode;
  if (!s.chords?.length) {
    // FR-058: the built-in progression is for one of the 15 major keys (theory-checker T098 #4).
    if (mode !== 'major' || !MAJOR_KEYS.includes(formatPitchClass(tonic))) return { ok: false, reason: 'The built-in progression needs one of the 15 major keys.' };
  }
  const chordsIn = s.chords?.length ? s.chords : builtInProgression(s.key.tonic);
  if (chordsIn.length < 2 || chordsIn.length > 8) return { ok: false, reason: 'A progression needs 2 to 8 chords.' };
  const chords: WalkingChord[] = [];
  for (const c of chordsIn) {
    const root = parsePc(c.root);
    if (!root) return { ok: false, reason: 'A chord in the progression has an unknown root.' };
    const tones = buildChord(root, c.quality);
    if (!tones.ok) return { ok: false, reason: 'A chord in the progression has an unknown quality.' };
    chords.push({ root, quality: c.quality, symbol: chordSymbol(root, c.quality), tones: tones.value });
  }
  const sc = buildScale(tonic, mode === 'major' ? 'major' : 'natural-minor');
  if (!sc.ok) return { ok: false, reason: 'The key could not be built.' };
  const strings = s.strings.filter((x) => x >= 1 && x <= profile.stringCount);
  if (!strings.length) return { ok: false, reason: 'Choose at least one string.' };
  const fromFret = Math.max(0, Math.min(s.fromFret, s.toFret));
  const toFret = Math.min(profile.fretCount, Math.max(s.fromFret, s.toFret));
  const line: WalkingLine = {
    keyName: `${formatPitchClass(tonic)} ${mode}`,
    key: { tonic, mode },
    scale: sc.value,
    chords,
    slotCount: chords.length * 4,
    strings,
    fromFret,
    toFret,
  };
  // FR-061: every chord's root must be playable in the range (beat 1 must be answerable).
  for (const c of chords) {
    if (!positionsOf(profile, { pitchClass: pitchClass(c.root) }, { fromFret, toFret, strings }).length) {
      return { ok: false, reason: `${c.symbol}'s root isn't on the chosen strings and frets. Widen the fret range or add strings.` };
    }
  }
  return { ok: true, line };
}

export type Rule = 'R1' | 'R2' | 'R3' | 'R4';

export interface SlotJudgement {
  readonly slot: number;
  readonly bar: number;
  readonly beat: 1 | 2 | 3 | 4;
  readonly state: 'empty' | 'pending' | 'ok' | 'broken';
  readonly broken: readonly { rule: Rule; message: string }[];
}

const chordOf = (line: WalkingLine, slot: number) => line.chords[Math.floor(slot / 4)]!;
const beatOf = (slot: number) => ((slot % 4) + 1) as 1 | 2 | 3 | 4;
const wrap = (line: WalkingLine, slot: number) => mod(slot, line.slotCount);

/** Chord tones ∪ key scale pitch classes for a slot (R2's allowed set). */
function allowedPcs(line: WalkingLine, slot: number): Set<number> {
  return new Set([...chordOf(line, slot).tones.map(pitchClass), ...line.scale.map(pitchClass)]);
}

/** Spells a pitch class for a slot: the chord's spelling, then the key's, then chromatic from the tonic. */
function spellFor(line: WalkingLine, slot: number, pc: number): PitchClassNote {
  return chordOf(line, slot).tones.find((t) => pitchClass(t) === pc)
    ?? line.scale.find((t) => pitchClass(t) === pc)
    ?? chromaticLabel(line.key.tonic, pc).spelled;
}

const QUALITY_WORDS: Record<string, string> = { P: 'perfect', M: 'major', m: 'minor', A: 'augmented', d: 'diminished' };
function ordinal(n: number): string {
  if (n === 8) return 'octave';
  if (n === 15) return 'double octave';
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}
function intervalWords(iv: Interval): string {
  const words = `${QUALITY_WORDS[iv.quality] ?? iv.quality} ${ordinal(iv.number)}`;
  return `${/^[aeiou]/.test(words) ? 'an' : 'a'} ${words}`;
}

/** Judges every slot of the line by FR-058 R1–R4. Pure: re-entering a slot re-judges its neighbours. */
export function judgeLine(profile: InstrumentProfile, line: WalkingLine, entries: readonly (FretPosition | undefined)[]): SlotJudgement[] {
  const midiOf = (i: number): number | undefined => {
    const e = entries[wrap(line, i)];
    if (!e) return undefined;
    const m = midiAt(profile, e);
    return m.ok ? m.value : undefined;
  };
  const name = (slot: number, m: number) => formatPitchClass(spellFor(line, slot, mod(m, 12)));
  const out: SlotJudgement[] = [];
  for (let i = 0; i < line.slotCount; i++) {
    const bar = Math.floor(i / 4) + 1;
    const beat = beatOf(i);
    const m = midiOf(i);
    if (m === undefined) {
      out.push({ slot: i, bar, beat, state: 'empty', broken: [] });
      continue;
    }
    const broken: { rule: Rule; message: string }[] = [];
    let pending = false;
    const chord = chordOf(line, i);
    const pc = mod(m, 12);
    if (beat === 1 && pc !== pitchClass(chord.root)) {
      broken.push({ rule: 'R1', message: `Beat 1 is the chord's root (${formatPitchClass(chord.root)}); you played ${name(i, m)}.` });
    }
    if (beat === 2 || beat === 3) {
      const allowed = allowedPcs(line, i);
      if (!allowed.has(pc)) {
        const prev = midiOf(i - 1);
        const next = midiOf(i + 1);
        const passing = prev !== undefined && next !== undefined
          && allowedPcs(line, wrap(line, i - 1)).has(mod(prev, 12))
          && allowedPcs(line, wrap(line, i + 1)).has(mod(next, 12))
          && Math.abs(m - prev) === 1 && Math.abs(next - m) === 1 && (prev - m) * (next - m) < 0;
        if (!passing) {
          broken.push({ rule: 'R2', message: `Beats 2 and 3 are chord tones, notes of ${line.keyName}, or a semitone step between them; you played ${name(i, m)}.` });
        }
      }
    }
    if (beat === 4) {
      const nextSlot = wrap(line, i + 1);
      const nm = midiOf(nextSlot);
      if (nm === undefined) pending = true;
      else {
        const d = Math.abs(m - nm);
        if (!(d === 1 || d === 2 || d === 7)) {
          const nextName = name(nextSlot, nm);
          if (d > 0 && d % 12 === 0) {
            // CR-B3-7: the same note in another octave names both octaves.
            const withOct = (slot: number, mm: number) => slotNoteName(profile, line, slot, entries[wrap(line, slot)]!) ?? name(slot, mm);
            const away = d === 12 ? 'an octave away' : d === 24 ? 'two octaves away' : `${d / 12} octaves away`;
            broken.push({ rule: 'R3', message: `A lead-in is 1–2 semitones from the next bar's first note (${withOct(nextSlot, nm)}), or a perfect 5th away; you played ${withOct(i, m)}, the same note ${away}.` });
          } else {
            const played = d === 0 ? `${nextName} itself` : name(i, m);
            broken.push({ rule: 'R3', message: `A lead-in is 1–2 semitones from the next bar's first note (${nextName}), or a perfect 5th away; you played ${played}.` });
          }
        }
      }
    }
    // R4: leap from the previous slot (the line loops, so slot 0 follows the last slot).
    const prevM = midiOf(i - 1);
    if (prevM !== undefined && Math.abs(m - prevM) > 12) {
      const n = Math.abs(m - prevM);
      const prevSlot = wrap(line, i - 1);
      const a = spellFor(line, prevSlot, mod(prevM, 12));
      const b = spellFor(line, i, pc);
      const iv = n <= 24
        ? intervalBetween({ ...a, octave: letterOctave(a, prevM) }, { ...b, octave: letterOctave(b, m) })
        : undefined;
      const what = iv && iv.ok ? `${intervalWords(iv.value)} (${n} semitones)` : `${n} semitones`;
      broken.push({ rule: 'R4', message: `Moves between notes are at most an octave; you moved ${what}.` });
    }
    out.push({ slot: i, bar, beat, state: broken.length ? 'broken' : pending ? 'pending' : 'ok', broken });
  }
  return out;
}

export interface Reveal { readonly pos: FretPosition; readonly caption: string }

/** FR-058 revealed notes for a broken slot; one caption per position (root, chord tone, lead-in option, passing tone). */
export function revealsFor(profile: InstrumentProfile, line: WalkingLine, entries: readonly (FretPosition | undefined)[], slot: number): Reveal[] {
  const j = judgeLine(profile, line, entries)[slot];
  if (!j || j.state !== 'broken') return [];
  const range = { fromFret: line.fromFret, toFret: line.toFret, strings: line.strings };
  const chord = chordOf(line, slot);
  const byKey = new Map<string, Reveal>();
  const add = (pos: FretPosition, caption: string) => {
    const k = `${pos.string}/${pos.fret}`;
    if (!byKey.has(k)) byKey.set(k, { pos, caption });
  };
  const rules = new Set(j.broken.map((b) => b.rule));
  if (rules.has('R1')) for (const p of positionsOf(profile, { pitchClass: pitchClass(chord.root) }, range)) add(p, `root of ${chord.symbol}`);
  if (rules.has('R2')) for (const t of chord.tones) for (const p of positionsOf(profile, { pitchClass: pitchClass(t) }, range)) add(p, `chord tone of ${chord.symbol}`);
  const midiAtSlot = (i: number) => {
    const e = entries[wrap(line, i)];
    const m = e ? midiAt(profile, e) : undefined;
    return m && m.ok ? m.value : undefined;
  };
  if (rules.has('R3')) {
    const nm = midiAtSlot(slot + 1);
    if (nm !== undefined) for (const d of [-7, -2, -1, 1, 2, 7]) for (const p of positionsOf(profile, { midi: nm + d }, range)) add(p, 'lead-in option');
  }
  if (rules.has('R2')) {
    const prev = midiAtSlot(slot - 1);
    const next = midiAtSlot(slot + 1);
    if (prev !== undefined && next !== undefined && Math.abs(next - prev) === 2
      && allowedPcs(line, wrap(line, slot - 1)).has(mod(prev, 12)) && allowedPcs(line, wrap(line, slot + 1)).has(mod(next, 12))) {
      const mid = (prev + next) / 2;
      if (!allowedPcs(line, slot).has(mod(mid, 12))) for (const p of positionsOf(profile, { midi: mid }, range)) add(p, 'passing tone');
    }
  }
  return [...byKey.values()];
}

/** FR-058 entry announcement: "Bar 2, beat 3, Am". */
export function slotAnnouncement(line: WalkingLine, slot: number): string {
  return `Bar ${Math.floor(slot / 4) + 1}, beat ${beatOf(slot)}, ${chordOf(line, slot).symbol}`;
}

/** FR-040: one attempt per note, written at Check line; [] until every slot is filled. */
export function lineAttempts(profile: InstrumentProfile, line: WalkingLine, entries: readonly (FretPosition | undefined)[]) {
  // Array.from visits holes in sparse arrays, which .some() skips (code-reviewer T098 #5).
  if (Array.from({ length: line.slotCount }, (_, i) => entries[i]).some((e) => !e)) return [];
  const js = judgeLine(profile, line, entries);
  const prompt = {
    drillType: 'walking-bass' as const,
    key: { tonic: formatPitchClass(line.key.tonic), mode: line.key.mode },
    chords: line.chords.map((c) => ({ root: formatPitchClass(c.root), quality: c.quality })),
  };
  return js.map((j) => {
    const c = chordOf(line, j.slot);
    return {
      itemKey: itemKey.bass('walking-bass', c.quality),
      prompt,
      answer: [entries[j.slot]!],
      correct: j.state === 'ok',
      group: c.symbol,
    };
  });
}

/** The note at a position as the slot spells it, with octave (e.g. "C2"); undefined off the instrument. */
export function slotNoteName(profile: InstrumentProfile, line: WalkingLine, slot: number, pos: FretPosition): string | undefined {
  const m = midiAt(profile, pos);
  if (!m.ok) return undefined;
  const sp = spellFor(line, slot, mod(m.value, 12));
  return `${formatPitchClass(sp)}${letterOctave(sp, m.value)}`;
}
