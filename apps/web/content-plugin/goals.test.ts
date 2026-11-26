/**
 * T002 / FR-010: compileGoals(goalsYaml, tagsYaml) from ./compile. Mirrors compilePack: returns the goal list,
 * throws ContentError naming the problem. Assumed file shape (data-model.md Goal; confirm): top-level `goals:` list.
 * Expected values: owner-approved mapping, spec 016 Clarifications 2026-11-25 (v0.1 goal -> tag mapping).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileGoals, ContentError } from './compile';

const contentDir = resolve(__dirname, '../../../content');
const tagsYaml = readFileSync(resolve(contentDir, 'tags.yaml'), 'utf8');
const goal = (o: Record<string, unknown>) =>
  `  - id: ${o.id ?? 'g-one'}\n    title: ${o.title ?? 'A goal'}\n    tags: [${(o.tags as string[] | undefined ?? ['topic:scales']).join(', ')}]\n${o.extra ?? ''}`;
const doc = (...g: string[]) => `goals:\n${g.join('')}`;

describe('FR-010 goals content', () => {
  it('the real content/goals.yaml compiles to the 6 approved goals in order', () => {
    const goals = compileGoals(readFileSync(resolve(contentDir, 'goals.yaml'), 'utf8'), tagsYaml);
    expect(goals.map((g) => g.id)).toEqual(['know-the-neck', 'chord-theory', 'solo-over-blues', 'soloing-general', 'bass-lines', 'songs-i-like']);
    expect(goals.map((g) => g.title)).toEqual([
      'Learn the notes on the neck', 'Understand chord theory', 'Solo over blues', 'Improvise and solo', 'Bass grooves and lines', 'Play the styles I like',
    ]);
    expect(goals[0]!.tags).toEqual(['goal:know-the-neck', 'topic:notes-on-the-neck', 'topic:octaves']);
    expect(goals[1]!.tags).toEqual(['goal:chord-theory', 'topic:chords', 'topic:intervals', 'topic:keys']);
    expect(goals[2]!.tags).toEqual(['goal:soloing', 'topic:scales', 'genre:blues']);
    expect(goals[3]!.tags).toEqual(['goal:soloing', 'topic:scales', 'topic:modes']);
    expect(goals[4]!.tags).toEqual(['goal:bass-lines', 'topic:bass-patterns', 'topic:chords']);
  });
  it('songs-i-like is genre-mapped with no tags', () => {
    const g = compileGoals(readFileSync(resolve(contentDir, 'goals.yaml'), 'utf8'), tagsYaml).find((x) => x.id === 'songs-i-like')!;
    expect(g.genreMapped).toBe(true);
    expect(g.tags).toEqual([]);
  });
  it('accepts a minimal valid goal', () => expect(compileGoals(doc(goal({})), tagsYaml)).toHaveLength(1));
  it('rejects a duplicate id', () => expect(() => compileGoals(doc(goal({}), goal({})), tagsYaml)).toThrow(ContentError));
  it('rejects an unknown tag', () => expect(() => compileGoals(doc(goal({ tags: ['topic:nonexistent'] })), tagsYaml)).toThrow(/nonexistent/));
  it('rejects empty tags without genreMapped', () => expect(() => compileGoals(doc(goal({ tags: [] })), tagsYaml)).toThrow(ContentError));
  it('accepts empty tags with genreMapped: true', () =>
    expect(compileGoals(doc(goal({ tags: [], extra: '    genreMapped: true\n' })), tagsYaml)[0]!.genreMapped).toBe(true));
  it('rejects a title longer than 80 chars', () => expect(() => compileGoals(doc(goal({ title: 'x'.repeat(81) })), tagsYaml)).toThrow(ContentError));
  it('accepts an 80-char title', () => expect(compileGoals(doc(goal({ title: 'x'.repeat(80) })), tagsYaml)).toHaveLength(1));
  it('rejects a YAML anchor/alias', () => {
    const y = `goals:\n  - id: g-one\n    title: A\n    tags: &a [topic:scales]\n  - id: g-two\n    title: B\n    tags: *a\n`;
    expect(() => compileGoals(y, tagsYaml)).toThrow(ContentError);
  });
  it('rejects unknown fields', () => expect(() => compileGoals(doc(goal({ extra: '    colour: red\n' })), tagsYaml)).toThrow(ContentError));
});
