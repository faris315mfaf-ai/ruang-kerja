# Sprint 1 — Rencana slice Login (Google + Super Admin darurat)

Branch `feat/sprint-1-login`. Dasar: `feat/sprint-1-core` (lihat `CORE.md`).

## Lingkup
1. Login Google (Socialite) — `/auth/google/redirect`, `/auth/google/callback`.
2. Login email + kata sandi hanya Super Admin (Fortify `authenticateUsing`) + wajib TOTP (middleware `EnsureTwoFactorForSuperAdmin`).
3. Halaman login baru sesuai mockup `Login` / `MLogin` (desktop + mobile, terang/gelap).
4. Pengamanan pengaturan mandiri: email & hapus akun dikunci; profil baca-saja; keamanan hanya Super Admin.
5. `last_login_at` untuk semua metode login (termasuk demo); audit login sukses/gagal Super Admin.

## File
| Area | File |
|---|---|
| Domain | `app/Domain/Auth/Actions/AuthenticateGoogleUser.php`, `AuthenticateSuperAdmin.php`; `Exceptions/GoogleLoginRejected.php`; `Enums/LoginMethod.php`; `Support/GoogleOAuth.php` (cek konfigurasi, domain petunjuk `hd`) |
| HTTP | `Controllers/Auth/GoogleLoginController.php`; `Middleware/EnsureTwoFactorForSuperAdmin.php`; `Middleware/RestrictCredentialRoutes.php` |
| Listener | `app/Listeners/RecordLogin.php` (event `Login`: metode di sesi, `last_login_at`, audit Super Admin), `RecordFailedLogin.php` (event `Failed` & `TwoFactorAuthenticationFailed`) |
| Route | `routes/auth.php` (Google), di-`require` dari `routes/web.php` |
| Config | `config/services.php` (`google`), `config/fortify.php` (passkeys dimatikan) |
| Policy | `UserPolicy::manageCredentials` (hanya diri sendiri + Super Admin) |
| UI | `pages/auth/login.tsx` (tanpa AuthLayout), `features/auth/*` (panel merek, tombol Google, form Super Admin, demo), `pages/settings/profile.tsx` (baca-saja), `pages/settings/security.tsx` (tanpa passkey), `layouts/settings/layout.tsx` |
| Hapus | `ProfileUpdateRequest`, `ProfileDeleteRequest`, `delete-user.tsx`, komponen passkey |
| Test | `tests/Feature/Auth/GoogleLoginTest.php`, `SuperAdminPasswordLoginTest.php`, `EnsureTwoFactorForSuperAdminTest.php`, `LoginAuditTest.php`, update `AuthenticationTest`, `DemoLoginTest`, `TwoFactorChallengeTest`, `Settings/*` |

## Keputusan
- **Passkey dimatikan seluruhnya** (fitur Fortify `passkeys` dihapus): login passkey melewati alur kata sandi + TOTP; Super Admin hanya akun darurat; mengurangi permukaan serangan. Model tetap `PasskeyUser` (tabel tidak dihapus) agar bisa diaktifkan lagi.
- Pesan galat login kata sandi tidak membocorkan keberadaan akun: email/kata sandi salah → pesan umum + petunjuk Google; kata sandi benar tetapi bukan Super Admin → "Gunakan tombol Masuk dengan Google."
- Super Admin lewat Google tidak dipaksa TOTP (Google Workspace punya 2FA sendiri); paksaan TOTP berlaku untuk sesi kata sandi/remember-me.
- Metode login disimpan di sesi (`auth.method`) oleh listener event `Login` berdasarkan nama route.
- Profil: semua data organisasi baca-saja (HR yang mengelola); nama juga dikunci (data master). Route `profile.update` & `profile.destroy` dihapus.
- Halaman keamanan (kata sandi, 2FA) dan route 2FA Fortify hanya untuk Super Admin (403 untuk lainnya).

## Risiko
- Google OAuth tidak menerima domain `.test` → uji manual Google lewat `php artisan serve` + `localhost` (SETUP-LOKAL §6).
- Karyawan yang dibuat HR dengan `email_verified_at` kosong: login Google mengisi `email_verified_at` bila Google menyatakan email terverifikasi (rute aplikasi memakai middleware `verified`).
