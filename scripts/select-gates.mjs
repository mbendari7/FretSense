#!/usr/bin/env node
// select-gates: print the review gates a diff requires (ADR-0013, decision 4).
//
// Usage:
//   node scripts/select-gates.mjs                 # git diff --name-only HEAD + untracked files
//   node scripts/select-gates.mjs a.ts b/c.json   # explicit file list
//   node scripts/select-gates.mjs --json          # {"gates": [...], "reasons": {gate: [files]}}
//
// The printed gates are the minimum. The caller must run every one of them; it may add a gate,
// never drop one. Plain Node, no dependencies.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const GATE_ORDER = [
  'code-reviewer',
  'theory-checker',
  'perf-auditor',
  'privacy-auditor',
  'security-reviewer',
  'architecture-reviewer',
  'ml-evaluator',
  'dataset-curator',
];

const PACKAGE_ROOTS = ['packages', 'apps', 'services'];

// Path rules: gate → list of regexes on the forward-slash path.
const PATH_RULES = {
  'theory-checker': [
    /^packages\/theory\//,
    /^fixtures\/theory\//,
    /^content\/(lessons|handbook)\//,
    /^apps\/web\/src\/domain\/drills\//,
    /^apps\/web\/src\/ui\/fretboard\//,
  ],
  'perf-auditor': [
    /^packages\/(dsp|vision|audio-io|ml-runtime)\//,
    /^bench\//,
  ],
  'privacy-auditor': [
    /^packages\/(audio-io|vision)\//,
    /^services\/sync\//,
    /(^|[\/._-])(camera|microphone|mic|media|recorder|recording|storage|persist|persistence|indexeddb|idb|network|http|fetch\w*|sync|telemetry|analytics|service-?worker|sw)([\/._-]|$)/i,
  ],
  'security-reviewer': [
    /(^|\/)package\.json$/,
    /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|Cargo\.toml|Cargo\.lock|pyproject\.toml|poetry\.lock|uv\.lock)$/,
    /(^|\/)requirements[^/]*\.txt$/,
    /^\.github\//,
    /(^|\/)(Dockerfile[^/]*|docker-compose[^/]*\.ya?ml|\.dockerignore)$/,
    /(^|\/)\.env[^/]*$/,
    /^\.mcp\.json$/,
    /^\.claude\/settings[^/]*\.json$/,
    /(^|\/)[^/]*(pars(e|er|ing)|import|loader|schema|validat|frontmatter|auth|jwt|crypto)[^/]*\.[a-z]+$/i,
    /^content\/packs\//,
    /^services\//,
  ],
  'ml-evaluator': [
    /^ml\//,
    /\.(onnx|ort|tflite|pt|pth|safetensors)$/i,
    /(^|\/)MODEL_CARD\.md$/,
  ],
  'dataset-curator': [/^data\//, /(^|\/)DATASET_CARD\.md$/],
};

// Content rules on added lines: media, network and storage APIs → privacy-auditor.
const PRIVACY_API = /\b(getUserMedia|getDisplayMedia|MediaRecorder|enumerateDevices|fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|indexedDB|localStorage|sessionStorage|caches\.open|navigator\.storage|createSyncAccessHandle|serviceWorker)\b/;

// Only non-test source files are scanned for API use (tests and docs name APIs without using them).
export const SCANNED_SOURCE = (f) =>
  /\.(ts|tsx|js|jsx|mjs|cjs|rs|py)$/.test(f) &&
  !/(\.test\.|\.spec\.|__tests__\/|(^|\/)tests?\/|(^|\/)e2e\/|^scripts\/)/.test(f);

export const normalise = (p) => p.replace(/\\/g, '/').replace(/^\.\//, '');

/**
 * @param {string[]} files  changed paths
 * @param {{isNewPackage:(dir:string)=>boolean, depsChanged:(pkgJson:string)=>boolean, addedText:string}} ctx
 * @returns {{gates:string[], reasons:Record<string,string[]>}}
 */
export function selectGates(files, ctx) {
  const reasons = { 'code-reviewer': ['(always)'] };
  const add = (gate, why) => {
    (reasons[gate] ??= []);
    if (!reasons[gate].includes(why)) reasons[gate].push(why);
  };

  for (const raw of files) {
    const f = normalise(raw);
    if (!f) continue;
    for (const [gate, rules] of Object.entries(PATH_RULES)) {
      if (rules.some((r) => r.test(f))) add(gate, f);
    }
    const parts = f.split('/');
    if (PACKAGE_ROOTS.includes(parts[0]) && parts.length > 2) {
      const dir = `${parts[0]}/${parts[1]}`;
      if (ctx.isNewPackage(dir)) add('architecture-reviewer', `${f} (new package ${dir})`);
    }
    if (/(^|\/)package\.json$/.test(f) && ctx.depsChanged(f)) {
      add('architecture-reviewer', `${f} (dependencies changed)`);
    }
  }
  if (ctx.addedText && PRIVACY_API.test(ctx.addedText)) {
    add('privacy-auditor', '(media/network/storage API in added lines)');
  }

  const gates = GATE_ORDER.filter((g) => reasons[g]);
  return { gates, reasons: Object.fromEntries(gates.map((g) => [g, reasons[g]])) };
}

// ---------- git-backed context (CLI only) ----------
const git = (args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
};
const lines = (s) => (s ?? '').split(/\r?\n/).filter(Boolean);
const DEP_KEYS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const depsOf = (json) => {
  try {
    const o = JSON.parse(json);
    return JSON.stringify(DEP_KEYS.map((k) => Object.entries(o[k] ?? {}).sort()));
  } catch {
    return null;
  }
};

export function gitContext(files) {
  const untracked = new Set(lines(git(['ls-files', '--others', '--exclude-standard'])).map(normalise));
  let added = '';
  let current = '';
  for (const l of (git(['diff', '-U0', 'HEAD']) ?? '').split(/\r?\n/)) {
    if (l.startsWith('+++ ')) current = normalise(l.slice(4).replace(/^b\//, ''));
    else if (l.startsWith('+') && SCANNED_SOURCE(current)) added += l.slice(1) + '\n';
  }
  for (const f of files) {
    if (untracked.has(normalise(f)) && SCANNED_SOURCE(normalise(f)) && existsSync(f)) {
      try { added += '\n' + readFileSync(f, 'utf8'); } catch { /* binary or unreadable */ }
    }
  }
  return {
    isNewPackage: (dir) => (git(['ls-tree', '--name-only', 'HEAD', `${dir}/`]) ?? '').trim() === '',
    depsChanged: (p) => {
      const before = git(['show', `HEAD:${p}`]);
      if (before === null) return true; // a new package.json
      const after = existsSync(p) ? readFileSync(p, 'utf8') : '{}';
      return depsOf(before) !== depsOf(after);
    },
    addedText: added,
  };
}

export function changedFiles() {
  const tracked = lines(git(['diff', '--name-only', 'HEAD']));
  const untracked = lines(git(['ls-files', '--others', '--exclude-standard']));
  return [...new Set([...tracked, ...untracked].map(normalise))];
}

function main(argv) {
  const json = argv.includes('--json');
  const why = argv.includes('--why');
  const explicit = argv.filter((a) => !a.startsWith('--'));
  const files = explicit.length ? explicit.map(normalise) : changedFiles();
  const result = selectGates(files, gitContext(files));
  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    for (const g of result.gates) {
      process.stdout.write(why ? `${g}\t${result.reasons[g].join(', ')}\n` : `${g}\n`);
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2));
