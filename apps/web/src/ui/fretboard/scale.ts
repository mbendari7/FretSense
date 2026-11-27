import { createContext } from 'react';

/** The user's text-size setting (FR-048: at least 3 sizes). */
export type TextSize = 1 | 2 | 3;

/** Provided by Layout from the display settings; the fretboard reads it to size labels and markers. */
export const TextSizeContext = createContext<TextSize>(2);

export interface FretboardMetrics {
  /** Marker label font size (bold). At least 18.67 px, so WCAG "large text" at every size; 24 px at the largest (FR-048). */
  readonly labelPx: number;
  readonly fretNumPx: number;
  readonly nutNamePx: number;
  /** Marker radius: room for a two-glyph label such as "C♯" (FR-048: labels never overlap or truncate). */
  readonly markerR: number;
  readonly stringGap: number;
  /** Narrowest fretted cell; neighbouring markers never touch. */
  readonly minCell: number;
  readonly openCell: number;
  /** Width of the open-string name column. */
  readonly nameW: number;
  /** Position target, at least 44 × 44 CSS px (FR-047). */
  readonly hitW: number;
  readonly hitH: number;
}

/** Keyed by the same 1 | 2 | 3 setting that Layout maps to --step (0.9, 1, 1.2 rem); 24 px at Large is FR-048's floor. */
const LABEL_PX: Record<TextSize, number> = { 1: 19, 2: 20, 3: 24 };

/**
 * Fretboard geometry for a text size (T103, FR-048, FR-047). Everything derives from the label size, so
 * markers grow with their labels and cells and string gaps grow with the markers; the neck then
 * scrolls inside its own area (FR-047) rather than shrinking anything.
 */
export function fretboardMetrics(size: TextSize): FretboardMetrics {
  const labelPx = LABEL_PX[size] ?? LABEL_PX[2];
  const markerR = Math.ceil(labelPx * 0.9);
  // Fret numbers and nut names reach 24 px at Large too (T103); a step smaller below that.
  const small = size === 3 ? labelPx : Math.round(labelPx * 0.8);
  const cell = Math.max(52, 2 * markerR + 14);
  return {
    labelPx,
    fretNumPx: small,
    nutNamePx: small,
    markerR,
    stringGap: Math.max(46, 2 * markerR + 12),
    minCell: cell,
    openCell: Math.max(50, 2 * markerR + 14),
    nameW: Math.max(26, Math.ceil(small * 1.3 + 4)),
    hitW: Math.max(48, 2 * markerR + 8),
    hitH: Math.max(44, 2 * markerR + 4),
  };
}
