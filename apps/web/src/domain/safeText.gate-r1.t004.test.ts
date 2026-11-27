/**
 * Gate round 1 red tests, T004 [FR-004, FR-014]: extra invisible characters, one shared character
 * class, and the pre-normalise length cap. Code points are listed from the Unicode standard
 * (soft hyphen, Mongolian vowel separator, line/paragraph separators, word joiner and invisible
 * operators, tag characters), independent of the implementation.
 */
import { describe, expect, it } from 'vitest';
import { safeText, FORBIDDEN_CHARS } from './safeText';
import { UNSAFE_CHARS } from './records';

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const EXTRA = [0x00ad, 0x180e, 0x2028, 0x2029, ...range(0x2060, 0x2064), ...range(0xe0000, 0xe007f)];
const hex = (c: number) => `U+${c.toString(16).toUpperCase().padStart(4, '0')}`;

describe('[T004][FR-004,FR-014] safeText extra forbidden code points', () => {
  const s = safeText(20);
  it.each(EXTRA.map((c) => [hex(c), c] as const))('rejects %s', (_n, c) => {
    const ch = String.fromCodePoint(c);
    expect(s.safeParse(`a${ch}b`).success).toBe(false);
    expect(s.safeParse(ch).success).toBe(false);
  });
  it('named samples E0001, E0041, E007F are rejected', () => {
    for (const c of [0xe0001, 0xe0041, 0xe007f]) expect(s.safeParse(`x${String.fromCodePoint(c)}`).success).toBe(false);
  });
  it('ordinary text, accents and emoji with joiners-free sequences still pass', () => {
    expect(s.safeParse('Café ☕').success).toBe(true);
  });
});

describe('[T004][FR-004] one shared character class', () => {
  it('records.ts UNSAFE_CHARS has the same source as safeText.ts FORBIDDEN_CHARS', () => {
    expect(FORBIDDEN_CHARS).toBeInstanceOf(RegExp);
    expect(UNSAFE_CHARS.source).toBe(FORBIDDEN_CHARS.source);
    expect(UNSAFE_CHARS.flags).toBe(FORBIDDEN_CHARS.flags);
  });
});

describe('[T004][FR-004] pre-normalise length cap (max * 4)', () => {
  it('safeText(60) rejects a 241-character string and accepts a 60-character one', () => {
    const s = safeText(60);
    expect(s.safeParse('a'.repeat(60)).success).toBe(true);
    expect(s.safeParse('a'.repeat(241)).success).toBe(false);
    expect(s.safeParse('a'.repeat(61)).success).toBe(false);
  });
});
