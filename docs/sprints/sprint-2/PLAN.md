# Sprint 2 — Rencana: Absensi inti

Acuan: `docs/PROMPTS.md` blok Sprint 2 (acceptance criteria), `docs/PRD.md` M2, `docs/DATABASE.md` §2, `docs/ARCHITECTURE.md` §3.1, §3.3, §4, §5, `docs/PLATFORM.md`, mockup `Absensi`, `CheckinConsent`, `CheckinSelfie`, `CheckinSukses`, `CheckinGagal`, `LokasiShift`, `MBeranda`, `DashboardSaya`.

## Urutan kerja

1. **Tanpa tabel organisasi** (Sprint 1 core belum selesai): config `attendance.php`, disk privat `selfies`, enum, `GeofenceService`, helper & hook frontend (geolokasi, kamera, kompres JPEG, jam server), komponen UI.
2. **Setelah merge `feat/sprint-1-core`**: migrasi & model, `ScheduleResolver`, `FraudDetector`, Action, controller, halaman, admin HR, command & job, broadcast, seeder.
3. Merge `main`, ringkasan.

## Backend

| Bagian | Berkas |
|---|---|
| Config | `config/attendance.php` (versi kebijakan, disk & TTL selfie, ambang fraud, jendela check-out, pengingat), disk `selfies` di `config/filesystems.php` (local di dev, `ATTENDANCE_SELFIE_DRIVER=s3` di prod) |
| Enum | `app/Domain/Attendance/Enums`: `AttendanceStatus`, `AttendanceMethod`, `LogFlag`, `AttendanceLogType`, `HolidayType`, `ConsentType`, `AttendanceRejection` (kode alasan penolakan + pesan) |
| Model | `app/Domain/Attendance/Models` (sesuai ARCHITECTURE §2, factory via `#[UseFactory]`): `OfficeLocation`, `Shift`, `ShiftAssignment`, `Holiday`, `AttendanceDay`, `AttendanceLog`, `AttendanceConsent` |
| Migrasi | 7 tabel §2 (tanpa `qr_tokens` = Sprint 3). `shift_assignments.weekdays` = `smallint[]` + cast. FK silang `attendance_days.check_in_log_id` ditambah setelah `attendance_logs` dibuat |
| Service | `ScheduleResolver` (work_date, shift, jadwal, libur, shift lintas tengah malam, mode kerja efektif), `GeofenceService` (haversine), `FraudDetector`, `SelfieStorage` |
| Action | `CheckIn`, `CheckOut`, `CloseAttendanceDay`, `GiveAttendanceConsent`, `RevokeAttendanceConsent`, `SaveOfficeLocation`, `SaveShift`, `AssignShiftPattern` (massal per karyawan/divisi), `SaveShiftOverride`, `SaveHoliday`, `ImportHolidays`, `DeleteX` |
| HTTP | `routes/attendance.php`; check-in/out = endpoint JSON multipart (hasil terstruktur untuk layar sukses/gagal, dipakai ulang API mobile Fase 3); halaman lain Inertia |
| Otorisasi | Policy per model; `AttendanceDay::visibleTo($user)` (diri, bawahan langsung, divisi untuk Kadiv, semua untuk HR/Direksi/Super Admin); rate limit check-in 6/menit/user |
| Realtime | `AttendanceRecorded` → `private-company.attendance` (HR, Direksi, Super Admin) & `private-division.{id}.attendance` (Kadiv divisi tsb.), otorisasi channel lewat policy |
| Terjadwal | `attendance:close-day` 00:30 Asia/Jakarta (idempoten), job `SendCheckInReminders` tiap 5 menit (15 menit setelah jam masuk) |
| Notifikasi | `CheckInReminder`, `MissingCheckOut` (database). Bila infrastruktur Sprint 8 belum ada: Notification Laravel biasa + TODO pindah ke `BaseNotification` |
| Seeder | `AttendanceSeeder` (lokasi, shift, penugasan, libur 2026, riwayat 30 hari untuk akun demo) |

### Aturan inti (keputusan)

- **Resolusi jadwal**: override tanggal → hari libur perusahaan → pola mingguan aktif (valid_from terbaru menang) → tidak terjadwal. Override boleh tanpa shift (= libur khusus) dan boleh mengubah mode kerja (`work_mode_override`, mis. hari WFH karyawan hybrid).
- **Shift lintas tengah malam**: `work_date` = tanggal mulai shift. Waktu sebelum `scheduled_end` shift kemarin tetap milik kemarin.
- **Terlambat** dihitung dari batas toleransi (mockup DashboardSaya: "dihitung dari batas toleransi 08.10"). Pulang cepat simetris.
- **Status**: `late` > `wfh`/`present`; check-out sebelum batas → `early_leave` hanya bila status masih `present`/`wfh`.
- **Geofence**: lokasi aktif perusahaan (atau lokasi shift bila diisi). Di luar radius: `office`/`hybrid` ditolak, `wfh`/`field`/hari WFH diterima sebagai method `wfh` dengan catatan wajib.
- **Hari libur / tidak terjadwal**: check-in tetap boleh (tanpa hitungan terlambat); tutup hari menulis `holiday` untuk yang polanya terjadwal.
- **Fraud** hanya menandai; `new_ip` dicatat tetapi sendirian tidak membuat `is_suspicious` (IP seluler berganti tiap hari).
- **Selfie**: disk privat, diakses lewat rute bertanda tangan 5 menit + policy; tidak ada URL publik.

## Frontend

| Layar | Desktop | Mobile |
|---|---|---|
| Absensi (`/absensi`) | 2 kolom: kartu check-in + peta, riwayat 30 hari (tabel) | Mockup `Absensi` |
| Persetujuan data | Dialog | Layar penuh `CheckinConsent` |
| Selfie | Dialog kamera | Layar penuh gelap `CheckinSelfie` |
| Hasil | Dialog sukses/gagal | `CheckinSukses`, `CheckinGagal` |
| Admin lokasi, shift, libur (`/admin/absensi`) | Mockup `LokasiShift` (Leaflet + OSM) | Banner "Fitur ini tersedia di desktop." |
| Shell | Status check-in di sidebar + tombol Check-in/Check-out di topbar (shared prop `attendanceStatus`, once + TTL) | Tab "Absen" → `/absensi` |

Hook/helper: `use-geolocation` (enableHighAccuracy, timeout 15 dtk), `use-camera` (kamera depan), `lib/image.ts` (JPEG ≤ 300 KB), `use-server-clock`, `lib/geo.ts`, `lib/attendance.ts`.

## Paket baru

- `leaflet`, `react-leaflet`, `@types/leaflet`: peta OSM untuk memilih titik & radius lokasi kantor (diminta prompt Sprint 2).

## Test

- Unit: `ScheduleResolver` (pola, override, libur, lintas tengah malam, valid_from/until), `GeofenceService`, `FraudDetector`, enum.
- Feature: semua acceptance criteria (tepat waktu, terlambat, pulang cepat, shift malam, libur, luar radius office/wfh/field/hybrid-WFH, check-in ganda, check-out tanpa check-in, close-day idempoten, selfie bertanda tangan, persetujuan wajib), policy matriks peran × aksi, admin CRUD, impor CSV, broadcast & channel auth, pengingat.
- Vitest: helper format/geo/attendance/image.

## Risiko

- Bergantung pada Sprint 1 core (companies, users.company_id/division_id/manager_id/work_mode/status, AuditLogger, izin). Dikerjakan setelah merge.
- Tabel `notifications` milik Sprint 8; bila belum ada di `main` saat akhir, ditambah migrasi bersyarat (`hasTable`).
- Ubin OSM butuh izin CSP `tile.openstreetmap.org` saat Sprint 10 mengetatkan CSP.
