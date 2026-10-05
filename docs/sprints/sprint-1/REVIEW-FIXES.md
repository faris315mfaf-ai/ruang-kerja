# Sprint 0–1 — Perbaikan hasil code review

Cabang `fix/sprint-1-review`. Satu commit per temuan (`fix(<area>): ...`), masing-masing dengan test regresi yang **gagal sebelum perbaikan** (diverifikasi dengan menjalankan test baru terhadap kode lama) dan hijau sesudahnya. `main` (termasuk Sprint 2, 4, 5, 10) sudah di-merge ke cabang ini; seluruh pemeriksaan hijau setelah merge.

| # | Tingkat | Commit |
|---|---|---|
| 1 | Medium | `63f6836` fix(auth): remember-me restore never counts as a TOTP-exempt login |
| 2 | Medium | `1b44516` fix(google): read the company domain fresh when connecting Drive |
| 3 | Medium | `c9fd610` fix(organization): only Super Admin grants super_admin/direksi/hr; no self role changes |
| 4 | Medium | `46e87b0` fix(organization): release division heads/team leads on deactivation and moves |
| 5 | Medium | `1fb228c` fix(organization): refuse moving a team with active members to another division |
| 6 | Medium | `f5f3a87` fix(auth): throttle only the Google callback, per IP and per session, behind trusted proxies |
| 7 | Medium | `6779265` fix(organization): never keep uploaded import files (NIK) past their session |
| 8 | Medium | `5a7de9c` fix(auth): password reset links for Super Admins only, generic answer, per-IP throttle |
| 9 | Low | `a24461e` fix(google): only connect the employee's own Google account to Drive |
| 10 | Low | `b324231` fix(organization): re-check manager cycles under a company advisory lock |
| 11 | Low | `f86919c` fix(organization): an unchanged inactive manager no longer blocks edits |
| 12 | Low | `162882c` fix(organization): memoize User::ledDivisionIds() per instance |
| 13 | Low | `791e12c` + `3eb449a` fix(auth): secure session cookie, sign out other devices on password change |
| 14 | Low | `6394dcc` fix(database): one board division per company, unique team codes per division |
| 15 | Low | `14af696` fix(ui): sidebar color tokens without hsl() |

---

## 1. Bypass TOTP Super Admin lewat remember-me

**Temuan.** `LoginMethod::fromRoute()` memeriksa nama route sebelum `$remember`. Pemulihan sesi dari cookie remember-me terjadi di middleware `guest` pada `GET /auth/google/callback`, sehingga tercatat sebagai `google` (bebas TOTP) — Super Admin tanpa TOTP lolos dari `EnsureTwoFactorForSuperAdmin`.

**Perbaikan.** `fromRoute()` dihapus. Setiap controller/action login kini **mendeklarasikan** metodenya tepat sebelum `Auth::login()` (`LoginMethod::declareFor($request)`): `GoogleLoginController` → `google`, `DemoLoginController` → `demo`, `AuthenticateSuperAdmin` → `password`. `RecordLogin` memakai `LoginMethod::resolve($declared, $viaRemember)`: pemulihan remember-me (`SessionGuard::viaRemember()`) **selalu** `remember` (ketat), login tanpa deklarasi dianggap `password` (ketat). Hanya deklarasi eksplisit yang bisa menghasilkan metode bebas TOTP.

**Test.**
- `tests/Unit/LoginMethodTest.php` — dataset termasuk `remember-me recall on the google callback` (`Google` + remember → `Remember`) dan rute demo.
- `tests/Feature/Auth/GoogleLoginTest.php` › *records a remember-me restore on the Google callback as "remember", not "google"* — skenario end-to-end: cookie remember-me valid → `GET /auth/google/callback` → sesi `remember` → `/dashboard` dialihkan ke `security.edit`.

## 2. Hubungkan Drive selalu gagal bila `GOOGLE_ALLOWED_DOMAIN` kosong

**Temuan.** `StoreGoogleAccount` membaca `$user->company->google_domain`, padahal `HandleInertiaRequests` memuat relasi `company:id,name` (kolom parsial) ke objek user yang sama → domain `null` → selalu ditolak.

**Perbaikan.** Diperbaiki di sumbernya: `HandleInertiaRequests` tidak lagi mengubah relasi user; perusahaan/divisi/jabatan untuk shell diambil dengan query terpisah. `StoreGoogleAccount` juga membaca `companies.google_domain` langsung dari DB. Audit `->company->google_domain` lain: `EmployeeFormRequest`, `EmployeeImportController`, `EmployeeImportValidator` sudah memakai query baru; `OrganizationTree` hanya membaca `name` (tetap aman).

**Test.** `tests/Feature/Google/GoogleConnectionTest.php`:
- *connects with the company domain when GOOGLE_ALLOWED_DOMAIN is empty and the shell preloaded a partial company* (alur HTTP, instance user baru);
- *does not overwrite the signed-in user relations with partial shell data*;
- *reads the company domain fresh even when the user holds a partial company relation* (action langsung).
- `beforeEach` sekarang tidak lagi "tak sengaja" memuat relasi `company` lengkap (yang dulu menutupi bug).

## 3. HR bisa memberi dirinya/siapa pun peran `direksi`/`hr`

**Temuan.** `UserPolicy::assignRole` hanya membatasi `super_admin`.

**Perbaikan.**
- `UserPolicy::assignRole`: ditolak bila aktor = target (tidak ada yang mengubah perannya sendiri, termasuk Super Admin); `super_admin`, `direksi`, `hr` hanya oleh Super Admin (`Role::onlySuperAdminAssigns()`); HR boleh `kepala_divisi` dan `anggota`.
- `EmployeeFormRequest`: pesan ramah per peran yang **diberikan** ("Hanya Super Admin yang dapat memberikan peran Direksi.") dan per peran yang **dicabut** / perubahan peran sendiri ("Anda tidak dapat mengubah peran Anda sendiri."). Peran yang tidak berubah (mis. HR menyimpan data karyawan Direksi) tetap boleh.
- Impor: pesan "Hanya Super Admin yang dapat memberikan atau mencabut peran Super Admin, Direksi, atau HR." / "Anda tidak dapat mengubah peran Anda sendiri."
- UI form karyawan: prop `can.assignSuperAdmin` → `can.assignPrivilegedRoles`; checkbox Super Admin/Direksi/HR terkunci untuk HR, semua peran terkunci saat mengedit diri sendiri (helper `roleLockReason` di `@/lib/roles`).
- `docs/sprints/sprint-1/CORE.md` diperbarui.

**Test.**
- `tests/Feature/Policies/UserPolicyTest.php` › *applies the role assignment matrix* (5 peran aktor × 5 peran) dan *never lets anyone change their own roles*.
- `tests/Feature/Admin/EmployeeManagementTest.php` › *does not let HR grant or revoke direksi or hr* (store, update, cabut), *lets HR grant kepala_divisi*, *does not let anyone change their own roles*.
- `tests/Feature/Admin/EmployeeImportTest.php` › *does not let HR import direksi/hr roles or change their own roles*.
- `tests/Feature/Organization/EmployeeActionsTest.php` › *refuses HR granting direksi/hr or changing own roles inside the actions (defense in depth)*.
- `resources/js/lib/roles.test.ts` (Vitest).

## 4. Kepala divisi / ketua tim basi setelah nonaktif atau pindah

**Temuan.** `DeactivateEmployee`/`UpdateEmployee` tidak menyentuh `divisions.head_user_id`/`teams.lead_user_id`; visibilitas (`User::ledDivisionIds()`) tetap memberi akses lewat data basi.

**Perbaikan.**
- Service baru `LeadershipReleaser` (dalam transaksi pemanggil, `lockForUpdate`): mengosongkan head/lead dan menulis satu baris audit `division.updated`/`team.updated` (`head_user_id`/`lead_user_id` → `null`) dengan aktor eksplisit.
- `DeactivateEmployee`: lepas semua kepemimpinan + hapus koneksi Google (`DisconnectGoogleAccount`, yang kini men-dispatch `RevokeGoogleToken` **setelah commit**).
- `UpdateEmployee` (juga dipakai impor): lepas head divisi lama bila `division_id` berubah, dan lead tim lama bila `team_id` berubah.
- Form divisi/tim: aturan "harus karyawan aktif" hanya berlaku bila kepala/ketua **diganti** (`OrganizationRequest::unlessUnchanged`); pemilih di UI tetap menampilkan kepala/ketua lama yang nonaktif (label "Nonaktif") agar tidak terhapus diam-diam.

**Test.**
- `tests/Feature/Organization/EmployeeActionsTest.php` › describe *leadership clean-up* (4 test: nonaktif + audit + revoke token + `ledDivisionIds`; pindah divisi; pindah tim dalam divisi yang sama; edit tanpa pindah tidak menyentuh apa pun).
- `tests/Feature/Organization/Admin/DivisionManagementTest.php` / `TeamManagementTest.php` › *keeps an already-inactive head/lead on unrelated edits but rejects switching to an inactive …*.
- `resources/js/features/organization/admin/person-options.test.ts`.

## 5. Tim pindah divisi meninggalkan anggota tidak konsisten

**Perbaikan.** `SaveTeam` (di bawah row lock) dan `TeamRequest` menolak perubahan `division_id` selama tim punya anggota aktif: "Tim Gudang masih memiliki 1 anggota aktif. Pindahkan anggota ke tim lain terlebih dahulu sebelum mengganti divisi tim." Kebijakan sama dengan `DeleteTeam` (hanya anggota aktif).

**Test.** `tests/Feature/Organization/Admin/TeamManagementTest.php` › *refuses to move a team with active members to another division* (HTTP, termasuk rename tetap boleh dan pindah boleh setelah tanpa anggota aktif) dan *refuses the division change inside SaveTeam too (defense in depth)*.

## 6. Rate limit login Google terlalu ketat / IP proxy

**Perbaikan.**
- `routes/auth.php`: hanya `callback` yang di-throttle (redirect ke Google tidak).
- Limiter `google-login`: **60/menit per IP** (puluhan karyawan berbagi NAT kantor saat jam masuk — dipilih lebih longgar dari contoh 30) + **10/menit per sesi browser** (kunci IP + ID sesi).
- Proxy tepercaya: `config/trustedproxy.php` (env `TRUSTED_PROXIES`; **tidak diisi** = `127.0.0.1, ::1` + rentang privat; diisi kosong = tidak ada), header X-Forwarded-* diatur di `bootstrap/app.php`. Dibaca saat request, jadi aman untuk `config:cache` (env tidak dibaca langsung di bootstrap). Didokumentasikan di `.env.example` dan `docs/ARCHITECTURE.md` §5. Saat merge `main` (Sprint 10 ops) bentrok di file config ini; versi gabungan mempertahankan default rentang privat, `.env.production.example` tetap mengisi rentang Docker.

**Test.** `tests/Feature/Auth/GoogleLoginTest.php` › *does not rate limit the redirect to Google*, *rate limits the callback to 60 requests per minute per IP*, *rate limits one browser session to 10 callbacks per minute*, *defaults TRUSTED_PROXIES to loopback and private ranges*, *resolves the client IP behind a trusted proxy only*. Test lama "10 per menit per IP" pada redirect diganti dengan sengaja.

## 7. Berkas impor (berisi NIK) tidak pernah dihapus bila tidak di-commit

**Perbaikan.** `EmployeeImportStore`:
- satu impor terbuka per pengguna: unggahan baru menghapus berkas + sesi unggahan sebelumnya yang belum di-commit;
- `update()` tidak lagi memperpanjang TTL (sesi berakhir tepat 60 menit setelah unggah, jadi tidak pernah lebih lama dari berkasnya);
- perintah `employee-imports:prune` (dijadwalkan **tiap jam** di `routes/console.php`) menghapus berkas di `employee-imports/` yang lebih tua dari TTL.

**Test.** `tests/Feature/Admin/EmployeeImportTest.php` › describe *uploaded file retention (contains NIK)*: unggahan ulang menghapus berkas lama, sesi tidak diperpanjang, prune + jadwal `0 * * * *`.

## 8. Reset kata sandi membocorkan email terdaftar + bisa untuk spam

**Perbaikan.**
- Controller reset-link Fortify diganti lewat binding container (`App\Http\Controllers\Auth\PasswordResetLinkController`): setiap permintaan hanya men-dispatch job `SendSuperAdminPasswordResetLink` (terenkripsi di antrean) lalu selalu mengembalikan status generik — isi dan waktu respons sama untuk email apa pun.
- Job mengirim tautan **hanya** ke Super Admin aktif; throttle per pengguna milik broker berlaku diam-diam.
- Throttle per IP: limiter `password-reset` 5/menit.
- `lang/id/passwords.php`: `sent` generik ("Jika email tersebut terdaftar untuk login dengan kata sandi, tautan atur ulang telah kami kirim."); `user` = teks `token` agar form reset tidak membedakan email tak dikenal dari token salah.

**Test.** `tests/Feature/Auth/PasswordResetRestrictionTest.php` (7 test: Super Admin menerima tautan; email tak dikenal / karyawan Google / Super Admin nonaktif → respons identik tanpa kirim dan tanpa token; throttle broker tersembunyi; 5/menit per IP; form reset tidak membocorkan). `PasswordResetTest` bawaan disesuaikan (penggunanya kini Super Admin).

## 9. Akun Drive tidak terikat identitas karyawan

**Perbaikan.** `StoreGoogleAccount::ensureOwnAccount`: email Google harus sama dengan email user (tanpa beda huruf besar/kecil) **atau** Google ID sama dengan `users.google_id` bila sudah tertaut (alamat bisa diganti di Google). Pesan: "Gunakan akun Google Anda sendiri (email)."

**Test.** `tests/Feature/Google/GoogleConnectionTest.php` › *refuses a colleague's Workspace account* dan *accepts the own account case-insensitively or by the linked Google id*. Test `honours GOOGLE_ALLOWED_DOMAIN …` disesuaikan (email user di domain tersebut).

## 10. Race siklus atasan

**Perbaikan.** `ManagerHierarchy::guardChange()` dipanggil di dalam transaksi `UpdateEmployee` dan `CreateEmployee` (impor memakai keduanya): bila `manager_id` berubah, ambil `pg_advisory_xact_lock(hashtextextended('manager-hierarchy:<company_id>', 0))` lalu ulangi `wouldCreateCycle` → `ValidationException` (`manager_id`). Edit tanpa ganti atasan tidak mengambil lock.

**Test.** `tests/Feature/Organization/EmployeeActionsTest.php` › describe *manager cycles under concurrency*: action menolak siklus walau validasi dilewati; lock diambil tepat sekali saat atasan berubah; tidak ada lock untuk edit lain.

## 11. Atasan nonaktif memblokir edit yang tidak terkait

**Perbaikan.** `ValidManager` dan `EmployeeImportValidator` hanya menolak atasan nonaktif bila `manager_id` **berubah**.

**Test.** `ManagerHierarchyTest` › *accepts an unchanged inactive manager but rejects switching to one*; `EmployeeManagementTest` › *saves unrelated edits when the current manager is already inactive*; `EmployeeImportTest` › *does not block rows whose unchanged manager became inactive*.

## 12. Memoisasi `ledDivisionIds()`

**Perbaikan.** Hasil disimpan per instance user, dengan kunci `id|division_id|peran kepala_divisi`; dibuang oleh `refresh()` dan `forgetLedDivisionIds()` (dipanggil `LeadershipReleaser`).

**Test.** `tests/Feature/Organization/UserVisibilityTest.php` › *memoizes the led division ids per user instance* (0 query `divisions` pada panggilan berikutnya) dan *recomputes … when the division changes or after refresh*.

## 13. Cookie sesi aman + keluarkan perangkat lain saat ganti kata sandi

**Perbaikan.**
- `.env.example`: `SESSION_SECURE_COOKIE=true` (wajib di produksi; lokal juga HTTPS lewat Herd). `docs/ARCHITECTURE.md` §5 diperbarui.
- `AuthenticateSession` diaktifkan untuk grup `web`; `SecurityController::update` memanggil `Auth::logoutOtherDevices()` (re-hash tanpa baris audit kedua) → perangkat lain keluar pada request berikutnya, sesi & cookie remember-me perangkat ini tetap.
- Setelah merge `main`, test seeder workspace (`actingAs` beberapa akun demo dalam satu sesi test) ter-logout karena hash kata sandi tersimpan milik akun sebelumnya. Subclass `App\Http\Middleware\AuthenticateSession` mengikat hash ke akun pemiliknya: sesi yang berganti akun mulai dengan hash baru, perangkat lain dari akun yang **sama** tetap dikeluarkan (commit `3eb449a`).

**Test.** `tests/Feature/Settings/SecurityTest.php` › *signs out other devices when the password changes, keeping the current session* dan *does not treat a session that switches accounts as a changed password*.

## 14. Constraint database

**Perbaikan.** Migrasi `2026_10_06_000100_add_organization_unique_constraints` (bisa di-rollback, sudah dicoba `migrate:rollback` → `migrate`):
- `divisions_one_board_per_company_unique (company_id) WHERE is_board AND deleted_at IS NULL`;
- `teams_division_code_unique (division_id, code) WHERE code IS NOT NULL AND deleted_at IS NULL` (sesuai validasi `TeamRequest` yang mengizinkan kode tim terhapus dipakai ulang).
`docs/DATABASE.md` diperbarui.

**Test.** `tests/Feature/Database/OrganizationConstraintsTest.php` (4 test: board kedua ditolak; board baru boleh setelah yang lama dihapus & di perusahaan lain; kode tim duplikat ditolak; kode null / divisi lain / setelah soft delete boleh).

## 15. Token warna sidebar

**Perbaikan.** `components/ui/sidebar.tsx`: `hsl(var(--sidebar-border))`/`hsl(var(--sidebar-accent))` → `var(--sidebar-border)`/`var(--sidebar-accent)` (token berupa warna lengkap, bukan komponen HSL).

**Test.** `resources/js/lib/color-tokens.test.ts` — memindai semua `resources/js/**/*.{ts,tsx}` dan `resources/css/**/*.css`; gagal bila ada `hsl(var(--…))`.

---

## Keputusan

- **Login method eksplisit** alih-alih urutan pengecekan rute: lebih tahan terhadap rute baru (default selalu ketat).
- **Rate limit Google 60/menit/IP** (bukan 30): kantor puluhan karyawan di belakang satu NAT; batas per sesi 10/menit menjaga satu browser tidak menghabiskan kuota bersama.
- **Satu impor terbuka per pengguna**: unggahan baru membatalkan unggahan lama yang belum di-commit (tab lama menampilkan "Sesi impor sudah kedaluwarsa").
- **Reset kata sandi lewat job antrean**: respons identik (isi & waktu) untuk semua email; di lingkungan `QUEUE_CONNECTION=sync` tetap berfungsi.
- **Siklus atasan dalam impor**: bila race terjadi saat commit, batch dibatalkan dan barisnya dilaporkan galat (perilaku batch yang sudah ada).
- Tidak ada paket baru.

## Hasil pemeriksaan (setelah merge `main`)

- Pest: **1320 test hijau** (`php artisan test --parallel --processes=4` pada DB test track ini). Catatan: menjalankan `composer test` tanpa batas proses sempat memicu `out of shared memory` di Postgres bersama (beban mesin, bukan kode); dengan 4 proses hijau.
- `composer lint` (Pint + Larastan level 8): bersih.
- `npm run typecheck`, `npm run lint`: bersih. `npm test` (Vitest): 198 test hijau.
- `php artisan migrate:fresh --seed`: sukses.
