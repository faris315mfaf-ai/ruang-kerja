# Sprint 1 — Rencana slice Struktur (Divisi/Tim/Jabatan, Struktur Organisasi, Audit Log)

Branch `feat/sprint-1-struktur`, berbasis `feat/sprint-1-core` (lihat `CORE.md`). Tugas 5, 6, dan halaman tugas 7 di blok Sprint 1 `docs/PROMPTS.md`.

## Backend

| Area | File |
|---|---|
| Enum | `Domain/Organization/Enums/PositionLevel` (1 Direksi … 5 Staf, label Indonesia), `AuditSubject` (karyawan/divisi/tim/jabatan/perusahaan ↔ kelas model) |
| Action | `SaveDivision`, `DeleteDivision`, `RestoreDivision`, `SaveTeam`, `DeleteTeam`, `RestoreTeam`, `SavePosition`, `DeletePosition`, `RestorePosition` (satu `handle()`, di dalam `DB::transaction`) |
| Service | `OrganizationTree` (bagan Direksi → Divisi → Tim → anggota, dibangun di server) |
| FormRequest | `Organization/DivisionRequest`, `TeamRequest`, `PositionRequest`, `Admin/AuditLogIndexRequest` |
| Controller | `Organization/DivisionController`, `TeamController`, `PositionController`, `OrganizationChartController`, `Admin/AuditLogController` |
| Rute | `routes/organization.php` (satu `require` di `web.php`) |
| Policy | Dari core. Tambahan kecil: `DivisionPolicy::manage` (halaman admin organisasi). |

Aturan:
- Kode divisi: wajib, huruf besar (dinormalisasi), alfanumerik, maks 10, unik per perusahaan **termasuk yang terhapus**.
- Satu unit Direksi (`is_board`) per perusahaan, tanpa induk. Induk divisi tidak boleh dirinya sendiri / sub-divisinya (cegah siklus).
- Kepala divisi / ketua tim = karyawan aktif di perusahaan yang sama.
- Kode tim opsional, unik di dalam divisinya. Nama jabatan unik per perusahaan; level 1–5.
- Hapus = soft delete. Ditolak (pesan galat Indonesia) bila masih ada karyawan aktif / tim / sub-divisi. Bisa dipulihkan.
- Audit otomatis lewat trait `Auditable` (core).

## Frontend

| Layar | Desktop | Mobile |
|---|---|---|
| `/admin/organisasi/{divisi,tim,jabatan}` | Tab + tabel + panel samping form (gaya mockup `Karyawan`) | `DesktopOnlyNotice` |
| `/organisasi/struktur` | Bagan pohon (mockup `StrukturOrg`), cari orang, Bagan/Daftar, zoom | Daftar bertingkat (accordion) |
| `/admin/audit` | Tabel + filter (aktor, aksi, subjek, rentang tanggal) + drawer diff sebelum/sesudah, paginasi | `DesktopOnlyNotice` |

Navigasi: `mainNavItems` + "Struktur organisasi"; `adminNavItems` + "Organisasi" (HR, Super Admin) & "Audit log" (Super Admin), ditandai `desktopOnly` sehingga tidak muncul di tab Menu ponsel.

## Test (Pest)
CRUD per peran (HR/Super Admin boleh; Direksi/Kadiv/Anggota 403), validasi kode, penjaga hapus, pulihkan, baris audit, kebenaran pohon, halaman struktur untuk semua peran, audit log hanya Super Admin + filter + paginasi. Vitest: label audit, diff, pencarian bagan.

## Risiko / keputusan awal
- Bagan menampilkan nama, jabatan, avatar seluruh karyawan aktif perusahaan (direktori), bukan data pribadi. Sesuai `DivisionPolicy::viewAny` (semua karyawan).
- "Ekspor PNG" di mockup butuh pustaka render DOM → ditunda (tanpa paket baru).
- Tabel kecil memakai markup tabel shadcn biasa; TanStack tidak diperlukan untuk daftar ≤ ratusan baris dengan filter server.
