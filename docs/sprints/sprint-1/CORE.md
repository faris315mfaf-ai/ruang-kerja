# Sprint 1 — CORE: fondasi data organisasi

> Branch `feat/sprint-1-core`. Baca ini **sebelum** membangun fitur Sprint 1 (login Google, Admin Karyawan, CRUD Divisi/Tim/Jabatan, Struktur Organisasi, Audit Log) atau modul lain yang menyentuh karyawan.
> Skema rinci: `docs/DATABASE.md` §1. Matriks permission: `docs/DATABASE.md` "Peran global".

## 1. Peta file

| Area | File |
|---|---|
| Migrasi | `database/migrations/2026_10_05_000100…000700_*` (companies, divisions, teams, positions, kolom organisasi users, employee_profiles, audit_logs) |
| Model (konvensi: `app/Models`) | `Company`, `Division`, `Team`, `Position`, `EmployeeProfile`, `AuditLog`, `User` |
| Trait | `App\Models\Concerns\Auditable` |
| Enum | `App\Domain\Organization\Enums\{Role, Permission, WorkMode, UserStatus, Theme}` |
| Service | `App\Domain\Organization\Services\{AuditLogger, ManagerHierarchy}` |
| Action | `App\Domain\Organization\Actions\SyncUserRoles` (+ `UpdateUserTheme`) |
| Rule | `App\Domain\Organization\Rules\ValidManager` |
| Middleware | `App\Http\Middleware\EnsureActiveEmployee` (grup `web`) |
| Policy | `CompanyPolicy`, `DivisionPolicy`, `TeamPolicy`, `PositionPolicy`, `UserPolicy`, `AuditLogPolicy` |
| Seeder | `RoleSeeder` (peran + permission), `DemoUserSeeder` (5 akun demo), `OrganizationSeeder` (struktur demo) |
| Demo | `App\Domain\Organization\Demo\{DemoAccounts, DemoCompany}` |

## 2. Model & relasi

```
Company 1─* Division (parent/children, head → User, is_board)
Company 1─* Position (level 1 Direksi … 5 Staf)
Division 1─* Team (lead → User, code opsional)
User *─1 Company / Division? / Team? / Position? / manager (User?)
User 1─* directReports, 1─1 profile (EmployeeProfile), 1─* ledDivisions, 1─* ledTeams
```

| Model | Relasi | Catatan |
|---|---|---|
| `User` | `company`, `division`, `team`, `position`, `manager`, `directReports`, `profile`, `ledDivisions`, `ledTeams`, `roles` (spatie), `auditLogs` | cast `work_mode` → `WorkMode`, `status` → `UserStatus`, `joined_at` date, `last_login_at`. `password` nullable (hanya Super Admin darurat). `google_id` hidden. |
| `Company` | `divisions`, `positions`, `users` | `google_domain` disimpan huruf kecil; `ownsEmail($email)` cek akhiran domain persis. |
| `Division` | `company`, `parent`, `children`, `teams`, `members`, `head` | `code` otomatis UPPER (mutator + CHECK DB), unik per company **termasuk yang terhapus**. Soft delete. `Division::withDescendantIds([...])`. |
| `Team` | `division`, `lead`, `members` | `code` opsional UPPER. Soft delete. |
| `Position` | `company`, `users` | konstanta `LEVEL_BOARD = 1`, `LEVEL_STAFF = 5`. Soft delete. |
| `EmployeeProfile` | `user` | PK `user_id`. `nik` cast `encrypted` + hidden. Jangan pernah log/kirim NIK ke klien tanpa alasan. |
| `AuditLog` | `user` (pelaku), `auditable` (morph) | append-only (update melempar `LogicException`), tanpa `updated_at`. |

Helper `User`: `isActive()`, `isSuperAdmin()`, `hasPermission(Permission)` (tidak melempar bila permission belum di-seed), `ledDivisionIds()`.

## 3. Scope visibilitas (WAJIB untuk setiap list)

```php
User::query()->visibleTo($viewer)->active()->get();
Division::query()->visibleTo($viewer);   // semua divisi di company viewer
Team::query()->visibleTo($viewer);
Position::query()->visibleTo($viewer);
```

`User::visibleTo($viewer)` (ARCHITECTURE §4), selalu dibatasi `company_id` viewer:
1. Punya `employees.view` (HR, Direksi, Super Admin) → semua karyawan perusahaan.
2. Selain itu: diri sendiri **+** bawahan langsung (`manager_id = viewer`) **+** seluruh anggota divisi yang dipimpin viewer (`divisions.head_user_id = viewer`, atau divisi viewer sendiri bila berperan `kepala_divisi`), termasuk sub-divisi.

Modul lain (absensi, pengajuan, dashboard) sebaiknya meniru pola ini: `whereIn('user_id', User::query()->visibleTo($viewer)->select('id'))`.

## 4. Peran & permission

- Peran: `Role` enum (`super_admin`, `direksi`, `hr`, `kepala_divisi`, `anggota`), bertumpuk.
- Permission: `Permission` enum; matriks di `Role::permissions()` (sumber kebenaran), disinkronkan `RoleSeeder` (idempoten, `syncPermissions`). Tabel matriks ada di `docs/DATABASE.md`.
- Cek di kode: `$user->hasPermission(Permission::EmployeesManage)` atau `$user->hasRole(Role::Hr)`. Jangan hard-code string.
- **Tidak ada `Gate::before` untuk Super Admin** (workspace pribadi & selfie tetap tertutup).
- **Ubah peran HANYA lewat `SyncUserRoles`** (mencatat satu baris audit `user.roles_changed` dengan `{roles: [...]}` sebelum/sesudah). Jangan panggil `assignRole/syncRoles` langsung di kode fitur (seeder/test boleh).
- Menambah permission baru: tambah case di `Permission` (+ `label()`), tambahkan ke `Role::permissions()`, perbarui tabel di DATABASE.md; `RoleSeeder` otomatis menyinkronkan. Test `RolePermissionTest` memeriksa kesesuaian DB ↔ enum.

## 5. Policy (abilities)

| Policy | Ability | Aturan |
|---|---|---|
| `UserPolicy` | `viewAny` | `employees.view` atau Kepala Divisi (peran / `head_user_id`). Anggota: tidak. |
| | `manage` | `employees.manage` (HR, Super Admin) — **pakai ini untuk halaman Admin › Karyawan & impor**: `Gate::authorize('manage', User::class)` |
| | `view` | diri sendiri atau termasuk `visibleTo($actor)` |
| | `create` | `employees.manage` |
| | `update` | `employees.manage`, company sama, target Super Admin hanya oleh Super Admin |
| | `deactivate` | seperti `update` + bukan diri sendiri |
| | `delete` | selalu `false` (nonaktifkan, jangan hapus) |
| | `assignRole` | `Gate::authorize('assignRole', [$target, Role::X])` — seperti `update`; peran `super_admin` hanya oleh Super Admin. Cek untuk **setiap** peran yang ditambah/dicabut. |
| | `updateTheme` | hanya diri sendiri (Sprint 0) |
| `DivisionPolicy` / `TeamPolicy` / `PositionPolicy` | `viewAny`, `view` | semua karyawan company yang sama |
| | `create`, `update`, `delete`, `restore` | `organization.manage` (HR, Super Admin) + company sama |
| | `forceDelete` | `false` |
| `CompanyPolicy` | `view` | company sendiri; `update`/`viewAny` = `settings.manage` (Super Admin); `create`/`delete` = `false` |
| `AuditLogPolicy` | `viewAny`, `view` | `audit.view` (Super Admin); `create/update/delete` = `false` |

## 6. Atasan langsung & siklus

```php
// FormRequest
'manager_id' => ['nullable', 'string', new ValidManager($employeeOrNull, $actor->company_id)],

// Service
app(ManagerHierarchy::class)->wouldCreateCycle($user, $newManager); // bool
app(ManagerHierarchy::class)->chainOf($user); // list<User>, atasan terdekat dulu (untuk approval)
```
`ValidManager` menolak: atasan tidak ada / beda company ("Atasan langsung tidak ditemukan."), atasan nonaktif, diri sendiri, dan siklus A→B→A atau lebih dalam.

## 7. Audit log

Otomatis (trait `Auditable`) untuk `User`, `Company`, `Division`, `Team`, `Position`:
- Aksi `<model>.created|updated|deleted|restored` (mis. `division.updated`, `user.created`).
- `old_values` / `new_values` = nilai mentah DB hanya untuk kolom yang berubah (created: semua kolom di `new_values`; deleted: semua di `old_values`). JSON cast di-decode.
- Disamarkan `***`: cast `encrypted*`/`hashed`, dan kunci sensitif (`password`, `remember_token`, `two_factor_*`, `nik`, `*_token`, `*secret*`, `api_key`), termasuk bersarang.
- Diabaikan: timestamp; untuk `User` juga `remember_token`, `last_login_at`, `theme`, `avatar_url` (update yang hanya menyentuh kolom ini tidak dicatat).
- Mengikuti event model: `saveQuietly()`, `Model::withoutEvents()`, dan `DatabaseSeeder` (WithoutModelEvents) **tidak** menulis audit.

Manual (aksi sensitif modul lain — koreksi absensi, keputusan approval, lihat selfie):
```php
app(AuditLogger::class)->log('selfie.viewed', $attendanceLog);
app(AuditLogger::class)->log('request.approved', $request, ['status' => 'waiting'], ['status' => 'approved']);
// pelaku default = user login (null di console/queue); bisa diisi argumen ke-5 $actor
```
IP & user agent diambil dari request saat itu. Penamaan aksi: `<objek>.<kata_kerja_lampau>` snake_case.

Halaman Audit Log (Super Admin): `Gate::authorize('viewAny', AuditLog::class)`, query `AuditLog::query()->with('user:id,name')->latest('created_at')`; filter `action` (prefix), `user_id`, `auditable_type` (FQCN, mis. `App\Models\Division`), rentang `created_at` (indeks tersedia).

## 8. Middleware karyawan aktif

`EnsureActiveEmployee` terpasang di grup `web` (bootstrap/app.php): user login dengan status `inactive`/`resigned` langsung di-logout, sesi diinvalidasi, redirect ke `login` dengan galat `email` = "Akun Anda tidak aktif. Hubungi HR bila ini keliru." (JSON → 401). Tidak perlu alias di route.

**Untuk agent login Google/Fortify:** tolak juga saat login (sebelum `Auth::login`) bila `! $user->isActive()`; cocokkan domain dengan `$company->ownsEmail($email)` **dan** klaim `hd` = `$company->google_domain`; simpan `google_id`, `avatar_url`, `last_login_at` (dua terakhir tidak diaudit).

## 9. Props Inertia bersama

`auth.user` = atribut user (tanpa relasi lain/hidden) + `avatar` (= `avatar_url`) + `company {id,name}`, `division {id,name,code} | null`, `position {id,name,level} | null`. `branding.companyName` = nama perusahaan user bila login (fallback `config('branding.company_name')`). Tipe TS: `resources/js/types/auth.ts` (`User`, `WorkMode`, `UserStatus`, `UserOrganization`).

Opsi select: `WorkMode::options()`, `UserStatus::options()`, `Role::options()` → `list<{value,label}>` berlabel Indonesia.

## 10. Factory & test

- `User::factory()` otomatis memakai company pertama (Fase 1 satu perusahaan). State: `inactive()`, `resigned()`, `forCompany($c)`, `inDivision($division, $team = null)`, `managedBy($manager)`, `workMode(WorkMode::X)`, `withRole(Role::Hr, ...)`, `unverified()`, `withTwoFactor()`.
- `Division::factory()`: `forCompany()`, `board()`, `headedBy($user)`, `childOf($division)`. `Team::factory()->ledBy($user)`. `Position::factory()->level(2)`. `EmployeeProfile::factory()`. `AuditLog::factory()->by($actor)->forSubject($user)`.
- Test yang memakai permission: `$this->seed(RoleSeeder::class)` di `beforeEach`, lalu `User::factory()->withRole(Role::Hr)->create()`.
- Uji pelanggaran constraint di PostgreSQL: bungkus dengan `DB::transaction(fn () => ...)` (savepoint) agar transaksi RefreshDatabase tidak batal.

## 11. Data demo (`OrganizationSeeder`, idempoten)

Perusahaan: `DemoCompany::name()` (config branding, atau "PT Sistem Pelayanan Kesehatan dan Data" bila masih placeholder), domain `demo.test`. Divisi: DIR (Direksi, is_board), KEU, OPS, PMS, SDM. Tim: Tim Gudang (OPS, GDG, ketua Sari Wulandari), Tim Digital (PMS, DGT, ketua Maya Lestari). 17 jabatan. 22 karyawan (1 nonaktif: Teguh Santoso, 1 mengundurkan diri: Tiara Anjani), semua punya `employee_profiles` (`RK-0001`…).

| Akun demo (sandi `password`) | Nama | Penempatan | Atasan |
|---|---|---|---|
| admin@demo.test | Admin Sistem | tanpa divisi, Administrator Sistem, super_admin | — |
| direksi@demo.test | Hendra Wijaya | Direksi, Direktur Utama, kepala unit Direksi | — |
| hr@demo.test | Hana Pratiwi | SDM, Kepala Divisi SDM (head SDM), peran hr | Hendra |
| kadiv@demo.test | Dimas Pratama | Operasional, Kepala Divisi Operasional (head OPS) | Hendra |
| anggota@demo.test | Rizky Aditya | Operasional, Staf Operasional | Dimas |

Karyawan non-demo tidak punya password (login Google). Garis atasan: Direksi → Kepala Divisi → anggota (Agus/KEU melapor ke Lestari, Direktur Keuangan); anggota Tim Gudang melapor ke Sari (ketua tim).

## 12. Keputusan

1. Model organisasi di `app/Models` (konvensi Sprint 0), logika di `app/Domain/Organization`.
2. `users.company_id` NOT NULL; migrasi mengisi otomatis perusahaan untuk baris lama (dev DB Sprint 0) sebelum NOT NULL.
3. `companies.google_domain` unik; `divisions.code` unik per company termasuk soft-deleted; `teams.code` ditambahkan (bagan mockup).
4. Waktu tabel baru `timestamptz` (DATABASE.md); tabel Sprint 0 tetap.
5. Perubahan peran diaudit lewat Action `SyncUserRoles` (event spatie tetap nonaktif: `syncRoles` akan memicu detach+attach yang berisik).
6. `employees.view` menjadi dasar "lihat semua" di `visibleTo` — satu sumber untuk HR/Direksi/Super Admin.
7. `head_user_id` memberi visibilitas divisi meski tanpa peran `kepala_divisi`; peran `kepala_divisi` memberi visibilitas divisinya sendiri.
8. Tanpa morph map (auditable_type = FQCN) agar baris `model_has_roles` yang ada tetap valid.
9. Profil karyawan (`employee_profiles`) tidak diaudit otomatis agar data pribadi tidak menyebar ke audit log.

## 13. Risiko / catatan untuk agent berikutnya

- Starter kit masih punya `settings/profile` yang mengizinkan user **mengubah email** dan **menghapus akunnya sendiri** (`ProfileController::update/destroy`). Dengan login Google & data master HR, sebaiknya email dikunci dan hapus akun dimatikan (agent Login/Admin).
- Login Fortify (email+password) belum dibatasi ke Super Admin + 2FA — tugas agent Login Google.
- Hybrid "hari di kantor" (mockup Karyawan) belum punya kolom; masuk modul jadwal/shift (Sprint 2).
