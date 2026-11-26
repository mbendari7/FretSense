import { presetById, validateProfile, type InstrumentProfile, type InstrumentProfileInput } from '@fretsense/theory';
import { formatHlc, hlcReceive, hlcSend, parseHlc, type Hlc, type HlcState } from '../domain/hlc';
import { payloadOf } from '../domain/canonicalJson';
import { isV01Attempt, migrateAttempt } from '../domain/migrate';
import type { AnsweredQuestion } from '../domain/drills/session';
import { EXPORT_FORMAT, MAX_IMPORT_BYTES, parseExport, safeReason, type ProfileExport } from '../domain/exportFormat';
import { mergeAttempt, mergeCompletion, mergeInstrument, mergeSettings, type MergeResult } from '../domain/merge';
import type {
  AttemptRecord, Common, InstrumentRecord, LessonCompletionRecord, LocalProfileRecord, ProfileSettingsRecord,
  SettingsField, Stage,
} from '../domain/records';
import type { Clock, DeviceMeta, Hasher, IdGenerator, Repository, WriteOp } from './ports';

/** Application state read by the UI through useSyncExternalStore (research R3). */
export interface AppState {
  readonly status: 'loading' | 'ready';
  readonly durable: boolean;
  readonly profile?: LocalProfileRecord;
  readonly settings?: ProfileSettingsRecord;
  readonly instruments: readonly InstrumentRecord[];
  readonly attempts: readonly AttemptRecord[];
  readonly completion: readonly LessonCompletionRecord[];
  readonly error?: string;
}

export type SettingsPatch = Partial<Pick<ProfileSettingsRecord, SettingsField>>;

export type ImportCountKind = 'added' | 'restored' | 'updated' | 'hidden' | 'unchanged';
/** The record kinds an import counts, for FR-066a's plain sentences. */
export type ImportRecordKind = 'attempts' | 'instruments' | 'lessonCompletion' | 'profileSettings';

export interface ImportPreview {
  readonly mode: 'restore' | 'copy';
  readonly counts: Record<ImportCountKind, number>;
  /** FR-066a (CR-B2-14): each count split by record kind, so sentences name kinds in plain words. */
  readonly byKind?: Record<ImportCountKind, Record<ImportRecordKind, number>>;
  /** Whether the file carries profile settings ("Apply settings from this file" is shown only then). */
  readonly hasSettings: boolean;
  readonly apply: () => Promise<void>;
}

export interface ImportOptions {
  /** FR-043: "Apply settings from this file", off by default. */
  readonly applySettings?: boolean;
}

/** FR-066a: nothing new when added, restored, updated and hidden are all 0 (unchanged may be > 0). */
export const nothingNew = (c: ImportPreview['counts']) => c.added + c.restored + c.updated + c.hidden === 0;

export const DEFAULT_SETTINGS = {
  activeInstrumentId: null,
  octaveMode: 'any',
  adaptiveWeighting: true,
  stagePreference: ['read', 'see', 'drill'],
  activePackId: 'general-theory',
  display: { window: [0, 12], handedness: 'right', labelMode: 'notes', textSize: 2, fretSpacing: 'uniform', theme: 'system' },
  explorer: { root: 'C', kind: 'scale', typeId: 'major' },
  autoAdvanceMs: 600,
} as const satisfies Pick<ProfileSettingsRecord, SettingsField>;

const emptyByKind = (): Record<ImportCountKind, Record<ImportRecordKind, number>> => {
  const z = () => ({ attempts: 0, instruments: 0, lessonCompletion: 0, profileSettings: 0 });
  return { added: z(), restored: z(), updated: z(), hidden: z(), unchanged: z() };
};

const hasDuplicateIds = (xs: readonly { id: string }[]) => new Set(xs.map((x) => x.id)).size !== xs.length;

export class FretSenseApp {
  private state: AppState = { status: 'loading', durable: false, instruments: [], attempts: [], completion: [] };
  private listeners = new Set<() => void>();
  private meta!: DeviceMeta;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly repo: Repository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly hasher: Hasher,
  ) {}

  // ---- observable store ----
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;
  private set(patch: Partial<AppState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  // ---- clock ----
  private writerId(): string {
    return this.meta.writerIds[this.state.profile!.id]!;
  }
  /** The same wall time and counter, written by this profile's writer (copy import, FR-043). */
  private ownWriter(h: Hlc): Hlc {
    const x = parseHlc(h);
    return x ? formatHlc(x.wall, x.counter, this.writerId()) : this.stamp();
  }

  private ownStages<T extends Record<string, Hlc | undefined>>(stages: T): T {
    return Object.fromEntries(Object.entries(stages).map(([k, v]) => [k, v ? this.ownWriter(v) : v])) as T;
  }

  private stamp(): Hlc {
    const next: HlcState = hlcSend(this.meta.hlc, this.clock.now());
    this.meta = { ...this.meta, hlc: next };
    return formatHlc(next.wall, next.counter, this.writerId());
  }
  private common(): Common {
    const t = this.stamp();
    return { id: this.ids.uuid(), localProfileId: this.state.profile!.id, created: t, updated: t, schemaVersion: 1, deleted: false };
  }
  /** Serialises writes so each user action is one transaction, in order. */
  private commit(ops: WriteOp[]): Promise<void> {
    const meta = this.meta;
    const p = this.queue.then(() => this.repo.write(ops, meta));
    this.queue = p.catch(() => undefined);
    return p.catch((e: unknown) => {
      this.set({ error: `Couldn’t save: ${(e as Error).message}` });
      throw e;
    });
  }
  /** For fire-and-forget UI calls: the error is already shown in the app's notice. */
  private quiet(p: Promise<void>): Promise<void> {
    return p.catch(() => undefined);
  }

  // ---- bootstrap (FR-066, FR-067) ----
  async bootstrap(): Promise<void> {
    const meta = await this.repo.loadMeta();
    this.meta = meta ?? { deviceId: this.ids.uuid(), writerIds: {}, hlc: { wall: 0, counter: 0 } };
    const profiles = (await this.repo.listProfiles()).filter((p) => !p.deleted);
    let profile = profiles[0];
    if (!profile) {
      const id = this.ids.uuid();
      this.meta = { ...this.meta, writerIds: { ...this.meta.writerIds, [id]: this.ids.uuid() } };
      this.state = { ...this.state, profile: { id } as LocalProfileRecord };
      const t = this.stamp();
      profile = { id, localProfileId: id, created: t, updated: t, schemaVersion: 1, deleted: false, displayName: 'Me' };
      this.state = { ...this.state, profile };
      const settings = this.newSettings();
      await this.repo.write([{ store: 'localProfiles', record: profile }, { store: 'profileSettings', record: settings }], this.meta);
    } else if (!this.meta.writerIds[profile.id]) {
      this.meta = { ...this.meta, writerIds: { ...this.meta.writerIds, [profile.id]: this.ids.uuid() } };
    }
    const data = await this.repo.loadProfile(profile.id);
    const attempts = await this.migrateStored(data?.attempts ?? []);
    this.set({
      status: 'ready',
      durable: this.repo.durable,
      profile,
      settings: data?.settings ?? this.newSettings(),
      instruments: data?.instruments ?? [],
      attempts,
      completion: data?.completion ?? [],
    });
  }

  private newSettings(): ProfileSettingsRecord {
    const c = this.common();
    const fieldUpdated = Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((k) => [k, c.created])) as ProfileSettingsRecord['fieldUpdated'];
    return structuredClone({ ...c, ...DEFAULT_SETTINGS, fieldUpdated }) as unknown as ProfileSettingsRecord;
  }

  // ---- settings (per-field LWW stamps) ----
  private settingsWith(patch: SettingsPatch): ProfileSettingsRecord {
    const s = this.state.settings!;
    const t = this.stamp();
    const fieldUpdated = { ...s.fieldUpdated };
    for (const k of Object.keys(patch) as SettingsField[]) fieldUpdated[k] = t;
    return { ...s, ...patch, fieldUpdated, updated: t } as ProfileSettingsRecord;
  }

  updateSettings(patch: SettingsPatch): Promise<void> {
    const s = this.state.settings!;
    const t = this.stamp();
    const fieldUpdated = { ...s.fieldUpdated };
    for (const k of Object.keys(patch) as SettingsField[]) fieldUpdated[k] = t;
    const next = { ...s, ...patch, fieldUpdated, updated: t } as ProfileSettingsRecord;
    this.set({ settings: next });
    return this.quiet(this.commit([{ store: 'profileSettings', record: next }]));
  }

  // ---- instruments (FR-053) ----
  liveInstruments(): InstrumentRecord[] {
    return this.state.instruments.filter((i) => !i.deleted);
  }
  activeInstrument(): InstrumentRecord | undefined {
    const id = this.state.settings?.activeInstrumentId;
    const live = this.liveInstruments();
    return live.find((i) => i.id === id) ?? undefined;
  }

  async addInstrument(name: string, input: InstrumentProfileInput, presetOrigin?: string): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
    const v = validateProfile(input);
    if (!v.ok) return { ok: false, reason: v.error.message };
    const trimmed = name.trim().slice(0, 60) || 'My instrument';
    const record: InstrumentRecord = { ...this.common(), name: trimmed, profile: v.value, ...(presetOrigin ? { presetOrigin } : {}) };
    const settings = this.settingsWith({ activeInstrumentId: record.id });
    this.set({ instruments: [...this.state.instruments, record], settings });
    try {
      await this.commit([{ store: 'instruments', record }, { store: 'profileSettings', record: settings }]);
    } catch {
      return { ok: false, reason: 'The instrument couldn’t be saved on this device.' };
    }
    return { ok: true, id: record.id };
  }

  async addPreset(presetId: string): Promise<void> {
    const p = presetById(presetId);
    if (p) await this.addInstrument(p.name, p.profile, presetId);
  }

  async updateInstrument(id: string, name: string, input: InstrumentProfileInput): Promise<{ ok: true } | { ok: false; reason: string }> {
    const cur = this.state.instruments.find((i) => i.id === id);
    if (!cur) return { ok: false, reason: 'That instrument no longer exists.' };
    if (input.family !== cur.profile.family) return { ok: false, reason: 'An instrument’s family can’t change. Add a new instrument instead.' };
    const v = validateProfile(input);
    if (!v.ok) return { ok: false, reason: v.error.message };
    const record: InstrumentRecord = { ...cur, name: name.trim().slice(0, 60) || cur.name, profile: v.value, updated: this.stamp() };
    this.set({ instruments: this.state.instruments.map((i) => (i.id === id ? record : i)) });
    await this.quiet(this.commit([{ store: 'instruments', record }]));
    return { ok: true };
  }

  async deleteInstrument(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const live = this.liveInstruments();
    if (live.length <= 1) return { ok: false, reason: 'You need at least one instrument. Edit this one instead.' };
    const cur = live.find((i) => i.id === id);
    if (!cur) return { ok: false, reason: 'That instrument no longer exists.' };
    const record = { ...cur, deleted: true, updated: this.stamp() };
    const ops: WriteOp[] = [{ store: 'instruments', record }];
    let settings = this.state.settings!;
    if (settings.activeInstrumentId === id) {
      const remaining = live.filter((i) => i.id !== id);
      const lastUsed = (iid: string) => this.state.attempts.filter((a) => a.instrumentId === iid).reduce((m, a) => (a.timestamp > m ? a.timestamp : m), '');
      remaining.sort((a, b) => lastUsed(b.id).localeCompare(lastUsed(a.id)) || b.updated.localeCompare(a.updated));
      settings = this.settingsWith({ activeInstrumentId: remaining[0]?.id ?? null });
      ops.push({ store: 'profileSettings', record: settings });
    }
    this.set({ instruments: this.state.instruments.map((i) => (i.id === id ? record : i)), settings });
    try {
      await this.commit(ops);
    } catch {
      return { ok: false, reason: 'The change couldn’t be saved on this device.' };
    }
    return { ok: true };
  }

  // ---- drills (FR-033, FR-040) ----
  async recordAttempt(a: AnsweredQuestion, ctx: { instrumentId: string | null; profile: InstrumentProfile; lessonId?: string; drillId?: string }): Promise<void> {
    const base = {
      ...this.common(),
      drillType: a.question.drillType,
      instrumentId: ctx.instrumentId,
      geometryId: ctx.profile.geometryId,
      modality: 'tap' as const,
      prompt: a.question.prompt,
      answer: a.taps.map((t) => ({ string: t.string, fret: t.fret })),
      outcome: a.correct ? ('correct' as const) : ('incorrect' as const),
      responseMs: a.responseMs,
      timestamp: new Date(this.clock.now()).toISOString(),
      lessonId: ctx.lessonId ?? null,
      drillId: ctx.drillId ?? null,
      itemKey: a.question.itemKey,
    };
    const record: AttemptRecord = { ...base, payloadHash: await this.hasher.sha256Hex(payloadOf(base)) };
    this.set({ attempts: [...this.state.attempts, record] });
    await this.quiet(this.commit([{ store: 'attempts', record }]));
  }

  /**
   * CR-B3-3 / FR-040: records several answers (a walking-bass line) in ONE transaction. Throws on a
   * storage error; nothing is added to the state unless the write succeeded.
   */
  async recordAttempts(list: readonly AnsweredQuestion[], ctx: { instrumentId: string | null; profile: InstrumentProfile; lessonId?: string; drillId?: string }): Promise<void> {
    const records: AttemptRecord[] = [];
    for (const a of list) {
      const base = {
        ...this.common(),
        drillType: a.question.drillType,
        instrumentId: ctx.instrumentId,
        geometryId: ctx.profile.geometryId,
        modality: 'tap' as const,
        prompt: a.question.prompt,
        answer: a.taps.map((t) => ({ string: t.string, fret: t.fret })),
        outcome: a.correct ? ('correct' as const) : ('incorrect' as const),
        responseMs: a.responseMs,
        timestamp: new Date(this.clock.now()).toISOString(),
        lessonId: ctx.lessonId ?? null,
        drillId: ctx.drillId ?? null,
        itemKey: a.question.itemKey,
      };
      records.push({ ...base, payloadHash: await this.hasher.sha256Hex(payloadOf(base)) });
    }
    await this.commit(records.map((record) => ({ store: 'attempts' as const, record })));
    this.set({ attempts: [...this.state.attempts, ...records] });
  }

  // ---- lessons (FR-028: informational only, never gates) ----
  async markStage(lessonId: string, stage: Stage): Promise<void> {
    // Natural key (localProfileId, lessonId) includes tombstones: a reset record is revived, never duplicated.
    const cur = this.state.completion.find((c) => c.lessonId === lessonId);
    if (cur && !cur.deleted && cur.stages[stage]) return;
    const t = this.stamp();
    const record: LessonCompletionRecord = cur
      ? { ...cur, deleted: false, stages: cur.deleted ? { [stage]: t } : { ...cur.stages, [stage]: t }, updated: t }
      : { ...this.common(), lessonId, stages: { [stage]: t } };
    this.set({ completion: [...this.state.completion.filter((c) => c.id !== record.id), record] });
    await this.quiet(this.commit([{ store: 'lessonCompletion', record }]));
  }

  // ---- progress reset (FR-044) ----
  async resetProgress(): Promise<void> {
    const ops: WriteOp[] = [];
    const attempts = this.state.attempts.map((a) => {
      if (a.deleted) return a;
      const r = { ...a, deleted: true, updated: this.stamp() };
      ops.push({ store: 'attempts', record: r });
      return r;
    });
    const completion = this.state.completion.map((c) => {
      if (c.deleted) return c;
      const r = { ...c, deleted: true, updated: this.stamp() };
      ops.push({ store: 'lessonCompletion', record: r });
      return r;
    });
    this.set({ attempts, completion });
    await this.quiet(this.commit(ops));
  }

  // ---- export / import (FR-043, FR-066a) ----
  exportProfile(includeSettings: boolean): ProfileExport {
    const s = this.state;
    return {
      format: EXPORT_FORMAT,
      schemaVersion: 1,
      exportedAt: this.stamp(),
      localProfile: s.profile!,
      instruments: [...s.instruments],
      attempts: [...s.attempts],
      lessonCompletion: [...s.completion],
      ...(includeSettings && s.settings ? { profileSettings: s.settings } : {}),
    };
  }

  /** FR-043 import preview. Never rejects (security r2 N3): any unexpected error becomes a reason. */
  async previewImport(file: { size: number; text: () => Promise<string> }, opts: ImportOptions = {}): Promise<{ ok: true; preview: ImportPreview } | { ok: false; reason: string }> {
    try {
      return await this.previewImportChecked(file, opts);
    } catch {
      return { ok: false, reason: 'The file couldn’t be read as a FretSense export. Nothing was changed.' };
    }
  }

  private async previewImportChecked(file: { size: number; text: () => Promise<string> }, opts: ImportOptions): Promise<{ ok: true; preview: ImportPreview } | { ok: false; reason: string }> {
    if (file.size > MAX_IMPORT_BYTES) return { ok: false, reason: 'The file is larger than 50 MB.' };
    const parsed = parseExport(await file.text());
    if (!parsed.ok) return parsed;
    const data = parsed.data;
    const pid = data.localProfile.id;
    // A record id is a primary key (data-model §3): one id twice in a store makes the file malformed
    // (security-reviewer T093 r1 MAJOR #1).
    if (hasDuplicateIds(data.attempts)) return { ok: false, reason: 'The file has two attempts with the same id.' };
    if (hasDuplicateIds(data.instruments)) return { ok: false, reason: 'The file has two instruments with the same id.' };
    if (hasDuplicateIds(data.lessonCompletion)) return { ok: false, reason: 'The file has two lesson-progress records with the same id.' };
    // Every record must belong to the file's own profile (SC-013: no id in two profiles).
    const records = [...data.attempts, ...data.instruments, ...data.lessonCompletion, ...(data.profileSettings ? [data.profileSettings] : [])];
    if (data.localProfile.localProfileId !== pid || records.some((r) => r.localProfileId !== pid)) return { ok: false, reason: 'The file mixes records from different profiles.' };
    // Every HLC in the file is bounded (data-model §4 step 1).
    const now = this.clock.now();
    const hlcs: string[] = [data.exportedAt, data.localProfile.created, data.localProfile.updated];
    for (const r of records) hlcs.push(r.created, r.updated);
    for (const c of data.lessonCompletion) hlcs.push(...Object.values(c.stages).filter((x): x is string => !!x));
    if (data.profileSettings) hlcs.push(...Object.values(data.profileSettings.fieldUpdated));
    for (const h of hlcs) {
      const parsedH = parseHlc(h);
      if (!parsedH || parsedH.wall > now + 24 * 3600 * 1000) return { ok: false, reason: 'The file has timestamps from the future. Check the device clock.' };
    }
    // One lesson-progress record per lesson (natural key, SC-013; privacy r2 #4).
    const lessons = new Set<string>();
    for (const c of data.lessonCompletion) {
      if (lessons.has(c.lessonId)) return { ok: false, reason: 'The file has two progress records for one lesson.' };
      lessons.add(c.lessonId);
    }
    // Instruments are re-validated: shape-valid isn't enough (FR-053), and the geometry id is recomputed.
    const instruments: InstrumentRecord[] = [];
    for (const i of data.instruments) {
      const v = validateProfile({ family: i.profile.family, tuning: i.profile.tuning, fretCount: i.profile.fretCount, scaleLengthMm: i.profile.scaleLengthMm });
      // Names are echoed through the one shared UI-safe filter (security r2 N5).
      if (!v.ok) return { ok: false, reason: safeReason(`Instrument “${i.name}” in the file isn’t valid: ${v.error.message}`) };
      if (v.value.stringCount !== i.profile.stringCount) return { ok: false, reason: safeReason(`Instrument “${i.name}” has an inconsistent string count.`) };
      instruments.push({ ...i, profile: v.value });
    }
    // T093a: a migrated v0.1 attempt must match its ORIGINAL checksum; then it gets the hash of its migrated payload.
    // Bookkeeping by array index, never by id (security-reviewer T093 r1 MAJOR #1).
    const migratedAt = new Set(parsed.migrated.map((m) => m.index));
    for (const m of parsed.migrated) {
      if ((await this.hasher.sha256Hex(m.originalPayload)) !== m.originalHash) return { ok: false, reason: `Attempt ${data.attempts[m.index]?.id ?? m.index + 1} is damaged (its checksum doesn’t match).` };
    }
    const attempts: AttemptRecord[] = [];
    for (const [idx, a] of data.attempts.entries()) {
      if (!migratedAt.has(idx)) { attempts.push(a); continue; }
      const { payloadHash: _p, ...rest } = a;
      attempts.push({ ...a, payloadHash: await this.hasher.sha256Hex(payloadOf(rest)) });
    }
    const checked = { ...data, instruments, attempts };
    for (const a of attempts) {
      const { payloadHash, ...rest } = a;
      if ((await this.hasher.sha256Hex(payloadOf(rest))) !== payloadHash) return { ok: false, reason: `Attempt ${a.id} is damaged (its checksum doesn’t match).` };
      if (a.instrumentId && !instruments.some((i) => i.id === a.instrumentId)) return { ok: false, reason: 'The file refers to an instrument it doesn’t contain.' };
    }
    if (pid !== this.state.profile!.id) return this.previewCopy(checked, opts);
    const clash = await this.restoreIdClash(checked);
    if (clash) return { ok: false, reason: `Import stopped: ${clash}. Nothing was changed.` };
    return this.previewRestore(checked, opts);
  }

  /**
   * security r2 N1 (FR-043 "no id ever exists in two profiles", FR-066 natural keys): a restore never
   * overwrites a record by id outside its own natural key. Rejects an incoming id that another local
   * profile already uses, and a completion id that this profile uses for a different lesson.
   */
  private async restoreIdClash(data: ProfileExport): Promise<string | undefined> {
    const mine = this.state.profile!.id;
    const local = new Map(this.state.completion.map((c) => [c.id, c.lessonId]));
    for (const c of data.lessonCompletion) {
      const lesson = local.get(c.id);
      if (lesson !== undefined && lesson !== c.lessonId) return 'the file uses one lesson-progress id for two different lessons';
    }
    const incoming = {
      attempts: new Set(data.attempts.map((r) => r.id)),
      instruments: new Set(data.instruments.map((r) => r.id)),
      completion: new Set(data.lessonCompletion.map((r) => r.id)),
    };
    for (const p of await this.repo.listProfiles()) {
      if (p.id === mine) continue;
      const other = await this.repo.loadProfile(p.id);
      if (!other) continue;
      const hit = other.attempts.some((r) => incoming.attempts.has(r.id))
        || other.instruments.some((r) => incoming.instruments.has(r.id))
        || other.completion.some((r) => incoming.completion.has(r.id));
      if (hit) return 'the file has a record whose id belongs to another profile on this device';
    }
    return undefined;
  }

  private tally(results: MergeResult<unknown>[]) {
    const counts = { added: 0, restored: 0, updated: 0, hidden: 0, unchanged: 0 };
    for (const r of results) {
      if (r.kind === 'keep') counts.unchanged++;
      else if (r.kind === 'write') counts[r.change]++;
    }
    return counts;
  }

  /** FR-066a: the same tally, split by the store each result writes to. */
  private tallyByKind(results: readonly { store: WriteOp['store']; r: MergeResult<unknown> }[]) {
    const by = emptyByKind();
    for (const { store, r } of results) {
      const k = store as ImportRecordKind;
      if (!(k in by.added)) continue;
      if (r.kind === 'keep') by.unchanged[k]++;
      else if (r.kind === 'write') by[r.change][k]++;
    }
    return by;
  }

  /** Pure merge plan; `fresh` supplies stamps. Run once for the preview (dry) and again in apply. */
  private planRestore(data: ProfileExport, fresh: () => Hlc, opts: ImportOptions) {
    const byId = <T extends { id: string }>(xs: readonly T[]) => new Map(xs.map((x) => [x.id, x]));
    const la = byId(this.state.attempts);
    const li = byId(this.state.instruments);
    const results: { store: WriteOp['store']; r: MergeResult<unknown> }[] = [];
    // FR-066a (6): an incoming tombstone with no local copy hides nothing: not written, not counted.
    for (const a of data.attempts) {
      const local = la.get(a.id);
      if (local || !a.deleted) results.push({ store: 'attempts', r: mergeAttempt(local, a, fresh) });
    }
    for (const i of data.instruments) {
      const local = li.get(i.id);
      if (local || !i.deleted) results.push({ store: 'instruments', r: mergeInstrument(local, i, fresh) });
    }
    for (const c of data.lessonCompletion) {
      const local = this.state.completion.find((x) => x.lessonId === c.lessonId);
      if (local || !c.deleted) results.push({ store: 'lessonCompletion', r: mergeCompletion(local, c) });
    }
    if (opts.applySettings && data.profileSettings && this.state.settings) results.push({ store: 'profileSettings', r: mergeSettings(this.state.settings, data.profileSettings) });
    return results;
  }

  private previewRestore(data: ProfileExport, opts: ImportOptions): { ok: true; preview: ImportPreview } | { ok: false; reason: string } {
    const placeholder = this.state.attempts[0]?.updated ?? data.exportedAt;
    const dry = this.planRestore(data, () => placeholder, opts); // no clock advance until the user confirms
    const conflict = dry.find((x) => x.r.kind === 'conflict');
    if (conflict && conflict.r.kind === 'conflict') return { ok: false, reason: `Import stopped: ${conflict.r.reason}. Nothing was changed.` };
    return {
      ok: true,
      preview: {
        mode: 'restore',
        counts: this.tally(dry.map((x) => x.r)),
        byKind: this.tallyByKind(dry),
        hasSettings: !!data.profileSettings,
        apply: async () => {
          if (nothingNew(this.tally(dry.map((x) => x.r)))) return;
          // Research R5 receive rule first, so fresh local stamps sort after everything in the file.
          for (const r of [...data.attempts, ...data.instruments, ...data.lessonCompletion]) {
            this.meta = { ...this.meta, hlc: hlcReceive(this.meta.hlc, r.updated, this.clock.now()) ?? this.meta.hlc };
          }
          const results = this.planRestore(data, () => this.stamp(), opts);
          const ops = results.filter((x) => x.r.kind === 'write').map((x) => ({ store: x.store, record: (x.r as { record: unknown }).record }) as WriteOp);
          await this.commit(ops);
          await this.reload();
        },
      },
    };
  }

  /**
   * Copy import (FR-043): every record gets a new id and the target profile. Records tombstoned in the
   * file are dropped: not written and not counted (owner decision 2026-11-22 (2), "Copy import drops
   * deleted"); a live attempt that refers to a dropped instrument is copied with instrumentId null.
   * An incoming live completion whose target record is tombstoned un-deletes it with only the
   * incoming stages. Ids are remapped per store (security r2 N2).
   */
  private previewCopy(data: ProfileExport, opts: ImportOptions): { ok: true; preview: ImportPreview } {
    const counts = { added: 0, restored: 0, updated: 0, hidden: 0, unchanged: 0 };
    const byKind = emptyByKind();
    const count = (c: ImportCountKind, k: ImportRecordKind) => { counts[c]++; byKind[c][k]++; };
    for (const r of data.instruments) if (!r.deleted) count('added', 'instruments');
    for (const r of data.attempts) if (!r.deleted) count('added', 'attempts');
    for (const c of data.lessonCompletion) {
      const local = this.state.completion.find((x) => x.lessonId === c.lessonId);
      if (c.deleted) continue;
      if (!local) count('added', 'lessonCompletion');
      else if (local.deleted) count('restored', 'lessonCompletion');
      else {
        const m = mergeCompletion(local, c);
        count(m.kind === 'write' ? 'updated' : 'unchanged', 'lessonCompletion');
      }
    }
    // Settings are merged inside apply, once the copied instruments have their new ids (privacy r1 #1).
    const settingsFor = (idMap: ReadonlyMap<string, string>, liveIds: ReadonlySet<string>) => {
      if (!opts.applySettings || !data.profileSettings || !this.state.settings) return undefined;
      const src = data.profileSettings;
      const mapped = src.activeInstrumentId ? idMap.get(src.activeInstrumentId) : undefined;
      const fieldUpdated = Object.fromEntries(Object.entries(src.fieldUpdated).map(([k, v]) => [k, this.ownWriter(v as Hlc)]));
      const m = mergeSettings(this.state.settings, {
        ...src,
        id: this.state.settings.id,
        localProfileId: this.state.profile!.id,
        activeInstrumentId: mapped && liveIds.has(mapped) ? mapped : null,
        fieldUpdated: fieldUpdated as typeof src.fieldUpdated,
        created: this.state.settings.created,
        updated: this.ownWriter(src.updated),
      });
      return m.kind === 'write' ? m.record : undefined;
    };
    if (settingsFor(new Map(), new Set())) count('updated', 'profileSettings');
    return {
      ok: true,
      preview: {
        mode: 'copy',
        counts,
        byKind,
        hasSettings: !!data.profileSettings,
        apply: async () => {
          if (nothingNew(counts)) return; // writes nothing, not even copied tombstones
          // Research R5 receive rule on every HLC carried over, so later local stamps sort after them
          // (code-reviewer r1 #8, privacy r2 #2).
          const carried = [
            ...data.lessonCompletion.flatMap((c) => Object.values(c.stages).filter((x): x is Hlc => !!x)),
            ...(opts.applySettings && data.profileSettings ? [data.profileSettings.updated, ...Object.values(data.profileSettings.fieldUpdated)] : []),
          ];
          for (const h of carried) this.meta = { ...this.meta, hlc: hlcReceive(this.meta.hlc, h, this.clock.now()) ?? this.meta.hlc };
          const ops: WriteOp[] = [];
          const instrumentIds = new Map<string, string>(); // file instrument id → copied id
          const restamp = <T extends Common>(r: T): T => {
            const t = this.stamp();
            return { ...r, id: this.ids.uuid(), localProfileId: this.state.profile!.id, created: t, updated: t };
          };
          const liveIds = new Set<string>();
          for (const i of data.instruments) {
            if (i.deleted) continue; // dropped (owner decision 2026-11-22 (2))
            const r = restamp(i);
            instrumentIds.set(i.id, r.id);
            liveIds.add(r.id);
            ops.push({ store: 'instruments', record: r });
          }
          for (const a of data.attempts) {
            if (a.deleted) continue;
            const r = restamp(a);
            // A dropped (tombstoned) or absent instrument leaves the attempt under "Deleted instrument" (FR-042).
            r.instrumentId = a.instrumentId ? instrumentIds.get(a.instrumentId) ?? null : null;
            // payloadHash covers id and localProfileId, so re-keyed attempts get a fresh hash.
            const { payloadHash: _h, ...rest } = r;
            ops.push({ store: 'attempts', record: { ...r, payloadHash: await this.hasher.sha256Hex(payloadOf(rest)) } });
          }
          for (const src of data.lessonCompletion) {
            // Stage times keep their wall time and counter but take the target writer (privacy r1 #2).
            const c = { ...src, stages: this.ownStages(src.stages) };
            const local = this.state.completion.find((x) => x.lessonId === c.lessonId);
            if (c.deleted) continue; // dropped: never written, never hides a target record
            if (!local) { ops.push({ store: 'lessonCompletion', record: restamp(c) }); continue; }
            if (local.deleted) {
              const t = this.stamp();
              ops.push({ store: 'lessonCompletion', record: { ...local, deleted: false, stages: { ...c.stages }, updated: t } });
              continue;
            }
            const m = mergeCompletion(local, c);
            if (m.kind === 'write') ops.push({ store: 'lessonCompletion', record: { ...m.record, updated: this.stamp() } });
          }
          const settings = settingsFor(instrumentIds, liveIds);
          if (settings) ops.push({ store: 'profileSettings', record: { ...settings, updated: this.stamp() } });
          await this.commit(ops);
          await this.reload();
        },
      },
    };
  }

  /**
   * T093a: migrate attempts stored by the v0.1 pre-release once, on load, and write the migrated
   * records back in one transaction. The original checksum is checked first; a record that fails
   * it, or can't be migrated, is kept as stored (spec gap, see data-model §3.1).
   */
  private async migrateStored(stored: readonly AttemptRecord[]): Promise<AttemptRecord[]> {
    const out: AttemptRecord[] = [];
    const ops: WriteOp[] = [];
    for (const a of stored) {
      if (!isV01Attempt(a)) { out.push(a); continue; } // no parse for current records
      const m = migrateAttempt(a);
      if (!m.ok || !m.changed) { out.push(a); continue; }
      const { payloadHash, ...original } = a;
      if ((await this.hasher.sha256Hex(payloadOf(original))) !== payloadHash) { out.push(a); continue; }
      const record: AttemptRecord = { ...m.attempt, payloadHash: await this.hasher.sha256Hex(payloadOf(m.attempt)) };
      out.push(record);
      ops.push({ store: 'attempts', record });
    }
    if (ops.length) await this.repo.write(ops, this.meta);
    return out;
  }

  private async reload(): Promise<void> {
    const data = await this.repo.loadProfile(this.state.profile!.id);
    if (data) this.set({ settings: data.settings ?? this.state.settings, instruments: data.instruments, attempts: await this.migrateStored(data.attempts), completion: data.completion });
  }

  dismissError(): void {
    this.set({ error: undefined });
  }
}
