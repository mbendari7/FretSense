import { FAMILY_RULES, validateProfile, type InstrumentProfile } from './instrument';
import { parseNote } from './note';
import { unwrap } from './result';

/** FR-009, FR-052: the built-in starting points. Never assumed defaults (Constitution XIII). */
export interface Preset {
  readonly presetId: string;
  readonly name: string;
  readonly profile: InstrumentProfile;
}

const make = (presetId: string, name: string, family: 'guitar' | 'bass', tuning: string): Preset => ({
  presetId,
  name,
  profile: unwrap(validateProfile({
    family,
    tuning: tuning.split(' ').map((t) => unwrap(parseNote(t))),
    fretCount: FAMILY_RULES[family].defaultFretCount,
    scaleLengthMm: FAMILY_RULES[family].defaultScaleLengthMm,
  })),
});

const PRESETS: readonly Preset[] = [
  make('guitar6-standard', '6-string guitar, Standard (EADGBE)', 'guitar', 'E2 A2 D3 G3 B3 E4'),
  make('guitar6-drop-d', '6-string guitar, Drop D', 'guitar', 'D2 A2 D3 G3 B3 E4'),
  make('guitar6-eb', '6-string guitar, Eb (half step down)', 'guitar', 'Eb2 Ab2 Db3 Gb3 Bb3 Eb4'),
  make('guitar6-dadgad', '6-string guitar, DADGAD', 'guitar', 'D2 A2 D3 G3 A3 D4'),
  make('bass4-standard', '4-string bass, Standard (EADG)', 'bass', 'E1 A1 D2 G2'),
  make('bass4-drop-d', '4-string bass, Drop D', 'bass', 'D1 A1 D2 G2'),
  make('bass5-beadg', '5-string bass, BEADG', 'bass', 'B0 E1 A1 D2 G2'),
];
const BY_ID = new Map(PRESETS.map((p) => [p.presetId, p]));

export const presets = (): Preset[] => [...PRESETS];
export const presetById = (id: string): Preset | undefined => BY_ID.get(id);
