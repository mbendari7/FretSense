/**
 * T014 + T015 (domain part, red): profile export v2 builder and file parser
 * [FR-004, FR-019; SC-006; contracts/profile-export-v2.md; data-model §4 "Profile file"; research R6].
 * Expected values come from the contract text and hand-built fixtures (application/__tests__/profileFile.ts),
 * never from an implementation. Seam: see the header of that file.
 */
import { describe, expect, it } from 'vitest';
import { buildProfileExportV2, parseProfileFile, MAX_IMPORT_BYTES } from './exportFormat';
import { HLC_PATTERN } from './records';
import {
  expectPlainSafeReason, fileIds, FILE_PID, FILE_WRITER, hostileFixtures, text, uid, validFileV1, validFileV2, walkKeys, writerIdsIn, type File,
} from '../application/__tests__/profileFile';

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
/** ProfileData (ports.ts) from a valid file: the builder's input. */
function dataOf(f: File) {
  return {
    profile: clone(f.localProfile), settings: clone(f.profileSettings), instruments: clone(f.instruments), attempts: clone(f.attempts),
    completion: clone(f.lessonCompletion), gear: clone(f.gear), onboarding: clone(f.onboarding[0]), paths: clone(f.paths),
    pathItems: clone(f.pathItems), packs: clone(f.packs),
  };
}
const EXPORTED_AT = `2026-11-22T12:01:00.000Z-0000-${FILE_WRITER}`;
const TOP_KEYS = ['attempts', 'exportedAt', 'format', 'gear', 'instruments', 'lessonCompletion', 'localProfile', 'onboarding', 'packs', 'pathItems', 'paths', 'profileSettings', 'schemaVersion'];
const REQUIRED_KEYS = ['attempts', 'exportedAt', 'format', 'instruments', 'lessonCompletion', 'localProfile', 'schemaVersion'];

describe('[T014][FR-004] buildProfileExportV2: the contract shape', () => {
  it('has exactly the contract top-level key set for a fully populated profile', () => {
    const out = buildProfileExportV2(dataOf(validFileV2()) as never, EXPORTED_AT);
    expect(Object.keys(out).sort()).toEqual(TOP_KEYS);
    expect(out.format).toBe('fretsense-profile-export');
    expect(out.schemaVersion).toBe(2);
    expect(out.exportedAt).toMatch(HLC_PATTERN);
  });

  it('for an empty profile the keys are a subset of the contract keys and include every required one', () => {
    const f = validFileV2();
    const empty = {
      profile: f.localProfile, settings: undefined, instruments: [], attempts: [], completion: [], gear: [], onboarding: undefined, paths: [], pathItems: [], packs: [],
    };
    const keys = Object.keys(buildProfileExportV2(empty as never, EXPORTED_AT));
    for (const k of REQUIRED_KEYS) expect(keys).toContain(k);
    for (const k of keys) expect(TOP_KEYS).toContain(k);
  });

  it('includes every v2 store: gear, onboarding, paths, pathItems, packs, with the same ids', () => {
    const f = validFileV2();
    const out = buildProfileExportV2(dataOf(f) as never, EXPORTED_AT) as File;
    for (const k of ['instruments', 'attempts', 'lessonCompletion', 'gear', 'paths', 'pathItems', 'packs']) {
      expect(out[k].map((r: File) => r.id).sort(), k).toEqual(f[k].map((r: File) => r.id).sort());
    }
    expect(out.onboarding.map((r: File) => r.id)).toEqual([f.onboarding[0].id]);
    expect(out.profileSettings.id).toBe(f.profileSettings.id);
    expect(out.localProfile.id).toBe(f.localProfile.id);
  });

  it('includes tombstones (deleted records and their deletedBy)', () => {
    const d = dataOf(validFileV2());
    d.gear[1] = { ...d.gear[1], deleted: true, deletedBy: 'user' };
    d.pathItems[0] = { ...d.pathItems[0], deleted: true, deletedBy: 'profile' };
    const out = buildProfileExportV2(d as never, EXPORTED_AT) as File;
    expect(out.gear[1]).toMatchObject({ deleted: true, deletedBy: 'user' });
    expect(out.pathItems[0]).toMatchObject({ deleted: true, deletedBy: 'profile' });
  });

  it('exports the records unchanged (no re-stamping, no id change)', () => {
    const f = validFileV2();
    const out = buildProfileExportV2(dataOf(f) as never, EXPORTED_AT) as File;
    expect(out.paths).toEqual(f.paths);
    expect(out.pathItems).toEqual(f.pathItems);
    expect(out.gear).toEqual(f.gear);
    expect(out.packs).toEqual(f.packs);
    expect(out.profileSettings).toEqual(f.profileSettings);
  });
});

describe('[T014][FR-004] buildProfileExportV2: allow-list, no device data', () => {
  it('an unknown extra STORE on the input is never exported (a new store is not exported by default)', () => {
    const d = { ...dataOf(validFileV2()), deviceMeta: { deviceId: 'dev-1' }, tierSettings: [{ id: 'x', deviceId: 'dev-1' }], meta: { writerIds: {} } };
    const out = buildProfileExportV2(d as never, EXPORTED_AT) as File;
    expect(Object.keys(out).sort()).toEqual(TOP_KEYS);
    expect(JSON.stringify(out)).not.toContain('dev-1');
  });

  it('an unknown extra FIELD on a record is not exported', () => {
    const d = dataOf(validFileV2()) as File;
    for (const k of ['gear', 'paths', 'pathItems', 'packs', 'instruments', 'attempts', 'completion']) d[k][0] = { ...d[k][0], deviceId: 'dev-1', secretNote: 'leak-me' };
    d.profile = { ...d.profile, deviceId: 'dev-1', secretNote: 'leak-me' };
    d.settings = { ...d.settings, deviceId: 'dev-1', secretNote: 'leak-me' };
    d.onboarding = { ...d.onboarding, deviceId: 'dev-1', secretNote: 'leak-me' };
    const s = JSON.stringify(buildProfileExportV2(d as never, EXPORTED_AT));
    expect(s).not.toContain('leak-me');
    expect(s).not.toContain('dev-1');
  });

  it('no device-keyed property name appears anywhere in the file', () => {
    const out = buildProfileExportV2(dataOf(validFileV2()) as never, EXPORTED_AT);
    const keys = new Set<string>();
    walkKeys(out, (k) => keys.add(k));
    for (const banned of ['deviceId', 'writerIds', 'meta', 'hlc', 'activeLocalProfileId', 'tierSettings']) expect(keys.has(banned), banned).toBe(false);
  });

  it('the builder output parses back through parseProfileFile (builder and parser agree)', () => {
    const out = buildProfileExportV2(dataOf(validFileV2()) as never, EXPORTED_AT);
    const r = parseProfileFile(JSON.stringify(out));
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
  });
});

describe('[T015][FR-004] parseProfileFile: accepts valid files', () => {
  it('a valid v2 file parses, with all records intact', () => {
    const f = validFileV2();
    const r = parseProfileFile(text(f));
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
    if (r.ok) {
      expect(r.data.schemaVersion).toBe(2);
      expect(fileIds(r.data as File).sort()).toEqual(fileIds(f).sort());
    }
  });

  it('[T015] a v1 file migrates: schemaVersion 2, missing v2 arrays are empty', () => {
    const r = parseProfileFile(text(validFileV1()));
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
    if (r.ok) {
      const d = r.data as File;
      expect(d.schemaVersion).toBe(2);
      for (const k of ['gear', 'onboarding', 'paths', 'pathItems', 'packs']) expect(d[k] ?? [], k).toEqual([]);
      expect(d.instruments).toHaveLength(1);
      expect(d.attempts).toHaveLength(1);
    }
  });

  it('a file with the optional v2 arrays absent is valid', () => {
    const f = validFileV2();
    for (const k of ['gear', 'onboarding', 'paths', 'pathItems', 'packs']) delete f[k];
    delete f.profileSettings.activePathId; delete f.profileSettings.fieldUpdated.activePathId;
    delete f.profileSettings.defaultInterfaceId; delete f.profileSettings.fieldUpdated.defaultInterfaceId;
    const r = parseProfileFile(text(f));
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
  });

  it('a file without profileSettings is valid (settings are optional)', () => {
    const f = validFileV2();
    delete f.profileSettings;
    expect(parseProfileFile(text(f)).ok).toBe(true);
  });

  it('boundary: exactly 100 gear / 100 paths / 100 packs / 1 onboarding are accepted', () => {
    const f = validFileV2();
    const c = (id: string) => ({ id, localProfileId: FILE_PID, created: f.exportedAt, updated: f.exportedAt, schemaVersion: 1, deleted: false });
    f.gear = Array.from({ length: 100 }, (_, i) => ({ ...c(uid(0x1000 + i)), kind: 'output', name: `G${i}` }));
    f.paths = Array.from({ length: 100 }, (_, i) => ({ ...c(uid(0x2000 + i)), name: `P${i}`, origin: 'manual' }));
    f.pathItems = [];
    f.profileSettings.activePathId = uid(0x2000);
    delete f.profileSettings.defaultInterfaceId; delete f.profileSettings.fieldUpdated.defaultInterfaceId;
    f.packs = Array.from({ length: 100 }, (_, i) => ({ ...c(uid(0x3000 + i)), packId: `p${i}`, title: `P${i}`, sections: [] }));
    const r = parseProfileFile(text(f));
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
  });

  it('accepts OrderKeys that match ^[0-9A-Za-z]{0,23}[1-9A-Za-z]$ (1 char, 24 chars)', () => {
    const f = validFileV2();
    f.pathItems[0].orderKey = '1';
    f.pathItems[1].orderKey = `${'0'.repeat(23)}z`;
    expect(parseProfileFile(text(f)).ok).toBe(true);
  });

  it('a settings activePackId naming a user pack in the file (by packId) resolves', () => {
    const f = validFileV2();
    f.profileSettings.activePackId = 'my-pack';
    expect(parseProfileFile(text(f)).ok).toBe(true);
  });
});

describe('[T015][FR-004][SC-006] parseProfileFile: hostile and malformed files are rejected with a plain safe reason', () => {
  const fixtures = hostileFixtures();
  it('the fixture table covers every class the task names', () => {
    const names = fixtures.map((x) => x.name).join(' | ');
    for (const w of ['oversized', 'nesting', '__proto__', 'constructor', 'bidi', 'control', 'duplicate', 'foreign localProfileId', 'dangling', 'not in the file', 'OrderKey']) {
      expect(names, w).toContain(w);
    }
  });

  it.each(fixtures.map((x) => [x.name, x.text] as const))('rejects: %s', (_name, body) => {
    const r = parseProfileFile(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expectPlainSafeReason(r.reason);
  });

  it('rejects more than 50,000 path items (cap checked, plain reason)', () => {
    const f = validFileV2();
    const item = f.pathItems[0];
    f.pathItems = Array.from({ length: 50_001 }, (_, i) => ({ ...item, id: uid(0x100000 + i) }));
    const body = text(f);
    expect(body.length).toBeLessThan(MAX_IMPORT_BYTES);
    const r = parseProfileFile(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expectPlainSafeReason(r.reason);
  }, 30_000);

  it('a hostile reason never echoes the hostile characters back', () => {
    const f = validFileV2();
    f.localProfile.displayName = 'Ivy‮\u0007';
    const r = parseProfileFile(text(f));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(/[‮\u0007]/.test(r.reason)).toBe(false);
  });

  it('a newer schemaVersion is rejected with a reason that says so in plain words', () => {
    const f = validFileV2();
    f.schemaVersion = 3;
    const r = parseProfileFile(text(f));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/newer|version/i);
  });

  it('does not pollute Object.prototype when it rejects a __proto__ file', () => {
    parseProfileFile(text(validFileV2()).replace('"displayName"', '"__proto__":{"polluted":true},"displayName"'));
    expect(({} as File).polluted).toBeUndefined();
  });
});

describe('[T015][FR-004] parseProfileFile: writer ids stay in the data until copy mode rewrites them', () => {
  it('a parsed file keeps its HLCs untouched (rewriting is the import step, not the parser)', () => {
    const f = validFileV2();
    const r = parseProfileFile(text(f));
    expect(r.ok).toBe(true);
    if (r.ok) expect([...writerIdsIn(r.data)]).toEqual([FILE_WRITER]);
  });
});
