/**
 * T092 (red, test-first): import plan, restore precedence and reset revival at the application
 * level [FR-043, FR-044, FR-066a, SC-009, SC-013].
 *
 * Uses the real FretSenseApp over memoryRepository() (infrastructure/idb.ts), with a fixed clock,
 * deterministic ids and a SHA-256 hasher written here with node:crypto. Every expected value is
 * read off spec.md:
 *  - FR-066a: completing a stage while the completion record is tombstoned un-deletes it with only
 *    the newly completed stage; earlier stages return only through restore-import (FN-10b).
 *  - FR-066a: preview lists added, restored, updated, hidden and unchanged; "nothing new" when the
 *    first four are 0, and confirming then writes nothing, including tombstones copy import would
 *    otherwise copy; tombstoned records copied by copy import are not counted as added; hidden is
 *    always 0 in copy import.
 *  - FR-043 copy import: new ids and the target's profile id; incoming tombstones never apply; a
 *    tombstone is copied (new id) only when it is not a natural-key record or the target has no
 *    record with that natural key, and never hides a live target record; an incoming live
 *    natural-key record whose target is tombstoned un-deletes it with only the incoming stages.
 *  - FR-043: "Apply settings from this file" defaults off.
 *  - SC-009: export → reset → restore-import restores 100% of live attempts with identical payloads
 *    and every completed stage with its original time, with 0 duplicate ids or natural keys.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { presetById } from '@fretsense/theory';
import { FretSenseApp } from './app';
import type { Hasher, IdGenerator, Repository, WriteOp } from './ports';
import { memoryRepository } from '../infrastructure/idb';
import { generateQuestions } from '../domain/drills/generate';
import { mulberry32 } from '../domain/prng';
import type { AnsweredQuestion } from '../domain/drills/session';
import { PAYLOAD_FIELDS, payloadOf } from '../domain/canonicalJson';
import { attemptSchema, type AttemptRecord } from '../domain/records';
import type { ProfileExport } from '../domain/exportFormat';

// ---------- test rig ----------
const T0 = Date.UTC(2026, 10, 22, 12, 0, 0, 0);
const sha256: Hasher = { sha256Hex: async (t) => createHash('sha256').update(t, 'utf8').digest('hex') };
function idsWith(prefix: string): IdGenerator {
  let n = 0;
  return { uuid: () => `${prefix}-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` };
}
function spyRepo() {
  const inner = memoryRepository();
  const writes: WriteOp[][] = [];
  const repo: Repository = {
    durable: inner.durable,
    loadMeta: () => inner.loadMeta(),
    listProfiles: () => inner.listProfiles(),
    loadProfile: (id) => inner.loadProfile(id),
    write: async (ops, meta) => {
      writes.push([...ops]);
      await inner.write(ops, meta);
    },
  };
  return { repo, writes };
}
async function makeApp(prefix: string) {
  const clock = { t: T0, now() { return this.t; } };
  const { repo, writes } = spyRepo();
  const app = new FretSenseApp(repo, clock, idsWith(prefix), sha256);
  await app.bootstrap();
  /** Advances the wall clock so successive actions get distinct, increasing times. */
  const tick = (ms = 1000) => { clock.t += ms; };
  return { app, writes, tick };
}
const recordOps = (writes: WriteOp[][]) => writes.reduce((n, ops) => n + ops.length, 0);

const std6 = presetById('guitar6-standard')!.profile;
const questions = (() => {
  const r = generateQuestions({
    profile: std6,
    settings: { type: 'note-finding', strings: [1, 2, 3, 4, 5, 6], fromFret: 0, toFret: 12, count: 20, octaveMode: 'any' },
    rng: mulberry32(42), histories: new Map(), adaptive: false,
  });
  if (!r.ok) throw new Error(r.reason);
  return r.questions;
})();
const answered = (i: number, ms = 900): AnsweredQuestion => ({ question: questions[i]!, taps: [questions[i]!.steps[0]!.valid[0]!], correct: true, responseMs: ms });

async function answer(ctx: Awaited<ReturnType<typeof makeApp>>, i: number) {
  ctx.tick();
  await ctx.app.recordAttempt(answered(i, 700 + i), { instrumentId: ctx.app.activeInstrument()?.id ?? null, profile: std6 });
}
async function mark(ctx: Awaited<ReturnType<typeof makeApp>>, lessonId: string, stage: 'read' | 'see' | 'drill') {
  ctx.tick();
  await ctx.app.markStage(lessonId, stage);
}
const fileOf = (exp: unknown) => {
  const text = JSON.stringify(exp);
  return { size: text.length, text: async () => text };
};
async function preview(ctx: Awaited<ReturnType<typeof makeApp>>, exp: unknown) {
  ctx.tick();
  const r = await ctx.app.previewImport(fileOf(exp));
  if (!r.ok) throw new Error(`preview rejected: ${r.reason}`);
  return r.preview;
}
const payload = (a: AttemptRecord) => Object.fromEntries(PAYLOAD_FIELDS.map((f) => [f, a[f as keyof AttemptRecord]]));
const completionOf = (ctx: Awaited<ReturnType<typeof makeApp>>, lessonId: string) => ctx.app.getState().completion.filter((c) => c.lessonId === lessonId);
const nothingNew = (c: { added: number; restored: number; updated: number; hidden: number }) => c.added + c.restored + c.updated + c.hidden === 0;

// =============================================================================================
describe('FR-066a / FR-044 completing a stage after a reset revives the record with only the new stage', () => {
  it('one record (same natural key), live, with only the newly completed stage', async () => {
    const ctx = await makeApp('aaaaaaaa');
    await mark(ctx, 'lesson-a', 'read');
    await mark(ctx, 'lesson-a', 'see');
    const before = completionOf(ctx, 'lesson-a');
    expect(before).toHaveLength(1);
    ctx.tick();
    await ctx.app.resetProgress();
    expect(completionOf(ctx, 'lesson-a')[0]!.deleted).toBe(true);
    await mark(ctx, 'lesson-a', 'drill');
    const after = completionOf(ctx, 'lesson-a');
    expect(after).toHaveLength(1);
    expect(after[0]!.id).toBe(before[0]!.id);
    expect(after[0]!.deleted).toBe(false);
    expect(Object.keys(after[0]!.stages)).toEqual(['drill']);
  });

  it('the earlier stages return only through restore-import of a file that holds them, with their original times', async () => {
    const ctx = await makeApp('aaaaaaab');
    await mark(ctx, 'lesson-a', 'read');
    await mark(ctx, 'lesson-a', 'see');
    const original = { ...completionOf(ctx, 'lesson-a')[0]!.stages };
    const exp = ctx.app.exportProfile(false);
    ctx.tick();
    await ctx.app.resetProgress();
    await mark(ctx, 'lesson-a', 'drill');
    const drillTime = completionOf(ctx, 'lesson-a')[0]!.stages.drill;
    const p = await preview(ctx, exp);
    expect(p.mode).toBe('restore');
    await p.apply();
    const after = completionOf(ctx, 'lesson-a');
    expect(after).toHaveLength(1);
    expect(after[0]!.deleted).toBe(false);
    expect(after[0]!.stages).toEqual({ read: original.read, see: original.see, drill: drillTime });
  });
});

// =============================================================================================
describe('SC-009 export → reset → restore-import (same local profile)', () => {
  it('restores every live attempt with an identical payload and every stage with its original time; 0 duplicates', async () => {
    const ctx = await makeApp('bbbbbbbb');
    await ctx.app.addPreset('guitar6-standard');
    for (const i of [0, 1, 2]) await answer(ctx, i);
    await mark(ctx, 'lesson-a', 'read');
    await mark(ctx, 'lesson-a', 'see');
    const exp = ctx.app.exportProfile(false);
    const liveAtExport = exp.attempts.filter((a) => !a.deleted);
    const stagesAtExport = exp.lessonCompletion.find((c) => c.lessonId === 'lesson-a')!.stages;
    ctx.tick();
    await ctx.app.resetProgress();

    const p = await preview(ctx, exp);
    expect(p.mode).toBe('restore');
    // 3 attempts + 1 completion come back; the instrument was never reset.
    expect(p.counts).toEqual({ added: 0, restored: 4, updated: 0, hidden: 0, unchanged: 1 });
    await p.apply();

    const s = ctx.app.getState();
    for (const a of liveAtExport) {
      const local = s.attempts.filter((x) => x.id === a.id);
      expect(local).toHaveLength(1);
      expect(local[0]!.deleted).toBe(false);
      expect(payload(local[0]!)).toEqual(payload(a));
      expect(local[0]!.payloadHash).toBe(a.payloadHash);
    }
    expect(completionOf(ctx, 'lesson-a')).toHaveLength(1);
    expect(completionOf(ctx, 'lesson-a')[0]!.stages).toEqual(stagesAtExport);
    const ids = [...s.attempts, ...s.instruments, ...s.completion].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('importing the same file again: "nothing new" (added, restored, updated, hidden all 0) and confirming writes nothing', async () => {
    const ctx = await makeApp('bbbbbbbc');
    await ctx.app.addPreset('guitar6-standard');
    for (const i of [0, 1, 2]) await answer(ctx, i);
    await mark(ctx, 'lesson-a', 'read');
    const exp = ctx.app.exportProfile(false);
    ctx.tick();
    await ctx.app.resetProgress();
    await (await preview(ctx, exp)).apply();

    const again = await preview(ctx, exp);
    expect(nothingNew(again.counts)).toBe(true);
    expect(again.counts.unchanged).toBe(5); // 3 attempts + 1 instrument + 1 completion
    const before = recordOps(ctx.writes);
    await again.apply();
    expect(recordOps(ctx.writes)).toBe(before);
  });
});

// =============================================================================================
describe('FR-066a preview counts include unchanged', () => {
  it('re-importing a fresh export of the same profile: every record is unchanged', async () => {
    const ctx = await makeApp('cccccccc');
    await ctx.app.addPreset('guitar6-standard');
    await answer(ctx, 0);
    await answer(ctx, 1);
    await mark(ctx, 'lesson-a', 'read');
    const p = await preview(ctx, ctx.app.exportProfile(false));
    expect(p.counts).toEqual({ added: 0, restored: 0, updated: 0, hidden: 0, unchanged: 4 });
  });

  it('(1) a file attempt with the same id but a different immutable payload rejects the whole file, nothing changed', async () => {
    const ctx = await makeApp('cccccccd');
    await ctx.app.addPreset('guitar6-standard');
    await answer(ctx, 0);
    const exp = structuredClone(ctx.app.exportProfile(false)) as ProfileExport;
    const a = exp.attempts[0]!;
    const changed = { ...a, outcome: 'incorrect' as const, responseMs: a.responseMs + 1 };
    const { payloadHash: _old, ...rest } = changed;
    exp.attempts[0] = { ...changed, payloadHash: await sha256.sha256Hex(payloadOf(rest)) }; // checksum valid, payload different
    const before = recordOps(ctx.writes);
    const r = await ctx.app.previewImport(fileOf(exp));
    expect(r.ok).toBe(false);
    expect(recordOps(ctx.writes)).toBe(before);
    expect(ctx.app.getState().attempts[0]!.outcome).toBe('correct');
  });
});

// =============================================================================================
describe('FR-043 "Apply settings from this file" defaults off', () => {
  it('a restore-import of a file whose settings are newer leaves local settings unchanged by default', async () => {
    const ctx = await makeApp('dddddddd');
    const exp = structuredClone(ctx.app.exportProfile(true)) as ProfileExport;
    const s = exp.profileSettings!;
    // Make the file's octave mode newer than the local field (an HLC 1 minute later, same writer).
    const later = s.fieldUpdated.octaveMode!.replace(/^[^Z]+Z/, new Date(T0 + 60_000).toISOString());
    exp.profileSettings = { ...s, octaveMode: 'exact', fieldUpdated: { ...s.fieldUpdated, octaveMode: later }, updated: later };
    ctx.tick(120_000);
    const p = await preview(ctx, exp);
    expect(p.counts.updated).toBe(0);
    await p.apply();
    expect(ctx.app.getState().settings!.octaveMode).toBe('any');
  });
});

// =============================================================================================
describe('FR-043 copy import (different local profile)', () => {
  it('counts: tombstoned records copied are not added; hidden is 0; records get new ids and the target profile id', async () => {
    const src = await makeApp('eeeeeeee');
    await src.app.addPreset('guitar6-standard');
    await answer(src, 0);
    src.tick();
    await src.app.resetProgress(); // attempt 0 is now a tombstone
    await answer(src, 1);
    await answer(src, 2);
    const exp = src.app.exportProfile(false);

    const dst = await makeApp('ffffffff');
    await dst.app.addPreset('bass4-standard');
    const p = await preview(dst, exp);
    expect(p.mode).toBe('copy');
    // 1 instrument + 2 live attempts are added; the tombstoned attempt is not counted as added.
    expect(p.counts.added).toBe(3);
    expect(p.counts.hidden).toBe(0);
    expect(p.counts.restored).toBe(0);
    expect(p.counts.updated).toBe(0);
    await p.apply();

    const s = dst.app.getState();
    const pid = s.profile!.id;
    const srcIds = new Set([...exp.attempts, ...exp.instruments, ...exp.lessonCompletion].map((r) => r.id));
    // Owner decision 2026-11-22 (2), spec Clarifications "Copy import drops deleted": a record that is
    // tombstoned in the file is not written and not counted (replaces "copied as a tombstone").
    expect(s.attempts).toHaveLength(2);
    expect(s.attempts.filter((a) => !a.deleted)).toHaveLength(2);
    expect(s.attempts.filter((a) => a.deleted)).toHaveLength(0);
    for (const r of [...s.attempts, ...s.instruments]) {
      expect(srcIds.has(r.id)).toBe(false);
      expect(r.localProfileId).toBe(pid);
    }
    const copiedInst = s.instruments.find((i) => i.profile.geometryId === std6.geometryId)!;
    expect(copiedInst).toBeDefined();
    for (const a of s.attempts) {
      expect(a.instrumentId).toBe(copiedInst.id);
      expect(attemptSchema.safeParse(a).success).toBe(true);
      expect(a.payloadHash).toBe(await sha256.sha256Hex(payloadOf(a as unknown as Record<string, unknown>)));
    }
    // attempt wall times are kept. Spec Clarifications, Owner decisions 2026-11-22 (2): "Copy import
    // (FR-066a copy mode) drops records that are deleted (tombstoned) in the file: they are not written
    // and not counted", so only the file's live attempts are compared.
    expect(s.attempts.map((a) => a.timestamp).sort()).toEqual(exp.attempts.filter((a) => !a.deleted).map((a) => a.timestamp).sort());
  });

  it('an incoming completion tombstone never hides a live target completion', async () => {
    const src = await makeApp('11111110');
    await mark(src, 'lesson-a', 'read');
    src.tick();
    await src.app.resetProgress(); // the file holds lesson-a as a tombstone
    const exp = src.app.exportProfile(false);

    const dst = await makeApp('22222220');
    await mark(dst, 'lesson-a', 'see');
    const live = { ...completionOf(dst, 'lesson-a')[0]! };
    const p = await preview(dst, exp);
    expect(p.counts.hidden).toBe(0);
    await p.apply();
    const after = completionOf(dst, 'lesson-a');
    expect(after).toHaveLength(1);
    expect(after[0]!.deleted).toBe(false);
    expect(after[0]!.stages).toEqual(live.stages);
  });

  it('an incoming live completion whose target record is tombstoned un-deletes it with only the incoming stages', async () => {
    const src = await makeApp('33333330');
    await mark(src, 'lesson-b', 'see');
    const exp = src.app.exportProfile(false);
    const incomingSee = exp.lessonCompletion[0]!.stages.see;

    const dst = await makeApp('44444440');
    await mark(dst, 'lesson-b', 'read');
    dst.tick();
    await dst.app.resetProgress(); // target lesson-b tombstoned with {read}
    const p = await preview(dst, exp);
    expect(nothingNew(p.counts)).toBe(false);
    await p.apply();
    const after = completionOf(dst, 'lesson-b');
    expect(after).toHaveLength(1); // natural key: never a second record
    expect(after[0]!.deleted).toBe(false);
    expect(Object.keys(after[0]!.stages)).toEqual(['see']);
    expect(after[0]!.stages.see).toBeDefined();
    expect(incomingSee).toBeDefined();
  });

  it('owner decision 2026-11-22 (2): a completion tombstoned in the file is dropped (not written) even when the target has no record with that natural key', async () => {
    const src = await makeApp('55555550');
    await src.app.addPreset('guitar6-standard');
    await mark(src, 'lesson-c', 'read');
    src.tick();
    await src.app.resetProgress();
    await answer(src, 3); // something new, so the import is not "nothing new"
    const exp = src.app.exportProfile(false);
    expect(exp.lessonCompletion.find((c) => c.lessonId === 'lesson-c')!.deleted).toBe(true);

    const dst = await makeApp('66666660');
    await (await preview(dst, exp)).apply();
    expect(completionOf(dst, 'lesson-c')).toHaveLength(0);
  });

  it('"nothing new": a file holding only tombstones gives all-zero counts and confirming writes nothing (not even the tombstones)', async () => {
    const src = await makeApp('77777770');
    src.tick();
    await src.app.recordAttempt(answered(4), { instrumentId: null, profile: std6 }); // lesson-preset attempt, no instrument
    await mark(src, 'lesson-d', 'read');
    src.tick();
    await src.app.resetProgress();
    const exp = src.app.exportProfile(false);
    expect(exp.instruments).toHaveLength(0);
    expect([...exp.attempts, ...exp.lessonCompletion].every((r) => r.deleted)).toBe(true);

    const dst = await makeApp('88888880');
    const p = await preview(dst, exp);
    expect(p.mode).toBe('copy');
    expect(p.counts).toMatchObject({ added: 0, restored: 0, updated: 0, hidden: 0 });
    const before = recordOps(dst.writes);
    await p.apply();
    expect(recordOps(dst.writes)).toBe(before);
    expect(dst.app.getState().attempts).toHaveLength(0);
    expect(dst.app.getState().completion).toHaveLength(0);
  });
});

// =============================================================================================
// T093 (red): privacy-auditor r1 MAJOR findings. FR-043: copy import re-stamps created/updated with
// the target writer, never carries a source-profile reference, and rejects dangling references.
// FN-10c: copied records keep no linkage to the source profile. HLC format (records.ts
// HLC_PATTERN): `<ISO 24 chars>-<4-digit counter>-<writer uuid>`.
const hlcIso = (h: string) => h.slice(0, 24);
const hlcWriter = (h: string) => h.slice(30);
/** Every HLC string stored in the target after the import, labelled with where it came from. */
function storedHlcs(ctx: Awaited<ReturnType<typeof makeApp>>): { where: string; h: string }[] {
  const s = ctx.app.getState();
  const out: { where: string; h: string }[] = [];
  for (const a of s.attempts) out.push({ where: `attempt ${a.id} created`, h: a.created }, { where: `attempt ${a.id} updated`, h: a.updated });
  for (const i of s.instruments) out.push({ where: `instrument ${i.id} created`, h: i.created }, { where: `instrument ${i.id} updated`, h: i.updated });
  for (const c of s.completion) {
    out.push({ where: `completion ${c.lessonId} created`, h: c.created }, { where: `completion ${c.lessonId} updated`, h: c.updated });
    for (const [k, v] of Object.entries(c.stages)) if (v) out.push({ where: `completion ${c.lessonId} stages.${k}`, h: v });
  }
  if (s.settings) {
    out.push({ where: 'profileSettings updated', h: s.settings.updated });
    for (const [k, v] of Object.entries(s.settings.fieldUpdated)) if (v) out.push({ where: `profileSettings fieldUpdated.${k}`, h: v as string });
  }
  return out;
}

describe('FR-043 / FN-10c copy import with "Apply settings from this file" never carries a source reference into settings', () => {
  /** A source profile whose settings are newer than the target's and point at the source's own instrument. */
  async function sourceWithActiveInstrument(prefix: string) {
    const src = await makeApp(prefix);
    src.tick(3_600_000); // the source's settings stamps sort after the target's bootstrap stamps
    await src.app.addPreset('guitar6-standard');
    src.tick();
    await src.app.updateSettings({ octaveMode: 'exact' }); // so the import has a settings change either way
    await answer(src, 0);
    const exp = src.app.exportProfile(true);
    expect(exp.profileSettings).toBeDefined();
    expect(exp.profileSettings!.activeInstrumentId).toBe(exp.instruments[0]!.id); // precondition
    return exp;
  }
  const allSourceIds = (exp: ProfileExport) =>
    new Set([exp.localProfile.id, ...exp.attempts, ...exp.instruments, ...exp.lessonCompletion, ...(exp.profileSettings ? [exp.profileSettings] : [])].map((r) => (typeof r === 'string' ? r : r.id)));

  it('target with no instruments: activeInstrumentId is null or a target instrument id, never a source id', async () => {
    const exp = await sourceWithActiveInstrument('a0a0a0a0');
    const dst = await makeApp('b0b0b0b0');
    dst.tick(7_200_000);
    const r = await dst.app.previewImport(fileOf(exp), { applySettings: true });
    if (!r.ok) throw new Error(`preview rejected: ${r.reason}`);
    expect(r.preview.mode).toBe('copy');
    await r.preview.apply();
    const s = dst.app.getState();
    const active = s.settings!.activeInstrumentId;
    expect(allSourceIds(exp).has(active as string)).toBe(false);
    if (active !== null) expect(s.instruments.map((i) => i.id)).toContain(active);
  });

  it('target with its own instrument: activeInstrumentId is null or a target instrument id, never a source id', async () => {
    const exp = await sourceWithActiveInstrument('a0a0a0a1');
    const dst = await makeApp('b0b0b0b1');
    await dst.app.addPreset('bass4-standard');
    dst.tick(7_200_000);
    const r = await dst.app.previewImport(fileOf(exp), { applySettings: true });
    if (!r.ok) throw new Error(`preview rejected: ${r.reason}`);
    await r.preview.apply();
    const s = dst.app.getState();
    const active = s.settings!.activeInstrumentId;
    expect(allSourceIds(exp).has(active as string)).toBe(false);
    if (active !== null) expect(s.instruments.map((i) => i.id)).toContain(active);
    // and every other id-valued setting is free of source ids too
    expect(JSON.stringify(s.settings)).not.toContain(exp.instruments[0]!.id);
    expect(JSON.stringify(s.settings)).not.toContain(exp.localProfile.id);
  });
});

describe('FR-043 / FN-10c copy import: no stored HLC carries the source writer id', () => {
  it('attempts, instruments, completion (created, updated, stages.*) and settings (updated, fieldUpdated.*) all use the target writer; stage wall times are kept', async () => {
    // Source: an instrument, attempts, completions with stages, newer settings.
    const src = await makeApp('c0c0c0c0');
    src.tick(3_600_000);
    await src.app.addPreset('guitar6-standard');
    src.tick();
    await src.app.updateSettings({ octaveMode: 'exact', adaptiveWeighting: false });
    await answer(src, 0);
    await answer(src, 1);
    await mark(src, 'lesson-new', 'read');   // target has no record: copied as new
    await mark(src, 'lesson-new', 'see');
    await mark(src, 'lesson-undel', 'see');  // target has it tombstoned: un-delete
    await mark(src, 'lesson-undel', 'drill');
    const exp = src.app.exportProfile(true);
    const srcWriter = hlcWriter(exp.attempts[0]!.created);
    expect(srcWriter).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/); // precondition
    const srcStages = (lessonId: string) => exp.lessonCompletion.find((c) => c.lessonId === lessonId)!.stages;

    // Target: lesson-undel completed then reset (tombstoned).
    const dst = await makeApp('d0d0d0d0');
    await mark(dst, 'lesson-undel', 'read');
    dst.tick();
    await dst.app.resetProgress();
    expect(completionOf(dst, 'lesson-undel')[0]!.deleted).toBe(true); // precondition
    dst.tick(7_200_000);

    const r = await dst.app.previewImport(fileOf(exp), { applySettings: true });
    if (!r.ok) throw new Error(`preview rejected: ${r.reason}`);
    expect(r.preview.mode).toBe('copy');
    await r.preview.apply();

    // The import really did copy things (so the check below is not vacuous).
    const s = dst.app.getState();
    expect(s.attempts.length).toBe(2);
    expect(s.instruments.length).toBe(1);
    expect(s.settings!.octaveMode).toBe('exact');
    expect(completionOf(dst, 'lesson-undel')[0]!.deleted).toBe(false);

    const leaks = storedHlcs(dst).filter((x) => x.h.includes(srcWriter)).map((x) => `${x.where}: ${x.h}`);
    expect(leaks).toEqual([]);

    // Stage wall times survive the re-stamp: only the writer suffix changes.
    const isoOf = (st: Record<string, string | undefined>) => Object.fromEntries(Object.entries(st).filter(([, v]) => !!v).map(([k, v]) => [k, hlcIso(v!)]));
    expect(isoOf(completionOf(dst, 'lesson-new')[0]!.stages)).toEqual(isoOf(srcStages('lesson-new')));
    expect(isoOf(completionOf(dst, 'lesson-undel')[0]!.stages)).toEqual(isoOf(srcStages('lesson-undel')));
  });
});
