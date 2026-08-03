---
phase: quick-260718-esb-deploy-production-and-run-live-smoke-tes
plan: '01'
subsystem: infra
tags: [cloudflare, deployment, production, smoke-test, d1]
status: blocked-after-deploy
requires:
  - phase: release-readiness
    provides: authorized dirty-worktree production candidate
provides:
  - deployed realtime Worker with verified health
  - deployed Pages artifact with exact service-worker hash proof
  - production auth blocker traced to missing D1 migration 0015
affects: [production-deploy, authentication, live-smoke, d1-migrations]
tech-stack:
  added: []
  patterns: [realtime-first deployment gate, write-only secret-name verification]
key-files:
  created:
    - .planning/quick/260718-esb-deploy-production-and-run-live-smoke-tes/260718-esb-SUMMARY.md
  modified: []
key-decisions:
  - 'Stopped authenticated smoke after login returned HTTP 500 and read-only schema inspection proved migration 0015 was absent.'
  - 'Did not apply a D1 migration or roll back production because neither mutation was authorized by this deployment plan.'
requirements-completed: []
duration: 27min
completed: 2026-07-18
---

# Quick Plan 260718-esb: Production Deploy and Live Smoke Summary

**Realtime Worker and Pages deployed from the authorized dirty worktree, health and artifact identity passed, but production authentication is blocked by an unapplied D1 session-schema migration.**

## Performance

- **Started:** 2026-07-18T03:51:47.9743789Z
- **Resumed after plan formatting:** 2026-07-18T03:57:04.3417589Z
- **Stopped:** 2026-07-18T04:18:41.3105673Z
- **Duration:** 27 min total
- **Tasks:** 2 complete, 1 partial
- **Source/config files modified by executor:** 0

## Deployment Evidence

| Component              | ID                                     | URL                                                    | Result   |
| ---------------------- | -------------------------------------- | ------------------------------------------------------ | -------- |
| Realtime Worker        | `d5542738-4b2b-4abc-98b4-d3450b3e8785` | `https://zatiaraspos-realtime.zulilmiihsn.workers.dev` | Deployed |
| Pages production       | `9aaa6981-ca6a-413f-b679-76b5c71104de` | `https://9aaa6981.zatiaraspos.pages.dev`               | Deployed |
| Pages production alias | same deployment                        | `https://zatiaraspos.pages.dev`                        | HTTP 200 |

Realtime deployment was created at 2026-07-18T04:11:26.607Z. Its cache-busted `/health` request returned HTTP 200 with exact JSON `{ "ok": true, "service": "zatiaraspos-realtime" }` before Pages deployment began.

Both the immutable Pages URL and production alias returned HTTP 200 after deployment.

## Release Preflight

| Gate                          | Result | Evidence                                                                   |
| ----------------------------- | ------ | -------------------------------------------------------------------------- |
| Source branch and HEAD        | PASS   | `dev` at `93f8795ef9d7576f2bb0a1bcedff7161939a1fa5`                        |
| Dirty source provenance       | PASS   | Initial and final `git status --short --branch` captured                   |
| Diff whitespace               | PASS   | `git diff --check` exited 0 before and after execution                     |
| Cloudflare identity           | PASS   | Expected account authenticated with User API Token; token not disclosed    |
| Pages production secret names | PASS   | `POS_PRICE_SIGNING_KEY` and `POS_PRICE_SIGNING_KEY_ID` listed encrypted    |
| Structural deploy config      | PASS   | Fresh process-only random signing key; neither printed nor persisted       |
| `pnpm check`                  | PASS   | 0 errors, 0 warnings                                                       |
| `pnpm lint`                   | PASS   | Prettier and ESLint passed                                                 |
| `pnpm test:all`               | PASS   | Hardening, stores, 34 offline, 23 POS-integrity, and feature suites passed |
| `pnpm build`                  | PASS   | Cloudflare adapter completed; PWA generated 121 precache entries           |
| Build artifacts               | PASS   | `_worker.js` and `sw.js` present                                           |

## Production Smoke Matrix

| Probe                                          |                 Expected |     Actual | Result                                                  |
| ---------------------------------------------- | -----------------------: | ---------: | ------------------------------------------------------- |
| `GET /`                                        |                      200 |        200 | PASS                                                    |
| `GET /login`                                   |                      200 |        200 | PASS                                                    |
| unauth `GET /api/produk?branch=samarinda`      |                      401 |        401 | PASS                                                    |
| unauth `GET /api/pos/catalog?branch=samarinda` |                      401 |        401 | PASS                                                    |
| unauth `GET /api/realtime?branch=samarinda`    |                      401 |        401 | PASS                                                    |
| cashier login                                  |                      200 |        500 | **BLOCKED**                                             |
| authenticated cross-branch resource            |                      403 |    not run | Blocked by login                                        |
| direct `transaksi-kasir` insert guard          |                      409 |    not run | Blocked by login                                        |
| direct POS `buku-kas` guard                    |                      409 |    not run | Blocked by login                                        |
| live quote/checkout                            |                  success |    not run | Blocked by login                                        |
| two-client realtime transaction                |                2 clients |    not run | Blocked by login                                        |
| owner cleanup                                  |                confirmed | not needed | No transaction was created                              |
| browser two-device UAT                         | pass or exact limitation |    not run | Blocked by production login, not a browser-launch claim |

## Artifact Identity

- Local `.svelte-kit/cloudflare/sw.js` SHA-256: `b51c327e0d5b812b0897709c31ff6d7cee9ae96ce79d8273176266437bad7856`
- Production `https://zatiaraspos.pages.dev/sw.js` SHA-256: `b51c327e0d5b812b0897709c31ff6d7cee9ae96ce79d8273176266437bad7856`
- Result: **exact match**
- Remote bytes were written only to a unique OS temporary directory, hashed, then removed.

## Release Blocker

`POST /api/veriflogin` for the Samarinda cashier returns HTTP 500 with the sanitized server response `SERVER_ERROR`. Cloudflare invocation evidence showed the deployed request returning 500 without leaking cookies or CSRF data.

Read-only production D1 inspection proved `auth_sessions` contains only the original seven columns and has neither `unlocked_pages` nor `unlock_expires_at`. Current `createAuthSession()` inserts both fields. These columns are introduced by `drizzle/0015_session_page_unlocks.sql`; therefore production code and production schema are incompatible.

No migration was applied and no rollback was attempted because the plan authorized application deployment and smoke testing, not production D1 schema mutation or rollback.

## Transaction and Cleanup Safety

- Login failed before authenticated quote or checkout code ran.
- No live transaction ID was generated.
- No UAT financial row was created by this execution.
- Cleanup was therefore not required.
- Diagnostic tail sessions were terminated after evidence capture.

## Deviations from Plan

None. Execution stopped at the plan-defined production smoke blocker. The executor did not attempt an out-of-scope schema migration.

## Final Integrity

- Final HEAD remained `93f8795ef9d7576f2bb0a1bcedff7161939a1fa5`.
- Final `git diff --check` exited 0.
- Dirty source status remained the authorized deployment source; only this summary was updated by the executor.
- No branch switch, stash, reset, staging, commit, secret rotation, or source/config edit occurred.

## Final Verdict

**BLOCKED AFTER DEPLOYMENT.** Realtime Worker and Pages deployment succeeded and artifact identity is proven, but production login is currently broken until D1 migration 0015 is deliberately applied to the production databases (and migration 0016 is separately reviewed/applied as required). After schema repair, rerun the complete authenticated 403/409, quote/checkout, two-client realtime, cleanup, and browser smoke matrix.
