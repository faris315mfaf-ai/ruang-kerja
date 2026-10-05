# OWASP ASVS 4.0.3 Level 1 — tinjauan RuangKerja

Tinjauan: 2026-10-05, cabang `feat/sprint-10-ops` (Sprint 0 + inti Sprint 1 + pengerasan Sprint 10 bagian A). Modul domain yang sedang dibangun paralel (absensi, pengajuan, workspace, notifikasi, Google, login Google) **belum** termasuk; butir yang bergantung pada modul itu ditandai *Menunggu* dan wajib ditinjau ulang setelah integrasi (Sprint 10 bagian B).

Status: **OK** = terpenuhi · **Diperbaiki** = ditemukan & diperbaiki di sprint ini · **Terbuka** = belum, ada rekomendasi · **Menunggu** = bergantung modul lain · **N/A** = tidak berlaku.

## Ringkasan temuan

| # | Tingkat | Temuan | Status |
|---|---|---|---|
| F1 | **Tinggi** | `routes/channels.php`: otorisasi channel `App.Models.User.{id}` memakai `(int) $user->id === (int) $id`. ULID di-cast ke int menjadi `1` untuk hampir semua ID, sehingga **setiap user bisa berlangganan notifikasi privat user lain**. | **Diperbaiki** (perbandingan string + `BroadcastChannelTest`) |
| F2 | Sedang | Tidak ada header keamanan/CSP dari aplikasi; hanya direncanakan di Caddy. | **Diperbaiki** (`SecurityHeaders` global, CSP nonce) |
| F3 | Sedang | Limiter `login` 5/menit per email+IP saja (ARCHITECTURE §5 minta 10/menit/IP); `check-in` & `api` belum ada. | **Diperbaiki** (`AppServiceProvider`) |
| F4 | Sedang | Cookie sesi tidak dipaksa `Secure` di produksi (bergantung `SESSION_SECURE_COOKIE`). | **Diperbaiki** (bawaan `true` saat `APP_ENV=production`) |
| F5 | Sedang | Reverb `allowed_origins = ['*']`: situs lain bisa membuka WebSocket (channel privat tetap butuh auth). | **Diperbaiki** (`REVERB_ALLOWED_ORIGINS`, diuji: origin asing ditolak 4009) |
| F6 | Sedang | Gate Horizon kosong (hanya email terdaftar), Pulse hanya `local`. | **Diperbaiki** (super_admin saja, test matriks peran) |
| F7 | Sedang | Redis tanpa sandi di rancangan produksi. | **Diperbaiki** (`--requirepass` wajib di `compose.prod.yml`) |
| F8 | Rendah | Lupa sandi membedakan "email tidak ditemukan" (enumerasi akun). Login sandi hanya untuk Super Admin (lainnya Google), dan dibatasi 60 dtk/email. | Terbuka — ganti `passwords.user` menjadi pesan netral dan kembalikan status sukses yang sama |
| F9 | Rendah | `style-src 'unsafe-inline'` (dibutuhkan Radix/sonner/progress Inertia). `script-src` tetap ketat (nonce). | Diterima |
| F10 | Rendah | `/horizon` & `/pulse` memakai CSP longgar (`unsafe-inline`/`unsafe-eval`) karena front-end bawaan paket. | Diterima (hanya super_admin) |
| F11 | Rendah | `/health` menampilkan `version` (SHA git). Tidak ada rahasia/host. | Diterima |
| F12 | — | 2FA wajib untuk Super Admin, login Google domain terbatas. | Menunggu (`feat/sprint-1-login`) |
| F13 | — | Upload selfie/lampiran: validasi MIME/ukuran, disk privat, URL bertanda tangan 5 menit, audit akses selfie. | Menunggu (Sprint 2/4, tinjau di bagian B) |

Tidak ada temuan tingkat tinggi yang terbuka untuk kode yang sudah ada di cabang ini.

## V1 Arsitektur
| Butir | Status | Catatan |
|---|---|---|
| 1.1.4 Batas kepercayaan terdokumentasi | OK | `docs/ARCHITECTURE.md` §1, §4–6. Postgres/Redis/app tidak dipublikasikan; hanya Caddy 80/443. |
| 1.4 Kontrol akses terpusat | OK | Policy auto-discovered + scope `visibleTo`, `Gate::authorize` di controller. |
| 1.14.1 Pemisahan komponen | OK | Kontainer app/queue/scheduler/reverb/postgres/redis/backup terpisah, user non-root di image app. |

## V2 Autentikasi
| Butir | Status | Catatan |
|---|---|---|
| 2.1.1 Sandi ≥ 12 karakter | OK | `Password::defaults()` produksi: min 12, huruf besar/kecil, angka, simbol, `uncompromised()`. |
| 2.1.7 Cek sandi bocor | OK | `uncompromised()` (HIBP k-anonymity) di produksi. |
| 2.2.1 Anti brute force | OK | `throttle:login` 10/menit/IP + 5/menit/email+IP; `two-factor` 5/menit; demo login memakai `throttle:login`. |
| 2.2.? 2FA admin | Menunggu | Fortify 2FA (TOTP, confirm) & passkeys aktif; kewajiban untuk super_admin di `feat/sprint-1-login`. |
| 2.4.1 Hash sandi | OK | bcrypt, `BCRYPT_ROUNDS=12`. |
| 2.5.? Reset sandi | Terbuka (F8) | Token kedaluwarsa 60 menit, throttle 60 dtk; pesan membedakan email tak dikenal. |
| 2.5.4 Tidak ada akun bawaan | OK | Registrasi publik nonaktif (`RegistrationDisabledTest`); akun demo hanya `APP_ENV=local` + `DEMO_LOGIN_ENABLED=true` (dicek per request); Super Admin pertama dibuat dengan `ruangkerja:create-super-admin`. |

## V3 Sesi
| Butir | Status | Catatan |
|---|---|---|
| 3.2.1 Token baru saat login | OK | Fortify & `DemoLoginController` memanggil `session()->regenerate()`. |
| 3.3.1 Logout membatalkan sesi | OK | `AuthenticationTest::test_users_can_logout`. |
| 3.3.? Timeout | OK | `SESSION_LIFETIME=480` (8 jam kerja). |
| 3.4.1 Cookie `Secure` | Diperbaiki (F4) | `config/session.php` + `SESSION_SECURE_COOKIE=true` di template produksi. |
| 3.4.2 `HttpOnly` | OK | Diuji di `SessionCookieTest`. |
| 3.4.3 `SameSite` | OK | `lax`, diuji. |
| 3.5 Sesi di server | OK | Driver Redis; `user_id` tidak dipercaya dari klien. |

## V4 Kontrol akses
| Butir | Status | Catatan |
|---|---|---|
| 4.1.1 Ditegakkan di server | OK | Policy + test matriks peran (`tests/Feature/Policies`). |
| 4.1.3 Least privilege | OK | Permission matrix di `Role::permissions()`. |
| 4.2.1 IDOR | Diperbaiki (F1) | Channel broadcast; data list lewat `visibleTo`. Modul baru: Menunggu. |
| 4.2.2 CSRF | OK | Middleware `web` Laravel (token + `XSRF-TOKEN`), `SameSite=Lax`. |
| 4.3.1 Antarmuka admin | Diperbaiki (F6) | Horizon & Pulse super_admin saja (`DashboardAccessTest`). |

## V5 Validasi, sanitasi, encoding
| Butir | Status | Catatan |
|---|---|---|
| 5.1.3 Validasi input | OK | FormRequest per endpoint; `#[Fillable]` di model; `Model::shouldBeStrict()` di non-produksi menolak atribut tak terdaftar. |
| 5.2/5.3 Output encoding (XSS) | OK | React meng-escape; satu `dangerouslySetInnerHTML` = SVG QR 2FA buatan server (Fortify). CSP `script-src` nonce sebagai lapisan kedua. |
| 5.3.4 SQL injection | OK | Eloquent/query builder; tidak ada `DB::raw`/`whereRaw` dengan input pengguna (grep 2026-10-05). |
| 5.5 Deserialisasi | OK | Sesi diserialisasi JSON (`serialization => json`). |

## V6 Kriptografi
| Butir | Status | Catatan |
|---|---|---|
| 6.2.1 Algoritme standar | OK | `APP_KEY` AES-256-CBC (Laravel), bcrypt. |
| 6.4.1 Rotasi kunci | OK | `APP_PREVIOUS_KEYS` di template produksi. |
| 6.? Token Google terenkripsi | Menunggu | Cast `encrypted` (Sprint 7). |

## V7 Galat & logging
| Butir | Status | Catatan |
|---|---|---|
| 7.1.1 Tidak me-log rahasia | OK | `AuditLogger` me-mask password/secret/token; `/health` hanya me-log nama kelas exception. |
| 7.1.3 Log kejadian keamanan | OK | `audit_logs` (peran, data sensitif); log JSON ke stderr di kontainer. |
| 7.4.1 Pesan galat generik | OK | `APP_DEBUG=false` dibakar di image produksi; Sentry opsional tanpa PII (`send_default_pii=false`). |

## V8 Perlindungan data
| Butir | Status | Catatan |
|---|---|---|
| 8.1.1 Data sensitif tidak di-cache | OK | Halaman HTML `Cache-Control: no-cache, private`; service worker hanya menyimpan shell & aset (`public/sw.js`). |
| 8.2.1 Header anti-cache data sensitif | OK | `/health` `no-store`. |
| 8.3.? Ekspor/hapus data pribadi | Menunggu | Halaman "Data Saya" = Sprint 10 bagian B. |
| 8.3.4 Backup terenkripsi & off-site | OK | `pg_dump` harian 02.00 WIB ke bucket S3 terpisah, retensi 30 hari, uji pemulihan bulanan (README). Rekomendasi: aktifkan enkripsi sisi server bucket. |

## V9 Komunikasi
| Butir | Status | Catatan |
|---|---|---|
| 9.1.1 TLS untuk semua | OK | Caddy TLS otomatis (Let's Encrypt), HTTP→HTTPS, HSTS 1 tahun, `upgrade-insecure-requests`. |
| 9.2 Koneksi internal | OK | Postgres/Redis di jaringan Docker privat; Redis bersandi. |

## V10 Kode berbahaya
| Butir | Status | Catatan |
|---|---|---|
| 10.3.2 Integritas dependensi | OK | `composer.lock`/`package-lock.json`; `composer audit` & `npm audit --omit=dev` bersih (2026-10-05). |

## V12 Berkas & sumber daya
| Butir | Status | Catatan |
|---|---|---|
| 12.1.1 Batas ukuran unggah | OK | PHP 100 MB, Caddy `max_size 110MB`. |
| 12.4 Lokasi penyimpanan | Menunggu (F13) | Disk privat + URL bertanda tangan (Sprint 2/4). CSP `img-src` sudah mengizinkan origin object storage. |

## V13 API & web service
| Butir | Status | Catatan |
|---|---|---|
| 13.1.? Rate limit API | OK | Limiter `api` 120/menit (dipakai Fase 3). |
| 13.2.? Metode HTTP | OK | Aksi mengubah data via POST/PATCH/DELETE + CSRF. |

## V14 Konfigurasi
| Butir | Status | Catatan |
|---|---|---|
| 14.1.? Build otomatis | OK | Image multi-stage dari CI, tanpa `.env`, tanpa dependensi dev (`composer --no-dev`), kode milik root, proses non-root. |
| 14.3.2 Debug mati | OK | `APP_DEBUG=false` di image; Telescope tidak dipasang. |
| 14.3.3 Header versi | OK | `X-Powered-By` dihapus, `expose_php=Off`, `Server` dihapus di Caddy. |
| 14.4.1–7 Header keamanan | Diperbaiki (F2) | CSP (nonce, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy: camera=(self), geolocation=(self), …`, HSTS (produksi), COOP. `SecurityHeadersTest`. |
| 14.5.? Proxy tepercaya | OK | `TRUSTED_PROXIES` = rentang privat Docker (bukan `*`). |

## Cara meninjau ulang
1. `composer audit && npm audit --omit=dev`
2. `curl -sI https://<domain>/login` → cek header di atas.
3. `rk_test --filter=Platform` (header, limiter, sesi, dashboard, health, channel).
4. Setiap modul baru: pastikan endpoint memakai Policy, data list `visibleTo`, unggahan memvalidasi MIME/ukuran, route check-in memakai `throttle:check-in`.
