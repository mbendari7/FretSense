import type { Clock, Hasher, IdGenerator } from '../application/ports';

export const systemClock: Clock = { now: () => Date.now() };
export const cryptoIds: IdGenerator = { uuid: () => crypto.randomUUID() };
export const subtleHasher: Hasher = {
  async sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  },
};

/** Asks the browser to keep our data (FR-045). Returns whether it was granted. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
