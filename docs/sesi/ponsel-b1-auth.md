# API v1 — Bagian 1 (Fondasi & akun), B1: autentikasi

**Diperbarui:** 13 Okt 2026 · cabang `claude/android-bagian-1`. Backend untuk modul `01-akses-akun` (`docs/mockups/android/spec/01-akses-akun.md`) dan celah `GET /saya` di `13-fondasi-desain.md`. Semua rute di bawah awalan `/api/v1`; rute berada di blok `// --- B1 auth ---` di `routes/api.php`. Galat selalu JSON; pesan Bahasa Indonesia siap tampil.

## Konvensi umum

- **Auth**: "token" = `Authorization: Bearer <token Sanctum perangkat>`; "tamu" = tanpa token.
- **Header klien**: `X-App-Version: 1.2.3` (opsional, lihat Versi & pemeliharaan), `Accept: application/json`.
- **Bentuk galat**: validasi `422 {message, errors:{field:[...]}}`; galat berkode `{code, message}` (kode di tiap endpoint). Batas laju `429 {message, code}`.
- **Objek `device`** (login dan `lupa-sandi/selesai`): `{platform: android|ios|web, device_id_hash: <SHA-256 hex 64>, name?, os_version?, app_version?}`. Satu token aktif per instalasi; login ulang menggantinya.
- **Respons "sesi dibuka"** (login, dua-faktor, lupa-sandi/selesai):
  ```json
  { "token": "1|abc…", "user": { "id","name","email","jabatan","divisi","work_mode":{"value","label"} }, "password_change_required": false }
  ```
  `user` di sini ringkas (tak berubah sejak Tahap 1); profil lengkap lewat `GET /auth/saya`.
- **Tantangan TOTP** (login dan lupa-sandi/selesai untuk akun ber-TOTP, status 200): `{ "two_factor_required": true, "challenge_token": "<64 char>", "expires_in": 300 }` — tidak ada `token`.
- Saldo cuti **tidak pernah** ada di endpoint auth/profil (staf tidak mendapat saldo; keputusan pemilik 6 Okt 2026).

## Alur masuk (ringkas)

```
POST /auth/login ──► token                                   (akun biasa)
                 ├─► two_factor_required + challenge_token ──► POST /auth/dua-faktor ──► token
                 ├─► 403 password_change_required            (tanpa supports_password_change)
                 └─► 403 two_factor_setup_required           (Super Admin tanpa TOTP terkonfirmasi)
POST /auth/lupa-sandi ─► GET …/status (poll 5 dtk) ─► approved + setup_token ─► POST …/selesai ─► token | tantangan TOTP
```

---

## POST /auth/login — tamu · `throttle:api-login` (10/mnt/IP) + limiter `login` Fortify (5/mnt per email+IP)

Request: `{email, password, device{…}, supports_password_change?: bool}`.

`supports_password_change: true` = aplikasi sanggup menjalankan ganti sandi wajib sendiri (`POST /auth/sandi`). Tanpa flag ini perilaku lama tetap (403 `password_change_required`, tanpa token).

| Status | Isi | Arti / tindakan aplikasi |
|---|---|---|
| 200 | respons "sesi dibuka" | simpan token. Bila `password_change_required: true` → tampilkan layar ganti sandi wajib |
| 200 | tantangan TOTP | tampilkan layar kode; kirim ke `/auth/dua-faktor` |
| 403 | `{code: "password_change_required", message}` | hanya tanpa `supports_password_change`; arahkan ke web |
| 403 | `{code: "two_factor_setup_required", message}` | Super Admin tanpa TOTP terkonfirmasi: aktifkan 2FA di web dulu |
| 422 | `errors.email[0]` = pesan generik kredensial salah / akun nonaktif / sandi belum diatur (tak membocorkan akun) | |
| 422 | validasi `device.*` | |
| 429 | `{message: "…dalam N detik."}` (per email+IP) atau `{code: "login_throttled"}` (per IP) | |

Perubahan dari Tahap 1: kode lama `two_factor_required` (403, Super Admin selalu ditolak) **dihapus**. Super Admin kini boleh masuk bila TOTP sudah terkonfirmasi.

## POST /auth/dua-faktor — tamu (kredensialnya `challenge_token`) · `throttle:api-two-factor`

Menyelesaikan masuk akun ber-TOTP. Tantangan: acak 64 karakter, berlaku **5 menit**, sekali pakai, disimpan hanya sebagai hash SHA-256 (cache), terikat pada pengguna + perangkat yang masuk, dan mati setelah **5 kode salah**.

Request: `{challenge_token, code?: "123456", recovery_code?: "xxxx-xxxx"}` — salah satu dari `code` / `recovery_code` wajib.

| Status | Isi |
|---|---|
| 200 | respons "sesi dibuka" |
| 422 | `{code: "challenge_expired", message}` — tantangan tak dikenal/kedaluwarsa/terpakai/habis percobaan/akun nonaktif: **masuk ulang** dari login |
| 422 | `errors.code[0]` = "Kode autentikator atau kode pemulihan salah." — boleh coba lagi (maks. 5 salah) |
| 422 | `errors.code`/`recovery_code` = "Masukkan kode autentikator atau kode pemulihan." |
| 429 | `{code: "two_factor_throttled"}` — 5/mnt per tantangan+IP, 20/mnt per IP |

Kode pemulihan terpakai diganti kode baru (seperti web) dan dicatat di audit (`user.two_factor_recovery_code_used`); kode TOTP yang sama tak bisa dipakai ulang (Fortify). Kegagalan dicatat `user.login_failed` (`reason: two_factor_invalid`).

## GET /auth/saya — token (tetap terjangkau saat "wajib ganti")

```json
{ "user": {
    "id": "01…", "name": "Rizky Aditya", "email": "rizky@kantor.test",
    "jabatan": "Staf Operasional", "divisi": "Operasional",
    "work_mode": {"value": "hybrid", "label": "Hybrid"},

    "roles": ["anggota"],
    "is_staff_only": true,
    "features": {"chat": true, "notes": true, "meetings": true, "okr": false, "automation": false, "role_dashboards": false},
    "position": {"id": "01…", "name": "Staf Operasional"} | null,
    "division": {"id": "01…", "name": "Operasional"} | null,
    "team": {"id": "01…", "name": "Tim Gudang"} | null,
    "manager": {"id": "01…", "name": "Dimas Kepala"} | null,
    "employee_number": "EMP-00042" | null,
    "joined_at": "2025-03-10" | null,
    "led_division_ids": ["01…"],
    "two_factor_enabled": false,
    "password_change_required": false,
    "password_hint": "Bebas, pilih yang mudah Anda ingat."
} }
```

- Bidang lama (`id…work_mode`) tidak berubah. `roles` = nilai `Role` (`super_admin`, `direksi`, `hr`, `kepala_divisi`, `anggota`), terurut abjad. `is_staff_only` = `User::isStaffOnly()` (hanya peran `anggota`): tanpa saldo cuti tahunan dan tanpa struktur organisasi.
- `features` memetakan `config('features.*')` (flag server). Menu Obrolan/Catatan/Rapat dst. disaring dari sini, tidak lagi dari 404. Hiring tidak punya flag (dijaga Policy) sehingga tidak ada di daftar. `prototype` sengaja tidak dikirim.
- `led_division_ids` = divisi yang dipimpin termasuk sub-divisi (`User::ledDivisionIds()`).
- `password_hint` = `PasswordPolicy::hint` (karyawan bebas, bukan sandi bawaan; Super Admin min. 8 dan bukan email) untuk hint di form ganti sandi.
- Tidak ada `can{…}` per-izin: belum dibutuhkan (peran + `is_staff_only` cukup untuk menyaring menu); tambahkan bila modul berikutnya memintanya.

## POST /auth/sandi — token (juga saat "wajib ganti") · `throttle:6,1`

Ganti kata sandi sendiri (`ChangeOwnPassword` + `PasswordPolicy`, sama dengan Pengaturan › Keamanan web). Request: `{current_password, password, password_confirmation}`.

Sukses 200: `{message: "Kata sandi diperbarui. Perangkat lain sudah dikeluarkan.", password_change_required: false, user: <profil lengkap seperti /auth/saya>}`. Efek: `password_change_required` dihapus; **semua token perangkat lain dicabut** (push token-nya dikosongkan), token + push token perangkat ini **tetap**; sesi web ikut keluar; audit `user.password_changed` (tanpa nilai).

Galat 422: `errors.current_password` (salah), `errors.password` (konfirmasi tidak cocok, sama dengan sandi lama "Kata sandi baru harus berbeda dari kata sandi saat ini.", sandi bawaan perusahaan, atau — Super Admin — kurang dari 8 karakter / sama dengan email). 401 tanpa token. 429 `throttled`.

Daftar putih `EnsureApiAccountUsable::ALLOWED_ROUTES` kini: `auth.logout`, `auth.saya`, `auth.password`.

### Ganti sandi wajib di dalam aplikasi
1. Login dengan `supports_password_change: true` → 200 + token + `password_change_required: true`.
2. Selama flag menyala semua endpoint lain menjawab `403 {code: "password_change_required"}`; hanya `/auth/saya`, `/auth/logout`, `/auth/sandi` yang terbuka.
3. `POST /auth/sandi` (`current_password` = sandi sementara) → flag dihapus, token yang sama langsung berfungsi penuh.

Token yang diterbitkan sebelum HR mengatur sandi sementara tetap diblokir 403 yang sama (aplikasi bisa memakai alur di atas atau kembali ke layar masuk).

## Lupa kata sandi (HR menyetujui) — tamu

Memakai Action web yang sama (`RequestPasswordReset`, `CheckPasswordResetStatus`, `CompletePasswordReset`); token permintaan disimpan aplikasi (web memakainya di sesi).

### POST /auth/lupa-sandi · `throttle:api-password-reset` (5/mnt/IP + 5/jam per alamat)
Request: `{email}`. Respons 200 **identik** untuk alamat terdaftar maupun tidak (timebox 400 ms, tanpa baris untuk alamat tak dikenal):
`{request_token, expires_at, message}`. `request_token` berbentuk `acak.waktu.HMAC` (waktu permintaan ikut di dalamnya, ditandatangani agar tak bisa dipalsukan untuk membedakan alamat asli/palsu). Simpan `request_token` + `expires_at` (24 jam) di SecureStore. 422 bila format email salah; 429 `throttled`.

### GET /auth/lupa-sandi/status · `throttle:api-password-reset-status` (30/mnt per token)
Token lewat header `X-Reset-Token` (atau query `?request_token=`). Tanpa token → 422. Token rusak/dipalsukan → `{status:"expired"}`.

| `status` | Tambahan | Aksi |
|---|---|---|
| `pending` | `expires_at` | lanjut polling (~5 dtk, hanya saat aplikasi aktif & layar fokus). Alamat tak dikenal tampil `pending` sampai 24 jam lalu `expired` |
| `approved` | `setup_token`, `setup_expires_at` (30 mnt), `password_hint` | berhenti polling; tampilkan form sandi baru |
| `rejected` | `reject_reason` | final |
| `expired` | — | final (24 jam tanpa keputusan, 30 mnt tanpa sandi baru, sudah dipakai, atau digantikan) |

`setup_token` sekali pakai; bila respons `approved` hilang dan status dipoll lagi, server menerbitkan setup token baru dan yang lama mati — pakai yang terakhir diterima.

### POST /auth/lupa-sandi/selesai · `throttle:api-password-reset-setup` (6/mnt/IP)
Request: `{setup_token, password, password_confirmation, device{…}}`. Kebijakan sandi sama dengan ganti sandi (`PasswordPolicy`).
- 200: respons "sesi dibuka" (semua sesi/token lama pengguna dicabut; audit `user.password_reset_completed`), atau tantangan TOTP untuk akun ber-TOTP (lanjut `/auth/dua-faktor`).
- 403 `two_factor_setup_required`: Super Admin tanpa TOTP (sandi tetap tersimpan).
- 422 `{code: "setup_token_invalid", message, errors:{setup_token}}`: token salah / sudah dipakai / lewat 30 menit → mulai ulang. 422 `errors.password`: kebijakan sandi.

## GET /konfigurasi — tamu · `throttle:60,1`

```json
{ "min_app_version": "1.0.0", "latest_app_version": "1.0.0",
  "maintenance": {"active": false, "message": "RuangKerja sedang dalam pemeliharaan. Coba lagi beberapa saat lagi."},
  "server_time": "2026-10-13T09:00:00+07:00" }
```
Sumber: `config/api_app.php` ← `.env`: `APP_MIN_VERSION`, `APP_LATEST_VERSION` (default `1.0.0`), `APP_MAINTENANCE_API` (default `false`), `APP_MAINTENANCE_MESSAGE`. `message` selalu string (tampilkan hanya bila `active`). Tidak ada `store_url`/`eta` (belum diputuskan pemilik).

## Versi minimal & pemeliharaan (middleware `EnforceApiAppStatus`, semua `/api/v1/*` kecuali `/konfigurasi`)

- `APP_MAINTENANCE_API=true` → **503** `{code: "maintenance", message}` (+ `Retry-After: 300`) di semua rute lain, termasuk login.
- Header `X-App-Version` < `APP_MIN_VERSION` (perbandingan `version_compare`) → **426** `{code: "update_required", message, min_app_version}`. Header tak ada atau bukan format versi → tidak diblokir. Rute `/api/*` non-v1 (webhook) tidak tersentuh.
- Aplikasi sebaiknya membaca `/konfigurasi` saat dibuka dan mengirim `X-App-Version` di setiap panggilan; pada 426/503 tampilkan layar penuh blok dengan `message`.

## Kode galat berkode (ringkasan)

| Kode | Status | Dari |
|---|---|---|
| `password_change_required` | 403 | login (tanpa flag), semua rute bertoken selama flag menyala |
| `two_factor_setup_required` | 403 | login / lupa-sandi/selesai / semua rute bertoken (Super Admin tanpa TOTP) |
| `challenge_expired` | 422 | dua-faktor |
| `setup_token_invalid` | 422 | lupa-sandi/selesai |
| `login_throttled` / `two_factor_throttled` / `throttled` | 429 | limiter |
| `maintenance` | 503 | middleware |
| `update_required` | 426 | middleware |

## Catatan implementasi

- Kode: `app/Domain/Auth/Actions/{ApiSignIn,VerifyApiTwoFactor}`, `Services/{ApiTwoFactorChallenge,ApiPasswordResetToken}`, `app/Http/Controllers/Api/Auth/{AuthController,TwoFactorController,PasswordController,PasswordResetController}`, `app/Http/Controllers/Api/Config/AppConfigController`, `app/Http/Presenters/ApiUserPresenter`, `app/Http/Middleware/{EnforceApiAppStatus,EnsureApiAccountUsable}`, limiter di `FortifyServiceProvider`.
- `ChangeOwnPassword::handle(…, ?Device $keepDevice)` dan `SessionTerminator::revokeApiTokens(…, ?Device $except)` menerima perangkat yang dipertahankan; panggilan web (tanpa argumen) tetap mencabut semua token.
- Tantangan TOTP disimpan di cache (`CACHE_STORE`; Redis di produksi), tanpa tabel/migrasi baru.
- Tes: `tests/Feature/Api/AuthFlowApiTest.php` (baru) dan `AuthApiTest.php` (diperbarui untuk keputusan pemilik 13 Okt 2026: Super Admin boleh dengan TOTP).
