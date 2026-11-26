/**
 * 016 FR-012 / FR-003, research R3: merging path items (and paths, gear, packs).
 *
 * syncMerge is max-by-rank over (deletedBy === 'user', updated), taking the winning record whole.
 * `updated` is an HLC string ending in the writer id, so string order is (time, counter, writer).
 * The maximum of a total order is a semilattice join: commutative, associative and idempotent.
 *
 * restoreApply is a one-way import step, not a merge: it undoes only tombstones made by deleting
 * the whole profile, re-stamping what it brings back; the merge laws are not claimed for it.
 */
export interface Mergeable {
  readonly id: string;
  readonly updated: string;
  readonly deleted: boolean;
  readonly deletedBy?: 'user' | 'profile';
}

const userTomb = (r: Mergeable) => r.deleted && r.deletedBy === 'user';

export function syncMerge<T extends Mergeable>(a: T, b: T): T {
  const ua = userTomb(a);
  const ub = userTomb(b);
  if (ua !== ub) return ua ? a : b;
  if (a.updated !== b.updated) return a.updated > b.updated ? a : b;
  return a; // equal rank ⇒ same (id, updated) ⇒ identical payload
}

export function restoreApply<T extends Mergeable>(local: T | undefined, incoming: T, stamp: () => string): T {
  if (!local) return incoming;
  if (!incoming.deleted && local.deleted && local.deletedBy === 'profile') {
    const { deletedBy: _drop, ...rest } = incoming;
    return { ...rest, deleted: false, updated: stamp() } as T;
  }
  if (incoming.deleted && incoming.deletedBy === 'profile' && !local.deleted) return local;
  return syncMerge(local, incoming);
}
