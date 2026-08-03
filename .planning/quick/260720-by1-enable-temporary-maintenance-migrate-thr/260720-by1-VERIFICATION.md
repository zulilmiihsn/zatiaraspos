---
phase: quick-260720-by1-enable-temporary-maintenance-migrate-thr
verified: 2026-07-20
status: passed
score: 8/8
---

# Quick Task 260720-by1 Verification

## Verdict

All 8/8 requirements pass. Production restoration and migration goals are operationally achieved: canonical Pages is live, maintenance is absent, unauthenticated guards respond correctly, realtime health passes, the deployed service worker matches the sealed artifact, and all three production D1 shards independently audit as 0015/0016 applied with no temporary settings table.

GAP-01 is closed locally. The recovery path is now genuinely actionable but default-deny: it validates the sealed manifest and restrictive ACL, binds the exact database UUID/bookmark/deadline, requires explicit environment approval plus a real interactive TTY and exact typed confirmation, then constructs one secret-safe allowlisted Wrangler restore invocation. Self-tests and denial probes did not spawn a remote command. No restore was attempted during verification.

## Independent Evidence

| Requirement                   | Evidence                                                                                                                                                                                                                                                      | Result |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Production alias restored     | Live cache-busted `/` and `/login` returned 200 and did not contain the maintenance marker.                                                                                                                                                                   | PASS   |
| Unauthenticated API guards    | Live product, POS catalog, and realtime endpoints each returned 401.                                                                                                                                                                                          | PASS   |
| Restored immutable deployment | Current production deployment list starts with restored deployment `0274cb1d-442c-4fe2-83e2-bb3e847a82b6`; its immutable root returned 200 without maintenance.                                                                                               | PASS   |
| Realtime Worker               | Live `/health` returned HTTP 200 and exact service health JSON.                                                                                                                                                                                               | PASS   |
| Service-worker identity       | Canonical and restored immutable `/sw.js` both hashed to `86f4f9de6cc5275794a839396e52b160f8fd0708a771bcec3685df58abeec993`.                                                                                                                                  | PASS   |
| Sealed local artifact         | `artifact-manifest.json` records 133 files. Independent full path/size/SHA comparison found 133 actual files, zero mismatches, and zero extras. `_worker.js` and `sw.js` match recorded hashes.                                                               | PASS   |
| Samarinda schema              | Safe-wrapper read-only audit: 0015 applied, 0016 applied, no temporary table, seven core query shapes pass, financial baseline/HMAC preparation/audit window pass.                                                                                            | PASS   |
| Balikpapan schema             | Same independent safe-wrapper audit result as Samarinda.                                                                                                                                                                                                      | PASS   |
| Berau schema                  | Same independent safe-wrapper audit result as Samarinda.                                                                                                                                                                                                      | PASS   |
| Recovery metadata             | Manifest has three production entries, exact configured database IDs, bookmarks/timestamps, 7-day deadlines still in the future, `restore_executed: false`, and current-user/SYSTEM-only ACL. The wrapper exposes an actionable, strictly gated restore path. | PASS   |
| Fail-closed cleanup evidence  | Summary records successful DELETE plus zero transaction, ledger, and idempotency residue. Harness code requires all three before marking journal cleaned; no task journal remains. Mutation was not repeated by verifier.                                     | PASS   |
| Browser classification        | Summary clearly states browser login/session failed before checkout and no browser transaction/journal was created. Browser success is not claimed.                                                                                                           | PASS   |
| Local quality/integrity       | Wrapper self-test and all three syntax checks passed. Fresh `pnpm lint` and `git diff --check` exited 0.                                                                                                                                                      | PASS   |

## GAP-01 Closure Evidence

- `recovery-manifest.json` passes byte-for-byte readback around validation and has no inherited ACL entries; only `SYSTEM:(F)` and the current user `(F)` are present.
- All three manifest entries bind the exact configured production database UUID, a valid bookmark, an RFC3339 timestamp, and a still-valid deadline exactly seven days later. `restore_executed` remains `false`.
- Restore parsing accepts only `--database <name> --bookmark <value> --confirm-bookmark <same value>`. Unknown, missing, or mismatched values fail before command construction.
- Approval requires `ALLOW_D1_TIME_TRAVEL_RESTORE=YES`, both input and output attached to a real TTY, and the exact typed confirmation `RESTORE <database> <bookmark>`.
- After all gates pass, the only constructed Wrangler arguments are `d1 time-travel restore <database> --bookmark <bookmark> --config wrangler.pages.jsonc --json`.
- Execution uses `shell: false`, loads secrets only into the child environment, scans child output for loaded secret values, and redacts errors/output before surfacing them.
- Wrapper self-tests cover ACL/readback, default denial, bookmark mismatch, UUID mismatch, non-TTY denial, expired deadline, and exact approved argv. The approved-argv test is a pure dry run and never calls the process-spawn path.
- Fresh noninteractive probes independently confirmed denial both without the approval environment variable and with approval set but no TTY. Both stopped before remote execution.

## Execution Deviations

These do not invalidate the current production schema, but should remain in the record:

1. Samarinda 0015 was retried after the first wrapper attempt failed and read-only inspection proved the atomic batch rolled back. This used an explicit one-time override rather than the original first-failure stop rule.
2. The planned seven-term `Q_CORE_COUNTS` query exceeded D1's compound-select limit. The wrapper now uses seven separately allowlisted read-only count queries. This is safe and self-tested, but differs from the plan's originally enumerated query contract.

## Human Verification

No human action is required to confirm current API/schema or GAP-01 closure. Browser UI UAT remains limited and may be rerun separately after diagnosing isolated cashier session persistence.
