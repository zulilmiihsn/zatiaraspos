# Android Architecture Blueprint - Zatiaras POS (v2 Rev)

Dokumen ini adalah panduan teknis lengkap untuk membangun ulang (rebuild) Zatiaras POS menggunakan **Native Android (Kotlin)**. Blueprint ini dirancang untuk memenuhi seluruh kebutuhan fitur pada `REBUILD_SPECS.md`, termasuk dukungan AI, Multi-Cabang, dan Hardware Integration secara production-ready.

## 1. Tech Stack
- **Language**: Kotlin 2.0+
- **UI Toolkit**: Jetpack Compose (Material Design 3) - *Declarative UI modern.*
- **Local Database**: Room Database (SQLite) + **Room FTS4** (Offline Search).
- **Networking**: **Ktor Client** (Kotlin-native, Multiplatform ready).
- **Dependency Injection**: Hilt (Dagger).
- **Async & Concurrency**: Kotlin Coroutines & Flow.
- **Background Tasks**: **WorkManager** - *Guaranteed execution for Sync.*
- **Image Loading**: **Coil** (Coroutine Image Loader).
- **Navigation**: Jetpack Navigation Compose (Type-safe).
- **Security**: Jetpack Security (EncryptedSharedPreferences) & BiometricPrompt.
- **Logging**: Timber.

## 2. Arsitektur Aplikasi: Modular MVVM + Clean Architecture
Aplikasi dibagi menjadi modul fitur untuk skalabilitas.

```
com.zatiaras.pos
├── app (Main Entry)
├── core
│   ├── data (Database, Network Client)
│   ├── domain (Base UseCases)
│   ├── ui (Theme, Base Components)
└── feature
    ├── auth (Login, PIN, Biometric)
    ├── pos (Cart, Catalog, Payment)
    ├── transactions (History, Sync)
    ├── reports (Dashboard, Charts)
    ├── inventory (Product CRUD, Stocks)
    ├── ai_assistant (Chatbot, Smart Input)
    └── settings (Printer, Server Config)
```

## 3. Strategi Implementasi Fitur Kunci

### A. Multi-Branch Architecture (Dynamic Config)
Berbeda dengan web lama yang hardcoded, versi Android harus dinamis.
- **Implementation**:
  - `BranchConfigRepository`: Menyimpan URL Supabase dan API Key cabang aktif di `EncryptedSharedPreferences`.
  - **Dynamic Injection**: Instance `SupabaseClient` dibuat ulang (Re-injected via Hilt custom scope) saat user mengganti cabang di setting, tanpa perlu restart aplikasi.

### B. Offline Sync Engine (Bi-Directional)
Sinkronisasi dua arah untuk menjamin data konsisten.
1.  **Local-to-Remote (Upload Transaksi)**:
    - User simpan transaksi -> Room DB (`is_synced = false`).
    - `WorkManager` (Periodic 15min + Triggered on Connectivity) upload data pending.
2.  **Remote-to-Local (Realtime Updates)**:
    - Menggunakan **Supabase Realtime (Kotlin SDK)**.
    - Listener aktif mendengarkan perubahan tabel `products` dan `orders` untuk update stok instan antar kasir.
  3.  **Efficiency Strategy (Limit Mitigation)**:
      - Menggunakan pola **Delta Sync**: App hanya men-download data yang berubah sejak *last_sync_timestamp*.
      - Mengurangi beban "Database Egress" Supabase secara drastis (Solusi untuk Free Tier Limits).

### C. AI & Smart Features (Secure Gateway)
Integrasi AI untuk "Smart Recorder" dan "Tanya Jawab Laporan".
- **Pattern**: **Backend-For-Frontend (BFF)**.
- **Flow**: Aplikasi Android TIDAK memanggil OpenAI langsung.
  - Android mengirim input teks -> Supabase Edge Function (`/api/ai-process`).
  - Edge Function memproses dengan OpenAI -> Response JSON terstruktur.
  - Android menerima hasil parsig -> Tampilkan konfirmasi ke user.
- **Keuntungan**: API Key aman di server, logic parsing bisa diupdate tanpa update APK.

### D. Hardware Integration & Security
1.  **Thermal Printer**:
    - Service layer khusus `PrinterManager` yang abstrak.
    - Implementasi adapter untuk **Bluetooth** (Generic ESC/POS) dan **Sunmi/iMin SDK** (jika nanti pakai device khusus).
2.  **Biometric Auth**:
    - Menggunakan `BiometricPrompt` API.
    - User bisa login atau akses menu sensitif (Laporan) pakai Fingerprint/FaceID sebagai pengganti PIN.

### E. Product Management & Media Handling
Fitur CRUD Produk lengkap (Backoffice di HP).
- **Inventory Module**:
  - Support Add/Edit/Delete Produk & Kategori.
  - **Image Processing**:
    - Menggunakan helper `ImageCompressor` sebelum upload.
    - Upload ke Supabase Storage via `ImageRepository`.
    - Mekanisme *Optimistic UI*: Tampilkan gambar lokal segera sementara upload berjalan di background.

### F. Advanced Offline Search (Fuzzy Logic)
Mengatasi keterbatasan SQLite biasa untuk pencarian "Toleran Typo" (Fuzzy).
- **Implementation**:
  - Menggunakan **Room FTS4 (Full Text Search)** module.
  - Membuat virtual table khusus pencarian index produk.
  - Implementasi *Trigram* sederhana atau algoritma jarak karakter (Levenshtein) di layer Repository jika FTS standar kurang akurat untuk typo parah.

## 4. Database Schema (Room Entities) Mapping
Mapping kritis untuk mendukung Offline-First.

### `ProductEntity`
- `id`: String (PK)
- `branch_id`: String (Partitioning key untuk multi-cabang di satu device)
- `name`: String
- `price`: Double
- `variants`: String (JSON: Gula, Es)
- `addons`: String (JSON)

### `TransactionEntity`
- `uuid`: String (PK)
- `sync_status`: Enum (PENDING, SYNCED, FAILED)
- `offline_created_at`: Long
- `payload`: String (JSON lengkap transaksi untuk di-upload)

## 5. Migration Guide (SvelteKit to Kotlin)

| Konsep SvelteKit Web | Implementasi Android Kotlin |
| :--- | :--- |
| **Logic** | |
| `AiAnalysisService.ts` | `AiRepository` + Remote Edge Function Call |
| `DataService.ts` (Caching) | `Room Database` (Single Source of Truth) |
| `selectedBranch` Store | `BranchManager` (Encrypted Preferences) |
| **UI** | |
| `+page.svelte` | `@Composable fun Screen()` |
| `writable()` Store | `MutableStateFlow` (di ViewModel) |
| Tailwind Classes | Jetpack Compose Modifiers (`Modifier.padding().fillMaxWidth()`) |
| **Features** | |
| `localStorage` | `DataStore` / `SharedPreferences` |
| `IndexedDB` | `Room` (SQLite) |
| Service Worker (PWA) | `WorkManager` (Background Services) |

## 6. Testing Strategy
- **Unit Test**: JUnit 5 + Mockk (Untuk ViewModel & UseCases).
- **UI Test**: Compose UI Test (Test user interaction).
- **End-to-End**: Maestro (Tool testing UI modern yang lebih simpel dari Appium).
