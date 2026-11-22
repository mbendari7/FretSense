import {
  buildChord, chordSymbol, formatInterval, formatPitchClass, midi, mod, openString, parseInterval,
  parsePitchClassNote, pitchClass, positionsOf, semitones, buildScale, chordQuality, defaultSpelling,
  type FretPosition, type InstrumentProfile, type PitchClassNote,
} from '@fretsense/theory';
import { itemKey } from '../records';
import { pickIndex, weightedPick, type Rng } from '../prng';
import { itemWeight, type ItemHistory } from '../weighting';
import type { DrillSettings, Question, Step } from './types';

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

function stringLabel(p: InstrumentProfile, n: number): string {
  const open = formatPitchClass(openString(p, n)!);
  // FR-030: the lowest-pitched string is "low", the highest "high"; inner strings carry no qualifier.
  const qual = n === p.stringCount ? 'low ' : n === 1 ? 'high ' : '';
  return `${STRING_ORD(n)} (${qual}${open})`;
}

// ---------- note finding (FR-030, FR-031) ----------
function noteFinding(p: InstrumentProfile, s: DrillSettings): Candidate[] | string {
  const r = rangeOf(s, p);
  const notes = s.notes?.length ? s.notes : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const out: Candidate[] = [];
  for (const str of r.strings) {
    for (const pc of notes) {
      const valid = positionsOf(p, { pitchClass: pc }, { ...r, strings: [str] });
      if (!valid.length) continue;
      out.push({
        key: itemKey.noteFinding(p.geometryId, str, pc),
        make: (rng) => {
          const exact = s.octaveMode === 'exact';
          const target = exact ? valid[pickIndex(rng, valid.length)]! : undefined;
          const m = target ? midiOf(p, target) : null;
          const name = pcName(pc);
          const octave = m !== null ? Math.floor(m / 12) - 1 : undefined;
          const answers = target ? [target] : valid;
          return {
            drillType: 'note-finding',
            itemKey: itemKey.noteFinding(p.geometryId, str, pc),
            prompt: { drillType: 'note-finding', pitchClass: pc, string: str, midi: m },
            text: `Find ${name}${octave !== undefined ? octave : ''} on ${stringLabel(p, str)}`,
            steps: [{ label: name, valid: answers, accepts: [pc] }],
            reference: [],
            promptedString: str,
            context: { root: defaultSpelling(pc, { typeId: 'major' }), typeId: 'major' },
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
      const refs = all.filter((ref) => positionsOf(p, { midi: midiOf(p, ref) + size }, anyStrings).length > 0);
      if (!refs.length) continue;
      const label = formatInterval({ ...parsed.value, direction: dir });
      out.push({
        key: itemKey.interval(name, dir),
        make: (rng) => {
          const ref = refs[pickIndex(rng, refs.length)]!;
          const rm = midiOf(p, ref);
          const valid = positionsOf(p, { midi: rm + size }, anyStrings);
          const rootName = pcName(mod(rm, 12));
          return {
            drillType: 'interval',
            itemKey: itemKey.interval(name, dir),
            prompt: { drillType: 'interval', root: ref, interval: label },
            text: `Find the ${intervalName(name)} ${dir === 'up' ? 'above' : 'below'} this ${rootName}`,
            steps: [{ label: intervalName(name), valid, accepts: [mod(rm + size, 12)] }],
            reference: [ref],
            group: `${intervalName(name)} ${dir}`,
          };
        },
      });
    }
  }
  return out.length ? out : 'No chosen interval fits inside this fret range. Widen the range or add strings.';
}

// ---------- chord tones (FR-036) ----------
function chordTone(p: InstrumentProfile, s: DrillSettings): Candidate[] | string {
  const r = rangeOf(s, p);
  const roots = (s.roots?.length ? s.roots : ['C', 'D', 'E', 'F', 'G', 'A', 'B']).map(parsePc).filter((x): x is PitchClassNote => !!x);
  const qualities = s.qualities?.length ? s.qualities : ['major', 'minor', 'dom7'];
  const out: Candidate[] = [];
  for (const qid of qualities) {
    const q = chordQuality(qid);
    if (!q.ok) continue;
    const DEFAULT_FNS = ['R', '3', 'b3', '5', 'b5', '#5']; // FR-036: root, 3rd, 5th
    const fns = q.value.functions.filter((f) => (s.functions?.length ? s.functions : DEFAULT_FNS).includes(f));
    for (const fn of fns) {
      const viable = roots.filter((root) => {
        const tones = buildChord(root, qid);
        if (!tones.ok) return false;
        const t = tones.value[q.value.functions.indexOf(fn)]!;
        return positionsOf(p, { pitchClass: pitchClass(t) }, r).length > 0;
      });
      if (!viable.length) continue;
      out.push({
        key: itemKey.chordTone(qid, fn),
        make: (rng) => {
          const root = viable[pickIndex(rng, viable.length)]!;
          const tones = buildChord(root, qid);
          const t = tones.ok ? tones.value[q.value.functions.indexOf(fn)]! : root;
          const valid = positionsOf(p, { pitchClass: pitchClass(t) }, r);
          return {
            drillType: 'chord-tone',
            itemKey: itemKey.chordTone(qid, fn),
            prompt: { drillType: 'chord-tone', root: formatPitchClass(root), qualityId: qid, function: fn },
            text: `In ${chordSymbol(root, qid)} (${formatPitchClass(root)} ${q.value.name.toLowerCase()}), find the ${FUNCTION_NAMES[fn] ?? fn}`,
            steps: [{ label: `${fn} = ${formatPitchClass(t)}`, valid, accepts: [pitchClass(t)] }],
            reference: [],
            context: { root, qualityId: qid },
            group: `${chordSymbol({ letter: 'C', accidental: 0 }, qid).slice(1) || 'major'}: ${fn}`,
          };
        },
      });
    }
  }
  return out.length ? out : 'No chosen chord tone is inside this fret range. Widen the range or choose more chords.';
}

// ---------- bass patterns (FR-056–FR-059) ----------
function exactStep(p: InstrumentProfile, m: number, label: string, r: ReturnType<typeof rangeOf>): Step {
  return { label, valid: positionsOf(p, { midi: m }, r), accepts: [mod(m, 12)] };
}

function bassShape(p: InstrumentProfile, s: DrillSettings): Candidate[] | string {
  const r = rangeOf(s, p);
  const qualities = s.type === 'bass-octave-shapes' ? ['major'] : s.qualities?.length ? s.qualities : ['major', 'minor'];
  const all = allPositions(p, r);
  const out: Candidate[] = [];
  for (const qid of qualities) {
    const q = chordQuality(qid);
    if (!q.ok) continue;
    const offsets = s.type === 'bass-root-fifth-octave' ? [7, 12] : s.type === 'bass-octave-shapes' ? [12] : q.value.formula.slice(1).map((i) => semitones(i)).concat(12);
    const labels = s.type === 'bass-root-fifth-octave' ? ['5', 'octave'] : s.type === 'bass-octave-shapes' ? ['octave'] : [...q.value.functions.slice(1), 'octave'];
    const compact = s.type === 'bass-root-fifth-octave';
    const refs = all.filter((ref) => {
      const per = offsets.map((o) => positionsOf(p, { midi: midiOf(p, ref) + o }, r));
      if (per.some((x) => !x.length)) return false;
      if (!compact) return true;
      const [f5, f8] = per as [FretPosition[], FretPosition[]];
      return f5.some((a) => f8.some((b) => Math.max(ref.fret, a.fret, b.fret) - Math.min(ref.fret, a.fret, b.fret) <= 3));
    });
    if (!refs.length) continue;
    out.push({
      key: itemKey.bass(s.type, qid),
      make: (rng) => {
        const ref = refs[pickIndex(rng, refs.length)]!;
        const rm = midiOf(p, ref);
        const root = defaultSpelling(mod(rm, 12), { qualityId: qid });
        // FR-056: a step counts only within 3 frets of the root; the session also checks the whole
        // shape's span (max − min ≤ 3). Roots are chosen so such a shape exists.
        const near = (x: FretPosition) => !compact || Math.abs(x.fret - ref.fret) <= 3;
        const steps = offsets.map((o, i) => {
          const st = exactStep(p, rm + o, labels[i]!, r);
          return { ...st, valid: st.valid.filter(near) };
        });
        const what = s.type === 'bass-root-fifth-octave' ? 'Play the 5th, then the octave, from this root'
          : s.type === 'bass-octave-shapes' ? 'Find the octave above this root'
          : `Play the ${chordSymbol(root, qid)} arpeggio up from this root`;
        const prompt = s.type === 'bass-octave-shapes'
          ? { drillType: 'bass-octave-shapes' as const, root: ref }
          : { drillType: s.type as 'bass-root-fifth-octave' | 'bass-arpeggio', root: ref, qualityId: qid };
        return {
          drillType: s.type,
          itemKey: itemKey.bass(s.type, qid),
          prompt,
          text: `${what} (${formatPitchClass(root)})`,
          steps,
          reference: [ref],
          context: { root, qualityId: qid },
          group: s.type === 'bass-octave-shapes' ? 'Octaves' : q.value.name,
        };
      },
    });
  }
  return out.length ? out : 'No root in this range leaves room for the whole shape. Widen the fret range or add strings.';
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
      key: itemKey.bass('bass-walking', c.quality),
      make: () => ({
        drillType: 'bass-walking',
        itemKey: itemKey.bass('bass-walking', c.quality),
        prompt: { drillType: 'bass-walking', key: { tonic: formatPitchClass(tonic), mode }, chords: chords.map((x) => ({ root: x.root, quality: x.quality })) },
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
    case 'bass-walking': return walking(p, s);
    default: return bassShape(p, s);
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

