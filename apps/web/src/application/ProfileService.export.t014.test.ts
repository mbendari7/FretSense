/**
 * T014 (red): ProfileService.exportProfile(id) [FR-004, FR-019; SC-001 export isolation; contracts/profile-export-v2.md].
 * Seam and stub signatures: see application/__tests__/profileFile.ts.
 */
import { describe, expect, it } from 'vitest';
import { HLC_PATTERN } from '../domain/records';
import { KINDS, dump, makeWorld, threeProfiles } from './__tests__/profileWorld';
import { seedValid, walkKeys, walkStrings, writerIdsIn } from './__tests__/profileFile';

type Rec = { id: string; localProfileId: string };
const TOP_KEYS = ['attempts', 'exportedAt', 'format', 'gear', 'instruments', 'lessonCompletion', 'localProfile', 'onboarding', 'packs', 'pathItems', 'paths', 'profileSettings', 'schemaVersion'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const exportOf = async (w: any, id: string) => {
  const r = await w.svc.exportProfile(id);
  expect(r.ok, r.ok ? '' : r.reason).toBe(true);
  return r.file as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
};

describe.each(KINDS)('[T014][FR-004] ProfileService.exportProfile on %s', (kind) => {
  it('has exactly the contract top-level key set and format / schemaVersion 2', async () => {
    const { w, b } = await threeProfiles(kind);
    await seedValid(w, b, 'b');
    const f = await exportOf(w, b);
    expect(Object.keys(f).sort()).toEqual(TOP_KEYS);
    expect(f.format).toBe('fretsense-profile-export');
    expect(f.schemaVersion).toBe(2);
    expect(f.exportedAt).toMatch(HLC_PATTERN);
  });

  it('includes every store of the profile, tombstones too, with the repository ids', async () => {
    const { w, b } = await threeProfiles(kind);
    await seedValid(w, b, 'b');
    const f = await exportOf(w, b);
    const d = await dump(w, b);
    const sorted = (xs: Rec[]) => xs.map((x) => x.id).sort();
    expect(f.localProfile.id).toBe(b);
    expect(f.profileSettings.id).toBe((d.profileSettings[0] as Rec).id);
    for (const [key, store] of [['instruments', 'instruments'], ['attempts', 'attempts'], ['lessonCompletion', 'lessonCompletion'], ['gear', 'gear'], ['onboarding', 'onboarding'], ['paths', 'paths'], ['pathItems', 'pathItems'], ['packs', 'packs']] as const) {
      expect(sorted(f[key]), key).toEqual(sorted(d[store] as Rec[]));
      expect(f[key].length, `${key} is not empty`).toBeGreaterThan(0);
    }
    // the user-deleted gear and path item are in the file as tombstones
    expect(f.gear.filter((g: { deleted: boolean }) => g.deleted)).toHaveLength(1);
    expect(f.pathItems.filter((g: { deleted: boolean }) => g.deleted)).toHaveLength(1);
    expect(f.gear.find((g: { deleted: boolean }) => g.deleted).deletedBy).toBe('user');
  });

  it('text is the JSON of file, and the repository is not written (export is read-only)', async () => {
    const { w, b } = await threeProfiles(kind);
    await seedValid(w, b, 'b');
    const before = w.writes.length;
    const r = await w.svc.exportProfile(b);
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.parse(r.text)).toEqual(JSON.parse(JSON.stringify(r.file)));
    expect(w.writes.length).toBe(before);
    expect(w.purges).toHaveLength(0);
  });

  it('never exports the device id, meta, or any writer-id map (SC-009 / contract: meta and deviceId are never exported)', async () => {
    const { w, a, b, c } = await threeProfiles(kind);
    for (const [p, t] of [[a, 'a'], [b, 'b'], [c, 'c']] as const) await seedValid(w, p, t);
    const f = await exportOf(w, b);
    const text = JSON.stringify(f);
    expect(text).not.toContain(w.meta().deviceId);
    const keys = new Set<string>();
    walkKeys(f, (k) => keys.add(k));
    for (const banned of ['deviceId', 'writerIds', 'meta', 'hlc', 'activeLocalProfileId', 'tierSettings']) expect(keys.has(banned), banned).toBe(false);
    // The only writer id in the file is the exported profile's own (it is part of every HLC stamp).
    expect([...writerIdsIn(f)]).toEqual([w.meta().writerIds[b]]);
    expect(text).not.toContain(w.meta().writerIds[a]!);
    expect(text).not.toContain(w.meta().writerIds[c]!);
  });

  it('SC-001 export isolation over three profiles: each file holds only its own profile, no value of the others', async () => {
    const { w, a, b, c } = await threeProfiles(kind);
    const tags = { [a]: 'alpha', [b]: 'bravo', [c]: 'charlie' };
    for (const [p, t] of Object.entries(tags)) await seedValid(w, p, t);
    const dumps = new Map<string, string>();
    for (const p of [a, b, c]) dumps.set(p, JSON.stringify(await dump(w, p)));
    for (const p of [a, b, c]) {
      const f = await exportOf(w, p);
      const text = JSON.stringify(f);
      // every record in the file belongs to this profile
      const owners = new Set<string>();
      for (const [k, v] of Object.entries(f)) {
        if (Array.isArray(v)) v.forEach((r: Rec) => owners.add(r.localProfileId));
        else if (v && typeof v === 'object' && k !== 'exportedAt') owners.add((v as Rec).localProfileId);
      }
      expect([...owners]).toEqual([p]);
      // no id, writer id or distinctive text of either other profile
      for (const other of [a, b, c].filter((x) => x !== p)) {
        expect(text, `ids of ${tags[other]}`).not.toContain(other);
        expect(text, `writer of ${tags[other]}`).not.toContain(w.meta().writerIds[other]!);
        expect(text, `content of ${tags[other]}`).not.toContain(tags[other]!);
        const otherIds: string[] = [];
        walkStrings(JSON.parse(dumps.get(other)!), (s) => { if (/^[0-9a-f]{8}-/.test(s) && s.length === 36) otherIds.push(s); });
        for (const id of otherIds) expect(text, `id ${id}`).not.toContain(id);
      }
      expect(text).toContain(tags[p]!);
    }
  });

  it('an unknown profile id is refused with a plain reason', async () => {
    const w = await makeWorld(kind);
    await w.svc.start();
    const r = await w.svc.exportProfile('99999999-9999-4999-8999-999999999999');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.length).toBeGreaterThan(5);
  });

  it('exports what the repository holds: a save made just before the export is in the file (queue drained first)', async () => {
    const { w, b } = await threeProfiles(kind);
    await seedValid(w, b, 'b');
    const late = { ...w.session.common(b), kind: 'output', name: 'Late-gear' };
    const pending = w.session.write([{ store: 'gear', record: late } as never]);
    const r = await w.svc.exportProfile(b);
    await pending;
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.file)).toContain('Late-gear');
  });
});
