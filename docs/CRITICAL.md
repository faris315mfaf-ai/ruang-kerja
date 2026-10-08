# Hal kritis — RuangKerja

Pengetahuan operasional yang **tidak boleh hilang**: area sensitif keamanan, aturan (invariant) yang tidak boleh rusak oleh perubahan apa pun, rahasia, backup, dan checklist go-live. Baca sebelum mengubah kode di area yang disebut di sini, sebelum deploy pertama, dan saat serah terima ke pengelola baru. Rincian ada di `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/security/ASVS-L1.md`, `README.md` (deploy, backup) dan `docs/HANDOFF.md`.

## 1. Invariant yang tidak boleh rusak

| Aturan | Di mana dijaga | Mengapa |
|---|---|---|
| **Semua PK = ULID** (`HasUlids`, `$table->ulid('id')->primary()`, FK `foreignUlid`). Tabel paket (roles, permissions, notifications) memakai kunci sendiri; morph key = ULID. ULID dibandingkan sebagai **string** (mis. otorisasi channel). | Migrasi, model | ID tidak bisa ditebak berurutan; perbandingan int vs string pernah membuka channel privat (perbaikan Sprint 1). |
| **Setiap daftar data lewat scope `visibleTo($user)`** dan setiap endpoint diotorisasi (Policy / `Gate::authorize`). Workspace yang tidak terlihat dijawab **404**, bukan 403. | Model (`scopeVisibleTo`), Policy di `app/Policies`, controller | Karyawan hanya melihat dirinya, bawahan, divisi yang dipimpin (HR/Direksi/Super Admin: semua dalam perusahaannya). Query tanpa scope = kebocoran data. |
| **Persetujuan pengajuan**: pemohon tidak pernah menyetujui pengajuannya sendiri (langkahnya dilewati); satu orang paling banyak memutus **satu langkah per putaran** (termasuk sebagai delegasi); penyetuju harus aktif dan satu perusahaan; keputusan diambil di bawah row lock (`DecisionGuard`). Delegasi tidak boleh membentuk siklus. | `ApprovalQueue::canDecide`, `DecisionGuard`, `RouteToDelegates` | Mencegah persetujuan diri sendiri dan "dua tanda tangan dari orang yang sama". |
| **Saldo cuti tidak pernah negatif**: reservasi saat diajukan (`pending`), dipakai saat disetujui (`used`), dilepas saat ditolak/revisi/batal — selalu dengan `lockForUpdate` di dalam transaksi, plus **CHECK constraint** `leave_balances_non_negative` di database. Tumpang tindih pengajuan dicek ulang di bawah kunci per pengguna. | `BalanceLedger`, migrasi `leave_types`, `OverlapDetector` | Balapan dua pengajuan bersamaan tidak boleh menembus kuota. Jangan hapus constraint-nya. |
| **Nomor berurutan** (pengajuan `CUT-2026-10-0001`, tugas `KEY-n`) dibuat atomik (`INSERT … ON CONFLICT … RETURNING` / `UPDATE … RETURNING` di transaksi). | `RequestNumberGenerator`, penomoran tugas | Tidak ada nomor ganda saat konkurensi. |
| **Selfie privat**: disimpan di disk privat (`ATTENDANCE_SELFIE_DISK`, S3 di produksi), hanya bisa dibuka lewat **URL bertanda tangan 5 menit** (middleware `signed`) **dan** policy `viewSelfie` (HR & atasan langsung, pemilik sendiri); **setiap** akses ditulis `selfie.viewed` ke audit log; dihapus otomatis setelah `ATTENDANCE_SELFIE_RETENTION_MONTHS` (default 12). | `SelfieStorage`, `AttendanceSelfieController`, `PurgeExpiredSelfiesJob` | Data biometrik (UU PDP). Jangan pernah membuat URL publik/permanen atau me-log path/isi selfie. |
| **Persetujuan lokasi & selfie** berversi; check-in GPS + selfie ditolak bila versi terbaru belum disetujui. Mengubah kebijakan privasi → naikkan `PRIVACY_POLICY_VERSION`. | `config/attendance.php` `consent`, `config/privacy.php` | Dasar hukum pemrosesan data. |
| **Isolasi kiosk**: perangkat kiosk masuk dengan guard `kiosk` (bukan baris `users`) dan hanya boleh membuka rute `kiosk.*` (`RestrictKioskDevice`, diprioritaskan sebelum `auth`; selain itu dialihkan, JSON 403). Kiosk nonaktif/dihapus/dipasang di perangkat lain langsung keluar (penanda `activated_at` di sesi). Tautan dan **kode aktivasi** sekali pakai, kedaluwarsa 24 jam, hanya hash yang disimpan (kode: HMAC dengan `APP_KEY`), memakai salah satunya membatalkan keduanya; percobaan kode dibatasi 5/menit per IP dan dikunci 15 menit setelah 10 kode salah. | `RestrictKioskDevice`, `AuthenticateKiosk`, `ActivateKiosk`, `ActivateKioskWithCode`, `IssueKioskActivation` | Tablet lobi yang tertinggal tidak boleh menjadi pintu ke data karyawan. |
| **QR dinamis**: kode = HMAC-SHA256(`ATTENDANCE_QR_SECRET`, `location_id|window`), jendela 30 detik, diterima ±1 jendela **dan** harus pernah ditampilkan kiosk aktif. Rahasia tidak pernah ke klien. Scan tanpa GPS diberi flag `qr_no_location` (atau ditolak bila `ATTENDANCE_QR_REQUIRE_LOCATION=true`). | `QrCodeService`, `QrLocationVerifier` | Kode yang difoto/diteruskan cepat kedaluwarsa. |
| **Audit log append-only**: model `AuditLog` melempar exception saat baris diubah, dan aplikasi tidak punya fitur hapus audit. Aksi sensitif (koreksi absensi, keputusan approval, lihat selfie, ubah peran, aktivasi kiosk, ekspor data) wajib tercatat. Rahasia disamarkan. | `AuditLogger`, `Auditable`, `AuditLog` | Jejak pertanggungjawaban. |
| **Peran**: hanya Super Admin yang memberi peran `super_admin`/`direksi`/`hr`; tidak ada yang bisa mengubah perannya sendiri. Super Admin wajib **TOTP**; login kata sandi hanya untuk Super Admin, karyawan lain wajib Google Workspace (domain + klaim `hd` dicek). | `RoleChangeGuard`, `EnsureTwoFactorForSuperAdmin`, `AuthenticateGoogleUser` | Eskalasi hak akses. |
| **Waktu disimpan UTC**; `work_date` dan tampilan memakai `config('app.office_timezone')` (Asia/Jakarta). Shift malam tercatat pada hari mulainya. | `OfficeClock`, `ScheduleResolver` | Rekap gaji dan alpha bergantung pada tanggal kerja yang benar. |
| **Panggilan Google API hanya di job antrean** (retry/backoff), kecuali membuat dokumen baru (sinkron, timeout 10 detik). Assertion service account hanya ke `oauth2.googleapis.com`. | `app/Domain/Google` | Request HTTP tidak boleh menggantung karena Google. |
| **Operasi multi-tabel di `DB::transaction()`**; event broadcast "tipis" (tanpa isi tugas/komentar, klien mengambil ulang lewat endpoint yang diotorisasi). | Action di `app/Domain/*` | Konsistensi data; tidak membocorkan isi lewat WebSocket. |
| **Dokumentasi in-app** hanya merender berkas di daftar `config/docs.php` (slug → path, path relatif berakhiran `.md` di dalam repo, symlink keluar ditolak), Markdown dengan HTML mentah di-escape. | `DocumentCatalog`, `DocumentRenderer` | Halaman ini tidak boleh menjadi pembaca berkas sembarang (`.env`). |

## 2. Area sensitif keamanan

- **CSP dengan nonce** (`app/Http/Middleware/SecurityHeaders.php`, `config/security.php`): skrip inline tanpa nonce diblokir. Menambah domain eksternal (CDN, peta, API) harus lewat `config/security.php` `sources`. Horizon & Pulse memakai CSP longgar (`relaxed_paths`) karena paketnya, dan hanya bisa dibuka Super Admin. Darurat: `CSP_REPORT_ONLY=true` (atau `CSP_ENABLED=false`) lalu `config:cache` — kembalikan secepatnya.
- **Rate limit** bernama di `AppServiceProvider` & provider modul (`login`, `google-login`, `check-in`, `api`, `comments`, `drive-uploads`, `search`, `password-reset`, kode kiosk di `KioskActivationController`). Di balik Caddy, IP klien benar hanya bila `TRUSTED_PROXIES` sesuai jaringan proxy.
- **Header lain**: HSTS, `Permissions-Policy` (kamera & geolokasi hanya origin sendiri), `Referrer-Policy`, `X-Content-Type-Options`.
- **Data pribadi**: NIK terenkripsi (`encrypted` cast) dan hanya tampil tersamar; token Google terenkripsi; file impor karyawan (berisi NIK) dihapus setelah sesi impor; ekspor spreadsheet menetralkan teks mirip rumus. **Jangan pernah me-log token, selfie, NIK, atau isi `.env`.**
- **Realtime (Reverb)**: setiap channel privat diotorisasi di `routes/channels.php` (absensi per perusahaan `company.{company}.attendance`, divisi, workspace, tugas, user).
- **Halaman admin** (`/admin/*`, `/horizon`, `/pulse`, `/admin/dokumentasi`) diotorisasi per peran; Super Admin wajib TOTP sebelum bisa membuka apa pun.

## 3. Rahasia & kunci

| Rahasia | Fungsi | Bila hilang / bocor / diganti |
|---|---|---|
| `APP_KEY` | Enkripsi sesi & cookie, NIK, token Google, rahasia TOTP; kunci HMAC kode aktivasi kiosk; turunan rahasia QR bila `ATTENDANCE_QR_SECRET` kosong. | **Hilang = NIK, token Google, dan TOTP Super Admin tidak bisa didekripsi.** Simpan di password manager di luar server. Rotasi: kunci lama ke `APP_PREVIOUS_KEYS`, lalu buat ulang tautan/kode kiosk yang belum dipakai. |
| `ATTENDANCE_QR_SECRET` | Tanda tangan QR dinamis kiosk. **Wajib diisi di produksi** agar rotasi `APP_KEY` tidak memengaruhi QR. | Bocor = QR bisa dipalsukan; ganti nilainya (QR lama hanya hidup ±60 detik). |
| `DB_PASSWORD`, `REDIS_PASSWORD`, `REVERB_APP_SECRET` | Layanan internal compose. | Ganti di `.env` server lalu `docker compose -f compose.prod.yml up -d --force-recreate`. |
| `AWS_*` (bucket privat), `BACKUP_S3_*` (bucket backup) | Selfie, lampiran, dump database, dan repositori PITR (pgBackRest). Access key **terpisah** per bucket. | Bocor = data pribadi/backup terbuka; cabut key di penyedia storage. |
| `PITR_CIPHER_PASS` | Enkripsi AES-256 repositori pgBackRest (WAL + base backup, `docs/deploy/PITR.md`). | **Hilang = backup PITR tidak bisa dibaca** (dump harian tetap bisa). Simpan di password manager bersama `APP_KEY`. Tidak bisa dirotasi tanpa repositori baru. |
| `GOOGLE_CLIENT_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_PICKER_API_KEY` | Login Google, Drive (domain-wide delegation), Picker. | Service account bocor = akses Drive perusahaan; cabut key di Google Cloud. |
| `EMPLOYEE_DEFAULT_PASSWORD` | Kata sandi bawaan akun karyawan baru (wajib ganti saat login pertama; tidak pernah untuk akun Super Admin/Direksi/HR — R-06). Kosong = fitur mati. | Bocor = siapa pun bisa masuk ke akun yang belum mengganti sandi bawaan: ganti nilainya (akun lama tetap memakai hash lama), cari yang masih wajib ganti (`users.password_change_required`) dan reset bila perlu. Jangan kirim lewat grup obrolan/email massal. |
| Akun Super Admin (sandi + TOTP) | Satu-satunya login non-Google. | Buat cadangan kode pemulihan TOTP; `php artisan ruangkerja:create-super-admin` untuk instalasi baru. |

Aturan umum: `.env` tidak pernah di-commit; nilai acak dibuat dengan `openssl rand -hex 24`; setelah mengubah `.env` di server kontainer harus di-recreate (config di-cache saat start).

## 4. Backup & pemulihan

- Kontainer `backup`: `pg_dump` harian **02.00 WIB** → verifikasi `pg_restore --list` → unggah ke bucket backup (rclone) → simpan remote 30 hari, lokal 7 hari. Isi `BACKUP_HEARTBEAT_URL` agar kegagalan terdeteksi.
- **Uji pemulihan bulanan wajib** (PRD §8): `restore.sh --latest --target ruangkerja_restore_test --create --compare ruangkerja --drop-after`, catat hasilnya di log operasional.
- Kontainer `pitr` (pgBackRest, `docs/deploy/PITR.md`): WAL dikirim ke bucket backup tiap ≤ 60 detik + full Minggu / diff harian → database bisa dipulihkan ke detik mana pun dalam ±4 minggu (kehilangan data terburuk ±1 menit). `wal-check` tiap 10 menit; kontainer unhealthy (dan deploy berhenti) bila pengarsipan/backup bermasalah. Isi `PITR_HEARTBEAT_URL`.
- Selfie & lampiran ada di bucket privat (bukan di dump/PITR) — pastikan bucket punya versioning/lifecycle sesuai kebijakan.
- `APP_KEY` harus ikut dicadangkan (terpisah dari dump): dump tanpa kunci yang sama tidak bisa membaca kolom terenkripsi.
- Langkah lengkap: `README.md` › Backup & pemulihan.

## 5. Checklist go-live

Diturunkan dari `docs/HANDOFF.md` (keputusan yang menunggu pemilik) dan `README.md` (deploy). Centang semua sebelum karyawan memakai aplikasi.

- [ ] **Repo GitHub private** sebelum push pertama (`gh repo edit … --visibility private`), lalu `git push -u origin main`.
- [ ] Secret GitHub Actions & environment `production` dengan approval terisi; image GHCR berhasil dibangun oleh CI hijau.
- [ ] Server VPS siap (Docker, firewall hanya SSH, 80, 443 (tcp+udp)), domain/DNS mengarah ke server, Caddy mendapat sertifikat TLS (`ACME_EMAIL`).
- [ ] Dua bucket S3-compatible: `ruangkerja-private` (selfie/lampiran) dan `ruangkerja-backup`, masing-masing access key sendiri.
- [ ] `.env` produksi dari `.env.production.example`: `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL` https, **`APP_KEY` dibuat dan dicadangkan**, **`ATTENDANCE_QR_SECRET` diisi**, `SESSION_SECURE_COOKIE=true`, `TRUSTED_PROXIES` sesuai jaringan Caddy, `DEMO_LOGIN_ENABLED` tidak aktif, SMTP, sandi DB/Redis/Reverb acak.
- [ ] **Kredensial Google Cloud**: OAuth client (login), service account + domain-wide delegation, Shared Drive, Picker API key; lalu `php artisan ruangkerja:google-check --write` (langkah: `sprints/sprint-1/LOGIN-SUMMARY.md` §7, `sprints/sprint-7/GOOGLE-API.md`).
- [ ] Deploy pertama + migrasi; buat Super Admin (`ruangkerja:create-super-admin`) dan aktifkan TOTP; simpan kode pemulihan.
- [ ] Verifikasi: `GET /health` → `ok`, `/horizon` (Super Admin) memproses antrean, scheduler jalan (close-day 00.30, backup 02.00), Reverb tersambung lewat wss.
- [ ] **Uji restore pertama** dari backup dan catat hasilnya; heartbeat backup aktif.
- [ ] PITR aktif: `PITR_ENABLED=true`, `PITR_CIPHER_PASS` dicadangkan, `docker compose exec pitr wal-check --deep` → `ok`, `PITR_HEARTBEAT_URL` terisi (`docs/deploy/PITR.md` §3).
- [ ] Data master: perusahaan + domain Google, divisi/tim/jabatan, impor karyawan, lokasi kantor & radius, shift + penugasan, hari libur, jenis pengajuan, kuota & saldo, alur persetujuan.
- [ ] Kebijakan privasi diisi (`resources/markdown/privacy-policy.md`, `PRIVACY_POLICY_VERSION`/`DATE`/`CONTACT`), retensi selfie disepakati.
- [ ] Kiosk: buat kiosk per lokasi, pasangkan perangkat lobi dengan tautan atau kode aktivasi; uji pindai QR dengan kamera ponsel sungguhan (belum pernah dicoba di perangkat fisik).
- [ ] Branding resmi: `--brand-*` di `resources/css/tokens.css`, `config/branding.php`, `php scripts/generate-icons.php`.
- [ ] Opsional tapi disarankan: `SENTRY_LARAVEL_DSN`, uptime monitor ke `/health`, `CSP_REPORT_URI`.
- [ ] Uji coba terbatas (pilot satu divisi) sebelum seluruh perusahaan; pastikan HR tahu cara koreksi absensi dan memutus pengajuan.

## 6. Bila ragu

- Perubahan yang menyentuh tabel di atas: tambah/ubah test regresi dulu (`tests/Feature/...`), jalankan `composer test`, `composer lint` (Larastan level 8), `npm run typecheck`, `npm run lint`, `npm test`.
- Perubahan skema: perbarui `docs/DATABASE.md` di commit yang sama dan pastikan migrasi bisa di-rollback.
- Temuan keamanan baru: catat di `docs/security/ASVS-L1.md` dan changelog.
