---
phase: quick-260718-esb-deploy-production-and-run-live-smoke-tes
plan: '01'
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
requirements:
  - QUICK-DEPLOY-SMOKE
must_haves:
  truths:
    - 'Current explicitly authorized dirty worktree is built and deployed without changing or committing user source files.'
    - 'The realtime Worker deployment answers /health before the Pages production deployment proceeds.'
    - 'Production Pages serves the new build and preserves unauthenticated, branch-isolation, and direct-POS-write guards.'
    - 'A bounded live quote/checkout/realtime transaction succeeds and its cleanup is confirmed.'
    - 'The production service-worker bytes match the locally built artifact.'
  artifacts:
    - path: '.svelte-kit/cloudflare/_worker.js'
      provides: 'Pages Worker artifact built from the authorized dirty worktree'
    - path: '.svelte-kit/cloudflare/sw.js'
      provides: 'Hash-verifiable production service worker artifact'
    - path: 'scripts/uat-live-realtime.mjs'
      provides: 'Authenticated quote, checkout, two-client realtime, and cleanup smoke path'
    - path: 'scripts/uat-live-ui-two-device.mjs'
      provides: 'Optional browser-level two-device checkout and dashboard smoke path'
  key_links:
    - from: 'wrangler.jsonc'
      to: 'zatiaraspos-realtime'
      via: 'REALTIME_HUB external Durable Object script_name binding'
      pattern: 'script_name.*zatiaraspos-realtime'
    - from: 'package.json'
      to: '.svelte-kit/cloudflare'
      via: 'build then deploy:pages scripts'
      pattern: 'deploy:pages.*svelte-kit/cloudflare'
    - from: 'scripts/uat-live-realtime.mjs'
      to: '/api/pos/quote and /api/pos/transaction'
      via: 'authenticated production requests with owner cleanup'
      pattern: 'api/pos/(quote|transaction)'
---

<objective>
Deploy the already-authorized current dirty worktree to Cloudflare production, then prove the deployed Pages and realtime Worker through bounded live checks.

Purpose: Close the release-only deployment gap with evidence while preserving the user's uncommitted work and production data.
Output: Cloudflare deployment identifiers/URLs plus a smoke-test evidence matrix in `260718-esb-SUMMARY.md`; no source edit and no commit.
</objective>

<execution_context>
@C:/Users/ASUS/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/ASUS/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@.planning/STATE.md
@package.json
@wrangler.jsonc
@wrangler.pages.jsonc
@wrangler.realtime.jsonc
@scripts/verify-cloudflare-deploy-config.mjs
@scripts/uat-live-realtime.mjs
@scripts/uat-live-ui-two-device.mjs
@PLAN-10of10-POS-DATA-INTEGRITY.md
@PLAN-11of11-RELEASE-READINESS-CLOSURE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Freeze provenance and pass safe release preflight</name>
  <files>None; commands may update ignored build output only</files>
  <action>
Treat the current dirty worktree as the explicit deployment source. Before any build or remote mutation, capture UTC timestamp, current branch/HEAD, `rtk git status --short --branch`, `rtk git diff --check`, and the current realtime and Pages deployment lists into the execution evidence. Do not switch branches, stash, reset, stage, edit, or commit anything. Run `rtk pnpm exec wrangler whoami`, then list Pages production secret names with Wrangler and assert `POS_PRICE_SIGNING_KEY` and `POS_PRICE_SIGNING_KEY_ID` exist; never print or retrieve secret values.

Run `rtk pnpm deploy:check`, `rtk pnpm check`, `rtk pnpm lint`, `rtk pnpm test:all`, and `rtk pnpm build`. `deploy:check` reads local process/.env state even though Cloudflare secrets are write-only. If and only if its sole missing input is `POS_PRICE_SIGNING_KEY`, rerun that structural verifier with a freshly generated process-local random value that is neither logged nor persisted; remote secret-name verification remains the proof of runtime configuration. Do not replace or rotate the Cloudflare secret. Stop before deployment on any config mismatch, source-quality failure, build failure, missing remote secret name, or unexpected `git diff --check` output. Record the local SHA-256 of `.svelte-kit/cloudflare/sw.js` after the successful build.
</action>
<verify>
<automated>`rtk pnpm check`, `rtk pnpm lint`, `rtk pnpm test:all`, `rtk pnpm build`, and the structurally valid `rtk pnpm deploy:check` all exit 0; `.svelte-kit/cloudflare/_worker.js` and `.svelte-kit/cloudflare/sw.js` exist; the captured git status still represents the authorized dirty source.</automated>
</verify>
<done>Cloudflare identity and required remote secret names are confirmed without disclosure; all release gates pass; build artifacts and pre-deploy provenance/hash are recorded; no tracked or untracked user file was altered by the executor.</done>
</task>

<task type="auto">
  <name>Task 2: Deploy realtime Worker first, then Pages production</name>
  <files>None; remote Cloudflare deployments only</files>
  <action>
Deploy with separate scripts rather than `deploy:all`, because Task 1 already ran every gate and this preserves exact step evidence. Run `rtk pnpm deploy:realtime` first. Capture the new Worker deployment ID/version and public workers.dev URL from Wrangler output, then run `rtk pnpm exec wrangler deployments list --config wrangler.realtime.jsonc` and request the Worker `/health`. Require HTTP 200 and JSON `{ ok: true, service: "zatiaraspos-realtime" }`; stop before Pages if this fails.

After Worker health passes, run `rtk pnpm deploy:pages`. This intentionally deploys `.svelte-kit/cloudflare` with the package script's `--branch main --commit-dirty=true`; do not rebuild between recorded local hash and upload. Capture the immutable Pages deployment URL and deployment ID, then confirm both that URL and `https://zatiaraspos.pages.dev` return HTTP 200. Use cache-busting/no-cache requests for verification. Do not edit configuration, redeploy an older commit, or commit the dirty worktree.
</action>
<verify>
<automated>`rtk pnpm exec wrangler deployments list --config wrangler.realtime.jsonc` shows the new Worker deployment, Worker `/health` returns the exact healthy payload, Wrangler reports a successful Pages upload, and both immutable and production Pages URLs return HTTP 200.</automated>
</verify>
<done>Realtime Worker is healthy before Pages activation; new Pages production deployment is reachable; deployment IDs, URLs, and timestamps are preserved for audit.</done>
</task>

<task type="auto">
  <name>Task 3: Run bounded production smoke matrix and verify artifact identity</name>
  <files>None; only temporary OS files for cookie jars/downloads, removed after checks</files>
  <action>
Run read-only unauthenticated probes against `https://zatiaraspos.pages.dev`: `/`, `/login`, `/api/produk?branch=samarinda`, `/api/pos/catalog?branch=samarinda`, and `/api/realtime?branch=samarinda`. Require 200 for pages and 401 for protected APIs. Using `UAT_PASSWORD` only from the existing environment and never printing it, create authenticated cashier/owner sessions through `/api/csrf` and `/api/veriflogin`. With the cashier session, request another branch's resource and require 403. With an authenticated session plus CSRF, send deliberately non-writing direct insert attempts to `/api/transaksi-kasir` and a POS-sourced payload to `/api/buku-kas`; require 409 from both. These guards reject before database writes, so do not use arbitrary mutations as probes.

Run `rtk node scripts/uat-live-realtime.mjs https://zatiaraspos.pages.dev samarinda`. Require its JSON proof for cashier login, quote/checkout success, two realtime clients, transaction ID, and owner cleanup path; if cleanup is not confirmed, immediately retry owner cleanup for that exact captured transaction ID and report residue as a release blocker. Then run `rtk node scripts/uat-live-ui-two-device.mjs https://zatiaraspos.pages.dev samarinda` when Chrome/CDP can launch. If Windows denies browser creation, record the exact browser limitation and do not claim browser UAT; the API/realtime transaction, HTTP guards, and artifact hash remain the explicit fallback proof.

Download production `/sw.js` to a unique OS temp file with cache busting, hash it with SHA-256, and require exact equality with the Task 1 local `.svelte-kit/cloudflare/sw.js` hash. Remove temporary cookies/downloads. Finally rerun `rtk git status --short --branch` and `rtk git diff --check`; compare status with the preflight snapshot and prove no source/config change or commit was introduced. Write `260718-esb-SUMMARY.md` containing the deployment IDs/URLs, local and remote hashes, status-code matrix, live transaction/realtime/cleanup result, browser result or exact limitation, and final verdict. Do not include cookies, CSRF tokens, passwords, API tokens, or secret values.
</action>
<verify>
<automated>Required HTTP codes are 200/401/403/409 as specified; `rtk node scripts/uat-live-realtime.mjs https://zatiaraspos.pages.dev samarinda` returns `ok: true` with `realtimeClientsVerified: 2`; transaction cleanup is confirmed; local and production `sw.js` SHA-256 values are identical; final `rtk git diff --check` is clean and git status has no executor-created source changes.</automated>
</verify>
<done>Production proves public reachability, auth and branch isolation, protected direct-write policy, authoritative live checkout, two-client realtime delivery, cleanup, and exact deployed artifact identity; browser proof is either recorded or explicitly marked unavailable without overstating coverage.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary                                       | Description                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| Local dirty worktree to Cloudflare build       | Uncommitted user code becomes production artifact and needs explicit provenance.     |
| Local CLI to Cloudflare API                    | Deployment credentials and write-only Pages secrets cross an external control plane. |
| Smoke client to production APIs/D1             | Authenticated checks can mutate live sales data if not bounded and cleaned.          |
| Pages Worker to external Durable Object Worker | Realtime relies on the `REALTIME_HUB` script binding and deployed Worker health.     |

## STRIDE Threat Register

| Threat ID  | Category               | Component                       | Disposition | Mitigation Plan                                                                                                |
| ---------- | ---------------------- | ------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| T-QUICK-01 | Spoofing               | Cloudflare account/project      | mitigate    | Verify Wrangler identity, project name, and deployment lists before mutation.                                  |
| T-QUICK-02 | Tampering              | Dirty worktree/build provenance | mitigate    | Capture branch/HEAD/status, build once, hash `sw.js`, and compare production bytes.                            |
| T-QUICK-03 | Information Disclosure | Secrets, cookies, CSRF tokens   | mitigate    | List secret names only, use process-local credentials, redact evidence, and delete temp cookie jars.           |
| T-QUICK-04 | Repudiation            | Deployment and smoke outcome    | mitigate    | Record immutable deployment IDs/URLs, timestamps, status matrix, hashes, transaction ID, and cleanup response. |
| T-QUICK-05 | Denial of Service      | Live endpoints/rate limits      | mitigate    | Use one bounded checkout and a small fixed probe set; no load or security-rate-limit tests against production. |
| T-QUICK-06 | Elevation of Privilege | Cross-branch/direct POS writes  | mitigate    | Assert authenticated 403 branch mismatch and 409 direct-write guards without permitting writes.                |

</threat_model>

<verification>
1. All preflight quality/config/build gates pass before remote mutation.
2. Realtime `/health` passes before Pages deployment.
3. Production status matrix matches 200/401/403/409 expectations.
4. Live quote/checkout/realtime smoke succeeds and cleanup is confirmed.
5. Production `sw.js` SHA-256 equals the locally built artifact.
6. No source edit, staging, commit, branch switch, stash, or reset occurred.
</verification>

<success_criteria>

- New realtime Worker and Pages production deployment IDs are recorded.
- Production Worker health and Pages reachability pass.
- Auth, branch isolation, and direct POS write guards return expected statuses.
- One bounded live checkout broadcasts to two realtime clients and leaves no UAT transaction residue.
- Browser two-device proof passes when Chrome is available; otherwise exact limitation and fallback evidence are stated.
- Local/production service-worker hashes match exactly.
- User dirty worktree remains uncommitted and unchanged by execution.
  </success_criteria>

<output>
Create `.planning/quick/260718-esb-deploy-production-and-run-live-smoke-tes/260718-esb-SUMMARY.md` when done. Do not commit source or user changes.
</output>
