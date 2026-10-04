# Sprint 1 — Admin › Karyawan: rencana

Branch `feat/sprint-1-karyawan` (di atas `feat/sprint-1-core`). Acuan: PROMPTS Sprint 1 tugas 4, PRD M1, DATABASE §1, PLATFORM §3, mockup `Karyawan` & `MKaryawan`.

## Akses
| Peran | Daftar & detail | Tambah/ubah/nonaktifkan/impor |
|---|---|---|
| HR, Super Admin | semua karyawan perusahaan | ✓ (HR tidak bisa memberi/mencabut `super_admin` atau mengubah Super Admin) |
| Direksi | semua (baca saja, `employees.view`) | ✗ |
| Kepala Divisi | divisinya + bawahan langsung (`visibleTo`), baca saja | ✗ |
| Anggota | 403 | ✗ |

Halaman: `UserPolicy::viewAny` (+ `view` untuk detail). Mutasi: `create`/`update`/`deactivate`/`assignRole`; impor: `manage`.

## Backend
- Route: `routes/admin-employees.php` (satu `require` di `web.php`, placeholder `admin/karyawan` dihapus).
- Controller: `Admin\EmployeeController` (index, show, store, update, deactivate, reactivate), `Admin\EmployeeImportController` (show, template, preview, commit).
- FormRequest: `Admin\StoreEmployeeRequest`, `UpdateEmployeeRequest` (bersama trait aturan), `DeactivateEmployeeRequest`, `EmployeeImportRequest`.
- Domain `app/Domain/Organization`:
  - `Data/EmployeeData` (DTO input bersama form & impor).
  - Actions: `CreateEmployee`, `UpdateEmployee`, `DeactivateEmployee`, `ReactivateEmployee`, `PreviewEmployeeImport`, `CommitEmployeeImport`.
  - Services: `EmployeeImportReader` (maatwebsite/excel, chunk 500 baris), `EmployeeImportValidator` (validasi per baris + lintas baris: email ganda, atasan, siklus), `EmployeeDirectory` (query daftar: cari/filter/sort/paginasi).
  - Rule: `CompanyEmail` (domain perusahaan).
  - Export: `EmployeeImportTemplate` (CSV/XLSX).
- Peran hanya lewat `SyncUserRoles`; setiap peran yang ditambah/dicabut dicek `Gate assignRole` di Action (defense in depth) dan di FormRequest (pesan galat ramah).
- Audit: `user.created/updated` otomatis (trait Auditable), `user.roles_changed` (SyncUserRoles), `user.deactivated` / `user.reactivated` manual (dengan alasan), `employee_profile.updated` manual tanpa nilai NIK (hanya penanda `nik: ***`), `employee.imported` ringkasan impor.
- Tanpa migrasi baru (alasan nonaktif disimpan di audit log).

## Frontend
- `pages/admin/employees/index.tsx` → `features/employees/employee-list.desktop.tsx` (TanStack Table v9, sort/paginasi/filter server) + `employee-list.mobile.tsx` (kartu + bottom sheet profil).
- `features/employees/employee-form-sheet.tsx` (panel kanan, tambah/ubah), `manager-combobox.tsx` (cmdk), `deactivate-dialog.tsx`, `use-employee-filters.ts`.
- `pages/admin/employees/show.tsx` (profil, penempatan, bawahan langsung, audit terbaru untuk HR).
- `pages/admin/employees/import.tsx` (template, unggah, pratinjau, hasil). Mobile: `DesktopOnlyNotice`.
- `components/desktop-only-notice.tsx` (bersama).

## Test (Pest)
CRUD HR, anggota 403, kadiv baca-saja terbatas divisi, domain email salah ditolak, siklus atasan ditolak, HR tidak bisa memberi super_admin, impor baris salah → nomor baris & tidak ditulis, impor memperbarui berdasarkan email, nonaktif → logout, NIK tidak bocor ke props/audit.

## Risiko / keputusan awal
- Email dikunci setelah karyawan pernah login (terikat `google_id`).
- Shift & "hari di kantor" (mockup) menunggu modul jadwal Sprint 2 — tidak ditampilkan.
- "Kirim tautan ke email saya" (MKaryawan) belum dibuat (butuh notifikasi email; Sprint 8).
