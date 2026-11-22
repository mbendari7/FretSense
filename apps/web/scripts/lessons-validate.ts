import { resolve } from 'node:path';
import { compileContent, ContentError } from '../content-plugin/compile';

/** `pnpm lessons:validate` (FR-023): same checks as the build. */
try {
  const c = compileContent(resolve(import.meta.dirname, '../../../content'));
  console.log(`OK: ${c.lessons.length} lessons, ${c.packs.length} packs`);
} catch (e) {
  console.error(e instanceof ContentError ? e.message : e);
  process.exit(1);
}
