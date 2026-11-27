/**
 * T013 gate r1 (red, test-first): session.closeProfile(id) / reopenProfile(id) [FR-003, FR-020; research R13].
 * Seam (stub signatures): Session gains
 *   closeProfile(profileId: string): void;   // later-running writes carrying a record of this profile are refused
 *   reopenProfile(profileId: string): void;  // undoes it (e.g. the id is reused, or an erase/delete failed)
 * A refused write rejects when it RUNS (not when it is queued) with message "that profile was deleted";
 * session.write surfaces it as state.error "Couldn’t save: that profile was deleted" and writes nothing.
 */
import { describe, expect, it } from 'vitest';
import { createSession } from './session';
import { memoryRepository } from '../infrastructure/idb';
import type { DeviceMeta, IdGenerator, WriteOp } from './ports';

const WA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PA = 'a0000000-0000-4000-8000-00000000000a';
const PB = 'b0000000-0000-4000-8000-00000000000b';
const T0 = Date.UTC(2026, 10, 22, 12, 0, 0, 0);
const meta = (): DeviceMeta => ({ deviceId: 'd', writerIds: { [PA]: WA, [PB]: WB }, hlc: { wall: 0, counter: 0 } });
const ids = (): IdGenerator => { let i = 0; return { uuid: () => `00000000-0000-4000-8000-${(++i).toString(16).padStart(12, '0')}` }; };
function make() {
  const repo = memoryRepository();
  const writes: WriteOp[][] = [];
  const real = repo.write.bind(repo);
  repo.write = async (ops, m) => { writes.push([...ops]); return real(ops, m); };
  const s = createSession({ repo, clock: { now: () => T0 }, ids: ids(), meta: meta() });
  const instrument = (pid: string) => ({ store: 'instruments', record: { ...s.common(pid), name: `I-${pid.slice(0, 1)}`, profile: {} } }) as unknown as WriteOp;
  return { s, repo, writes, instrument };
}
const slow = () => new Promise<void>((r) => setTimeout(r, 20));

describe('[T013][FR-003] session.closeProfile / reopenProfile', () => {
  it('a write for a closed profile is refused: it rejects, sets "Couldn’t save: that profile was deleted", and writes nothing', async () => {
    const { s, writes, instrument } = make();
    s.closeProfile(PA);
    await expect(s.write([instrument(PA)])).rejects.toThrow('that profile was deleted');
    expect(s.getState().error).toBe('Couldn’t save: that profile was deleted');
    expect(writes).toHaveLength(0);
    expect(s.getMeta().writerIds[PA]).toBe(WA); // closing does not touch meta
  });

  it('is judged when the write RUNS: one queued before closeProfile but run after it is refused', async () => {
    const { s, writes, instrument } = make();
    void s.commit(slow);
    const queued = s.write([instrument(PA)]);
    const settled = queued.then(() => 'ok', (e: Error) => e.message);
    s.closeProfile(PA);
    expect(await settled).toBe('that profile was deleted');
    expect(writes).toHaveLength(0);
  });

  it('a write that already ran before closeProfile is unaffected', async () => {
    const { s, writes, instrument } = make();
    await s.write([instrument(PA)]);
    s.closeProfile(PA);
    expect(writes).toHaveLength(1);
  });

  it('other profiles are unaffected, and a mixed batch carrying a closed profile\'s record is refused whole', async () => {
    const { s, writes, instrument } = make();
    s.closeProfile(PA);
    await expect(s.write([instrument(PB)])).resolves.toBeUndefined();
    expect(writes).toHaveLength(1);
    await expect(s.write([instrument(PB), instrument(PA)])).rejects.toThrow('that profile was deleted');
    expect(writes).toHaveLength(1);
  });

  it('later writes are not poisoned: the queue keeps running after a refusal', async () => {
    const { s, writes, instrument } = make();
    s.closeProfile(PA);
    await s.write([instrument(PA)]).catch(() => undefined);
    await expect(s.write([instrument(PB)])).resolves.toBeUndefined();
    expect(writes).toHaveLength(1);
  });

  it('reopenProfile lifts the refusal', async () => {
    const { s, writes, instrument } = make();
    s.closeProfile(PA);
    s.reopenProfile(PA);
    await expect(s.write([instrument(PA)])).resolves.toBeUndefined();
    expect(writes).toHaveLength(1);
  });
});
