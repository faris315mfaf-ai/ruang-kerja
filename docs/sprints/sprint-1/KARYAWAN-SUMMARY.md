# Sprint 1 — Admin › Karyawan: ringkasan

Branch `feat/sprint-1-karyawan` (di atas `feat/sprint-1-core`, sudah di-merge dengan `main`). Rencana: `KARYAWAN-PLAN.md`.

## Acceptance criteria

| Kriteria | Status | Catatan |
|---|:-:|---|
| `/admin/karyawan`: tabel TanStack, cari, filter divisi/peran/status, sort, paginasi (server) | ✓ | `EmployeeDirectory` + `User::visibleTo`; TanStack Table v9 (`useTable`, `createColumnHelper`). Pencarian nama/email/jabatan (ILIKE, wildcard di-escape). 10/25/50 per halaman. |
| HR & Super Admin mengelola; Kadiv baca-saja divisinya; anggota 403 | ✓ | `UserPolicy` (`viewAny`/`manage`/`update`/`deactivate`/`assignRole`). Direksi juga baca-saja (punya `employees.view`). |
| Form tambah/ubah (nama, email domain kantor, divisi, tim terfilter, jabatan, atasan combobox, mode kerja, peran multi, tanggal bergabung, NIK & telepon) | ✓ | Panel kanan 440px (mockup). NIK hanya tampil tersamar `••••••••••••1234`, tidak pernah dikirim utuh ke klien atau audit. |
| Validasi domain email, siklus atasan (`ValidManager`), HR tidak bisa memberi `super_admin` | ✓ | Rule `CompanyEmail`; pesan ramah di FormRequest + `RoleChangeGuard` di Action (defense in depth). |
| Action Create/Update/Deactivate/ReactivateEmployee, peran lewat `SyncUserRoles`, semua diaudit | ✓ | `user.created/updated` (trait), `user.roles_changed`, `user.deactivated`/`user.reactivated` (+ alasan), `employee_profile.updated` (hanya nama kolom), `employee.imported` (ringkasan). |
| Nonaktif → logout | ✓ | Status `inactive`/`resigned` + alasan; `EnsureActiveEmployee` mengeluarkan user pada request berikutnya (diuji). Opsi memindahkan bawahan langsung ke atasan karyawan tsb. |
| Impor CSV/XLSX: pratinjau, laporan galat per baris (nomor baris + pesan), dry-run lalu commit, idempoten per email, unduh templat, chunk + transaksi per batch | ✓ | Baca chunk 500 baris; tulis per batch 100 baris dalam satu transaksi; baris galat tidak ditulis. Lihat "Impor" di bawah. |
| Mobile `MKaryawan`: cari + kartu + profil baca-saja; edit → "Fitur ini tersedia di desktop." | ✓ | Chip divisi dengan jumlah, "Muat lagi", bottom sheet profil. `components/desktop-only-notice.tsx` dibuat (`DesktopOnlyNotice({ feature? })`). |
| Halaman detail karyawan (profil, penempatan, bawahan langsung, audit terbaru untuk HR) | ✓ | `/admin/karyawan/{id}`; audit 15 baris terakhir hanya untuk `employees.manage`. |
| Test | ✓ | 40 test baru (`tests/Feature/Admin/EmployeeManagementTest.php`, `EmployeeImportTest.php`, `tests/Feature/Organization/EmployeeActionsTest.php`). Seluruh suite: 556 lulus. |
| Lint & typecheck | ✓ | `composer lint` (Pint + Larastan level 8), `npm run typecheck`, `npm run lint`, `npm test` hijau. |
| UI terang/gelap, 1440 & 375 | ✓ | Dicek di browser (desktop gelap & terang, 375px tanpa scroll horizontal, input 16px). |

## Cara mencoba (https://ruangkerja.test)

1. `php artisan migrate:fresh --seed`.
2. Masuk sebagai **hr@demo.test** (atau admin@) → menu Admin › Karyawan.
   - Cari "operasional", filter peran "Kepala Divisi", urutkan kolom, ganti halaman.
   - Klik baris → panel ubah (URL `?edit=<id>`, refresh membuka ulang). Ubah mode kerja → "Simpan perubahan" → toast.
   - Coba email `@gmail.com` → galat domain; pilih bawahan sendiri sebagai atasan → galat siklus; checkbox Super Admin terkunci untuk HR.
   - "Nonaktifkan" → pilih status + alasan → karyawan keluar pada request berikutnya.
   - "Impor CSV/XLSX" → unduh templat → isi → "Periksa berkas" → pratinjau (baris galat bernomor) → "Impor N baris valid".
3. **kadiv@demo.test** → hanya anggota Operasional, tanpa tombol ubah/impor.
4. **anggota@demo.test** → `/admin/karyawan` = 403.
5. Ponsel (≤ 767px): daftar kartu + banner desktop-only, ketuk kartu untuk profil.

## Impor — aturan

- Kolom: `nama*`, `email*`, `nomor_karyawan`, `divisi` (kode/nama), `tim` (nama/kode di divisi itu), `jabatan` (nama), `atasan_email`, `mode_kerja` (nilai atau label: Kantor/Hybrid/WFH/Lapangan), `peran` (dipisah koma), `tanggal_bergabung` (YYYY-MM-DD, d/m/Y, atau serial Excel), `telepon`, `nik`. Pemisah CSV `,` atau `;` dideteksi otomatis.
- **Sel kosong = pertahankan nilai lama** untuk karyawan yang sudah ada (berkas parsial aman); karyawan baru memakai default (Kantor, peran Anggota). Bila divisi berubah dan tim kosong, tim dikosongkan.
- Lintas baris: email/nomor karyawan ganda, atasan boleh karyawan baru di berkas yang sama (ditulis lebih dulu — urutan topologis), siklus atasan dicek terhadap gabungan data lama + berkas, atasan di baris galat ikut menggagalkan bawahannya.
- Maks 5 MB / 2.000 baris. Berkas disimpan di disk privat `employee-imports/` ≤ 60 menit; cache hanya menyimpan pratinjau aman (tanpa NIK/telepon). Token impor hanya untuk pengunggahnya; commit dikunci (`Cache::lock`) sehingga klik ganda tidak menulis dua kali; berkas dihapus setelah commit.
- Commit memvalidasi ulang berkas (data bisa berubah sejak pratinjau). Batch yang gagal karena galat sistem di-rollback dan barisnya dilaporkan; batch lain tetap jalan.

## Keputusan

1. **Paket `maatwebsite/excel` ^4.0** (PhpSpreadsheet 5) dipilih, bukan openspout: Sprint 3 memang menetapkan maatwebsite/excel untuk ekspor rekap, jadi satu pustaka spreadsheet untuk impor & ekspor; dukungan Laravel 13; chunk reading + heading row tersedia. Tanpa config yang dipublikasikan (default cukup).
2. Kode domain di `app/Domain/Organization` (`Actions`, `Data`, `Services`, `Imports`, `Exports`, `Rules`); model tetap di `app/Models` (konvensi CORE). Presenter respons di `app/Http/Presenters/EmployeePresenter.php`.
3. Route di `routes/admin-employees.php` (satu `require` di `web.php`), placeholder `admin/karyawan` dihapus. Nama route `admin.employees.*`; impor di `/admin/karyawan/impor`.
4. Email **dikunci** setelah karyawan pernah masuk (`google_id`/`last_login_at` terisi); bila email berubah sebelum itu, `google_id` dikosongkan.
5. Karyawan baru: `password` null, `email_verified_at` = sekarang (alamat Workspace milik perusahaan; route memakai middleware `verified`).
6. Perubahan status memakai `saveQuietly()` + satu baris audit eksplisit (`user.deactivated`/`user.reactivated` dengan alasan) — tidak ada `user.updated` ganda. Tidak ada migrasi baru: alasan disimpan di audit log.
7. NIK: input kosong = tidak berubah (NIK tak pernah dikirim ke klien, sehingga "kosong" tidak bisa berarti "hapus"). Penghapusan NIK belum tersedia.
8. Audit di halaman detail ditampilkan untuk `employees.manage` (HR & Super Admin), terbatas pada riwayat karyawan tsb — berbeda dari halaman Audit Log global (`audit.view`, Super Admin).
9. `HandleInertiaRequests` memuat `user->company` hanya `id,name`; kode slice ini mengambil `Company` segar saat butuh `google_domain` (catatan untuk agent lain: jangan pakai `$user->company->google_domain` di request web).
10. Combobox atasan dibuat dengan `cmdk` + panel absolut (tidak ada `@radix-ui/react-popover`; tidak menambah paket). Select memakai `<select>` native bergaya (`features/employees/native-select.tsx`) agar nilai kosong "Semua …" didukung dan picker OS muncul di ponsel.
11. Panel ubah memakai Sheet modal (fokus terkunci) — mockup menampilkannya berdampingan tanpa overlay; perilaku aksesibel lebih penting.
12. Mobile: "Lihat absensi" di mockup diganti "Lihat profil" (modul absensi belum ada); "Kirim tautan ke email saya" belum dibuat (butuh notifikasi email, Sprint 8).

## Belum selesai / risiko

- Shift dan "hari di kantor" (mockup) menunggu modul jadwal Sprint 2.
- Info "Perubahan divisi akan menyinkronkan anggota workspace divisi" tidak ditampilkan karena sinkron workspace belum ada (Sprint 5 perlu hook di `UpdateEmployee`).
- Menonaktifkan karyawan yang menjadi kepala divisi / ketua tim tidak mengosongkan `head_user_id`/`lead_user_id` (hanya bawahan langsung yang bisa dipindahkan).
- Pilihan atasan dikirim sebagai daftar penuh karyawan aktif (cukup untuk puluhan karyawan; ganti ke endpoint pencarian bila ribuan).
- Impor sinkron dalam request (≤ 2.000 baris). Untuk berkas lebih besar perlu job antrean.
- Ditemukan saat uji manual: cookie sesi `127.0.0.1` dipakai bersama antar-port, jadi beberapa worktree yang jalan bersamaan saling me-logout (bukan bug aplikasi; pakai host berbeda, mis. `s1b.localhost`).
