# Plan 11/11 - Release Readiness Closure

## Status

Completed on 2026-07-04.

## Objective

Close the remaining verified release-readiness work without changing POS financial semantics:

1. Patch vulnerable build and runtime dependencies.
2. Make failed offline transactions inspectable, exportable, and safely resolvable.
3. Remove duplicate pending-count state from the top bar.
4. Add browser E2E coverage for the critical POS path.
5. Remove the unused duplicate logout implementation.

## Validated Scope

### Dependency security

- `pnpm audit --prod` currently reports nine advisories.
- Rollup, Vite, Picomatch, PostCSS, and `serialize-javascript` are build/development paths.
- The vulnerable toolchain packages are not present in the generated production bundle.
- The old `cookie` package is reachable through SvelteKit, but this application uses fixed cookie
  names and fixed cookie attributes, so the known arbitrary-name/path exploit path is not exposed.
- This remains release security debt because patched versions are available.

### Offline failure operations

- Offline transactions are stored in a dedicated IndexedDB queue.
- Sync already records status, attempt count, failure kind, retry time, and last error.
- The current global UI only exposes counts and a bulk retry button.
- No current UI displays an individual failed transaction, exports its preserved payload, or
  removes a reviewed local entry.
- Resolution must never edit signed price data or force an invalid transaction into the ledger.

### Top-bar state

- Queue writes dispatch `pending-changed`.
- The global layout listens to that event and has the authoritative pending counts.
- `topBarStatus.svelte` independently rereads IndexedDB and only listens to `storage`, which does
  not represent same-tab IndexedDB changes.

### Browser coverage

- Existing local UAT scripts exercise real HTTP, D1, quote, checkout, CSRF, and replay paths.
- `feature-tests.ts` remains mock-heavy and does not exercise browser bindings or modal/navigation
  behavior.
- No Playwright test currently covers the critical POS UI path.

### Logout

- All active callers use `auth.logout()`.
- The separately exported `logout()` function has no caller and duplicates cleanup behavior.

## Non-Negotiable Invariants

- Never allow queue editing of product price, add-on price, quantity, branch, signed tokens, or
  idempotency key.
- Never treat deletion of a local failed queue item as a successful server transaction.
- Destructive queue deletion is owner/admin-only in the UI and requires explicit confirmation.
- Exported queue files are local support artifacts and must not contain session cookies, passwords,
  CSRF tokens, or environment secrets.
- One pending-count source feeds the top bar and global banner.
- Dependency work stays on compatible patch/minor releases unless a major is required and proven.
- Browser tests use deterministic UAT data and clean up created transactions.

## Workstream 1 - Dependency Security

1. Update compatible direct dependencies that pull patched Vite, Rollup, PostCSS, Workbox,
   Picomatch, `serialize-javascript`, and SvelteKit cookie handling.
2. Re-run `pnpm audit --prod`.
3. Add narrowly scoped `pnpm.overrides` only if a vulnerable transitive remains and compatibility
   is verified by build and UAT.
4. Do not mass-upgrade unrelated major versions.

### Acceptance

- No high or moderate audit finding remains on the resolved dependency graph.
- `pnpm install --frozen-lockfile` succeeds.
- Production build and PWA generation succeed.

## Workstream 2 - Offline Queue Detail and Resolution

1. Extend queue utilities with targeted retry and immutable export serialization.
2. Add a global queue-detail sheet opened from the existing pending banner.
3. Display:
   - transaction code
   - created time
   - total
   - payment method
   - status and failure kind
   - attempt count
   - last error
4. Add safe actions:
   - retry one entry
   - retry all retryable entries
   - export one entry
   - export all entries
   - owner/admin-only removal with explicit confirmation
5. Keep permanent conflicts preserved until owner review.
6. Show clear guidance for auth, conflict, network, rate-limit, and server failures.

### Acceptance

- A failed queue item remains intact after reload.
- Retrying one entry does not reset unrelated failures.
- Export contains the immutable queue record and no authentication secrets.
- Removing one entry cannot clear the entire queue.
- Cashier cannot see the destructive removal action.

## Workstream 3 - One Pending State Source

1. Pass `pendingCount` and offline state from `layoutState` through `Topbar`.
2. Convert `TopBarStatus` to props-only rendering.
3. Remove its IndexedDB read and `storage`/online/offline listeners.
4. Keep the global banner and top-bar badge synchronized from the same state.

### Acceptance

- Adding, syncing, failing, or removing a queue item updates both surfaces in the same render cycle.
- No duplicate queue listener remains in `TopBarStatus`.

## Workstream 4 - Browser E2E

1. Add Playwright using a compatible current release.
2. Add config for the local SvelteKit server and deterministic local D1 setup.
3. Add stable `data-testid` selectors only where accessible roles/text are insufficient.
4. Cover the primary path:
   - owner login
   - POS catalog visible
   - add seeded product
   - navigate to payment
   - request authoritative quote
   - complete cash checkout
   - verify committed total and success state
   - return to POS
5. Add a queue-status browser test using a deterministic injected IndexedDB entry or controlled
   network failure without weakening production code.
6. Clean up server transactions created by tests.

### Acceptance

- Browser test proves Svelte bindings, modal flow, navigation, quote, checkout, and success UI.
- Test runs headless and produces trace/screenshot only on failure.
- No production secret is committed.

## Workstream 5 - Logout Cleanup

1. Remove the unused standalone `logout()` export.
2. Keep `auth.logout()` as the single implementation.
3. Confirm no caller or barrel export depends on the removed symbol.

### Acceptance

- All logout callers compile and use one implementation.
- Session, offline snapshot, role, branch, security settings, and CSRF cache still clear.

## Verification Gates

- `pnpm audit --prod`
- `pnpm install --frozen-lockfile`
- `pnpm check`
- `pnpm lint`
- `pnpm test:all`
- targeted offline queue tests
- Playwright POS E2E
- `pnpm build`
- local checkout UAT
- local POS-integrity UAT
- `git diff --check`

## Explicit Non-Goals

- No force-commit of invalid offline transactions.
- No queue payload editor.
- No unrelated major dependency migration.
- No production deployment in this phase.
- No cleanup of unrelated dirty-worktree changes.

## Completion Criteria

- Dependency audit has no unresolved high or moderate finding.
- Failed offline transactions can be understood, exported, retried individually, and removed only
  after owner/admin confirmation.
- Topbar and global banner share one pending state.
- Critical POS UI flow has real browser automation.
- Duplicate logout code is removed.
- All verification gates pass or an external release-only blocker is recorded precisely.

## Completion Record

- Updated the compatible SvelteKit/Vite/PWA/PostCSS/Workbox dependency chain and added narrow
  workspace overrides for patched `cookie` and `serialize-javascript` releases.
- Added a global offline-transaction sheet with per-entry diagnosis, retry, sanitized JSON export,
  and owner/admin-only confirmed local removal.
- Made layout state the only pending-count source used by the banner and top bar.
- Added Playwright setup plus real owner-login, authoritative cash-checkout, and offline-queue
  operations coverage.
- Removed the unused standalone logout export.
- Fixed three defects exposed by browser automation:
  - catalog and pending queues no longer race while creating different stores in one IndexedDB;
  - typed cash input no longer binds to a no-op derived setter;
  - modal content scrolls and its footer no longer covers the cash keypad.
- Pre-bundled late-discovered browser dependencies so cold Vite E2E runs do not reload mid-payment.
- Made the security rate-limit UAT isolated on local D1 while requiring explicit opt-in for remote
  mutation tests.
- Updated the checkout load test from the removed `/api/data` route to the active `/api/produk`
  resource route.
- Made checkout load tests default to localhost and require explicit opt-in before targeting a
  remote environment.
- Repaired the live two-device browser UAT to wait for login hydration, use the active product
  endpoint, capture the committed transaction ID, and clean up the live transaction.
- Made offline export secret filtering case-insensitive for nested authorization, cookie, and CSRF
  headers while preserving signed price tokens.

## Verification Record

- `pnpm audit --prod`: no known vulnerabilities.
- `pnpm install --frozen-lockfile`: passed.
- `pnpm check`: 0 errors, 0 warnings.
- `pnpm lint`: passed.
- `pnpm test:all`: passed, including 30 offline and 23 POS-integrity assertions.
- `pnpm test:e2e:pos`: 2 passed.
- `pnpm build`: passed; PWA generated 121 precache entries and Cloudflare adapter completed.
- `pnpm test:checkout:local`: passed; committed total Rp25.000, three items, cleanup HTTP 200.
- `pnpm test:pos-integrity:local`: passed; replay preserved Rp10.000 after live price changed to
  Rp11.111, idempotency passed, and tampered payload returned HTTP 400.
- Receipt-output and report-grouping regression tests: passed.
- CSP UAT: 15 routes returned nonce-protected HTML.
- CSRF mutation UAT: passed all ten protected mutation cases.
- Final workflow UAT: passed login, PIN locks, credential change, stock/void, ledger, and AI-route
  checks.
- Security rate-limit UAT: credential requests returned `404,404,404,429`; AI request 31 returned
  HTTP 429.
- Local checkout load test: 30/30 HTTP 200, zero non-429 errors, and 30/30 cleanup.
