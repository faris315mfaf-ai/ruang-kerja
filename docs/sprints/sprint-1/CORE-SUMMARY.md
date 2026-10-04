# Sprint 1 — CORE: ringkasan

Slice fondasi data organisasi (tanpa halaman UI baru). Referensi pemakaian untuk agent fitur: `CORE.md`.

## Checklist

| # | Item | Status |
|---|---|---|
| 1 | Migrasi + model + factory: companies, divisions (code unik UPPER ≤ 10, is_board, parent_id, head_user_id), teams, positions, employee_profiles (NIK terenkripsi), audit_logs, kolom organisasi users (migrasi baru) + indeks | ✓ |
| 1 | Enum `WorkMode`, `UserStatus` berlabel Indonesia; relasi semua model | ✓ |
| 2 | Enum `Permission` + matriks per peran (`Role::permissions()`), `RoleSeeder` idempoten (`syncPermissions`), matriks di DATABASE.md | ✓ |
| 3 | `User::scopeVisibleTo()` (diri, bawahan langsung, divisi yang dipimpin + sub-divisi, semua untuk HR/Direksi/Super Admin) + test | ✓ |
| 4 | `ManagerHierarchy::wouldCreateCycle()` + rule `ValidManager` (A→B→A, rantai lebih dalam, null ok) + test | ✓ |
| 5 | Middleware `EnsureActiveEmployee` di grup web (logout + pesan Indonesia) + test | ✓ |
| 6 | `AuditLogger` + trait `Auditable` (User, Company, Division, Team, Position) + audit perubahan peran (`SyncUserRoles`) + rahasia disamarkan + `AuditLogPolicy` (Super Admin) + test | ✓ |
| 7 | Policy Company/Division/Team/Position/User/AuditLog + test matriks peran × aksi | ✓ |
| 8 | `OrganizationSeeder` idempoten (5 divisi, 2 tim, 17 jabatan, 22 karyawan, akun demo ditempatkan); `migrate:fresh --seed` jalan | ✓ |
| 9 | `auth.user` memuat company/division/position/avatar; `branding.companyName` dari perusahaan user | ✓ |
| 10 | `docs/sprints/sprint-1/CORE.md` + pembaruan `docs/DATABASE.md` | ✓ |

Acceptance Sprint 1 yang dicakup slice ini: "Tidak bisa membuat siklus atasan" (rule + test), "user nonaktif tidak bisa masuk" (middleware; pengecekan saat login tetap tugas agent Login), "anggota tidak bisa membuka admin" (policy `manage` siap dipakai — rute admin dibuat agent Admin).

## Cara mencoba manual

1. `php artisan migrate:fresh --seed`.
2. Masuk https://ruangkerja.test sebagai `kadiv@demo.test` / `password` → nama perusahaan di sidebar = nama perusahaan demo.
3. `php artisan tinker`:
   - `User::query()->visibleTo(User::firstWhere('email','kadiv@demo.test'))->pluck('name')` → hanya divisi Operasional.
   - `User::query()->visibleTo(User::firstWhere('email','anggota@demo.test'))->pluck('name')` → hanya Rizky.
   - Ubah `status` seorang user menjadi `inactive` → sesi user tersebut keluar pada request berikutnya dengan pesan "Akun Anda tidak aktif…".
   - `Division::first()->update(['name' => 'X'])` lalu `AuditLog::latest('id')->first()` → `division.updated` dengan nilai lama/baru.

## Keputusan

Lihat `CORE.md` §12. Utama: model di `app/Models`; `company_id` NOT NULL dengan backfill; perubahan peran lewat `SyncUserRoles`; tidak ada `Gate::before` Super Admin; `teams.code` ditambahkan; profil karyawan tidak diaudit otomatis.

Tambahan di luar slice (agar pemeriksaan hijau): `resources/js/pages/settings/profile.tsx` mempersempit `auth.user` null (typecheck Sprint 0 merah) dan `vp check --fix` merapikan format 12 file Sprint 0.

## Paket baru

Tidak ada.

## Sisa pekerjaan / risiko

- Halaman UI (Admin Karyawan, Divisi/Tim/Jabatan, Struktur Org, Audit Log) dan login Google → agent fitur Sprint 1.
- `settings/profile` starter kit masih mengizinkan ubah email & hapus akun sendiri — sebaiknya dikunci.
- Login email+password belum dibatasi ke Super Admin + 2FA wajib.
