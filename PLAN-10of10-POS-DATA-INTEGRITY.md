# Plan 10/10 - POS Data and Financial Integrity

## Status

Implementation complete on 2026-07-04.

Release remains blocked until the production `POS_PRICE_SIGNING_KEY` Cloudflare secret is set,
`pnpm deploy:check` passes, and browser/two-device UAT is run in an available browser surface.

## Objective

Make catalog loading, online checkout, offline sales, receipt output, and queued replay preserve one exact financial truth without weakening server-authoritative pricing, branch isolation, idempotency, or auditability.

## Confirmed Problems

1. `productService` and `smartCache` use identical IndexedDB keys but store incompatible shapes.
2. `smartCache.clear()` clears the shared default `idb-keyval` store and can delete `pending_transactions`.
3. Product fetch failure can silently return cached or empty data without exposing its source or age.
4. Online checkout ignores the authoritative `total_amount` and `change` returned by the server.
5. QRIS confirmation currently happens before authoritative price reconciliation.
6. Offline queue stores product IDs but not a server-verifiable sale-time price snapshot.
7. Offline replay recalculates against current prices, so completed sales can fail or be recorded at a different amount.
8. Existing tests cover normal checkout totals but not cache-shape collisions, stale-price reconciliation, or offline price changes.

## Non-Negotiable POS Invariants

- One transaction has one immutable total across payment, receipt, ledger, report, and replay.
- No client-provided product or add-on price is trusted without server verification.
- No cache operation may read, overwrite, or clear the pending transaction queue.
- No checkout writes partial financial data.
- Price mismatch must be resolved before online payment confirmation.
- A completed offline cash sale must not disappear because price, product status, or inventory changed later.
- Every replay remains branch-scoped, authenticated, idempotent, rate-limited, and auditable.
- QRIS remains unavailable without a verified online quote.

## Chosen Design

### Online sales

Use a server-issued short-lived quote before opening cash or QRIS confirmation.

- Add `POST /api/pos/quote`.
- Client sends product IDs, add-on IDs, quantities, and order details.
- Server loads current rows and computes authoritative line prices and total.
- Server returns:
  - `quote_token`
  - authoritative line snapshots
  - `total_amount`
  - `total_qty`
  - `expires_at`
- Quote token is signed server-side and bound to branch, items, totals, and expiry.
- Payment UI and receipt preview use quote data, not mutable catalog/cart prices.
- Final checkout verifies the quote token before any write.
- Expired or invalid quote returns explicit `409 QUOTE_EXPIRED` or `409 PRICE_CHANGED`.
- Final checkout response becomes the sole source for success modal, change, and receipt.

### Offline cash sales

Use server-signed catalog price tokens cached during the last successful catalog sync.

- Add dedicated `GET /api/pos/catalog`.
- Return products, categories, add-ons, `fetched_at`, expiry, and signed price tokens.
- Each price token binds branch, entity type, ID, name, price, active state, issued time, and expiry.
- Default maximum catalog age for starting an offline sale: 24 hours.
- Offline queue stores:
  - stable idempotency key
  - local transaction time
  - signed product/add-on tokens
  - immutable receipt snapshot
  - exact expected total and received cash
- Replay verifies signatures and records the exact sale-time amount.
- Invalid, tampered, branch-mismatched, or expired tokens never write a transaction.
- Offline replay may use a valid sale-time token even when the product is later renamed, repriced, disabled, or deleted.
- Financial sale is recorded first; inventory shortages become explicit reconciliation events instead of deleting or silently changing the sale.

## Workstream 1 - Isolate Critical IndexedDB Data

- Create explicit `idb-keyval` stores with `createStore`:
  - cache store
  - catalog snapshot store
  - pending transaction store
- Move `pending_transactions` to the dedicated queue store.
- Give every persisted payload a schema version and runtime shape validator.
- Stop using raw arrays and cache envelopes under the same key.
- Replace global `clear()` with cache-store-only deletion.
- Ensure menu updates cannot clear catalog snapshots or queued transactions.
- Remove unused `pos-data` writes if no active reader exists.
- Since application is not production, discard incompatible test cache data instead of adding legacy migration complexity.

### Acceptance

- Full reload returns the same catalog shape.
- Clearing app cache leaves pending queue byte-for-byte unchanged.
- Menu insert/update/delete leaves pending queue unchanged.
- Corrupt cache becomes an explicit recoverable error, never a fabricated empty catalog.

## Workstream 2 - Create One POS Catalog Boundary

- Replace three independent product/category/add-on loads with one `/api/pos/catalog` response.
- Fetch catalog atomically for the authenticated session branch.
- Include source metadata:
  - `network`
  - `cache`
  - `unavailable`
- Persist `fetched_at`, `expires_at`, schema version, and signing metadata.
- Refresh catalog on:
  - route entry
  - browser online event
  - branch change
  - relevant realtime event
  - manual retry
- Make background refresh publish updated data to the POS store instead of only mutating hidden cache state.

### Acceptance

- POS never combines products from one catalog revision with add-ons from another.
- Server/API failure while `navigator.onLine === true` displays cached-data status.
- Missing cache displays error and retry, not “Menu belum tersedia”.
- Expired catalog blocks new offline checkout.

## Workstream 3 - Add Authoritative Quote Flow

- Add shared server pricing function used by quote and final transaction.
- Add signed quote-token utility with:
  - HMAC-SHA-256 through Web Crypto
  - dedicated `POS_PRICE_SIGNING_KEY` stored as a Cloudflare secret, never in repository files
  - token version and key ID for controlled rotation
  - constant-time signature verification
  - short expiry, recommended five minutes
  - branch and item binding
- Bound quote payload size and apply server-side per-user rate limiting.
- Request quote before showing cash keypad or QRIS confirmation.
- Replace cart totals with quoted totals during payment.
- If quote differs from displayed cart:
  - update line display
  - explain changed items
  - require cashier confirmation
- Verify quote again inside final checkout.
- Preserve existing atomic D1 batch, idempotency, stock checks, rate limits, and session-derived branch.

### Acceptance

- Price increase and decrease are both detected before payment.
- QRIS amount always equals committed ledger amount.
- No transaction is written for expired or altered quote tokens.
- Concurrent double-submit returns the same transaction through idempotency.

## Workstream 4 - Make Final Response Authoritative

- Extend checkout response with committed receipt snapshot:
  - transaction ID
  - line names, quantities, base prices, add-ons, and line totals
  - total
  - cash received
  - change
  - payment method
  - committed time
- Parse the response in `bayarState`.
- Success modal, security event, printed receipt, and navigation state use committed response data.
- Never print from stale cart data after successful online checkout.
- Do not show success when the response cannot be parsed or validated.

### Acceptance

- UI total, printed receipt, `buku_kas.nominal`, and sum of `transaksi_kasir.nominal` are identical.
- Displayed change equals server response.
- Receipt remains stable after catalog or cart changes.

## Workstream 5 - Define Offline Replay Semantics

- Add explicit `mode: offline_replay`; do not infer replay from network state.
- Verify signed catalog tokens, branch, catalog age, queued time, and idempotency key.
- Record exact sale-time prices from verified tokens.
- Add audit metadata:
  - pricing source
  - catalog issued time
  - queued time
  - replay time
  - current-versus-sale price variance
- Product later inactive/deleted:
  - accept valid historical sale
  - retain product/name/price snapshots
- Insufficient stock or ingredients:
  - commit the financial sale and reconciliation event in one atomic batch
  - record inventory reconciliation requirement
  - expose shortage to owner monitoring
  - never silently drop the paid sale
- Invalid signature, wrong branch, malformed total, or expired catalog:
  - no financial write
  - permanent actionable queue status
  - preserve payload for owner review/export

### Acceptance

- Repricing after offline payment does not alter recorded amount.
- Replay of the same queue item remains idempotent.
- Invalid token cannot create a sale.
- Inventory shortage never erases a financially completed sale.

## Workstream 6 - Expose Honest Operational State

- Add catalog status to POS and payment screens:
  - fresh
  - cached with last sync time
  - stale/expired
  - unavailable
- Keep existing browser offline indicator.
- Add realtime health separately; browser online does not imply catalog is fresh.
- Disable QRIS when no valid online quote exists.
- Disable new offline sales when signed catalog is absent or expired.
- Show pending, syncing, failed, and owner-review counts.
- Never label transport failure as a legitimately empty menu.

## Workstream 7 - Tests and Release Gates

### Storage tests

- Raw offline snapshot and smart-cache envelope cannot share a key/store.
- Cache clear cannot remove `pending_transactions`.
- Reload, corruption, branch switch, and schema-version mismatch.

### Catalog tests

- Network success, browser offline, API failure while browser online, empty valid catalog, expired cache.
- Realtime price update invalidates and refreshes visible POS state.
- Background refresh updates consumers.

### Quote and checkout tests

- Unchanged price.
- Price increase.
- Price decrease.
- Add-on repricing.
- Product/add-on disabled or deleted.
- Quote expiry and signature tampering.
- Branch mismatch.
- QRIS exact-total enforcement.
- Cash and change reconciliation.
- Concurrent submit and idempotent retry.

### Offline replay tests

- Price changes after payment.
- Product later disabled/deleted.
- Insufficient product stock.
- Insufficient ingredients.
- Invalid/expired signature.
- Duplicate replay.
- Queue survives cache clear and menu mutation.

### Browser UAT

- Full reload with persisted catalog.
- Two-device owner price change while cashier has POS open.
- Lost realtime connection while HTTP remains available.
- API failure while `navigator.onLine` remains true.
- Offline cash sale, receipt, reconnect, replay, and report verification.
- QRIS quote, payment confirmation, checkout, and receipt verification.

### Required gates

- `pnpm check`
- `pnpm lint`
- `pnpm test:all`
- dedicated POS cache/quote/offline suites
- production build
- local D1 UAT
- two-device browser UAT
- Cloudflare signing-secret and deploy-config verification
- diff review for unrelated changes

## Execution Order

1. Isolate IndexedDB stores and add regression tests.
2. Add catalog boundary and freshness model.
3. Add quote endpoint and signed token utilities.
4. Rewire payment UI to quote before cash/QRIS.
5. Make checkout response authoritative for receipt and success UI.
6. Add signed offline snapshot and replay semantics.
7. Add inventory reconciliation handling.
8. Add operational status UI.
9. Run complete regression and browser UAT matrix.
10. Reset test caches/data, deploy, then run live smoke checks before production launch.

## Explicit Non-Goals

- Do not trust arbitrary client price fields.
- Do not weaken session-derived branch isolation.
- Do not replace atomic checkout with separate table writes.
- Do not silently accept price mismatch.
- Do not silently delete failed offline transactions.
- Do not retain backward compatibility for unpublished test-only cache formats.

## Completion Criteria

- Critical queue storage is isolated from cache operations.
- Catalog source and age are always known.
- Online payment uses a verified server quote.
- Offline payment uses an unmodified server-signed catalog snapshot.
- Payment, receipt, ledger, reporting, and replay totals match exactly.
- Paid offline sales remain financially recorded even when inventory needs reconciliation.
- Every sensitive failure mode has direct automated coverage and browser UAT proof.

## Verification Record

Passed:

- `pnpm check`: 0 errors, 0 warnings.
- `pnpm lint`.
- `pnpm test:all`.
- `pnpm test:pos-integrity`: 23 assertions.
- `pnpm build`.
- `pnpm test:checkout:local`: authoritative quote, committed total, detail rows, cleanup.
- `pnpm test:csrf:local`.
- `pnpm test:final:local`.
- `pnpm test:pos-integrity:local`: sale at Rp10.000 replayed after current price changed
  to Rp11.111; recorded Rp10.000; duplicate idempotent; tampered token rejected with 400.

Pending release operations:

- Configure production `POS_PRICE_SIGNING_KEY` and `POS_PRICE_SIGNING_KEY_ID` as Cloudflare
  secrets. Keep the old key in `POS_PRICE_SIGNING_KEY_PREVIOUS` during rotation.
- Run `pnpm deploy:check`; current local check correctly fails because no production signing
  secret is stored in `.env`.
- Run browser/two-device UAT. The in-app browser inventory was empty in this session, so no
  browser result is claimed.
- Deploy and run live smoke checks. No deployment was performed by this implementation task.
