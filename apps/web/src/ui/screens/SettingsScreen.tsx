import content from 'virtual:fretsense-content';
import { STAGES, type Stage } from '../../domain/records';
import { useApp, useAppState } from '../hooks';
import { Segmented, useDisplay } from '../common';

const LABEL: Record<Stage, string> = { read: 'Read', see: 'See', drill: 'Drill' };

/** Settings (FR-021, FR-041, FR-064, FR-067): every adaptive behaviour has a switch. */
export function SettingsScreen() {
  const app = useApp();
  const s = useAppState().settings!;
  const [d, setD] = useDisplay();
  const stages = s.stagePreference;
  const toggleStage = (st: Stage) => {
    const next = stages.includes(st) ? stages.filter((x) => x !== st) : [...stages, st];
    if (next.length) void app.updateSettings({ stagePreference: next });
  };
  const move = (i: number, dir: -1 | 1) => {
    const n = [...stages];
    const j = i + dir;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j]!, n[i]!];
    void app.updateSettings({ stagePreference: n });
  };
  return (
    <div className="page settings">
      <h1>Settings</h1>
      <section className="card"><h2>Display</h2>
        <div className="setting"><span>Text size</span><Segmented label="Text size" value={String(d.textSize) as '1' | '2' | '3'} options={[{ value: '1', label: 'Small' }, { value: '2', label: 'Medium' }, { value: '3', label: 'Large' }]} onChange={(v) => setD({ textSize: Number(v) as 1 | 2 | 3 })} /></div>
        <div className="setting"><span>Theme</span><Segmented label="Theme" value={d.theme} options={[{ value: 'system', label: 'Match device' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} onChange={(v) => setD({ theme: v })} /></div>
        <div className="setting"><span>Hand</span><Segmented label="Hand" value={d.handedness} options={[{ value: 'right', label: 'Right-handed' }, { value: 'left', label: 'Left-handed' }]} onChange={(v) => setD({ handedness: v })} /></div>
        <div className="setting"><span>Fret spacing</span><Segmented label="Fret spacing" value={d.fretSpacing} options={[{ value: 'uniform', label: 'Even' }, { value: 'proportional', label: 'Like a real neck' }]} onChange={(v) => setD({ fretSpacing: v })} /></div>
        <div className="setting"><span>Labels</span><Segmented label="Labels" value={d.labelMode} options={[{ value: 'notes', label: 'Note names' }, { value: 'degrees', label: 'Degrees' }, { value: 'none', label: 'None' }]} onChange={(v) => setD({ labelMode: v })} /></div>
      </section>
      <section className="card"><h2>Practice</h2>
        <label className="switch"><input type="checkbox" checked={s.adaptiveWeighting} onChange={(e) => void app.updateSettings({ adaptiveWeighting: e.target.checked })} /> Ask more about notes I miss</label>
        <p className="muted">On: drills come back more often to items you get wrong. Off: every item is equally likely.</p>
        <div className="setting"><span>Note-finding octave</span><Segmented label="Octave" value={s.octaveMode} options={[{ value: 'any', label: 'Any octave' }, { value: 'exact', label: 'Exact octave' }]} onChange={(v) => void app.updateSettings({ octaveMode: v })} /></div>
        <div className="setting"><span>After a right answer</span><Segmented label="Auto-advance" value={String(s.autoAdvanceMs) as '0' | '600' | '1500'} options={[{ value: '600', label: 'Next after 0.6 s' }, { value: '1500', label: 'Next after 1.5 s' }, { value: '0', label: 'Wait for me' }]} onChange={(v) => void app.updateSettings({ autoAdvanceMs: Number(v) as 0 | 600 | 1500 })} /></div>
      </section>
      <section className="card"><h2>Lesson stages</h2>
        <p className="muted">Choose which stages a lesson opens with, and their order. Hidden stages stay one tap away.</p>
        <ul className="stage-pref">
          {stages.map((st, i) => (
            <li key={st}><span>{LABEL[st]}</span>
              <button aria-label={`Move ${LABEL[st]} earlier`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button aria-label={`Move ${LABEL[st]} later`} disabled={i === stages.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button disabled={stages.length === 1} onClick={() => toggleStage(st)}>Hide</button>
            </li>
          ))}
          {STAGES.filter((x) => !stages.includes(x)).map((st) => <li key={st} className="muted"><span>{LABEL[st]} (hidden)</span><button onClick={() => toggleStage(st)}>Show</button></li>)}
        </ul>
        {content.packs.length > 0 && (
          <label className="select"><span>Lesson pack</span>
            <select value={s.activePackId} onChange={(e) => void app.updateSettings({ activePackId: e.target.value })}>
              {content.packs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
        )}
      </section>
    </div>
  );
}
