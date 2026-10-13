# Bagian 5 — Laporan kerja saat absen pulang & jam absen perusahaan (kontrak W2)

Keputusan pemilik 13 Okt 2026: (1) saat **absen pulang** karyawan wajib menulis **laporan kerja** (pagi = *rencana kerja*, pulang = *laporan kerja*); (2) admin mengatur **jam absen** (absen masuk dari jam … sampai jam …, absen pulang dari jam … sampai jam …), satu pengaturan untuk seluruh perusahaan, berlaku juga bagi karyawan **tanpa shift**.

Backend + halaman admin web selesai (agen W2). Kontrak di bawah dipakai agen frontend web (`resources/js/features/attendance/flow/**`) dan ponsel (`apps/mobile/**`).

## A. Laporan kerja saat check-out

`POST /absensi/check-out` (web) dan `POST /api/v1/absensi/check-out` (API) menerima field tambahan **`work_report`** (array poin, multipart `work_report[]=...`):

| Aturan | Nilai |
|---|---|
| Wajib | ya, **minimal 1 poin tidak kosong** untuk check-out GPS + selfie (juga WFH/lapangan) |
| Jumlah | maks. 8 poin |
| Panjang | tiap poin maks. 300 karakter (setelah di-trim) |
| Poin kosong/spasi | dibuang sebelum validasi |
| QR/kiosk | `POST .../check-out/qr` **tidak** butuh laporan (tanpa form); kolom tetap `null` |
| `work_plan` | check-in tidak berubah (hanya istilah UI: "Rencana kerja"); check-out tidak lagi membaca `work_plan` |

Contoh permintaan (JSON setara):

```json
{ "latitude": -6.2003, "longitude": 106.8167, "accuracy": 12, "selfie": "<file>", "work_report": ["Menyelesaikan laporan mingguan", "Meeting klien 14.00"] }
```

Galat validasi (422, bentuk Laravel standar; **bukan** `reason`):

```json
{ "message": "Laporan kerja wajib diisi sebelum absen pulang.", "errors": { "work_report": ["Laporan kerja wajib diisi sebelum absen pulang."] } }
```

| Kunci galat | Pesan |
|---|---|
| `work_report` (kosong/tidak ada) | Laporan kerja wajib diisi sebelum absen pulang. |
| `work_report` (> 8 poin) | Maksimal 8 poin laporan kerja. |
| `work_report.N` (> 300) | Tiap poin maksimal 300 karakter. |

Disimpan di `attendance_days.work_report` (jsonb `list<string>`, `null` bila kosong) dalam transaksi check-out. Dibaca sebagai **`workReport`** (di sebelah `workPlan`):

- web: `AttendancePresenter::day()` → `today.day.workReport`, `history[].workReport` (halaman Absensi), dan `today.day.workReport` di API `GET /api/v1/absensi/hari-ini`; `null` bila belum diisi;
- API riwayat/detail (`MobileHistory::cell`): `workReport` = `[]` bila kosong (sama dengan `workPlan`), mis. `GET /api/v1/absensi/hari/{tanggal}` → `day.workReport`.

## B. Jam absen perusahaan

Disimpan di `companies.settings.attendance_windows`:

```json
{ "check_in": { "from": "06:00", "until": "12:00" }, "check_out": { "from": "15:00", "until": null } }
```

- Jam `HH:MM` 24 jam zona kantor. Tiap batas boleh `null`; kunci tidak ada = tanpa batas (perilaku lama).
- Batas **inklusif** per menit: `until` 12:00 menerima sampai 12:00:59; `from` 06:00 menerima mulai 06:00:00.
- **Absen masuk**: bila `from` diisi, ia **menggantikan** aturan "dibuka X menit sebelum jam masuk" milik shift; bila `from` kosong aturan shift tetap berlaku. `until` menutup absen masuk.
- **Absen pulang**: hanya diterima di antara `from` dan `until`.
- Berlaku untuk GPS + selfie, WFH, **dan QR/kiosk**. Karyawan tanpa shift ikut aturan ini.
- **Tidak berlaku** untuk: shift lintas tengah malam (`crosses_midnight`), dan hari yang dibuka kemarin (check-out terlambat hari kemarin tetap memakai masa tenggang normal). Koreksi manual HR (`CorrectAttendance`) **tidak pernah** diblokir.

### Penolakan (422, bentuk yang sama dengan `too_early`/`outside_geofence`)

Kolom pembeda tetap bernama **`reason`** (bukan `code`):

```json
{
  "message": "Absen masuk dibuka pukul 06.00 dan ditutup pukul 12.00.",
  "reason": "check_in_window",
  "context": { "phase": "before", "from": "06:00", "until": "12:00", "opens_at": "2026-10-05T23:00:00Z" }
}
```

```json
{
  "message": "Absen pulang dibuka pukul 15.00 dan ditutup pukul 23.59.",
  "reason": "check_out_window",
  "context": { "phase": "after", "from": "15:00", "until": "23:59" }
}
```

- `reason`: `check_in_window` · `check_out_window` (tambahan pada daftar `AttendanceRejection`: `too_early`, `outside_geofence`, … tetap).
- `context.phase`: `before` (belum dibuka) atau `after` (sudah ditutup). `context.opens_at` (ISO Zulu) hanya untuk absen masuk `before`, selain itu `null`. `from`/`until` bisa `null` bila batas itu tidak diisi.
- Pesan hanya memuat batas yang diisi: "Absen masuk dibuka pukul 06.00." / "Absen masuk ditutup pukul 12.00.".
- Urutan cek di server: izin data → jam absen → (aturan shift `too_early` hanya bila `from` perusahaan kosong) → lokasi → simpan.

## C. State untuk aplikasi

`GET /api/v1/absensi/hari-ini` (juga props halaman Absensi web `today.*`):

Di `today` (props web & API):

```json
{
  "windows": { "checkIn": { "from": "06:00", "until": "12:00" }, "checkOut": { "from": "15:00", "until": null } },
  "windowsApply": true,
  "checkInBlocked": { "code": "too_early", "message": "Absen masuk dibuka pukul 06.00 dan ditutup pukul 12.00.", "opensAt": "2026-10-05T23:00:00Z" },
  "checkOutBlockedReason": null
}
```

- `windows.checkIn` / `windows.checkOut` = `null` bila kedua batasnya kosong; di dalam pasangan, `from`/`until` bisa `null`.
- `windowsApply` = false untuk shift lintas tengah malam (jam absen tidak berlaku).
- `checkInBlocked` hanya ada saat `action = check_in` dan jam di luar rentang: `code` `too_early` | `window_closed`; selain itu `null`.
- `checkOutBlockedReason` string Indonesia bila `action = check_out` dan jam di luar rentang pulang (hari ini), selain itu `null`.

Di `state` (API):

| Field | Perubahan |
|---|---|
| `windows` | baru: `{ "checkIn": {from, until}\|null, "checkOut": {from, until}\|null }` |
| `code` | baru: **`window_closed`** (setelah `check_in.until`, belum check-in); `too_early` juga dipakai bila sebelum `check_in.from` (`windowOpensAt` = jam `from` hari itu, `message` = "Absen masuk dibuka pukul 06.00 dan ditutup pukul 12.00.") |
| `label` | `window_closed` → "Check-in sudah ditutup" |
| `canCheckIn` | false untuk `too_early` dan `window_closed` |
| `canCheckOut` | false bila di luar rentang pulang |
| `checkOutBlockedReason` | baru: string \| null (ditampilkan di tombol/pesan absen pulang) |
| `center` | `window_closed` → `{action: "workspace", ...}` |
| `windowOpensAt` | bila `from` perusahaan diisi = jam `from` hari kantor itu (bukan jendela shift) |

Tanpa jam absen: semua kode/perilaku lama, `windows = {checkIn: null, checkOut: null}`, `checkOutBlockedReason = null`.

## D. Admin web

Admin › Lokasi, shift & hari libur → seksi **Jam absen** (`#jam-absen`, desktop; ponsel tetap banner "tersedia di desktop"):

- `PUT /admin/absensi/jam-absen` (`admin.attendance.windows.update`), izin `attendance.manage` (HR, Super Admin; lainnya 403).
- Field: `check_in_from`, `check_in_until`, `check_out_from`, `check_out_until` (`HH:MM`, boleh kosong). Validasi: format 24 jam; bila `from` dan `until` keduanya diisi, `until` harus **setelah** `from`.
- Props halaman: `windows: { checkIn: {from, until}, checkOut: {from, until} }` (selalu objek, batas `null` bila kosong).
- Audit `attendance.windows_updated` (old/new = bentuk simpanan di atas; tidak ditulis bila tidak berubah). Semua kosong menghapus kunci `attendance_windows`.

## E. Berkas (W2)

`app/Domain/Attendance/Data/AttendanceWindows.php`, `Actions/{CheckIn,CheckOut,SaveAttendanceWindows}.php`, `Exceptions/AttendanceException.php` (+ `AttendanceRejection`), `app/Http/Requests/{Attendance/CheckOutRequest,Attendance/AttendanceWindowsRequest,Api/AttendanceCheckOutRequest,Concerns/HasWorkReport}.php`, `app/Http/Resources/Attendance/{MyAttendance,MobileAttendanceState,AttendancePresenter,MobileHistory}.php`, `app/Http/Controllers/Attendance/Admin/{AttendanceWindowsController,AttendanceSettingsController}.php`, `resources/js/features/attendance/admin/windows-section.tsx`, tes `tests/Feature/Attendance/{CheckOutWorkReportTest,AttendanceWindowsTest}.php`.

## F. Yang perlu dilakukan frontend

- Web check-out (`features/attendance/flow/**`): ganti kolom `work_plan` di langkah pulang dengan editor poin **"Laporan kerja"** (wajib ≥ 1 poin, "Apa yang sudah Anda kerjakan hari ini?") dan kirim `work_report[]`; tampilkan `checkOutBlockedReason` / `checkInBlocked.message` bila tombol dinonaktifkan; tambahkan `check_in_window`, `check_out_window` ke label galat (`check-failure.tsx`, `types/attendance.ts`).
- Ponsel: sama; `state.code === 'window_closed'` perlu layar/label baru (tombol Absen nonaktif, pesan `state.message`); `state.canCheckOut === false` → tampilkan `state.checkOutBlockedReason`; HasilGagal: `check_in_window` / `check_out_window`.
- Istilah UI: check-in = "Rencana kerja", check-out = "Laporan kerja".
