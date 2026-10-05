# Fitur dokumentasi, changelog & kode aktivasi kiosk — Ringkasan

Cabang `feat/fitur-dokumentasi` (6–7 Okt 2026). Tiga bagian: modul **Admin › Dokumentasi** untuk Super Admin, `docs/CHANGELOG.md` + `docs/CRITICAL.md`, dan **kode aktivasi kiosk** sebagai alternatif tautan aktivasi. Tidak ada fitur lama yang dihapus; tautan aktivasi kiosk tetap berfungsi seperti sebelumnya.

## Kriteria penerimaan

| Kriteria | Status | Bukti |
|---|:-:|---|
| `GET /admin/dokumentasi` (`admin.docs.index`) + `/admin/dokumentasi/{slug}` (`admin.docs.show`) | ✓ | `routes/docs.php`, `DocumentationController` |
| Hanya Super Admin (lainnya 403, tamu → login, slug tak dikenal 404) | ✓ | Gate `viewDocumentation` (`AppServiceProvider`); test matriks 5 peran + tamu + 404 |
| Allowlist di `config/docs.php`, tidak pernah path dari URL; uji path traversal | ✓ | `DocumentCatalog`: slug → path dari config; path harus relatif, tanpa `..`/`:`/`\`/NUL, berakhiran `.md`, `realpath` di dalam repo (symlink keluar ditolak). Rute membatasi slug `[a-z0-9-]`. Test: `..%2F.env`, `%2e%2e%2f…`, `..%5C`, `%00`, entri config jahat (`../`, absolut, `.env`, `composer.json`, symlink, `phar://`), glob `../*.md` |
| Markdown → HTML di server, aman seperti kebijakan privasi | ✓ | `DocumentRenderer` (league/commonmark, sudah terpasang lewat Laravel): komentar HTML dibuang, `html_input=escape`, `allow_unsafe_links=false`; test `<script>`, `<img onerror>`, `javascript:`/`data:`/`vbscript:`, gambar pelacak |
| Sidebar/daftar isi (heading), pencarian di daftar | ✓ | TOC h2–h3 dengan id `doc-…` unik; pencarian judul + path (semua kata, tanpa beda huruf besar/aksen) — `features/docs/filter.ts` + Vitest |
| Desktop + mobile | ✓ | Dipilih **tampilan baca sederhana di mobile** (bukan `DesktopOnlyNotice`): daftar → dokumen dengan "Daftar isi" yang bisa dibuka-tutup, tabel bisa digulir ke samping. Desktop: daftar (sticky) · dokumen · daftar isi (≥ 1280px) |
| `docs/CHANGELOG.md` (Indonesia, Keep a Changelog) per sprint 0–10 + perbaikan review | ✓ | Dari `docs/sprints/*/SUMMARY*.md`, `REVIEW-FIXES*` dan `git log main` |
| `docs/CRITICAL.md` (Indonesia): area keamanan, invariant, rahasia, backup, checklist go-live | ✓ | Fakta dicek ke kode (`ApprovalQueue::canDecide`, `BalanceLedger` + CHECK `leave_balances_non_negative`, `SelfieStorage`, `RestrictKioskDevice`, `config/security.php`, `QrCodeService`, `AuditLog`) |
| Kode kiosk sekali pakai 8 karakter tanpa karakter mirip, format `ABCD-2345`, disimpan hash, TTL sama dengan tautan | ✓ | `KioskActivationCode` (alfabet 31 karakter tanpa 0/O/1/I/L), kolom `kiosks.activation_code_hash` (HMAC-SHA256 dengan `APP_KEY`), `activation_expires_at` bersama |
| Ditampilkan ke HR bersama tautan (Admin › Lokasi & shift › Kiosk) | ✓ | Dialog "Aktivasi perangkat": kode besar + Salin, tautan + Salin, alamat `/kiosk` |
| Layar kiosk belum terpasang punya input kode (besar, huruf besar, format otomatis) | ✓ | `pages/kiosk/unpaired.tsx`, `features/kiosk/activation-code.ts` + Vitest |
| Rate limit 5/menit per IP + kunci setelah N gagal | ✓ | `KioskActivationController::redeemCode`: 5 percobaan/menit/IP (semua percobaan), kunci **15 menit setelah 10 kode salah** per IP (`config/attendance.php` `qr.activation_code`); pesan validasi Indonesia, bukan 429 kosong |
| Sekali pakai, kedaluwarsa, memakai tautan atau kode membatalkan keduanya | ✓ | `PairKiosk` mengosongkan kedua hash; menerbitkan ulang mengganti tautan & kode lama; menonaktifkan kiosk juga mengosongkan kode |
| Test kode: valid / kedaluwarsa / dipakai ulang / salah / rate limit / tautan tetap jalan | ✓ | `tests/Feature/Attendance/KioskActivationCodeTest.php`, `tests/Unit/Attendance/KioskActivationCodeTest.php`; `KioskTest` lama tetap hijau |

## Cara mencoba manual

1. `php artisan migrate` (kolom baru `kiosks.activation_code_hash`).
2. Masuk sebagai **admin@demo.test** → menu Admin › **Dokumentasi** (entri navigasi dari cabang navigasi) atau buka `/admin/dokumentasi`. Coba cari "sprint 3", buka "Hal kritis & go-live", klik daftar isi, klik tautan antardokumen di README. Masuk sebagai hr@demo.test → `/admin/dokumentasi` = 403.
3. Kiosk: sebagai hr@demo.test buka Admin › Lokasi & shift › Kiosk QR → **Aktivasi perangkat** → catat kodenya. Di browser lain (atau jendela privat) buka `/kiosk`, ketik kode (huruf kecil/tanpa tanda hubung juga diterima) → layar QR kiosk muncul. Tautan dari dialog yang sama kini tidak berlaku lagi. Coba kode salah 6× dalam semenit → pesan "Terlalu banyak percobaan…".

## Keputusan

- **Mobile dokumentasi = tampilan baca**, bukan banner desktop: membaca dokumen tidak butuh layar lebar dan berguna saat darurat. Catatan untuk lead: entri navigasi "Dokumentasi" dari cabang navigasi ditandai `desktopOnly` (tidak tampil di tab Menu ponsel); halaman tetap berfungsi di ponsel lewat URL. Cukup hapus `desktopOnly` di `lib/navigation.ts` bila ingin tampil di Menu.
- **Allowlist pola sprint**: `docs/sprints/*/*SUMMARY*.md` (mencakup `CORE-SUMMARY`, `LOGIN-SUMMARY`, dll. di sprint 1 yang tidak bernama `SUMMARY*`), `docs/sprints/*/REVIEW-FIXES*.md`, `docs/sprints/REVIEW-FIXES*.md`, `docs/sprints/FITUR-*.md`. `PLAN.md` dan `PROMPTS.md` sengaja tidak ditampilkan. Slug pola diturunkan dari path (`docs/sprints/sprint-3/SUMMARY.md` → `sprints-sprint-3-summary`), judul dari heading `#` pertama. Berkas yang tidak ada (mis. `docs/` tidak ikut di image produksi) dilewati tanpa galat; halaman menampilkan keadaan kosong.
- **Tautan di dokumen**: tautan relatif ke dokumen lain di allowlist diubah menjadi tautan in-app (berikut anchor `#…` → `#doc-…`); tautan relatif lain (berkas kode, dokumen di luar daftar) dijadikan teks biasa; tautan http(s) dibuka di tab baru dengan `rel="noopener noreferrer"`; gambar diganti teks alt (tidak memuat gambar dari host luar, CSP tetap ketat).
- **Cache HTML** per berkas (kunci = path + ukuran + mtime + versi renderer, 1 hari, `config/docs.php`), jadi dokumen yang diedit langsung tampil versi baru.
- **Image produksi menyertakan Markdown `docs/`** (`.dockerignore` kini hanya membuang `docs/mockups`), agar Dokumentasi berguna di produksi.
- **Audit `docs.viewed` tidak dibuat** (sesuai brief: tidak perlu).
- **Kode kiosk di-HMAC dengan `APP_KEY`** (tautan tetap SHA-256 biasa): ruang kode ±8,5 × 10¹¹ cukup kecil untuk ditebak dari dump database tanpa kunci. Konsekuensi: rotasi `APP_KEY` membatalkan kode yang belum dipakai (terbitkan ulang) — dicatat di `CRITICAL.md`.
- **Batas percobaan di controller, bukan middleware `throttle`**, agar layar kiosk menerima galat validasi Inertia yang terbaca ("Terlalu banyak percobaan. Coba lagi dalam N detik/menit."). Penguncian dihitung per IP sejak kegagalan pertama (jendela 15 menit); keberhasilan menghapus hitungan gagal.
- **Kode diketik = konfirmasi**: berbeda dengan tautan (GET hanya konfirmasi agar pratinjau tautan tidak memakai token), memasukkan kode adalah tindakan sengaja di perangkat itu, jadi langsung memasangkan. Efeknya sama dengan tautan: akun karyawan di browser itu dikeluarkan, perangkat kiosk lama berhenti.
- Logika pemasangan dipindah ke Action `PairKiosk` (dipakai `ActivateKiosk` dan `ActivateKioskWithCode`); audit `kiosk.activated` kini mencatat `via` = `link`/`code`.

## Paket baru

Tidak ada. Markdown memakai `league/commonmark` yang sudah terpasang sebagai dependensi Laravel (ekstensi GFM + HeadingPermalink bawaannya).

## Berkas utama

- Dokumentasi: `config/docs.php`, `app/Domain/Documentation/{Data,Services}`, `app/Http/Controllers/Admin/DocumentationController.php`, `routes/docs.php`, `resources/js/pages/admin/docs/index.tsx`, `resources/js/features/docs/*`, CSS `.doc-prose` di `resources/css/app.css`, `tests/Feature/Documentation/DocumentationTest.php`.
- Kiosk: migrasi `2026_10_08_100000_add_activation_code_hash_to_kiosks.php`, `app/Domain/Attendance/Support/KioskActivationCode.php`, Actions `PairKiosk`, `ActivateKioskWithCode` (+ `ActivateKiosk`, `IssueKioskActivation`, `SaveKiosk` diubah), `KioskActivationCodeRequest`, `KioskActivationController::redeemCode`, rute `kiosk.activate.code` (`POST /kiosk/aktivasi`), `features/attendance/admin/kiosks-section.tsx`, `pages/kiosk/unpaired.tsx`.
- Deploy: `.dockerignore` (hanya `docs/mockups` dibuang).
- Dokumen: `docs/CHANGELOG.md`, `docs/CRITICAL.md`, `docs/DATABASE.md` (kolom kiosks), `docs/ARCHITECTURE.md` §3.2, `README.md` (tabel dokumentasi).

## Status pemeriksaan (setelah `git merge main`)

- Pest: **1931 test hijau** (baru: 23 dokumentasi, 31 kode kiosk feature + unit).
- Vitest: **311 test hijau** (baru: 5 format kode, 3 filter dokumen).
- `composer lint` (Pint + Larastan level 8), `npm run typecheck`, `npm run lint` bersih. Migrasi bisa di-rollback.
- Dicek di browser (build produksi): daftar & dokumen desktop 1440 (gelap), mobile 375, layar `/kiosk` dengan input kode + galat, dialog aktivasi HR.

## Sisa / risiko

- Belum diuji di perangkat kiosk fisik (TV/tablet) — input kode memakai `autocapitalize="characters"` dan font mono besar.
- `.dockerignore` sebelumnya membuang seluruh `docs/` dari image produksi, sehingga halaman hanya akan menampilkan README. Kini hanya `docs/mockups` (PNG ±14 MB) yang dibuang; Markdown (±1 MB) ikut di image. Belum dibangun ulang di Docker lokal — cek sekali saat deploy berikutnya.
