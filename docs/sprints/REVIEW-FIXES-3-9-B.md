# Sprint 3–9 — Perbaikan hasil code review (bagian B: absensi, dashboard, proyek)

Cabang `fix/review-3-9-absensi`. Satu commit per temuan (`fix(<area>): ...`). Setiap temuan diverifikasi dulu di kode, lalu diberi test regresi yang **gagal sebelum perbaikan** (dicek dengan menjalankan test baru terhadap kode lama, mis. lewat `git stash` kode aplikasi) dan hijau sesudahnya. `main` di-merge di akhir; seluruh pemeriksaan hijau setelah merge.

Koordinasi dengan pekerjaan paralel:
- Agen keamanan/notifikasi: tidak menyentuh notifikasi selain `QuietHours.php` (#27; test di file baru), workspace/tugas, Drive, `DashboardSheet.php`, `PayrollRecapExport.php`.
- Sprint 10B (`feat/sprint-10-privasi`): penjaga setengah-hari/dinas di `CorrectAttendance` dan penghitungan "hadir" di dashboard Sprint 9 **tidak** diduplikasi. Perubahan di `CorrectAttendance` (#14) hanya pada penjangkaran jam (`at()` dan dua baris pemanggilnya), terpisah dari hunk 10B.

| # | Tingkat | Commit |
|---|---|---|
| 6 | Medium | `4faa6b1` fix(analytics): exclude archived workspaces from dashboard metrics |
| 10 | Medium | `7579e60` fix(attendance): sign out a stale kiosk without rotating the new pairing's remember token |
| 11 | Medium | `c45ae91` fix(attendance): count recap and payroll days only within the employment period |
| 12 | Medium | `c13c0e8` fix(attendance): count half-day leave as half a day in the monthly recap |
| 13 | Medium | `9191a71` fix(attendance): list missing check-outs only after the check-out window closed |
| 14 | Medium | `ca38bad` fix(attendance): anchor manual night-shift corrections after midnight to the next day |
| 15 | Medium | `b176fd6` fix(attendance): flag QR scans without GPS and allow requiring GPS for QR |
| 24 | Low | `d79c2be` fix(projects): keep projects starting on the last day of the portfolio period |
| 25 | Low | `a6fceb2` fix(analytics): use the project module stale-update rule on the division dashboard |
| 26 | Low | `0280bfd` fix(projects): fix the burn-up snapshot date when the job is dispatched |
| 27 | Low | `cdda353` fix(notifications): treat holidays as quiet days for delayed email |
| 28 | Low | `624d463` fix(analytics): serve "Fokus hari ini" and "Minggu ini" live instead of cached |
| 21b | Low | `f2edd68` fix(attendance): keep only the first concurrent review of a flagged log |

Migrasi baru (bisa di-rollback, diuji `migrate:rollback` + `migrate`): `2026_10_07_300100_add_deactivated_at_to_users`. `docs/DATABASE.md` diperbarui (kolom `users.deactivated_at`, flag `qr_no_location`).

---

## 6. Workspace terarsip ikut dihitung di metrik dashboard (Medium)

**Temuan.** `MetricScope::visibleTasks()` memakai semua workspace yang terlihat, termasuk yang diarsipkan; tugas lama terarsip ikut ke tingkat penyelesaian, tugas terlambat, dan beban kerja.

**Perbaikan.** `->notArchived()` pada subquery workspace. Semua metrik (CompletionRate, OnTimeRate, OverdueTasks, Workload, LeadTime) lewat jalur ini.

**Test.** `MetricDefinitionsTest` "ignores tasks in archived workspaces": tugas selesai/terlambat di workspace terarsip tidak mengubah penyebut, jumlah terlambat, maupun beban kerja.

## 10. Kiosk lama logout merusak cookie perangkat baru (Medium)

**Temuan.** `RestrictKioskDevice` memanggil `logout()` untuk sesi kiosk yang sudah dipasangkan ulang. `SessionGuard::logout()` merotasi `remember_token`, sehingga cookie "ingat saya" perangkat yang **baru** dipasangkan langsung tidak berlaku; saat sesinya habis, kiosk baru ikut keluar.

**Perbaikan.** `logoutCurrentDevice()` (hanya membersihkan sesi & cookie browser ini, tanpa merotasi token).

**Test.** `KioskTest` "signing out the previous device keeps the new pairing's remember cookie valid": perangkat lama (dimuat dari sesi, seperti produksi) logout → `remember_token` tetap milik pemasangan baru → setelah sesi kiosk baru kedaluwarsa, cookie remember-nya masih membuka halaman kiosk.

## 11. Rekap bulanan/payroll mengabaikan status & tanggal bergabung (Medium)

**Temuan.** `MonthlyRecap` menghitung seluruh hari kerja bulan itu untuk semua karyawan: karyawan baru tampak "belum ada catatan" sejak tanggal 1, karyawan nonaktif/resign tetap muncul dengan hari kerja penuh (dan ikut ekspor payroll).

**Keputusan.** Tanggal nonaktif tidak bisa diandalkan dari `updated_at`, maka ditambah kolom **`users.deactivated_at`** (timestamptz null): diisi `DeactivateEmployee` (nilai pertama dipertahankan saat pindah inactive ↔ resign), dikosongkan `ReactivateEmployee`. Migrasi mengisi baris lama dari audit `user.deactivated` terakhir, fallback `updated_at`; kode juga fallback ke `updated_at` bila masih null.

**Perbaikan.** Hanya tanggal `joined_at` … tanggal kantor `deactivated_at` (inklusif) yang dihitung. Tanggal di luar masa kerja tampil sebagai sel "Tidak terjadwal" (`off`) dan tidak masuk hari kerja/libur maupun angka lain. Karyawan tanpa hari terhitung di bulan itu tidak masuk laporan (berlaku juga untuk ekspor Excel/PDF karena memakai `MonthlyRecap::report`).

**Test.** `MonthlyRecapTest` "only dates of employment count": bergabung 16 Sep → 10 hari kerja; resign 10 Sep 16.00 → 8 hari kerja, alpha 14 Sep tidak dihitung; nonaktif sejak Agustus tidak muncul; aktivasi ulang mengosongkan `deactivated_at`.

## 12. Cuti setengah hari salah dihitung di rekap (Medium)

**Temuan.** `MonthlyRecap::tally` tidak membaca `request_portion`: cuti setengah hari yang disetujui **sebelum** check-in dihitung 1 hari cuti dan 0 hadir; yang disetujui **sesudah** check-in dihitung 1 hadir (terlambat) dan 0 cuti.

**Perbaikan.** Hari dengan `request_portion = half_day` → 0,5 hari cuti/izin (kategori dari status baris, atau dari pengajuan tertaut lewat relasi baru `AttendanceDay::employeeRequest`) + 0,5 hari hadir bila ada check-in. Terlambat/pulang cepat tidak dihitung pada hari itu (sama seperti `CheckIn`, yang tidak pernah menandai terlambat di hari pengajuan), sehingga urutan persetujuan/check-in tidak mengubah angka. `presentDays`, `leaveDays`, `permitDays` kini `float`; `EmployeeRecap::days()` mengirim bilangan bulat tetap sebagai integer (Excel/JSON tidak berubah untuk hari utuh), PDF pribadi menulis "1,5", tabel rekap & riwayat memakai `formatNumber`.

**Keputusan.** Hadir dihitung 0,5 (bukan 1) agar `hari kerja = hadir + cuti + …` tetap konsisten dan tingkat kehadiran tidak melebihi 100%. Setengah hari tanpa check-in hanya menurunkan tingkat kehadiran, tidak dijadikan "alpha 0,5" (tutup hari tidak mencatatnya). Penanganan setengah hari di `CorrectAttendance` dikerjakan Sprint 10B.

**Test.** `RequestDayCheckInTest` "counts a half-day leave as half a leave day…": tiga hari (disetujui lalu check-in, check-in terlambat lalu disetujui, tanpa check-in) → cuti 1,5, hadir 1,0, terlambat 0, kolom payroll 1,5 / 1.

## 13. "Lupa check-out kemarin" memuat pekerja shift malam yang masih bekerja (Medium)

**Temuan.** `TodayBoard::missingCheckOut` mengambil semua hari kemarin tanpa check-out, termasuk shift malam yang check-out-nya masih terbuka hingga pagi/siang ini.

**Perbaikan.** Hanya baris yang jendela check-out-nya sudah tutup: `OpenDayLocator::closesAt` (jadwal selesai + grace, sama dengan aturan check-out).

**Test.** `AttendanceBoardTest` "night-shift workers still inside their check-out window…": shift 22.00–06.00 tidak tampil pukul 09.15, tampil mulai 12.00; shift pagi kemarin tetap tampil.

**Catatan.** `HrDashboard::missingCheckOut` (Dashboard HR) punya pola query yang sama. Tidak diubah di sini karena Sprint 10B sedang mengubah method yang sama (signature + `can_correct`); lihat "Sisa pekerjaan".

## 14. Koreksi manual shift malam menaruh jam di tanggal yang salah (Medium)

**Temuan.** `CorrectAttendance` menaruh jam koreksi selalu di tanggal kerja. Untuk shift lintas tengah malam, check-in 00.20 atau check-in+check-out 00.20/06.00 jatuh di tanggal kerja (sebelum shift dimulai).

**Perbaikan.** `at()` menerima jadwal hari itu: untuk shift `crosses_midnight`, jam sebelum jendela check-in dibuka (mulai shift − `check_in_window_before_min`) diletakkan di hari berikutnya. Aturan lama "jam pulang ≤ jam masuk → hari berikutnya" tetap sebagai cadangan.

**Test.** `AttendanceCorrectionTest` "night shift: times before the check-in window opens…": 00.20/06.00 untuk shift 22.00–06.00 tanggal 2 Okt → 3 Okt (termasuk log manual); koreksi masuk 21.50 tetap di 2 Okt, tidak terlambat.

## 15. QR yang diteruskan tanpa GPS lolos tanpa tanda (Medium)

**Temuan.** `QrLocationVerifier` hanya menandai bila GPS dikirim dan jauh. Foto kode QR yang diteruskan ke orang di rumah, dipindai tanpa izin lokasi, tercatat bersih.

**Perbaikan.** Flag baru `LogFlag::QrNoLocation` (`qr_no_location`, label "QR tanpa lokasi GPS", menandai mencurigakan) bila scan tanpa lokasi. Opsi `attendance.qr.require_location` (env `ATTENDANCE_QR_REQUIRE_LOCATION`, **default false**): bila true scan tanpa GPS ditolak dengan alasan `qr_location_required` ("Lokasi GPS diperlukan", layar gagal menawarkan pindai ulang).

**Test.** `QrCheckInTest`: scan tanpa GPS diterima tetapi ditandai; scan dengan GPS dekat kiosk tidak ditandai; opsi wajib-GPS menolak lalu menerima scan ber-GPS.

## 24. Filter periode portofolio membuang proyek yang mulai di hari terakhir (Low)

**Temuan.** `PortfolioDashboard` membandingkan `start_date`/`target_date` (cast tanggal, UTC) dengan batas periode dalam zona kantor sebagai *instant*; proyek mulai 31 Des (atau selesai 1 Okt) jatuh di luar Q4.

**Perbaikan.** Bandingkan string tanggal (`Y-m-d`).

**Test.** `ProjectPagesTest` "keeps projects that start on the last day or end on the first day…".

## 25. Aturan "update kedaluwarsa" Dashboard Divisi berbeda dari modul proyek (Low)

**Temuan.** `DivisionDashboard::projectsAtRisk` memakai "lebih dari 7×24 jam" dan menganggap proyek baru tanpa update langsung kedaluwarsa, sedangkan `ProjectFlags` memakai > 7 hari kantor dan memberi proyek baru 7 hari.

**Perbaikan.** `ProjectMetrics::updateAge()` (dipakai juga oleh `compose()`) dan `ProjectMetrics::isStale()` → `ProjectFlags::evaluate`. Query SQL tetap sebagai pra-saring (superset), aturan akhir & badge `stale` dari `isStale`; batas 6 diterapkan setelah penyaringan. Kunci config `analytics.stale_update_days` dihapus (tidak dipakai lagi; satu sumber: `ProjectFlags::STALE_AFTER_DAYS`).

**Test.** `DivisionDashboardTest` "uses the project module rule for stale updates": 7 hari kantor → tidak tampil, proyek baru tanpa update → tidak tampil, 8 hari → tampil `stale`.

## 26. Tanggal snapshot burn-up diambil saat job dijalankan (Low)

**Temuan.** `TakeProjectProgressSnapshots` menghitung "hari ini" di `handle()`; antrean yang sibuk menjalankannya setelah tengah malam menulis titik untuk tanggal berikutnya.

**Perbaikan.** Tanggal ditetapkan di konstruktor (saat dispatch); jadwal memakai nama kelas (`Schedule::job(TakeProjectProgressSnapshots::class)`) sehingga job dibuat saat event berjalan pukul 23.55, bukan saat file jadwal dimuat.

**Test.** `ProjectJobsTest` "snapshots the office date of the dispatch…": dibuat 23.55 WIB, diserialisasi, dijalankan 00.20 → tanggal tetap 5 Okt.

## 27. Jam tenang mengabaikan hari libur (Low)

**Temuan.** `QuietHours` hanya mengenal hari dalam seminggu; email pada hari libur nasional terkirim pukul 10.00, dan penundaan malam sebelum libur jatuh di pagi hari libur.

**Perbaikan.** `QuietHours` menerima `WorkdayCalendar` (implementasi holiday-aware dari modul Absensi). Hari kerja = hari dalam `notifications.quiet_hours.workdays` **dan** bukan hari libur.

**Test.** `tests/Feature/Notifications/QuietHoursHolidayTest.php` (file baru agar tidak bentrok dengan agen notifikasi): libur 24–25 Des → sunyi, ditunda ke Senin 28 Des 07.00.

## 28. "Fokus hari ini" & "Minggu ini" ter-cache 5 menit (Low)

**Temuan.** Kedua blok ada di `metrics` (cache 5 menit), sehingga tugas yang baru ditugaskan tidak muncul.

**Perbaikan.** Pindah ke `live()` (tidak di-cache); tipe TS `PersonalLive` diperluas, tampilan desktop & mobile tidak lagi menunggu deferred props untuk kedua blok; ekspor dashboard membaca `live.focus`.

**Test.** `PersonalDashboardTest` "shows a task assigned a minute ago…" (cache dihangatkan dulu), test lama diperbarui ke `live.focus`/`live.week`.

## 21b. Balapan "Tandai ditinjau" (Low)

**Temuan.** `MarkLogReviewed` memeriksa `reviewed_at` pada model yang sudah dimuat; dua HR yang menekan bersamaan menimpa peninjau pertama dan menulis dua audit.

**Perbaikan.** Update bersyarat `WHERE reviewed_at IS NULL`; hanya bila ada baris yang berubah audit ditulis, selain itu model di-refresh (menampilkan peninjau pertama).

**Test.** `AttendanceBoardTest` "two HR reviewing the same log at once…": dua instance model basi → peninjau pertama tetap, satu baris audit.

---

## Cara mencoba manual (https://ruangkerja.test)

- **#11/#12** `hr@demo.test` › Absensi › Rekap: nonaktifkan karyawan di Admin › Karyawan, rekap bulan berjalan berhenti di tanggal itu; karyawan dengan `joined_at` di tengah bulan mulai dihitung dari tanggal tersebut. Cuti setengah hari tampil 0,5.
- **#15** Pindai QR kiosk dengan izin lokasi ditolak → log tampil di "Perlu ditinjau" dengan tanda "QR tanpa lokasi GPS". Set `ATTENDANCE_QR_REQUIRE_LOCATION=true` untuk menolak.
- **#28** `anggota@demo.test` › Dashboard: buat tugas bertenggat besok untuk diri sendiri, muat ulang — langsung muncul di "Fokus hari ini" & "Minggu ini".

## Sisa pekerjaan / risiko

- `HrDashboard::missingCheckOut` (Dashboard HR, widget "Lupa check-out kemarin") masih memakai query tanpa jendela check-out. Sengaja tidak diubah karena Sprint 10B mengubah method yang sama; setelah 10B di-merge, terapkan filter `OpenDayLocator::closesAt` yang sama (count + 6 item dihitung setelah filter).
- Hari di luar masa kerja memakai sel "Tidak terjadwal" (tanpa jenis sel baru) agar UI tidak berubah.
- PDF rekap perusahaan sudah menulis pecahan sebagai "1,5" (view memformat float); tidak ada perubahan di `PayrollRecapExport.php` (milik agen lain).

---

## Sisa akhir (branch `fix/sisa-akhir`)

Tiga sisa dari review 3-9 ditutup; tiap perbaikan satu commit dengan test regresi yang gagal sebelum perbaikan.

1. **"Lupa check-out kemarin" di Dashboard HR memuat shift malam yang masih berjalan.** `HrDashboard::missingCheckOut` kini memakai filter yang sama dengan papan Absensi (`OpenDayLocator::closesAt`: jadwal selesai + masa tenggang harus sudah lewat). Jumlah dan 6 item teratas dihitung **setelah** filter (konstanta `MISSING_CHECK_OUT_LIMIT`), sehingga ekspor dashboard ikut benar. Test: `HrDashboardTest` "does not list night-shift workers still inside their check-out window…" (shift 22.00–06.00, pukul 01.00 WIB: hanya Sari; pukul 12.00: Sari + Rudi).
2. **Kanal siaran absensi per perusahaan.** `company.attendance` diganti `company.{company}.attendance`. `AttendanceRecorded` menyiarkan ke kanal perusahaan karyawan (`AttendanceRecorded::companyChannel()`) + kanal divisi & divisi induk seperti sebelumnya. Otorisasi kanal: perusahaan penonton = perusahaan kanal **dan** `AttendanceDayPolicy::viewCompanyFeed`. Batasan "hanya satu perusahaan di instalasi" dihapus. Dashboard HR/Divisi menerima nama kanal baru dari server; papan Absensi hari ini menyusun nama kanal dengan id perusahaan dari prop bersama `auth.user.company` (helper `attendanceChannelNames` di `resources/js/lib/attendance.ts`, tanpa id perusahaan → tidak berlangganan kanal perusahaan). Test: `CompanyAttendanceChannelTest` (HR perusahaan sama diizinkan meski ada beberapa perusahaan; HR/Super Admin perusahaan lain ditolak; Anggota/Kadiv ditolak), `AttendanceBroadcastTest` (daftar `broadcastOn`), `HrDashboardTest`/`DivisionDashboardTest` (prop `channels`), Vitest `attendance.test.ts`.
3. **Pesan 429 saat mulai unggah.** Rate limiter `drive-uploads` kini membalas JSON 429 `{"message": "Terlalu banyak unggahan. Coba lagi sebentar lagi.", "code": "drive_upload_throttled"}` beserta header `Retry-After`; klien unggah menampilkan `message` apa adanya, jadi tidak lagi muncul "Too Many Attempts.". Keputusan: diperbaiki di server (berlaku untuk semua klien dan kedua rute mulai unggah: file workspace & lampiran), bukan di klien. Unggah potongan (`throttle:600,1`) tetap dicoba ulang otomatis oleh klien. Test: `DriveUploadQuotaTest` "explains a throttled upload start in Indonesian".

**Cara mencoba manual.** (1) `hr@demo.test` › Dashboard HR, karyawan shift malam yang check-in kemarin 22.00 tidak tampil di "Lupa check-out kemarin" sebelum pukul 06.00 + tenggang. (2) Buka Absensi › Hari ini sebagai HR, lakukan check-in dari akun lain: papan diperbarui langsung (DevTools › WS: langganan `private-company.<id>.attendance`). (3) Set `GOOGLE_UPLOAD_STARTS_PER_MINUTE` rendah lalu unggah beberapa file sekaligus: toast "Terlalu banyak unggahan. Coba lagi sebentar lagi.".

**Status.** `rk_test` 1876 lulus, `composer lint` (Pint + Larastan level 8) lulus, `npm run typecheck` & `npm run lint` lulus, `npm test` 269 lulus.
