# Sprint 9 bagian B — Rencana: Proyek & portofolio + Dashboard Direksi

Cabang `feat/sprint-9-portofolio`. Bagian A (MetricDefinitions, Dashboard Saya/Kadiv/HR di `/dashboard`) dikerjakan paralel di `feat/sprint-9-dashboard`; pemilih tampilan "Direksi" di sana menaut ke `/portofolio`. Bagian ini **tidak** bergantung pada berkas bagian A.

## Lingkup (docs/PROMPTS.md Sprint 9 tugas 3b & 3c, PRD M10)

1. Migrasi `milestones`, `milestone_tasks`, `project_updates`, `project_risks`, `project_progress_snapshots`, `project_directions` (lihat Keputusan). Kolom proyek di `workspaces` sudah ada (Sprint 5).
2. Model (`app/Models`, konvensi modul Workspace): `Milestone`, `ProjectUpdate`, `ProjectRisk`, `ProjectProgressSnapshot`, `ProjectDirection` + Policy masing-masing.
3. Rumus di `app/Domain/Analytics/Projects`: `ActualProgress`, `PlannedProgress`, `ProjectFlags` (+ `MilestoneStatusResolver` di domain Proyek). Unit/feature test dengan angka hitungan manual.
4. Domain `app/Domain/Projects`: Enums (`ProjectStatus`, `ProjectHealth`, `MilestoneStatus`, `RiskLevel`, `RiskStatus`, `ProjectFlag`), Actions (atribut proyek, milestone CRUD, risiko CRUD, update proyek, minta update, beri arahan, tandai keputusan selesai), Jobs (`TakeProjectProgressSnapshots` 23.55, `SendProjectUpdateReminders` Jumat 15.00 WIB), Notifications (5 jenis), Queries (`ProjectMetrics`, `PortfolioDashboard`, `ProjectSummary`).
5. HTTP: `routes/projects.php` (satu `require` di `web.php`): `/portofolio`, `/w/{KEY}/ringkasan`, `/w/{KEY}/proyek` (atribut), update/minta update/arahan/keputusan, milestone & risiko.
6. Frontend: `pages/projects/portfolio.tsx` (+ `features/portfolio/*` desktop/mobile), `pages/workspaces/summary.tsx` (+ `features/projects/*`), seksi "Proyek" di Pengaturan workspace, tab "Ringkasan" untuk workspace proyek, entri navigasi "Portofolio" (direksi/super_admin).
7. Seeder `ProjectSeeder` (satu baris di `DatabaseSeeder`): 6 proyek aktif (RKR, PLQ, ANG, KTR, AUD, MSG) + 2 selesai, milestone, update mingguan, risiko, arahan, snapshot harian ±6 bulan.

## Akses

| Aksi | Siapa |
|---|---|
| Lihat proyek / Ringkasan | `WorkspacePolicy::view` (Direksi & Super Admin semua; Kadiv proyek yang melibatkan divisinya — anggota atau divisi utama; anggota proyeknya; internal = semua karyawan) |
| `/portofolio` | izin `portfolio.view` (Direksi, Super Admin) atau peran Kepala Divisi (hanya proyek divisinya) |
| Atribut proyek | yang boleh mengelola pengaturan workspace (owner/admin workspace, Super Admin) |
| Tulis update, ubah milestone & risiko | PIC (`lead_user_id`) atau admin/owner workspace (dan Super Admin) — workspace tidak diarsipkan |
| Minta update, beri arahan, tandai keputusan selesai | izin `portfolio.view` + boleh melihat proyek |

## Test wajib

Rumus aktual (batas 0–100%, bobot estimasi ≥ 80%), rencana (clamp, target ≤ mulai), penanda tepat pada −15 poin / milestone terlewat / update > 7 hari; hanya PIC/admin menulis update (matriks peran); Direksi melihat semua, Kadiv hanya divisinya; snapshot idempoten; pengingat Jumat (sekali per minggu, dilewati bila sudah update); notifikasi minta update/arahan/keputusan.

## Risiko

- Bentrok merge dengan bagian A di `navigation.ts`, `routes/console.php`, `NotificationType`, `DatabaseSeeder`, `docs/DATABASE.md` → perubahan minimal & berupa penambahan baris.
- Tabel `comments` milik Sprint 6 belum ada → arahan memakai tabel sendiri `project_directions`.
