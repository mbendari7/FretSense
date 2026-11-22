# code-reviewer r1: v0.1 build (2026-11-22)

**Verdict (copied):** BLOCK. One BLOCKER and several MAJOR findings, all fixable in a small number of spots. The domain layering is clean. Content rendering is safe as configured.

## Findings
| # | Sev | Finding (short) | Status |
|---|-----|-----------------|--------|
| 1 | BLOCKER | Re-completing a stage after reset minted a duplicate natural key (`byLesson` unique index), and the write aborted | **Applied**: markStage revives the tombstoned record (app.ts) |
| 2 | MAJOR | mergeCompletion ignores tombstones | **Deferred**: spec change FN-10 (product-owner) first |
| 3 | MAJOR | Imported instruments not re-validated; geometryId not recomputed | **Applied**: validateProfile on import, geometry recomputed |
| 4 | MAJOR | Records with another profile's localProfileId could be restored | **Applied**: rejected at validation |
| 5 | MAJOR | Future-bound check skipped most HLC fields | **Applied**: every HLC field checked |
| 6 | MAJOR | Fresh stamps minted before the receive rule; preview advanced the clock | **Applied**: dry-run preview; receive then stamp inside apply |
| 7 | MAJOR | HLC state per tab; two tabs can mint equal HLCs | **Deferred**: needs read-advance inside the IndexedDB transaction (task to add) |
| 8 | MAJOR | 20 MB vs spec 50 MB | **Applied**: 50 MB in code, data-model.md and contracts/profile-export.md (product-owner FN-10) |
| 9 | MAJOR | NFC / safe-text / length checks only on names | **Deferred**: schema-wide refinement task |
| 10 | MAJOR | Export/import options and copy idempotence | **Partly applied**: "include settings" off by default, delayed revokeObjectURL. Apply-settings option and copy idempotence deferred (spec change FN-10) |
| 11 | MAJOR | Visibility change during feedback re-asked an answered question | **Applied**: `answered` session state |
| 12 | MAJOR | Lesson drill marked done on early exit | **Applied**: only marked when completed in full |
| 13 | MAJOR | Off-string taps judged wrong; no low/high qualifier | **Applied**: ignored with a hint; low/high qualifiers |
| 14 | MAJOR | FR-031 spelled note sets | **Deferred**: FN-5 |
| 15 | MAJOR | FR-035/036 defaults and window | **Deferred**: FN-8 |
| 16 | MAJOR | FR-056/057 pattern rules; itemKey vs FR-041 | **Deferred**: FN-8 |
| 17 | MAJOR | Walking bass simplified | **Applied (provisional)**: drill hidden (FN-7); 2–8 chord validation added |
| 18 | MINOR | Weighting histories not family-scoped; undocumented re-draw | Deferred |
| 19 | MINOR | 1.2 s auto-advance vs 1.5 s | **Applied** |
| 20 | MINOR | canonicalJson sorts by UTF-16 unit | **Applied** (r2) |
| 21 | MINOR | Two commits per instrument action; errors swallowed | **Applied**: one transaction; errors propagate |
| 22 | MINOR | clobberPrefix '' and protocol-relative URLs | **Applied** |
| 23 | MINOR | hlcSend bound with a corrupted meta | Deferred |
| 24 | MINOR | Dead code | **Applied** |
| 25 | MAJOR (process) | apps/web written before its tests | Recorded in docs/AI-WORKFLOW.md; test-writer writing tests |

**Owner sign-off:** ______________________
