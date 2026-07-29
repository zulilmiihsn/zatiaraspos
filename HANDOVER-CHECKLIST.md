# Checklist Serah Terima ZatiarasPOS

Semua item penerimaan manusia dan release tag sengaja belum dicentang. Isi tanggal, penanggung jawab, dan bukti tanpa menempelkan secret.

## Akses dan kepemilikan

- [ ] Pemilik menerima akses repository GitHub dengan least privilege.
- [ ] Pemilik menerima akses akun Cloudflare yang mengelola Pages, Worker, D1, R2, dan Durable Objects.
- [ ] Pemilik menerima akses registrar/DNS domain.
- [ ] Pemilik menerima akun `pemilik` aplikasi.
- [ ] Semua credential disimpan di password manager, bukan chat atau dokumen.
- [ ] 2FA aktif untuk GitHub, Cloudflare, domain, dan password manager.
- [ ] Daftar anggota/kolaborator ditinjau; akses tidak perlu dicabut.
- [ ] Kontak pemulihan akun dimiliki pemilik.

## Kandidat teknis

- [ ] Catat `RELEASE_COMMIT_SHA` dari summary quick task: `[isi SHA]`
- [ ] Pastikan commit tersebut berisi tepat sembilan file source/docs handover.
- [ ] Pastikan branch `dev` di origin memuat commit tersebut.
- [ ] Pastikan tidak ada SQL, manifest, `.env`, cookie, token, atau secret dalam commit.
- [ ] Pastikan tidak ada Cloudflare deployment yang dilakukan oleh task handover.
- [ ] Backup production baru memiliki tiga shard, manifest terverifikasi, dan `COMPLETE`.
- [ ] Lokasi backup berada di luar repository/workspace dan ACL terbatas.

## UAT pemilik

- [ ] Login sebagai pemilik pada cabang yang benar.
- [ ] Login sebagai kasir pada cabang yang benar.
- [ ] Buka tepat satu sesi toko melalui aplikasi.
- [ ] Tambah/ubah satu produk uji lalu periksa katalog.
- [ ] Selesaikan transaksi tunai dan periksa kembalian.
- [ ] Selesaikan transaksi QRIS kecil setelah konfirmasi merchant manual.
- [ ] Cetak struk dan cetak ulang dari riwayat.
- [ ] Periksa laporan cabang dan periode yang dipilih.
- [ ] Uji transaksi tunai offline setelah warm-up online.
- [ ] Pulihkan koneksi dan pastikan antrean menjadi nol tanpa transaksi ganda.
- [ ] Catat semua ID transaksi uji.
- [ ] Hapus/void semua transaksi uji melalui akun pemilik.
- [ ] Buktikan transaksi, ledger, dan idempotency UAT tidak menyisakan residu.
- [ ] Tutup sesi toko melalui aplikasi setelah pengujian.

## Dokumentasi dan operasi

- [ ] Pemilik membaca `OWNER-GUIDE.md`.
- [ ] Operator membaca `OPERATIONS-RUNBOOK.md`.
- [ ] Pemilik menerima `KNOWN-LIMITATIONS.md`.
- [ ] Jadwal backup manual atau scheduler eksternal ditetapkan.
- [ ] Kebijakan retensi backup ditetapkan pemilik.
- [ ] Penanggung jawab insiden dan jalur eskalasi ditetapkan.
- [ ] Daftar perangkat dan printer operasional dicatat.

## Release setelah persetujuan eksplisit

- [ ] Pemilik menyatakan UAT diterima secara eksplisit.
- [ ] Fetch ulang branch dan tag lokal/remote.
- [ ] Pastikan `v2.0.2` belum ada lokal maupun remote.
- [ ] Pastikan `RELEASE_COMMIT_SHA` tetap menunjuk commit sembilan file, bukan commit metadata.
- [ ] Buat annotated tag `v2.0.2` tepat pada `RELEASE_COMMIT_SHA`.
- [ ] Push tag setelah persetujuan.
- [ ] Lakukan deployment hanya melalui keputusan/release workflow terpisah.
- [ ] Verifikasi live setelah deployment terpisah.

Perintah tag untuk dijalankan nanti, bukan bagian task otomatis ini:

```powershell
rtk git tag -a v2.0.2 <RELEASE_COMMIT_SHA> -m "ZatiarasPOS owner handover v2.0.2"
rtk git push origin v2.0.2
```

## Rotasi dan dukungan

- [ ] Credential dirotasi setelah akses baru terbukti bekerja.
- [ ] Token lama dicabut.
- [ ] Masa dukungan 7–14 hari disepakati: mulai `[tanggal]` selesai `[tanggal]`.
- [ ] Issue log bersama dibuat dengan pemilik dan prioritas.
- [ ] Semua blocker UAT ditutup atau diterima tertulis sebagai limitation.

## Penerimaan

- [ ] Pemilik menerima aplikasi dan batasannya.

Nama pemilik: `[isi nama]`

Nama penyerah: `[isi nama]`

Tanggal dan zona waktu: `[isi tanggal dan zona waktu]`

Referensi issue/berita acara: `[isi referensi]`

Catatan penerimaan: `[isi catatan]`
