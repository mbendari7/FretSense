import { useCallback, useContext, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type Ref } from 'react';
import { fretX, formatPitchClass, openString, type FretPosition, type InstrumentProfile } from '@fretsense/theory';
import { jumpSegments, rangeText } from './range';
import { fretboardMetrics, TextSizeContext } from './scale';

/** Marker categories (FR-013): each differs by shape/outline/label as well as colour. */
export type MarkerKind = 'tone' | 'root' | 'reference' | 'correct' | 'incorrect' | 'revealed' | 'outline';

export interface Marker {
  readonly pos: FretPosition;
  readonly label: string;
  readonly kind: MarkerKind;
  /** Accessible name, e.g. "C4, root". */
  readonly name: string;
}

/** Imperative control used by the drill runner (FR-049 drill-start and Continue focus). */
export interface FretboardHandle {
  /**
   * Moves keyboard focus to a position and scrolls it fully into view inside the neck area. With
   * `alsoShow` (an inclusive fret range, e.g. a question's stated window), the range is brought into
   * view as well when it fits alongside the position; the position always wins (FR-047, FR-049).
   */
  focus(pos: FretPosition, alsoShow?: readonly [number, number]): void;
  /**
   * Scrolls, without moving focus, so `target` is fully in view together with `toward` when both
   * fit; otherwise `target` wins and sits at the edge facing `toward`, so the clipped-edge cue
   * points toward it (FR-032 reveal scroll after an incorrect answer).
   */
  reveal(target: FretPosition, toward: FretPosition): void;
  /**
   * Scrolls, without moving focus, so `pos` is fully in view together with the inclusive fret range
   * `alsoShow` when both fit; the position wins otherwise (FR-047 auto-advance).
   */
  show(pos: FretPosition, alsoShow?: readonly [number, number]): void;
}

export interface FretboardProps {
  readonly profile: InstrumentProfile;
  readonly from: number;
  readonly to: number;
  readonly markers: readonly Marker[];
  readonly handedness: 'right' | 'left';
  readonly spacing: 'uniform' | 'proportional';
  readonly onTap?: (pos: FretPosition) => void;
  /** Enter / Space on a position; defaults to onTap (drills use it to activate Continue, FR-049). */
  readonly onKeyActivate?: (pos: FretPosition) => void;
  readonly promptedString?: number;
  /** Drill window shading [from, to]. */
  readonly windowRange?: readonly [number, number];
  readonly strings?: readonly number[];
  readonly label: string;
  readonly describe?: (pos: FretPosition) => string;
  /** Nut-column open-string name; defaults to the instrument's spelling (FR-032a, FR-051). */
  readonly nutName?: (stringNumber: number) => string | undefined;
  /** Where the Home key goes (FR-049); defaults to the first fret of the range on the same string. */
  readonly startPosition?: FretPosition;
  /** Called with true while the fretboard has focus and the last input was a key press. */
  readonly onKeyboardFocus?: (keyboard: boolean) => void;
  readonly control?: Ref<FretboardHandle>;
}

const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE = [12, 24];
const RIGHT_PAD = 16;

const SUFFIX: Record<MarkerKind, string> = {
  tone: '', root: 'root', reference: 'reference', correct: 'correct', incorrect: 'incorrect', revealed: 'answer', outline: 'pattern',
};

const pretty = (s: string) => s.replace(/bb/g, '𝄫').replace(/##/g, '𝄪').replace(/b/g, '♭').replace(/#/g, '♯');

/**
 * The neck. Test hooks (T094): nut-column names carry `data-nut-string="N"`; clipped-edge cues carry
 * `data-scroll-cue="left|right"` (physical edge) and exist only while that edge is clipped. Overflow,
 * the visible range and jump targets come from the scroll area's clientWidth / scrollWidth /
 * scrollLeft and this component's own geometry (FR-047).
 */
export function Fretboard(p: FretboardProps) {
  const { profile, from, to } = p;
  // T103 (FR-048): sizes follow the text-size setting; the neck grows and scrolls instead of shrinking.
  const size = useContext(TextSizeContext);
  const M = useMemo(() => fretboardMetrics(size), [size]);
  const STRING_GAP = M.stringGap;
  /** Nut column: open-string names, then (when fret 0 is in the range) the fret-0 targets. */
  const NAME_W = M.nameW;
  const OPEN_CELL = M.openCell;
  const MIN_CELL = M.minCell;
  const pad = M.markerR + 2;
  const TOP = pad + 12;
  const left = p.handedness === 'left';
  const showOpen = from === 0;
  const first = Math.max(1, from);
  const frets = Math.max(0, to - first + 1);
  /** Width of the nut column (kept visible while the neck scrolls). */
  const colW = NAME_W + (showOpen ? OPEN_CELL : 0);
  const width = Math.max(340, colW + frets * MIN_CELL + RIGHT_PAD);
  const height = TOP + (profile.stringCount - 1) * STRING_GAP + pad + M.fretNumPx + 12;
  const neckLeft = colW;
  const neckRight = width - RIGHT_PAD;
  const boardTop = TOP - pad;
  const boardH = (profile.stringCount - 1) * STRING_GAP + 2 * pad;

  /** Unmirrored x of a fret line (fret n = the wire after fret n's space). */
  const lineX = useMemo(() => {
    const a = fretX(profile, first - 1, p.spacing);
    const b = fretX(profile, to, p.spacing);
    return (n: number) => neckLeft + ((fretX(profile, n, p.spacing) - a) / (b - a || 1)) * (neckRight - neckLeft);
  }, [profile, first, to, p.spacing, neckLeft, neckRight]);

  const mirror = (x: number) => (left ? width - x : x);
  const cellX = (fret: number) => (fret === 0 ? NAME_W + OPEN_CELL / 2 : (lineX(fret - 1) + lineX(fret)) / 2);
  const stringY = (s: number) => TOP + (s - 1) * STRING_GAP;

  const visibleStrings = Array.from({ length: profile.stringCount }, (_, i) => i + 1);
  const minF = showOpen ? 0 : first;
  const inRange = (pos: FretPosition) => pos.string >= 1 && pos.string <= profile.stringCount && pos.fret >= minF && pos.fret <= to;

  const [focusState, setFocus] = useState<FretPosition>(() => p.startPosition ?? { string: p.promptedString ?? 1, fret: minF });
  const focus = inRange(focusState) ? focusState : { string: Math.min(focusState.string, profile.stringCount), fret: minF };

  // ---- scroll geometry (FR-047) ----
  const scroller = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState({ s: 0, sw: 0, cw: 0 });
  const sync = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const next = { s: el.scrollLeft, sw: el.scrollWidth, cw: el.clientWidth };
    setGeo((g) => (g.s === next.s && g.sw === next.sw && g.cw === next.cw ? g : next));
  }, []);
  const maxScroll = Math.max(0, geo.sw - geo.cw);
  const overflows = geo.sw > geo.cw + 1;

  /** Scroll offset that puts fret `f`'s cell next to the nut column. */
  const scrollForFret = (f: number) => {
    const el = scroller.current;
    const cw = el?.clientWidth ?? 0;
    const a = lineX(Math.max(f, first) - 1);
    return left ? width - a - cw + colW : a - colW;
  };
  const scrollTo = (s: number) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, s);
    sync();
  };
  /** Scrolls the minimum needed so the position's whole cell is visible beside the nut column. */
  const ensureVisible = (pos: FretPosition) => {
    const el = scroller.current;
    if (!el || pos.fret === 0) return;
    const cw = el.clientWidth;
    if (el.scrollWidth <= cw + 1) return;
    let s = el.scrollLeft;
    const a = lineX(pos.fret - 1);
    const b = lineX(pos.fret);
    if (!left) {
      if (a < s + colW) s = a - colW;
      else if (b > s + cw) s = b - cw;
    } else {
      const xa = width - b;
      const xb = width - a;
      if (xa < s) s = xa;
      else if (xb > s + cw - colW) s = xb - cw + colW;
    }
    if (s !== el.scrollLeft) scrollTo(s);
  };

  /** Physical x span (scroll coordinates) of the fretted frets lo..hi, or undefined if none are fretted. */
  const spanOf = (r: readonly [number, number]): [number, number] | undefined => {
    const lo = Math.max(first, Math.min(r[0], r[1]));
    const hi = Math.min(to, Math.max(r[0], r[1]));
    if (hi < lo) return undefined;
    const a = lineX(lo - 1);
    const b = lineX(hi);
    return left ? [width - b, width - a] : [a, b];
  };
  /**
   * Scrolls so the `primary` fret range is fully in view, together with `secondary` when the union
   * fits beside the nut column. When it doesn't, `primary` wins and sits at the edge facing
   * `secondary`. Fret 0 lives in the always-visible nut column, so it needs no scroll (FR-047).
   */
  const showFrets = (primary: readonly [number, number], secondary?: readonly [number, number]) => {
    const el = scroller.current;
    if (!el) return;
    const cw = el.clientWidth;
    if (el.scrollWidth <= cw + 1) return;
    const off = left ? 0 : colW; // where the neck view starts inside the scroll area
    const viewW = cw - colW;
    const p = spanOf(primary);
    const q = secondary ? spanOf(secondary) : undefined;
    const target = p && q ? [Math.min(p[0], q[0]), Math.max(p[1], q[1])] as const : p ?? q;
    if (!target) return;
    let s = el.scrollLeft;
    if (target[1] - target[0] <= viewW + 0.5) {
      if (target[0] < s + off) s = target[0] - off;
      else if (target[1] > s + off + viewW) s = target[1] - off - viewW;
    } else if (p && q) {
      // Both can't fit: the primary span sits at the edge nearest the secondary one.
      s = q[0] < p[0] ? p[0] - off : p[1] - off - viewW;
    } else {
      s = target[0] - off;
    }
    if (s !== el.scrollLeft) scrollTo(s);
  };

  // Changing the instrument, range or hand scrolls to the range's first fret (FR-047).
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollLeft = left ? el.scrollWidth : 0;
    sync();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : undefined;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [profile, from, to, left, width, sync]);

  const refs = useRef(new Map<string, SVGGElement>());
  const key = (pos: FretPosition) => `${pos.string}:${pos.fret}`;
  const markerAt = new Map(p.markers.map((m) => [key(m.pos), m]));

  function move(pos: FretPosition) {
    setFocus(pos);
    refs.current.get(key(pos))?.focus({ preventScroll: true });
    ensureVisible(pos);
  }
  const moveRef = useRef(move);
  moveRef.current = move;
  const showRef = useRef(showFrets);
  showRef.current = showFrets;
  useImperativeHandle(p.control, () => ({
    focus: (pos, alsoShow) => {
      moveRef.current(pos);
      if (alsoShow) showRef.current([pos.fret, pos.fret], alsoShow);
    },
    reveal: (target, toward) => showRef.current([target.fret, target.fret], [toward.fret, toward.fret]),
    show: (pos, alsoShow) => showRef.current([pos.fret, pos.fret], alsoShow),
  }), []);

  // ---- keyboard-focus tracking for the drill hint (FR-049) ----
  const onKbRef = useRef(p.onKeyboardFocus);
  onKbRef.current = p.onKeyboardFocus;
  const kb = useRef(false);
  const setKb = (v: boolean) => {
    if (kb.current === v) return;
    kb.current = v;
    onKbRef.current?.(v);
  };
  const groupRef = useRef<HTMLDivElement>(null);
  const onBlur = (e: FocusEvent) => {
    const to = e.relatedTarget as Node | null;
    if (to && groupRef.current?.contains(to)) return;
    if (to) { setKb(false); return; }
    queueMicrotask(() => {
      if (!groupRef.current?.contains(document.activeElement)) setKb(false);
    });
  };

  function onKey(e: KeyboardEvent, pos: FretPosition) {
    setKb(true);
    const dir = left ? -1 : 1;
    let next: FretPosition | undefined;
    if (e.key === 'ArrowUp') next = { ...pos, string: Math.max(1, pos.string - 1) };
    else if (e.key === 'ArrowDown') next = { ...pos, string: Math.min(profile.stringCount, pos.string + 1) };
    else if (e.key === 'ArrowRight') next = { ...pos, fret: Math.min(to, Math.max(minF, pos.fret + dir)) };
    else if (e.key === 'ArrowLeft') next = { ...pos, fret: Math.min(to, Math.max(minF, pos.fret - dir)) };
    else if (e.key === 'Home') next = p.startPosition && inRange(p.startPosition) ? p.startPosition : { ...pos, fret: minF };
    else if (e.key === 'End') next = { ...pos, fret: to };
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      (p.onKeyActivate ?? p.onTap)?.(pos);
      return;
    }
    if (next) {
      e.preventDefault();
      move(next);
    }
  }

  // ---- visible range, jump segments and cues (FR-047) ----
  const avail = geo.cw - colW;
  let maxCell = 0;
  for (let f = first; f <= to; f++) maxCell = Math.max(maxCell, lineX(f) - lineX(f - 1));
  const fits = Math.max(1, Math.floor((avail + 0.5) / (maxCell || MIN_CELL)));
  const segments = overflows ? jumpSegments(from, to, fits) : [];
  let view: { open: boolean; first?: number; last?: number } = { open: showOpen };
  if (overflows) {
    const lo = left ? width - geo.s - geo.cw + colW : geo.s + colW;
    const hi = left ? width - geo.s : geo.s + geo.cw;
    let a: number | undefined;
    let b: number | undefined;
    for (let f = first; f <= to; f++) {
      if (lineX(f - 1) >= lo - 0.5 && lineX(f) <= hi + 0.5) {
        a ??= f;
        b = f;
      }
    }
    view = a === undefined ? view : { open: showOpen, first: a, last: b };
  }
  const clipLeft = overflows && geo.s > 0.5;
  const clipRight = overflows && geo.s < maxScroll - 0.5;
  // The nut column overlay follows the scroll so it stays at its physical edge.
  const colShift = left ? geo.s - maxScroll : geo.s;

  const gauge = (s: number) => 1 + ((s - 1) / Math.max(1, profile.stringCount - 1)) * (profile.family === 'bass' ? 3.2 : 2.2);
  const midY = TOP + ((profile.stringCount - 1) * STRING_GAP) / 2;
  const nutName = (n: number) => p.nutName?.(n) ?? pretty(formatPitchClass(openString(profile, n)!));

  const renderPos = (pos: FretPosition) => {
    const m = markerAt.get(key(pos));
    const x = mirror(cellX(pos.fret));
    const y = stringY(pos.string);
    const isFocus = focus.string === pos.string && focus.fret === pos.fret;
    const head = pos.fret === 0 ? `String ${pos.string}, open` : `String ${pos.string}, fret ${pos.fret}`;
    const base = p.describe?.(pos) ?? head;
    const name = m ? `${base}, ${m.name}${SUFFIX[m.kind] && !m.name.includes(SUFFIX[m.kind]) ? `, ${SUFFIX[m.kind]}` : ''}` : base;
    return (
      <g
        key={key(pos)}
        ref={(el) => { if (el) refs.current.set(key(pos), el); else refs.current.delete(key(pos)); }}
        className={`fb-pos${m ? ` m-${m.kind}` : ''}${pos.fret === 0 ? ' fb-open' : ''}`}
        role="button"
        tabIndex={isFocus ? 0 : -1}
        aria-label={name}
        onClick={() => { setFocus(pos); p.onTap?.(pos); }}
        onKeyDown={(e) => onKey(e, pos)}
        onPointerDown={() => setKb(false)}
        onMouseDown={() => setKb(false)}
        onFocus={() => { setFocus(pos); ensureVisible(pos); }}
      >
        <rect className="fb-hit" x={x - M.hitW / 2} y={y - M.hitH / 2} width={M.hitW} height={M.hitH} rx="10" />
        {m && <MarkerShape kind={m.kind} x={x} y={y} r={M.markerR} />}
        {m && m.label && <text className="fb-label" x={x} y={y + M.labelPx * 0.36} textAnchor="middle" fontSize={M.labelPx}>{m.label}</text>}
      </g>
    );
  };

  const fretted: FretPosition[] = [];
  for (const s of visibleStrings) for (let f = first; f <= to; f++) fretted.push({ string: s, fret: f });

  const colX = left ? width - colW : 0;
  const jumpId = useId();
  return (
    <div className="fretboard-wrap">
      <div className="fretboard-frame">
        <div
          className={`fretboard-scroll${overflows ? ' overflows' : ''}`}
          role="group"
          aria-label={p.label}
          ref={(el) => { scroller.current = el; groupRef.current = el; }}
          onScroll={sync}
          onBlur={onBlur}
        >
          <svg className="fretboard" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="presentation">
            <rect className="fb-wood" x={left ? width - neckRight : neckLeft} y={boardTop} width={neckRight - neckLeft} height={boardH} rx="3" />
            {p.windowRange && (() => {
              const a = Math.max(p.windowRange[0], first);
              const b = Math.min(p.windowRange[1], to);
              if (b < a) return null;
              const x1 = lineX(a - 1);
              const x2 = lineX(b);
              return <rect className="fb-window" x={Math.min(mirror(x1), mirror(x2))} y={boardTop} width={Math.abs(x2 - x1)} height={boardH} />;
            })()}
            {[...INLAYS, ...DOUBLE].filter((f) => f >= first && f <= to).map((f) => {
              const x = mirror(cellX(f));
              return DOUBLE.includes(f) ? (
                <g key={f} className="fb-inlay">
                  <circle cx={x} cy={midY - STRING_GAP} r="6" />
                  <circle cx={x} cy={midY + STRING_GAP} r="6" />
                </g>
              ) : (
                <circle key={f} className="fb-inlay" cx={x} cy={midY} r="6" />
              );
            })}
            {Array.from({ length: frets + 1 }, (_, i) => first - 1 + i).filter((n) => !(n === 0 && showOpen)).map((n) => (
              <line key={n} className="fb-fret" x1={mirror(lineX(n))} x2={mirror(lineX(n))} y1={boardTop} y2={boardTop + boardH} />
            ))}
            {visibleStrings.map((s) => (
              <line
                key={s}
                className={`fb-string${p.promptedString === s ? ' prompted' : ''}${p.strings && !p.strings.includes(s) ? ' muted' : ''}`}
                x1={mirror(neckLeft)} x2={mirror(neckRight)} y1={stringY(s)} y2={stringY(s)}
                strokeWidth={p.promptedString === s ? gauge(s) + 2.5 : gauge(s)}
              />
            ))}
            {Array.from({ length: frets }, (_, i) => first + i).map((f) => (
              <text key={f} className={`fb-fretnum${INLAYS.includes(f) || DOUBLE.includes(f) ? ' strong' : ''}`} x={mirror(cellX(f))} y={height - 8} textAnchor="middle" fontSize={M.fretNumPx}>{f}</text>
            ))}
            {fretted.map(renderPos)}
            {/* Nut column: string names and fret 0, kept at its physical edge while the neck scrolls. */}
            <g className="fb-nutcol" transform={`translate(${colShift} 0)`}>
              <rect className="fb-nutbg" x={colX} y={0} width={colW} height={height} />
              {showOpen && <rect className="fb-openzone" x={left ? width - NAME_W - OPEN_CELL + 2 : NAME_W + 2} y={boardTop} width={OPEN_CELL - 4} height={boardH} rx="3" />}
              {showOpen && visibleStrings.map((s) => (
                <line key={s}
                  className={`fb-string${p.promptedString === s ? ' prompted' : ''}${p.strings && !p.strings.includes(s) ? ' muted' : ''}`}
                  x1={mirror(NAME_W + 2)} x2={mirror(colW)} y1={stringY(s)} y2={stringY(s)}
                  strokeWidth={p.promptedString === s ? gauge(s) + 2.5 : gauge(s)} />
              ))}
              <line className={showOpen ? 'fb-nut' : 'fb-coledge'} x1={mirror(colW)} x2={mirror(colW)} y1={boardTop} y2={boardTop + boardH} />
              {visibleStrings.map((s) => (
                <text key={s} className="fb-nutname" data-nut-string={s} x={mirror(NAME_W / 2)} y={stringY(s) + M.nutNamePx * 0.36} textAnchor="middle" fontSize={M.nutNamePx}>{nutName(s)}</text>
              ))}
              {showOpen && visibleStrings.map((s) => renderPos({ string: s, fret: 0 }))}
            </g>
          </svg>
        </div>
        {clipLeft && <span className="fb-cue fb-cue-left" data-scroll-cue="left" aria-hidden="true" style={left ? undefined : { left: colW }}><Chevron dir="left" /></span>}
        {clipRight && <span className="fb-cue fb-cue-right" data-scroll-cue="right" aria-hidden="true" style={left ? { right: colW } : undefined}><Chevron dir="right" /></span>}
      </div>
      {overflows && (
        <div className="fb-scrollbar">
          <p className="fb-range">{rangeText(view, to)}</p>
          <div className="fb-jump" role="group" aria-labelledby={jumpId}>
            <span className="fb-jump-label" id={jumpId}>Jump to frets</span>
            <div className="fb-jump-row">
              {segments.map((seg) => (
                <button key={seg.first} type="button" className="fb-jump-btn" aria-label={seg.name} onClick={() => scrollTo(scrollForFret(seg.first))}>{seg.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" focusable="false">
      <path d={dir === 'left' ? 'M11 2 4 8l7 6' : 'M5 2l7 6-7 6'} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Marker shapes scale with the label (T103); each kind keeps its own shape and stroke (FR-013). */
function MarkerShape({ kind, x, y, r }: { kind: MarkerKind; x: number; y: number; r: number }) {
  const h = r; // half side of square markers
  const d = Math.round(r * 0.94); // the rotated root square reads as the same size as a circle
  switch (kind) {
    case 'root':
      return <rect className="mk mk-root" x={x - d} y={y - d} width={2 * d} height={2 * d} rx="4" transform={`rotate(45 ${x} ${y})`} />;
    case 'reference':
      return <rect className="mk mk-reference" x={x - h} y={y - h} width={2 * h} height={2 * h} rx="6" />;
    case 'correct':
      return <circle className="mk mk-correct" cx={x} cy={y} r={r + 1} />;
    case 'incorrect':
      return <rect className="mk mk-incorrect" x={x - h} y={y - h} width={2 * h} height={2 * h} rx="2" />;
    case 'revealed':
      return <circle className="mk mk-revealed" cx={x} cy={y} r={r + 1} />;
    case 'outline':
      return <circle className="mk mk-outline" cx={x} cy={y} r={r} />;
    default:
      return <circle className="mk mk-tone" cx={x} cy={y} r={r} />;
  }
}
