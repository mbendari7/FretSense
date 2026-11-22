import { useRef, useState } from 'react';
import { Link } from 'react-router';
import type { ImportPreview } from '../../application/app';
import { median, SLOW_MS } from '../../domain/drills/summary';
import { DRILL_LABELS } from '../../domain/drills/types';
import type { AttemptRecord } from '../../domain/records';
import { DRILL_TYPES } from '../../domain/records';
import { useApp, useAppState } from '../hooks';

const DAY = 86_400_000;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const secs = (ms?: number) => (ms === undefined ? '–' : `${(ms / 1000).toFixed(1)} s`);

function stats(xs: readonly AttemptRecord[]) {
  const correct = xs.filter((a) => a.outcome === 'correct').length;
  return { total: xs.length, accuracy: xs.length ? correct / xs.length : 0, medianMs: median(xs.filter((a) => a.responseMs <= SLOW_MS).map((a) => a.responseMs)) };
}

/** Item label for a progress row, from the frozen itemKey grammar. */
function itemLabel(key: string): string {
  const p = key.split('|');
  const names = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
  if (p[0] === 'nf') return `${names[Number(p[3])]} on string ${p[2]}`;
  if (p[0] === 'iv') return `${p[1]} ${p[2]}`;
  if (p[0] === 'ct') return `${p[1]}: ${p[2]}`;
  return p[2] ?? key;
}

/** US7 progress (FR-042), export/import (FR-043) and reset (FR-044). */
export function ProgressScreen() {
  const app = useApp();
  const s = useAppState();
  const [window, setWindow] = useState<'7d' | 'all'>('7d');
  const live = s.attempts.filter((a) => !a.deleted);
  const now = Date.now();
  const shown = window === 'all' ? live : live.filter((a) => now - Date.parse(a.timestamp) <= 7 * DAY);
  const instName = new Map(s.instruments.map((i) => [i.id, i.deleted ? `${i.name} (deleted)` : i.name]));

  return (
    <div className="page progress">
      <h1>Progress</h1>
      {!live.length ? (
        <div className="empty">
          <p>No practice recorded yet. Your accuracy and answer times show up here after your first drill.</p>
          <Link className="button primary" to="/drills/note-finding">Start a note-finding drill</Link>
        </div>
      ) : (
        <>
          <div className="segmented" role="radiogroup" aria-label="Time range">
            <button role="radio" aria-checked={window === '7d'} onClick={() => setWindow('7d')}>Last 7 days</button>
            <button role="radio" aria-checked={window === 'all'} onClick={() => setWindow('all')}>All time</button>
          </div>
          {DRILL_TYPES.map((t) => {
            const xs = shown.filter((a) => a.drillType === t);
            if (!xs.length) return null;
            const all = stats(xs);
            const byItem = new Map<string, AttemptRecord[]>();
            for (const a of xs) byItem.set(a.itemKey, [...(byItem.get(a.itemKey) ?? []), a]);
            const rows = [...byItem.entries()].map(([k, v]) => ({ k, ...stats(v) })).sort((a, b) => a.accuracy - b.accuracy).slice(0, 8);
            const byInst = new Map<string, AttemptRecord[]>();
            for (const a of xs) { const k = a.instrumentId ?? 'lesson'; byInst.set(k, [...(byInst.get(k) ?? []), a]); }
            return (
              <section key={t} className="card stat-card" aria-labelledby={`p-${t}`}>
                <h2 id={`p-${t}`}>{DRILL_LABELS[t]}</h2>
                <p className="big-score"><strong>{pct(all.accuracy)}</strong> of {all.total} answers correct, typical time {secs(all.medianMs)}</p>
                <Bar value={all.accuracy} />
                <h3>Weakest items</h3>
                <table className="stats">
                  <thead><tr><th scope="col">Item</th><th scope="col">Correct</th><th scope="col">Tries</th><th scope="col">Typical time</th></tr></thead>
                  <tbody>{rows.map((r) => <tr key={r.k}><th scope="row">{itemLabel(r.k)}</th><td>{pct(r.accuracy)}</td><td>{r.total}</td><td>{secs(r.medianMs)}</td></tr>)}</tbody>
                </table>
                {byInst.size > 1 && (
                  <p className="muted">By instrument: {[...byInst.entries()].map(([k, v]) => `${k === 'lesson' ? 'lesson tunings' : instName.get(k) ?? 'unknown'} ${pct(stats(v).accuracy)}`).join(', ')}</p>
                )}
              </section>
            );
          })}
          {!shown.length && <p>No practice in the last 7 days. Switch to All time to see older results.</p>}
        </>
      )}
      <ExportImport />
      <Reset disabled={!live.length && !s.completion.some((c) => !c.deleted)} onReset={() => void app.resetProgress()} />
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return <div className="bar" aria-hidden="true"><span style={{ width: `${Math.round(value * 100)}%` }} /></div>;
}

function ExportImport() {
  const app = useApp();
  const [includeSettings, setInclude] = useState(false);
  const [preview, setPreview] = useState<ImportPreview>();
  const [msg, setMsg] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const framed = window.top !== window.self;

  function doExport() {
    const data = app.exportProfile(includeSettings);
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fretsense-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    setMsg('Exported. The file holds your instruments, answers and lesson progress. Anyone with it can read them.');
  }

  return (
    <section className="card" aria-labelledby="ex-h">
      <h2 id="ex-h">Back up or move your progress</h2>
      <p className="muted">The file stays on your device unless you share it. FretSense never uploads anything.</p>
      <label className="switch"><input type="checkbox" checked={includeSettings} onChange={(e) => setInclude(e.target.checked)} /> Include my settings</label>
      <div className="row-actions">
        <button onClick={doExport}>Export progress</button>
        {!framed && <button onClick={() => input.current?.click()}>Import a file</button>}
        <input ref={input} type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          const r = await app.previewImport(f);
          if (r.ok) setPreview(r.preview); else setMsg(r.reason);
        }} />
      </div>
      {preview && (
        <div className="confirm" role="dialog" aria-modal="false" aria-labelledby="imp-h">
          <h3 id="imp-h">{preview.mode === 'restore' ? 'Restore from this backup?' : 'Copy this file’s progress into your profile?'}</h3>
          <p>{preview.counts.added} new, {preview.counts.restored} restored, {preview.counts.updated} updated, {preview.counts.hidden} hidden by the file, {preview.counts.unchanged} unchanged.</p>
          <div className="row-actions">
            <button className="primary" onClick={async () => { try { await preview.apply(); setMsg('Import finished.'); } catch { setMsg('Import failed: nothing could be saved on this device.'); } setPreview(undefined); }}>Import</button>
            <button onClick={() => setPreview(undefined)}>Cancel</button>
          </div>
        </div>
      )}
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}

function Reset({ disabled, onReset }: { disabled: boolean; onReset: () => void }) {
  const [asking, setAsking] = useState(false);
  if (window.top !== window.self) return null;
  return (
    <section className="card" aria-labelledby="rs-h">
      <h2 id="rs-h">Start fresh</h2>
      <p className="muted">Clears your answers and lesson progress on this device. Instruments and settings stay.</p>
      {asking ? (
        <div className="row-actions" role="group" aria-label="Confirm reset">
          <span>Clear all progress? Export first if you might want it back.</span>
          <button className="danger" onClick={() => { onReset(); setAsking(false); }}>Clear progress</button>
          <button onClick={() => setAsking(false)}>Keep it</button>
        </div>
      ) : <button className="danger" disabled={disabled} onClick={() => setAsking(true)}>Clear progress…</button>}
    </section>
  );
}
