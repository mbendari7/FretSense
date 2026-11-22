import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import {
  lessonFrontmatterSchema, packSchema, tagVocabularySchema,
  type CompiledContent, type CompiledLesson, type CurriculumPack, type TagVocabulary,
} from '../src/domain/content/schemas';

/** Research R7: build-time compile + validate. Every error names file and field (FR-023). */
export class ContentError extends Error {}

const YAML_OPTS = { maxAliasCount: 0, uniqueKeys: true, prettyErrors: true } as const;
const MAX_BYTES = 256 * 1024;

const schema = {
  ...defaultSchema,
  tagNames: ['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'em', 'strong', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'img', 'br'],
  attributes: { a: ['href'], img: ['src', 'alt'], th: ['align'], td: ['align'] },
  protocols: { href: ['http', 'https'], src: [] },
};

function markdownToHtml(md: string, file: string): string {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(md);
  const errors: string[] = [];
  visit(tree, (node: { type: string; position?: { start: { line: number } }; url?: string; depth?: number }) => {
    const line = node.position?.start.line ?? 0;
    if (node.type === 'html') errors.push(`${file}:${line}: raw HTML is not allowed`);
    if (node.type === 'heading' && node.depth === 1) errors.push(`${file}:${line}: h1 is reserved for the title`);
    if (node.type === 'image' && node.url && (/^[a-z]+:/i.test(node.url) || node.url.startsWith('//') || node.url.includes('..'))) errors.push(`${file}:${line}: images must be local files inside content/`);
    if (node.type === 'link' && node.url && ((/^[a-z]+:/i.test(node.url) && !/^https?:/i.test(node.url)) || node.url.startsWith('//'))) errors.push(`${file}:${line}: link scheme not allowed`);
    if (['footnoteDefinition', 'footnoteReference', 'delete'].includes(node.type)) errors.push(`${file}:${line}: ${node.type} is not supported`);
  });
  if (errors.length) throw new ContentError(errors.join('\n'));
  const html = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeSanitize, schema).use(rehypeStringify).processSync(md);
  // rel/target after sanitising: external links open safely in a new tab.
  return String(html).replace(/<a href="(https?:[^"]*)">/g, '<a href="$1" rel="noopener noreferrer" target="_blank">');
}

function splitSections(body: string): { read: string; see: string } {
  const parts = body.split(/^## /m);
  let read = '';
  let see = '';
  for (const part of parts) {
    if (part.startsWith('Read')) read = part.slice(4);
    else if (part.startsWith('Notes for See')) see = part.slice('Notes for See'.length);
  }
  return { read: read.replace(/<!--[\s\S]*?-->/g, '').trim(), see: see.replace(/<!--[\s\S]*?-->/g, '').trim() };
}

const issues = (file: string, e: { issues: { path: PropertyKey[]; message: string }[] }) =>
  e.issues.map((i) => `${file}: ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');

export function compileLesson(text: string, file: string, tags?: TagVocabulary): CompiledLesson {
  if (Buffer.byteLength(text) > MAX_BYTES) throw new ContentError(`${file}: larger than 256 kB`);
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) throw new ContentError(`${file}: missing YAML frontmatter`);
  let fm: unknown;
  try {
    fm = parseYaml(m[1]!, YAML_OPTS);
  } catch (e) {
    throw new ContentError(`${file}: frontmatter: ${(e as Error).message}`);
  }
  const parsed = lessonFrontmatterSchema.safeParse(fm);
  if (!parsed.success) throw new ContentError(issues(file, parsed.error));
  if (tags) {
    for (const t of parsed.data.tags) {
      const [ns, v] = t.split(':') as [keyof TagVocabulary, string];
      if (!tags[ns]?.includes(v)) throw new ContentError(`${file}: tags: "${t}" is not in content/tags.yaml`);
    }
  }
  const { read, see } = splitSections(m[2]!);
  const { play: _p, camera_coach: _c, ...rest } = parsed.data;
  return { ...rest, readHtml: markdownToHtml(read, file), seeHtml: see ? markdownToHtml(see, file) : '' };
}

export function compilePack(text: string, file: string): CurriculumPack {
  const parsed = packSchema.safeParse(parseYaml(text, YAML_OPTS));
  if (!parsed.success) throw new ContentError(issues(file, parsed.error));
  return parsed.data;
}

/** Compiles content/ (lessons, packs, tags) and cross-checks references. */
export function compileContent(contentDir: string): CompiledContent {
  const rel = (f: string) => relative(join(contentDir, '..'), f).replace(/\\/g, '/');
  const tagsFile = join(contentDir, 'tags.yaml');
  const tagsParsed = tagVocabularySchema.safeParse(existsSync(tagsFile) ? parseYaml(readFileSync(tagsFile, 'utf8'), YAML_OPTS) : {});
  if (!tagsParsed.success) throw new ContentError(issues('content/tags.yaml', tagsParsed.error));
  const tags = tagsParsed.data;
  const lessonDir = join(contentDir, 'lessons');
  const lessons = readdirSync(lessonDir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .sort()
    .map((f) => compileLesson(readFileSync(join(lessonDir, f), 'utf8'), rel(join(lessonDir, f)), tags));
  const ids = new Set<string>();
  for (const l of lessons) {
    if (ids.has(l.id)) throw new ContentError(`duplicate lesson id "${l.id}"`);
    ids.add(l.id);
  }
  const packDir = join(contentDir, 'packs');
  const packs = readdirSync(packDir)
    .filter((f) => f.endsWith('.yaml') && !f.startsWith('_'))
    .sort()
    .map((f) => {
      const p = compilePack(readFileSync(join(packDir, f), 'utf8'), rel(join(packDir, f)));
      p.sections.forEach((s, i) => s.lessons.forEach((id, j) => {
        if (!ids.has(id)) throw new ContentError(`${rel(join(packDir, f))}: sections.${i}.lessons.${j}: unknown lesson "${id}"`);
      }));
      return p;
    });
  return { lessons, packs, tags };
}
