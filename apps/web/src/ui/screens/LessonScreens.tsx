import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import content from 'virtual:fretsense-content';
import { presetById } from '@fretsense/theory';
import type { CompiledLesson, DrillDefinition } from '../../domain/content/schemas';
import { STAGES, type Stage } from '../../domain/records';
import { DRILL_LABELS, type DrillSettings } from '../../domain/drills/types';
import { Fretboard } from '../fretboard/Fretboard';
import { InstrumentGate } from '../InstrumentGate';
import { useApp, useAppState } from '../hooks';
import { contextMarkers, describePosition, prettyNote } from '../markers';
import { clampWindow, parsePc, pretty, useDisplay, CHORDS, SCALES } from '../common';
import { DrillRunner } from './DrillRunner';
import { defaultSettings } from './DrillsScreen';
import { NotFound } from './NotFound';

const LESSONS = new Map(content.lessons.map((l) => [l.id, l]));
const PACKS = new Map(content.packs.map((p) => [p.id, p]));
const STAGE_LABEL: Record<Stage, string> = { read: 'Read', see: 'See', drill: 'Drill' };
const LEVEL: Record<string, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

function fits(l: CompiledLesson, fam: string | undefined) {
  return !fam || l.instruments[0] === 'any' || (l.instruments as string[]).includes(fam);
}

/** US2-1 library grouped by the active pack (FR-063); nothing is locked (FR-065). */
export function LibraryScreen() {
  const app = useApp();
  const s = useAppState();
  const [params, setParams] = useSearchParams();
  const packId = params.get('pack') ?? s.settings!.activePackId;
  const pack = PACKS.get(packId) ?? content.packs[0];
  const fam = app.activeInstrument()?.profile.family;
  const showAll = params.get('all') === '1';
  const done = new Map(s.completion.filter((c) => !c.deleted).map((c) => [c.lessonId, c]));

  if (!content.lessons.length) {
    return (
      <div className="page">
        <h1>Lessons</h1>
        <div className="empty">
          <p>The first lessons are being written. Until they land, everything else works without them:</p>
          <div className="row-actions">
            <Link className="button primary" to="/drills/note-finding">Start a note-finding drill</Link>
            <Link className="button" to="/explore">Explore scales and chords</Link>
            <Link className="button" to="/keys">Open the key helper</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page library">
      <h1>Lessons</h1>
      <p className="lede">{pack?.title}. Start anywhere: every lesson is open, and the order is only a suggestion.</p>
      <div className="control-row">
        {content.packs.length > 1 && (
          <label className="select"><span>Pack</span>
            <select value={pack?.id} onChange={(e) => { void app.updateSettings({ activePackId: e.target.value }); setParams({}); }}>
              {content.packs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
        )}
        {fam && <label className="switch"><input type="checkbox" checked={showAll} onChange={(e) => setParams((p) => { const n = new URLSearchParams(p); if (e.target.checked) n.set('all', '1'); else n.delete('all'); return n; })} /> Show lessons for all instruments</label>}
      </div>
      {pack?.sections.map((sec, si) => {
        const lessons = sec.lessons.map((id) => LESSONS.get(id)!).filter((l) => showAll || fits(l, fam));
        if (!lessons.length) return null;
        return (
          <section key={si} className="lesson-section" aria-labelledby={`sec-${si}`}>
            <h2 id={`sec-${si}`}>{sec.title}{sec.label && <span className="muted"> ({sec.label})</span>}</h2>
            <ol className="lesson-list">
              {lessons.map((l) => {
                const c = done.get(l.id);
                const n = c ? Object.keys(c.stages).length : 0;
                return (
                  <li key={l.id}>
                    <Link to={`/lessons/${l.id}`}>
                      <strong>{l.title}</strong>
                      <span className="muted">{l.summary}</span>
                      <span className="meta">
                        <span className="tag">{LEVEL[l.level]}</span>
                        {l.instruments[0] !== 'any' && <span className="tag">{(l.instruments as string[]).join(' and ')}</span>}
                        {n > 0 && <span className="progress-pill">{n === 3 ? 'All stages done' : `${n} of 3 stages done`}</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

/** Lesson screen (FR-024, FR-064): the user's stages in order, any stage reachable. */
export function LessonScreen() {
  const { lessonId, stage, drillId } = useParams();
  const lesson = lessonId ? LESSONS.get(lessonId) : undefined;
  const s = useAppState();
  const nav = useNavigate();
  const [showAll, setShowAll] = useState(false);
  if (!lesson) return <NotFound />;
  const pref = s.settings!.stagePreference;
  const urlStage = drillId ? 'drill' : (STAGES as readonly string[]).includes(stage ?? '') ? (stage as Stage) : undefined;
  if (stage && !urlStage && !drillId) return <NotFound />;
  const visible = showAll || (urlStage && !pref.includes(urlStage)) ? [...pref, ...STAGES.filter((x) => !pref.includes(x))] : pref;
  const current: Stage = urlStage ?? pref[0] ?? 'read';
  const tab = (st: Stage) => nav(`/lessons/${lesson.id}/${st}`, { replace: true });

  return (
    <article className="page lesson">
      <p className="crumb"><Link to="/library">Lessons</Link></p>
      <h1>{lesson.title}</h1>
      <p className="lede">{lesson.summary}</p>
      <div className="stage-tabs" role="tablist" aria-label="Lesson stages">
        {visible.map((st) => (
          <button key={st} role="tab" aria-selected={current === st} onClick={() => tab(st)}>
            {STAGE_LABEL[st]}{s.completion.find((c) => c.lessonId === lesson.id && !c.deleted)?.stages[st] ? ' ✓' : ''}
          </button>
        ))}
        {visible.length < STAGES.length && <button className="link" onClick={() => setShowAll(true)}>Show all stages</button>}
      </div>
      <div role="tabpanel" aria-label={STAGE_LABEL[current]}>
        {current === 'read' && <ReadStage lesson={lesson} />}
        {current === 'see' && <SeeStage lesson={lesson} />}
        {current === 'drill' && <DrillStage lesson={lesson} drillId={drillId} />}
      </div>
      <NextStage lesson={lesson} current={current} order={visible} onGo={tab} />
    </article>
  );
}

function NextStage({ lesson, current, order, onGo }: { lesson: CompiledLesson; current: Stage; order: readonly Stage[]; onGo: (s: Stage) => void }) {
  const app = useApp();
  const i = order.indexOf(current);
  const next = order[i + 1];
  return (
    <div className="stage-foot">
      <button className="primary" onClick={() => { void app.markStage(lesson.id, current); if (next) onGo(next); }}>
        {next ? `Done, go to ${STAGE_LABEL[next]}` : 'Mark this stage done'}
      </button>
    </div>
  );
}

function ReadStage({ lesson }: { lesson: CompiledLesson }) {
  // readHtml is compiled at build time from markdown with raw HTML rejected and a strict sanitiser (FR-025).
  return <div className="prose" dangerouslySetInnerHTML={{ __html: lesson.readHtml }} />;
}

function SeeStage({ lesson }: { lesson: CompiledLesson }) {
  const [display] = useDisplay();
  const [useLesson, setUseLesson] = useState(true);
  const fp = lesson.fretboard_preset;
  const root = parsePc(fp?.root);
  return (
    <InstrumentGate>{(inst) => {
      const lessonPreset = fp?.preset ? presetById(fp.preset) : undefined;
      const profile = useLesson && lessonPreset ? lessonPreset.profile : inst.profile;
      if (!fp || !root) return <p>This lesson has no fretboard view. Try the <Link to="/explore">explorer</Link>.</p>;
      const ctx = fp.scale ? { root, typeId: fp.scale } : { root, qualityId: fp.chord! };
      const w = clampWindow(fp.frets ?? display.window, profile);
      const clamped = fp.frets && fp.frets[1] > profile.fretCount;
      const name = fp.scale ? `${prettyNote(root)} ${SCALES.find((x) => x.id === fp.scale)?.name.toLowerCase()}` : `${prettyNote(root)}${CHORDS.find((c) => c.id === fp.chord)?.symbolSuffix ?? ''}`;
      return (
        <div>
          {lessonPreset && (
            <p className="notice" role="status">
              {useLesson ? <>Showing this lesson’s tuning ({lessonPreset.name}). <button className="link" onClick={() => setUseLesson(false)}>Use my instrument instead</button></>
                : <>Showing your {inst.name}. <button className="link" onClick={() => setUseLesson(true)}>Use the lesson’s tuning</button></>}
            </p>
          )}
          {clamped && <p className="notice">This view goes past fret {profile.fretCount}, so it stops at your last fret.</p>}
          <h2>{pretty(name)}</h2>
          <Fretboard profile={profile} from={w[0]} to={w[1]} handedness={display.handedness} spacing={display.fretSpacing}
            markers={contextMarkers(profile, ctx, w[0], w[1], fp.labels)} label={`${name} on the fretboard`}
            describe={(pos) => describePosition(profile, pos, ctx)} />
          {lesson.seeHtml && <div className="prose" dangerouslySetInnerHTML={{ __html: lesson.seeHtml }} />}
          <p><Link to={`/explore?root=${encodeURIComponent(fp.root)}&${fp.scale ? `scale=${fp.scale}` : `chord=${fp.chord}`}`}>Open in the explorer</Link></p>
        </div>
      );
    }}</InstrumentGate>
  );
}

function toSettings(d: DrillDefinition, base: DrillSettings): DrillSettings {
  const p = d.params;
  // FR-027: a lesson's own notes replace the default note set, keeping the lesson's spellings.
  const { noteSet: _noteSet, ...rest } = base;
  const names = p.notes?.filter((n) => !!parsePc(n));
  return {
    ...(names?.length ? rest : base),
    ...(p.strings ? { strings: p.strings.filter((x) => x <= base.strings.length) } : {}),
    ...(p.frets ? { fromFret: p.frets[0], toFret: p.frets[1] } : {}),
    ...(p.count ? { count: p.count } : {}),
    ...(names?.length ? { noteNames: names } : {}),
    ...(p.notes ? { notes: p.notes.map((n) => { const r = parsePc(n); return r ? ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[r.letter] + r.accidental + 12) % 12 : 0; }) } : {}),
    ...(p.intervals ? { intervals: p.intervals } : {}),
    ...(p.direction ? { direction: p.direction } : {}),
    ...(p.roots ? { roots: p.roots } : {}),
    ...(p.qualities ? { qualities: p.qualities } : {}),
    ...(p.functions ? { functions: p.functions } : {}),
    ...(p.key ? { key: p.key } : {}),
    ...(p.chords ? { chords: p.chords } : {}),
  };
}

function DrillStage({ lesson, drillId }: { lesson: CompiledLesson; drillId?: string }) {
  const s = useAppState();
  const nav = useNavigate();
  const app = useApp();
  if (!lesson.drills.length) return <p>This lesson has no drills. <Link to="/drills">Pick any drill</Link>.</p>;
  const active = drillId ? lesson.drills.find((d) => d.id === drillId) : undefined;
  if (drillId && !active) return <NotFound />;
  return (
    <InstrumentGate>{(inst) => {
      if (active) {
        const base = defaultSettings(active.type, inst.profile, s.settings!.octaveMode);
        const settings = toSettings(active, base);
        const clamped = { ...settings, toFret: Math.min(settings.toFret, inst.profile.fretCount), fromFret: Math.min(settings.fromFret, inst.profile.fretCount) };
        return <DrillRunner key={active.id} profile={inst.profile} instrumentId={inst.id} settings={clamped} lessonId={lesson.id} drillId={active.id}
          onComplete={() => void app.markStage(lesson.id, 'drill')} onExit={() => nav(`/lessons/${lesson.id}/drill`)} />;
      }
      return (
        <ul className="drill-grid">
          {lesson.drills.map((d) => (
            <li key={d.id}>
              <Link className="drill-card" to={`/lessons/${lesson.id}/drill/${d.id}`}>
                <strong>{d.title ?? DRILL_LABELS[d.type]}</strong>
                <span>{DRILL_LABELS[d.type]}{d.params.count ? `, ${d.params.count} questions` : ''}</span>
              </Link>
            </li>
          ))}
        </ul>
      );
    }}</InstrumentGate>
  );
}
