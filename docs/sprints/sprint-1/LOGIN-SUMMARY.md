# Sprint 1 — Ringkasan slice Login (Google Workspace + Super Admin darurat)

> Branch `feat/sprint-1-login` (dasar: `feat/sprint-1-core`). Rencana: `LOGIN-PLAN.md`. Data organisasi: `CORE.md`.

## 1. Kriteria penerimaan

| # | Kriteria | Status | Bukti |
|---|---|---|---|
| 1 | Login Google via Socialite (`/auth/google/redirect`, `/auth/google/callback`) | ✓ | `GoogleLoginController`, `routes/auth.php` |
| 2 | Tolak bila domain ≠ `companies.google_domain` — klaim `hd` **dan** akhiran email dicek di server | ✓ | `AuthenticateGoogleUser`; test domain salah, `hd` lain, `hd` hilang, akhiran mirip (`evilkantor.test`) |
| 3 | Tolak email yang belum didaftarkan HR ("Akun Anda belum didaftarkan HR. Hubungi HR untuk mengaktifkan akses.") | ✓ | test `rejects an email not registered by HR` |
| 4 | Tolak karyawan nonaktif/mengundurkan diri **sebelum** login | ✓ | Google & kata sandi; test `inactive`/`resigned` |
| 5 | Simpan `google_id` (cocokkan `google_id` dulu, lalu email), `avatar_url`, `last_login_at`; sesi diregenerasi | ✓ | test `links the Google identity`, `matches by google_id first`, `regenerates the session` |
| 6 | Rate limit Google 10/menit/IP | ✓ | limiter `google-login`; test 11× → 429 |
| 7 | Google belum dikonfigurasi → tombol nonaktif ramah ("Login Google belum dikonfigurasi") | ✓ | prop `google.enabled`; redirect/callback mengembalikan galat yang sama |
| 8 | Email + kata sandi hanya Super Admin (lainnya: "Gunakan tombol Masuk dengan Google.") | ✓ | `AuthenticateSuperAdmin` (Fortify `authenticateUsing`); test per peran |
| 9 | Super Admin wajib TOTP; tanpa 2FA terkonfirmasi dipaksa ke halaman setup 2FA | ✓ | `EnsureTwoFactorForSuperAdmin`; test redirect, JSON 403, rute yang diizinkan |
| 10 | Login demo lokal tetap jalan (bypass hanya `APP_ENV=local` + `DEMO_LOGIN_ENABLED`) | ✓ | test demo + Super Admin demo tidak dipaksa 2FA; di production dipaksa |
| 11 | Passkey: hanya Super Admin **atau** dimatikan | ✓ dimatikan | lihat Keputusan 1 |
| 12 | Halaman login baru sesuai mockup `Login`/`MLogin`, desktop + mobile, terang/gelap, Indonesia | ✓ | dicek di browser 1440×900 & 375×812, terang & gelap |
| 13 | Pengaturan mandiri dikunci: tidak bisa ubah email / hapus akun; profil baca-saja + tema; kata sandi hanya Super Admin | ✓ | route `profile.update`/`profile.destroy` dihapus (405); `SecurityTest`, `ProfileTest` |
| 14 | `last_login_at` juga pada login demo; audit login sukses/gagal Super Admin | ✓ | listener `RecordLogin`, `RecordFailedTwoFactor`; `PasswordLoginTest`, `DemoLoginTest` |
| 15 | Semua test hijau | ✓ | lihat §6 |

## 2. Alur

**Google** — `GET /auth/google/redirect` (guest, 10/menit/IP) → Google dengan `hd=<domain perusahaan>` + `prompt=select_account` → `GET /auth/google/callback`:
1. `error` di query (dibatalkan) atau state/kode tidak valid → "Login Google gagal atau dibatalkan. Silakan coba lagi."
2. `AuthenticateGoogleUser`: email kosong/beda domain → `wrong_domain`; tanpa `hd` (akun Gmail pribadi) → `missing_hd`; `email_verified` palsu → `unverified_email`; tidak ada user (cari `google_id`, lalu `lower(email)` dalam company yang sama) → `not_registered`; status bukan `active` → `inactive`.
3. Sukses: isi `google_id` (relink bila akun Workspace dibuat ulang dengan alamat yang sama), `avatar_url`, `email_verified_at` (bila kosong — rute aplikasi memakai middleware `verified`) → `Auth::login` → regenerasi sesi → `/dashboard` (atau URL tujuan).
4. Galat kembali ke `/login` di kunci `google`; alamat yang ditolak di-flash sebagai `google_email` untuk kartu "Akun budi@gmail.com tidak bisa masuk. …".

**Super Admin darurat** — form yang bisa dibuka "Masuk darurat (Super Admin, wajib 2FA)" → `POST /login` (Fortify):
1. `AuthenticateSuperAdmin` (Timebox 200 ms): email/kata sandi salah, email tidak dikenal, atau akun tanpa kata sandi → pesan umum yang sama; kata sandi benar tetapi nonaktif → pesan nonaktif; kata sandi benar tetapi bukan Super Admin → "Gunakan tombol Masuk dengan Google."
2. TOTP terkonfirmasi → tantangan 2FA Fortify. Belum → masuk, lalu `EnsureTwoFactorForSuperAdmin` mengarahkan setiap halaman ke **Pengaturan › Keamanan** (banner + toast) sampai 2FA dikonfirmasi. Konfirmasi kata sandi tidak diminta ulang (listener menandai `password_confirmed_at` saat login kata sandi).
3. Rate limit: 5/menit per email+IP dan 10/menit per IP.

**Metode login di sesi** — listener `RecordLogin` (event `Login`) menyimpan `auth.method` (`google`, `password`, `demo`, `remember`) dari nama route, mengisi `last_login_at` untuk semua metode, dan menulis audit `user.logged_in` `{method}` untuk Super Admin.

## 3. Audit log

| Aksi | Kapan | Pelaku | Subjek | `new_values` |
|---|---|---|---|---|
| `user.logged_in` | Super Admin berhasil masuk (Google/kata sandi+2FA/demo/remember) | Super Admin | user | `{method}` |
| `user.login_failed` | Super Admin: kata sandi salah, akun nonaktif, kode 2FA salah | — (tamu) | user | `{method: "password", reason: invalid_credentials \| inactive \| two_factor_invalid}` |
| `user.updated` | Tautan `google_id` pertama kali / relink (otomatis, trait `Auditable`) | — | user | `{google_id}` |

Percobaan login peran lain tidak diaudit (hanya Super Admin, sesuai tugas). Kata sandi tidak pernah dicatat.

## 4. Keputusan

1. **Passkey dimatikan seluruhnya** (`Features::passkeys` dihapus dari `config/fortify.php`, komponen passkey & route `.well-known/passkey-endpoints` dihapus). Alasan: login passkey melewati pintu kata sandi + TOTP; Super Admin hanya akun darurat; lebih sedikit permukaan serangan. Tabel `passkeys` dan kontrak `PasskeyUser` di model dibiarkan agar mudah diaktifkan lagi. Paket npm `@laravel/passkeys` kini tidak dipakai (dibiarkan agar `package-lock` tidak bentrok antar-branch; boleh dihapus saat integrasi).
2. **Pesan login tidak membocorkan akun**: email/kata sandi salah, email tidak dikenal, dan akun tanpa kata sandi mendapat pesan yang sama ("Email atau kata sandi salah. Karyawan masuk dengan tombol Masuk dengan Google."). "Gunakan tombol Masuk dengan Google." hanya muncul bila kata sandinya benar. Pemeriksaan nonaktif juga setelah kata sandi benar.
3. **Super Admin lewat Google tidak dipaksa TOTP** (Google Workspace menerapkan kebijakan 2FA-nya sendiri; akun Google-only tidak punya kata sandi untuk konfirmasi). Paksaan berlaku untuk sesi `password` dan `remember`. Sesi tanpa metode tercatat (hanya terjadi pada `actingAs()` di test — semua jalur login nyata mencatat metode) tidak dipaksa; route tak dikenal yang memicu `Login` diperlakukan ketat sebagai `password`.
4. **Login demo** melewati aturan Google & TOTP hanya selama `DemoAccounts::enabled()` (dicek per request). Bila flag dimatikan, sesi demo Super Admin ikut dipaksa setup 2FA.
5. **Profil baca-saja**, termasuk **nama** (data master HR). Route `PATCH`/`DELETE settings/profile` dihapus (bukan dibatasi ke Super Admin): karyawan tidak pernah dihapus (`UserPolicy::delete` = false, nonaktifkan lewat HR). `ProfileUpdateRequest`, `ProfileDeleteRequest`, trait `ProfileValidationRules` (tak terpakai → Larastan menolak) dan komponen `delete-user` dihapus.
6. **Keamanan hanya Super Admin**: ability baru `UserPolicy::manageCredentials` (diri sendiri + Super Admin). Middleware `RestrictCredentialRoutes` (grup `web`) memberi 403 untuk `security.edit`, `user-password.update`, `password.confirm*`, dan seluruh route 2FA Fortify bagi peran lain; controller juga memanggil `Gate::authorize`. Menu "Keamanan" di pengaturan hanya tampil untuk Super Admin; halaman Profil menautkannya untuk Super Admin.
7. **Lupa kata sandi** tetap aktif (pemulihan Super Admin). *(Diperbarui di REVIEW-FIXES #8)* Tautan hanya dikirim ke Super Admin aktif (job antrean `SendSuperAdminPasswordResetLink`); setiap permintaan mendapat pesan generik yang sama dan dibatasi 5/menit per IP, sehingga email terdaftar tidak terungkap.
8. Halaman login dirender **tanpa** `AuthLayout` (`app.tsx`: `auth/login` → layout kosong) karena tata letaknya split penuh. Nama perusahaan diambil dari tabel `companies` (prop `companyName`), bukan `branding.companyName` yang untuk tamu masih placeholder.
9. Domain logika baru di `app/Domain/Auth` (`Actions`, `Data`, `Enums`, `Exceptions`, `Support`); listener di `app/Listeners` (auto-discovery Laravel).
10. Tombol berlabel "Masuk dengan Google" (teks mockup); subjudul menyebut domain Workspace (`@domain`). Ikon "G" netral (logo Google berwarna memerlukan hex).

Tidak ada perubahan skema (kolom `google_id`, `avatar_url`, `last_login_at` sudah dari CORE). Tidak ada paket baru (Socialite sudah terpasang).

## 5. Uji manual

Lingkungan: https://ruangkerja.test (setelah merge) atau `php artisan serve`.

1. **Login demo** (`APP_ENV=local`, `DEMO_LOGIN_ENABLED=true`): buka `/login`, klik salah satu akun di "Masuk cepat (demo lokal)". `users.last_login_at` terisi.
2. **Google belum dikonfigurasi** (`GOOGLE_CLIENT_ID` kosong): tombol "Masuk dengan Google" nonaktif + teks "Login Google belum dikonfigurasi. Hubungi Super Admin."
3. **Super Admin darurat**: klik "Masuk darurat (Super Admin, wajib 2FA)", masuk `admin@demo.test` / `password` → diarahkan ke Pengaturan › Keamanan dengan banner "Wajib aktifkan autentikasi dua faktor". Coba buka `/dashboard` → kembali ke Keamanan. Aktifkan 2FA (pindai QR dengan Google Authenticator/1Password), konfirmasi kode → bebas. Logout, login lagi → diminta kode TOTP.
4. **Peran lain via kata sandi**: `hr@demo.test` / `password` di form darurat → "Gunakan tombol Masuk dengan Google."
5. **Profil**: login sebagai `anggota@demo.test` → Pengaturan › Profil menampilkan nama, email, divisi Operasional, jabatan Staf Operasional, atasan Dimas Pratama, tanpa tombol simpan/hapus akun; menu Keamanan tidak ada; `/settings/security` → 403.
6. **Mobile**: lebar 375 px → header merek besar di atas, tombol Google 48 px, tautan "Masuk darurat (Super Admin)", catatan privasi di bawah.
7. **Google sungguhan**: lihat §7.

## 6. Hasil pemeriksaan

- `rk_test`: **299 test hijau** (sebelum slice: 217). Test baru: `GoogleLoginTest` (23), `AuthenticateGoogleUserTest` (10), `PasswordLoginTest` (21), `EnsureTwoFactorForSuperAdminTest` (15), `SecurityTest` (10), `ProfileTest` (5), `TwoFactorChallengeTest`, `PasswordConfirmationTest`, tambahan `DemoLoginTest` (2) & `UserPolicyTest` (5), `tests/Unit/LoginMethodTest`.
- Test starter yang diganti dengan sengaja: `AuthenticationTest` (login kata sandi semua user → `PasswordLoginTest` khusus Super Admin), `ProfileUpdateTest` (ubah profil/hapus akun → `ProfileTest` baca-saja), `SecurityTest`/`TwoFactorChallengeTest`/`PasswordConfirmationTest` (kini memakai Super Admin; peran lain 403; tanpa passkey).
- `composer lint` (Pint + Larastan level 8) bersih · `npm run typecheck` bersih · `npm run lint` bersih · `npm test` 38 hijau.

## 7. Langkah pemilik: Google Cloud OAuth

1. Buka https://console.cloud.google.com → pilih/buat proyek (mis. "RuangKerja") **di organisasi Google Workspace perusahaan**.
2. **APIs & Services › OAuth consent screen** (Google Auth Platform › Branding/Audience):
   - User type: **Internal** (hanya akun Workspace perusahaan yang bisa login — lapisan tambahan di samping cek `hd` server).
   - Nama aplikasi "RuangKerja", email dukungan, logo (opsional), domain aplikasi (mis. `ruangkerja.<domain>`), email kontak developer.
   - Scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` (non-sensitif, tanpa verifikasi Google).
3. **APIs & Services › Credentials › Create credentials › OAuth client ID**:
   - Application type: **Web application**, nama "RuangKerja Web".
   - Authorized JavaScript origins: `https://<domain-produksi>` (dan `http://localhost:8000` untuk uji lokal).
   - Authorized redirect URIs: `https://<domain-produksi>/auth/google/callback` dan `http://localhost:8000/auth/google/callback`. Domain `.test` **tidak** diterima Google (SETUP-LOKAL §6).
4. Salin **Client ID** & **Client secret** ke `.env` server (jangan di-commit):
   ```dotenv
   GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxxxxxx
   GOOGLE_REDIRECT_URI="${APP_URL}/auth/google/callback"
   ```
   lalu `php artisan config:cache` (produksi).
5. Pastikan **`companies.google_domain`** berisi domain Workspace persis (mis. `perusahaan.co.id`, huruf kecil) — ini sumber kebenaran pengecekan domain; `GOOGLE_ALLOWED_DOMAIN` di `.env.example` tidak dipakai untuk login.
6. HR mendaftarkan karyawan (Admin › Karyawan) dengan email kantor yang sama persis; status `active`.
7. Uji lokal: `php artisan serve --port=8000` dengan `APP_URL=http://localhost:8000`, buka `http://localhost:8000/login` → Masuk dengan Google. Kembalikan `APP_URL` sesudahnya.
8. Super Admin darurat: beri satu akun peran `super_admin` dengan kata sandi kuat (HR/Super Admin lain atau `tinker`), login sekali lewat form darurat dan selesaikan setup TOTP; simpan kode pemulihan di brankas.

## 8. Sisa pekerjaan / catatan integrasi

- `CORE.md` §13 (risiko email bisa diubah & login kata sandi belum dibatasi) **selesai** di slice ini.
- Slice lain yang memakai `password.confirm` (`RequirePassword`) untuk non-Super Admin akan mendapat 403 — gunakan konfirmasi lain (mis. dialog) karena karyawan tidak punya kata sandi.
- Test slice lain yang `actingAs(superAdmin)` tetap jalan (sesi tanpa metode tidak dipaksa TOTP).
- Opsional nanti: hapus paket npm `@laravel/passkeys`; pesan galat audit untuk penolakan Google Super Admin.
