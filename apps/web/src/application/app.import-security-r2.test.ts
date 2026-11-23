/**
 * security-reviewer T093 r2 (red, test-first) [FR-043, FR-066, FR-066a, SC-013]
 * (specs/001-theory-fretboard-lessons/reviews/2026-11-22-security-reviewer-T093-r2.md).
 *
 *  N1 (MAJOR): "`planRestore` looks for local copies only in the active profile, and the repo `put`s
 *     by id. An incoming id that matches a record in another profile (or a completion for a different
 *     lessonId) silently overwrites it. Duplicate lessonCompletion ids in a file are not rejected."
 *     Spec: FR-043 "so no id ever exists in two profiles"; FR-066 natural-key records (lesson completion
 *     per local profile and lesson) are matched by natural key; data-model §3: an id is a primary key.
 *     Expected: the restore preview is rejected (ok: false, with a reason) and the other profile's /
 *     other lesson's stored record is byte-for-byte unchanged.
 *  N2 (MINOR): "Copy import shares one idMap across stores; an attempt id equal to an instrument id
 *     remaps it." Expected: either the file is rejected, or each copied attempt's instrumentId is the
 *     id of the copied instrument (FR-043: the copy keeps every reference).
 *  N3 (MINOR, app path): a v0.1 attempt whose payloadHash is an object makes `String()` throw.
 *     Expected: previewImport resolves (never rejects) with ok: false and a reason.
 *  N5 (MINOR): instrument names echoed in import reasons contain no U+061C, U+FEFF or C1 control.
 *
 * Rig as in app.restore-tombstone.test.ts: real FretSenseApp over memoryRepository(), fixed clock,
 * deterministic ids, node:crypto SHA-256. A second local profile is seeded straight into the same
 * repository (the app has no profile-switch API in 001), so "another profile" is a real stored record.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { presetById } from '@fretsense/theory';
import { FretSenseApp } from './app';
import type { Hasher, IdGenerator, Repository } from './ports';
import { memoryRepository } from '../infrastructure/idb';
import { payloadOf } from '../domain/canonicalJson';
import { EXPORT_FORMAT } from '../domain/exportFormat';

const T0 = Date.UTC(2026, 10, 22, 12, 0, 0, 0);
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const sha256: Hasher = { sha256Hex: async (t) => sha(t) };
const idsWith = (prefix: string): IdGenerator => {
  let n = 0;
  return { uuid: () => `${prefix}-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` };
};
async function makeApp(prefix: string) {
  const clock = { t: T0, now() { return this.t; } };
  const repo: Repository = memoryRepository();
  const app = new FretSenseApp(repo, clock, idsWith(prefix), sha256);
  await app.bootstrap();
  return { app, repo, tick: () => { clock.t += 1000; } };
}
const fileOf = (exp: unknown) => {
  const text = JSON.stringify(exp);
  return { size: text.length, text: async () => text };
};

const W = 'abababab-0000-4000-8000-000000000001';
const H = `2026-11-22T11:00:00.000Z-0000-${W}`; // an hour before the app clock: inside the clock bound
const OTHER = '99999999-0000-4000-8000-000000000001'; // the second local profile
const X_ID = '77777777-0000-4000-8000-000000000001';
const BASS4 = () => structuredClone(presetById('bass4-standard')!.profile);

const commonFor = (id: string, pid: string, deleted = false) => ({ id, localProfileId: pid, created: H, updated: H, schemaVersion: 1 as const, deleted });
function attemptFor(id: string, pid: string, instrumentId: string | null = null) {
  const base = {
    ...commonFor(id, pid),
    drillType: 'note-finding', instrumentId, geometryId: 'bass:E1-A1-D2-G2', modality: 'tap',
    prompt: { drillType: 'note-finding', pitchClass: 0, string: 3, midi: null }, answer: [{ string: 3, fret: 3 }],
    outcome: 'correct', responseMs: 900, timestamp: '2026-11-22T11:00:00.000Z', lessonId: null, drillId: null,
    itemKey: 'nf|bass:E1-A1-D2-G2|3|0',
  };
  return { ...base, payloadHash: sha(payloadOf(base)) };
}
const instrumentFor = (id: string, pid: string, name = 'Other bass') => ({ ...commonFor(id, pid), name, profile: BASS4() });
const completionFor = (id: string, pid: string, lessonId: string) => ({ ...commonFor(id, pid), lessonId, stages: { read: H } });

/** Seeds a second local profile, with one record of each kind, straight into the repository. */
async function seedOther(repo: Repository) {
  const profile = { ...commonFor(OTHER, OTHER), displayName: 'Other' };
  const attempt = attemptFor(X_ID, OTHER);
  const instrument = instrumentFor(X_ID.replace('77777777', '88888888'), OTHER);
  const completion = completionFor(X_ID.replace('77777777', '66666666'), OTHER, 'musical-alphabet');
  await repo.write([
    { store: 'localProfiles', record: profile },
    { store: 'attempts', record: attempt },
    { store: 'instruments', record: instrument },
    { store: 'lessonCompletion', record: completion },
  ] as never, (await repo.loadMeta())!);
  return { attempt, instrument, completion };
}
async function otherStored(repo: Repository) {
  const d = (await repo.loadProfile(OTHER))!;
  return { attempts: d.attempts, instruments: d.instruments, completion: d.completion };
}
/** Preview, and if the preview (wrongly) succeeds, confirm it, so an overwrite is observable. */
async function previewAndMaybeApply(app: FretSenseApp, file: unknown) {
  const r = await app.previewImport(fileOf(file));
  if (r.ok) await r.preview.apply();
  return r;
}

// =============================================================================================
describe('security r2 N1: restore never overwrites a record of another local profile (FR-043, SC-013)', () => {
  it('precondition: the seeded profile is stored separately and the app is on its own profile', async () => {
    const { app, repo } = await makeApp('a2000001');
    const seeded = await seedOther(repo);
    expect(app.getState().profile!.id).not.toBe(OTHER);
    expect(await otherStored(repo)).toEqual({ attempts: [seeded.attempt], instruments: [seeded.instrument], completion: [seeded.completion] });
  });

  it('an attempt id that already exists under another profile: rejected with a reason; the other profile\'s attempt is unchanged', async () => {
    const ctx = await makeApp('a2000002');
    const seeded = await seedOther(ctx.repo);
    const exp = ctx.app.exportProfile(false);
    ctx.tick();
    const r = await previewAndMaybeApply(ctx.app, { ...exp, attempts: [attemptFor(seeded.attempt.id, exp.localProfile.id)] });
    expect(r.ok, 'restore must be rejected as a conflict').toBe(false);
    if (!r.ok) expect(r.reason.length).toBeGreaterThan(0);
    expect((await otherStored(ctx.repo)).attempts).toEqual([seeded.attempt]);
  });

  it('an instrument id that already exists under another profile: rejected; the other profile\'s instrument is unchanged', async () => {
    const ctx = await makeApp('a2000003');
    const seeded = await seedOther(ctx.repo);
    const exp = ctx.app.exportProfile(false);
    ctx.tick();
    const r = await previewAndMaybeApply(ctx.app, { ...exp, instruments: [instrumentFor(seeded.instrument.id, exp.localProfile.id, 'Mine')] });
    expect(r.ok, 'restore must be rejected as a conflict').toBe(false);
    expect((await otherStored(ctx.repo)).instruments).toEqual([seeded.instrument]);
  });

  it('a lesson-completion id that already exists under another profile: rejected; the other profile\'s completion is unchanged', async () => {
    const ctx = await makeApp('a2000004');
    const seeded = await seedOther(ctx.repo);
    const exp = ctx.app.exportProfile(false);
    ctx.tick();
    const r = await previewAndMaybeApply(ctx.app, { ...exp, lessonCompletion: [completionFor(seeded.completion.id, exp.localProfile.id, 'triads')] });
    expect(r.ok, 'restore must be rejected as a conflict').toBe(false);
    expect((await otherStored(ctx.repo)).completion).toEqual([seeded.completion]);
  });

  it('a completion id that exists in this profile for a DIFFERENT lessonId: rejected; the local completion keeps its lessonId and stages', async () => {
    const ctx = await makeApp('a2000005');
    await ctx.app.markStage('musical-alphabet', 'read');
    const local = ctx.app.getState().completion.find((c) => c.lessonId === 'musical-alphabet')!;
    const before = structuredClone(local);
    const exp = ctx.app.exportProfile(false);
    ctx.tick();
    const r = await previewAndMaybeApply(ctx.app, { ...exp, lessonCompletion: [completionFor(local.id, exp.localProfile.id, 'triads')] });
    expect(r.ok, 'one id cannot name two lessons (natural key, FR-066)').toBe(false);
    const stored = (await ctx.repo.loadProfile(exp.localProfile.id))!.completion;
    expect(stored.find((c) => c.id === local.id)).toEqual(before);
    expect(stored.some((c) => c.lessonId === 'triads')).toBe(false);
  });

  it('two lessonCompletion records with the same id in one file (different lessons): rejected with a reason, nothing written', async () => {
    const ctx = await makeApp('a2000006');
    const exp = ctx.app.exportProfile(false);
    const pid = exp.localProfile.id;
    const dup = '55555555-0000-4000-8000-000000000001';
    ctx.tick();
    const r = await previewAndMaybeApply(ctx.app, { ...exp, lessonCompletion: [completionFor(dup, pid, 'musical-alphabet'), completionFor(dup, pid, 'triads')] });
    expect(r.ok, 'a record id is a primary key: one id twice in a store makes the file malformed').toBe(false);
    if (!r.ok) expect(r.reason.length).toBeGreaterThan(0);
    expect((await ctx.repo.loadProfile(pid))!.completion).toEqual([]);
  });

  it('control: a restore whose ids are new everywhere still succeeds', async () => {
    const ctx = await makeApp('a2000007');
    await seedOther(ctx.repo);
    const exp = ctx.app.exportProfile(false);
    ctx.tick();
    const r = await ctx.app.previewImport(fileOf({ ...exp, attempts: [attemptFor('44444444-0000-4000-8000-000000000001', exp.localProfile.id)] }));
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
  });
});

// =============================================================================================
describe('security r2 N2: copy import with an attempt id equal to an instrument id (FR-043)', () => {
  const SRC = '33333333-0000-4000-8000-000000000001';
  const SHARED = '33333333-0000-4000-8000-0000000000aa';
  const copyFile = () => ({
    format: EXPORT_FORMAT, schemaVersion: 1, exportedAt: H,
    localProfile: { ...commonFor(SRC, SRC), displayName: 'Source' },
    instruments: [instrumentFor(SHARED, SRC, 'File bass')],
    attempts: [attemptFor(SHARED, SRC, SHARED)],
    lessonCompletion: [],
  });

  it('either rejected, or the copied attempt\'s instrumentId is the copied instrument\'s new id', async () => {
    const ctx = await makeApp('a2000101');
    ctx.tick();
    const r = await ctx.app.previewImport(fileOf(copyFile()));
    if (!r.ok) { expect(r.reason.length).toBeGreaterThan(0); return; }
    expect(r.preview.mode).toBe('copy');
    await r.preview.apply();
    const st = ctx.app.getState();
    const inst = st.instruments.find((i) => i.name === 'File bass');
    expect(inst, 'the instrument was copied').toBeTruthy();
    const att = st.attempts.filter((a) => !a.deleted);
    expect(att.length).toBe(1);
    expect(att[0]!.id, 'copied records get new ids').not.toBe(SHARED);
    expect(att[0]!.instrumentId, 'the attempt still points to the copied instrument').toBe(inst!.id);
    expect(att[0]!.instrumentId, 'never to the attempt\'s own new id').not.toBe(att[0]!.id);
  });
});

// =============================================================================================
describe('security r2 N3 (app path): a v0.1 attempt with an object payloadHash', () => {
  it('previewImport resolves (does not throw) with ok: false and a reason', async () => {
    const ctx = await makeApp('a2000201');
    const exp = ctx.app.exportProfile(false);
    const pid = exp.localProfile.id;
    const v01 = {
      ...commonFor('22222222-0000-4000-8000-000000000001', pid),
      drillType: 'bass-arpeggio', instrumentId: null, geometryId: 'bass:E1-A1-D2-G2', modality: 'tap',
      prompt: { drillType: 'bass-arpeggio', root: { string: 3, fret: 3 }, qualityId: 'minor' },
      answer: [{ string: 3, fret: 5 }], outcome: 'correct', responseMs: 1500, timestamp: '2026-11-22T11:00:00.000Z',
      lessonId: null, drillId: null, itemKey: 'bs|bass-arpeggio|minor', payloadHash: { toString: 1, valueOf: 1 },
    };
    ctx.tick();
    let r: Awaited<ReturnType<FretSenseApp['previewImport']>> | undefined;
    let thrown: unknown;
    try { r = await ctx.app.previewImport(fileOf({ ...exp, attempts: [v01] })); } catch (e) { thrown = e; }
    expect(thrown, `previewImport threw: ${String((thrown as Error | undefined)?.message)}`).toBeUndefined();
    expect(r?.ok).toBe(false);
    if (r && !r.ok) expect(r.reason.length).toBeGreaterThan(0);
  });
});

// =============================================================================================
describe('security r2 N5: instrument names echoed in import reasons are UI-safe', () => {
  // U+061C ARABIC LETTER MARK (bidi), U+FEFF ZERO WIDTH NO-BREAK SPACE, and C1 controls U+0080–U+009F.
  const BAD = /[؜﻿\u0080-\u009f]/u;
  it.each([
    ['U+061C', '؜'],
    ['U+FEFF', '﻿'],
    ['U+0080 (C1)', '\u0080'],
    ['U+0085 (C1 NEL)', '\u0085'],
    ['U+009F (C1)', '\u009f'],
  ])('a name holding %s: the file is rejected and the reason contains no such character', async (_n, ch) => {
    const ctx = await makeApp('a2000301');
    const exp = ctx.app.exportProfile(false);
    const pid = exp.localProfile.id;
    // An inconsistent string count (5, with a 4-note tuning) takes the path that echoes the name.
    const inst = { ...instrumentFor('11111111-0000-4000-8000-000000000001', pid, `Bass${ch}name`), profile: { ...BASS4(), stringCount: 5 } };
    ctx.tick();
    const r = await ctx.app.previewImport(fileOf({ ...exp, instruments: [inst] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(BAD.test(r.reason), JSON.stringify(r.reason)).toBe(false);
  });

  it('control: an ordinary name on the same path is rejected (the echo path is reached)', async () => {
    const ctx = await makeApp('a2000302');
    const exp = ctx.app.exportProfile(false);
    const inst = { ...instrumentFor('11111111-0000-4000-8000-000000000002', exp.localProfile.id, 'Plain bass'), profile: { ...BASS4(), stringCount: 5 } };
    ctx.tick();
    const r = await ctx.app.previewImport(fileOf({ ...exp, instruments: [inst] }));
    expect(r.ok).toBe(false);
  });
});
