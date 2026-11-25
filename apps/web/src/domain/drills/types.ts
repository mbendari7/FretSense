import type { FretPosition, PitchClassNote } from '@fretsense/theory';
import type { AttemptPrompt, DrillType } from '../records';

/** Drill settings (FR-030–FR-036, FR-056–FR-059). Pitch classes are 0–11. */
export interface DrillSettings {
  readonly type: DrillType;
  readonly strings: readonly number[];
  readonly fromFret: number;
  readonly toFret: number;
  readonly count: number; // 5–100
  readonly octaveMode: 'any' | 'exact';
  readonly notes?: readonly number[]; // note-finding pitch classes (lesson drills; used only when noteSet is absent)
  /** FR-027: the lesson's spellings of `notes` (e.g. "Db", "F#"); prompts use them as written. */
  readonly noteNames?: readonly string[];
  /** FR-031 note set; the default (neither noteSet nor notes) is the 7 naturals. */
  readonly noteSet?: 'naturals' | 'sharps' | 'flats' | 'all';
  readonly intervals?: readonly string[]; // e.g. ["m3","M3","P5"]
  readonly direction?: 'up' | 'down' | 'both';
  readonly roots?: readonly string[]; // pitch-class note names for chord drills
  readonly qualities?: readonly string[];
  readonly functions?: readonly string[];
  /** FR-036 chord-tone window width in frets; absent means 4. Clamped to 1 … the fret-range size. */
  readonly windowWidth?: number;
  readonly key?: { tonic: string; mode: 'major' | 'minor' };
  readonly chords?: readonly { root: string; quality: string }[];
}

export interface Step {
  readonly label: string;
  readonly valid: readonly FretPosition[];
  /** Pitch classes accepted at this step (for feedback text). */
  readonly accepts: readonly number[];
  /** The step's answer as spelled in this question (FR-032); feedback uses it. */
  readonly spelled?: PitchClassNote;
  /** Why a wrong answer is wrong, shown in feedback (e.g. the walking-bass beat rule). */
  readonly hint?: string;
}

export interface RfoShape {
  readonly rm: number;
  readonly pos: readonly [FretPosition, FretPosition, FretPosition];
}

export interface Question {
  readonly drillType: DrillType;
  readonly itemKey: string;
  readonly prompt: AttemptPrompt;
  /** Main instruction, e.g. "Find F# on string 3". */
  readonly text: string;
  readonly steps: readonly Step[];
  /** Position(s) shown as the reference (interval root, bass root). */
  readonly reference: readonly FretPosition[];
  readonly promptedString?: number;
  /** Context for labels on the fretboard. */
  readonly context?: { root: PitchClassNote; typeId?: string; qualityId?: string };
  /**
   * The question's own spelling source (FR-032, FR-032a): a position whose pitch class matches one
   * of these notes is labelled and named with it, ahead of `context`. Interval questions carry the
   * reference and the answer as the prompt spells them (Bb + m3 = Db, never A# or C#).
   */
  readonly spellings?: readonly PitchClassNote[];
  /**
   * FR-056 valid shapes (root, 5th, octave positions), in FR-056a reveal order: lowest-pitched root;
   * then root at the lower fret, then on the higher string number; then the same for the 5th, then
   * the octave. `rm` is the root's MIDI pitch.
   */
  readonly shapes?: readonly RfoShape[];
  /** MIDI pitch of each open string, by string number − 1 (FR-056a charges wrong taps by pitch class). */
  readonly openMidi?: readonly number[];
  /** FR-036 inclusive window [from, to], when the drill states one. */
  readonly window?: { from: number; to: number };
  /** Group label for the summary, e.g. "String 3", "M3 up", "Cmaj7: b7". */
  readonly group: string;
}

export const DRILL_LABELS: Record<DrillType, string> = {
  'note-finding': 'Note finding',
  interval: 'Intervals',
  'chord-tone': 'Chord tones',
  'root-fifth-octave': 'Root, fifth, octave',
  arpeggio: 'Arpeggios',
  'walking-bass': 'Walking bass',
  'chord-tone-lock': 'Chord-tone lock',
};
