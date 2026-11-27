/**
 * T012 (red, test-first): ProfileService create / rename / switch / startup fallback + SC-001 isolation
 * [FR-001, FR-002; data-model "meta", "localProfiles", "Lifecycle and state rules"; research R13].
 * Seam and stub signatures: see application/__tests__/profileWorld.ts.
 * Expected values come from the spec text and from independent seeding (ids and tags written by the test),
 * never from the implementation.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { KINDS, dump, makeWorld, preseed, seedProfile, threeProfiles, T0, type Meta, type Seeded, type World } from './__tests__/profileWorld';

const WA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PA = 'a0000000-0000-4000-8000-00000000000a';
const PB = 'b0000000-0000-4000-8000-00000000000b';
const PC = 'c0000000-0000-4000-8000-00000000000c';
const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id).sort();
const live = async (w: World) => ids(await w.svc.list());

describe.each(KINDS)('[T012][FR-001] startup fallback (data-model lifecycle) on %s', (kind) => {
  const trio = [
    { id: PA, writer: WA, name: 'Ann', wall: T0 + 1000 },
    { id: PB, writer: WB, name: 'Bo', wall: T0 + 3000 }, // most recently updated live profile
    { id: PC, writer: WC, name: 'Cy', wall: T0 + 2000 },
  ];

  it('meta.activeLocalProfileId naming a live profile wins over recency', async () => {
    const w = await makeWorld(kind);
    await preseed(w, trio, PA);
    await w.svc.start();
    expect(w.session.getState().status).toBe('ready');
    expect(w.session.getState().profile?.id).toBe(PA);
    expect(w.meta().activeLocalProfileId).toBe(PA);
  });

  it('absent -> the most recently updated live profile', async () => {
    const w = await makeWorld(kind);
    await preseed(w, trio);
    await w.svc.start();
    expect(w.session.getState().profile?.id).toBe(PB);
    expect(w.meta().activeLocalProfileId).toBe(PB);
  });

  it('naming a tombstoned profile -> the most recently updated LIVE profile (a newer tombstone is skipped)', async () => {
    const w = await makeWorld(kind);
    await preseed(w, [trio[0]!, trio[2]!, { id: PB, writer: WB, name: 'Bo', wall: T0 + 9000, deleted: true }], PB);
    await w.svc.start();
    expect(w.session.getState().profile?.id).toBe(PC);
    expect(w.meta().activeLocalProfileId).toBe(PC);
  });

  it('ties on updated are broken by the LOWEST id (absent or tombstoned active id)', async () => {
    const tie = [{ id: PC, writer: WC, name: 'Cy', wall: T0 + 5000 }, { id: PB, writer: WB, name: 'Bo', wall: T0 + 5000 }, { id: PA, writer: WA, name: 'Ann', wall: T0 + 5000 }];
    const absent = await makeWorld(kind);
    await preseed(absent, tie);
    await absent.svc.start();
    expect(absent.session.getState().profile?.id).toBe(PA);
    const tomb = await makeWorld(kind);
    await preseed(tomb, [tie[0]!, tie[1]!, { id: PA, writer: WA, name: 'Ann', wall: T0 + 5000, deleted: true }], PA);
    await tomb.svc.start();
    expect(tomb.session.getState().profile?.id).toBe(PB);
  });

  it('naming a profile that does not exist -> the most recently updated live profile', async () => {
    const w = await makeWorld(kind);
    await preseed(w, trio, 'd0000000-0000-4000-8000-00000000000d');
    await w.svc.start();
    expect(w.session.getState().profile?.id).toBe(PB);
  });

  it('the fallback choice is persisted, so the next start opens the same profile', async () => {
    const w = await makeWorld(kind);
    await preseed(w, trio);
    await w.svc.start();
    expect(((await w.raw.loadMeta()) as Meta).activeLocalProfileId).toBe(PB);
  });

  it('no profiles at all -> creates one live default profile, its settings and its writer id (001 bootstrap)', async () => {
    const w = await makeWorld(kind);
    await w.svc.start();
    const s = w.session.getState();
    expect(s.status).toBe('ready');
    expect(s.durable).toBe(w.repo.durable);
    const p = s.profile!;
    expect(p.deleted).toBe(false);
    expect(p.displayName.length).toBeGreaterThan(0);
    expect(p.localProfileId).toBe(p.id);
    expect(s.settings?.localProfileId).toBe(p.id);
    expect(w.meta().writerIds[p.id]).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
    expect(w.meta().activeLocalProfileId).toBe(p.id);
    const stored = await w.raw.loadMeta();
    expect(stored).toEqual(w.meta());
    expect((await w.raw.listProfiles()).map((x) => x.id)).toEqual([p.id]);
    expect((await w.raw.loadProfile(p.id))!.settings).toBeDefined();
  });

  it('every profile tombstoned -> creates a NEW live profile (the tombstoned ones stay tombstoned)', async () => {
    const w = await makeWorld(kind);
    await preseed(w, trio.map((p) => ({ ...p, deleted: true })), PA);
    await w.svc.start();
    const id = w.session.getState().profile!.id;
    expect([PA, PB, PC]).not.toContain(id);
    expect(await live(w)).toEqual([id]);
    expect((await w.raw.listProfiles()).filter((p) => p.deleted).map((p) => p.id).sort()).toEqual([PA, PB, PC]);
  });

  it('a stored profile with no writer id on this device (v0.1 upgrade) gets one', async () => {
    const w = await makeWorld(kind);
    await preseed(w, [trio[0]!]);
    await w.raw.write([], { deviceId: 'dev-0', writerIds: {}, hlc: { wall: T0, counter: 0 } });
    await w.svc.start();
    expect(w.meta().writerIds[PA]).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
    expect(() => w.session.stamp(PA)).not.toThrow();
  });

  it('start() loads the active profile\'s data into state', async () => {
    const w = await makeWorld(kind);
    await w.svc.start();
    const pid = w.session.getState().profile!.id;
    const seeded = await seedProfile(w, pid, 'a', 2);
    const w2 = await makeWorld(kind, { dbName: w.name, idBase: 0x9000, raw: w.raw }); // "reload": same storage (idb name / shared memory repo), fresh session
    await w2.svc.start();
    const s = w2.session.getState();
    expect(s.profile?.id).toBe(pid);
    expect(ids(s.instruments)).toEqual(seeded.instruments!.sort());
    expect(ids(s.attempts)).toEqual(seeded.attempts!.sort());
    expect(ids(s.completion)).toEqual(seeded.lessonCompletion!.sort());
  });
});

describe.each(KINDS)('[T012][FR-001] create on %s', (kind) => {
  it('creates a live profile with the common fields, a fresh writer id and default settings, in ONE repository write', async () => {
    const w = await makeWorld(kind);
    await w.svc.start();
    const before = w.writes.length;
    const writersBefore = new Set(Object.values(w.meta().writerIds));
    w.advance();
    const r = await w.svc.create('Sam');
    expect(r.ok).toBe(true);
    const id = (r as { id: string }).id;
    expect(w.writes.length - before).toBe(1);
    const rec = (await w.raw.loadProfile(id))!;
    expect(rec.profile).toMatchObject({ id, localProfileId: id, displayName: 'Sam', schemaVersion: 1, deleted: false });
    expect(rec.profile.created).toBe(rec.profile.updated);
    const writer = w.meta().writerIds[id]!;
    expect(writer).toBeTruthy();
    expect(writersBefore.has(writer)).toBe(false);
    expect(rec.profile.created.endsWith(`-${writer}`)).toBe(true);
    expect(rec.settings).toMatchObject({ localProfileId: id, schemaVersion: 2, activeInstrumentId: null, deleted: false });
    // The new meta (with the writer id) went into the SAME write.
    expect((w.writes.at(-1)!.meta as Meta).writerIds[id]).toBe(writer);
    expect(await w.raw.loadMeta()).toEqual(w.meta());
  });

  it('does not switch: the active profile and its state are unchanged (US1 scenario 1: the default is unchanged)', async () => {
    const w = await makeWorld(kind);
    await w.svc.start();
    const active = w.session.getState().profile!;
    const meta = w.meta().activeLocalProfileId;
    await w.svc.create('Sam');
    expect(w.session.getState().profile).toEqual(active);
    expect(w.meta().activeLocalProfileId).toBe(meta);
  });

  it('trims the name; list() shows live profiles only, and the new one is among them', async () => {
    const w = await makeWorld(kind);
    await w.svc.start();
    const r = (await w.svc.create('  Sam  ')) as { ok: true; id: string };
    expect((await w.raw.loadProfile(r.id))!.profile.displayName).toBe('Sam');
    expect(await live(w)).toContain(r.id);
    expect((await w.svc.list()).length).toBe(2);
  });

  it('duplicate display names are allowed: create("Sam") twice makes two profiles with distinct ids', async () => {
    const w = await makeWorld(kind);
    await w.svc.start();
    const one = (await w.svc.create('Sam')) as { ok: true; id: string };
    const two = (await w.svc.create('Sam')) as { ok: true; id: string };
    expect(one.ok && two.ok).toBe(true);
    expect(one.id).not.toBe(two.id);
    const sams = (await w.svc.list()).filter((p) => p.displayName === 'Sam');
    expect(ids(sams)).toEqual([one.id, two.id].sort());
  });

  it('a decomposed name is stored NFC: create("Jose\\u0301") stores "Jos\\u00e9" (create and rename)', async () => {
    const w = await makeWorld(kind);
    await w.svc.start();
    const r = (await w.svc.create('José')) as { ok: true; id: string };
    expect(r.ok).toBe(true);
    const stored = (await w.raw.loadProfile(r.id))!.profile.displayName;
    expect(stored).toBe('José');
    expect(stored.length).toBe(4);
    const id = w.session.getState().profile!.id;
    expect((await w.svc.rename(id, 'Renée')).ok).toBe(true);
    expect((await w.raw.loadProfile(id))!.profile.displayName).toBe('Renée');
  });

  it('accepts a 60-character name and rejects 61', async () => {
    const w = await makeWorld(kind);
    await w.svc.start();
    expect((await w.svc.create('x'.repeat(60))).ok).toBe(true);
    const bad = await w.svc.create('x'.repeat(61));
    expect(bad.ok).toBe(false);
  });

  it.each([['empty', ''], ['spaces', '   '], ['tab and newline', '\t\n'], ['NBSP and ideographic space', ' 　'], ['NUL inside', 'a\u0000b'], ['bidi override', 'x‮y'], ['zero-width space', 'a​b']])(
    '[T012][FR-001] rejects an invalid name (%s) with a reason and writes nothing',
    async (_label, name) => {
      const w = await makeWorld(kind);
      await w.svc.start();
      const writes = w.writes.length;
      const writers = { ...w.meta().writerIds };
      const profiles = await live(w);
      const r = await w.svc.create(name);
      expect(r.ok).toBe(false);
      expect(typeof (r as { reason: string }).reason).toBe('string');
      expect((r as { reason: string }).reason.length).toBeGreaterThan(0);
      expect(w.writes.length).toBe(writes);
      expect(w.meta().writerIds).toEqual(writers);
      expect(await live(w)).toEqual(profiles);
    },
  );

  it('property: any whitespace-only name is rejected and never stored', async () => {
    const w = await makeWorld(kind);
    await w.svc.start();
    const ws = fc.stringMatching(/^[ \t\n\r 　 ]*$/);
    await fc.assert(fc.asyncProperty(ws, async (name) => {
      expect((await w.svc.create(name)).ok).toBe(false);
    }), { numRuns: 50 });
    expect((await w.svc.list()).length).toBe(1);
  });

  it('a storage failure rejects the create and leaves no profile or writer id behind', async () => {
    const w = await makeWorld(kind);
    await w.svc.start();
    const real = w.repo.write;
    (w.repo as { write: typeof real }).write = async () => { throw new Error('disk full'); };
    const writers = { ...w.meta().writerIds };
    const outcome = await w.svc.create('Sam').then((r) => r, () => ({ ok: false as const }));
    (w.repo as { write: typeof real }).write = real;
    expect(outcome.ok).toBe(false);
    expect(await w.svc.list()).toHaveLength(1);
    expect(w.meta().writerIds).toEqual(writers);
  });
});

describe.each(KINDS)('[T012][FR-001] rename on %s', (kind) => {
  it('updates displayName and the updated stamp (created kept), stamped by THAT profile\'s writer, in one write', async () => {
    const { w, b } = await threeProfiles(kind);
    const before = (await w.raw.loadProfile(b))!.profile;
    const writes = w.writes.length;
    w.advance();
    const r = await w.svc.rename(b, '  Bobby ');
    expect(r.ok).toBe(true);
    expect(w.writes.length - writes).toBe(1);
    const after = (await w.raw.loadProfile(b))!.profile;
    expect(after).toMatchObject({ id: b, displayName: 'Bobby', created: before.created, deleted: false });
    expect(after.updated > before.updated).toBe(true);
    expect(after.updated.endsWith(`-${w.meta().writerIds[b]}`)).toBe(true);
  });

  it('renaming the ACTIVE profile updates state.profile; renaming another does not touch it', async () => {
    const { w, a, b } = await threeProfiles(kind);
    await w.svc.rename(a, 'Alpha');
    expect(w.session.getState().profile).toMatchObject({ id: a, displayName: 'Alpha' });
    const active = w.session.getState().profile;
    await w.svc.rename(b, 'Beta');
    expect(w.session.getState().profile).toEqual(active);
  });

  it('notifies subscribers', async () => {
    const { w, a } = await threeProfiles(kind);
    let calls = 0;
    w.session.subscribe(() => { calls++; });
    await w.svc.rename(a, 'Alpha');
    expect(calls).toBeGreaterThan(0);
  });

  it('leaves every other profile byte-for-byte unchanged', async () => {
    const { w, a, b, c } = await threeProfiles(kind);
    await seedProfile(w, b, 'b', 2);
    await seedProfile(w, c, 'c', 3);
    const [bBefore, cBefore] = [await dump(w, b), await dump(w, c)];
    await w.svc.rename(a, 'Alpha');
    expect(await dump(w, b)).toEqual(bBefore);
    expect(await dump(w, c)).toEqual(cBefore);
  });

  it.each([['empty', ''], ['whitespace only', '  \t '], ['61 characters', 'y'.repeat(61)], ['control character', 'a\u0007b']])(
    'rejects an invalid name (%s): reason returned, old name kept, nothing written',
    async (_l, name) => {
      const { w, a } = await threeProfiles(kind);
      const writes = w.writes.length;
      const old = w.session.getState().profile!;
      const r = await w.svc.rename(a, name);
      expect(r.ok).toBe(false);
      expect((r as { reason: string }).reason.length).toBeGreaterThan(0);
      expect(w.writes.length).toBe(writes);
      expect((await w.raw.loadProfile(a))!.profile).toEqual(old);
      expect(w.session.getState().profile).toEqual(old);
    },
  );

  it('an unknown or tombstoned profile id is refused and nothing is written', async () => {
    const { w, b } = await threeProfiles(kind);
    await w.svc.delete(b);
    const writes = w.writes.length;
    expect((await w.svc.rename(b, 'Zed')).ok).toBe(false);
    expect((await w.svc.rename('d0000000-0000-4000-8000-00000000000d', 'Zed')).ok).toBe(false);
    expect(w.writes.length).toBe(writes);
  });
});

describe.each(KINDS)('[T012][FR-001,FR-002] switch on %s', (kind) => {
  it('updates meta.activeLocalProfileId (session and repository) and loads the target\'s data into state', async () => {
    const { w, a, b } = await threeProfiles(kind);
    const seeded = await seedProfile(w, b, 'b', 2);
    const r = await w.svc.switchTo(b);
    expect(r.ok).toBe(true);
    const s = w.session.getState();
    expect(s.status).toBe('ready');
    expect(s.profile?.id).toBe(b);
    expect(s.settings?.localProfileId).toBe(b);
    expect(ids(s.instruments)).toEqual(seeded.instruments!.sort());
    expect(ids(s.attempts)).toEqual(seeded.attempts!.sort());
    expect(w.meta().activeLocalProfileId).toBe(b);
    expect(((await w.raw.loadMeta()) as Meta).activeLocalProfileId).toBe(b);
    expect(s.profile?.id).not.toBe(a);
  });

  it('after a switch, new records are stamped with the TARGET profile\'s writer id (R13)', async () => {
    const { w, b } = await threeProfiles(kind);
    await w.svc.switchTo(b);
    const c = w.session.common(b);
    expect(c.created.endsWith(`-${w.meta().writerIds[b]}`)).toBe(true);
    expect(c.localProfileId).toBe(b);
  });

  it('switching to the profile that is already active succeeds and changes nothing', async () => {
    const { w, a } = await threeProfiles(kind);
    const before = w.session.getState();
    expect((await w.svc.switchTo(a)).ok).toBe(true);
    expect(w.session.getState().profile).toEqual(before.profile);
    expect(w.meta().activeLocalProfileId).toBe(a);
  });

  it('an unknown id, or a tombstoned profile, is refused: state, meta and repository unchanged', async () => {
    const { w, a, b } = await threeProfiles(kind);
    await w.svc.delete(b);
    const writes = w.writes.length;
    const state = w.session.getState();
    for (const id of [b, 'd0000000-0000-4000-8000-00000000000d']) {
      const r = await w.svc.switchTo(id);
      expect(r.ok).toBe(false);
      expect((r as { reason: string }).reason.length).toBeGreaterThan(0);
    }
    expect(w.session.getState()).toEqual(state);
    expect(w.meta().activeLocalProfileId).toBe(a);
    expect(w.writes.length).toBe(writes);
  });

  it('drains the commit queue first (R13): a queued write for the OLD profile lands, then the state swaps', async () => {
    const { w, a, b } = await threeProfiles(kind);
    const order: string[] = [];
    const attempt = { ...w.session.common(a), timestamp: '2026-11-22T12:30:00.000Z', itemKey: 'nf|n:late|6|1', outcome: 'correct', responseMs: 1, payloadHash: 'late' };
    // A slow commit that is still pending when switchTo is called.
    void w.session.commit(async () => { await new Promise((r) => setTimeout(r, 25)); order.push('slow-commit'); });
    void w.session.write([{ store: 'attempts', record: attempt } as never]).then(() => order.push('attempt-written'));
    const switching = w.svc.switchTo(b).then(() => order.push('switched'));
    await switching;
    expect(order).toEqual(['slow-commit', 'attempt-written', 'switched']);
    expect((await w.raw.loadProfile(a))!.attempts.map((x) => x.id)).toContain(attempt.id);
    expect(w.session.getState().profile?.id).toBe(b);
    expect(w.session.getState().attempts.map((x) => x.id)).not.toContain(attempt.id);
    // The queued write used the pre-switch meta; the switch's own write lands after it, so the stored meta names b.
    expect(((await w.raw.loadMeta()) as Meta).activeLocalProfileId).toBe(b);
  });

  it('FR-002: no observable state ever mixes profiles during a switch', async () => {
    const { w, a, b, c } = await threeProfiles(kind);
    await seedProfile(w, a, 'a', 2);
    await seedProfile(w, b, 'b', 3);
    await seedProfile(w, c, 'c', 5);
    await w.svc.switchTo(a);
    const snapshots: ReturnType<typeof w.session.getState>[] = [];
    w.session.subscribe(() => snapshots.push(w.session.getState()));
    await w.svc.switchTo(b);
    await w.svc.switchTo(c);
    await w.svc.switchTo(a);
    expect(snapshots.length).toBeGreaterThan(0);
    for (const s of snapshots) {
      const owner = s.profile?.id;
      for (const r of [...s.instruments, ...s.attempts, ...s.completion, ...(s.settings ? [s.settings] : [])]) expect(r.localProfileId).toBe(owner);
    }
  });
});

describe.each(KINDS)('[T012][FR-001,FR-002] SC-001 isolation over 3 profiles on %s', (kind) => {
  const tags = (xs: readonly { name?: string }[]) => xs.map((x) => x.name);

  it('state, stored data and stats show only the ACTIVE profile\'s data, whatever the switch order', async () => {
    const { w, a, b, c } = await threeProfiles(kind);
    const plan: [string, string, number][] = [[a, 'a', 2], [b, 'b', 3], [c, 'c', 5]];
    const seeded: Record<string, Seeded> = {};
    for (const [pid, tag, n] of plan) seeded[pid] = await seedProfile(w, pid, tag, n);
    const all = new Set(plan.map(([pid]) => pid));
    const names: Record<string, string> = { [a]: (await w.raw.loadProfile(a))!.profile.displayName, [b]: 'Bo', [c]: 'Cy' };

    for (const [pid, tag, n] of [plan[1]!, plan[2]!, plan[0]!, plan[2]!, plan[1]!, plan[0]!]) {
      expect((await w.svc.switchTo(pid)).ok).toBe(true);
      const s = w.session.getState();
      expect(s.profile).toMatchObject({ id: pid, displayName: names[pid] });
      // state: exactly this profile's records, by id and by content
      expect(ids(s.instruments)).toEqual([...seeded[pid]!.instruments!]);
      expect(tags(s.instruments)).toEqual([`Inst-${tag}`]);
      expect(ids(s.attempts)).toEqual([...seeded[pid]!.attempts!].sort());
      expect(s.attempts.every((x) => x.itemKey.includes(`n:${tag}|`))).toBe(true);
      expect(s.completion.map((x) => x.lessonId)).toEqual([`lesson-${tag}`]);
      // stats: counts derived from state differ per profile (a: 1 correct of 2, b: 2 of 3, c: 3 of 5)
      expect(s.attempts).toHaveLength(n);
      expect(s.attempts.filter((x) => x.outcome === 'correct')).toHaveLength(Math.ceil(n / 2));
      // nothing of another profile appears anywhere in the serialised state
      const text = JSON.stringify(s);
      for (const other of all) if (other !== pid) expect(text).not.toContain(other);
      for (const [, t] of plan) if (t !== tag) expect(text).not.toMatch(new RegExp(`(Inst|lesson|pack|Path|Gear)-${t}\\b|n:${t}\\|`));
    }
  });

  it('the repository keeps each profile\'s records under its own localProfileId (no record belongs to two profiles)', async () => {
    const { w, a, b, c } = await threeProfiles(kind);
    for (const [pid, tag, n] of [[a, 'a', 2], [b, 'b', 3], [c, 'c', 5]] as const) await seedProfile(w, pid, tag, n);
    const seen = new Map<string, string>();
    for (const pid of [a, b, c]) {
      for (const [store, recs] of Object.entries(await dump(w, pid))) {
        for (const r of recs as { id: string; localProfileId: string }[]) {
          expect(r.localProfileId, `${store} ${r.id}`).toBe(pid);
          expect(seen.has(`${store}:${r.id}`), `${store} ${r.id} in two profiles`).toBe(false);
          seen.set(`${store}:${r.id}`, pid);
        }
      }
    }
  });

  it('list() returns exactly the three live profiles', async () => {
    const { w, a, b, c } = await threeProfiles(kind);
    expect(await live(w)).toEqual([a, b, c].sort());
  });
});
