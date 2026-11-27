/**
 * T004 (red, test-first): every free-text string field of the v2 record schemas goes through
 * safeText (NFC; control, bidi, zero-width rejected) [FR-004, FR-014; research R6].
 *
 * Text fields are enumerated from data-model.md §2. A completeness check walks the string leaves of
 * each valid fixture and requires each one to be either a tested text field or a declared
 * structured field (uuid, HLC, enum, kebab id, order key), so a new free-text field cannot be added
 * to a fixture unnoticed. Forbidden code points are listed independently of safeText.ts.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { gearSchema, onboardingSchema, pathItemSchema, pathSchema, userPackSchema } from './records';

const W = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const H1 = `2026-11-22T12:00:00.000Z-0000-${W}`;
const PID = '11111111-1111-4111-8111-111111111111';
const U = (n: number) => `${n.toString().padStart(8, '0')}-2222-4222-8222-222222222222`;
const common = (id: string) => ({ id, localProfileId: PID, created: H1, updated: H1, schemaVersion: 1, deleted: false });

const gearI = { ...common(U(1)), kind: 'interface', name: 'USB interface', namePattern: 'usb', notes: 'note',
  channels: [{ index: 1, label: 'Input 1', hint: 'instrument', signal: 'dry' }], directMonitoring: true };
const gearC = { ...common(U(2)), kind: 'camera', name: 'Cam', placement: 'Left' };
const path = { ...common(U(5)), name: 'Start here', origin: 'default' };
const pathItem = { ...common(U(6)), pathId: U(5), ref: { kind: 'lesson', lessonId: 'a-b' }, reason: 'because', fallback: false, orderKey: 'a' };
const pack = { ...common(U(7)), packId: 'my-book', title: 'My book', source: 'A Book',
  sections: [{ title: 'Chapter 1', label: 'Ch 1', lessons: ['a-b'] }] };
const onboarding = { ...common(U(4)), goals: ['songs-i-like'], instrumentIds: [U(10)], genres: ['genre:rock'], answeredAt: H1, fieldUpdated: { goals: H1 } };

type Set = (rec: any, text: string) => unknown;
interface Case { schema: { safeParse: (v: unknown) => any }; valid: object; set: Set; path: string }
const CASES: Record<string, Case> = {
  'gear.name': { schema: gearSchema, valid: gearI, path: 'name', set: (r, t) => ({ ...r, name: t }) },
  'gear.namePattern': { schema: gearSchema, valid: gearI, path: 'namePattern', set: (r, t) => ({ ...r, namePattern: t }) },
  'gear.notes': { schema: gearSchema, valid: gearI, path: 'notes', set: (r, t) => ({ ...r, notes: t }) },
  'gear.channels[].label': { schema: gearSchema, valid: gearI, path: 'channels.0.label', set: (r, t) => ({ ...r, channels: [{ ...r.channels[0], label: t }] }) },
  'gear.placement': { schema: gearSchema, valid: gearC, path: 'placement', set: (r, t) => ({ ...r, placement: t }) },
  'paths.name': { schema: pathSchema, valid: path, path: 'name', set: (r, t) => ({ ...r, name: t }) },
  'pathItems.reason': { schema: pathItemSchema, valid: pathItem, path: 'reason', set: (r, t) => ({ ...r, reason: t }) },
  'packs.title': { schema: userPackSchema, valid: pack, path: 'title', set: (r, t) => ({ ...r, title: t }) },
  'packs.source': { schema: userPackSchema, valid: pack, path: 'source', set: (r, t) => ({ ...r, source: t }) },
  'packs.sections[].title': { schema: userPackSchema, valid: pack, path: 'sections.0.title', set: (r, t) => ({ ...r, sections: [{ ...r.sections[0], title: t }] }) },
  'packs.sections[].label': { schema: userPackSchema, valid: pack, path: 'sections.0.label', set: (r, t) => ({ ...r, sections: [{ ...r.sections[0], label: t }] }) },
};

/** Structured (non-free-text) string leaves: uuid, HLC, enum, kebab id, tag, order key. */
const STRUCTURED = new Set([
  'id', 'localProfileId', 'created', 'updated', 'kind', 'origin', 'pathId', 'orderKey', 'packId', 'level',
  'channels.0.hint', 'channels.0.signal', 'answeredAt', 'ref.kind', 'ref.lessonId', 'ref.drillId', 'presetOrigin', 'deletedBy',
]);
const STRUCTURED_PREFIX = ['sections.0.lessons', 'goals', 'instrumentIds', 'genres', 'fieldUpdated'];

function leaves(v: unknown, p = ''): string[] {
  if (typeof v === 'string') return [p];
  if (Array.isArray(v)) return v.flatMap((x, i) => leaves(x, p ? `${p}.${i}` : `${i}`));
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => leaves(x, p ? `${p}.${k}` : k));
  return [];
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const FORBIDDEN = [
  ...range(0x00, 0x1f), ...range(0x7f, 0x9f), 0x061c, ...range(0x200b, 0x200f), ...range(0x202a, 0x202e),
  ...range(0x2066, 0x2069), 0xfeff,
];
const cp = (c: number) => String.fromCodePoint(c);

describe('[T004][FR-004,FR-014] safeText coverage of the v2 schemas', () => {
  it('completeness: every string leaf of every valid fixture is a tested text field or a declared structured field', () => {
    const tested = new Set(Object.values(CASES).map((c) => c.path));
    for (const rec of [gearI, gearC, path, pathItem, pack, onboarding]) {
      for (const leaf of leaves(rec)) {
        const generic = leaf.replace(/\.\d+\./g, '.0.');
        const known = tested.has(leaf) || STRUCTURED.has(leaf) || STRUCTURED.has(generic) || STRUCTURED_PREFIX.some((p) => leaf.startsWith(p));
        expect(known, `untested string field: ${leaf}`).toBe(true);
      }
    }
  });

  describe.each(Object.entries(CASES))('%s', (_name, c) => {
    it('baseline fixture parses', () => expect(c.schema.safeParse(c.valid).success).toBe(true));

    it('rejects every control, bidi, zero-width and BOM code point (also mid-string)', () => {
      for (const code of FORBIDDEN) {
        const ch = cp(code);
        expect(c.schema.safeParse(c.set(c.valid, `a${ch}b`)).success, `U+${code.toString(16)}`).toBe(false);
      }
    });

    it('NFC-normalises: decomposed input parses to the composed form', () => {
      const r = c.schema.safeParse(c.set(c.valid, 'Café'));
      expect(r.success).toBe(true);
      if (!r.success) return;
      const get = (o: any, p: string) => p.split('.').reduce((a, k) => a[k], o);
      expect(get(r.data, c.path)).toBe('Café');
    });

    it('property: any string containing a forbidden code point is rejected', () => {
      fc.assert(fc.property(fc.string({ maxLength: 8 }), fc.constantFrom(...FORBIDDEN), fc.string({ maxLength: 8 }), (a, f, b) =>
        !c.schema.safeParse(c.set(c.valid, `${a}${cp(f)}${b}`)).success));
    });
  });
});
