import { presetById, validateProfile, type InstrumentProfile, type InstrumentProfileInput } from '@fretsense/theory';
import { formatHlc, hlcReceive, hlcSend, parseHlc, type Hlc, type HlcState } from '../domain/hlc';
import { payloadOf } from '../domain/canonicalJson';
import type { AnsweredQuestion } from '../domain/drills/session';
import { EXPORT_FORMAT, MAX_IMPORT_BYTES, parseExport, type ProfileExport } from '../domain/exportFormat';
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

export interface ImportPreview {
  readonly mode: 'restore' | 'copy';
  readonly counts: Record<'added' | 'restored' | 'updated' | 'hidden' | 'unchanged', number>;
  readonly apply: () => Promise<void>;
}

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
    this.set({
      status: 'ready',
      durable: this.repo.durable,
      profile,
      settings: data?.settings ?? this.newSettings(),
      instruments: data?.instruments ?? [],
      attempts: data?.attempts ?? [],
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

  async previewImport(file: { size: number; text: () => Promise<string> }): Promise<{ ok: true; preview: ImportPreview } | { ok: false; reason: string }> {
    if (file.size > MAX_IMPORT_BYTES) return { ok: false, reason: 'The file is larger than 50 MB.' };
    const parsed = parseExport(await file.text());
    if (!parsed.ok) return parsed;
    const data = parsed.data;
    const pid = data.localProfile.id;
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
    // Instruments are re-validated: shape-valid isn't enough (FR-053), and the geometry id is recomputed.
    const instruments: InstrumentRecord[] = [];
    for (const i of data.instruments) {
      const v = validateProfile({ family: i.profile.family, tuning: i.profile.tuning, fretCount: i.profile.fretCount, scaleLengthMm: i.profile.scaleLengthMm });
      if (!v.ok) return { ok: false, reason: `Instrument “${i.name}” in the file isn’t valid: ${v.error.message}` };
      if (v.value.stringCount !== i.profile.stringCount) return { ok: false, reason: `Instrument “${i.name}” has an inconsistent string count.` };
      instruments.push({ ...i, profile: v.value });
    }
    const checked = { ...data, instruments };
    for (const a of data.attempts) {
      const { payloadHash, ...rest } = a;
      if ((await this.hasher.sha256Hex(payloadOf(rest))) !== payloadHash) return { ok: false, reason: `Attempt ${a.id} is damaged (its checksum doesn’t match).` };
      if (a.instrumentId && !instruments.some((i) => i.id === a.instrumentId)) return { ok: false, reason: 'The file refers to an instrument it doesn’t contain.' };
    }
    return pid === this.state.profile!.id ? this.previewRestore(checked) : this.previewCopy(checked);
  }

  private tally(results: MergeResult<unknown>[]) {
    const counts = { added: 0, restored: 0, updated: 0, hidden: 0, unchanged: 0 };
    for (const r of results) {
      if (r.kind === 'keep') counts.unchanged++;
      else if (r.kind === 'write') counts[r.change]++;
    }
    return counts;
  }

  /** Pure merge plan; `fresh` supplies stamps. Run once for the preview (dry) and again in apply. */
  private planRestore(data: ProfileExport, fresh: () => Hlc) {
    const byId = <T extends { id: string }>(xs: readonly T[]) => new Map(xs.map((x) => [x.id, x]));
    const la = byId(this.state.attempts);
    const li = byId(this.state.instruments);
    const results: { store: WriteOp['store']; r: MergeResult<unknown> }[] = [];
    for (const a of data.attempts) results.push({ store: 'attempts', r: mergeAttempt(la.get(a.id), a, fresh) });
    for (const i of data.instruments) results.push({ store: 'instruments', r: mergeInstrument(li.get(i.id), i, fresh) });
    for (const c of data.lessonCompletion) {
      results.push({ store: 'lessonCompletion', r: mergeCompletion(this.state.completion.find((x) => x.lessonId === c.lessonId), c) });
    }
    if (data.profileSettings && this.state.settings) results.push({ store: 'profileSettings', r: mergeSettings(this.state.settings, data.profileSettings) });
    return results;
  }

  private previewRestore(data: ProfileExport): { ok: true; preview: ImportPreview } | { ok: false; reason: string } {
    const placeholder = this.state.attempts[0]?.updated ?? data.exportedAt;
    const dry = this.planRestore(data, () => placeholder); // no clock advance until the user confirms
    const conflict = dry.find((x) => x.r.kind === 'conflict');
    if (conflict && conflict.r.kind === 'conflict') return { ok: false, reason: `Import stopped: ${conflict.r.reason}. Nothing was changed.` };
    return {
      ok: true,
      preview: {
        mode: 'restore',
        counts: this.tally(dry.map((x) => x.r)),
        apply: async () => {
          // Research R5 receive rule first, so fresh local stamps sort after everything in the file.
          for (const r of [...data.attempts, ...data.instruments, ...data.lessonCompletion]) {
            this.meta = { ...this.meta, hlc: hlcReceive(this.meta.hlc, r.updated, this.clock.now()) ?? this.meta.hlc };
          }
          const results = this.planRestore(data, () => this.stamp());
          const ops = results.filter((x) => x.r.kind === 'write').map((x) => ({ store: x.store, record: (x.r as { record: unknown }).record }) as WriteOp);
          await this.commit(ops);
          await this.reload();
        },
      },
    };
  }

  private previewCopy(data: ProfileExport): { ok: true; preview: ImportPreview } {
    return {
      ok: true,
      preview: {
        mode: 'copy',
        counts: { added: data.instruments.length + data.attempts.length, restored: 0, updated: 0, hidden: 0, unchanged: 0 },
        apply: async () => {
          const ops: WriteOp[] = [];
          const idMap = new Map<string, string>();
          const restamp = <T extends Common>(r: T): T => {
            const t = this.stamp();
            const id = this.ids.uuid();
            idMap.set(r.id, id);
            return { ...r, id, localProfileId: this.state.profile!.id, created: t, updated: t };
          };
          for (const i of data.instruments) ops.push({ store: 'instruments', record: restamp(i) });
          for (const a of data.attempts) {
            const r = restamp(a);
            r.instrumentId = a.instrumentId ? idMap.get(a.instrumentId) ?? null : null;
            // payloadHash covers id and localProfileId, so re-keyed attempts get a fresh hash.
            const { payloadHash: _h, ...rest } = r;
            ops.push({ store: 'attempts', record: { ...r, payloadHash: await this.hasher.sha256Hex(payloadOf(rest)) } });
          }
          for (const c of data.lessonCompletion) {
            const local = this.state.completion.find((x) => x.lessonId === c.lessonId);
            const m = mergeCompletion(local, restamp(c));
            if (m.kind === 'write') ops.push({ store: 'lessonCompletion', record: m.record });
          }
          await this.commit(ops);
          await this.reload();
        },
      },
    };
  }

  private async reload(): Promise<void> {
    const data = await this.repo.loadProfile(this.state.profile!.id);
    if (data) this.set({ settings: data.settings ?? this.state.settings, instruments: data.instruments, attempts: data.attempts, completion: data.completion });
  }

  dismissError(): void {
    this.set({ error: undefined });
  }
}
