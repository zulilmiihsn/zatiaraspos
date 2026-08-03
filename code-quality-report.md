# 🧪 CODE QUALITY TEST REPORT

**Generated:** 30/07/2026, 01.47.01

## 📊 SUMMARY

- **Total Tests:** 8
- **Passed:** 7 ✅
- **Failed:** 1 ❌
- **Success Rate:** 87.5%
- **Total Time:** 250337ms

## TypeScript Compilation

- **Tests:** 2/2 passed
- **Time:** 155469ms

### ✅ TypeScript Check
- **Status:** PASSED
- **Message:** TypeScript compilation successful
- **Details:** All TypeScript files compiled without errors
- **Time:** 51027ms

### ✅ TypeScript Build
- **Status:** PASSED
- **Message:** Build successful
- **Details:** Application built without errors
- **Time:** 104441ms

## Code Linting

- **Tests:** 1/2 passed
- **Time:** 94862ms

### ✅ ESLint Check
- **Status:** PASSED
- **Message:** ESLint passed
- **Details:** No linting errors found
- **Time:** 67818ms

### ❌ Prettier Format Check
- **Status:** FAILED
- **Message:** Code formatting issues found
- **Details:** Checking formatting...

[[33mwarn[39m] .planning/quick/260720-by1-enable-temporary-maintenance-migrate-thr/redact-env-diff.mjs
[[33mwarn[39m] .planning/quick/260720-by1-enable-temporary-maintenance-migrate-thr/scan-staged-secrets.mjs
[[33mwarn[39m] .planning/quick/260720-by1-enable-temporary-maintenance-migrate-thr/verify-live-artifact.mjs
[[33mwarn[39m] .planning/quick/260730-1am-harden-production-backup-outside-reposit/260730-1am-PLAN.md
[[33mwarn[39m] Code style issues found in 4 files. Run Prettier with --write to fix.

Command failed: D:\Projects\zatiaraspos\node_modules\.bin\prettier.cmd --check .
[[33mwarn[39m] .planning/quick/260720-by1-enable-temporary-maintenance-migrate-thr/redact-env-diff.mjs
[[33mwarn[39m] .planning/quick/260720-by1-enable-temporary-maintenance-migrate-thr/scan-staged-secrets.mjs
[[33mwarn[39m] .planning/quick/260720-by1-enable-temporary-maintenance-migrate-thr/verify-live-artifact.mjs
[[33mwarn[39m] .planning/quick/260730-1am-harden-production-backup-outside-reposit/260730-1am-PLAN.md
[[33mwarn[39m] Code style issues found in 4 files. Run Prettier with --write to fix.
- **Time:** 27043ms

## File Structure

- **Tests:** 2/2 passed
- **Time:** 4ms

### ✅ Required Files Exist
- **Status:** PASSED
- **Message:** All required files present
- **Details:** Found 10 required files
- **Time:** 1ms

### ✅ Directory Structure
- **Status:** PASSED
- **Message:** Directory structure is correct
- **Details:** All 9 required directories present
- **Time:** 3ms

## Dependencies

- **Tests:** 2/2 passed
- **Time:** 2ms

### ✅ Package.json Valid
- **Status:** PASSED
- **Message:** Package.json is valid
- **Details:** All required fields present: name, version, scripts, dependencies, devDependencies
- **Time:** 1ms

### ✅ Dependencies Installed
- **Status:** PASSED
- **Message:** Dependencies are installed
- **Details:** node_modules and pnpm-lock.yaml found
- **Time:** 1ms

