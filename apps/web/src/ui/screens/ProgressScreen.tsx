import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { nothingNew, type ImportCountKind, type ImportPreview } from '../../application/app';
import { median, SLOW_MS } from '../../domain/drills/summary';
import { DRILL_LABELS } from '../../domain/drills/types';
import type { AttemptRecord } from '../../domain/records';
import { DRILL_TYPES, type DrillType } from '../../domain/records';
import { useApp, useAppState } from '../hooks';

const DAY = 86_400_000;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const secs = (ms?: number) => (ms === undefined ? '–' : `${(ms / 1000).toFixed(1)} s`);

/** FR-042: the unit each drill type's group counts (one unit = one recorded attempt, FR-040). */
const unitOf = (t: DrillType) => (t === 'walking-bass' ? 'notes' : t === 'chord-tone-lock' ? 'chords' : 'questions');

function stats(xs: readonly AttemptRecord[]) {
  const correct = xs.filter((a) => a.outcome === 'correct').length;
  return { total: xs.length, correct, accuracy: xs.length ? correct / xs.length : 0, medianMs: median(xs.filter((a) => a.responseMs <= SLOW_MS).map((a) => a.responseMs)) };
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
  const liveAll = s.attempts.filter((a) => !a.deleted);
  // T093a: legacy attempts are kept for history and export only; they make no group, so a profile
  // holding only legacy attempts shows the empty state (code-reviewer r3 #6).
  const live = liveAll.filter((a) => a.drillType !== 'legacy');
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
                <p className="big-score"><strong>{pct(all.accuracy)}</strong>: {all.correct} of {all.total} {unitOf(t)} correct, typical time {secs(all.medianMs)}</p>
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
      <Reset disabled={!liveAll.length && !s.completion.some((c) => !c.deleted)} onReset={() => void app.resetProgress()} />
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return <div className="bar" aria-hidden="true"><span style={{ width: `${Math.round(value * 100)}%` }} /></div>;
}

/** FR-066a (CR-B2-14): one plain sentence per non-zero count, naming the record kinds. */
function countSentences(preview: ImportPreview): string[] {
  const tails: Record<ImportCountKind, [string, string]> = {
    added: ['will be added', 'will be added'],
    restored: ['you reset or deleted earlier will come back', 'you reset or deleted earlier will come back'],
    updated: ['will be updated with newer changes from the file', 'will be updated with newer changes from the file'],
    hidden: ['you reset or deleted elsewhere will be hidden', 'you reset or deleted elsewhere will be hidden'],
    unchanged: ['is already up to date', 'are already up to date'],
  };
  const order: ImportCountKind[] = ['added', 'restored', 'updated', 'hidden', 'unchanged'];
  const out: string[] = [];
  for (const k of order) {
    const total = preview.counts[k];
    if (total <= 0) continue;
    const by = preview.byKind?.[k];
    // Each part: its words and whether it is grammatically plural.
    const parts: [string, boolean][] = [];
    const plural = (n: number, one: string, many: string): [string, boolean] => [`${n} ${n === 1 ? one : many}`, n !== 1];
    if (by) {
      if (by.attempts) parts.push(plural(by.attempts, 'answer', 'answers'));
      if (by.instruments) parts.push(plural(by.instruments, 'instrument', 'instruments'));
      if (by.lessonCompletion) parts.push([`progress in ${by.lessonCompletion} ${by.lessonCompletion === 1 ? 'lesson' : 'lessons'}`, false]);
      if (by.profileSettings) parts.push(['your settings', true]);
    }
    if (!parts.length) parts.push(plural(total, 'item', 'items'));
    const words = parts.length === 1 ? parts[0]![0] : `${parts.slice(0, -1).map((p) => p[0]).join(', ')} and ${parts[parts.length - 1]![0]}`;
    const many = parts.length > 1 || parts[0]![1];
    out.push(`${words} ${tails[k][many ? 1 : 0]}`);
  }
  return out;
}

function ExportImport() {
  const app = useApp();
  const [includeSettings, setInclude] = useState(false);
  const [preview, setPreview] = useState<ImportPreview>();
  const [file, setFile] = useState<File>();
  const [applySettings, setApplySettings] = useState(false);
  const [pending, setPending] = useState(false);
  const [applying, setApplying] = useState(false);
  const applyingRef = useRef(false);
  // Only the latest preview request may land (privacy r1 #3): a stale one never replaces it.
  const request = useRef(0);
  async function loadPreview(f: File, on: boolean) {
    const n = ++request.current;
    setPending(true);
    let r: Awaited<ReturnType<typeof app.previewImport>>;
    try {
      r = await app.previewImport(f, { applySettings: on });
    } catch {
      // security r2 N3: never stuck in pending; previewImport should not throw, but if it does the
      // user sees why and can choose another file.
      r = { ok: false, reason: 'This file couldn’t be read as a FretSense export. Nothing was changed.' };
    }
    if (n !== request.current) return;
    setPending(false);
    if (r.ok) { setMsg(undefined); setPreview(r.preview); } else { setPreview(undefined); setMsg(r.reason); }
  }
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
          setFile(f);
          setApplySettings(false);
          setPreview(undefined);
          await loadPreview(f, false);
        }} />
      </div>
      {preview && (
        <div className="confirm" role="dialog" aria-modal="false" aria-labelledby="imp-h">
          <h3 id="imp-h">{preview.mode === 'restore' ? 'Restore from file' : 'Copy from file'}</h3>
          <p>{preview.mode === 'restore'
            ? 'This file came from this profile, so its records merge back in.'
            : 'This file came from another profile, so its records are copied in as new ones.'}</p>
          {nothingNew(preview.counts)
            ? <p>This file has nothing new to import.</p>
            : <ul className="counts">{countSentences(preview).map((t) => <li key={t}>{t}.</li>)}</ul>}
          {preview.hasSettings && (
            <label className="switch"><input type="checkbox" checked={applySettings} disabled={applying} onChange={async (e) => {
              const on = e.target.checked;
              setApplySettings(on);
              if (file) await loadPreview(file, on);
            }} /> Apply settings from this file</label>
          )}
          {preview.mode === 'copy' && <p className="hint">Copy import adds this file’s answers and instruments as new records every time. Importing the same file again adds them again.</p>}
          {nothingNew(preview.counts) ? (
            // FR-066a (CR-B2-14): nothing new, so the only action is Close, which writes nothing.
            <div className="row-actions">
              <button onClick={() => { request.current++; setPending(false); setPreview(undefined); }}>Close</button>
            </div>
          ) : (
          <div className="row-actions">
            <button className="primary" disabled={pending || applying} onClick={async () => {
              if (applyingRef.current) return;
              applyingRef.current = true;
              setApplying(true);
              request.current++; // a re-preview landing now must not reopen the dialog
              const empty = nothingNew(preview.counts);
              try {
                await preview.apply();
                setMsg(empty ? 'Nothing was imported: this file has nothing new.' : 'Import finished.');
              } catch {
                setMsg('Import failed: nothing could be saved on this device.');
              }
              applyingRef.current = false;
              setApplying(false);
              setPreview(undefined);
            }}>Import</button>
            <button onClick={() => { request.current++; setPending(false); setPreview(undefined); }}>Cancel</button>
          </div>
          )}
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
