# Ruang HR (`/hr`)

> Keputusan pemilik 20 Okt 2026. Ruang kerja HR yang **menggantikan Dashboard HR**: `/dashboard` dan `/dashboard/hr` mengalihkan HR ke `/hr`; pilihan "HR" hilang dari pemilih dashboard. Kelas query `HrDashboard` tetap dipakai ulang (Dashboard Manajemen, dashboard jabatan, Ruang HR).

## 1. Akses

| Siapa | `/hr` dan semua tab | Aksi (beri tugas, ingatkan) |
|---|---|---|
| HR (aktif) | ✓ | ✓ |
| Super Admin (aktif) | ✓ (Beranda tetap "Saya"; buka dari menu) | ✓ |
| Direksi, Kepala Divisi, anggota, akun nonaktif | 403 | 403 (sebelum validasi) |

Gate `viewHrHub` (`App\Providers\HrHubServiceProvider`). Prop bersama `auth.home` = `'/hr'` bila `/dashboard` mengarahkan pengguna ke Ruang HR (HR yang bukan Direksi), selain itu `'/dashboard'` — dipakai tautan Beranda di shell. Semua data dibatasi perusahaan pengguna (`visibleTo`, `company_id`); suite `tests/Feature/HrHub/RuangHrAccessTest.php` memeriksa tidak ada data perusahaan lain di keenam tab (termasuk prop deferred).

## 2. Tab dan sumber data

| Tab | Rute (nama) | Komponen | Isi | Sumber |
|---|---|---|---|---|
| Ringkasan | `GET /hr` (`hr.summary`) | `hr/summary` | KPI hari ini (hadir/terjadwal, terlambat, belum check-in, pengajuan menunggu HR + yang > 24 jam, laporan harian terkirim/draf/terjadwal, penugasan terbuka/terlambat, jumlah agenda), **Perlu tindakan** (pengajuan, reset sandi, absensi perlu koreksi 30 hari, kandidat baru; terlama dulu, maks. 8 + total), agenda hari ini, kehadiran per divisi, 3 penugasan terdekat tenggatnya, 3 catatan Tim HR terbaru, kartu "Catat briefing" | `HrSummary`, `HrDashboard::today/pendingHrQuery`, `HrCalendar::day`, `HrAssignments::summary`, `BriefingWindow` |
| Absensi | `GET /hr/absensi` (`hr.attendance`) | `hr/attendance` | Angka hari ini + per shift + per divisi, belum check-in padahal shift sudah mulai (maks. 50), lupa check-out kemarin, check-in mencurigakan belum ditinjau (7 hari), bulan ini: perlu koreksi / Alpha / terlambat; total gaji bulan berjalan (deferred, hanya `payroll.view`) | `HrAttendance`, `PayrollCalculator` |
| Monitoring | `GET /hr/monitoring?tanggal=Y-m-d&tampil=laporan\|beban` (`hr.monitoring`) | `hr/monitoring` | Laporan harian per divisi & per orang (deferred grup `laporan`), beban kerja per divisi → orang (deferred grup `beban`); `monitoring.can_remind` hanya untuk hari ini | `DailyWorkMonitor::for`, `ManagementDashboard::workload` |
| Penugasan | `GET /hr/penugasan?status=` (`hr.assignments`) | `hr/assignments` | Tugas workspace "Penugasan HR" (belum mulai · dikerjakan · terlambat · selesai, hitungan per status), pemilih "Beri tugas" (karyawan, divisi, tim; deferred grup `pemilih`) | `HrAssignments` |
| Jadwal | `GET /hr/jadwal?bulan=YYYY-MM` (`hr.schedule`) | `hr/schedule` | Kalender bulan (Senin sebelum tgl 1 … Minggu setelah akhir bulan) + agenda minggu ini: rapat yang terlihat (bila `FEATURE_MEETINGS`), wawancara kandidat, cuti/izin/sakit/dinas yang disetujui **seluruh perusahaan**, hari libur | `HrCalendar` |
| Catatan | `GET /hr/catatan` (`hr.notes`) | `hr/notes` | Pohon catatan workspace "Tim HR" (bila `FEATURE_NOTES`), hak buat | `NoteLibrary::notes`, `NotePolicy::create` |

Prop `hub` di semua tab: `{tab, today, today_label, workspaces: {team, assignments}: {id, key, name}|null, features: {meetings, notes}}`.

### Aksi

| Rute | Action | Hasil |
|---|---|---|
| `POST /hr/penugasan` (`hr.assignments.store`) | `AssignHrTask` | `user_ids[]`, `division_ids[]` (termasuk sub-divisi), `team_ids[]` → karyawan aktif perusahaan (tanpa duplikat, maks. 200); `mode` `per_person` (satu tugas per orang) atau `shared` (satu tugas, semua penanggung jawab); `title`, `description_text` (instruksi), `due_date`, `priority` 0–4, `checklist[]` (maks. 20). Penerima ditambahkan sebagai `member` (tidak tersinkron). Audit `hr.task_assigned` (mode, jumlah penerima, id tugas). Redirect kembali + toast "N tugas diberikan." / "Tugas KEY-n diberikan."; galat validasi di `recipients`, `checklist`, `title`, `mode`. |
| `POST /hr/monitoring/ingatkan` (`hr.monitoring.remind`) | `RemindDailyReport` | `user_ids[]` atau `all=true`: karyawan yang terjadwal hari ini dan belum mengirim laporan mendapat `DailyReportReminder`, maks. sekali per orang per hari (`notification_dispatch_logs`, cycle `manual:{tanggal}`, terpisah dari pengingat otomatis 16.30). Toast "Pengingat dikirim ke N orang." |

## 3. Workspace sistem

`EnsureHrWorkspaces` membuat/menyinkronkan dua workspace tipe `team` (tanpa `team_id`, `private`) per perusahaan — dipanggil setiap tab Ruang HR (tiga query baca bila sudah sinkron) dan tiap hari 01.00 waktu kantor (`CompanySchedule`):

| `system_key` | Nama | Key (bawaan) | `tasks_private` | Isi |
|---|---|---|---|---|
| `hr_team` | Tim HR | `TIMHR` | false | Catatan bersama tim HR (tab Catatan) |
| `hr_assignments` | Penugasan HR | `PHR` | **true** | Tugas dari HR untuk karyawan |

- Owner = HR aktif pertama (cadangan: Super Admin pertama). Semua HR + Super Admin aktif = **admin tersinkron**. Mantan HR keluar (atau turun jadi `member` bila masih punya tugas di Penugasan HR). Baris owner/admin bukan HR diturunkan jadi `member`.
- Bila key sudah dipakai di perusahaan, ditambah angka (`PHR2`).
- Tidak bisa diarsipkan, key & visibilitas tidak bisa diubah, admin tidak bisa ditambah/diubah manual (`WorkspacePolicy::archive`, `UpdateWorkspace`, `AddWorkspaceMember`, `UpdateWorkspaceMemberRole`).
- Penugasan HR **tidak** mendapat kanal Obrolan otomatis (`SyncWorkspaceChannel`) dan folder Drive-nya hanya dibagikan ke admin (`Workspace::driveMembers`, tidak dibuat otomatis saat workspace dibuat).

## 4. Aturan privasi Penugasan HR (`tasks_private`)

Di workspace `tasks_private`, **owner/admin melihat semua tugas; orang lain yang bisa membuka workspace (anggota, viewer, Direksi mode lihat saja) hanya melihat tugas yang ditugaskan kepadanya.** Tugas lain → 404 di setiap aksi.

Titik penegakan:
- `TaskPolicy` (`view`, `update`, `work`, `move`, `comment`, `watch`, `trackCommentReads`, `plan`, `delete` → `hiddenPrivate`; juga `ChecklistItemPolicy`, `CommentPolicy`, `ReactionPolicy`, `AttachmentPolicy` lewat TaskPolicy) dan kanal `task.{id}`.
- `WorkspacePolicy::createTasks` / `canCreateTasks` (hanya owner/admin di workspace privat): web `POST /w/{key}/tugas`, API `POST /api/v1/tugas`, subtugas API, opsi form tugas, target "Jadikan tugas" rapat (Penugasan HR dikecualikan sama sekali), `can.create_tasks` di halaman workspace.
- Scope `Task::visibleTo` (+ `Task::respectingPrivacyOf`): Tugas saya, Tugas hari ini, kalender pribadi, pencarian & command palette, rujukan `#`, laporan harian (cari tugas, judul tugas di monitoring), planner, metrik/beban kerja (`MetricScope`), OKR, komentar (`Comment::visibleTo`), digest.
- `BoardTasks::query($viewer)` dan `hiddenClosedCount`: papan/daftar/kalender workspace (web & API), pindah kartu API, detail tugas; subtugas (`TaskDetail`, `TaskApiDetail`); hitungan di API detail workspace & kalender.
- `Activity::respectingPrivacyOf`: feed aktivitas workspace (web & API) — non-admin hanya aktivitas tugasnya sendiri.
- Daftar anggota (web `WorkspacePage::members`, API `/api/v1/workspace/{key}/anggota`) dan saran `@`: non-admin hanya melihat HR dan dirinya.
- Audiens notifikasi `TaskAudience::withTaskAccess`: mention, komentar, ditugaskan, tenggat H-1/terlewat, notifikasi otomasi.
- Drive: daftar & pratinjau file workspace hanya untuk admin (`WorkspacePolicyDriveAccess`).
- Otomasi (aturan, tugas berulang, templat) workspace privat hanya terlihat oleh owner/admin (`AutomationAccess`).

Uji: `tests/Feature/HrHub/PrivateTasksLeakTest.php` (web & API, kontrol positif untuk penerima sendiri).

## 5. Jadwal wawancara

Kolom `candidates.interview_at` (UTC) + `interview_location`. HR mengatur di profil kandidat (`PUT /hiring/kandidat/{id}/wawancara`, `docs/fitur/hiring.md` §3a); tampil di tab Jadwal dan agenda Ringkasan.

## 6. Layar (frontend)

`resources/js/features/hr/*` + `pages/hr/*` (mockup Ruang HR: Main, Absensi, Monitoring, Penugasan, Jadwal, Catatan, MRuangHR, MPenugasan). Desktop/tablet: header + `TabNav`; ponsel: Ringkasan berisi chip bagian, tab lain layar turunan (kembali ke `/hr`). Navigasi: ubin "Ruang HR" setelah Dashboard (Dock/Rail, `canSeeHrHub`), baris Lainnya, dan tab bawah pertama mengikuti `auth.home`. Monitoring memakai ulang `DateStepper`/`ReportCard`/`ReportDetailSheet` dan `WorkloadPanel`. Penugasan: pemilih penerima gabungan orang/divisi/tim; jumlah penerima dihitung di klien (orang/tim di dalam divisi terpilih tidak dihitung dua kali; "±" bila tim dan orang lain bisa tumpang tindih, sub-divisi ditambah server). Uji klik: `tests/e2e/ruang-hr-penugasan.mjs` (tugas sampai ke Tugas saya penerima, tidak terlihat karyawan lain).

Tidak ada tombol "Kirim pengingat check-in ke semua" di tab Absensi: belum ada endpoint pengingat check-in manual (pengingat otomatis tetap berjalan).

## 7. Belum / di luar cakupan

- Kehadiran di kanal presence `workspace.{id}` (avatar "sedang melihat") tidak disaring per tugas: anggota Penugasan HR bisa melihat nama orang lain yang sedang membuka papan, tanpa judul tugas.
