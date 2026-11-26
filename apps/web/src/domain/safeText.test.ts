import { describe, expect, it } from 'vitest';
import { safeText } from './safeText';

// Reference sets are written out here independently of the implementation.
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const FORBIDDEN: number[] = [
  ...range(0x00, 0x1f), // C0 (includes \n, \t)
  ...range(0x7f, 0x9f), // DEL + C1
  ...range(0x202a, 0x202e), // bidi embeddings/overrides
  ...range(0x2066, 0x2069), // bidi isolates
  0x200e, 0x200f, // LRM / RLM
  ...range(0x200b, 0x200d), // zero-width space / non-joiner / joiner
  0xfeff, // BOM / ZWNBSP
];

describe('FR-016 safeText', () => {
  const s = safeText(20);

  it('NFC-normalises', () => {
    const r = s.safeParse('é');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe('é');
  });

  it.each(FORBIDDEN.map((c) => [`U+${c.toString(16).toUpperCase().padStart(4, '0')}`, c] as const))(
    'rejects %s',
    (_n, c) => {
      const ch = String.fromCodePoint(c);
      expect(s.safeParse(`a${ch}b`).success).toBe(false);
      expect(s.safeParse(ch).success).toBe(false);
    },
  );

  it('accepts normal text, accents and emoji', () => {
    for (const t of ['Strat', 'café', 'Ñandú', 'riff 🎸', 'a b-c_d.', '']) {
      expect(s.safeParse(t).success).toBe(true);
    }
  });

  it('length bound applies after NFC', () => {
    const s3 = safeText(3);
    expect(s3.safeParse('abc').success).toBe(true);
    expect(s3.safeParse('abcd').success).toBe(false);
    // 3 x (e + combining acute) = 6 code units raw, 3 after NFC
    expect(s3.safeParse('é'.repeat(3)).success).toBe(true);
    expect(s3.safeParse('é'.repeat(4)).success).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(s.safeParse(5).success).toBe(false);
    expect(s.safeParse(undefined).success).toBe(false);
  });
});
