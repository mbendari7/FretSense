import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { fretX, type FretPosition, type InstrumentProfile } from '@fretsense/theory';

/** Marker categories (FR-013): each differs by shape/outline/label as well as colour. */
export type MarkerKind = 'tone' | 'root' | 'reference' | 'correct' | 'incorrect' | 'revealed' | 'outline';

export interface Marker {
  readonly pos: FretPosition;
  readonly label: string;
  readonly kind: MarkerKind;
  /** Accessible name, e.g. "C4, root". */
  readonly name: string;
}

export interface FretboardProps {
  readonly profile: InstrumentProfile;
  readonly from: number;
  readonly to: number;
  readonly markers: readonly Marker[];
  readonly handedness: 'right' | 'left';
  readonly spacing: 'uniform' | 'proportional';
  readonly onTap?: (pos: FretPosition) => void;
  readonly promptedString?: number;
  /** Drill window shading [from, to]. */
  readonly windowRange?: readonly [number, number];
  readonly strings?: readonly number[];
  readonly label: string;
  readonly describe?: (pos: FretPosition) => string;
}

const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE = [12, 24];
const STRING_GAP = 46;
const TOP = 30;
const OPEN_W = 54;
const MIN_CELL = 52;

const SUFFIX: Record<MarkerKind, string> = {
  tone: '', root: 'root', reference: 'reference', correct: 'correct', incorrect: 'incorrect', revealed: 'answer', outline: 'pattern',
};

export function Fretboard(p: FretboardProps) {
  const { profile, from, to } = p;
  const showOpen = from === 0;
  const first = Math.max(1, from);
  const frets = Math.max(0, to - first + 1);
  const width = Math.max(340, (showOpen ? OPEN_W : 14) + frets * MIN_CELL + 16);
  const height = TOP + (profile.stringCount - 1) * STRING_GAP + 40;
  const left = showOpen ? OPEN_W : 14;
  const right = width - 16;

  /** x of a fret line (fret n = the wire after fret n's space), for the visible window. */
  const lineX = useMemo(() => {
    const a = fretX(profile, first - 1, p.spacing);
    const b = fretX(profile, to, p.spacing);
    return (n: number) => left + ((fretX(profile, n, p.spacing) - a) / (b - a || 1)) * (right - left);
  }, [profile, first, to, p.spacing, left, right]);

  const mirror = (x: number) => (p.handedness === 'left' ? width - x : x);
  const cellX = (fret: number) => (fret === 0 ? (showOpen ? OPEN_W / 2 : -100) : (lineX(fret - 1) + lineX(fret)) / 2);
  const stringY = (s: number) => TOP + (s - 1) * STRING_GAP;

  const visibleStrings = Array.from({ length: profile.stringCount }, (_, i) => i + 1);
  const positions: FretPosition[] = [];
  for (const s of visibleStrings) for (let f = showOpen ? 0 : first; f <= to; f++) positions.push({ string: s, fret: f });

  const [focus, setFocus] = useState<FretPosition>({ string: p.promptedString ?? 1, fret: showOpen ? 0 : first });
  useEffect(() => {
    if (p.promptedString) setFocus((f) => ({ ...f, string: p.promptedString! }));
  }, [p.promptedString]);
  const scroller = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth + 4);
    check();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : undefined;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [width]);
  const refs = useRef(new Map<string, SVGGElement>());
  const key = (pos: FretPosition) => `${pos.string}:${pos.fret}`;
  const markerAt = new Map(p.markers.map((m) => [key(m.pos), m]));

  function move(pos: FretPosition) {
    setFocus(pos);
    refs.current.get(key(pos))?.focus();
  }
  function onKey(e: KeyboardEvent, pos: FretPosition) {
    const minF = showOpen ? 0 : first;
    const dir = p.handedness === 'left' ? -1 : 1;
    let next: FretPosition | undefined;
    if (e.key === 'ArrowUp') next = { ...pos, string: Math.max(1, pos.string - 1) };
    else if (e.key === 'ArrowDown') next = { ...pos, string: Math.min(profile.stringCount, pos.string + 1) };
    else if (e.key === 'ArrowRight') next = { ...pos, fret: Math.min(to, Math.max(minF, pos.fret + dir)) };
    else if (e.key === 'ArrowLeft') next = { ...pos, fret: Math.min(to, Math.max(minF, pos.fret - dir)) };
    else if (e.key === 'Home') next = { ...pos, fret: minF };
    else if (e.key === 'End') next = { ...pos, fret: to };
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      p.onTap?.(pos);
      return;
    }
    if (next) {
      e.preventDefault();
      move(next);
    }
  }

  const gauge = (s: number) => 1 + ((s - 1) / Math.max(1, profile.stringCount - 1)) * (profile.family === 'bass' ? 3.2 : 2.2);
  const midY = TOP + ((profile.stringCount - 1) * STRING_GAP) / 2;

  return (
    <>
    <div className={`fretboard-scroll${overflows ? ' overflows' : ''}`} role="group" aria-label={p.label} ref={scroller}>
      <svg className="fretboard" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="presentation">
        <rect className="fb-wood" x={mirror(p.handedness === 'left' ? right : left)} y={TOP - 18} width={right - left} height={(profile.stringCount - 1) * STRING_GAP + 36} rx="3" />
        {p.windowRange && (() => {
          const a = Math.max(p.windowRange[0], first);
          const b = Math.min(p.windowRange[1], to);
          if (b < a) return null;
          const x1 = lineX(a - 1);
          const x2 = lineX(b);
          return <rect className="fb-window" x={Math.min(mirror(x1), mirror(x2))} y={TOP - 18} width={Math.abs(x2 - x1)} height={(profile.stringCount - 1) * STRING_GAP + 36} />;
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
        {showOpen && <rect className="fb-openzone" x={p.handedness === 'left' ? width - OPEN_W : 0} y={TOP - 18} width={OPEN_W - 4} height={(profile.stringCount - 1) * STRING_GAP + 36} rx="3" />}
        {showOpen && <line className="fb-nut" x1={mirror(left)} x2={mirror(left)} y1={TOP - 18} y2={TOP + (profile.stringCount - 1) * STRING_GAP + 18} />}
        {Array.from({ length: frets + 1 }, (_, i) => first - 1 + i).filter((n) => !(n === 0 && showOpen)).map((n) => (
          <line key={n} className="fb-fret" x1={mirror(lineX(n))} x2={mirror(lineX(n))} y1={TOP - 18} y2={TOP + (profile.stringCount - 1) * STRING_GAP + 18} />
        ))}
        {visibleStrings.map((s) => (
          <line
            key={s}
            className={`fb-string${p.promptedString === s ? ' prompted' : ''}${p.strings && !p.strings.includes(s) ? ' muted' : ''}`}
            x1={mirror(showOpen ? 6 : left)} x2={mirror(right)} y1={stringY(s)} y2={stringY(s)}
            strokeWidth={p.promptedString === s ? gauge(s) + 2.5 : gauge(s)}
          />
        ))}
        {Array.from({ length: frets }, (_, i) => first + i).map((f) => (
          <text key={f} className={`fb-fretnum${INLAYS.includes(f) || DOUBLE.includes(f) ? ' strong' : ''}`} x={mirror(cellX(f))} y={height - 8} textAnchor="middle">{f}</text>
        ))}
        {positions.map((pos) => {
          const m = markerAt.get(key(pos));
          const x = mirror(cellX(pos.fret));
          const y = stringY(pos.string);
          const isFocus = focus.string === pos.string && focus.fret === pos.fret;
          const base = p.describe?.(pos) ?? `String ${pos.string}, fret ${pos.fret}`;
          const name = m ? `${base}: ${m.name}${SUFFIX[m.kind] && !m.name.includes(SUFFIX[m.kind]) ? `, ${SUFFIX[m.kind]}` : ''}` : base;
          return (
            <g
              key={key(pos)}
              ref={(el) => { if (el) refs.current.set(key(pos), el); else refs.current.delete(key(pos)); }}
              className={`fb-pos${m ? ` m-${m.kind}` : ''}`}
              role="button"
              tabIndex={isFocus ? 0 : -1}
              aria-label={name}
              onClick={() => { setFocus(pos); p.onTap?.(pos); }}
              onKeyDown={(e) => onKey(e, pos)}
              onFocus={() => setFocus(pos)}
            >
              <rect className="fb-hit" x={x - 24} y={y - 22} width="48" height="44" rx="10" />
              {m && <MarkerShape kind={m.kind} x={x} y={y} />}
              {m && m.label && <text className="fb-label" x={x} y={y + 5} textAnchor="middle">{m.label}</text>}
            </g>
          );
        })}
      </svg>
    </div>
    {overflows && <p className="scroll-cue" aria-hidden="true">Swipe the neck to see frets up to {to}</p>}
    </>
  );
}

function MarkerShape({ kind, x, y }: { kind: MarkerKind; x: number; y: number }) {
  switch (kind) {
    case 'root':
      return <rect className="mk mk-root" x={x - 15} y={y - 15} width="30" height="30" rx="4" transform={`rotate(45 ${x} ${y})`} />;
    case 'reference':
      return <rect className="mk mk-reference" x={x - 16} y={y - 16} width="32" height="32" rx="6" />;
    case 'correct':
      return <circle className="mk mk-correct" cx={x} cy={y} r="17" />;
    case 'incorrect':
      return <rect className="mk mk-incorrect" x={x - 16} y={y - 16} width="32" height="32" rx="2" />;
    case 'revealed':
      return <circle className="mk mk-revealed" cx={x} cy={y} r="17" />;
    case 'outline':
      return <circle className="mk mk-outline" cx={x} cy={y} r="16" />;
    default:
      return <circle className="mk mk-tone" cx={x} cy={y} r="16" />;
  }
}
