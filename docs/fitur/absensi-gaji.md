# Absen pegawai & gaji harian

> Keputusan pemilik 20 Okt 2026. Backend: `app/Domain/Attendance/Actions/{SetAttendanceStatus,ClearAttendanceDay}.php`, `app/Domain/Attendance/Queries/AttendanceGrid.php`, `app/Domain/Payroll/*`. Skema: `docs/DATABASE.md` §2 (`attendance_days.status_source`, `employee_wages`, `payroll_rules`, `payroll_periods`).

HR membuka Absensi dan melihat absensi **semua karyawan** satu bulan (kisi karyawan × tanggal), bisa menambah/menghapus catatan dan mengatur status secara manual, lalu halaman **Gaji** menghitung upah harian × hari dibayar per karyawan dengan aturan per perusahaan dan kunci periode. Bukan payroll penuh (tanpa pajak, BPJS, slip gaji).

## 1. Akses

| Halaman / aksi | Izin | Peran |
|---|---|---|
| Absensi › Pegawai (`/absensi/pegawai`), detail tanggal, atur status, hapus catatan | `attendance.manage` (`AttendanceDayPolicy::manageDays`, `setStatus`, `clear`) | Super Admin, HR |
| Atur status / hapus catatan **diri sendiri** | ditolak (403), sama dengan koreksi | — |
| Absensi › Gaji (`/absensi/gaji`), ekspor, riwayat upah | `payroll.view` (`PayrollPolicy::viewAny`, `viewWages`) | Super Admin, HR, Direksi (baca saja) |
| Upah harian, aturan gaji, kunci/buka periode | `payroll.manage` (`PayrollPolicy::manage`, `manageWages`, `delete`) | Super Admin, HR |

Karyawan/upah perusahaan lain selalu **404** (dicari di perusahaan penonton). Kepala Divisi dan staf: 403.

## 2. Status manual (Absensi › Pegawai)

- Status yang boleh diatur: Hadir, Terlambat, WFH, Dinas, Izin, Sakit, Cuti, Alpha, Libur (`SetAttendanceStatus::ALLOWED`). Alasan wajib (5–500 karakter).
- **Dengan jam** (hanya Hadir/Terlambat/WFH/Dinas): log `manual` ditulis seperti koreksi (`ManualAttendanceWriter`, bersama `CorrectAttendance`), menit dihitung ulang, lalu status pilihan HR yang berlaku. Hanya *Terlambat* menyimpan menit terlambat; menit pulang cepat selalu 0.
- **Tanpa jam / status lain**: hanya status. Log dan jam yang sudah ada tetap (log tidak bisa diubah); menit terlambat & pulang cepat jadi 0.
- Baris ditandai `status_source = manual` + `status_set_by` + `status_set_at`. **Tutup hari** (`attendance:close-day`) tidak menimpa, menghapus, atau mengubahnya menjadi *Perlu koreksi*. **Check-in/check-out karyawan sendiri**, **koreksi jam HR**, dan **pengajuan yang disetujui** mengosongkan tanda manual (data nyata menang). Status Izin/Sakit/Cuti/Dinas manual tidak dianggap "dari pengajuan" (check-in tetap bisa).
- Ditolak: tanggal dengan pengajuan sehari penuh ("… dari pengajuan yang disetujui. Ubah lewat pengajuan."), bulan gaji terkunci, tanggal mendatang selain Izin/Sakit/Cuti/Dinas/Libur ("Tanggal belum terjadi.").
- **Hapus catatan** (`ClearAttendanceDay`): hanya baris tanpa log check-in ("Hari ini punya catatan check-in, jadi tidak bisa dihapus. Ubah statusnya saja."), bukan dari pengajuan, bulan tidak terkunci.
- Audit: `attendance.status_set` (lama/baru: status, jam, menit, `status_source`; alasan, `employee_id`), `attendance.day_cleared` (lama + `work_date`, alasan, `employee_id`).

Kode sel kisi (`AttendanceGrid`): nilai status (`present`, `late`, `early_leave`, `absent`, `leave`, `permit`, `sick`, `business_trip`, `holiday`, `wfh`, `needs_correction`), `off` (tidak terjadwal / belum/tidak lagi bekerja), `future` (terjadwal, belum terjadi), `not_checked_in` (terjadwal hari ini, belum ada catatan), `none` (hari terjadwal yang sudah lewat tanpa catatan apa pun). "Hanya bermasalah" = ada Alpha, Perlu koreksi, `none`, `not_checked_in`, atau terlambat.

## 3. Gaji harian (Absensi › Gaji)

`PayrollCalculator::forMonth(viewer, bulan)` memakai orang dan hari dari Rekap bulanan (`MonthlyRecap`, sama dengan Absensi › Rekap):

| Hari | Dihitung sebagai |
|---|---|
| Hadir, Terlambat, Pulang cepat, WFH, Dinas | dibayar 1 hari (`present_days`) |
| Cuti / Sakit / Izin | dibayar bila aturan perusahaan membayarnya (`paid_leave_days`), selain itu tidak dibayar (`unpaid_days`) |
| Setengah hari cuti/izin | separuh mengikuti aturan, separuh lainnya dibayar bila check-in (tanpa check-in: tidak dibayar; hari ini: belum dihitung) |
| Alpha | tidak dibayar (`absent_days`) |
| Perlu koreksi, hari terjadwal tanpa catatan, hari ini sebelum check-in | **belum dihitung** (`pending_days`), tidak dibayar |
| Libur, tidak terjadwal, belum terjadi | tidak dihitung |

- Upah suatu tanggal = baris `employee_wages` dengan `effective_from` terbaru ≤ tanggal itu. Tanpa upah → hari itu Rp0 dan baris ditandai `missing_wage`. `wage_changed_in_period` bila lebih dari satu upah berlaku di bulan itu; `daily_wage` = upah yang berlaku hari ini (bulan berjalan) atau akhir bulan.
- Potongan = jumlah hari terlambat × `late_deduction`. Total = Σ (bagian dibayar × upah hari itu) − potongan, minimal 0.
- Aturan bawaan (tanpa baris `payroll_rules`): Cuti dibayar, Sakit dibayar, Izin tidak, potongan 0.
- **Kunci periode**: menyimpan laporan saat itu ke `payroll_periods.snapshot`; halaman dan ekspor menampilkan snapshot (aturan, upah, absensi yang berubah kemudian tidak menggeser angka). Selama terkunci, koreksi jam, status manual, hapus catatan, dan simpan/hapus upah bertanggal di bulan itu ditolak: "Periode gaji {Bulan YYYY} sudah dikunci. Buka kunci di Absensi › Gaji dulu." Bulan yang belum dimulai tidak bisa dikunci. Buka kunci menghapus snapshot.
- Audit: `payroll.wage_saved`, `payroll.wage_deleted`, `payroll.rules_saved`, `payroll.period_locked`, `payroll.period_unlocked`, `payroll.exported`.
- Ekspor Excel `gaji-harian-YYYY-MM.xlsx`: No. karyawan, Nama, Divisi, Jabatan, Upah harian, Hadir, Cuti/Sakit/Izin dibayar, Tidak dibayar, Alpha, Terlambat, Belum dihitung, Hari dibayar, Potongan, Total.

## 4. Rute

| Metode & path | Nama rute | Keterangan |
|---|---|---|
| GET `/absensi/pegawai?bulan=YYYY-MM&divisi=&q=&bermasalah=1` | `attendance.employees.index` | Inertia `attendance/employees` |
| GET `/absensi/pegawai/{karyawan}/{YYYY-MM-DD}` | `attendance.employees.show` | JSON detail tanggal (lembar samping) |
| PUT `/absensi/pegawai/{karyawan}/{YYYY-MM-DD}` | `attendance.employees.update` | `status`, `check_in`/`check_out` `HH:MM` opsional, `reason` |
| DELETE `/absensi/pegawai/{karyawan}/{YYYY-MM-DD}` | `attendance.employees.destroy` | `reason` |
| GET `/absensi/gaji?bulan=&divisi=&q=` | `attendance.payroll.index` | Inertia `attendance/payroll` |
| GET `/absensi/gaji/ekspor?bulan=&divisi=&q=` | `attendance.payroll.export` | Excel |
| PUT `/absensi/gaji/aturan` | `attendance.payroll.rules.update` | `pay_leave`, `pay_sick`, `pay_permit` (bool), `late_deduction` (int) |
| GET `/absensi/gaji/upah/{karyawan}` | `attendance.payroll.wages.index` | JSON riwayat upah (dialog) |
| PUT `/absensi/gaji/upah/{karyawan}` | `attendance.payroll.wages.update` | `daily_wage` 0–100.000.000, `effective_from` `YYYY-MM-DD`, `note` ≤ 255 |
| DELETE `/absensi/gaji/upah/{upah}` | `attendance.payroll.wages.destroy` | |
| POST / DELETE `/absensi/gaji/{YYYY-MM}/kunci` | `attendance.payroll.lock` / `.unlock` | |
| PUT / DELETE `/api/v1/absensi/hari/{karyawan}/{YYYY-MM-DD}` | `api.v1.hr.attendance.days.update` / `.destroy` | API ponsel HR: `{message, day}` (`AttendancePresenter::day`, `null` setelah dihapus); rekap API memuat `can.set_status` |

Aksi web mengembalikan redirect `back()` dengan toast (`Inertia::flash('toast')`); galat validasi per kolom (`work_date`, `status`, `check_in`, `check_out`, `reason`, `daily_wage`, `effective_from`, `month`).
