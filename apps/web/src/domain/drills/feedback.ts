import { chordSymbol, chromaticLabel, defaultSpelling, spellInContext, formatPitchClass, midi, openString, type FretPosition, type InstrumentProfile, type PitchClassNote } from '@fretsense/theory';
import type { Question } from './types';

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * Feedback text for a judged tap (FR-032, FR-036, FR-049).
 * - One spelling per question: step k's own spelling (prompted note, transposed interval
 *   reference, chord tone), else a default spelling of its pitch class.
 * - Octaves belong to the spelled note (letter octave: Cb4 sounds like B3), never floor(midi/12)-1.
 * - Note-finding in any-octave mode carries no octave numbers; exact-octave mode and the other
 *   drills include the octave.
 * - An incorrect note-finding answer lists every correct fret on the prompted string inside the
 *   question's fret range, ascending. Other drills list every valid position, grouped by note.
 * - A tap of the right note outside the question's stated window gets "Outside frets X to Y".
 * - Incorrect text starts "Incorrect. You tapped <note> at fret F; " (note-finding) or "... at string S
 *   fret F; " (other drills), the tapped note spelled as `spellTapped` says (CR-B2-15).
 */
export function feedbackText(input: { profile: InstrumentProfile; question: Question; tap: FretPosition; correct: boolean; stepIndex?: number }): string {
  const { profile, question: q, tap, correct } = input;
  const step = q.steps[input.stepIndex ?? 0] ?? q.steps[0];
  const pc = step?.accepts[0] ?? 0;
  const spelled: PitchClassNote = step?.spelled ?? defaultSpelling(pc, { typeId: 'major' });
  const name = formatPitchClass(spelled);
  const midiAt = (pos: FretPosition) => midi(openString(profile, pos.string)!) + pos.fret;
  const withOct = (pos: FretPosition) => `${name}${letterOctave(spelled, midiAt(pos))}`;
  const noteFinding = q.prompt.drillType === 'note-finding';
  const octaves = !noteFinding || q.prompt.midi !== null;
  const named = (pos: FretPosition) => (octaves ? withOct(pos) : name);

  if (correct) return `Correct, ${named(tap)} on string ${tap.string} fret ${tap.fret}`;

  // CR-B2-15: name the tapped note first, spelled by FR-060 relative to the prompted note, with
  // the same octave rule; note-finding judges only the prompted string, so it names the fret only.
  const tapMidi = midiAt(tap);
  const tapPc = ((tapMidi % 12) + 12) % 12;
  const tapSpelled = spellTapped(q, spelled, tapPc);
  const tapName = `${formatPitchClass(tapSpelled)}${octaves ? letterOctave(tapSpelled, tapMidi) : ''}`;
  const where = noteFinding ? `fret ${tap.fret}` : `string ${tap.string} fret ${tap.fret}`;
  const lead = `Incorrect. You tapped ${tapName} at ${where}; `;

  if (q.window && step?.accepts.includes(tapPc) && (tap.fret < q.window.from || tap.fret > q.window.to)) {
    return `${lead}Outside frets ${q.window.from} to ${q.window.to}`;
  }

  const valid = step?.valid ?? [];
  if (noteFinding) {
    const s = q.promptedString ?? tap.string;
    const frets = valid.filter((v) => v.string === s).map((v) => v.fret).sort((a, b) => a - b);
    const target = octaves && frets.length === 1 ? withOct({ string: s, fret: frets[0]! }) : name;
    return `${lead}${target} on string ${s} is at ${fretList(frets)}`;
  }
  // Group the valid positions by the note (with octave) they sound.
  const groups = new Map<string, FretPosition[]>();
  for (const v of [...valid].sort((a, b) => midiAt(a) - midiAt(b) || a.string - b.string || a.fret - b.fret)) {
    const k = withOct(v);
    groups.set(k, [...(groups.get(k) ?? []), v]);
  }
  const parts = [...groups].map(([n, ps]) => `${n} is at ${joinAnd(ps.map((p) => `string ${p.string} fret ${p.fret}`))}`);
  return `${lead}${parts.join('; ') || `${name} is not in this range`}`;
}

/**
 * FR-049 (CR-B2-15): note-finding and interval drills spell the tap by FR-060 relative to the
 * prompted note; chord drills spell it relative to the chord root, and a chord tone keeps the
 * chord's spelling.
 */
function spellTapped(q: Question, prompted: PitchClassNote, pc: number): PitchClassNote {
  const ctx = q.drillType === 'note-finding' || q.drillType === 'interval' ? undefined : q.context;
  if (!ctx) return chromaticLabel(prompted, pc).spelled;
  if (ctx.qualityId) return spellInContext(ctx.root, { qualityId: ctx.qualityId }, pc).spelled;
  if (ctx.typeId) return spellInContext(ctx.root, { typeId: ctx.typeId }, pc).spelled;
  return chromaticLabel(ctx.root, pc).spelled;
}

/** Scientific-pitch octave of a spelled note sounding at `m` (C4 = 60; Cb4 = 59; B#3 = 60). */
export function letterOctave(n: PitchClassNote, m: number): number {
  return Math.round((m - LETTER_PC[n.letter]! - n.accidental) / 12) - 1;
}

function fretList(frets: readonly number[]): string {
  if (frets.length === 1) return `fret ${frets[0]}`;
  return `frets ${joinAnd(frets.map(String))}`;
}

function joinAnd(xs: readonly string[]): string {
  if (xs.length <= 1) return xs.join('');
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

/**
 * FR-057: when the last step is judged, every missed step with its target, in the question's
 * spelling and with the letter octave: "Missed: b3 F#4 at string 3 fret 11; octave D#5 at string 1
 * fret 11". Empty when no step was missed. `taps[k]` is the judged tap of step k (undefined while
 * pending). The root is written "root" (FR-057); other steps use their label.
 */
export function missedStepsText(profile: InstrumentProfile, q: Question, taps: readonly ({ correct: boolean; revealed?: FretPosition } | undefined)[]): string {
  const midiAt = (pos: FretPosition) => midi(openString(profile, pos.string)!) + pos.fret;
  const parts: string[] = [];
  q.steps.forEach((step, k) => {
    if (!taps[k] || taps[k]!.correct) return;
    const spelled = step.spelled ?? defaultSpelling(step.accepts[0] ?? 0, { typeId: 'major' });
    const groups = new Map<string, FretPosition[]>();
    // FR-056a: a root–fifth–octave step lists the one position revealed for it.
    const targets = taps[k]!.revealed ? [taps[k]!.revealed!] : step.valid;
    for (const v of [...targets].sort((a, b) => midiAt(a) - midiAt(b) || a.string - b.string || a.fret - b.fret)) {
      const n = `${formatPitchClass(spelled)}${letterOctave(spelled, midiAt(v))}`;
      groups.set(n, [...(groups.get(n) ?? []), v]);
    }
    // FR-057: the root is written "root"; the root–fifth–octave 5th is written "5th".
    const word = step.label === 'R' ? 'root' : step.label === '5' && q.drillType === 'root-fifth-octave' ? '5th' : step.label;
    for (const [n, ps] of groups) parts.push(`${word} ${n} at ${joinAnd(ps.map((p) => `string ${p.string} fret ${p.fret}`))}`);
  });
  return parts.length ? `Missed: ${parts.join('; ')}` : '';
}

/**
 * FR-056a / FR-057: why a wrong step tap is wrong, shown at the time of the tap.
 * - Root–fifth–octave: "Not C or G" (neither pitch class), else "Doesn't fit the shape (more than 3
 *   frets apart or wrong octave)".
 * - Arpeggio: "Outside frets s to e" (outside the window); Step 1 "Not the lowest A in frets s to e"
 *   (right pitch class, wrong octave) or "Not the root of Am7" (wrong pitch class, code-reviewer r3
 *   #3); later steps "Not the b3 of Am7" (wrong tone or out of order).
 */
export function stepReason(profile: InstrumentProfile, q: Question, tap: FretPosition, stepIndex: number): string {
  const m = midi(openString(profile, tap.string)!) + tap.fret;
  const pc = ((m % 12) + 12) % 12;
  const name = (k: number) => {
    const st = q.steps[k];
    return formatPitchClass(st?.spelled ?? defaultSpelling(st?.accepts[0] ?? 0, { typeId: 'major' }));
  };
  if (q.drillType === 'root-fifth-octave') {
    if (pc !== q.steps[0]?.accepts[0] && pc !== q.steps[1]?.accepts[0]) return `Not ${name(0)} or ${name(1)}`;
    return "Doesn't fit the shape (more than 3 frets apart or wrong octave)";
  }
  const w = q.window;
  if (w && (tap.fret < w.from || tap.fret > w.to)) return `Outside frets ${w.from} to ${w.to}`;
  const range = w ? ` in frets ${w.from} to ${w.to}` : '';
  const label = q.steps[stepIndex]?.label ?? '';
  if (stepIndex === 0 && q.steps[0]?.accepts.includes(pc)) return `Not the lowest ${name(0)}${range}`;
  const chord = q.context?.qualityId ? chordSymbol(q.context.root, q.context.qualityId) : formatPitchClass(q.context?.root ?? { letter: 'C', accidental: 0 });
  return `Not the ${stepIndex === 0 || label === 'R' ? 'root' : label} of ${chord}`;
}

/** "Incorrect. You tapped <note> at string S fret F; <reason>" for a wrong step tap (FR-056a, FR-057). */
export function stepReasonText(input: { profile: InstrumentProfile; question: Question; tap: FretPosition; stepIndex: number }): string {
  const { profile, question: q, tap, stepIndex } = input;
  const step = q.steps[stepIndex] ?? q.steps[0];
  const spelled: PitchClassNote = step?.spelled ?? defaultSpelling(step?.accepts[0] ?? 0, { typeId: 'major' });
  const m = midi(openString(profile, tap.string)!) + tap.fret;
  const tapSpelled = spellTapped(q, spelled, ((m % 12) + 12) % 12);
  return `Incorrect. You tapped ${formatPitchClass(tapSpelled)}${letterOctave(tapSpelled, m)} at string ${tap.string} fret ${tap.fret}; ${stepReason(profile, q, tap, stepIndex)}`;
}

/**
 * FR-057 final line of a step-judged drill: "Correct, Am7 arpeggio" / "Correct, C root–fifth–octave
 * shape" when no step was missed, else "Incorrect. N of M steps correct. Missed: …".
 */
export function finalStepsText(profile: InstrumentProfile, q: Question, results: readonly ({ correct: boolean; revealed?: FretPosition } | undefined)[]): string {
  const total = q.steps.length;
  const ok = q.steps.filter((_, k) => results[k]?.correct).length;
  if (ok === total) {
    const root = q.context?.root ?? q.steps[0]?.spelled ?? { letter: 'C' as const, accidental: 0 };
    if (q.drillType === 'root-fifth-octave') return `Correct, ${formatPitchClass(root)} root–fifth–octave shape`;
    const chord = q.context?.qualityId ? chordSymbol(root, q.context.qualityId) : formatPitchClass(root);
    return `Correct, ${chord} arpeggio`;
  }
  return `Incorrect. ${ok} of ${total} steps correct. ${missedStepsText(profile, q, results)}.`;
}
