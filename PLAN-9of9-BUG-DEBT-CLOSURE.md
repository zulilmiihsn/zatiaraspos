# Plan 9/9 - Bug and Debt Closure

## Objective

Close three confirmed correctness bugs and four verified engineering debts without weakening existing branch isolation, rate limiting, idempotency, or owner authorization.

## Scope

### 1. Reject oversized checkout payloads

- Keep maximum 100 line items per checkout.
- Return explicit `400` response when payload exceeds limit.
- Never accept a partial order by silently slicing items.
- Add regression coverage for 100 and 101 items.

### 2. Bound AI report queries for Cloudflare D1

- Split `buku_kas_id` lookups into chunks that stay below D1's 100 bound-parameter limit.
- Preserve branch filtering in every query.
- Merge chunk results deterministically.
- Add coverage for reports containing more than 100 POS headers.

### 3. Stop presenting dashboard failures as zero-valued business data

- Propagate dashboard API and summary-query failures.
- Preserve legitimate empty datasets as successful empty results.
- Expose an explicit loading error to dashboard consumers.
- Do not cache fabricated zero values.
- Add failure-path regression coverage.

### 4. Make monitoring degradation explicit

- Keep independent monitoring queries so one unavailable source does not break all monitoring data.
- Record availability and error status per source.
- Return `degraded: true` when any source fails.
- Keep `success: true` only for a structurally valid partial response.
- Add partial-failure response coverage.

### 5. Complete authoritative page-lock enforcement

- Inventory API routes used by each lockable page.
- Enforce `requirePageAccess` on protected page-specific server routes.
- Avoid assigning a page lock to generic APIs without an actual page-to-route contract.
- Keep owner access, branch isolation, and session unlock behavior unchanged.
- Add access-matrix regression coverage.

### 6. Replace plaintext/default PIN storage

- Add nullable `pin_hash`; remove default `1234`.
- Hash new PINs server-side with a salted, deliberately slow Web Crypto derivation.
- Never return stored PIN or hash to browser.
- Verify old PIN and new PIN entirely on server.
- Support authenticated owner setup when no PIN exists.
- Clear legacy plaintext PIN after successful migration/change.
- Keep verification rate limiting and audit events.
- Add hashing, setup, change, rejection, and legacy-transition tests.

### 7. Add direct tests for extracted logic

- Add direct tests for checkout statement construction.
- Add direct tests for critical state-store reset and mutation behavior where runtime-compatible.
- Keep workflow UAT as integration coverage, not substitute for focused regression tests.

## Verification Gates

- Type and Svelte checks pass.
- Lint passes.
- Unit/regression suites pass.
- Production build passes.
- Local D1 workflow UAT passes.
- Git diff reviewed for accidental unrelated changes.

## Completion Criteria

- No checkout truncation.
- No D1 over-bound AI report query.
- No dashboard transport/database error rendered as valid zero data.
- Monitoring reports partial-source failures.
- Protected page APIs consistently require server unlock.
- No active plaintext/default PIN path remains.
- New behavior has direct automated coverage.
