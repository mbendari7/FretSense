import { chordQualities, defaultSpelling, formatPitchClass, parsePitchClassNote, scaleTypes, type InstrumentProfile, type PitchClassNote } from '@fretsense/theory';
import type { DisplaySettings } from '../domain/records';
import { useApp } from './hooks';

export const PC_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const PC_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const BLACK = new Set([1, 3, 6, 8, 10]);
export const pretty = (s: string) => s.replace(/b/g, '♭').replace(/#/g, '♯');
export const SCALES = scaleTypes();
export const CHORDS = chordQualities();

export function parsePc(s: string | null | undefined): PitchClassNote | undefined {
  if (!s) return undefined;
  const r = parsePitchClassNote(s);
  return r.ok && Math.abs(r.value.accidental) <= 1 ? r.value : undefined;
}

/** Root picker: 12 pitch classes; black keys toggle between sharp and flat spelling (FR-019). */
export function RootPicker({ value, onChange, context, label = 'Root' }: {
  value: PitchClassNote; onChange: (r: PitchClassNote) => void; context: { typeId: string } | { qualityId: string }; label?: string;
}) {
  const cur = formatPitchClass(value);
  return (
    <fieldset className="roots">
      <legend>{label}</legend>
      <div className="root-row">
        {PC_SHARP.map((sharp, pc) => {
          const flat = PC_FLAT[pc]!;
          const black = BLACK.has(pc);
          const selected = cur === sharp || cur === flat;
          const shown = selected ? cur : black ? formatPitchClass(defaultSpelling(pc, context)) : sharp;
          return (
            <button
              key={pc}
              type="button"
              className={`root${black ? ' black' : ''}`}
              aria-pressed={selected}
              aria-label={black ? `${pretty(shown)} (tap again for ${pretty(shown === sharp ? flat : sharp)})` : sharp}
              onClick={() => {
                if (selected && black) onChange(parsePc(cur === sharp ? flat : sharp)!);
                else onChange(parsePc(shown)!);
              }}
            >
              {pretty(shown)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/** Fret window control (FR-015), clamped to the instrument's fret count. */
export function WindowControl({ profile, value, onChange }: { profile: InstrumentProfile; value: readonly [number, number]; onChange: (w: [number, number]) => void }) {
  const [a, b] = value;
  const clamp = (n: number) => Math.max(0, Math.min(profile.fretCount, Math.round(n) || 0));
  return (
    <fieldset className="window">
      <legend>Frets</legend>
      <label>From <input type="number" inputMode="numeric" min={0} max={profile.fretCount} value={a} onChange={(e) => { const v = clamp(+e.target.value); onChange([v, Math.max(v, b)]); }} /></label>
      <label>to <input type="number" inputMode="numeric" min={0} max={profile.fretCount} value={b} onChange={(e) => { const v = clamp(+e.target.value); onChange([Math.min(a, v), v]); }} /></label>
      <button type="button" className="link" onClick={() => onChange([0, profile.fretCount])}>Whole neck</button>
    </fieldset>
  );
}

export function useDisplay(): [DisplaySettings, (p: Partial<DisplaySettings>) => void] {
  const app = useApp();
  const d = app.getState().settings!.display;
  return [d, (p) => void app.updateSettings({ display: { ...app.getState().settings!.display, ...p } })];
}

export const clampWindow = (w: readonly [number, number], profile: InstrumentProfile): [number, number] => {
  const a = Math.min(Math.max(0, w[0]), profile.fretCount);
  const b = Math.min(Math.max(a, w[1]), profile.fretCount);
  return [a, b];
};
