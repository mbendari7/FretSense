/**
 * Gate round 1 (code-reviewer / architecture / privacy) for T012 and T013: the production path.
 * FretSenseApp must delegate bootstrap to the ProfileService and expose it as `app.profiles`
 * (the service on the app's OWN session) [T012][FR-001, FR-002]; erase failure handling [T013][FR-003].
 * Valid v0.1 attempt shape copied from app.migrate.test.ts (hand-written, from commit 4695363).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FretSenseApp } from './app';
import { RECORD_STORES, type Hasher, type IdGenerator, type Repository } from './ports';
import { memoryRepository, openIdbRepository } from '../infrastructure/idb';
import { payloadOf } from '../domain/canonicalJson';
import { attemptSchema, type AttemptRecord } from '../domain/records';
import { dbName, makeWorld, preseed, scanIdb, seedProfile, threeProfiles, T0, type Meta } from './__tests__/profileWorld';

const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
const sha256: Hasher = { sha256Hex: async (t) => sha(t) };
const idsWith = (prefix: string): IdGenerator => { let n = 0; return { uuid: () => `${prefix}-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}` }; };
const clockAt = () => ({ t: T0 + 60_000, now() { return this.t; } });

const PA = 'a0000000-0000-4000-8000-00000000000a';
const PB = 'b0000000-0000-4000-8000-00000000000b';
const WA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const two = (active?: string) => ({
  profiles: [{ id: PA, writer: WA, name: 'Ann', wall: T0 + 1000 }, { id: PB, writer: WB, name: 'Bo', wall: T0 + 3000 }],
  active,
});
const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id).sort();

/** An empty world is used only for its raw repository and the preseed helper. */
async function repoWith(kind: 'memory' | 'idb', active?: string) {
  const w = await makeWorld(kind);
  await preseed(w, two().profiles, active);
  return w;
}
async function appOver(repo: Repository, prefix = 'c0000001') {
  const app = new FretSenseApp(repo, clockAt(), idsWith(prefix), sha256);
  await app.bootstrap();
  return app;
}

// ---- v0.1 attempt (4695363 shape; bass-arpeggio -> arpeggio per the 2026-11-22 clarification) ----
const OLD_WRITER = '22222222-0000-4000-8000-000000000002';
const oldH = `2026-11-21T10:00:01.000Z-0000-${OLD_WRITER}`;
function v01Attempt(pid: string): Record<string, unknown> {
  const base = {
    id: 'dddddddd-0000-4000-8000-000000000001', localProfileId: pid, created: oldH, updated: oldH, schemaVersion: 1, deleted: false,
    drillType: 'bass-arpeggio', instrumentId: null, geometryId: 'g-bass4', modality: 'tap',
    prompt: { drillType: 'bass-arpeggio', root: { string: 3, fret: 3 }, qualityId: 'minor' },
    answer: [{ string: 3, fret: 5 }], outcome: 'correct', responseMs: 1500, timestamp: '2026-11-21T10:00:01.000Z',
    lessonId: null, drillId: null, itemKey: 'bs|bass-arpeggio|minor',
  };
  return { ...base, payloadHash: sha(payloadOf(base)) };
}
function expectMigrated(a: AttemptRecord | undefined) {
  expect(a, 'the v0.1 attempt is in state').toBeDefined();
  expect(a!.drillType).toBe('arpeggio');
  expect(a!.itemKey).toBe('bs|arpeggio|minor');
  const { payloadHash, ...rest } = a!;
  expect(payloadHash).toBe(sha(payloadOf(rest)));
  expect(attemptSchema.safeParse(a).success).toBe(true);
}

describe.each(['memory', 'idb'] as const)('[T012][FR-001] FretSenseApp.bootstrap delegates to the profile service on %s', (kind) => {
  it('exposes the ProfileService as app.profiles', async () => {
    const w = await repoWith(kind, PA);
    const app = await appOver(w.raw);
    expect(typeof app.profiles.switchTo).toBe('function');
    expect(typeof app.profiles.create).toBe('function');
    expect(ids(await app.profiles.list())).toEqual([PA, PB]);
  });

  it('opens meta.activeLocalProfileId (the OLDER profile A), not profiles[0] or the newest', async () => {
    const w = await repoWith(kind, PA);
    const app = await appOver(w.raw);
    expect(app.getState().status).toBe('ready');
    expect(app.getState().profile?.id).toBe(PA);
  });

  it('with no active id, opens the most recently updated live profile (B) and persists it in meta', async () => {
    const w = await repoWith(kind);
    const app = await appOver(w.raw);
    expect(app.getState().profile?.id).toBe(PB);
    expect(((await w.raw.loadMeta()) as Meta).activeLocalProfileId).toBe(PB);
  });

  it('switching on the app\'s own session updates app.getState() and notifies app subscribers', async () => {
    const w = await repoWith(kind, PA);
    const app = await appOver(w.raw);
    let calls = 0;
    app.subscribe(() => { calls++; });
    expect((await app.profiles.switchTo(PB)).ok).toBe(true);
    expect(app.getState().profile?.id).toBe(PB);
    expect(calls).toBeGreaterThan(0);
  });
});

describe.each(['memory', 'idb'] as const)('[T012][FR-002] one load path, with the v0.1 attempt migration, on %s', (kind) => {
  async function withOldAttempt(active: string) {
    const w = await repoWith(kind, active);
    await w.raw.write([{ store: 'attempts', record: v01Attempt(PB) as unknown as AttemptRecord }], (await w.raw.loadMeta())!);
    return w;
  }

  it('bootstrap migrates a stored v0.1 attempt of the active profile', async () => {
    const w = await withOldAttempt(PB);
    const app = await appOver(w.raw);
    expect(app.getState().profile?.id).toBe(PB);
    expectMigrated(app.getState().attempts.find((a) => a.id === 'dddddddd-0000-4000-8000-000000000001'));
  });

  it('app.profiles.switchTo(id) migrates it too, and the state of the previous profile is gone', async () => {
    const w = await withOldAttempt(PA);
    const app = await appOver(w.raw);
    expect(app.getState().profile?.id).toBe(PA);
    expect(app.getState().attempts).toEqual([]);
    expect((await app.profiles.switchTo(PB)).ok).toBe(true);
    expectMigrated(app.getState().attempts.find((a) => a.id === 'dddddddd-0000-4000-8000-000000000001'));
    // The migrated record was written back, so a fresh load sees it too.
    expectMigrated((await w.raw.loadProfile(PB))!.attempts[0]);
  });
});

// ---- failure injection on the production path ----
type Hook = { afterPurge?: 'failWrites'; purgeThrows?: boolean };
function hooked(raw: Repository, hook: Hook): Repository & { writeCalls: number } {
  let failing = false;
  const r = {
    durable: raw.durable, writeCalls: 0,
    loadMeta: () => raw.loadMeta(), listProfiles: () => raw.listProfiles(), loadProfile: (id: string) => raw.loadProfile(id),
    findForeignIds: raw.findForeignIds.bind(raw),
    write: async (ops: Parameters<Repository['write']>[0], meta: Parameters<Repository['write']>[1]) => {
      r.writeCalls++;
      if (failing) throw new Error('crashed after purge');
      return raw.write(ops, meta);
    },
    purgeProfile: async (id: string, meta: Parameters<Repository['purgeProfile']>[1]) => {
      if (hook.purgeThrows) throw new Error('purge failed');
      await raw.purgeProfile(id, meta);
      if (hook.afterPurge === 'failWrites') failing = true;
    },
  };
  return r;
}
const settle = <T,>(p: Promise<T>) => p.then((v) => v as T | { ok: false }, () => ({ ok: false as const }));

describe('[T013][FR-003][SC-009] crash gap through the production path (idb)', () => {
  it('erase the active LAST profile, a write fails after the purge; a NEW FretSenseApp bootstraps to exactly one live default with no residue', async () => {
    const name = dbName();
    const raw = await openIdbRepository(name);
    const app1 = await appOver(hooked(raw, { afterPurge: 'failWrites' }), 'c0000001');
    const victim = app1.getState().profile!.id;
    expect((await app1.profiles.rename(victim, 'Zebra Quartz')).ok).toBe(true);
    await app1.addPreset('guitar6-standard');
    const writer = ((await raw.loadMeta())!).writerIds[victim]!;
    const instId = app1.getState().instruments[0]!.id;
    expect(writer).toBeTruthy();

    const r = await settle(app1.profiles.erase(victim));
    expect((r as { ok: boolean }).ok).toBe(false);

    const app2 = await appOver(await openIdbRepository(name), 'c0000009');
    const live = await app2.profiles.list();
    expect(live).toHaveLength(1);
    expect(live[0]!.id).not.toBe(victim);
    expect(app2.getState().profile?.id).toBe(live[0]!.id);
    expect(app2.getState().instruments).toEqual([]);

    const scan = await scanIdb(name);
    for (const s of RECORD_STORES) for (const needle of [victim, writer, 'Zebra Quartz', instId]) expect(scan.text[s], `${needle} in ${s}`).not.toContain(needle);
    expect(scan.text.meta).not.toContain(victim);
    expect(scan.text.meta).not.toContain(writer);
  });
});

describe.each(['memory', 'idb'] as const)('[T013][FR-003] purgeProfile throws on %s', (kind) => {
  it('erase fails (ok:false or rejects), the session meta is restored, and a following save for the active profile succeeds', async () => {
    const w = await repoWith(kind, PA);
    const app = await appOver(hooked(w.raw, { purgeThrows: true }));
    const active = app.getState().profile!.id;
    const before = (await w.raw.loadMeta()) as Meta;
    expect(before.writerIds[active]).toBeTruthy();

    const r = await settle(app.profiles.erase(active));
    expect((r as { ok: boolean }).ok).toBe(false);
    expect(app.getState().profile?.id).toBe(active); // nothing was erased, nothing changed

    await app.updateSettings({ autoAdvanceMs: 0 }); // needs writerIds[active] (stamp) and the persisted meta
    const stored = (await w.raw.loadProfile(active))!;
    expect(stored.settings?.autoAdvanceMs).toBe(0);
    const meta = (await w.raw.loadMeta()) as Meta;
    expect(meta.writerIds[active]).toBe(before.writerIds[active]);
    expect(meta.activeLocalProfileId).toBe(active);
    expect(app.getState().error).toBeUndefined();
  });

  it('the same through the service on a bare session: writerIds[id] and activeLocalProfileId are back, and session.write with a fresh stamp works', async () => {
    const { w, b } = await threeProfiles(kind);
    await w.svc.switchTo(b);
    const metaBefore = structuredClone(w.meta());
    const real = w.repo.purgeProfile;
    (w.repo as { purgeProfile: typeof real }).purgeProfile = async () => { throw new Error('purge failed'); };
    const r = await settle(w.svc.erase(b));
    (w.repo as { purgeProfile: typeof real }).purgeProfile = real;
    expect((r as { ok: boolean }).ok).toBe(false);
    expect(w.meta().writerIds).toEqual(metaBefore.writerIds);
    expect(w.meta().activeLocalProfileId).toBe(b);
    const settings = { ...w.session.getState().settings!, updated: w.session.stamp(b) };
    await expect(w.session.write([{ store: 'profileSettings', record: settings }])).resolves.toBeUndefined();
  });
});

describe.each(['memory', 'idb'] as const)('[T013][FR-003] privacy: the follow-up write after erasing the ACTIVE profile fails, on %s', (kind) => {
  it.each([['others remain'], ['it was the last profile']])('(%s) state no longer holds the erased profile, so no later save can resurrect it', async (label) => {
    const last = label.includes('last');
    let w = await makeWorld(kind);
    await w.svc.start();
    let victim = w.session.getState().profile!.id;
    if (!last) {
      await w.svc.create('Bo');
      await w.svc.create('Cy');
    }
    const seeded = await seedProfile(w, victim, 'v', 3);
    // Reload (fresh session over the same storage) so state really holds the victim's seeded data.
    const w1 = w;
    w = await makeWorld(kind, { dbName: w1.name, idBase: 0x9000, raw: w1.raw });
    await w.svc.start();
    expect(w.session.getState().profile?.id).toBe(victim);
    expect(w.session.getState().attempts.length).toBeGreaterThan(0);
    const real = w.repo.purgeProfile;
    (w.repo as { purgeProfile: typeof real }).purgeProfile = async (id, meta) => {
      await real(id, meta);
      (w.repo as { write: unknown }).write = async () => { throw new Error('crashed after purge'); };
    };
    await settle(w.svc.erase(victim));
    const s = w.session.getState();
    expect(s.profile?.id).not.toBe(victim);
    expect(s.instruments.filter((i) => i.localProfileId === victim)).toEqual([]);
    expect(s.attempts.filter((a) => a.localProfileId === victim)).toEqual([]);
    expect(s.completion.filter((c) => c.localProfileId === victim)).toEqual([]);
    if (!s.profile) { expect(s.instruments).toEqual([]); expect(s.attempts).toEqual([]); expect(s.completion).toEqual([]); }
    expect(JSON.stringify(s)).not.toContain(victim);
    for (const id of Object.values(seeded).flat()) expect(JSON.stringify(s)).not.toContain(id);
    victim = '';
  });
});

describe.each(['memory', 'idb'] as const)('[T013][FR-003][FR-020] delete is serialised with queued saves on %s', (kind) => {
  it('a save for the victim queued right AFTER delete starts leaves no live record in the deleted profile', async () => {
    const { w, b } = await threeProfiles(kind);
    await seedProfile(w, b, 'b', 2);
    const late = { ...w.session.common(b), name: 'Late instrument', profile: { family: 'guitar', tuning: [40, 45, 50, 55, 59, 64], fretCount: 22, stringCount: 6, scaleLengthMm: 648, geometryId: 'g-late' } };
    const deleting = w.svc.delete(b); // started, not awaited
    const saving = w.session.write([{ store: 'instruments', record: late } as never]);
    await Promise.allSettled([deleting, saving]);
    const data = (await w.raw.loadProfile(b))!;
    const all = [data.profile, data.settings, ...data.instruments, ...data.attempts, ...data.completion, ...data.gear, data.onboarding, ...data.paths, ...data.pathItems, ...data.packs]
      .filter(Boolean) as { id: string; deleted: boolean }[];
    expect(all.length).toBeGreaterThan(0);
    expect(all.filter((r) => !r.deleted).map((r) => r.id)).toEqual([]);
  });
});

describe.each(['memory', 'idb'] as const)('[T012] a non-active live profile with no writer id in an older meta on %s', (kind) => {
  it('start() ensures writer ids for ALL live profiles; rename and delete of the non-active one return results, never throw', async () => {
    const w = await makeWorld(kind);
    await preseed(w, two().profiles, PA);
    const m = (await w.raw.loadMeta()) as Meta;
    await w.raw.write([], { ...m, writerIds: { [PA]: WA } }); // an older meta: B has no writer id
    await w.svc.start();
    expect(w.meta().activeLocalProfileId).toBe(PA);
    expect(w.meta().writerIds[PB]).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
    await expect(w.svc.rename(PB, 'Bobby')).resolves.toMatchObject({ ok: true });
    await expect(w.svc.delete(PB)).resolves.toMatchObject({ ok: true });
    expect(w.session.getState().profile?.id).toBe(PA);
  });
});
