import { letterOctave } from './feedback';
import { DRILL_TYPES } from '../records';
import {
  buildChord, chordSymbol, formatInterval, formatPitchClass, midi, mod, openString, parseInterval,
  parsePitchClassNote, pitchClass, positionsOf, semitones, buildScale, chordQuality, defaultSpelling, transpose,
  type FretPosition, type InstrumentProfile, type Interval, type PitchClassNote,
} from '@fretsense/theory';
import { itemKey } from '../records';
import { pickIndex, weightedPick, type Rng } from '../prng';
import { itemWeight, type ItemHistory } from '../weighting';
import type { DrillSettings, Question, RfoShape, Step } from './types';

export interface GenerateInput {
  readonly profile: InstrumentProfile;
  readonly settings: DrillSettings;
  readonly rng: Rng;
  readonly histories: ReadonlyMap<string, ItemHistory>;
  readonly adaptive: boolean;
}

type Fail = { ok: false; reason: string };
export type GenResult = { ok: true; questions: Question[] } | Fail;

/** A candidate item: its key and a factory that builds a concrete question for it. */
interface Candidate { key: string; make: (rng: Rng) => Question }

const STRING_ORD = (n: number) => `string ${n}`;
const pcName = (pc: number) => formatPitchClass(defaultSpelling(pc, { typeId: 'major' }));
const parsePc = (s: string): PitchClassNote | undefined => {
  const r = parsePitchClassNote(s);
  return r.ok ? r.value : undefined;
};

function rangeOf(s: DrillSettings, p: InstrumentProfile) {
  return {
    fromFret: Math.max(0, Math.min(s.fromFret, s.toFret)),
    toFret: Math.min(p.fretCount, Math.max(s.fromFret, s.toFret)),
    strings: s.strings.filter((x) => x >= 1 && x <= p.stringCount),
  };
}

function midiOf(p: InstrumentProfile, pos: FretPosition): number {
  return midi(openString(p, pos.string)!) + pos.fret;
}

function allPositions(p: InstrumentProfile, r: ReturnType<typeof rangeOf>): FretPosition[] {
  const out: FretPosition[] = [];
  for (const s of r.strings) for (let f = r.fromFret; f <= r.toFret; f++) out.push({ string: s, fret: f });
  return out;
}

/** FR-030: "<low|high> <open>", spelled as the instrument spells it (FR-051, FR-032a). */
function openStringText(p: InstrumentProfile, n: number): string {
  const open = formatPitchClass(openString(p, n)!);
  const pitches = Array.from({ length: p.stringCount }, (_, i) => midi(openString(p, i + 1)!));
  const m = pitches[n - 1]!;
  const qual = m === Math.min(...pitches) ? 'low ' : m === Math.max(...pitches) ? 'high ' : '';
  return `${qual}${open}`;
}

/** FR-030: "string N, <low|high> <open>". */
function stringLabel(p: InstrumentProfile, n: number): string {
  return `${STRING_ORD(n)}, ${openStringText(p, n)}`;
}

/** FR-031 string chip name, by FR-030's naming: "6, low E", "1, high E", "4, D". */
export function stringChipName(p: InstrumentProfile, n: number): string {
  return `${n}, ${openStringText(p, n)}`;
}

// ---------- note finding (FR-030, FR-031) ----------
/** FR-031 note sets as spellings. Cb, Fb, E# and B# are never prompted. */
const NATURALS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SHARPS = ['C#', 'D#', 'F#', 'G#', 'A#'];
const FLATS = ['Db', 'Eb', 'Gb', 'Ab', 'Bb'];
export function noteSetSpellings(s: DrillSettings): PitchClassNote[] {
  if (!s.noteSet && s.noteNames?.length) {
    const named = s.noteNames.map(parsePc).filter((x): x is PitchClassNote => !!x);
    if (named.length) return named;
  }
  if (!s.noteSet && s.notes?.length) return s.notes.map((pc) => defaultSpelling(pc, { typeId: 'major' }));
  const names = s.noteSet === 'sharps' ? [...NATURALS, ...SHARPS] : s.noteSet === 'flats' ? [...NATURALS, ...FLATS] : s.noteSet === 'all' ? [...NATURALS, ...SHARPS, ...FLATS] : NATURALS;
  return names.map(parsePc).filter((x): x is PitchClassNote => !!x);
}

function noteFinding(p: InstrumentProfile, s: DrillSettings): Candidate[] | string {
  const r = rangeOf(s, p);
  // One item per (string, pitch class) (FR-041); enharmonic spellings of the set share it.
  const byPc = new Map<number, PitchClassNote[]>();
  for (const sp of noteSetSpellings(s)) byPc.set(pitchClass(sp), [...(byPc.get(pitchClass(sp)) ?? []), sp]);
  const out: Candidate[] = [];
  for (const str of r.strings) {
    for (const [pc, spellings] of byPc) {
      const valid = positionsOf(p, { pitchClass: pc }, { ...r, strings: [str] });
      if (!valid.length) continue;
      out.push({
        key: itemKey.noteFinding(p.geometryId, str, pc),
        make: (rng) => {
          // Draw only when there is a choice of spelling (a single spelling consumes no randomness).
          const sp = spellings.length > 1 ? spellings[pickIndex(rng, spellings.length)]! : spellings[0]!;
          const exact = s.octaveMode === 'exact';
          const target = exact ? valid[pickIndex(rng, valid.length)]! : undefined;
          const m = target ? midiOf(p, target) : null;
          const name = formatPitchClass(sp);
          const octave = m !== null ? letterOctave(sp, m) : undefined; // same rule as feedback (theory r2 #3)
          const answers = target ? [target] : valid;
          return {
            drillType: 'note-finding',
            itemKey: itemKey.noteFinding(p.geometryId, str, pc),
            prompt: { drillType: 'note-finding', pitchClass: pc, string: str, midi: m },
            text: `Find ${name}${octave !== undefined ? octave : ''} on ${stringLabel(p, str)}`,
            steps: [{ label: name, valid: answers, accepts: [pc], spelled: sp }],
            reference: [],
            promptedString: str,
            context: { root: sp, typeId: 'major' },
            group: `String ${str}`,
          };
        },
      });
    }
  }
  return out.length ? out : 'None of the chosen notes is on the chosen strings and frets. Widen the fret range or pick more notes.';
}

// ---------- intervals (FR-035) ----------
const INTERVAL_NAMES: Record<string, string> = {
  m2: 'minor 2nd', M2: 'major 2nd', m3: 'minor 3rd', M3: 'major 3rd', P4: 'perfect 4th', A4: 'augmented 4th',
  d5: 'diminished 5th', P5: 'perfect 5th', m6: 'minor 6th', M6: 'major 6th', m7: 'minor 7th', M7: 'major 7th', P8: 'octave',
};
export const intervalName = (x: string) => INTERVAL_NAMES[x] ?? x;

const FUNCTION_NAMES: Record<string, string> = {
  R: 'root', '2': '2nd (2)', b3: 'minor 3rd (b3)', '3': 'major 3rd (3)', '4': '4th (4)', b5: 'flat 5th (b5)', '5': '5th (5)',
  '#5': 'sharp 5th (#5)', bb7: 'diminished 7th (bb7)', b7: 'minor 7th (b7)', '7': 'major 7th (7)', '9': '9th (9)',
};

const LETTER_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const NATURAL: Record<(typeof LETTER_ORDER)[number], number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** E♯, B♯, C♭, F♭ or any double accidental (owner decision 2026-11-22 (3)). */
const awkward = (n: PitchClassNote) => Math.abs(n.accidental) >= 2
  || (n.accidental === 1 && (n.letter === 'E' || n.letter === 'B'))
  || (n.accidental === -1 && (n.letter === 'C' || n.letter === 'F'));

/**
 * Owner decision 2026-11-22 (3) "Avoid F♭-style references" (FR-035, FR-032): a black-key reference
 * takes the spelling (the default first, then the other single-accidental one) whose answer needs no
 * E♯, B♯, C♭, F♭ or double accidental; undefined when both would (the question is not asked).
 * A white-key reference keeps its natural spelling.
 */
function intervalSpelling(pc: number, iv: Interval, dir: 'up' | 'down'):
  { ref: PitchClassNote; answer: PitchClassNote | undefined } | undefined {
  const def = defaultSpelling(pc, { typeId: 'major' });
  const answerOf = (ref: PitchClassNote) => {
    const t = transpose({ ...ref, octave: 4 }, { ...iv, direction: dir });
    return t.ok ? { letter: t.value.letter, accidental: t.value.accidental } : undefined;
  };
  if (def.accidental === 0) return { ref: def, answer: answerOf(def) };
  const sharp = LETTER_ORDER.find((l) => NATURAL[l] === mod(pc - 1, 12));
  const flat = LETTER_ORDER.find((l) => NATURAL[l] === mod(pc + 1, 12));
  const options: PitchClassNote[] = [def];
  if (sharp && !(def.letter === sharp && def.accidental === 1)) options.push({ letter: sharp, accidental: 1 });
  if (flat && !(def.letter === flat && def.accidental === -1)) options.push({ letter: flat, accidental: -1 });
  for (const ref of options) {
    const answer = answerOf(ref);
    if (answer && !awkward(answer)) return { ref, answer };
  }
  return undefined;
}

function intervalDrill(p: InstrumentProfile, s: DrillSettings): Candidate[] | string {
  const r = rangeOf(s, p);
  const ivs = s.intervals?.length ? s.intervals : ['M2', 'm3', 'M3', 'P4', 'P5', 'P8']; // FR-035 defaults
  const dirs: ('up' | 'down')[] = s.direction === 'both' ? ['up', 'down'] : [s.direction ?? 'up'];
  const all = allPositions(p, r);
  const anyStrings = { fromFret: r.fromFret, toFret: r.toFret, strings: r.strings };
  const out: Candidate[] = [];
  for (const name of ivs) {
    const parsed = parseInterval(name);
    if (!parsed.ok) continue;
    for (const dir of dirs) {
      const size = semitones({ ...parsed.value, direction: dir });
      const refs = all.filter((ref) => positionsOf(p, { midi: midiOf(p, ref) + size }, anyStrings).length > 0
        && intervalSpelling(mod(midiOf(p, ref), 12), parsed.value, dir) !== undefined);
      if (!refs.length) continue;
      const label = formatInterval({ ...parsed.value, direction: dir });
      out.push({
        key: itemKey.interval(name, dir),
        make: (rng) => {
          const ref = refs[pickIndex(rng, refs.length)]!;
          const rm = midiOf(p, ref);
          const valid = positionsOf(p, { midi: rm + size }, anyStrings);
          // FR-032: the answer is the reference transposed by the interval (F + m3 = Ab, never G#);
          // the reference spelling avoids an E♯/B♯/C♭/F♭/double-accidental answer (owner decision (3)).
          const chosen = intervalSpelling(mod(rm, 12), parsed.value, dir)!;
          const rootSp = chosen.ref;
          const rootName = formatPitchClass(rootSp);
          const spelled = chosen.answer;
          return {
            drillType: 'interval',
            itemKey: itemKey.interval(name, dir),
            prompt: { drillType: 'interval', root: ref, interval: label },
            text: `Find the ${intervalName(name)} ${dir === 'up' ? 'above' : 'below'} this ${rootName}, frets ${r.fromFret} to ${r.toFret}`,
            steps: [{ label: intervalName(name), valid, accepts: [mod(rm + size, 12)], ...(spelled ? { spelled } : {}) }],
            reference: [ref],
            // FR-032 / FR-032a: the board names the reference and the answer as the prompt does.
            spellings: spelled ? [rootSp, spelled] : [rootSp],
            group: `${intervalName(name)} ${dir}`,
          };
        },
      });
    }
  }
  return out.length ? out : 'No chosen interval fits inside this fret range. Widen the range or add strings.';
}

// ---------- chord tones (FR-036) ----------
/** FR-036 quality names (theory-checked table in the spec). */
const QUALITY_WORDS: Record<string, string> = {
  major: 'major', minor: 'minor', dim: 'diminished', aug: 'augmented', sus2: 'suspended 2nd', sus4: 'suspended 4th',
  dom7: 'dominant 7th', maj7: 'major 7th', min7: 'minor 7th', m7b5: 'half-diminished 7th', dim7: 'diminished 7th', add9: 'add 9',
};
/** FR-036: the function as an ordinal built from its label ("the root", "the 3rd", "the b7th"). */
export function functionOrdinal(fn: string): string {
  if (fn === 'R') return 'the root';
  const digit = fn.replace(/[b#]/g, '');
  const suffix = digit === '2' ? 'nd' : digit === '3' ? 'rd' : 'th';
  return `the ${fn}${suffix}`;
}
/** FR-036 default chord-tone window width. */
export const CHORD_TONE_WINDOW_DEFAULT = 4;
const WINDOW = CHORD_TONE_WINDOW_DEFAULT;

function chordTone(p: InstrumentProfile, s: DrillSettings): Candidate[] | string {
  const r = rangeOf(s, p);
  const roots = (s.roots?.length ? s.roots : ['C', 'D', 'E', 'F', 'G', 'A', 'B']).map(parsePc).filter((x): x is PitchClassNote => !!x);
  const qualities = s.qualities?.length ? s.qualities : ['major', 'minor', 'dom7'];
  const asked = Number.isFinite(s.windowWidth) ? Math.trunc(s.windowWidth!) : WINDOW;
  const w = Math.max(1, Math.min(asked, r.toFret - r.fromFret + 1));
  const starts = Array.from({ length: r.toFret - r.fromFret - w + 2 }, (_, i) => r.fromFret + i);
  const out: Candidate[] = [];
  for (const qid of qualities) {
    const q = chordQuality(qid);
    if (!q.ok) continue;
    const DEFAULT_FNS = ['R', '3', 'b3', '5', 'b5', '#5']; // FR-036: root, 3rd, 5th
    const fns = q.value.functions.filter((f) => (s.functions?.length ? s.functions : DEFAULT_FNS).includes(f));
    for (const fn of fns) {
      const toneOf = (root: PitchClassNote) => {
        const tones = buildChord(root, qid);
        return tones.ok ? tones.value[q.value.functions.indexOf(fn)] : undefined;
      };
      // Every (root, window start) whose window holds the tone on a chosen string (FR-061).
      const options: { root: PitchClassNote; from: number }[] = [];
      for (const root of roots) {
        const t = toneOf(root);
        if (!t) continue;
        for (const from of starts) {
          if (positionsOf(p, { pitchClass: pitchClass(t) }, { strings: r.strings, fromFret: from, toFret: from + w - 1 }).length) options.push({ root, from });
        }
      }
      if (!options.length) continue;
      out.push({
        key: itemKey.chordTone(qid, fn),
        make: (rng) => {
          const { root, from } = options[pickIndex(rng, options.length)]!;
          const t = toneOf(root)!;
          const to = from + w - 1;
          const valid = positionsOf(p, { pitchClass: pitchClass(t) }, { strings: r.strings, fromFret: from, toFret: to });
          const rootName = formatPitchClass(root);
          return {
            drillType: 'chord-tone',
            itemKey: itemKey.chordTone(qid, fn),
            prompt: { drillType: 'chord-tone', root: rootName, qualityId: qid, function: fn },
            text: `Find ${functionOrdinal(fn)} of the ${rootName} ${QUALITY_WORDS[qid] ?? q.value.name.toLowerCase()} chord (${chordSymbol(root, qid)}), frets ${from} to ${to}`,
            steps: [{ label: `${fn} = ${formatPitchClass(t)}`, valid, accepts: [pitchClass(t)], spelled: t }],
            reference: [],
            context: { root, qualityId: qid },
            window: { from, to },
            group: `${chordSymbol({ letter: 'C', accidental: 0 }, qid).slice(1) || 'major'}: ${fn}`,
          };
        },
      });
    }
  }
  return out.length ? out : 'No chosen chord tone is inside this fret range. Widen the range or choose more chords.';
}

// ---------- bass patterns (FR-056–FR-059) ----------
const ARPEGGIO_WINDOW = 5; // FR-057 default window width

const byPitch = (p: InstrumentProfile) => (a: FretPosition, b: FretPosition) => midiOf(p, a) - midiOf(p, b) || b.string - a.string || a.fret - b.fret;
const sameSpot = (a: FretPosition, b: FretPosition) => a.string === b.string && a.fret === b.fret;
const addUnique = (xs: FretPosition[], x: FretPosition) => { if (!xs.some((y) => sameSpot(x, y))) xs.push(x); };

/**
 * FR-056 root–fifth–octave: three fixed steps, root ("R"), 5th ("5") and octave ("octave"), taken in
 * any order (the session judges them against the question's valid shapes). No reference: the root is
 * played. The prompt names the root pitch class only: any octave of it may be the root. Each step's
 * `valid` lists every position that plays that role in at least one valid shape.
 */
function rootFifthOctave(p: InstrumentProfile, s: DrillSettings): Candidate[] | string {
  const r = rangeOf(s, p);
  const qids = (s.qualities?.length ? s.qualities : ['major', 'minor']).filter((qid) => chordQuality(qid).ok);
  if (!qids.length) return 'None of the chosen chord qualities is known.';
  const all = allPositions(p, r);
  // FR-056a reveal order: root at the lower fret, then on the higher string number.
  const order = (a: FretPosition, b: FretPosition) => a.fret - b.fret || b.string - a.string;
  // Every valid shape, grouped by the root's pitch class (FR-041: items are keyed by it).
  const byPc = new Map<number, RfoShape[]>();
  for (const rm of [...new Set(all.map((x) => midiOf(p, x)))].sort((x, y) => x - y)) {
    const rs = positionsOf(p, { midi: rm }, r).sort(order);
    const fs = positionsOf(p, { midi: rm + 7 }, r).sort(order);
    const os = positionsOf(p, { midi: rm + 12 }, r).sort(order);
    for (const a of rs) for (const f of fs) for (const o of os) {
      const fr = [a.fret, f.fret, o.fret];
      if (Math.max(...fr) - Math.min(...fr) > 3) continue;
      const pc = mod(rm, 12);
      byPc.set(pc, [...(byPc.get(pc) ?? []), { rm, pos: [a, f, o] }]);
    }
  }
  const openMidi = Array.from({ length: p.stringCount }, (_, i) => midi(openString(p, i + 1)!));
  const out: Candidate[] = [];
  for (const [pc, shapes] of byPc) {
    const key = itemKey.rootFifthOctave(pc);
    const role = (k: 0 | 1 | 2) => {
      const xs: FretPosition[] = [];
      for (const sh of shapes) addUnique(xs, sh.pos[k]);
      return xs.sort(byPitch(p));
    };
    const [rs, fs, os] = [role(0), role(1), role(2)];
    out.push({
      key,
      make: (rng) => {
        const qid = qids[pickIndex(rng, qids.length)]!;
        const root = defaultSpelling(pc, { qualityId: qid });
        // FR-032: the 5th is spelled as the chord's 5th; the octave repeats the root.
        const tones = buildChord(root, 'major');
        const fifth = tones.ok ? tones.value[2] : undefined;
        const steps: Step[] = [
          { label: 'R', valid: rs, accepts: [pc], spelled: root },
          { label: '5', valid: fs, accepts: [mod(pc + 7, 12)], ...(fifth ? { spelled: fifth } : {}) },
          { label: 'octave', valid: os, accepts: [pc], spelled: root },
        ];
        return {
          drillType: 'root-fifth-octave',
          itemKey: key,
          prompt: { drillType: 'root-fifth-octave', root: rs[0]!, qualityId: qid },
          text: `Play a root–fifth–octave shape for ${formatPitchClass(root)}, frets ${r.fromFret} to ${r.toFret}`,
          steps,
          reference: [],
          context: { root, qualityId: qid },
          shapes,
          openMidi,
          // One stable label per rfo|<pc> item, whatever quality was drawn (theory-checker r1 #8).
          group: `Root ${pcName(pc)}`,
        };
      },
    });
  }
  return out.length ? out : 'No root in this range leaves room for the whole shape. Widen the fret range or add strings.';
}

/**
 * FR-057 arpeggio: one step per chord tone in FR-005 order, Step 1 the root (played, not given),
 * ascending from the lowest root inside a window [s, s + w − 1] (w = 5, or the range when narrower).
 * s is chosen only where every step's exact pitch has a position on a selected string in the window.
 */
function arpeggio(p: InstrumentProfile, s: DrillSettings): Candidate[] | string {
  const r = rangeOf(s, p);
  const qualities = s.qualities?.length ? s.qualities : ['major', 'minor'];
  const w = Math.min(ARPEGGIO_WINDOW, r.toFret - r.fromFret + 1);
  const starts = Array.from({ length: Math.max(0, r.toFret - r.fromFret - w + 2) }, (_, i) => r.fromFret + i);
  const out: Candidate[] = [];
  for (const qid of qualities) {
    const q = chordQuality(qid);
    if (!q.ok) continue;
    const offsets = q.value.formula.map((i) => semitones(i));
    const labels = q.value.functions;
    const options: { root: PitchClassNote; tones: readonly PitchClassNote[]; from: number; rm: number }[] = [];
    for (let pc = 0; pc < 12; pc++) {
      const root = defaultSpelling(pc, { qualityId: qid });
      const tones = buildChord(root, qid);
      if (!tones.ok) continue;
      for (const from of starts) {
        const area = { strings: r.strings, fromFret: from, toFret: from + w - 1 };
        const rootPos = positionsOf(p, { pitchClass: pc }, area);
        if (!rootPos.length) continue;
        const rm = Math.min(...rootPos.map((x) => midiOf(p, x)));
        if (offsets.every((o) => positionsOf(p, { midi: rm + o }, area).length)) options.push({ root, tones: tones.value, from, rm });
      }
    }
    if (!options.length) continue;
    const key = itemKey.bass('arpeggio', qid);
    out.push({
      key,
      make: (rng) => {
        const { root, tones, from, rm } = options[pickIndex(rng, options.length)]!;
        const to = from + w - 1;
        const area = { strings: r.strings, fromFret: from, toFret: to };
        const sort = byPitch(p);
        const steps: Step[] = offsets.map((o, i) => {
          const sp = tones[i];
          return { label: labels[i]!, valid: positionsOf(p, { midi: rm + o }, area).sort(sort), accepts: [mod(rm + o, 12)], ...(sp ? { spelled: sp } : {}) };
        });
        const rootName = formatPitchClass(root);
        return {
          drillType: 'arpeggio',
          itemKey: key,
          prompt: { drillType: 'arpeggio', root: steps[0]!.valid[0]!, qualityId: qid },
          text: `Play the ${rootName} ${QUALITY_WORDS[qid] ?? q.value.name.toLowerCase()} arpeggio (${chordSymbol(root, qid)}) up from its lowest ${rootName}, frets ${from} to ${to}`,
          steps,
          reference: [],
          context: { root, qualityId: qid },
          window: { from, to },
          group: q.value.name,
        };
      },
    });
  }
  return out.length ? out : 'No chosen chord fits its arpeggio inside this fret range. Widen the range or add strings.';
}

/** Walking bass (FR-058): per chord, beat 1 root, beats 2–3 chord tones, beat 4 an approach note. */
function walking(p: InstrumentProfile, s: DrillSettings): Candidate[] | string {
  const r = rangeOf(s, p);
  const tonic = parsePc(s.key?.tonic ?? 'C');
  const mode = s.key?.mode ?? 'major';
  const chords = s.chords?.length ? s.chords : [{ root: 'C', quality: 'maj7' }, { root: 'A', quality: 'min7' }, { root: 'D', quality: 'min7' }, { root: 'G', quality: 'dom7' }];
  if (!tonic) return 'The progression needs a key.';
  if (chords.length < 2 || chords.length > 8) return 'A progression needs 2 to 8 chords.';
  const scale = buildScale(tonic, mode === 'major' ? 'major' : 'natural-minor');
  const scalePcs = scale.ok ? scale.value.map(pitchClass) : [];
  const parsed = chords.map((c) => ({ root: parsePc(c.root), quality: c.quality }));
  if (parsed.some((c) => !c.root)) return 'A chord in the progression has an unknown root.';
  const out: Candidate[] = [];
  parsed.forEach((c, idx) => {
    const tones = buildChord(c.root!, c.quality);
    if (!tones.ok) return;
    const tonePcs = tones.value.map(pitchClass);
    const next = parsed[(idx + 1) % parsed.length]!;
    const nextRoot = pitchClass(next.root!);
    const approach = [...new Set([mod(nextRoot - 1, 12), mod(nextRoot + 1, 12), mod(nextRoot - 2, 12), mod(nextRoot + 2, 12), mod(nextRoot + 7, 12), mod(nextRoot - 7, 12)])]
      .filter((x) => x !== nextRoot);
    const nextName = formatPitchClass(next.root!);
    const step = (label: string, pcs: number[], hint: string): Step => ({
      label,
      hint,
      accepts: pcs,
      valid: pcs.flatMap((pc) => positionsOf(p, { pitchClass: pc }, r)),
    });
    const sym = chordSymbol(c.root!, c.quality);
    const steps = [
      step('beat 1: root', [tonePcs[0]!], `Beat 1 is the root of ${sym}, ${formatPitchClass(c.root!)}.`),
      step('beat 2: chord or scale tone', [...new Set([...tonePcs, ...scalePcs])], `Beat 2 is a tone of ${sym} or a note of the key.`),
      step('beat 3: chord or scale tone', [...new Set([...tonePcs, ...scalePcs])], `Beat 3 is a chord tone or a note of the key.`),
      step(`beat 4: lead into ${nextName}`, approach, `Beat 4 leads into ${nextName}: one fret above or below it, a whole step away, or its 5th, but not ${nextName} itself.`),
    ];
    if (steps.some((st) => !st.valid.length)) return;
    out.push({
      key: itemKey.bass('walking-bass', c.quality),
      make: () => ({
        drillType: 'walking-bass',
        itemKey: itemKey.bass('walking-bass', c.quality),
        prompt: { drillType: 'walking-bass', key: { tonic: formatPitchClass(tonic), mode }, chords: chords.map((x) => ({ root: x.root, quality: x.quality })) },
        text: `Walk one bar over ${sym} (next chord ${chordSymbol(next.root!, next.quality)})`,
        steps,
        reference: [],
        context: { root: c.root!, qualityId: c.quality },
        group: sym,
      }),
    });
  });
  return out.length ? out : 'The progression has no playable bar inside this fret range.';
}

function candidatesFor(p: InstrumentProfile, s: DrillSettings): Candidate[] | string {
  if (!rangeOf(s, p).strings.length) return 'Choose at least one string.';
  switch (s.type) {
    case 'note-finding': return noteFinding(p, s);
    case 'interval': return intervalDrill(p, s);
    case 'chord-tone': return chordTone(p, s);
    case 'walking-bass': return walking(p, s);
    case 'chord-tone-lock': return 'Chord-tone lock is not available yet.';
    case 'root-fifth-octave': return rootFifthOctave(p, s);
    case 'arpeggio': return arpeggio(p, s);
    default: return 'This drill type is not available.';
  }
}

/** FR-061: rejects settings that can't produce an answerable question, with a reason. */
export function validateSettings(p: InstrumentProfile, s: DrillSettings): { ok: true } | Fail {
  if (s.count < 5 || s.count > 100) return { ok: false, reason: 'Choose between 5 and 100 questions.' };
  const c = candidatesFor(p, s);
  return typeof c === 'string' ? { ok: false, reason: c } : { ok: true };
}

/** Generates the questions for a session; weighted by item history when adaptive (FR-041). */
export function generateQuestions(input: GenerateInput): GenResult {
  // T093a: only the spec's drill ids are offered (never 'legacy').
  if (!(DRILL_TYPES as readonly string[]).includes(input.settings.type)) return { ok: false, reason: 'This drill type is not available.' };
  const v = validateSettings(input.profile, input.settings);
  if (!v.ok) return v;
  const cands = candidatesFor(input.profile, input.settings) as Candidate[];
  const weights = cands.map((c) => itemWeight(input.histories.get(c.key), input.adaptive));
  const questions: Question[] = [];
  let lastKey = '';
  for (let i = 0; i < input.settings.count; i++) {
    let c = weightedPick(input.rng, cands, weights);
    if (c.key === lastKey && cands.length > 1) c = weightedPick(input.rng, cands, weights); // soften repeats
    lastKey = c.key;
    questions.push(c.make(input.rng));
  }
  return { ok: true, questions };
}

/** Judges one tap for the current step. */
export function judgeTap(q: Question, stepIndex: number, tap: FretPosition): boolean {
  const step = q.steps[stepIndex];
  return !!step && step.valid.some((v) => v.string === tap.string && v.fret === tap.fret);
}

