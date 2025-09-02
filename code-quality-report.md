# 🧪 CODE QUALITY TEST REPORT

**Generated:** 02/09/2025, 13.16.38

## 📊 SUMMARY

- **Total Tests:** 8
- **Passed:** 4 ✅
- **Failed:** 4 ❌
- **Success Rate:** 50.0%
- **Total Time:** 194877ms

## TypeScript Compilation

- **Tests:** 2/2 passed
- **Time:** 150840ms

### ✅ TypeScript Check
- **Status:** PASSED
- **Message:** TypeScript compilation successful
- **Details:** All TypeScript files compiled without errors
- **Time:** 1538ms

### ✅ TypeScript Build
- **Status:** PASSED
- **Message:** Build successful
- **Details:** Application built without errors
- **Time:** 149300ms

## Code Linting

- **Tests:** 1/2 passed
- **Time:** 44028ms

### ❌ ESLint Check
- **Status:** FAILED
- **Message:** ESLint failed
- **Details:** 
> zatiaraspos@0.0.1 lint D:\zatiaraspos
> prettier --check .

Checking formatting...
 ELIFECYCLE  Command failed with exit code 1.

- **Time:** 21896ms

### ✅ Prettier Format Check
- **Status:** PASSED
- **Message:** Code formatting is correct
- **Details:** All files follow formatting standards
- **Time:** 22131ms

## File Structure

- **Tests:** 0/2 passed
- **Time:** 5ms

### ❌ Required Files Exist
- **Status:** FAILED
- **Message:** File check failed
- **Details:** missingFiles is not defined
- **Time:** 1ms

### ❌ Directory Structure
- **Status:** FAILED
- **Message:** Directory check failed
- **Details:** missingDirs is not defined
- **Time:** 2ms

## Dependencies

- **Tests:** 1/2 passed
- **Time:** 4ms

### ❌ Package.json Valid
- **Status:** FAILED
- **Message:** Package.json validation failed
- **Details:** missingFields is not defined
- **Time:** 1ms

### ✅ Dependencies Installed
- **Status:** PASSED
- **Message:** Dependencies are installed
- **Details:** node_modules and pnpm-lock.yaml found
- **Time:** 1ms

