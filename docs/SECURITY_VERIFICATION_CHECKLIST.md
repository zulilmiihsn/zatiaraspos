# Security Verification Checklist (Phase 1–3)

Tanggal: 2026-02-27  
Project: ZatiarasPOS

## 1) Login + Session Cookie

- [ ] Buka `/login`, login dengan kredensial valid.
- [ ] Buka DevTools → Application → Cookies.
- [ ] Pastikan cookie `zatiaras_sid` ada.
- [ ] Validasi cookie:
  - [ ] `HttpOnly = true`
  - [ ] `SameSite = Lax`
  - [ ] `Path = /`
- [ ] Panggil `GET /api/session` (via browser/devtools/network) dan pastikan response `authenticated: true`.

Expected:
- Login berhasil.
- Session dibaca dari cookie server-side, bukan dari localStorage.

---

## 2) Logout + Session Revoke

- [ ] Jalankan logout dari UI.
- [ ] Pastikan cookie `zatiaras_sid` hilang.
- [ ] Coba akses endpoint proteksi (`/api/aichat` atau `/api/gantikeamanan`) tanpa login.

Expected:
- Response `401 Unauthorized`.

---

## 3) CSRF Protection

- [ ] Login dulu (agar ada session).
- [ ] Kirim `POST /api/gantikeamanan` TANPA header `X-CSRF-Token`.
- [ ] Kirim lagi dengan token salah.
- [ ] Ambil token valid dari `GET /api/csrf`, lalu kirim dengan header benar.

Expected:
- Tanpa token / token salah → `403 CSRF token invalid`.
- Token valid + payload valid → lanjut diproses.

---

## 4) Authorization (Ganti Keamanan)

- [ ] Login sebagai user non-`pemilik`/non-`admin`.
- [ ] Panggil `POST /api/gantikeamanan`.
- [ ] Login sebagai `pemilik` atau `admin`, ulangi request.

Expected:
- Non-privileged role → `403 Forbidden`.
- `pemilik`/`admin` → request bisa diproses.

---

## 5) Branch Validation

- [ ] Coba request login dengan `branch` invalid (contoh: `hacker_branch`).
- [ ] Coba request `/api/aichat` dengan `branch` invalid.

Expected:
- Response `400` dengan pesan branch tidak valid.

---

## 6) Rate Limiting

### Login endpoint (`/api/veriflogin`)
- [ ] Lakukan >5 request login gagal dalam window 15 menit.

Expected:
- Muncul `429` setelah batas terlampaui.

### Ganti keamanan (`/api/gantikeamanan`)
- [ ] Lakukan >3 request gagal dalam window 15 menit.

Expected:
- Muncul `429`.

### AI chat (`/api/aichat`)
- [ ] Lakukan burst request hingga melewati limit.

Expected:
- Muncul `429`.

---

## 7) Security Headers

- [ ] Cek response headers (misalnya halaman `/` atau endpoint API):
  - [ ] `X-Frame-Options: DENY`
  - [ ] `X-Content-Type-Options: nosniff`
  - [ ] `Referrer-Policy: strict-origin-when-cross-origin`
  - [ ] `Permissions-Policy` tersedia
  - [ ] `Content-Security-Policy` tersedia

Expected:
- Semua header di atas terpasang.

---

## 8) OpenRouter Key Exposure Check

- [ ] Pastikan env var yang dipakai adalah `OPENROUTER_API_KEY` (tanpa prefix `VITE_`).
- [ ] Cari di source browser (DevTools Sources) apakah nilai key muncul literal.

Expected:
- Key tidak terekspos di client bundle.

---

## 9) PIN Storage Hardening

- [ ] Cek localStorage key `zatiaras_security_settings`.
- [ ] Pastikan data hanya menyimpan `lockedPages`.
- [ ] Pastikan PIN tidak disimpan plaintext di localStorage.

Expected:
- PIN tidak persisten di localStorage.

---

## 10) Security Event Logging

- [ ] Trigger event yang valid dari UI (misal login gagal).
- [ ] Pastikan endpoint `/api/security-events` menerima event valid.
- [ ] Coba kirim event type invalid.
- [ ] Coba kirim payload besar (>4KB).

Expected:
- Event valid diterima.
- Event type invalid → `400`.
- Payload terlalu besar → `413`.

### Tambahan observability (ringkasan error API)

- [ ] Login sebagai `pemilik` atau `admin`.
- [ ] Akses endpoint `GET /api/security-events?windowHours=24`.
- [ ] Pastikan response berisi `eventTypeCounts` dan `apiFailures.byEndpointCodeStatus`.
- [ ] Akses endpoint yang sama tanpa login.

Expected:
- Role `pemilik/admin` bisa melihat ringkasan.
- Tanpa sesi → `401` (`UNAUTHORIZED`).

---

## 11) Quick Regression (Smoke)

- [ ] Login normal.
- [ ] Navigasi dashboard/POS/laporan.
- [ ] Logout.
- [ ] Re-login.

Expected:
- Alur utama tetap berfungsi, tanpa error runtime.

---

## Catatan Operasional

- Wajib rotate API key OpenRouter jika sempat terekspos sebelumnya.
- Jalankan ulang verifikasi ini setelah perubahan auth/security berikutnya.
