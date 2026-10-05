# Sprint 9 bagian A — Rencana: metrik & dashboard (Saya, Kepala Divisi, HR)

Cabang `feat/sprint-9-dashboard`. Bagian B (proyek, portofolio, Dashboard Direksi `/portofolio`) dikerjakan paralel di `feat/sprint-9-portofolio`; di sini pemilih tampilan hanya **menaut** ke `/portofolio` (peran direksi/super_admin).

## Sumber data

| Data | Tabel | Catatan |
|---|---|---|
| Tugas | `tasks` (+ `task_assignees`) | metrik memakai `status_category`, `due_date`, `completed_at`, `created_at`; atribusi ke orang lewat penanggung jawab |
| Absensi | `attendance_days`, `attendance_logs`, `shift_assignments`, `holidays`, `shifts` | dihitung langsung (tidak bergantung pada rekap Sprint 3) |
| Pengajuan | `requests`, `request_approvals`, `leave_balances` | presenter Sprint 4 dipakai ulang |
| Proyek berisiko | `workspaces` (`health`, `last_update_at`, `project_status`) | kolom sudah ada sejak Sprint 5 |

## Backend

- `app/Domain/Analytics/Data/{Period, MetricScope, MetricValue, DashboardFilters}`.
- `app/Domain/Analytics/MetricDefinitions/*` — satu kelas per metrik, antarmuka `MetricDefinition` (`key()`, `label()`, `definition()` untuk tooltip, `unit()`):
  `CompletionRate`, `OnTimeRate`, `OverdueTasks`, `Workload`, `LeadTimeMedian`, `AttendanceDiscipline`, `AverageLateness`.
- `app/Domain/Analytics/Services/{DashboardAccess, TodayAttendance, MetricCache}`; `app/Domain/Analytics/Queries/{PersonalDashboard, DivisionDashboard, HrDashboard}` (= DashboardQueries per tampilan).
- Cache: `Cache::remember` 5 menit, kunci `analytics:v1:{view}:{viewer_id}:{hash(filter + cakupan)}` — per pengguna sehingga tidak ada kebocoran antarpengguna. Bagian "langsung" (absensi hari ini, antrean persetujuan, status saya) tidak di-cache.
- Otorisasi: `Gate::define('dashboard.view', fn ($user, DashboardView $view))` di `AnalyticsServiceProvider`, memakai `DashboardAccess`.
- Rute `routes/dashboard.php`: `/dashboard` (tampilan bawaan), `/dashboard/saya`, `/dashboard/divisi`, `/dashboard/hr`, `/dashboard/{view}/ekspor` (Excel, maatwebsite/excel, multi-sheet, dicatat `dashboard.exported`).
- Seeder `AnalyticsDemoSeeder` (hanya lokal): tambah karyawan sampai ±50, riwayat absensi & tugas 6 bulan.

## Frontend

- `pages/dashboard/{personal,division,hr}.tsx` → `features/dashboard/*.{desktop,mobile}.tsx`.
- Komponen: `StatCard` (tnum + delta), `MetricInfo` (tooltip definisi), `TrendChart` (Recharts, 8 minggu), `WorkloadBars`, `OverdueTaskList`, `TodayAttendanceDonut` + daftar, `AtRiskProjects`, `DashboardFilters` (periode/divisi/tim di URL), `ViewPicker`.
- Paket baru: `recharts` (grafik tren; diminta PROMPTS Sprint 9).

## Test

- Unit/fitur per metrik dengan data sintetis yang dihitung manual (termasuk batas periode, zona waktu kantor, canceled, subtugas, pembagi nol).
- Cakupan: Kadiv hanya divisinya (filter divisi lain ditolak), anggota tidak bisa membuka divisi/HR, Direksi/HR semua.
- Delta periode lalu, rentang periode (minggu/bulan/kuartal/kustom).
- Cache: kunci per pengguna, tidak bocor antar-Kadiv; TTL 5 menit.
- Ekspor: unduhan xlsx + otorisasi.
- Performa: seeder 50 × 6 bulan, ukur waktu query & respons.

## Risiko / keputusan awal

- PRD "semua task bertenggat": task `canceled` dikeluarkan dari penyebut (bukan pekerjaan yang harus selesai); dicantumkan di tooltip.
- Kedisiplinan hadir mengikuti query acuan DATABASE §10 (`present`/`wfh` ÷ hari bershift non-libur/cuti/izin/sakit/dinas).
- Tanggal selesai dibandingkan dengan tenggat dalam zona waktu kantor.
- Tugas di workspace pribadi hanya dihitung di Dashboard Saya.
