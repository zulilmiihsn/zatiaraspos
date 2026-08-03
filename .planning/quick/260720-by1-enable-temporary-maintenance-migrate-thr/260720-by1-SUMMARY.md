---
phase: quick-260720-by1-enable-temporary-maintenance-migrate-thr
plan: '01'
subsystem: infra
tags: [cloudflare-pages, d1, maintenance, migration, smoke-test]
status: complete-with-browser-limitation
requires:
  - phase: quick-260718-esb-deploy-production-and-run-live-smoke-tes
    provides: deployed production artifact and missing-schema diagnosis
provides:
  - all three production D1 shards at migrations 0015 and 0016
  - exact sealed Pages artifact restored after marked maintenance
  - fail-closed API, checkout, realtime, and cleanup production proof
affects: [production, authentication, settings-security, live-smoke]
requirements-completed: [QUICK-MAINTENANCE-D1-MIGRATION]
completed: 2026-07-20
---

# Quick 260720-by1: Maintenance, D1 Migration, and Live Smoke

Production is restored and live. All three D1 shards passed missing-only migrations, preservation gates, and integrity checks. The exact pre-maintenance Pages artifact was restored without rebuilding. API/realtime smoke passed with zero residue. Browser UI smoke stopped before checkout because the isolated cashier session did not persist on `/pos`.

## Release and maintenance

| Evidence              | Result                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Branch / HEAD         | `dev` / `93f8795ef9d7576f2bb0a1bcedff7161939a1fa5`                                                |
| `deploy:check`        | PASS with process-only random signing key; nothing persisted or rotated                           |
| `pnpm check`          | PASS, 0 errors and 0 warnings                                                                     |
| `pnpm lint`           | PASS                                                                                              |
| `pnpm test:all`       | PASS                                                                                              |
| Final sealed build    | PASS; exactly one build after all gates; no later build                                           |
| Pre-maintenance Pages | `9aaa6981-ca6a-413f-b679-76b5c71104de`, `https://9aaa6981.zatiaraspos.pages.dev`                  |
| Maintenance Pages     | `b7285109-544a-4b56-85e1-717f5ab0eefb`, `https://b7285109.zatiaraspos.pages.dev`                  |
| Restored Pages        | `0274cb1d-442c-4fe2-83e2-bb3e847a82b6`, `https://0274cb1d.zatiaraspos.pages.dev`                  |
| Canonical alias       | `https://zatiaraspos.pages.dev` restored to app                                                   |
| Downtime              | Approximately `2026-07-20T02:29Z` through `2026-07-20T02:55Z`                                     |
| Production secrets    | Encrypted names `POS_PRICE_SIGNING_KEY` and `POS_PRICE_SIGNING_KEY_ID` present; values never read |

Maintenance verification covered immutable and canonical hosts at `/`, `/login`, `/api/session`, `/api/veriflogin`, `/api/pos/transaction`, `/api/buku-kas`, and `/api/transaksi-kasir`. Every representative GET/POST returned HTTP 503, marker `ZATIARASPOS-MAINT-260720-BY1`, no-store/no-cache headers, `Pragma: no-cache`, and `Retry-After`.

Maintenance only quiesced the canonical alias. Historical immutable deployment hosts and already-open clients remained independently reachable and were handled as a concurrency limitation. No old-host activity appeared in the captured migration windows.

## Sealed artifact

| Artifact                             | SHA-256                                                            |
| ------------------------------------ | ------------------------------------------------------------------ |
| Sorted recursive manifest, 133 files | `d1971e734efb4a7f98dd68dcd90300864887104eacf17995d86612da7a1943bf` |
| `_worker.js`                         | `07570ed4ea36b152d1ccf1b9f724363601e1aaafc540f1fc8b6b6f5bf721070e` |
| `sw.js`                              | `86f4f9de6cc5275794a839396e52b160f8fd0708a771bcec3685df58abeec993` |
| Pre-restore manifest comparison      | Exact equality, including paths, bytes, and per-file hashes        |
| Production `sw.js` after restore     | Exact equality                                                     |

## Recovery manifest

The recovery manifest was written with a temporary file, file fsync, atomic rename, readback equality, schema checks, and current-user/SYSTEM ACL. Parent-directory fsync is unsupported on this Windows filesystem and is recorded as such. No plaintext export or automatic restore was created or executed.

| Database   | Production UUID verified               | Bookmark timestamp         | Conservative deadline      | Bookmark                                                      |
| ---------- | -------------------------------------- | -------------------------- | -------------------------- | ------------------------------------------------------------- |
| Samarinda  | `b6aafe5b-fd11-436d-9b9e-c007bd531c9e` | `2026-07-20T02:30:26.677Z` | `2026-07-27T02:30:26.677Z` | `0000008d-00000020-000050ae-34a452436605781655fcb259a58d3904` |
| Balikpapan | `312940d7-b0c0-43e5-86fd-78b762cacb6e` | `2026-07-20T02:30:26.710Z` | `2026-07-27T02:30:26.710Z` | `0000001e-00000002-000050ae-721dac06ca494a3b8b204973480b7a13` |
| Berau      | `18e2f751-5d54-4bec-b0bc-ae6e1378cdb6` | `2026-07-20T02:30:26.710Z` | `2026-07-27T02:30:26.710Z` | `00000020-00000002-000050ae-1564d60f834e0df8aeb63f2e3b946994` |

Exact non-executed restore commands remain in `recovery-manifest.json`. GAP-01 was closed after verification: the wrapper now makes those commands actionable only after restrictive ACL/readback validation, exact production database name and UUID matching, exact manifest bookmark plus `--confirm-bookmark`, an unexpired conservative deadline, process environment `ALLOW_D1_TIME_TRAVEL_RESTORE=YES`, a real input/output TTY, and a typed destructive confirmation binding the database and bookmark. Expired deadlines are denied rather than silently accepted. Escalation is required before the listed deadline if a later recovery decision is needed.

Wrangler's local `d1 time-travel restore --help` confirms the supported remote argv uses the database positional plus `--bookmark`, `--config`, and optional `--json`; it provides no built-in confirmation flag. The wrapper therefore owns the stricter typed confirmation gate before it can invoke the secret-safe `rtk pnpm exec wrangler` child. Self-tests prove default denial, manifest mismatch denial, non-TTY denial, typed-confirmation denial, manifest ACL/readback validation, and exact approved argv construction without spawning a remote command. Normal non-interactive denial probes also passed. No restore was executed while closing GAP-01.

## Migration result

| Shard      | 0015    | 0016    | Schema | Settings HMAC | Integrity | Financial identities |
| ---------- | ------- | ------- | ------ | ------------- | --------- | -------------------- |
| Samarinda  | Applied | Applied | PASS   | PASS          | PASS      | PASS, delta 0        |
| Balikpapan | Applied | Applied | PASS   | PASS          | PASS      | PASS, delta 0        |
| Berau      | Applied | Applied | PASS   | PASS          | PASS      | PASS, delta 0        |

Every applied migration used one exact checked-in file in one remote D1 operation after SHA-256 verification. Migrations ran sequentially by shard and in numeric order. Exact post-gates covered session column definitions/defaults, zero invalid unlock rows, ordered settings columns/defaults/PK, branch index, empty FK list, no temporary table, no raw default PIN, keyed full-field preservation, `PRAGMA quick_check`, financial identities, and audit windows. Raw settings, PINs, financial IDs, audit rows, HMAC keys, and HMAC digests were never printed or retained.

Two controlled recovery events occurred:

1. The initial Samarinda 0015 wrapper attempt exited before a success result because parsed Wrangler JSON was incorrectly retained as a raw string. Read-only schema proved both 0015 columns remained absent, consistent with whole-batch rollback. An explicit one-time recovery override revalidated maintenance, UUID/bookmark, manifest, migration hash, and fully absent schema before retry. The exact whole-file retry passed.
2. The original seven-term `Q_CORE_COUNTS` read-only query failed before 0016 with Cloudflare API code 7500, `too many terms in compound SELECT`. An explicit safe audit override replaced only that compound query with seven exact individually allowlisted COUNT/SUM queries. Split-query self-tests and sanitized baseline checks passed before any 0016 DDL.

No DDL retry occurred for migration 0016.

## Restored production and smoke

| Check                                             | Expected              | Result |
| ------------------------------------------------- | --------------------- | ------ |
| `/` and `/login` on immutable and canonical hosts | 200                   | PASS   |
| Protected product/catalog/realtime without auth   | 401                   | PASS   |
| Cashier and owner login                           | 200                   | PASS   |
| Authenticated cross-branch request                | 403                   | PASS   |
| Direct transaction insert guard                   | 409                   | PASS   |
| Direct POS ledger insert guard                    | 409                   | PASS   |
| Quote and one idempotent checkout                 | Success               | PASS   |
| Realtime clients                                  | 2                     | PASS   |
| Owner DELETE                                      | Success               | PASS   |
| Transaction API residue                           | 0                     | PASS   |
| Ledger API residue                                | 0                     | PASS   |
| D1 idempotency residue                            | 0                     | PASS   |
| Realtime Worker `/health`                         | exact healthy payload | PASS   |
| Production service worker                         | sealed SHA-256        | PASS   |

The checkout intent was atomically journaled before POST, the committed transaction was journaled before further assertions, and cleanup ran unsuppressed. The cleaned journal proved zero transaction, ledger, and idempotency residue; the sensitive journal was removed after verification.

Browser UI coverage is limited, not claimed as passed. Chrome launched and isolated owner/cashier login began, but the cashier context returned to `/login` when opening `/pos`; `/api/session` was unauthenticated and the product request returned 401. This happened before the browser checkout route fired, so no browser transaction or new journal existed. API checkout, two-client realtime, and fail-closed cleanup remain the live end-to-end proof.

## Worktree

`git diff --check` passed at final verification. No application source/config file was edited, staged, committed, switched, stashed, or reset by this execution. One prior agent-generated planning file, `.planning/quick/260718-h7w-backup-and-apply-missing-d1-production-m/260718-h7w-PLAN.md`, was formatted under explicit scope override so the release lint gate could pass. Task-local maintenance, wrapper, harness, manifests, and this summary remain uncommitted.

Final verdict: production migration, exact artifact restoration, and API/realtime live smoke passed. Browser UI smoke remains the only limited coverage.
