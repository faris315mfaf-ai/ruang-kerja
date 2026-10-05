# Sprint 1 — Ringkasan slice Struktur (Divisi/Tim/Jabatan, Struktur Organisasi, Audit Log)

Branch `feat/sprint-1-struktur` (berbasis `feat/sprint-1-core`, sudah digabung dengan `main`). Rencana: `STRUKTUR-PLAN.md`.

## Kriteria penerimaan

| # | Kriteria | Status |
|---|---|---|
| 5 | Admin › Divisi, Tim, Jabatan: CRUD (HR & Super Admin) | ✓ `/admin/organisasi/{divisi,tim,jabatan}`, panel samping tambah/ubah, hapus (soft delete) + pulihkan |
| 5 | Divisi punya `code` unik, huruf besar, maks 10, dan `is_board` | ✓ dinormalisasi ke huruf besar, alfanumerik, unik per perusahaan **termasuk yang terhapus**; hanya satu unit Direksi, tanpa induk |
| 5 | Hapus dijaga | ✓ ditolak dengan pesan Indonesia bila masih ada karyawan aktif / tim / sub-divisi (divisi), anggota aktif (tim), pemegang aktif (jabatan) |
| 6 | Struktur Organisasi: bagan Direksi → Divisi → Tim → anggota dari data | ✓ `/organisasi/struktur`, semua peran; data dibangun di server oleh `OrganizationTree` (3 query) |
| 6 | Mobile = daftar bertingkat (PLATFORM §3) | ✓ accordion; desktop juga punya tampilan "Daftar" |
| 7 | Audit log otomatis create/update/delete | ✓ dari core (`Auditable`); restore juga tercatat |
| 7 | Halaman Admin › Audit Log (Super Admin) dengan filter | ✓ `/admin/audit`: aktor (termasuk "Sistem"), aksi (tepat atau grup `division.`), subjek, rentang tanggal (zona kantor), paginasi 25, drawer sebelum/sesudah; baca-saja |
| — | Anggota/Kadiv/Direksi tidak bisa membuka admin (403) | ✓ diuji per peran; otorisasi di FormRequest **sebelum** validasi (tidak membocorkan keberadaan kode) dan di controller |
| — | Label UI Bahasa Indonesia, token warna, mode gelap | ✓ dicek visual terang & gelap |
| — | Desktop 1440 / tablet 834 / ponsel 375 | ✓ dicek di browser; admin & audit di ponsel menampilkan `DesktopOnlyNotice` |

## Cara mencoba (https://ruangkerja.test, sandi `password` / tombol login demo)

1. **hr@demo.test** → sidebar *Admin › Organisasi*. Tab Divisi: klik baris Keuangan → ubah nama → *Simpan perubahan* (toast). *Hapus* Operasional → dialog menampilkan "Divisi Operasional masih memiliki 6 karyawan aktif dan 1 tim…". Tambah divisi dengan kode `keu` → galat kode sudah dipakai. Centang *Tampilkan yang dihapus* untuk memulihkan.
2. Tab Tim / Jabatan: sama (kode tim unik per divisi; nama jabatan unik; level 1–5).
3. Akun mana pun → *Struktur organisasi* (sidebar / tab Menu di ponsel). Cari "nadia" → bagan menyaring & membuka tim. Tombol −/+ dan *Pas ke layar*; toggle *Bagan/Daftar*.
4. **admin@demo.test** → *Admin › Audit log*. Ubah sesuatu di Organisasi lalu buka audit; klik baris → drawer menampilkan Kolom/Sebelum/Sesudah (id kepala divisi ditampilkan sebagai nama).
5. **anggota@demo.test** → `/admin/organisasi/divisi` dan `/admin/audit` → 403; di ponsel menu admin tidak muncul.

## File utama

- Backend: `app/Domain/Organization/Actions/{Save,Delete,Restore}{Division,Team,Position}.php`, `Services/OrganizationTree.php`, `Data/Org{Chart,Division,Team,Person}.php`, `Enums/{PositionLevel,AuditSubject}.php`, `app/Http/Controllers/Organization/*`, `app/Http/Controllers/Admin/AuditLogController.php`, `app/Http/Requests/{Organization,Admin}/*`, `routes/organization.php`, scope `AuditLog::visibleTo`.
- Frontend: `pages/organization/structure.tsx`, `pages/admin/organization/index.tsx`, `pages/admin/audit/index.tsx`, `features/organization/{chart,admin}/*`, `features/audit/*`, `components/desktop-only-notice.tsx`, `components/ui/table.tsx` (shadcn), navigasi di `lib/navigation.ts` + `pages/menu.tsx`.
- Test: `tests/Feature/Organization/{OrganizationTreeTest,OrganizationChartPageTest}.php`, `tests/Feature/Organization/Admin/{Division,Team,Position}ManagementTest.php`, `AuditLogPageTest.php`; Vitest `features/organization/chart/utils.test.ts`, `features/audit/labels.test.ts`, `lib/navigation.test.ts`.

## Keputusan

1. **Hapus = soft delete** dan ditolak selama masih ada karyawan **aktif** (atau tim/sub-divisi untuk divisi). Karyawan nonaktif/mengundurkan diri tetap menyimpan `division_id` lamanya (riwayat) dan tidak menghalangi. Bisa dipulihkan; pemulihan ditolak bila bentrok (unit Direksi kedua, kode tim/nama jabatan sudah dipakai, divisi tim masih terhapus).
2. Satu unit Direksi (`is_board`) per perusahaan, tanpa induk; induk divisi tidak boleh dirinya sendiri atau sub-divisinya (cegah siklus). Bagan tahan terhadap data siklus yang korup.
3. Kode tim opsional, unik di dalam divisinya (bukan per perusahaan). Nama jabatan unik per perusahaan (tanpa membedakan huruf besar/kecil).
4. **Bagan menampilkan direktori perusahaan** (nama, jabatan, avatar karyawan aktif) ke semua karyawan, sesuai `DivisionPolicy::viewAny`. Email, status, telepon, dan profil tidak pernah dikirim (diuji).
5. Penempatan di bagan: tiap orang muncul sekali — di timnya, lalu longgar di divisinya, lalu "Tanpa divisi" (mis. Admin Sistem). Kepala divisi dan ketua tim tampil di kartu unitnya. Urutan anggota: level jabatan, lalu nama.
6. Halaman admin diotorisasi dengan ability `create` policy (= `organization.manage`); policy core tidak diubah. FormRequest juga mengotorisasi agar 403 datang sebelum validasi.
7. Audit log dibatasi `AuditLog::visibleTo($viewer)`: butuh `audit.view`, hanya perubahan oleh orang di perusahaan yang sama + perubahan sistem (tanpa aktor). Filter aksi: nilai berakhiran titik (`division.`) = semua aksi subjek itu. Rentang tanggal ditafsirkan di zona kantor (Asia/Jakarta).
8. Tabel admin & audit memakai markup tabel shadcn biasa (bukan TanStack): daftar kecil, filter/paginasi di server.
9. Warna garis atas divisi diambil bergilir dari token (`primary`, `info`, `warning`, `danger`, `success`, `accent-blue`) karena skema tidak punya kolom warna divisi.
10. Zoom bagan memakai properti CSS `zoom` (memengaruhi tata letak, sehingga gulir tetap benar).

## Paket baru

Tidak ada.

## Belum dikerjakan / risiko

- **Ekspor PNG** (mockup StrukturOrg) belum ada: butuh pustaka render DOM (mis. `html-to-image`) yang tidak disebut di prompt sprint.
- `DesktopOnlyNotice` menyediakan **"Salin tautan"**, bukan "Kirim tautan ke email saya" (PLATFORM §3) — butuh endpoint email; bisa ditambahkan di sprint notifikasi. Agent Karyawan mungkin membuat file yang sama dengan tanda tangan sama (`DesktopOnlyNotice({ feature })`); bila konflik, ambil salah satu.
- Pilihan kepala divisi/ketua tim memakai Select biasa (daftar semua karyawan aktif); untuk ratusan karyawan sebaiknya combobox dengan pencarian (cmdk).
- Di tablet (834 px) bagan lebih lebar dari layar → gulir horizontal atau "Pas ke layar" (tidak otomatis).
- Tim di dalam unit Direksi tidak ditampilkan di tampilan Daftar (kasus jarang).
- Seeder memakai `WithoutModelEvents`, jadi audit log di DB demo awalnya kosong sampai ada perubahan lewat aplikasi.
