# Sprint 9 bagian A — Ringkasan: metrik & dashboard (Saya, Kepala Divisi, HR)

Cabang `feat/sprint-9-dashboard`. Rencana: `PLAN.md`. Bagian B (proyek & portofolio, Dashboard Direksi di `/portofolio`) dikerjakan di `feat/sprint-9-portofolio`; di sini pemilih tampilan hanya menaut ke `/portofolio` untuk Direksi/Super Admin.

## Acceptance criteria (PROMPTS.md Sprint 9, tugas 1–7)

| # | Kriteria | Status | Bukti |
|---|---|---|---|
| 1 | `MetricDefinitions` satu kelas per metrik + unit test data sintetis | ✓ | `CompletionRate`, `OnTimeRate`, `OverdueTasks`, `Workload`, `LeadTimeMedian`, `AttendanceDiscipline`, `AverageLateness` (+ `MetricCatalog`); `MetricDefinitionsTest` (19 tugas & 11 hari absensi sintetis, tiap angka dijelaskan) |
| 2 | DashboardQueries ber-cakupan peran, cache 5 menit | ✓ | `Queries/{PersonalDashboard,DivisionDashboard,HrDashboard}`; orang via `User::visibleTo()`, tugas via `Workspace::visibleTo()`; `Services/MetricCache` kunci per penonton + cakupan + filter + tanggal |
| 3 | Dashboard Saya, Kepala Divisi, HR + pemilih tampilan multi-peran | ✓ | `/dashboard`, `/dashboard/saya`, `/dashboard/divisi`, `/dashboard/hr`; "Direksi ↗ `/portofolio`" untuk pemegang `portfolio.view` |
| 4 | StatCard, tren 8 minggu (Recharts), beban kerja, tugas terlambat, kehadiran hari ini, proyek berisiko | ✓ | `resources/js/features/dashboard/*` |
| 5 | Filter periode/divisi/tim di URL | ✓ | `?periode=minggu|bulan|kuartal|kustom&dari=&sampai=&divisi=&tim=` |
| 6 | Ekspor Excel | ✓ | `GET /dashboard/{view}/ekspor` (multi-sheet, audit `dashboard.exported`, throttle 20/menit) |
| 7 | Tanpa skor gabungan; tooltip definisi | ✓ | prop `definitions`, ikon (i) di setiap metrik; test memastikan tidak ada metrik "score" |
| AC | Kadiv hanya melihat divisinya | ✓ | `DivisionDashboardTest`, `DashboardAccessTest` (divisi/tim lain → 403, termasuk ekspor) |
| AC | Angka = rumus pada data uji; delta periode lalu benar | ✓ | `PersonalDashboardTest`, `DivisionDashboardTest`, `HrDashboardTest`, `PeriodTest` |
| AC | Cache tanpa kebocoran antarpengguna | ✓ | `DashboardCacheTest` |
| AC | < 1 detik dengan 50 karyawan × 6 bulan | ✓ | lihat Pengukuran |

## Layar

- **Dashboard Saya** (`DashboardSaya` / `MBeranda`): kartu absensi, 4 KPI, Fokus hari ini, Minggu ini, Pengajuan saya, kehadiran periode.
- **Dashboard Kepala Divisi** (`Main` / `MDashboardKadiv`): KPI utama & sekunder, tren 8 minggu, kehadiran hari ini (donut + daftar, realtime via `AttendanceRecorded` dengan fallback polling 60 dtk), beban kerja, tugas terlambat, persetujuan menunggu, proyek berisiko.
- **Dashboard HR** (`DashboardHR` / `MDashboardHR`): ringkasan hari ini, tabel per divisi, perlu ditinjau, pengajuan menunggu HR, lupa check-out kemarin, rekap periode.

Semua layar: skeleton (deferred props), empty state, terang & gelap, tablet 2 kolom.

## Cara uji manual (`php artisan migrate:fresh --seed`)

`AnalyticsDemoSeeder` (lokal saja) menambah karyawan sampai 50, ±6 bulan absensi, ±3.900 tugas.

1. **anggota@demo.test**: tampilan Saya; ganti periode; (i) definisi; Ekspor; `/dashboard/divisi` → 403.
2. **kadiv@demo.test**: tampilan Kepala Divisi (Operasional); filter "Tim Gudang"; `?divisi=<lain>` → 403.
3. **hr@demo.test**: tampilan HR; pemilih Saya · Kepala Divisi · HR.
4. **direksi@demo.test**: pemilih berisi Direksi ↗ `/portofolio`.

## Pengukuran kinerja

50 karyawan, 6.110 hari absensi, 3.867 tugas; median 3 kali, cache kosong:

| Akun / tampilan | Halaman | Metrik deferred (cache kosong) | Dari cache |
|---|---|---|---|
| anggota · Saya | 35 ms | 40 ms | 10 ms |
| kadiv · Divisi | 42 ms | 96 ms | 15 ms |
| direksi · Divisi semua, kuartal | 49 ms | 72 ms | 18 ms |
| hr · HR | 58 ms | 20 ms | 11 ms |

Di peramban: dashboard lengkap tampil < 0,3 dtk.

## Keputusan

1. Tanpa tabel baru; kode di `app/Domain/Analytics/*`, controller `Dashboard\DashboardController`, rute `routes/dashboard.php` (nama rute `dashboard` tetap).
2. Otorisasi lewat Gate `viewDashboard` (`DashboardAccess`): Saya = semua karyawan aktif; Kepala Divisi = pemimpin divisi atau `dashboard.view_company`; HR = `dashboard.view_company` + `attendance.view_all`.
3. Tampilan bawaan: HR → HR; Kadiv → Divisi; lainnya (termasuk Direksi) → Saya.
4. Rumus (lihat DATABASE §10): canceled tidak dihitung; ketepatan waktu dibandingkan dalam tanggal kantor; tugas terlambat = belum selesai dan tenggat < hari ini; beban kerja per penanggung jawab; lead time median; kedisiplinan dibatasi hari bershift; rata-rata terlambat per hari terlambat. Tugas workspace pribadi hanya di Dashboard Saya.
5. Periode berjalan dihitung sampai hari ini; delta membandingkan jumlah hari yang sama pada periode sebelumnya.
6. Kehadiran hari ini dihitung dari `attendance_days` + `ScheduleSnapshot` (versi massal `ScheduleResolver`).
7. Cache per penonton (bukan per peran) agar tidak bocor antar-Kadiv; blok langsung tidak di-cache.
8. Filter rusak kembali ke bawaan; kustom maks 366 hari; divisi/tim di luar cakupan → 403.
9. Proyek berisiko: `health` at_risk/off_track atau aktif tanpa update > 7 hari.

## Paket baru

- `recharts` ^3.10: grafik tren & donut, warna lewat token CSS.

## Test

Pest 68 test baru di `tests/Feature/Analytics`; Vitest `features/dashboard/lib.test.ts`. Seluruh repo: 1388 Pest, 203 Vitest, lint & typecheck bersih.

## Sisa / risiko

- Once-prop `attendanceStatus` (Sprint 2) bisa terbawa `null` dari halaman login tamu sampai 5 menit; Dashboard Saya menambalnya dengan reload parsial — sebaiknya diperbaiki di sumbernya.
- Tombol "Tandai ditinjau" & "Koreksi" di Dashboard HR menunggu integrasi dengan Sprint 3.
- Tren penyelesaian memakai kategori tugas saat ini (sesuai rumus PRD).
- Ekspor berisi apa yang tampil, bukan seluruh data mentah.
