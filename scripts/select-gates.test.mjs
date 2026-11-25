// Tests for scripts/select-gates.mjs (ADR-0013, decision 4).
// Run: node --test scripts/
// Expected gates come from the path rules in ADR-0013 and the owner's Phase 2.4 decisions,
// not from the implementation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectGates, GATE_ORDER } from './select-gates.mjs';

// Context stub: nothing is a new package and no dependencies changed, unless a test says so.
const ctx = (over = {}) => ({
  isNewPackage: () => false,
  depsChanged: () => false,
  addedText: '',
  ...over,
});
const gates = (files, over) => selectGates(files, ctx(over)).gates;

test('code-reviewer always runs, even for an empty or docs-only diff', () => {
  assert.deepEqual(gates([]), ['code-reviewer']);
  assert.deepEqual(gates(['docs/PRODUCT.md']), ['code-reviewer']);
});

test('theory code, theory fixtures and lesson text → theory-checker', () => {
  for (const f of [
    'packages/theory/src/interval.ts',
    'fixtures/theory/triads.json',
    'content/lessons/01-notes.md',
    'content/handbook/glossary.md',
  ]) {
    assert.ok(gates([f]).includes('theory-checker'), f);
  }
  assert.ok(!gates(['apps/web/src/ui/App.tsx']).includes('theory-checker'));
});

test('DSP, vision, audio I/O, inference runtime and bench → perf-auditor', () => {
  for (const f of [
    'packages/dsp/src/yin.rs',
    'packages/vision/src/homography.ts',
    'packages/audio-io/src/backend.ts',
    'packages/ml-runtime/src/session.ts',
    'bench/pitch/latency.bench.ts',
  ]) {
    assert.ok(gates([f]).includes('perf-auditor'), f);
  }
  assert.ok(!gates(['packages/theory/src/note.ts']).includes('perf-auditor'));
});

test('media, network and storage paths → privacy-auditor', () => {
  for (const f of [
    'packages/audio-io/src/mic.ts',
    'packages/vision/src/camera.ts',
    'services/sync/app/main.py',
    'apps/web/src/infrastructure/storage/idb.ts',
    'apps/web/src/infrastructure/network/fetchClient.ts',
    'apps/web/src/sw.ts',
    'apps/web/src/infrastructure/telemetry.ts',
  ]) {
    assert.ok(gates([f]).includes('privacy-auditor'), f);
  }
  assert.ok(!gates(['packages/theory/src/scale.ts']).includes('privacy-auditor'));
});

test('media or network APIs in added lines → privacy-auditor, whatever the path', () => {
  for (const snippet of [
    'navigator.mediaDevices.getUserMedia({ audio: true })',
    'new MediaRecorder(stream)',
    'await fetch(url)',
    'new WebSocket(u)',
    'navigator.sendBeacon(u, b)',
    'indexedDB.open("x")',
    'localStorage.setItem("k", v)',
  ]) {
    assert.ok(gates(['apps/web/src/ui/Thing.tsx'], { addedText: snippet }).includes('privacy-auditor'), snippet);
  }
});

test('dependencies, lockfiles, CI, Docker, tool config and input parsing → security-reviewer', () => {
  for (const f of [
    'package.json',
    'apps/web/package.json',
    'pnpm-lock.yaml',
    'packages/dsp/Cargo.toml',
    'Cargo.lock',
    'ml/requirements.txt',
    'ml/pyproject.toml',
    '.github/workflows/ci.yml',
    'Dockerfile',
    'services/sync/docker-compose.yml',
    '.mcp.json',
    '.claude/settings.json',
    'apps/web/src/infrastructure/content/lessonParser.ts',
    'apps/web/src/application/importProfile.ts',
    'content/packs/general-theory.yaml',
    'services/sync/app/auth.py',
  ]) {
    assert.ok(gates([f]).includes('security-reviewer'), f);
  }
  assert.ok(!gates(['packages/theory/src/chord.ts']).includes('security-reviewer'));
});

test('new package or changed dependencies → architecture-reviewer', () => {
  assert.ok(gates(['packages/learner/src/index.ts'], { isNewPackage: (d) => d === 'packages/learner' }).includes('architecture-reviewer'));
  assert.ok(gates(['apps/web/package.json'], { depsChanged: (p) => p === 'apps/web/package.json' }).includes('architecture-reviewer'));
  // A package.json edit that doesn't change dependencies (e.g. a script) is not an architecture gate.
  assert.ok(!gates(['apps/web/package.json']).includes('architecture-reviewer'));
  assert.ok(!gates(['packages/theory/src/note.ts']).includes('architecture-reviewer'));
});

test('ml/ and model artefacts → ml-evaluator; data/ → dataset-curator', () => {
  assert.ok(gates(['ml/configs/pitch.yaml']).includes('ml-evaluator'));
  assert.ok(gates(['apps/web/public/models/pitch.onnx']).includes('ml-evaluator'));
  assert.ok(gates(['data/guitarset/manifest.csv']).includes('dataset-curator'));
  assert.ok(gates(['data/guitarset/DATASET_CARD.md']).includes('dataset-curator'));
});

test('Windows backslash paths are normalised', () => {
  assert.ok(gates(['packages\\theory\\src\\note.ts']).includes('theory-checker'));
});

test('output is de-duplicated, in GATE_ORDER, with code-reviewer first', () => {
  const g = gates(['packages/audio-io/src/mic.ts', 'packages/audio-io/src/mic2.ts', 'package.json']);
  assert.equal(g[0], 'code-reviewer');
  assert.equal(new Set(g).size, g.length);
  const idx = g.map((x) => GATE_ORDER.indexOf(x));
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b));
});

test('reasons name the files that triggered each gate', () => {
  const r = selectGates(['packages/theory/src/note.ts'], ctx()).reasons;
  assert.deepEqual(r['theory-checker'], ['packages/theory/src/note.ts']);
});

test('content scan covers source files only, not tests, e2e, scripts or docs', async () => {
  const { SCANNED_SOURCE } = await import('./select-gates.mjs');
  assert.ok(SCANNED_SOURCE('apps/web/src/infrastructure/mic.ts'));
  assert.ok(SCANNED_SOURCE('packages/dsp/src/lib.rs'));
  for (const f of ['apps/web/src/a.test.ts', 'apps/web/e2e/flow.spec.ts', 'packages/x/__tests__/a.ts', 'scripts/select-gates.mjs', 'docs/THREAT-MODEL.md']) {
    assert.ok(!SCANNED_SOURCE(f), f);
  }
});

test('drill generation and the fretboard component are theory output → theory-checker (T099a gap)', () => {
  for (const f of ['apps/web/src/domain/drills/generate.ts', 'apps/web/src/domain/drills/types.ts', 'apps/web/src/ui/fretboard/Fretboard.tsx']) {
    assert.ok(gates([f]).includes('theory-checker'), f);
  }
  assert.ok(!gates(['apps/web/src/ui/screens/HomeScreen.tsx']).includes('theory-checker'));
});
