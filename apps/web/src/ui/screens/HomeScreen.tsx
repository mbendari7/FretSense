import { Link } from 'react-router';
import content from 'virtual:fretsense-content';
import { scaleType } from '@fretsense/theory';
import { Fretboard } from '../fretboard/Fretboard';
import { InstrumentPicker } from '../InstrumentGate';
import { useApp, useAppState } from '../hooks';
import { contextMarkers, describePosition, prettyNote } from '../markers';
import { clampWindow, parsePc, useDisplay } from '../common';

export function HomeScreen() {
  const app = useApp();
  const s = useAppState();
  const [display] = useDisplay();
  if (s.status !== 'ready') return null;
  const inst = app.activeInstrument() ?? app.liveInstruments()[0];
  if (!inst) {
    return (
      <div className="page home">
        <h1 className="hero-title">Learn the neck you actually play.</h1>
        <p className="lede">Scales, chords and keys drawn on your guitar or bass, with short drills that remember what you miss. Everything stays on this device.</p>
        <InstrumentPicker />
      </div>
    );
  }
  const ex = s.settings!.explorer;
  const root = parsePc(ex.root) ?? { letter: 'C', accidental: 0 };
  const ctx = ex.kind === 'scale' ? { root, typeId: ex.typeId } : { root, qualityId: ex.typeId };
  const win = clampWindow(display.window, inst.profile);
  const last = [...s.completion].filter((c) => !c.deleted).sort((a, b) => b.updated.localeCompare(a.updated))[0];
  const lastLesson = last ? content.lessons.find((l) => l.id === last.lessonId) : undefined;
  const firstLesson = content.packs[0]?.sections[0]?.lessons[0];
  const live = s.attempts.filter((a) => !a.deleted);
  const week = live.filter((a) => Date.now() - Date.parse(a.timestamp) < 7 * 86_400_000);
  const acc = week.length ? Math.round((100 * week.filter((a) => a.outcome === 'correct').length) / week.length) : undefined;
  const scaleName = ex.kind === 'scale' ? scaleType(ex.typeId) : undefined;

  const returning = live.length > 0 || s.completion.some((c) => !c.deleted);
  const hasLessons = content.lessons.length > 0;
  return (
    <div className="page home">
      <h1 className="hero-title">{returning ? 'Pick up where you left off.' : `Your ${inst.profile.family}, mapped.`}</h1>
      {!returning && <p className="lede">This is your neck in {prettyNote(root)} {scaleName?.ok ? scaleName.value.name.toLowerCase() : ex.typeId}. Tap it to explore, or start a two-minute drill.</p>}
      <Link to="/explore" className="hero-board" aria-label="Open the explorer">
        <span className="hero-caption">{prettyNote(root)} {scaleName?.ok ? scaleName.value.name.toLowerCase() : ex.typeId} on your {inst.name}</span>
        <Fretboard profile={inst.profile} from={win[0]} to={win[1]} handedness={display.handedness} spacing={display.fretSpacing}
          markers={contextMarkers(inst.profile, ctx, win[0], win[1], display.labelMode)} label="Last explorer view" describe={(p) => describePosition(inst.profile, p, ctx)} />
      </Link>
      <div className="home-grid">
        {hasLessons ? (
          <Link to={lastLesson ? `/lessons/${lastLesson.id}` : firstLesson ? `/lessons/${firstLesson}` : '/library'} className="home-card">
            <strong>{lastLesson ? 'Continue lesson' : 'Start with a lesson'}</strong>
            <span>{lastLesson?.title ?? content.lessons.find((l) => l.id === firstLesson)?.title ?? 'Browse the library'}</span>
          </Link>
        ) : (
          <Link to="/explore" className="home-card">
            <strong>Explore scales and chords</strong>
            <span>12 scales and 12 chords on your own neck</span>
          </Link>
        )}
        <Link to="/drills/note-finding" className="home-card">
          <strong>Quick drill</strong>
          <span>20 notes on your {inst.profile.stringCount}-string neck</span>
        </Link>
        <Link to="/progress" className="home-card">
          <strong>This week</strong>
          <span>{acc === undefined ? 'No answers yet' : `${week.length} answers, ${acc}% correct`}</span>
        </Link>
        <Link to="/keys" className="home-card">
          <strong>Key helper</strong>
          <span>Chords in any of the 30 keys</span>
        </Link>
      </div>
    </div>
  );
}
