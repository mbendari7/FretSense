/**
 * T011 (red, test-first): application/session.ts core [FR-020; research R13].
 * The main guard is that the existing app.*.test.ts suite stays green unchanged; these tests pin the
 * small public surface the services share.
 *
 * Seam chosen (stub signature the implementation must provide):
 *   export function createSession(deps: { repo: Repository; clock: Clock; ids: IdGenerator; meta: DeviceMeta }): Session
 *   interface Session {
 *     subscribe(fn: () => void): () => void;      // returns an unsubscribe
 *     getState(): AppState;
 *     set(patch: Partial<AppState>): void;        // replaces state immutably, notifies listeners
 *     stamp(profileId: string): Hlc;              // HLC send rule, writer id = meta.writerIds[profileId]
 *     common(profileId: string): Common;          // fresh id, localProfileId = profileId, created = updated = stamp
 *     commit<T>(fn: () => Promise<T> | T): Promise<T>;   // serialised queue
 *     drain(): Promise<void>;                     // resolves when every queued commit has settled
 *     getMeta(): DeviceMeta;
 *   }
 */
import { describe, expect, it } from 'vitest';
import { createSession } from './session';
import { memoryRepository } from '../infrastructure/idb';
import { parseHlc } from '../domain/hlc';
import type { DeviceMeta, IdGenerator } from './ports';

const WA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PA = 'a0000000-0000-4000-8000-00000000000a';
const PB = 'b0000000-0000-4000-8000-00000000000b';
const T0 = Date.UTC(2026, 10, 22, 12, 0, 0, 0);
const meta = (): DeviceMeta => ({ deviceId: 'd', writerIds: { [PA]: WA, [PB]: WB }, hlc: { wall: 0, counter: 0 } });
const ids = (): IdGenerator => { let i = 0; return { uuid: () => `00000000-0000-4000-8000-${(++i).toString(16).padStart(12, '0')}` }; };
const make = (now = () => T0) => createSession({ repo: memoryRepository(), clock: { now }, ids: ids(), meta: meta() });
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('[T011][FR-020] observable state', () => {
  it('subscribe notifies on set; getState returns the new immutable state; unsubscribe stops it', () => {
    const s = make();
    const before = s.getState();
    let calls = 0;
    const off = s.subscribe(() => { calls++; });
    s.set({ durable: true });
    expect(calls).toBe(1);
    expect(s.getState()).not.toBe(before);
    expect(s.getState().durable).toBe(true);
    expect(before.durable).toBe(false);
    off();
    s.set({ durable: false });
    expect(calls).toBe(1);
  });
  it('starts in the loading status', () => expect(make().getState().status).toBe('loading'));
});

describe('[T011][FR-020] stamp and common', () => {
  it("stamp(profileId) uses the TARGET profile's writer id", () => {
    const s = make();
    expect(parseHlc(s.stamp(PA))!.writerId).toBe(WA);
    expect(parseHlc(s.stamp(PB))!.writerId).toBe(WB);
  });
  it('stamps are strictly increasing across profiles (one shared HLC) even with a frozen clock', () => {
    const s = make();
    const w = (h: string) => { const p = parseHlc(h)!; return [p.wall, p.counter] as const; };
    const a = w(s.stamp(PA));
    const b = w(s.stamp(PB));
    const c = w(s.stamp(PA));
    expect(a[0] === T0 && a[1] === 0).toBe(true);
    expect(b[0] === T0 && b[1] === 1).toBe(true);
    expect(c[0] === T0 && c[1] === 2).toBe(true);
  });
  it('stamp advances meta.hlc (what commit writes)', () => {
    const s = make();
    s.stamp(PA);
    s.stamp(PA);
    expect(s.getMeta().hlc).toEqual({ wall: T0, counter: 1 });
  });
  it('common(profileId): fresh id, target profile, created = updated, schemaVersion 1, not deleted', () => {
    const s = make();
    const c1 = s.common(PB);
    const c2 = s.common(PB);
    expect(c1.localProfileId).toBe(PB);
    expect(c1.created).toBe(c1.updated);
    expect(parseHlc(c1.created)!.writerId).toBe(WB);
    expect(c1.schemaVersion).toBe(1);
    expect(c1.deleted).toBe(false);
    expect(c1.id).not.toBe(c2.id);
    expect(c1.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('[T011][FR-020] serialising commit queue', () => {
  it('runs commits in order: the second starts only after the first resolves', async () => {
    const s = make();
    const log: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const p1 = s.commit(async () => { log.push('1-start'); await gate; log.push('1-end'); });
    const p2 = s.commit(async () => { log.push('2-start'); log.push('2-end'); });
    await tick();
    expect(log).toEqual(['1-start']);
    release();
    await Promise.all([p1, p2]);
    expect(log).toEqual(['1-start', '1-end', '2-start', '2-end']);
  });
  it('resolves with the callback result', async () => expect(await make().commit(async () => 42)).toBe(42));
  it('an error in one commit rejects that caller but does not block the next', async () => {
    const s = make();
    const bad = s.commit(async () => { throw new Error('boom'); });
    const good = s.commit(async () => 'ok');
    await expect(bad).rejects.toThrow('boom');
    await expect(good).resolves.toBe('ok');
  });
  it('drain() resolves only after every queued commit has settled, including failed ones', async () => {
    const s = make();
    const log: string[] = [];
    void s.commit(async () => { await tick(); log.push('a'); }).catch(() => undefined);
    void s.commit(async () => { await tick(); log.push('b'); throw new Error('x'); }).catch(() => undefined);
    await s.drain();
    expect(log).toEqual(['a', 'b']);
  });
  it('drain() on an idle session resolves immediately', async () => { await make().drain(); });
});

describe('[T011][FR-020] gate r1: missing writer id', () => {
  it('stamp(profileId) throws an Error naming the profile whose writer id is absent', () => {
    const s = make();
    const unknown = 'c0000000-0000-4000-8000-00000000000c';
    expect(() => s.stamp(unknown)).toThrow(Error);
    expect(() => s.stamp(unknown)).toThrow(/writer/i);
    expect(() => s.stamp(unknown)).toThrow(new RegExp(unknown));
  });
  it('a failed stamp does not advance the shared HLC', () => {
    const s = make();
    try { s.stamp('c0000000-0000-4000-8000-00000000000c'); } catch { /* expected */ }
    expect(s.getMeta().hlc).toEqual({ wall: 0, counter: 0 });
  });
});

describe('[T011][FR-020] gate r1: session.write(ops)', () => {
  const op = { store: 'localProfiles', record: { id: PA, localProfileId: PA, created: 'x', updated: 'x', schemaVersion: 1, deleted: false, displayName: 'Me' } } as any;
  const spy = (fail = false) => {
    const inner = memoryRepository();
    const calls: { ops: unknown[]; meta: DeviceMeta }[] = [];
    const repo = { ...inner, write: async (ops: any, m: DeviceMeta) => { calls.push({ ops: [...ops], meta: m }); if (fail) throw new Error('disk full'); await inner.write(ops, m); } };
    return { repo, calls };
  };

  it('runs repo.write(ops, meta) through the commit queue with the meta current WHEN THE WRITE RUNS (round 3 contract change)', async () => {
    const { repo, calls } = spy();
    const s = createSession({ repo, clock: { now: () => T0 }, ids: ids(), meta: meta() });
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const first = s.commit(() => gate);
    s.stamp(PA); // hlc counter 0
    const atCall = structuredClone(s.getMeta());
    const w = s.write([op]);
    s.stamp(PA); // a LATER stamp, made while the write waits: it must be persisted with the write
    const later = structuredClone(s.getMeta());
    await tick();
    expect(calls).toHaveLength(0); // waits for the earlier commit
    release();
    await Promise.all([first, w]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.ops).toEqual([op]);
    expect(calls[0]!.meta).toEqual(later);
    expect(calls[0]!.meta.hlc).not.toEqual(atCall.hlc);
    expect(calls[0]!.meta).toEqual(s.getMeta());
  });

  it('a meta change made while the write waits (a writer id added) is what gets persisted', async () => {
    const { repo, calls } = spy();
    const s = createSession({ repo, clock: { now: () => T0 }, ids: ids(), meta: meta() });
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const first = s.commit(() => gate);
    const w = s.write([op]);
    s.setMeta({ ...s.getMeta(), writerIds: { ...s.getMeta().writerIds, ['c0000000-0000-4000-8000-00000000000c']: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } });
    release();
    await Promise.all([first, w]);
    expect(calls[0]!.meta.writerIds['c0000000-0000-4000-8000-00000000000c']).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  });

  it("on failure sets state.error starting with 'Couldn’t save:' and rethrows", async () => {
    const { repo } = spy(true);
    const s = createSession({ repo, clock: { now: () => T0 }, ids: ids(), meta: meta() });
    await expect(s.write([op])).rejects.toThrow('disk full');
    expect(s.getState().error?.startsWith('Couldn’t save:')).toBe(true);
  });

  it('a failed write does not block the next one', async () => {
    const { repo } = spy(true);
    const s = createSession({ repo, clock: { now: () => T0 }, ids: ids(), meta: meta() });
    await expect(s.write([op])).rejects.toThrow();
    await expect(s.commit(async () => 'next')).resolves.toBe('next');
  });
});
