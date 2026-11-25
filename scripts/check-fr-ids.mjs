#!/usr/bin/env node
// check-fr-ids: print the sorted set of FR-/SC- IDs found across files (ADR-0013).
// Used to prove a spec split moved every requirement: run it before and after, and diff the output.
//
// Usage: node scripts/check-fr-ids.mjs <file...>    (one ID per line)
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ID = /(?<![A-Za-z0-9-])(FR|SC)-(\d+)([a-z]?)(?![A-Za-z0-9])/g;

export function idsIn(text) {
  const found = new Map();
  for (const m of text.matchAll(ID)) found.set(m[0], [m[1], Number(m[2]), m[3]]);
  return [...found.entries()]
    .sort(([, a], [, b]) => a[0].localeCompare(b[0]) || a[1] - b[1] || a[2].localeCompare(b[2]))
    .map(([id]) => id);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const files = process.argv.slice(2);
  if (!files.length) {
    process.stderr.write('usage: check-fr-ids.mjs <file...>\n');
    process.exit(2);
  }
  const text = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  process.stdout.write(idsIn(text).join('\n') + '\n');
}
