// Tests for scripts/check-fr-ids.mjs (ADR-0013: the spec split must keep every FR/SC ID).
// Run: node --test scripts/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idsIn } from './check-fr-ids.mjs';

test('collects FR and SC IDs, including letter suffixes, de-duplicated and sorted', () => {
  const text = 'FR-010 then FR-002, again FR-002. Also FR-031a and SC-004; SC-012.';
  assert.deepEqual(idsIn(text), ['FR-002', 'FR-010', 'FR-031a', 'SC-004', 'SC-012']);
});

test('sorts numerically, then by suffix', () => {
  assert.deepEqual(idsIn('FR-100 FR-9 FR-031b FR-031 FR-031a'), ['FR-9', 'FR-031', 'FR-031a', 'FR-031b', 'FR-100']);
});

test('ignores look-alikes such as NFR-001, FR-xxx and lowercase fr-001', () => {
  assert.deepEqual(idsIn('NFR-001 FR-xxx fr-001 XFR-002'), []);
});
