/** T098: lesson drills may be walking bass and chord-tone lock (FN-7 resolved); FR-058 requires a declared key. */
import { describe, expect, it } from 'vitest';
import { drillDefinitionSchema } from './schemas';

const base = { id: 'walk-1', instruments: ['bass'] };
describe('FR-058 / FR-059 lesson drill definitions', () => {
  it.each(['walking-bass', 'chord-tone-lock'] as const)('%s with a key and a progression is accepted', (type) => {
    const r = drillDefinitionSchema.safeParse({ ...base, type, params: { key: { tonic: 'C', mode: 'major' }, chords: [{ root: 'C', quality: 'major' }, { root: 'G', quality: 'major' }] } });
    expect(r.success).toBe(true);
  });
  it.each(['walking-bass', 'chord-tone-lock'] as const)('%s without a key is rejected with a reason on params.key', (type) => {
    const r = drillDefinitionSchema.safeParse({ ...base, type, params: {} });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path.join('.') === 'params.key')).toBe(true);
  });
  it('a walking-bass drill with only a key (built-in progression) is accepted', () => {
    expect(drillDefinitionSchema.safeParse({ ...base, type: 'walking-bass', params: { key: { tonic: 'Eb', mode: 'major' } } }).success).toBe(true);
  });
});
