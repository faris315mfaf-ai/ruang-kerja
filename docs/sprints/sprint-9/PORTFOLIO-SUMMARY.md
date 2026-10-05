# Sprint 9 bagian B — Ringkasan: Proyek & portofolio + Dashboard Direksi

Cabang `feat/sprint-9-portofolio` (sudah digabung dengan `main` terbaru: Sprint 3, 4, 7 drive wiring, perbaikan Sprint 1). Bagian A (MetricDefinitions, Dashboard Saya/Kadiv/HR) dikerjakan terpisah di `feat/sprint-9-dashboard`; pemilih tampilan "Direksi" di sana menaut ke `/portofolio` dari bagian ini.

## Acceptance criteria (docs/PROMPTS.md Sprint 9 tugas 3b, 3c + AC proyek)

| # | Kriteria | Status |
|---|---|---|
| 3b | Migrasi `milestones`, `milestone_tasks`, `project_updates`, `project_risks`, `project_progress_snapshots` (+ `project_directions`) | ✓ satu migrasi, bisa di-rollback; CHECK status/health di `workspaces` |
| 3b | Form atribut proyek di pengaturan workspace proyek | ✓ seksi "Proyek" (PIC, sponsor, divisi utama, mulai, target, status siklus) |
| 3b | CRUD milestone & risiko (PIC/admin) | ✓ tambah/ubah/tandai selesai/buka lagi/hapus milestone + tautan tugas; tambah/ubah/teratasi/hapus risiko |
| 3b | Form "Update proyek" (kesehatan, ringkasan, hambatan, keputusan) | ✓ dialog desktop / bottom sheet mobile; snapshot progres aktual & rencana disimpan; `workspaces.health` + `last_update_at` diperbarui |
| 3b | Pengingat Jumat 15.00 | ✓ `SendProjectUpdateReminders` (`weeklyOn(5, '15:00')` WIB), hanya bila belum ada update sejak Senin 00.00 WIB, sekali per proyek per minggu |
| 3b | Job snapshot harian 23.55 | ✓ `TakeProjectProgressSnapshots` (`dailyAt('23:55')` WIB), upsert idempoten |
| 3b | Aksi Direksi "Minta update", "Beri arahan", "Tandai keputusan selesai" + notifikasi | ✓ semuanya memberi notifikasi (in-app + email, preferensi "Proyek: pengingat update, arahan & keputusan") |
| 3c | Dashboard Direksi `/portofolio` sesuai mockup | ✓ KPI portofolio, tabel proyek (status PIC + penanda sistem, bar aktual + penanda rencana, milestone berikutnya, target, terlambat, umur update), linimasa Agu–Des + garis hari ini + milestone, "Butuh keputusan Anda" + "Perlu perhatian", feed update PIC, SATU widget absensi → `/dashboard?view=hr` |
| 3c | Mobile MDashboardDireksi | ✓ chip status, baris hadir, 4 tile, kartu proyek (tanpa tabel & tanpa linimasa), feed |
| 3c | Detail proyek (tab Ringkasan) ProyekDetail & MProyekDetail + burn-up dari snapshot | ✓ `/w/{KEY}/ringkasan`: KPI, burn-up (lingkup/selesai/ideal/milestone, Recharts), milestone, update terbaru + riwayat, risiko, tugas terlambat, tim & beban, kotak arahan; mobile dengan bar aksi bawah |
| AC | Progres aktual & rencana sesuai rumus (batas 0–100%, bobot estimasi) | ✓ `tests/Unit/Projects/ProgressFormulaTest.php`, `tests/Feature/Projects/ProjectMetricsTest.php` |
| AC | Penanda sistem tepat pada ≤ −15 poin, milestone terlewat, update > 7 hari | ✓ dataset batas (−15,0 / −14,9 / pembulatan 0,1; 7 vs 8 hari kalender WIB; belum pernah update) |
| AC | Hanya PIC/admin menulis update | ✓ matriks peran (policy) + HTTP 403/404 |
| AC | Direksi melihat semua proyek, Kadiv hanya proyek divisinya | ✓ `Workspace::portfolioFor()` + `/portofolio` + `/w/{KEY}/ringkasan` |
| AC | Snapshot idempoten, pengingat | ✓ `ProjectJobsTest` |
| AC | Dashboard < 1 detik | ✓ data demo: query portofolio 15 query ±56 ms, ringkasan PLQ ±38 ms; `ProjectMetrics` jumlah query tetap (2) berapa pun jumlah proyek (ada test-nya) |

## Rumus (app/Domain/Analytics/Projects)

- **Progres aktual** (`ActualProgress`): tugas `done` ÷ tugas non-`canceled` (tugas terhapus tidak dihitung), 0–100%. Bila ≥ 80% tugas punya `estimate_hours > 0`, dibobot jam; tugas tanpa estimasi diberi bobot rata-rata estimasi (agar tetap terhitung). Tanpa tugas → `null` (tampil "–").
- **Progres rencana** (`PlannedProgress`): (hari ini − mulai) ÷ (target − mulai), tanggal kalender WIB, dibatasi 0–100%; target ≤ mulai → 0% sebelum target, 100% sejak target.
- **Selisih** = aktual − rencana, dibulatkan 0,1 poin sebelum dibandingkan.
- **Penanda sistem** (`ProjectFlags`, hanya proyek `active`): `behind` bila selisih ≤ −15; `missed_milestone` bila ada milestone lewat target & belum selesai; `stale_update` bila update terakhir > 7 hari kalender WIB lalu (atau belum pernah update padahal proyek sudah dilacak > 7 hari).
- **Butuh keputusan**: semua update dengan `decision_needed` yang belum ditandai selesai (bukan hanya update terakhir — keputusan lama yang belum dijawab tetap muncul, sesuai mockup "keduanya PLQ").

## Cara mencoba manual (`php artisan migrate:fresh --seed`, https://ruangkerja.test)

1. **Hendra Wijaya (direksi@demo.test)** → sidebar "Portofolio" (`/portofolio`). 6 proyek aktif (RKR bermasalah, PLQ & ANG berisiko, KTR/AUD/MSG sesuai jalur), 2 proyek selesai di Q3, 2 keputusan PLQ, RKR di "Perlu perhatian". Coba filter periode/divisi/status (tersimpan di URL), "Lihat arsip", "Setujui", "Diskusikan", "Balas", "Minta update", "Ekspor ringkasan (PDF)" (cetak browser).
2. Klik **Proyek Peluncuran Q4** → tab Ringkasan: burn-up, milestone "Siaran pers final" terlewat, keputusan dengan Setujui/Diskusikan, kotak "Arahan Direksi", tombol "Minta update"/"Beri arahan".
3. **Dimas Pratama (kadiv@demo.test)** = PIC Renovasi kantor lantai 2 (`/w/KTR/ringkasan`): "Update proyek", tambah milestone/risiko lewat menu ⋯; `/w/KTR/pengaturan` → seksi "Proyek". Sebagai Kepala Divisi Operasional, `/portofolio` hanya menampilkan proyek yang melibatkan Operasional (tanpa aksi Direksi & tanpa widget absensi).
4. **Rizky Aditya (anggota@demo.test)**: `/portofolio` → 403; tab Ringkasan proyek tempat ia anggota bisa dibaca, tanpa tombol tulis.
5. Mobile 390 px: `/portofolio` (kartu, chip status) dan `/w/PLQ/ringkasan` (bar aksi bawah).
6. Notifikasi: setelah "Minta update"/"Beri arahan"/"Setujui", masuk sebagai PIC (Putri Ramadhani tidak punya akun demo — gunakan KTR milik Dimas) dan buka Inbox.

## Keputusan

- **Divisi utama proyek = `workspaces.division_id`** (kolom sudah ada; sinkron anggota divisi hanya membaca `type = division`). Didokumentasikan di DATABASE.md §4.
- **Arahan Direksi di tabel baru `project_directions`**, bukan `comments` (milik Sprint 6, belum ada). Arahan bisa umum atau membalas satu update.
- **"Setujui" = "Tandai keputusan selesai"** (mockup memakai label "Setujui"); "Diskusikan" membuka dialog arahan yang tertaut ke update tersebut. Penandaan keputusan dicatat di `audit_logs` (`project.decision_resolved`), begitu juga perubahan atribut proyek (`project.attributes_changed`).
- **Hak tulis** (update, milestone, risiko): PIC (`lead_user_id`) apa pun peran workspace-nya, owner/admin workspace, dan Super Admin (`workspaces.manage`, konsisten dengan pengaturan workspace). Atribut proyek: yang boleh mengelola pengaturan workspace (owner/admin/Super Admin). Aksi Direksi: izin `portfolio.view` (Direksi, Super Admin) + boleh melihat proyek. Proyek diarsipkan = baca-saja.
- **Visibilitas portofolio** (`Workspace::scopePortfolioFor`): Direksi/Super Admin semua proyek; Kepala Divisi proyek dengan divisi utama atau anggota dari divisi yang ia pimpin; lainnya proyek tempat ia PIC/sponsor/anggota. Visibilitas `internal` tidak memasukkan proyek ke portofolio. `/portofolio` terbuka untuk `portfolio.view` dan Kepala Divisi; entri navigasi "Portofolio" hanya untuk direksi & super_admin (sesuai brief), Kadiv bisa membuka lewat URL/pemilih bagian A.
- `WorkspacePolicy::canView` dan `scopeVisibleTo` kini juga memasukkan proyek dengan **divisi utama** yang dipimpin Kadiv (sebelumnya hanya lewat anggota).
- **Periode**: proyek terbuka yang rentang mulai–target-nya beririsan dengan kuartal/bulan; "Semua" tanpa batas. Baris "N proyek selesai di Q3" memuat proyek yang selesai sejak awal kuartal sebelumnya. Linimasa selalu 2 bulan sebelum s.d. 2 bulan sesudah bulan ini (Agu–Des pada Oktober).
- **Minta update** dibatasi sekali per 12 jam per proyek; notifikasinya ada di "Perlu tindakan" sampai PIC mengirim update. Notifikasi "Butuh keputusan" ke sponsor (atau semua Direksi bila tanpa sponsor) juga "Perlu tindakan" sampai keputusan ditandai selesai.
- `project_status` null diperlakukan `active` (workspace proyek baru belum punya status).
- **Ekspor PDF** = `window.print()` (halaman punya kelas `print:`); ekspor Excel dashboard termasuk bagian A.
- Tab **Ringkasan** ditambahkan di `WorkspaceShell` hanya untuk workspace proyek (`/w/{KEY}` tetap membuka Tugas). `WorkspaceShell` mendapat prop `header` opsional.
- Komponen kartu/tren dibuat di `resources/js/features/portfolio/` (tidak bergantung pada berkas bagian A).
- Notifikasi baru: `project.update_reminder`, `project.update_requested`, `project.direction`, `project.decision_needed`, `project.decision_resolved` → satu baris preferensi baru `project.activity` (kategori Tugas, in-app + email aktif default). Event aktivitas baru (`project.*`, `milestone.*`, `risk.*`) dengan teks Indonesia di tab Aktivitas.

## Paket baru

- **recharts ^3.10.1** — grafik burn-up (diminta PROMPTS Sprint 9 "grafik tren (Recharts)"); versi sama dengan cabang bagian A agar lockfile mudah digabung.

## Data demo (`ProjectSeeder`, satu baris di `DatabaseSeeder`)

RKR (PIC Hana, SDM, bermasalah, update 9 hari, milestone terlewat), PLQ (PIC Putri, Pemasaran, berisiko, 2 keputusan terbuka, 13 tugas lebih awal ditambahkan), ANG & AUD (PIC Agus, Keuangan, sponsor Lestari), KTR (PIC Dimas), MSG (PIC Sari), IRK & SOPK (selesai di Q3). Milestone, update mingguan sejak mulai, risiko, arahan, dan snapshot harian (IRK ±170 hari → ± 6 bulan; total ±500 baris). Semua tanggal relatif terhadap hari ini; idempoten (proyek yang sudah punya update dilewati).

## Test

- Pest **1541 hijau** (setelah merge `main`); baru: 28 unit rumus + 47 feature (ProjectMetrics, ProjectAccess, ProjectActions, ProjectJobs, ProjectPages, ProjectSeeder). `WorkspaceSeederTest` disesuaikan dengan data portofolio dan kini juga merender `/w/PLQ/ringkasan` & `/portofolio` dalam strict mode.
- Vitest **231 hijau** (baru: `features/portfolio/lib.test.ts`, teks aktivitas proyek, navigasi Portofolio).
- `composer lint` (Pint + Larastan level 8), `npm run typecheck`, `npm run lint`, `npm run build` bersih.
- Uji browser (Playwright headless, 1440 px gelap/terang & 390 px): portofolio, ringkasan PLQ/KTR, pengaturan KTR; alur PIC kirim update + tambah milestone, Direksi Setujui + Minta update (mobile) + Beri arahan — semuanya berhasil, tanpa error konsol selain WebSocket Reverb yang memang tidak dijalankan.

## Sisa / risiko

- Bentrok merge yang mungkin dengan bagian A: `resources/js/lib/navigation.ts` (+test), `app-sidebar.tsx`, `menu.tsx`, `NotificationType`/`NotificationEvent`, `config/notifications.php`, `routes/console.php`, `package.json`/lockfile (recharts), `docs/DATABASE.md`. Semua berupa penambahan baris.
- Saat Sprint 6 (`comments`) masuk, pertimbangkan memindahkan `project_directions` ke komentar morph `project_updates` (dengan @mention).
- Tablet (834 px) memakai tata letak desktop dengan tabel bergulir horizontal; belum diverifikasi visual khusus.
- ~~Widget absensi menghitung "belum check-in" tanpa jadwal shift~~ — selesai Sprint 10B: memakai `TodayAttendance` (ScheduleSnapshot), angka sama dengan Dashboard HR.
