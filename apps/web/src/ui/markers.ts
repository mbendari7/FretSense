import {
  formatNote, formatPitchClass, midiAt, mod, noteAt, spellInContext, type FretPosition, type InstrumentProfile, type PitchClassNote,
} from '@fretsense/theory';
import type { Marker } from './fretboard/Fretboard';

export type Ctx = { root: PitchClassNote; typeId?: string; qualityId?: string };
export type LabelMode = 'notes' | 'degrees' | 'none';

const pretty = (s: string) => s.replace(/bb/g, '𝄫').replace(/##/g, '𝄪').replace(/b/g, '♭').replace(/#/g, '♯');
export const prettyNote = (n: PitchClassNote) => pretty(formatPitchClass(n));
export const prettyText = (s: string) => s.replace(/([A-G])(bb|##|b|#)/g, (_m, l: string, a: string) => l + pretty(a));

const ctxOf = (c: Ctx) => (c.typeId ? { typeId: c.typeId } : { qualityId: c.qualityId! });

/** Markers for every in-context tone in the window (explorer, See stage, key helper). */
export function contextMarkers(profile: InstrumentProfile, c: Ctx, from: number, to: number, mode: LabelMode): Marker[] {
  const out: Marker[] = [];
  for (let s = 1; s <= profile.stringCount; s++) {
    for (let f = from; f <= to; f++) {
      const m = midiAt(profile, { string: s, fret: f });
      if (!m.ok) continue;
      const sp = spellInContext(c.root, ctxOf(c), mod(m.value, 12));
      if (!sp.inContext) continue;
      out.push({
        pos: { string: s, fret: f },
        kind: sp.isRoot ? 'root' : 'tone',
        label: mode === 'notes' ? prettyNote(sp.spelled) : mode === 'degrees' ? pretty(sp.label) : '',
        name: `${c.qualityId ? 'function' : 'degree'} ${sp.label}${sp.isRoot ? ', root' : ''}`,
      });
    }
  }
  return out;
}

/** Describes any position: "String 3, fret 5: C4" with context degree (FR-020). */
export function describePosition(profile: InstrumentProfile, pos: FretPosition, c?: Ctx): string {
  const n = noteAt(profile, pos, c);
  const base = `String ${pos.string}, fret ${pos.fret}`;
  return n.ok ? `${base}, ${pretty(formatNote(n.value))}` : base;
}

export function positionInfo(profile: InstrumentProfile, pos: FretPosition, c?: Ctx) {
  const n = noteAt(profile, pos, c);
  const m = midiAt(profile, pos);
  if (!n.ok || !m.ok) return undefined;
  const sp = c ? spellInContext(c.root, ctxOf(c), mod(m.value, 12)) : undefined;
  return { note: pretty(formatNote(n.value)), degree: sp ? pretty(sp.label) : undefined, inContext: sp?.inContext ?? false, midi: m.value };
}
