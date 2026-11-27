/**
 * T013 (red, test-first): ProfileService delete (tombstone) and erase permanently [FR-003; SC-009;
 * data-model "Delete profile" / "Erase permanently"; research R8, R13; ports.ts purgeProfile contract].
 * Seam and stub signatures: see application/__tests__/profileWorld.ts.
 */
import { describe, expect, it } from 'vitest';
import { RECORD_STORES, STORES } from './ports';
import { KINDS, dump, makeWorld, preseed, scanIdb, seedProfile, threeProfiles, T0, type Meta, type Seeded, type World } from './__tests__/profileWorld';

type Rec = { id: string; localProfileId: string; created: string; updated: string; deleted: boolean; deletedBy?: string };
const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id).sort();
const live = async (w: World) => ids(await w.svc.list());
const pairs = (s: Seeded) => Object.entries(s).flatMap(([store, xs]) => xs.map((id) => `${store}:${id}`)).sort();
/** Writes that carry at least one tombstone of `pid`'s records. */
const tombstoneWrites = (w: World, pid: string) =>
  w.writes.filter((x) => x.ops.some((o) => (o.record as Rec).localProfileId === pid && (o.record as Rec).deleted));

describe.each(KINDS)('[T013][FR-003] delete profile on %s', (kind) => {
  it('tombstones EVERY record of the profile (all ten stores) with deletedBy "profile", in ONE repository write', async () => {
    const { w, a, b } = await threeProfiles(kind);
    const seeded = await seedProfile(w, b, 'b', 3);
    const original = new Map<string, Rec>();
    for (const [store, recs] of Object.entries(await dump(w, b))) for (const r of recs as Rec[]) original.set(`${store}:${r.id}`, r);
    expect([...original.keys()].sort()).toEqual(pairs(seeded)); // the fixture really spans every store
    expect(Object.keys(seeded).sort()).toEqual(['attempts', 'gear', 'instruments', 'lessonCompletion', 'localProfiles', 'onboarding', 'packs', 'pathItems', 'paths', 'profileSettings']);

    w.advance();
    const r = await w.svc.delete(b);
    expect(r.ok).toBe(true);

    const hits = tombstoneWrites(w, b);
    expect(hits).toHaveLength(1);
    const ops = hits[0]!.ops;
    expect(ops.map((o) => `${o.store}:${(o.record as Rec).id}`).sort()).toEqual(pairs(seeded));
    const writer = w.meta().writerIds[b]!;
    for (const o of ops) {
      const rec = o.record as Rec;
      const was = original.get(`${o.store}:${rec.id}`)!;
      expect(rec.deleted, `${o.store} deleted`).toBe(true);
      expect(rec.deletedBy, `${o.store} deletedBy`).toBe('profile');
      expect(rec.localProfileId).toBe(b);
      expect(rec.created).toBe(was.created);
      expect(rec.updated > was.updated, `${o.store} updated advanced`).toBe(true);
      expect(rec.updated.endsWith(`-${writer}`), `${o.store} stamped by the profile's writer`).toBe(true);
    }
    // And that is what the repository holds afterwards: every record still there, tombstoned.
    for (const [store, recs] of Object.entries(await dump(w, b))) for (const x of recs as Rec[]) expect([store, x.deleted, x.deletedBy]).toEqual([store, true, 'profile']);
    expect(a).not.toBe(b);
  });

  it('keeps an earlier user tombstone as it was (deletedBy "user" survives; R3)', async () => {
    const { w, b } = await threeProfiles(kind);
    await seedProfile(w, b, 'b', 1);
    const c = w.session.common(b);
    const old = { ...c, timestamp: '2026-11-22T13:00:00.000Z', itemKey: 'nf|n:old|6|1', outcome: 'correct', responseMs: 1, payloadHash: 'old', deleted: true, deletedBy: 'user' };
    await w.session.write([{ store: 'attempts', record: old } as never]);
    await w.svc.delete(b);
    const stored = (await w.raw.loadProfile(b))!.attempts.find((x) => x.id === old.id) as unknown as Rec;
    expect(stored.deleted).toBe(true);
    expect(stored.deletedBy).toBe('user');
    expect(stored.updated).toBe(old.updated);
  });

  it('other profiles are untouched, byte for byte', async () => {
    const { w, a, b, c } = await threeProfiles(kind);
    await seedProfile(w, a, 'a', 2);
    await seedProfile(w, b, 'b', 3);
    await seedProfile(w, c, 'c', 5);
    const [aBefore, cBefore] = [await dump(w, a), await dump(w, c)];
    await w.svc.delete(b);
    expect(await dump(w, a)).toEqual(aBefore);
    expect(await dump(w, c)).toEqual(cBefore);
    expect(await live(w)).toEqual([a, c].sort());
    expect((await w.raw.listProfiles()).find((p) => p.id === b)).toMatchObject({ deleted: true, deletedBy: 'profile' });
  });

  it('deleting the ACTIVE profile switches to another live profile: state, meta and repository agree, no trace of the deleted one in state', async () => {
    const { w, a, b, c } = await threeProfiles(kind);
    await seedProfile(w, a, 'a', 2);
    const seededB = await seedProfile(w, b, 'b', 3);
    await seedProfile(w, c, 'c', 5);
    await w.svc.switchTo(b);
    const r = (await w.svc.delete(b)) as { ok: true; activeId: string };
    expect(r.ok).toBe(true);
    expect(r.activeId).toBe(c); // the most recently updated live profile (c was created after a)
    expect(a).not.toBe(r.activeId);
    const s = w.session.getState();
    expect(s.profile?.id).toBe(r.activeId);
    expect(s.status).toBe('ready');
    expect(w.meta().activeLocalProfileId).toBe(r.activeId);
    expect(((await w.raw.loadMeta()) as Meta).activeLocalProfileId).toBe(r.activeId);
    const text = JSON.stringify(s);
    expect(text).not.toContain(b);
    for (const id of Object.values(seededB).flat()) expect(text).not.toContain(id);
    // The new active profile's data is loaded (no leftovers of the old state).
    expect(s.attempts.every((x) => x.localProfileId === r.activeId)).toBe(true);
    expect(s.attempts.length).toBeGreaterThan(0);
  });

  it('deleting a NON-active profile leaves the active profile and state alone', async () => {
    const { w, a, b } = await threeProfiles(kind);
    const state = w.session.getState();
    const r = (await w.svc.delete(b)) as { ok: true; activeId: string };
    expect(r.ok).toBe(true);
    expect(r.activeId).toBe(a);
    expect(w.session.getState().profile).toEqual(state.profile);
    expect(w.meta().activeLocalProfileId).toBe(a);
  });

  it('deleting the LAST live profile creates a new empty one and switches to it (FR-003: the app never runs without one)', async () => {
    const w = await makeWorld(kind);
    await w.svc.start();
    const old = w.session.getState().profile!.id;
    await seedProfile(w, old, 'x', 2);
    w.advance();
    const r = (await w.svc.delete(old)) as { ok: true; activeId: string };
    expect(r.ok).toBe(true);
    expect(r.activeId).not.toBe(old);
    expect(await live(w)).toEqual([r.activeId]);
    const s = w.session.getState();
    expect(s.profile).toMatchObject({ id: r.activeId, deleted: false });
    expect(s.attempts).toEqual([]);
    expect(s.instruments).toEqual([]);
    expect(s.settings?.localProfileId).toBe(r.activeId);
    expect(w.meta().writerIds[r.activeId]).toBeTruthy();
    expect(w.meta().activeLocalProfileId).toBe(r.activeId);
    expect(((await w.raw.loadMeta()) as Meta).activeLocalProfileId).toBe(r.activeId);
    expect((await w.raw.loadProfile(old))!.profile.deleted).toBe(true); // tombstoned, still there
    expect((await w.raw.loadProfile(r.activeId))!.settings).toBeDefined();
  });

  it('drains the commit queue first: a write queued before the delete lands and is tombstoned with the rest', async () => {
    const { w, b } = await threeProfiles(kind);
    await w.svc.switchTo(b);
    const late = { ...w.session.common(b), timestamp: '2026-11-22T12:45:00.000Z', itemKey: 'nf|n:late|6|1', outcome: 'correct', responseMs: 1, payloadHash: 'late' };
    void w.session.commit(() => new Promise<void>((r) => setTimeout(r, 25)));
    void w.session.write([{ store: 'attempts', record: late } as never]);
    await w.svc.delete(b);
    const stored = (await w.raw.loadProfile(b))!.attempts.find((x) => x.id === late.id) as unknown as Rec;
    expect(stored).toMatchObject({ deleted: true, deletedBy: 'profile' });
    expect(tombstoneWrites(w, b)).toHaveLength(1);
  });

  it('a failing write is all-or-nothing: the call fails, nothing is tombstoned, the active profile is unchanged', async () => {
    const { w, b } = await threeProfiles(kind);
    await seedProfile(w, b, 'b', 2);
    await w.svc.switchTo(b);
    const real = w.repo.write;
    (w.repo as { write: typeof real }).write = async () => { throw new Error('disk full'); };
    const outcome = await w.svc.delete(b).then((r) => r, () => ({ ok: false as const }));
    (w.repo as { write: typeof real }).write = real;
    expect(outcome.ok).toBe(false);
    expect(w.session.getState().profile?.id).toBe(b);
    expect(w.meta().activeLocalProfileId).toBe(b);
    expect(await live(w)).toContain(b);
    for (const recs of Object.values(await dump(w, b))) for (const x of recs as Rec[]) expect(x.deleted).toBe(false);
  });

  it('an unknown or already-tombstoned profile is refused and nothing is written', async () => {
    const { w, b } = await threeProfiles(kind);
    await w.svc.delete(b);
    const writes = w.writes.length;
    expect((await w.svc.delete(b)).ok).toBe(false);
    expect((await w.svc.delete('d0000000-0000-4000-8000-00000000000d')).ok).toBe(false);
    expect(w.writes.length).toBe(writes);
  });

  it('listDeleted() offers the tombstoned profile (so Erase permanently can be reached) and list() hides it', async () => {
    const { w, b } = await threeProfiles(kind);
    await w.svc.delete(b);
    expect(ids(await w.svc.listDeleted())).toEqual([b]);
    expect(await live(w)).not.toContain(b);
  });
});

describe.each(KINDS)('[T013][FR-003] successor of the active profile: ties on updated go to the lowest id, on %s', (kind) => {
  const P1 = '10000000-0000-4000-8000-000000000001';
  const P2 = '20000000-0000-4000-8000-000000000002';
  const P3 = '30000000-0000-4000-8000-000000000003';
  const W1 = '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const W2 = '22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const W3 = '33333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const tied = () => [
    { id: P3, writer: W3, name: 'Three', wall: T0 + 1000 },
    { id: P2, writer: W2, name: 'Two', wall: T0 + 1000 },
    { id: P1, writer: W1, name: 'One', wall: T0 + 1000 },
  ];
  it.each([['delete'], ['erase']] as const)('%s of the active profile -> the lowest id among the tied most-recent live profiles', async (op) => {
    const w = await makeWorld(kind);
    await preseed(w, [...tied(), { id: 'f0000000-0000-4000-8000-0000000000ff', writer: 'ffffffff-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Old', wall: T0 }], P3);
    await w.svc.start();
    expect(w.session.getState().profile?.id).toBe(P3);
    const r = (await w.svc[op](P3)) as { ok: true; activeId: string };
    expect(r.ok).toBe(true);
    expect(r.activeId).toBe(P1);
    expect(w.session.getState().profile?.id).toBe(P1);
    expect(w.meta().activeLocalProfileId).toBe(P1);
  });
  it('a strictly newer profile beats a lower id', async () => {
    const w = await makeWorld(kind);
    const t = tied();
    await preseed(w, [t[0]!, t[1]!, { ...t[2]!, wall: T0 - 5000 }], P3); // P1 is oldest now
    await w.svc.start();
    const r = (await w.svc.delete(P3)) as { ok: true; activeId: string };
    expect(r.activeId).toBe(P2);
  });
});

describe.each(KINDS)('[T013][FR-003] erase permanently on %s', (kind) => {
  it('calls purgeProfile once with meta stripped of writerIds[id]; nothing else in meta changes; no tombstone write', async () => {
    const { w, a, b, c } = await threeProfiles(kind);
    await seedProfile(w, b, 'b', 2);
    const before = structuredClone(w.meta());
    const writes = w.writes.length;
    const r = await w.svc.erase(b);
    expect(r.ok).toBe(true);
    expect(w.purges).toHaveLength(1);
    expect(w.purges[0]!.id).toBe(b);
    const m = w.purges[0]!.meta as Meta;
    expect(m.writerIds).toEqual({ [a]: before.writerIds[a], [c]: before.writerIds[c] });
    expect(Object.keys(m.writerIds)).not.toContain(b);
    expect(m.deviceId).toBe(before.deviceId);
    expect(m.activeLocalProfileId).toBe(a); // it did not name b, so it is not reset
    expect(w.writes.length).toBe(writes); // erase is not a tombstone write
    expect(await w.raw.loadMeta()).toEqual(w.meta());
    expect(w.meta().writerIds).toEqual(m.writerIds);
    expect(await w.raw.loadProfile(b)).toBeUndefined();
    expect(await live(w)).toEqual([a, c].sort());
  });

  it('leaves the other profiles byte for byte unchanged', async () => {
    const { w, a, b, c } = await threeProfiles(kind);
    await seedProfile(w, a, 'a', 2);
    await seedProfile(w, b, 'b', 3);
    await seedProfile(w, c, 'c', 5);
    const [aBefore, cBefore] = [await dump(w, a), await dump(w, c)];
    await w.svc.erase(b);
    expect(await dump(w, a)).toEqual(aBefore);
    expect(await dump(w, c)).toEqual(cBefore);
  });

  it('erasing the ACTIVE profile resets activeLocalProfileId (never left naming it) and moves to another live profile', async () => {
    const { w, a, b, c } = await threeProfiles(kind);
    await seedProfile(w, c, 'c', 2);
    await w.svc.switchTo(b);
    const r = (await w.svc.erase(b)) as { ok: true; activeId: string };
    expect(r.ok).toBe(true);
    expect(w.purges[0]!.meta.writerIds[b]).toBeUndefined();
    expect((w.purges[0]!.meta as Meta).activeLocalProfileId).not.toBe(b);
    expect(r.activeId).toBe(c); // the most recently updated live profile
    expect(a).not.toBe(c);
    expect(w.session.getState().profile?.id).toBe(r.activeId);
    expect(w.meta().activeLocalProfileId).toBe(r.activeId);
    expect(((await w.raw.loadMeta()) as Meta).activeLocalProfileId).toBe(r.activeId);
    expect(JSON.stringify(w.session.getState())).not.toContain(b);
  });

  it('works on a profile that was deleted first (tombstones included are purged)', async () => {
    const { w, b } = await threeProfiles(kind);
    await seedProfile(w, b, 'b', 3);
    await w.svc.delete(b);
    expect(ids(await w.svc.listDeleted())).toEqual([b]);
    const r = await w.svc.erase(b);
    expect(r.ok).toBe(true);
    expect(await w.raw.loadProfile(b)).toBeUndefined();
    expect(await w.svc.listDeleted()).toEqual([]);
    expect((await w.raw.listProfiles()).map((p) => p.id)).not.toContain(b);
    expect(w.meta().writerIds[b]).toBeUndefined();
  });

  it('erasing the LAST profile creates a new empty default one and activates it', async () => {
    const w = await makeWorld(kind);
    await w.svc.start();
    const old = w.session.getState().profile!.id;
    await seedProfile(w, old, 'x', 2);
    const r = (await w.svc.erase(old)) as { ok: true; activeId: string };
    expect(r.ok).toBe(true);
    expect(r.activeId).not.toBe(old);
    expect(await live(w)).toEqual([r.activeId]);
    expect(await w.raw.loadProfile(old)).toBeUndefined();
    expect(w.meta().activeLocalProfileId).toBe(r.activeId);
    expect(w.meta().writerIds[old]).toBeUndefined();
    expect(w.meta().writerIds[r.activeId]).toBeTruthy();
    expect(((await w.raw.loadMeta()) as Meta).activeLocalProfileId).toBe(r.activeId);
    expect(w.session.getState().attempts).toEqual([]);
  });

  it('an unknown id is refused: nothing purged, nothing written', async () => {
    const { w } = await threeProfiles(kind);
    const writes = w.writes.length;
    expect((await w.svc.erase('d0000000-0000-4000-8000-00000000000d')).ok).toBe(false);
    expect(w.purges).toHaveLength(0);
    expect(w.writes.length).toBe(writes);
  });

  it('drains the commit queue first: a write queued before the erase cannot resurrect the profile', async () => {
    const { w, b } = await threeProfiles(kind);
    await w.svc.switchTo(b);
    const late = { ...w.session.common(b), timestamp: '2026-11-22T12:45:00.000Z', itemKey: 'nf|n:late|6|1', outcome: 'correct', responseMs: 1, payloadHash: 'late' };
    void w.session.commit(() => new Promise<void>((r) => setTimeout(r, 25)));
    void w.session.write([{ store: 'attempts', record: late } as never]);
    await w.svc.erase(b);
    expect(await w.raw.loadProfile(b)).toBeUndefined();
    expect(JSON.stringify(await w.raw.loadMeta())).not.toContain(b);
  });
});

describe('[T013][FR-003][SC-009] erase leaves nothing: every IndexedDB store and meta, read directly', () => {
  const NAME = 'Zebra Quartz'; // unique, so a hit can only be the erased profile's display name
  type Case = { label: string; deleteFirst: boolean; active: boolean };
  const cases: Case[] = [
    { label: 'a live, non-active profile', deleteFirst: false, active: false },
    { label: 'a live, ACTIVE profile', deleteFirst: false, active: true },
    { label: 'a deleted (tombstoned) profile', deleteFirst: true, active: false },
  ];

  it.each(cases)('[SC-009] 0 hits for id, writer id and display name after erasing $label', async ({ deleteFirst, active }) => {
    const { w, a, b, c } = await threeProfiles('idb');
    await w.svc.rename(b, NAME);
    const seeded = await seedProfile(w, b, 'b', 3);
    const keep = [await seedProfile(w, a, 'a', 2), await seedProfile(w, c, 'c', 4)];
    const writer = w.meta().writerIds[b]!;
    const needles = { id: b, writer, name: NAME, ...Object.fromEntries(Object.values(seeded).flat().map((x, i) => [`rec${i}`, x])) };
    if (active) await w.svc.switchTo(b);

    // Guard against a vacuous scan: before the erase the scan MUST find the profile.
    const pre = await scanIdb(w.name);
    expect(pre.text.localProfiles).toContain(b);
    expect(pre.text.localProfiles).toContain(NAME);
    expect(pre.text.meta).toContain(b);
    expect(pre.text.meta).toContain(writer);

    if (deleteFirst) await w.svc.delete(b);
    expect((await w.svc.erase(b)).ok).toBe(true);

    const post = await scanIdb(w.name);
    expect(post.stores.sort()).toEqual([...STORES].sort()); // every store was scanned, none skipped
    for (const [what, needle] of Object.entries(needles)) {
      for (const [store, text] of Object.entries(post.text)) expect(text, `${what} found in ${store}`).not.toContain(needle);
    }
    // The survivors are intact.
    for (const [pid, s] of [[a, keep[0]!], [c, keep[1]!]] as const) {
      expect(Object.entries(await dump(w, pid)).map(([k, v]) => `${k}:${(v as { id: string }[]).length}`).sort())
        .toEqual(Object.entries(s).map(([k, v]) => `${k}:${v.length}`).sort());
    }
    expect(JSON.parse(post.text.meta!).vals[0].writerIds).toEqual({ [a]: w.meta().writerIds[a], [c]: w.meta().writerIds[c] });
  });

  it('[SC-009] erasing the LAST profile leaves no trace of it either (the replacement default is a different profile)', async () => {
    const w = await makeWorld('idb');
    await w.svc.start();
    const old = w.session.getState().profile!.id;
    await w.svc.rename(old, NAME);
    const seeded = await seedProfile(w, old, 'x', 3);
    const writer = w.meta().writerIds[old]!;
    expect((await w.svc.erase(old)).ok).toBe(true);
    const post = await scanIdb(w.name);
    for (const needle of [old, writer, NAME, ...Object.values(seeded).flat()]) {
      for (const [store, text] of Object.entries(post.text)) expect(text, `${needle} in ${store}`).not.toContain(needle);
    }
    expect(await live(w)).toHaveLength(1);
  });
});

describe.each(KINDS)('[T013][FR-003] erase ordering and the purge-then-default gap on %s', (kind) => {
  it('(c) a write queued just before the erase completes BEFORE the purge is issued', async () => {
    const { w, b } = await threeProfiles(kind);
    await w.svc.switchTo(b);
    const late = { ...w.session.common(b), timestamp: '2026-11-22T12:50:00.000Z', itemKey: 'nf|n:late|6|2', outcome: 'correct', responseMs: 1, payloadHash: 'late2' };
    const from = w.events.length;
    void w.session.write([{ store: 'attempts', record: late } as never]); // started, not awaited
    await w.svc.erase(b);
    const seq = w.events.slice(from);
    expect(seq.indexOf('write')).toBeGreaterThanOrEqual(0);
    expect(seq.indexOf('write')).toBeLessThan(seq.indexOf('purge'));
    expect(await w.raw.loadProfile(b)).toBeUndefined();
    expect(JSON.stringify(await w.raw.loadMeta())).not.toContain(b);
  });

  it('(d) erasing a NON-active profile: exactly one purge, zero writes, active state unchanged', async () => {
    const { w, a, b } = await threeProfiles(kind);
    await seedProfile(w, a, 'a', 2);
    await w.svc.switchTo(a);
    const state = w.session.getState();
    const from = w.events.length;
    expect((await w.svc.erase(b)).ok).toBe(true);
    expect(w.events.slice(from)).toEqual(['purge']);
    expect(w.purges).toHaveLength(1);
    expect(w.session.getState()).toEqual(state);
    expect(w.meta().activeLocalProfileId).toBe(a);
  });

  it('(b) the write that follows an erase (default profile / switch) carries a meta WITHOUT the erased writer id', async () => {
    for (const last of [true, false]) {
      const { w, b } = await threeProfiles(kind);
      let victim = b;
      if (last) { // erase every other profile first so b is the last one
        for (const p of await w.svc.list()) if (p.id !== b) await w.svc.erase(p.id);
      }
      await w.svc.switchTo(victim);
      const writer = w.meta().writerIds[victim]!;
      const from = w.events.length;
      const writesFrom = w.writes.length;
      await w.svc.erase(victim);
      const seq = w.events.slice(from);
      expect(seq[0]).toBe('purge');
      const after = w.writes.slice(writesFrom);
      expect(after.length).toBeGreaterThanOrEqual(1);
      for (const x of after) {
        expect(Object.values(x.meta.writerIds)).not.toContain(writer);
        expect(x.meta.writerIds[victim]).toBeUndefined();
        expect(JSON.stringify(x.meta)).not.toContain(victim);
      }
      expect(Object.values(w.purges.at(-1)!.meta.writerIds)).not.toContain(writer);
      victim = '';
    }
  });
});

describe('[T013][FR-003][SC-009] crash gap: the first write after the purge fails, then the app restarts (idb)', () => {
  const failAfterPurge = (w: Awaited<ReturnType<typeof makeWorld>>) => {
    const real = w.repo.purgeProfile;
    (w.repo as { purgeProfile: typeof real }).purgeProfile = async (id, meta) => {
      await real(id, meta);
      (w.repo as { write: unknown }).write = async () => { throw new Error('crashed after purge'); };
    };
  };

  it.each([['the LAST profile'], ['the ACTIVE profile (others remain)']])('erase of %s, then a fresh start() recovers with nothing of the erased profile left', async (label) => {
    const last = label.includes('LAST');
    const w = await makeWorld('idb');
    await w.svc.start();
    const victim = w.session.getState().profile!.id;
    await w.svc.rename(victim, 'Zebra Quartz');
    let survivors: string[] = [];
    if (!last) {
      survivors = [((await w.svc.create('Bo')) as { id: string }).id, ((await w.svc.create('Cy')) as { id: string }).id];
    }
    const seeded = await seedProfile(w, victim, 'x', 2);
    const writer = w.meta().writerIds[victim]!;
    failAfterPurge(w);
    await w.svc.erase(victim).then(() => undefined, () => undefined); // may reject or return ok:false; both are fine

    // Restart: a fresh session and service over the same database.
    const w2 = await makeWorld('idb', { dbName: w.name, idBase: 0x9000 });
    await w2.svc.start();
    const liveIds = ids(await w2.svc.list());
    if (last) {
      expect(liveIds).toHaveLength(1);
      expect(liveIds).not.toContain(victim);
    } else {
      expect(liveIds).toEqual([...survivors].sort());
    }
    expect(w2.session.getState().status).toBe('ready');
    expect(w2.session.getState().profile?.id).not.toBe(victim);
    expect(w2.meta().writerIds[victim]).toBeUndefined();
    const stored = (await w2.raw.loadMeta()) as Meta;
    expect(stored.writerIds[victim]).toBeUndefined();
    expect(Object.values(stored.writerIds)).not.toContain(writer);
    expect(stored.activeLocalProfileId).not.toBe(victim);
    const scan = await scanIdb(w.name);
    for (const s of RECORD_STORES) {
      for (const needle of [victim, writer, 'Zebra Quartz', ...Object.values(seeded).flat()]) expect(scan.text[s], `${needle} in ${s}`).not.toContain(needle);
    }
    expect(scan.text.meta).not.toContain(victim);
    expect(scan.text.meta).not.toContain(writer);
  });
});
