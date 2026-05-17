# 🍹 ZatiarasPOS: Design Document Spec (DDS)

## 📋 Project Definition

**ZatiarasPOS** is a modern, high-performance Point of Sale (POS) application built for the Zatiaras retail business. It leverages SvelteKit 5 and Supabase to provide a real-time, multi-branch, and offline-capable retail experience.

## 🛠️ Technology Stack

- **Frontend**: SvelteKit 5.0 (Runes: `$state`, `$derived`, `$effect`, etc.)
- **Styling**: Tailwind CSS 4.x
- **Backend/DB**: Supabase (PostgreSQL with RLS)
- **Auth**: Custom PIN-based authentication + Supabase Auth
- **PWA**: `@vite-pwa/sveltekit` for offline support and native-like experience
- **State Management**: Svelte 5 Runes + `idb-keyval` for persistent local state

## 🏗️ Architecture & Rules

### 1. Svelte 5 Runes Only

- All reactive state MUST use `$state()`.
- Derived values MUST use `$derived()`.
- Side effects MUST use `$effect()`.
- **NO** Svelte 4 `writable` stores or `$` syntax for reactive variables unless strictly necessary for legacy integration.

### 2. Supabase & SSR

- User `@supabase/ssr` for session management.
- Enforce **Row Level Security (RLS)** on all tables.
- All database queries should handle errors gracefully and provide feedback to the UI.

### 3. PWA & Offline First

- Every transaction MUST be saved locally to IndexedDB first and synced periodically or upon restoration of connection.
- Use `workbox` for service worker management.

### 4. Code Quality

- **Type Safety**: strict TypeScript is mandatory.
- **Micro-animations**: Use Svelte transitions for all UI changes to maintain "Premium Design" aesthetics.
- **Internationalization**: All displays must follow Indonesian/WITA standards.

## 📊 Core Modules

1. **POS (Point of Sale)**: Fuzzy search, fuzzy cart merging, payment processing.
2. **Dashboard**: Financial analytics with animated charts.
3. **Catat**: Income/Expense recording with categorization.
4. **Laporan**: Comprehensive multi-day reporting.
5. **Pengaturan**: Branch, products, and employee management.

---

_Created with ❤️ by Antigravity (Google DeepMind) using GSD Framework._
