/** T003 / FR-010: optional lesson `estimatedMinutes`, integer 1-600 (data-model.md section 4). */
import { describe, expect, it } from 'vitest';
import { lessonFrontmatterSchema } from './schemas';

const base = { id: 'l-one', title: 'T', level: 'beginner', tags: [], instruments: ['guitar'], concepts: [], drills: [] };
describe('FR-010 lesson estimatedMinutes', () => {
  it('omitting it is valid', () => expect(lessonFrontmatterSchema.safeParse(base).success).toBe(true));
  it.each([1, 45, 600])('accepts %s', (n) => expect(lessonFrontmatterSchema.safeParse({ ...base, estimatedMinutes: n }).success).toBe(true));
  it.each([0, 601, 1.5, -3, '10'])('rejects %s', (n) => expect(lessonFrontmatterSchema.safeParse({ ...base, estimatedMinutes: n }).success).toBe(false));
});
