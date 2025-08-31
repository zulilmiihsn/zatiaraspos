# 🧪 CODE QUALITY TEST REPORT

**Generated:** 31/08/2025, 21.29.40

## 📊 SUMMARY

- **Total Tests:** 8
- **Passed:** 7 ✅
- **Failed:** 1 ❌
- **Success Rate:** 87.5%
- **Total Time:** 204891ms

## TypeScript Compilation

- **Tests:** 2/2 passed
- **Time:** 161386ms

### ✅ TypeScript Check
- **Status:** PASSED
- **Message:** TypeScript compilation successful
- **Details:** All TypeScript files compiled without errors
- **Time:** 41886ms

### ✅ TypeScript Build
- **Status:** PASSED
- **Message:** Build successful
- **Details:** Application built without errors
- **Time:** 119497ms

## Code Linting

- **Tests:** 1/2 passed
- **Time:** 43472ms

### ❌ ESLint Check
- **Status:** FAILED
- **Message:** ESLint failed
- **Details:** 
> zatiaraspos@0.0.1 lint D:\zatiaraspos
> prettier --check . && eslint .

Checking formatting...
 ELIFECYCLE  Command failed with exit code 1.

- **Time:** 16314ms

### ✅ Prettier Format Check
- **Status:** PASSED
- **Message:** Code formatting is correct
- **Details:** All files follow formatting standards
- **Time:** 27153ms

## File Structure

- **Tests:** 2/2 passed
- **Time:** 19ms

### ✅ Required Files Exist
- **Status:** PASSED
- **Message:** All required files present
- **Details:** Found 10 required files
- **Time:** 1ms

### ✅ Directory Structure
- **Status:** PASSED
- **Message:** Directory structure is correct
- **Details:** All 9 required directories present
- **Time:** 2ms

## Dependencies

- **Tests:** 2/2 passed
- **Time:** 14ms

### ✅ Package.json Valid
- **Status:** PASSED
- **Message:** Package.json is valid
- **Details:** All required fields present: name, version, scripts, dependencies, devDependencies
- **Time:** 1ms

### ✅ Dependencies Installed
- **Status:** PASSED
- **Message:** Dependencies are installed
- **Details:** node_modules and pnpm-lock.yaml found

