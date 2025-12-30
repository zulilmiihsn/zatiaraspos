# 🗺️ Product Roadmap: Zatiaras POS (Android Native)

> **Status**: 🟢 Active Development
> **Phase**: Phase 1 - Foundation & Authentication

## 🏁 Phase 1: Foundation & Architecture (Sprints 1-2)
- [x] **Project Scaffolding**: Setup Gradle, Multi-module structure, basic Compose.
- [x] **Documentation Setup**: Setup `.ai` context, `rules.md`, and docs folder structure.
- [ ] **Core Modules**: Setup `:core:data` (Database/Network) and `:core:ui` (Theme/Components).
- [ ] **Dependency Injection**: Global Hilt setup.

## 🔐 Phase 2: Authentication & Settings (Sprints 3-4)
- [ ] **Supabase Auth**: Login Screen with Email/Password.
- [ ] **Account Settings**: Separate screens for `Cashier` vs `Owner` profiles.
- [ ] **Session Management**: `DataStore` implementation for token storage.
- [ ] **Biometric Lock**: Fingerprint/FaceID integration for app unlock.
- [ ] **PIN System**: Fallback PIN for sensitive actions.

## 📦 Phase 3: Inventory Management - "The Backoffice" (Sprints 5-6)
- [ ] **Product Database**: Room Entities for `Product`, `Category`, `Variant`.
- [ ] **CRUD Features**: Add, Edit, Delete Products.
- [ ] **Image Handling**: `Coil` integration + Image Upload to Supabase Storage.
- [ ] **Offline Search**: `Room FTS4` implementation for typo-tolerant product search.

## 🛒 Phase 4: Point of Sales (POS) - "The Cashier" (Sprints 7-9)
- [ ] **Catalog Grid**: Performance-optimized LazyVerticalGrid for products.
- [ ] **Cart Logic**: Local state management for transaction checking.
- [ ] **Checkout UI**: Bottom Sheet implementation (replacing `/pos/bayar` page).
- [ ] **Manual Record**: "Buku Kas" feature for non-POS income/expense (`/catat`).
- [ ] **Transaction Engine**: Calculation logic (Tax, Discount) - *Offline Safe*.
- [ ] **Checkout & Payment**: Cash, QRIS (Placeholder), Print Receipt (Bluetooth).

## 🔄 Phase 5: Sync Engine & Cloud (Sprint 10)
- [ ] **WorkManager Setup**: Background workers for upload.
- [ ] **Delta Sync**: Logic to fetch only *changed* data.
- [ ] **Conflict Resolution**: "Last Write Wins" logic.

## 📊 Phase 6: Reports & AI (Sprint 11+)
- [ ] **Dashboard Charts**: Compose Canvas/Charts.
- [ ] **AI Assistant**: BFF Integration (Android -> Supabase Edge Function -> OpenAI).
