/**
 * T013 round 3 (red, test-first): the meta race [FR-003, SC-009, FR-020; architecture-reviewer r2 MAJOR].
 * Contract: session.write(ops) persists the meta current WHEN THE WRITE RUNS, not the meta captured when
 * it was called (the HLC only moves forward; writer ids only leave through erase). Otherwise a save queued
 * behind an erase or delete re-persists the stale meta: the erased writer id comes back (SC-009) or
 * activeLocalProfileId names a deleted profile. All on idb, reading `meta` straight from the database.
 */
import { describe, expect, it } from 'vitest';
import { scanIdb, threeProfiles, seedProfile, type Meta, type World } from './__tests__/profileWorld';

const settle = <T,>(p: Promise<T>) => p.then((v) => v as T | { ok: false }, () => ({ ok: false as const }));

/** The `meta` store as stored, parsed from a raw scan. */
async function storedMeta(w: World): Promise<Meta> {
  const scan = await scanIdb(w.name);
  return (JSON.parse(scan.text.meta!) as { vals: Meta[] }).vals[0]!;
}
/** Holds the commit queue until `release()`, so later calls are all queued before any of them runs. */
function block(w: World) {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  void w.session.commit(() => gate);
  return release;
}
/** Lets erase/delete finish their async pre-reads, so their commit is really queued behind the gate. */
const queued = () => new Promise<void>((r) => setTimeout(r, 60));

/** A settings save for profile `pid` (its stored settings record), stamped now, like a real UI action. */
const settingsSave = async (w: World, pid: string) => {
  const cur = (await w.raw.loadProfile(pid))!.settings!;
  return () => w.session.write([{ store: 'profileSettings', record: { ...cur, updated: w.session.stamp(pid) } } as never]);
};

describe('[T013][FR-003][SC-009] a save queued behind an erase or delete cannot restore stale meta (idb)', () => {
  it('erase of a NON-active B, then a save for the active A queued before the erase runs: stored meta has no writerIds[B], active stays A', async () => {
    const { w, a, b } = await threeProfiles('idb');
    await seedProfile(w, b, 'b', 2);
    const writerB = w.meta().writerIds[b]!;
    const save = await settingsSave(w, a);
    const release = block(w);
    const erasing = settle(w.svc.erase(b));
    await queued();
    const saving = settle(save());
    release();
    await Promise.all([erasing, saving]);
    const m = await storedMeta(w);
    expect(m.writerIds[b]).toBeUndefined();
    expect(Object.values(m.writerIds)).not.toContain(writerB);
    expect(m.activeLocalProfileId).toBe(a);
    expect(await w.raw.loadProfile(b)).toBeUndefined();
    expect(w.meta().writerIds[b]).toBeUndefined();
    expect((await scanIdb(w.name)).text.meta).not.toContain(b);
  });

  it('erase of the ACTIVE profile, then a save for another profile queued before the erase runs: stored meta has no writerIds[victim] and does not name it active', async () => {
    const { w, a, b, c } = await threeProfiles('idb');
    await w.svc.switchTo(b);
    await seedProfile(w, b, 'b', 2);
    const writerB = w.meta().writerIds[b]!;
    const save = await settingsSave(w, a);
    const release = block(w);
    const erasing = settle(w.svc.erase(b));
    await queued();
    const saving = settle(save());
    release();
    const [r] = await Promise.all([erasing, saving]);
    const m = await storedMeta(w);
    expect(m.writerIds[b]).toBeUndefined();
    expect(Object.values(m.writerIds)).not.toContain(writerB);
    expect(m.activeLocalProfileId).not.toBe(b);
    expect([a, c]).toContain(m.activeLocalProfileId);
    expect(m.activeLocalProfileId).toBe(w.session.getState().profile?.id);
    expect((r as { ok: boolean }).ok).toBe(true);
    expect((await scanIdb(w.name)).text.meta).not.toContain(b);
  });

  it('delete of the ACTIVE profile, then a save for another profile queued before it runs: the stored activeLocalProfileId is the successor, not the deleted profile', async () => {
    const { w, a, b } = await threeProfiles('idb');
    await w.svc.switchTo(b);
    const save = await settingsSave(w, a);
    const release = block(w);
    const deleting = settle(w.svc.delete(b));
    await queued();
    const saving = settle(save());
    release();
    const [r] = await Promise.all([deleting, saving]);
    const ok = r as { ok: true; activeId: string };
    expect(ok.ok).toBe(true);
    const m = await storedMeta(w);
    expect(m.activeLocalProfileId).toBe(ok.activeId);
    expect(m.activeLocalProfileId).not.toBe(b);
    expect(w.session.getState().profile?.id).toBe(ok.activeId);
    expect(w.meta().activeLocalProfileId).toBe(ok.activeId);
  });
});

describe('[T013][FR-003] delete failure restore keeps meta changes made by queued neighbours', () => {
  it.each([['memory'], ['idb']] as const)('create("Late") queued, then a delete whose write fails (%s): the new profile\'s writer id survives and a rename of it succeeds', async (kind) => {
    const { w, b } = await threeProfiles(kind);
    await seedProfile(w, b, 'b', 1);
    const realWrite = w.repo.write;
    // Only the tombstone write fails; the create's own write goes through.
    (w.repo as { write: typeof realWrite }).write = async (ops, meta) => {
      if (ops.some((o) => (o.record as { deleted?: boolean }).deleted === true)) throw new Error('disk full');
      return realWrite(ops, meta);
    };
    const release = block(w);
    const creating = w.svc.create('Late');
    const deleting = settle(w.svc.delete(b));
    await queued();
    release();
    const [created, deleted] = await Promise.all([creating, deleting]);
    (w.repo as { write: typeof realWrite }).write = realWrite;
    expect((deleted as { ok: boolean }).ok).toBe(false);
    expect(created.ok).toBe(true);
    const id = (created as { id: string }).id;
    expect(w.meta().writerIds[id], 'writer id of the created profile still in session meta').toBeTruthy();
    expect(w.meta().writerIds[b]).toBeTruthy(); // the failed delete did not lose its own either
    expect((await w.svc.rename(id, 'Later')).ok).toBe(true);
    expect((await w.raw.loadProfile(id))!.profile.displayName).toBe('Later');
    expect(((await w.raw.loadMeta()) as Meta).writerIds[id]).toBe(w.meta().writerIds[id]);
  });
});

describe('[T013][FR-003][SC-009] a FAILING action queued behind an erase must not restore a stale meta snapshot (idb)', () => {
  type Fail = (ops: readonly { store: string; record: unknown }[]) => boolean;
  const cases: { label: string; fail: Fail; run: (w: World, ids: { a: string; c: string }) => Promise<unknown> }[] = [
    { label: 'create("Late")', fail: (ops) => ops.some((o) => o.store === 'localProfiles' && (o.record as { displayName?: string }).displayName === 'Late'), run: (w) => w.svc.create('Late') },
    { label: 'rename(A, "Renamed")', fail: (ops) => ops.some((o) => o.store === 'localProfiles' && (o.record as { displayName?: string }).displayName === 'Renamed'), run: (w, { a }) => w.svc.rename(a, 'Renamed') },
    { label: 'switchTo(C)', fail: (ops) => ops.length === 0, run: (w, { c }) => w.svc.switchTo(c) },
  ];

  it.each(cases)('erase(B) queued, then a failing $label, then a good save for A: stored meta has no writerIds[B], no ghost writer id, active stays A', async ({ fail, run }) => {
    const { w, a, b, c } = await threeProfiles('idb');
    await seedProfile(w, b, 'b', 1);
    const writerB = w.meta().writerIds[b]!;
    const realWrite = w.repo.write;
    (w.repo as { write: typeof realWrite }).write = async (ops, meta) => {
      if (fail(ops as never)) throw new Error('disk full');
      return realWrite(ops, meta);
    };
    const save = await settingsSave(w, a);
    const release = block(w);
    const erasing = settle(w.svc.erase(b));
    await queued();
    const failing = settle(run(w, { a, c })); // snapshots the meta that still has writerIds[B]
    release();
    const [e, f] = await Promise.all([erasing, failing]);
    expect((e as { ok: boolean }).ok).toBe(true);
    expect((f as { ok: boolean }).ok).toBe(false);
    (w.repo as { write: typeof realWrite }).write = realWrite;
    await save(); // a later, successful save persists whatever the session meta now is

    const m = await storedMeta(w);
    expect(m.writerIds[b]).toBeUndefined();
    expect(Object.values(m.writerIds)).not.toContain(writerB);
    expect(Object.keys(m.writerIds).sort()).toEqual([a, c].sort()); // and no writer id for a profile that was never saved
    expect(m.activeLocalProfileId).toBe(a);
    expect(w.meta().writerIds[b]).toBeUndefined();
    expect(w.meta().activeLocalProfileId).toBe(a);
    expect((await scanIdb(w.name)).text.meta).not.toContain(b);
  });
});
