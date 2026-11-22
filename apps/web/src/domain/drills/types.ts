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
  readonly notes?: readonly number[]; // note-finding pitch classes
  readonly intervals?: readonly string[]; // e.g. ["m3","M3","P5"]
  readonly direction?: 'up' | 'down' | 'both';
  readonly roots?: readonly string[]; // pitch-class note names for chord drills
  readonly qualities?: readonly string[];
  readonly functions?: readonly string[];
  readonly key?: { tonic: string; mode: 'major' | 'minor' };
  readonly chords?: readonly { root: string; quality: string }[];
}

export interface Step {
  readonly label: string;
  readonly valid: readonly FretPosition[];
  /** Pitch classes accepted at this step (for feedback text). */
  readonly accepts: readonly number[];
  /** Why a wrong answer is wrong, shown in feedback (e.g. the walking-bass beat rule). */
  readonly hint?: string;
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
  /** Group label for the summary, e.g. "String 3", "M3 up", "Cmaj7: b7". */
  readonly group: string;
}

export const DRILL_LABELS: Record<DrillType, string> = {
  'note-finding': 'Note finding',
  interval: 'Intervals',
  'chord-tone': 'Chord tones',
  'bass-root-fifth-octave': 'Root, fifth, octave',
  'bass-arpeggio': 'Arpeggios',
  'bass-walking': 'Walking bass',
  'bass-octave-shapes': 'Octave shapes',
};
