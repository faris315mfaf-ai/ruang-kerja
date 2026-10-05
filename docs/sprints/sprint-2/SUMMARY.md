# Sprint 2 — Ringkasan: Absensi inti (jadwal, check-in GPS + selfie, tutup hari)

Cabang `feat/sprint-2-absensi`. Dibangun di atas Sprint 1 core dan Sprint 8 (notifikasi) yang sudah ada di `main`.

## Acceptance criteria (docs/PROMPTS.md Sprint 2)

| Kriteria | Status | Bukti |
|---|---|---|
| Migrasi + model 7 tabel §2, enum `AttendanceStatus`, `AttendanceMethod`, `LogFlag` berlabel Indonesia | ✓ | `database/migrations/2026_10_05_1001*`–`1007*`, `app/Domain/Attendance/{Models,Enums}` (+ `AttendanceLogType`, `HolidayType`, `ConsentType`, `AttendanceRejection`). Rollback diuji. |
| Admin HR: lokasi dengan peta Leaflet + OSM (titik & radius) | ✓ | `/admin/absensi` (mockup LokasiShift): seret pin/klik peta, slider radius 50–500 m, aktif/nonaktif |
| CRUD shift | ✓ | Tabel shift + dialog; lintas tengah malam otomatis; shift yang masih dipakai tidak bisa dihapus |
| Penugasan shift: pola mingguan + override tanggal, massal per divisi | ✓ | `/admin/absensi/penugasan`: pilih karyawan atau satu divisi (termasuk sub-divisi), hari kerja, periode, mode kerja; jadwal khusus per tanggal (shift lain / libur / WFH) |
| Hari libur CRUD + impor CSV | ✓ | Koma/titik koma, header opsional, `YYYY-MM-DD` atau `DD/MM/YYYY`, jenis Indonesia; semua-atau-tidak dengan galat per nomor baris |
| `ScheduleResolver` (work_date, shift, jadwal, lintas tengah malam, libur) + unit test lengkap | ✓ | 19 test `ScheduleResolverTest` |
| Layar persetujuan (lokasi & selfie) sebelum check-in pertama, versi dari config; tanpa persetujuan ditolak | ✓ | Mockup CheckinConsent, `ATTENDANCE_CONSENT_VERSION`, halaman `/absensi/kebijakan-data`, cabut persetujuan |
| Halaman Absensi prioritas ponsel: jam mono besar, jadwal, status, tombol 44px+ | ✓ | Mockup Absensi (mobile) + versi desktop 2 kolom |
| Dialog check-in: lokasi (enableHighAccuracy, 15 dtk) + kamera depan, pratinjau, JPEG ≤ 300 KB di klien | ✓ | `hooks/use-geolocation.ts`, `hooks/use-camera.ts`, `lib/image.ts`; cadangan `<input capture="user">` bila kamera ditolak |
| Riwayat 30 hari dengan badge status | ✓ | Daftar 56px (mobile), tabel (desktop), deferred prop + skeleton |
| CheckIn/CheckOut: haversine, aturan per work_mode, FraudDetector menandai tanpa memblokir, selfie di disk privat | ✓ | `app/Domain/Attendance/{Actions,Services}`; disk `selfies` (local di dev, `ATTENDANCE_SELFIE_DRIVER=s3` di prod) |
| Pesan galat informatif | ✓ | "Anda berada 340 m dari Kantor Pusat (batas 100 m). Ajukan dinas luar jika sedang bertugas di luar." + layar CheckinGagal dengan peta & jarak |
| `attendance:close-day` 00:30 Asia/Jakarta, idempoten (alpha, perlu koreksi) | ✓ | `routes/console.php`, `CloseAttendanceDay` |
| Pengingat 15 menit setelah jam masuk (job per 5 menit), notifikasi database | ✓ | `SendCheckInReminders` + `CheckInReminderNotification` (memakai `BaseNotification` Sprint 8) |
| Broadcast `AttendanceRecorded` ke `company.attendance` & `division.{id}.attendance`, otorisasi via policy | ✓ | `routes/channels.php` → `AttendanceDayPolicy::viewCompanyFeed/viewDivisionFeed` |
| Test: tepat waktu, terlambat, pulang cepat, shift malam, libur, luar radius, check-in ganda, check-out tanpa check-in, close-day idempoten | ✓ | `tests/Feature/Attendance/{CheckInTest,CheckOutTest,CloseAttendanceDayTest}.php` dengan `travelTo` |
| Selfie tidak bisa diakses tanpa URL bertanda tangan | ✓ | `SelfieAccessTest` |

Jumlah test: **1008 Pest** (187 modul absensi/policy), **146 Vitest**. `composer lint`, `npm run typecheck`, `npm run lint` hijau.

## Cara uji manual

Jalankan `php artisan migrate:fresh --seed` (AttendanceSeeder: Kantor Pusat & Gudang Cikarang, shift Reguler/Gudang Pagi/Gudang Malam, pola semua karyawan kecuali Direksi & admin, libur nasional 2026–2027, riwayat 30 hari; hari ini dikosongkan).

1. **anggota@demo.test (Rizky)** di ponsel/DevTools 390 px → tab **Absen** → "Ambil selfie & check-in" → layar persetujuan → centang → kamera → ambil → "Kirim check-in" → layar berhasil. Untuk mencoba gagal, ubah lokasi di DevTools › Sensors (> 100 m dari -6.2, 106.816666).
2. Setelah check-in: sidebar "Sudah check-in", tombol topbar berubah jadi **Check-out**.
3. WFH: sebagai **hr@demo.test** beri Rizky jadwal khusus hari ini dengan mode WFH di Penugasan, lalu check-in dari luar radius → wajib catatan, status WFH.
4. **hr@demo.test (Hana)** desktop → Admin › **Lokasi & shift**: ubah titik/radius, tambah shift malam, impor CSV hari libur, **Atur penugasan**.
5. Tutup hari: `php artisan attendance:close-day` (atau `--date=2026-10-05`); jalankan dua kali → hasil sama.

Contoh CSV: `tanggal;nama;jenis` / `2026-12-24;Cuti bersama Natal;cuti bersama` / `25/12/2026;Hari Raya Natal;nasional`.

## Keputusan

1. Model di `app/Domain/Attendance/Models`, factory via `#[UseFactory]`, policy di `app/Policies`.
2. Resolusi jadwal: override tanggal → libur perusahaan → pola mingguan (valid_from terbaru menang) → tidak terjadwal. Hari WFH hybrid = `work_mode_override = wfh`.
3. Shift lintas tengah malam milik tanggal mulai; check-out diterima sampai jadwal pulang + 6 jam. Tutup hari memproses kemarin dan lusa kemarin.
4. Terlambat dihitung dari batas toleransi, menit utuh. Pulang cepat simetris.
5. Hari libur / tidak terjadwal: check-in tetap dicatat; tutup hari menulis status `holiday`.
6. Geofence: lokasi aktif perusahaan, atau lokasi shift bila `shifts.office_location_id` diisi. Di luar radius: office/hybrid ditolak; wfh/field/hari WFH diterima `method = wfh` dengan catatan wajib.
7. Check-out memakai aturan geofence & selfie yang sama; check-out kedua ditolak.
8. Fraud: `new_ip` dicatat tanpa `is_suspicious`; tambahan `dark_selfie` (luminansi & kontras via GD).
9. Selfie: rute `signed` (5 menit) + policy `viewSelfie` (pemilik, HR, atasan langsung). Akses orang lain dicatat `selfie.viewed`.
10. Check-in/out = endpoint JSON multipart; halaman lain Inertia.
11. Status shell = shared once-prop `attendanceStatus` (TTL 5 menit), di-reload setelah check-in/out.
12. Notifikasi memakai `BaseNotification` Sprint 8; Absensi mengikat `WorkdayCalendar` sehingga ringkasan harian tidak dikirim pada hari libur.
13. `holidays` tanpa soft delete; `office_locations` & `shifts` soft delete; `attendance_logs` immutable.
14. `resources/css/app.css`: variabel shadcn juga didefinisikan pada `.dark` agar subtree gelap benar.
15. Admin lokasi/shift/libur & penugasan hanya desktop (`DesktopOnlyNotice` di ponsel).
16. "Pindai QR" nonaktif (Sprint 3); "Ajukan dinas luar/koreksi" menaut ke `/pengajuan` (Sprint 4).

## Paket baru

- `leaflet` 1.9, `react-leaflet` 5, `@types/leaflet` (dev): peta OpenStreetMap, dimuat lazy.
- Driver S3 untuk selfie (`league/flysystem-aws-s3-v3`) dipasang saat deploy (Sprint 10).

## Sisa pekerjaan

- CSP produksi harus mengizinkan `https://tile.openstreetmap.org` (img-src) dan `Permissions-Policy: geolocation=(self), camera=(self)`.
- Status cuti/izin/sakit/dinas dan `request_id` ditulis Sprint 4.
- Retensi selfie, tinjauan HR, koreksi manual, rekap/ekspor = Sprint 3.
- Halaman `/privasi` masih placeholder; pencabutan persetujuan sudah bisa dari halaman Absensi.
- Saldo cuti di kartu Absensi menunggu Sprint 4.
