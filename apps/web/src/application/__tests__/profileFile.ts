/**
 * Shared fixtures for the T014 / T015 tests (profile export / import v2). Test-only helper; not a test file.
 *
 * SEAM ASSUMED (stubs the implementation must provide; contracts/profile-export-v2.md, data-model §3-§4):
 *
 *  domain/exportFormat.ts
 *    export const EXPORT_SCHEMA_VERSION_V2 = 2   (not required by the tests; the literal 2 is used)
 *    export type ProfileExportV2 = { format; schemaVersion: 2; exportedAt: Hlc; localProfile; instruments;
 *        attempts; lessonCompletion; profileSettings?; gear?; onboarding?; paths?; pathItems?; packs? }
 *    export function buildProfileExportV2(data: ProfileData, exportedAt: string): ProfileExportV2
 *        // pure allow-list (privacy-auditor r1 #5). `data` is the ports.ts ProfileData; no DeviceMeta input.
 *    export function parseProfileFile(text: string):
 *        | { ok: true; data: ProfileExportV2 /* normalised: v1 migrated, schemaVersion 2, missing arrays = [] *\/;
 *            migrated: readonly MigratedEntry[] }
 *        | { ok: false; reason: string }
 *        // ALL file-only validation (size, depth, prototype keys, caps, unique ids, localProfileId match,
 *        // reference resolution, OrderKey, safeText). Nothing here reads the repository.
 *
 *  application/ProfileService.ts  (added to ProfileService)
 *    exportProfile(id: string): Promise<Result<{ file: ProfileExportV2; text: string }>>
 *    previewImport(text: string, mode: ImportMode): Promise<Result<{ preview: ProfileImportPreview }>>   // no writes
 *    applyImport(text: string, mode: ImportMode): Promise<Result<{ profileId: string }>>                 // ONE repo.write
 *    type ImportMode = 'restore' | 'create' | 'copy'
 *    type ProfileImportPreview = { mode: ImportMode; counts: Record<'added'|'restored'|'updated'|'hidden'|'unchanged', number>;
 *        byKind: Record<same five keys, Record<'paths'|'path steps'|'packs'|'gear'|'onboarding answers'|..., number>> }
 */
import { expect } from 'vitest';
import { presetById } from '@fretsense/theory';
import { hasUnsafeChars, HLC_PATTERN } from '../../domain/records';
import { MAX_IMPORT_BYTES } from '../../domain/exportFormat';
import type { World } from './profileWorld';

export const FILE_WRITER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const OTHER_WRITER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const FILE_PID = '10000000-0000-4000-8000-000000000001';
const WALL = Date.UTC(2026, 10, 22, 12, 0, 0, 0);

/** File-side ids: a namespace the test worlds' own id generator (00000000-...) never produces. */
export const uid = (n: number) => `10000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
export const fileHlc = (sec = 0, writer = FILE_WRITER) => `${new Date(WALL + sec * 1000).toISOString()}-0000-${writer}`;

const guitar = () => JSON.parse(JSON.stringify(presetById('guitar6-standard')!.profile));
type Rec = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type File = Record<string, any>;
const common = (id: string, pid = FILE_PID, sec = 0) => ({ id, localProfileId: pid, created: fileHlc(sec), updated: fileHlc(sec), schemaVersion: 1, deleted: false });

/** A fully populated, valid v2 profile file with one profile `FILE_PID` (every store has records). */
export function validFileV2(pid = FILE_PID): File {
  const c = (n: number, sec = 0) => common(uid(n), pid, sec);
  const g = guitar();
  return {
    format: 'fretsense-profile-export',
    schemaVersion: 2,
    exportedAt: fileHlc(60),
    localProfile: { ...common(pid, pid), displayName: 'Imported Ivy' },
    instruments: [{ ...c(0x10), name: 'Strat', profile: g }],
    attempts: [{
      ...c(0x20), drillType: 'note-finding', instrumentId: uid(0x10), geometryId: g.geometryId, modality: 'tap',
      prompt: { drillType: 'note-finding', pitchClass: 7, string: 6, midi: null }, answer: [{ string: 6, fret: 3 }],
      outcome: 'correct', responseMs: 812, timestamp: '2026-11-22T12:00:00.000Z', lessonId: null, drillId: null,
      itemKey: `nf|${g.geometryId}|6|7`, payloadHash: 'ab'.repeat(32),
    }],
    lessonCompletion: [{ ...c(0x30), lessonId: 'notes-on-the-neck', stages: { read: fileHlc(1) } }],
    profileSettings: {
      ...c(0x40, 5), schemaVersion: 2,
      fieldUpdated: {
        activeInstrumentId: fileHlc(5), octaveMode: fileHlc(5), adaptiveWeighting: fileHlc(5), stagePreference: fileHlc(5),
        activePackId: fileHlc(5), display: fileHlc(5), explorer: fileHlc(5), autoAdvanceMs: fileHlc(5),
        activePathId: fileHlc(5), defaultInterfaceId: fileHlc(5),
      },
      activeInstrumentId: uid(0x10), octaveMode: 'any', adaptiveWeighting: true, stagePreference: ['read', 'see', 'drill'],
      activePackId: 'general-theory',
      display: { window: [0, 12], handedness: 'right', labelMode: 'notes', textSize: 2, fretSpacing: 'uniform', theme: 'system' },
      explorer: { root: 'C', kind: 'scale', typeId: 'major' }, autoAdvanceMs: 0,
      activePathId: uid(0x60), defaultInterfaceId: uid(0x50),
    },
    gear: [
      { ...c(0x50), kind: 'interface', name: 'Box', directMonitoring: false, channels: [{ index: 1, label: 'In 1', hint: 'instrument', signal: 'dry' }] },
      { ...c(0x51), kind: 'output', name: 'Phones' },
    ],
    onboarding: [{ ...c(0x58), goals: ['learn-theory'], instrumentIds: [uid(0x10)], genres: [], answeredAt: fileHlc(2), fieldUpdated: { goals: fileHlc(2) } }],
    paths: [{ ...c(0x60), name: 'Main path', origin: 'manual' }, { ...c(0x61), name: 'Second path', origin: 'generated' }],
    pathItems: [
      { ...c(0x70), pathId: uid(0x60), ref: { kind: 'lesson', lessonId: 'notes-on-the-neck' }, reason: 'First', fallback: false, orderKey: 'V' },
      { ...c(0x71), pathId: uid(0x60), ref: { kind: 'lesson', lessonId: 'intervals' }, reason: 'Next', fallback: false, orderKey: 'a' },
      { ...c(0x72), pathId: uid(0x61), ref: { kind: 'drill', lessonId: 'intervals', drillId: 'interval-find' }, reason: 'Practice', fallback: true, orderKey: 'm' },
    ],
    packs: [{ ...c(0x80), packId: 'my-pack', title: 'My pack', sections: [{ title: 'Part one', lessons: ['notes-on-the-neck'] }] }],
  };
}

/** The same content as a v1 file (no v2 arrays, v1 settings stamp set). */
export function validFileV1(pid = FILE_PID): File {
  const f = validFileV2(pid);
  for (const k of ['gear', 'onboarding', 'paths', 'pathItems', 'packs']) delete f[k];
  const { activePathId: _a, defaultInterfaceId: _d, ...rest } = f.profileSettings;
  const { activePathId: _fa, defaultInterfaceId: _fd, ...fu } = rest.fieldUpdated;
  f.profileSettings = { ...rest, schemaVersion: 1, fieldUpdated: fu };
  f.schemaVersion = 1;
  return f;
}

export const text = (f: unknown) => JSON.stringify(f);

/** Every (store, id) of a file including the profile record, and every HLC writer id in it. */
export function fileIds(f: File): string[] {
  const out = [f.localProfile.id];
  for (const k of ['instruments', 'attempts', 'lessonCompletion', 'gear', 'onboarding', 'paths', 'pathItems', 'packs']) for (const r of f[k] ?? []) out.push(r.id);
  if (f.profileSettings) out.push(f.profileSettings.id);
  return out;
}
export function walkStrings(v: unknown, fn: (s: string) => void): void {
  if (typeof v === 'string') fn(v);
  else if (Array.isArray(v)) v.forEach((x) => walkStrings(x, fn));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => walkStrings(x, fn));
}
export function walkKeys(v: unknown, fn: (k: string) => void): void {
  if (Array.isArray(v)) v.forEach((x) => walkKeys(x, fn));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { fn(k); walkKeys(x, fn); }
}
/** The writer ids (last 36 characters) of every HLC string in the value. */
export function writerIdsIn(v: unknown): Set<string> {
  const out = new Set<string>();
  walkStrings(v, (s) => { if (HLC_PATTERN.test(s)) out.add(s.slice(-36)); });
  return out;
}

/** A reason shown to the user: plain, short, no control or bidi characters, no stack or library noise. */
export function expectPlainSafeReason(reason: unknown): void {
  expect(typeof reason).toBe('string');
  const r = reason as string;
  expect(r.length).toBeGreaterThan(5);
  expect(r.length).toBeLessThanOrEqual(240);
  expect(hasUnsafeChars(r)).toBe(false);
  expect(r).not.toMatch(/Error:|ZodError|\bat \S+:\d+|\[object|undefined|NaN|\{"/);
}

const clone = (f: File): File => JSON.parse(JSON.stringify(f));
const mutate = (fn: (f: File) => void) => { const f = clone(validFileV2()); fn(f); return text(f); };
const BIDI = '‮';

/** SC-006: hostile or malformed profile files. Every one must be rejected, with a plain reason, and write nothing. */
export function hostileFixtures(): { name: string; text: string }[] {
  const t = (name: string, body: string) => ({ name, text: body });
  const base = text(validFileV2());
  const list = [
    t('oversized (50 MB + 1 byte)', `{${' '.repeat(MAX_IMPORT_BYTES + 1)}}`),
    t('nesting deeper than 16', mutate((f) => { f.profileSettings.explorer = JSON.parse(`${'['.repeat(40)}${']'.repeat(40)}`); })),
    t('__proto__ key', base.replace('"displayName"', '"__proto__":{"polluted":true},"displayName"')),
    t('constructor key', base.replace('"displayName"', '"constructor":{"prototype":{"polluted":true}},"displayName"')),
    t('not JSON', '{"format": "fretsense-profile-export", '),
    t('wrong format', mutate((f) => { f.format = 'something-else'; })),
    t('newer schemaVersion', mutate((f) => { f.schemaVersion = 3; })),
    t('unknown top-level field', mutate((f) => { f.deviceId = 'dev-1'; })),
    t('unknown field on a record', mutate((f) => { f.gear[0].secret = 'x'; })),
    t('bidi override in the profile name', mutate((f) => { f.localProfile.displayName = `Ivy${BIDI}`; })),
    t('control character in a gear name', mutate((f) => { f.gear[1].name = 'Phones\u0007'; })),
    t('zero-width space in a path name', mutate((f) => { f.paths[0].name = 'Main​path'; })),
    t('bidi in a pack title', mutate((f) => { f.packs[0].title = `My${BIDI}pack`; })),
    t('control character in a path item reason', mutate((f) => { f.pathItems[0].reason = 'a\u0000b'; })),
    t('bidi in a section title', mutate((f) => { f.packs[0].sections[0].title = `S${BIDI}`; })),
    t('duplicate gear ids', mutate((f) => { f.gear[1].id = f.gear[0].id; })),
    t('duplicate path ids', mutate((f) => { f.paths[1].id = f.paths[0].id; })),
    t('duplicate path item ids', mutate((f) => { f.pathItems[1].id = f.pathItems[0].id; })),
    t('duplicate pack ids', mutate((f) => { f.packs.push({ ...f.packs[0], packId: 'other-pack' }); })),
    t('foreign localProfileId on a gear record', mutate((f) => { f.gear[0].localProfileId = uid(0x999); })),
    t('foreign localProfileId on a path item', mutate((f) => { f.pathItems[2].localProfileId = uid(0x999); })),
    t('foreign localProfileId on an attempt', mutate((f) => { f.attempts[0].localProfileId = uid(0x999); })),
    t('foreign localProfileId on the settings', mutate((f) => { f.profileSettings.localProfileId = uid(0x999); })),
    t('foreign localProfileId on an onboarding record', mutate((f) => { f.onboarding[0].localProfileId = uid(0x999); })),
    t('path item names a path that is not in the file', mutate((f) => { f.pathItems[0].pathId = uid(0x998); })),
    t('settings activePathId is dangling', mutate((f) => { f.profileSettings.activePathId = uid(0x998); })),
    t('settings defaultInterfaceId is dangling', mutate((f) => { f.profileSettings.defaultInterfaceId = uid(0x998); })),
    t('settings activePackId names no pack', mutate((f) => { f.profileSettings.activePackId = 'no-such-pack'; })),
    t('onboarding names an instrument that is not in the file', mutate((f) => { f.onboarding[0].instrumentIds = [uid(0x998)]; })),
    t('more than 100 gear records', mutate((f) => { f.gear = Array.from({ length: 101 }, (_, i) => ({ ...common(uid(0x1000 + i)), kind: 'output', name: `G${i}` })); })),
    t('more than 100 paths', mutate((f) => { f.paths = Array.from({ length: 101 }, (_, i) => ({ ...common(uid(0x2000 + i)), name: `P${i}`, origin: 'manual' })); f.pathItems = []; f.profileSettings.activePathId = uid(0x2000); })),
    t('more than 100 packs', mutate((f) => { f.packs = Array.from({ length: 101 }, (_, i) => ({ ...common(uid(0x3000 + i)), packId: `p${i}`, title: `P${i}`, sections: [] })); })),
    t('more than 1 onboarding record', mutate((f) => { f.onboarding.push({ ...f.onboarding[0], id: uid(0x59) }); })),
    t('more than 50 instruments', mutate((f) => { f.instruments = Array.from({ length: 51 }, (_, i) => ({ ...common(uid(0x4000 + i)), name: `I${i}`, profile: guitar() })); f.attempts = []; f.onboarding[0].instrumentIds = [uid(0x4000)]; f.profileSettings.activeInstrumentId = uid(0x4000); })),
  ];
  for (const [i, key] of ['0', '', 'ab cd', 'x'.repeat(25), 'abc0', 'é'].entries()) {
    list.push(t(`bad OrderKey #${i + 1} (${JSON.stringify(key).slice(0, 30)})`, mutate((f) => { f.pathItems[0].orderKey = key; })));
  }
  return list;
}

/**
 * Seeds one SCHEMA-VALID record per v2 store (plus a user-deleted gear and path item) for profile `pid`,
 * through the shared session (stamps and queue behave as in the app). `tag` makes content unique, so a leak
 * between profiles is visible by value as well as by id. Settings carry activePathId and defaultInterfaceId.
 */
export async function seedValid(w: World, pid: string, tag: string) {
  const c = () => w.session.common(pid);
  const inst = { ...c(), name: `Inst-${tag}`, profile: guitar() };
  const att = {
    ...c(), drillType: 'note-finding', instrumentId: inst.id, geometryId: inst.profile.geometryId, modality: 'tap',
    prompt: { drillType: 'note-finding', pitchClass: 7, string: 6, midi: null }, answer: [{ string: 6, fret: 3 }], outcome: 'correct',
    responseMs: 500, timestamp: '2026-11-22T12:00:00.000Z', lessonId: null, drillId: null, itemKey: `nf|${inst.profile.geometryId}|6|7`,
    payloadHash: (tag.charCodeAt(0) % 16).toString(16).repeat(64),
  };
  const lc = c();
  const completion = { ...lc, lessonId: 'notes-on-the-neck', stages: { read: lc.created } };
  const gear = { ...c(), kind: 'interface', name: `Box-${tag}`, directMonitoring: false, channels: [{ index: 1, label: `In-${tag}`, hint: 'instrument', signal: 'dry' }] };
  const gone = { ...c(), kind: 'output', name: `Gone-${tag}` };
  const goneStamp = w.session.stamp(pid);
  const goneTomb = { ...gone, deleted: true, deletedBy: 'user', updated: goneStamp };
  const onboarding = { ...c(), goals: ['learn-theory'], instrumentIds: [inst.id], genres: [], answeredAt: lc.created, fieldUpdated: { goals: lc.created } };
  const path = { ...c(), name: `Path-${tag}`, origin: 'manual' };
  const path2 = { ...c(), name: `Path2-${tag}`, origin: 'generated' };
  const item = (pathId: string, key: string, reason: string) => ({ ...c(), pathId, ref: { kind: 'lesson', lessonId: 'notes-on-the-neck' }, reason, fallback: false, orderKey: key });
  const items = [item(path.id, 'V', `R1-${tag}`), item(path.id, 'a', `R2-${tag}`), item(path2.id, 'm', `R3-${tag}`)];
  const goneItem = { ...item(path.id, 'z', `Gone-${tag}`), deleted: true, deletedBy: 'user', updated: w.session.stamp(pid) };
  const pack = { ...c(), packId: `pack-${tag}`, title: `Pack ${tag}`, sections: [{ title: `Sec-${tag}`, lessons: ['notes-on-the-neck'] }] };
  const existing = (await w.raw.loadProfile(pid))!.settings!;
  const t = w.session.stamp(pid);
  const settings = {
    ...existing, schemaVersion: 2, updated: t, activeInstrumentId: inst.id, activePathId: path.id, defaultInterfaceId: gear.id,
    fieldUpdated: { ...existing.fieldUpdated, activeInstrumentId: t, activePathId: t, defaultInterfaceId: t },
  };
  const ops = [
    { store: 'instruments', record: inst }, { store: 'attempts', record: att }, { store: 'lessonCompletion', record: completion },
    { store: 'gear', record: gear }, { store: 'gear', record: goneTomb }, { store: 'onboarding', record: onboarding },
    { store: 'paths', record: path }, { store: 'paths', record: path2 },
    ...items.map((record) => ({ store: 'pathItems', record })), { store: 'pathItems', record: goneItem },
    { store: 'packs', record: pack }, { store: 'profileSettings', record: settings },
  ];
  await w.session.write(ops as never);
  return { inst, att, gear, goneGear: goneTomb, path, path2, items, goneItem, pack, onboarding, settings };
}

/** A repository-wide plain-text dump (every profile, every store, plus meta): for "nothing survives" scans. */
export async function everythingAsText(w: World): Promise<string> {
  const parts: unknown[] = [await w.raw.loadMeta(), await w.raw.listProfiles()];
  for (const p of await w.raw.listProfiles()) parts.push(await w.raw.loadProfile(p.id));
  return JSON.stringify(parts);
}

export type { Rec };
