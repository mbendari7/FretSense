import { buildChord } from './chord';
import { degreeLabel, iv, transposePc } from './interval';
import { mod, naturalPc, pitchClass, sharpSpelling, LETTERS, type Accidental, type PitchClassNote } from './note';
import { buildScale } from './scale';

export type SpellingContext = { typeId: string } | { qualityId: string };

/** FR-060: fixed chromatic map relative to the root. */
const CHROMATIC = ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7'].map(iv);

function tonesFor(root: PitchClassNote, ctx: SpellingContext) {
  return 'typeId' in ctx ? buildScale(root, ctx.typeId) : buildChord(root, ctx.qualityId);
}

const accidentalCost = (notes: PitchClassNote[]): number =>
  notes.reduce((s, n) => s + Math.abs(n.accidental), 0);

/** Spellings of a pitch class with at most one accidental (one or two candidates). */
export function spellingsOf(pc: number): PitchClassNote[] {
  const out: PitchClassNote[] = [];
  for (const letter of LETTERS) {
    const acc = mod(pc - naturalPc(letter) + 6, 12) - 6;
    if (acc >= -1 && acc <= 1) out.push({ letter, accidental: acc as Accidental });
  }
  return out.sort((a, b) => Math.abs(a.accidental) - Math.abs(b.accidental) || b.accidental - a.accidental);
}

/**
 * Default root spelling (Edge Cases): white keys use the natural; black keys pick the spelling
 * whose resulting tones have fewer accidentals (double counts 2), ties go to sharps.
 */
export function defaultSpelling(pc: number, context: SpellingContext): PitchClassNote {
  const options = spellingsOf(mod(pc, 12));
  const natural = options.find((o) => o.accidental === 0);
  if (natural) return natural;
  let best = sharpSpelling(pc);
  let bestCost = Infinity;
  for (const cand of options.sort((a, b) => b.accidental - a.accidental)) {
    const tones = tonesFor(cand, context);
    const cost = tones.ok ? accidentalCost(tones.value) : Infinity;
    if (cost < bestCost) {
      best = cand;
      bestCost = cost;
    }
  }
  return best;
}

/** FR-060: spell and label any note relative to a root by the fixed chromatic map. */
export function chromaticLabel(root: PitchClassNote, note: PitchClassNote | number): { spelled: PitchClassNote; degree: string } {
  const pc = typeof note === 'number' ? note : pitchClass(note);
  const offset = mod(pc - pitchClass(root), 12);
  const interval = CHROMATIC[offset]!;
  const t = transposePc(root, interval);
  return { spelled: t.ok ? t.value : sharpSpelling(pc), degree: degreeLabel(interval) };
}

/**
 * Spells a pitch class in a scale or chord context: context tones keep the context spelling and
 * label, everything else follows FR-060.
 */
export function spellInContext(
  root: PitchClassNote,
  ctx: SpellingContext,
  pc: number,
): { spelled: PitchClassNote; label: string; inContext: boolean; isRoot: boolean } {
  const tones = tonesFor(root, ctx);
  if (tones.ok) {
    const labels = 'typeId' in ctx ? scaleLabels(ctx.typeId) : chordLabels(ctx.qualityId);
    const i = tones.value.findIndex((t) => pitchClass(t) === mod(pc, 12));
    if (i >= 0) return { spelled: tones.value[i]!, label: labels[i] ?? '', inContext: true, isRoot: i === 0 };
  }
  const c = chromaticLabel(root, pc);
  return { spelled: c.spelled, label: c.degree, inContext: false, isRoot: false };
}

import { scaleType } from './scale';
import { chordQuality } from './chord';
import { functionLabel } from './interval';
function scaleLabels(typeId: string): string[] {
  const t = scaleType(typeId);
  return t.ok ? t.value.formula.map(degreeLabel) : [];
}
function chordLabels(qualityId: string): string[] {
  const c = chordQuality(qualityId);
  return c.ok ? c.value.formula.map(functionLabel) : [];
}
