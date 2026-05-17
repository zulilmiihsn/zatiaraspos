# ZatiarasPOS Refactoring Tasks

## Fase 1: Formatting & Dead Code Cleanup

- [x] **1.1** Run Prettier on all src files
- [x] **1.2** Remove dead commented-out code in laporan/+page.svelte (LoC 614-750)

## Fase 2: Type Safety (13 tasks)

- [x] **2.1a** Remove duplicate ApiResponse/PaginatedResponse from types/product.ts
- [x] **2.1b** Remove duplicate ApiResponse/PaginatedResponse from types/transaction.ts
- [x] **2.2** Fix AppState `any` fields in types/index.ts
- [x] **2.3a** Create types/laporan.ts (BukuKasRecord, LaporanSummary, ReceiptSettings)
- [x] **2.3b** Create types/store.ts (BranchId, TokoSession)
- [x] **2.4a** Fix `any` in pos/+page.svelte (40+ → 7)
- [x] **2.4b** Fix `any` in pos/bayar/+page.svelte (25+ → 2)
- [x] **2.4c** Fix `any` in laporan/+page.svelte (80+ → 6)
- [x] **2.4d** Fix `any` in +page.svelte (dashboard)
- [x] **2.4e** Fix `any` in catat/+page.svelte
- [x] **2.4f** Fix `any` in pengaturan/riwayat/+page.svelte
- [x] **2.4g** Fix `any` in pengaturan/pemilik/manajemenmenu/+page.svelte
- [ ] **2.4h** Fix `any` in tests/code-quality-tests.ts

## Fase 3: Svelte 5 Migration (11 tasks)

- [ ] **3.1a** Migrate userRole.ts → userRole.svelte.ts
- [ ] **3.1b** Migrate selectedBranch.ts → selectedBranch.svelte.ts
- [ ] **3.1c** Migrate securitySettings.ts → securitySettings.svelte.ts
- [ ] **3.1d** Migrate posGridView.ts → posGridView.svelte.ts
- [ ] **3.2a** Convert $: in pos/+page.svelte → $derived/$effect
- [ ] **3.2b** Convert $: in pos/bayar/+page.svelte → $derived/$effect
- [ ] **3.2c** Convert $: in laporan/+page.svelte → $derived/$effect
- [ ] **3.2d** Convert $: in pengaturan/+page.svelte → $derived/$effect
- [x] **3.2e** Convert $: in manajemenmenu/+page.svelte → $derived/$effect
- [ ] **3.3a** Replace .subscribe() calls with $store syntax (8 files)
- [ ] **3.3b** Replace selectedBranch.subscribe() with $effect (4 files)

## Fase 4: Component Extraction (13 tasks)

- [ ] **4.1a** Create utils/touchNavigation.ts
- [ ] **4.1b** Create constants/navigation.ts
- [ ] **4.1c** Create utils/refreshBus.ts
- [ ] **4.2a** Extract LaporanFilter.svelte
- [ ] **4.2b** Extract LaporanSummaryCards.svelte
- [ ] **4.2c** Extract LaporanAccordion.svelte
- [ ] **4.2d** Move renderMarkdown to aiChatModal
- [ ] **4.3a** Extract DashboardMetrics.svelte
- [ ] **4.3b** Extract WeeklyChart.svelte
- [ ] **4.3c** Extract TokoModal.svelte
- [ ] **4.4a** Extract ProductGrid.svelte
- [ ] **4.4b** Extract CartPreview.svelte
- [ ] **4.4c** Extract CustomItemModal.svelte

## Fase 5: Deduplikasi & Polish (10 tasks)

- [ ] **5.1** Replace touch handlers in 3 routes with touchNavigation import
- [ ] **5.2** Replace navs arrays in 3 routes with navigation constant
- [ ] **5.3** Replace (window as any).\_\_refreshXxx (30 instances) with refreshBus
- [ ] **5.4** Centralize sesiAktif type and cekSesiToko logic
- [ ] **5.5** Standardize toast notification pattern
- [ ] **5.6** Fix a11y-ignore comments
- [ ] **5.7** Update .planning/STATE.md
- [ ] **5.8** Update .planning/ROADMAP.md
- [ ] **5.9** Run pnpm check → 0 errors
- [ ] **5.10** Run pnpm lint → exit 0
