/**
 * T015 (red): ProfileService.previewImport / applyImport (modes restore, create, copy) [FR-004, FR-019, FR-020;
 * SC-005 round trip; SC-006 hostile files; research R3 restoreApply, R6; data-model §3-§4].
 * Seam and stub signatures: see application/__tests__/profileFile.ts.
 */
import { describe, expect, it } from 'vitest';
import { HLC_PATTERN } from '../domain/records';
import { KINDS, dump, makeWorld, scanIdb, threeProfiles, type Kind, type World } from './__tests__/profileWorld';
import {
  FILE_PID, FILE_WRITER, expectPlainSafeReason, everythingAsText, fileIds, hostileFixtures, seedValid, text, validFileV1, validFileV2, walkStrings, writerIdsIn,
} from './__tests__/profileFile';

type R = { id: string; localProfileId: string; created: string; updated: string; deleted: boolean; deletedBy?: string } & Record<string, unknown>;
const byId = (xs: unknown[]) => [...(xs as R[])].sort((x, y) => (x.id < y.id ? -1 : 1));
const apply = (w: World, body: string, mode: 'restore' | 'create' | 'copy') => (w.svc as any).applyImport(body, mode); // eslint-disable-line @typescript-eslint/no-explicit-any
const preview = (w: World, body: string, mode: 'restore' | 'create' | 'copy') => (w.svc as any).previewImport(body, mode); // eslint-disable-line @typescript-eslint/no-explicit-any
const exportText = async (w: World, id: string): Promise<string> => {
  const r = await (w.svc as any).exportProfile(id); // eslint-disable-line @typescript-eslint/no-explicit-any
  expect(r.ok, r.ok ? '' : r.reason).toBe(true);
  return r.text as string;
};
/** A world with ONE profile `b` (seeded) whose export is returned; the source device. */
async function source(kind: Kind, tag = 'src') {
  const { w, b } = await threeProfiles(kind);
  const seeded = await seedValid(w, b, tag);
  return { w, b, seeded, body: await exportText(w, b) };
}
/** A different device: fresh world with its own default profile; its generated ids never equal the source's. */
const device2 = async (kind: Kind) => { const w = await makeWorld(kind, { idBase: 0x9000 }); await w.svc.start(); return w; };
const snapshot = async (w: World) => ({ dumps: await Promise.all((await w.raw.listProfiles()).map((p) => dump(w, p.id))), meta: await w.raw.loadMeta(), writes: w.writes.length, events: [...w.events] });

describe.each(KINDS)('[T015][FR-004] applyImport create on %s', (kind) => {
  it('keeps every file id, writes ONE repository transaction, and gives the profile a writer id (FR-020)', async () => {
    const { b, body, w: src } = await source(kind);
    const w = await device2(kind);
    const before = w.writes.length;
    const r = await apply(w, body, 'create');
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
    expect(r.profileId).toBe(b);
    expect(w.writes.length - before).toBe(1);
    expect(w.purges).toHaveLength(0);
    expect(await dump(w, b)).toEqual(await dump(src, b));
    const meta = (await w.raw.loadMeta())!;
    expect(meta.writerIds[b]).toBeTruthy();
    expect(meta.deviceId).toBe(w.meta().deviceId);
    expect(() => w.session.stamp(b)).not.toThrow();
  });

  it('SC-005 round trip: export, erase permanently, import gives equal records (ids and content)', async () => {
    const { w, b, body } = await source(kind);
    const original = await dump(w, b);
    expect((await w.svc.erase(b)).ok).toBe(true);
    expect(await w.raw.loadProfile(b)).toBeUndefined();
    const r = await apply(w, body, 'create');
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
    const back = await dump(w, b);
    for (const store of Object.keys(original)) expect(byId(back[store]!), store).toEqual(byId(original[store]!));
  });

  it('SC-005 round trip on the same device after a profile delete: restore makes every record live again with its id', async () => {
    const { w, b, body } = await source(kind);
    const original = await dump(w, b);
    expect((await w.svc.delete(b)).ok).toBe(true);
    w.advance();
    const r = await apply(w, body, 'restore');
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
    const back = await dump(w, b);
    for (const store of Object.keys(original)) {
      expect(byId(back[store]!).map((x) => x.id), store).toEqual(byId(original[store]!).map((x) => x.id));
      for (const rec of back[store] as R[]) {
        const was = (original[store] as R[]).find((x) => x.id === rec.id)!;
        if (was.deletedBy === 'user') {
          expect([store, rec.deleted, rec.deletedBy], 'a user tombstone survives').toEqual([store, true, 'user']);
        } else {
          expect([store, rec.deleted, rec.deletedBy], 'a profile tombstone is undone').toEqual([store, false, undefined]);
        }
      }
    }
  });

  it('a file whose profile id is unknown is refused in restore mode (nothing to restore), with no write', async () => {
    const { body } = await source(kind);
    const w = await device2(kind);
    const snap = await snapshot(w);
    const r = await apply(w, body, 'restore');
    expect(r.ok).toBe(false);
    expectPlainSafeReason(r.reason);
    expect(await snapshot(w)).toEqual(snap);
  });

  it('a file whose profile id already exists is refused in create mode (use restore or copy), with no write', async () => {
    const { w, body } = await source(kind);
    const snap = await snapshot(w);
    const r = await apply(w, body, 'create');
    expect(r.ok).toBe(false);
    expectPlainSafeReason(r.reason);
    expect(await snapshot(w)).toEqual(snap);
  });
});

describe.each(KINDS)('[T015][FR-004][FR-020] import clash check on %s', (kind) => {
  const STORES = ['gear', 'paths', 'packs', 'instruments', 'lessonCompletion'] as const;

  it.each(STORES)('create: a file %s id already owned by another profile is rejected with the clash message, no write', async (store) => {
    const w = await device2(kind);
    const other = (await w.svc.list())[0]!.id;
    await seedValid(w, other, 'mine');
    const foreign = ((await dump(w, other))[store] as R[])[0]!.id;
    const f = validFileV2();
    f[store][0].id = foreign;
    if (store === 'gear') f.profileSettings.defaultInterfaceId = foreign;
    if (store === 'paths') { f.profileSettings.activePathId = foreign; f.pathItems[0].pathId = foreign; f.pathItems[1].pathId = foreign; }
    if (store === 'instruments') { f.attempts[0].instrumentId = foreign; f.onboarding[0].instrumentIds = [foreign]; f.profileSettings.activeInstrumentId = foreign; }
    const snap = await snapshot(w);
    const r = await apply(w, text(f), 'create');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/clash with another profile/);
    expect(r.reason).toMatch(/new profile/);
    expectPlainSafeReason(r.reason);
    expect(await snapshot(w)).toEqual(snap);
  });

  it.each(STORES)('restore: a file %s id owned by a DIFFERENT profile on this device is rejected, no write', async (store) => {
    const { w, a, b } = await threeProfiles(kind);
    await seedValid(w, a, 'a');
    await seedValid(w, b, 'b');
    const f = JSON.parse(await exportText(w, b));
    const foreign = ((await dump(w, a))[store] as R[])[0]!.id;
    f[store][0].id = foreign;
    // keep references resolvable so only the clash can reject the file
    if (store === 'gear') f.profileSettings.defaultInterfaceId = foreign;
    if (store === 'paths') {
      const old = f.paths[0].id;
      f.profileSettings.activePathId = foreign;
      for (const it of f.pathItems) if (it.pathId === old) it.pathId = foreign;
    }
    if (store === 'instruments') {
      const old = f.instruments[0].id;
      f.attempts.forEach((x: { instrumentId: string }) => { if (x.instrumentId === old) x.instrumentId = foreign; });
      f.onboarding[0].instrumentIds = [foreign];
      f.profileSettings.activeInstrumentId = foreign;
    }
    const snap = await snapshot(w);
    const r = await apply(w, text(f), 'restore');
    expect(r.ok).toBe(false);
    expectPlainSafeReason(r.reason);
    expect(await snapshot(w)).toEqual(snap);
  });

  it('restore: a path item pointing at another profile\'s path is rejected (IDOR guard), no write', async () => {
    const { w, a, b } = await threeProfiles(kind);
    const sa = await seedValid(w, a, 'a');
    await seedValid(w, b, 'b');
    const f = JSON.parse(await exportText(w, b));
    f.pathItems[0].pathId = sa.path.id;
    const snap = await snapshot(w);
    const r = await apply(w, text(f), 'restore');
    expect(r.ok).toBe(false);
    expectPlainSafeReason(r.reason);
    expect(await snapshot(w)).toEqual(snap);
  });

  it('copy mode is never refused for clashing ids (it regenerates them)', async () => {
    const { w, b, body } = await source(kind);
    const r = await apply(w, body, 'copy');
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
    expect(r.profileId).not.toBe(b);
  });
});

describe.each(KINDS)('[T015][FR-004] applyImport restore on %s', (kind) => {
  it('restoring a deleted profile reopens it in the session: later saves for it are accepted again', async () => {
    const { w, b, body } = await source(kind);
    await w.svc.delete(b);
    const rec = () => ({ store: 'gear', record: { ...w.session.common(b), kind: 'output', name: 'After' } }) as never;
    await expect(w.session.write([rec()])).rejects.toThrow(); // closed by delete (T013)
    w.advance();
    expect((await apply(w, body, 'restore')).ok).toBe(true);
    await expect(w.session.write([rec()])).resolves.toBeUndefined();
    const p = (await w.raw.listProfiles()).find((x) => x.id === b)!;
    expect(p.deleted).toBe(false);
    expect(p.deletedBy).toBeUndefined();
  });

  it('a record the user deleted stays deleted after restore; a profile-deleted one is undone and RE-STAMPED by the profile writer', async () => {
    const { w, b, body, seeded } = await source(kind);
    const writer = w.meta().writerIds[b]!;
    // user deletes one live path item AFTER the export was made
    const victim = seeded.items[1]!;
    w.advance();
    await w.session.write([{ store: 'pathItems', record: { ...victim, deleted: true, deletedBy: 'user', updated: w.session.stamp(b) } } as never]);
    await w.svc.delete(b);
    const tombstoned = byId((await dump(w, b)).paths as unknown[]) as R[];
    w.advance();
    expect((await apply(w, body, 'restore')).ok).toBe(true);
    const after = await dump(w, b);
    const item = (after.pathItems as R[]).find((x) => x.id === victim.id)!;
    expect(item.deleted).toBe(true);
    expect(item.deletedBy).toBe('user');
    for (const p of after.paths as R[]) {
      const was = tombstoned.find((x) => x.id === p.id)!;
      expect(p.deleted).toBe(false);
      expect(p.deletedBy).toBeUndefined();
      expect(p.updated > was.updated, 'restoreApply re-stamps').toBe(true);
      expect(p.updated.endsWith(`-${writer}`)).toBe(true);
      expect(p.created).toBe(was.created);
    }
  });

  it('a local-only live record that is not in the file is kept by a restore', async () => {
    const { w, b, body } = await source(kind);
    const keep = { ...w.session.common(b), kind: 'output', name: 'Local only' };
    await w.session.write([{ store: 'gear', record: keep } as never]);
    const r = await apply(w, body, 'restore');
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
    expect(((await dump(w, b)).gear as R[]).some((g) => g.id === keep.id && !g.deleted)).toBe(true);
  });

  it('a newer local edit wins over an older copy in the file (last writer wins per FR-066a); an older local copy is updated', async () => {
    const { w, b, body, seeded } = await source(kind);
    w.advance(5000);
    await w.session.write([{ store: 'paths', record: { ...seeded.path, name: 'Renamed later', updated: w.session.stamp(b) } } as never]);
    expect((await apply(w, body, 'restore')).ok).toBe(true);
    const path = ((await dump(w, b)).paths as R[]).find((x) => x.id === seeded.path.id)!;
    expect(path.name).toBe('Renamed later');
  });
});

describe.each(KINDS)('[T015][FR-004] applyImport copy on %s', (kind) => {
  it('on another device NO file id and NO file writer id survives anywhere in the stores or meta', async () => {
    const { body } = await source(kind);
    const f = JSON.parse(body);
    const w = await device2(kind);
    const r = await apply(w, body, 'copy');
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
    const everything = await everythingAsText(w);
    const idb = kind === 'idb' ? (await scanIdb(w.name)).text : {};
    const haystacks = [everything, ...Object.values(idb)];
    for (const id of fileIds(f)) for (const h of haystacks) expect(h, `file id ${id}`).not.toContain(id);
    for (const wr of writerIdsIn(f)) for (const h of haystacks) expect(h, `file writer id ${wr}`).not.toContain(wr);
    // and the content did arrive
    const copy = (await dump(w, r.profileId)) as Record<string, R[]>;
    expect(copy.paths).toHaveLength(2);
    expect(copy.pathItems).toHaveLength(4);
    expect(copy.gear).toHaveLength(2);
    expect(copy.packs).toHaveLength(1);
    expect(copy.onboarding).toHaveLength(1);
  });

  it('on the same device: every id is new, references are re-pointed through the id map, the original is untouched', async () => {
    const { w, b, body, seeded } = await source(kind);
    const original = await dump(w, b);
    const r = await apply(w, body, 'copy');
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
    const nid: string = r.profileId;
    expect(nid).not.toBe(b);
    expect(await dump(w, b)).toEqual(original);
    const copy = (await dump(w, nid)) as Record<string, R[]>;
    const origIds = new Set(Object.values(original).flat().map((x) => (x as R).id));
    for (const [store, recs] of Object.entries(copy)) for (const x of recs) {
      expect(origIds.has(x.id), `${store} id is new`).toBe(false);
      expect(x.localProfileId, `${store} owner`).toBe(nid);
    }
    expect(copy.localProfiles[0]!.id).toBe(nid);
    const ids = (s: string) => new Set(copy[s]!.map((x) => x.id));
    const settings = copy.profileSettings[0]! as R & { activePathId: string; defaultInterfaceId: string; activeInstrumentId: string };
    expect(ids('paths').has(settings.activePathId)).toBe(true);
    expect(ids('gear').has(settings.defaultInterfaceId)).toBe(true);
    expect(ids('instruments').has(settings.activeInstrumentId)).toBe(true);
    expect(copy.attempts.every((x) => ids('instruments').has(x.instrumentId as string))).toBe(true);
    expect((copy.onboarding[0]!.instrumentIds as string[]).every((i) => ids('instruments').has(i))).toBe(true);
    expect(copy.pathItems.every((x) => ids('paths').has(x.pathId as string))).toBe(true);
    // the item-to-path pairing survives the re-pointing (by path name)
    const nameOf = (recs: R[], pid: string) => recs.find((x) => x.id === pid)!.name;
    const pairing = (items: R[], paths: R[]) => items.map((i) => `${i.reason}->${nameOf(paths, i.pathId as string)}`).sort();
    expect(pairing(copy.pathItems, copy.paths)).toEqual(pairing(original.pathItems as R[], original.paths as R[]));
    // the pack's own kebab id is content, not a record id
    expect(copy.packs[0]!.packId).toBe(seeded.pack.packId);
  });

  it('every HLC in the copy carries the NEW profile writer id, never the file\'s or the original\'s', async () => {
    const { w, b, body } = await source(kind);
    const r = await apply(w, body, 'copy');
    expect(r.ok).toBe(true);
    const nid: string = r.profileId;
    const writer = w.meta().writerIds[nid]!;
    expect(writer).toBeTruthy();
    expect(writer).not.toBe(w.meta().writerIds[b]);
    const copy = await dump(w, nid);
    const hlcs = new Set<string>();
    walkStrings(copy, (s) => { if (HLC_PATTERN.test(s)) hlcs.add(s); });
    expect(hlcs.size).toBeGreaterThan(0);
    for (const h of hlcs) expect(h.endsWith(`-${writer}`), h).toBe(true);
    expect(w.meta().writerIds[b]).toBeTruthy(); // the original keeps its writer id
  });

  it('two copies of the same file are independent profiles (distinct ids and writer ids)', async () => {
    const { w, body } = await source(kind);
    const one = await apply(w, body, 'copy');
    const two = await apply(w, body, 'copy');
    expect([one.ok, two.ok]).toEqual([true, true]);
    expect(one.profileId).not.toBe(two.profileId);
    expect(w.meta().writerIds[one.profileId]).not.toBe(w.meta().writerIds[two.profileId]);
    const a = new Set(Object.values(await dump(w, one.profileId)).flat().map((x) => (x as R).id));
    for (const x of Object.values(await dump(w, two.profileId)).flat()) expect(a.has((x as R).id)).toBe(false);
  });

  it('copy writes ONE repository transaction', async () => {
    const { w, body } = await source(kind);
    const before = w.writes.length;
    expect((await apply(w, body, 'copy')).ok).toBe(true);
    expect(w.writes.length - before).toBe(1);
  });
});

describe.each(KINDS)('[T015][FR-004] v1 files import on %s', (kind) => {
  it('a v1 file imports in create mode (missing v2 arrays are empty)', async () => {
    const w = await device2(kind);
    const r = await apply(w, text(validFileV1()), 'create');
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
    const d = (await dump(w, FILE_PID)) as Record<string, R[]>;
    expect(d.instruments).toHaveLength(1);
    expect(d.attempts).toHaveLength(1);
    expect(d.lessonCompletion).toHaveLength(1);
    for (const s of ['gear', 'paths', 'pathItems', 'packs', 'onboarding']) expect(d[s], s).toHaveLength(0);
  });

  it('a v1 file imports as a copy', async () => {
    const w = await device2(kind);
    const r = await apply(w, text(validFileV1()), 'copy');
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
    expect(r.profileId).not.toBe(FILE_PID);
  });
});

describe.each(KINDS)('[T015][FR-004][SC-006][FR-020] hostile files write NOTHING on %s', (kind) => {
  const fixtures = hostileFixtures();
  it.each(['create', 'restore', 'copy'] as const)('every hostile fixture is rejected in %s mode with a plain safe reason and no write, no meta change', async (mode) => {
    const w = await device2(kind);
    const snap = await snapshot(w);
    for (const { name, text: body } of fixtures) {
      const r = await apply(w, body, mode);
      expect(r.ok, name).toBe(false);
      expectPlainSafeReason(r.reason);
      const pv = await preview(w, body, mode);
      expect(pv.ok, `preview: ${name}`).toBe(false);
    }
    expect(await snapshot(w)).toEqual(snap);
    expect(w.purges).toHaveLength(0);
  }, 120_000);

  it('a hostile file leaves the session state and active profile unchanged', async () => {
    const w = await device2(kind);
    const active = w.session.getState().profile;
    for (const { text: body } of fixtures.slice(0, 12)) await apply(w, body, 'create');
    expect(w.session.getState().profile).toEqual(active);
    expect(w.session.getState().error).toBeUndefined();
  });
});

describe.each(KINDS)('[T015][FR-004] previewImport on %s', (kind) => {
  it('counts what would happen, in plain kinds, and writes nothing', async () => {
    const { body, w: src } = await source(kind);
    const w = await device2(kind);
    const snap = await snapshot(w);
    const r = await preview(w, body, 'create');
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
    const p = r.preview;
    expect(p.mode).toBe('create');
    expect(Object.keys(p.counts).sort()).toEqual(['added', 'hidden', 'restored', 'unchanged', 'updated']);
    expect(p.counts.added).toBeGreaterThan(0);
    expect(p.counts.restored + p.counts.updated + p.counts.unchanged).toBe(0);
    for (const k of ['paths', 'path steps', 'packs', 'gear', 'onboarding answers']) expect(Object.keys(p.byKind.added), k).toContain(k);
    expect(p.byKind.added['paths']).toBe(2);
    expect(p.byKind.added['path steps']).toBe(4);
    expect(p.byKind.added['packs']).toBe(1);
    expect(p.byKind.added['gear']).toBe(2);
    expect(p.byKind.added['onboarding answers']).toBe(1);
    expect(await snapshot(w)).toEqual(snap);
    expect(src).toBeTruthy();
  });

  it('restoring a file identical to this device reports nothing new (all unchanged), and writes nothing', async () => {
    const { w, body } = await source(kind);
    const snap = await snapshot(w);
    const r = await preview(w, body, 'restore');
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
    expect(r.preview.counts.added + r.preview.counts.restored + r.preview.counts.updated + r.preview.counts.hidden).toBe(0);
    expect(r.preview.counts.unchanged).toBeGreaterThan(0);
    expect(await snapshot(w)).toEqual(snap);
  });

  it('restoring after a profile delete reports restored records (not added)', async () => {
    const { w, b, body } = await source(kind);
    await w.svc.delete(b);
    const r = await preview(w, body, 'restore');
    expect(r.ok).toBe(true);
    expect(r.preview.counts.restored).toBeGreaterThan(0);
    expect(r.preview.counts.added).toBe(0);
  });
});

describe('[T015] unused-import guard', () => {
  it('FILE_WRITER is a valid writer id shape', () => {
    expect(FILE_WRITER).toMatch(/^[0-9a-f-]{36}$/);
  });
});
