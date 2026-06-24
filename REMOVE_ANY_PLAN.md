# Plan: Remove `any` from Codebase (TypeScript Tech Debt)

## Goal

Eliminate the use of `any` and `as any` across the codebase to restore full TypeScript type safety, prevent silent bugs, and make future refactoring safe.

## Context for AI Agent

This codebase currently relies heavily on `any` to bypass TypeScript checks. This has created tech debt. The goal is to incrementally replace `any` with strong typing, `unknown` + validation, or Drizzle inferred types.

**Do NOT fix everything at once.** Work phase by phase. Run `npm run build` or `npx tsc --noEmit` after each phase to ensure no type errors.

---

## Phase 1: Core Database & Functions (DONE) ✅

**Target:** Shared utilities and core transaction logic.

1. **File:** `src/routes/api/pos/transaction/+server.ts`
   - Remove `db: any` from function signatures (e.g., `getActiveSessionId`, `hasColumn`, `hasTable`, `getCheckoutCapabilities`).
   - Replace with the correct Drizzle DB type (e.g., `DrizzleD1Database<typeof schema>`).
2. **File:** `src/lib/utils/validation.ts`
   - Fix `validateIncomeExpense(data: any)` and `custom?: (value: any) => string | null`.
   - Define exact interface for `data` based on expected object shape.
3. **File:** `src/lib/utils/security.ts`
   - Fix `sessionData as any`.
   - Cast or validate to a proper session interface `{ timestamp: number, userId: string, branchId: string }`.

## Phase 2: API Endpoints (Inserts & Updates) (DONE) ✅

**Target:** All standard CRUD API routes in `src/routes/api/*`.

- **Files:** `produk/+server.ts`, `kategori/+server.ts`, `bahan/+server.ts`, `pengaturan/+server.ts`, `sesi-toko/+server.ts`, `tambahan/+server.ts`, etc.
- **Current Pattern:**
  ```typescript
  await db.insert(table).values(rows as any);
  .set({ ...(body.payload as any) })
  ```
- **Action:**
  - Define or import the correct Drizzle insert schemas: `type InsertModel = typeof schema.tableName.$inferInsert`.
  - Validate `rows` and `body.payload` before passing them to the database. If validation is too heavy for now, cast explicitly to `InsertModel` or `Partial<InsertModel>` instead of `any`.

## Phase 3: AI Chat Logic (High Risk) (DONE) ✅

**Target:** `src/routes/api/aichat/+server.ts`

- **Current Pattern:** Frequent use of inline casting like `(event as any).platform`, `(t as any)?.metode_bayar`, `(item as any)?.produk_id`.
- **Action:**
  - Define strict `interface` blocks for expected structures of `item`, `t` (transaction), and `event`.
  - Replace inline `any` casts with type guards or explicit object typing.
  - Example: `interface CartItem { produk_id?: string; jumlah?: number; harga?: number; }`

## Phase 4: Tests and Edge Cases (DONE) ✅

**Target:** `src/tests/` and miscellaneous files.

- **File:** `src/tests/feature-tests.ts`
  - Fix `(suite as any).tests` and `(suite as any).name`.
  - Define a proper `Suite` interface for test objects.

---

## Phase 5: Utils, Types, and Services (DONE) ✅

**Target:** `src/lib/utils/`, `src/lib/types/`, `src/lib/services/`, and `src/lib/server/`.

- Replace `any` in types with `unknown`.
- Replace `any` in generic arguments `(...args: any[])` with `(...args: unknown[])`.
- Replace `(item: any)` in array operations with `(item: Record<string, unknown>)` or specific interfaces.
- Fix `(performance as any)` and other type casts.

## Rules for AI Agent

1. **Never introduce new `any` types.**
2. If the shape is truly unknown (like raw API body), use `unknown` and validate it (e.g., with Zod) before accessing properties.
3. Commit after each Phase is completed and tests pass.
4. Keep commit messages concise (e.g., `refactor: replace any with strong types in API endpoints`).
