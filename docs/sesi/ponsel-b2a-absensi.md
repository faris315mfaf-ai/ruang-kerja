# Kontrak API — Bagian 2 / B2-A: Absensi

> Ditulis 13 Okt 2026 (Claude Code, agen B2-A). Digabung ke `docs/sesi/ponsel.md` oleh integrator. Rute di bawah `/api/v1`, JSON, Bahasa Indonesia, Bearer token Sanctum (grup `auth:sanctum` + limiter `api-v1` 60/menit per pengguna). Semua endpoint hanya menyentuh data **pemilik token** (tanpa parameter id pengguna). Controller tipis di atas Action/Policy/presenter web; rute baru ada di `routes/api/auth/b2a-absensi.php`, kode di `app/Http/Controllers/Api/Attendance/*`.
>
> **Konvensi bentuk.** Parameter permintaan = snake_case (seperti endpoint check-in lama: `client_time`, `work_plan`, `device_id`); **badan respons modul Absensi = camelCase** (seperti `hari-ini`/`riwayat`/`result` yang sudah dipakai aplikasi), kecuali `context` penolakan 422 yang berisi snake_case persis seperti web (`distance_m`, `radius_m`, `opens_at`). Instan = ISO-8601 UTC (`…Z`); tanggal kerja = `YYYY-MM-DD` (waktu kantor, `Asia/Jakarta`); jam di `message`/`dateLabel` diformat waktu kantor ("08.10", "Sen, 5 Okt 2026").
>
> **Galat umum.** `401` tanpa/invalid token; `422` validasi `{message, errors{kolom:[pesan]}}`; `422` penolakan bisnis check-in/out `{message, reason, context}` (lihat §1.3); `429` limiter.

## Ringkasan

| Metode | Path | Status | Limiter tambahan |
|---|---|---|---|
| POST | `/absensi/check-in/qr` | **baru** | `check-in` (6/menit per pengguna) |
| POST | `/absensi/check-out/qr` | **baru** | `check-in` |
| POST | `/absensi/check-in`, `/absensi/check-out` | diperluas (`mock_location`) | `check-in` |
| GET | `/absensi/hari-ini` | diperluas (`state`) | — |
| GET | `/absensi/riwayat?bulan=YYYY-MM` | diperluas (sel diperkaya) | — |
| GET | `/absensi/hari/{date}` | **baru** | — |
| GET | `/absensi/rekap?bulan=YYYY-MM` | **baru** | — |
| GET | `/absensi/rekap/unduh?bulan=YYYY-MM&format=pdf` | **baru** | 10/menit |

Persetujuan lokasi/selfie (UU PDP): endpoint `GET/POST/DELETE /persetujuan` dari B2-privasi (`docs/sesi/ponsel-b2-privasi.md` §2). `hari-ini` hanya membawa ringkasannya (`state.consent`).

---

## 1. Check-in / check-out

### 1.1 `POST /absensi/check-in/qr` dan `POST /absensi/check-out/qr`
Action web `CheckIn`/`CheckOut` dengan `QrCheckInData` (method `qr`, tanpa selfie), Policy `AttendanceDayPolicy::checkIn`. Body JSON atau form:

| Field | Tipe | Keterangan |
|---|---|---|
| `payload` | string ≤ 512, **wajib** | teks hasil pindai QR kiosk (`ruangkerja://checkin?l=…&w=…&s=…`). Alias `code` diterima bila `payload` kosong |
| `latitude`, `longitude` | number, opsional (berpasangan) | GPS bila diizinkan; tanpa GPS → flag `qr_no_location` (ditandai) atau 422 `qr_location_required` bila `ATTENDANCE_QR_REQUIRE_LOCATION=true` |
| `accuracy` | number ≥ 0, opsional | meter |
| `client_time` | ISO-8601, opsional | jam perangkat; selisih > 5 menit → flag `clock_skew` |
| `mock_location` | `true`/`false`/`1`/`0`, opsional | lihat §1.2 |
| `device_id` | 64 hex, opsional | **diabaikan**: sidik perangkat diambil dari token (hash saat login) |

**201** `{ "result": { … } }` — bentuk **sama persis** dengan check-in GPS dan web (`AttendancePresenter::result`):
```json
{ "result": {
  "type": "check_in" | "check_out", "workDate": "2026-10-05", "occurredAt": "2026-10-05T00:52:00Z",
  "status": "present", "statusLabel": "Hadir", "lateMinutes": 0, "earlyLeaveMinutes": 0, "workMinutes": 0,
  "minutesBeforeStart": 8 | null, "method": "qr", "methodLabel": "QR kiosk",
  "location": { "name": "Kantor Pusat", "distanceM": 33 | null, "radiusM": 100, "inside": true } | null,
  "shift": { "name": "Reguler", "hours": "08.00–17.00" } | null,
  "isSuspicious": false, "selfieUrl": null } }
```
**422 penolakan** `{message, reason, context}` (identik web): `consent_required`, `already_checked_in`, `already_checked_out`, `not_checked_in`, `too_early` (`context.opens_at`), `no_office_location`, `day_has_request` (`context.status`), `qr_invalid` ("Kode QR tidak dikenali. Pindai kode yang tampil di layar kiosk RuangKerja."), `qr_expired` (kode berganti tiap 30 detik), `qr_wrong_location` (`context.location`), `qr_location_required`. Validasi: 422 `{message, errors}` (`payload` kosong: "Kode QR belum terbaca. Arahkan kamera ke kode di layar kiosk.").

### 1.2 `mock_location` (check-in/out GPS **dan** QR)
Field opsional baru pada `POST /absensi/check-in`, `/check-out`, `/check-in/qr`, `/check-out/qr` (multipart atau JSON): `mock_location` = `true|false|1|0` (nilai lain → 422 `errors.mock_location`). Aplikasi mengirim `Location.mocked` (Android). Bila `true`: `LogFlag::MockLocation` (`mock_location`, label "Lokasi palsu terdeteksi di perangkat") ditulis ke `attendance_logs.flags`, `is_suspicious=true` (log dan hari), muncul di `result.isSuspicious`. **Hanya penanda untuk tinjauan HR, tidak pernah memblokir** (PRD M2). `client_time` diterima di semua endpoint check-in/out; `FraudDetector` sudah menghasilkan `clock_skew`. Dokumen skema: `docs/DATABASE.md` (`attendance_logs.flags`).

### 1.3 Check-in/out GPS + selfie (tidak berubah)
`POST /absensi/check-in` & `/check-out` multipart seperti `docs/sesi/ponsel.md`, plus `mock_location` di atas.

---

## 2. `GET /absensi/hari-ini` (diperluas)

Bentuk lama utuh (`today{action, schedule, day, locations}`, `serverTime`) **ditambah** `state`:

```json
{
  "today": { "action": "check_in|check_out|done|unavailable", "schedule": { "workDate","isWorkday","isHoliday","holidayName","shiftName","hours","start","end","checkInOpensAt","lateThreshold","workMode","workModeLabel","allowsRemote", … }, "day": { … } | null, "locations": [ … ] },
  "serverTime": "2026-10-05T00:30:00Z",
  "state": {
    "code": "not_checked_in",
    "label": "Belum check-in",
    "message": "Check-in sebelum 08.10 agar tepat waktu.",
    "punctuality": null,
    "lateMinutes": 0,
    "officeDate": "2026-10-05",
    "workDate": "2026-10-05",
    "isWorkday": true, "isHoliday": false, "holidayName": null,
    "isRemote": false, "isBusinessTrip": false,
    "request": null,
    "scheduledStart": "2026-10-05T01:00:00Z", "scheduledEnd": "2026-10-05T10:00:00Z",
    "windowOpensAt": "2026-10-04T23:00:00Z", "lateThreshold": "2026-10-05T01:10:00Z",
    "checkedInAt": null, "checkedOutAt": null, "locationName": null,
    "canCheckIn": true, "canCheckOut": false,
    "consent": { "granted": true, "needsRenewal": false, "version": "1.0" },
    "center": { "action": "absen", "badge": false, "flipsAt": null }
  }
}
```

`state.code` (satu nilai, saling lepas; urutan keputusan dari atas):

| code | Kapan | Layar mockup (spec 03) |
|---|---|---|
| `checked_in` | `today.action = check_out` (sudah check-in, belum pulang). `punctuality` = `on_time` / `late` (`lateMinutes` > 0, dihitung dari batas toleransi) | Absen (sedang bekerja) |
| `checked_out` | `action = done` | 04-4 selesai |
| `day_has_request` | `action = unavailable`: hari penuh dari cuti/izin/sakit yang disetujui; `request{status,statusLabel,portion,blocksCheckIn=true}` | 03-5 |
| `holiday` | tidak terjadwal & hari libur (`holidayName`) | 03-4 |
| `non_working_day` | tidak terjadwal (akhir pekan/tanpa pola) | 03-4 |
| `too_early` | hari kerja, `now < windowOpensAt`; `canCheckIn=false`, `message` memuat jam buka | 03-3 |
| `no_office_location` | bukan jalur remote dan `today.locations = []` | 03-6 |
| `not_checked_in` | siap check-in | 01 |

Keterangan:
- `isRemote` = jadwal mengizinkan check-in di luar radius (mode WFH/lapangan atau dinas luar) → segmen WFH aktif; bukan mode terpisah ke server (`CheckIn` menurunkan method `wfh` sendiri; catatan wajib bila di luar radius).
- `request` terisi bila baris hari berasal dari pengajuan: `status` ∈ `leave|permit|sick|business_trip`, atau `portion = half_day` (setengah hari/ dinas **tidak** memblokir check-in: `blocksCheckIn=false`; `code` tetap `not_checked_in`/`checked_in`).
- `canCheckIn` = aturan jadwal/lokasi server akan menerima (tidak memperhitungkan persetujuan — pakai `consent.granted`). **Server tetap menerima check-in di hari libur/akhir pekan** (kerja ekstra); `holiday`/`non_working_day` hanya penamaan keadaan, mockup 03-4 mengunci form di sisi aplikasi — keputusan UI aplikasi.
- `consent`: `granted=false` & `needsRenewal=false` → belum pernah/dicabut; `needsRenewal=true` → pernah setuju versi kebijakan lama (persetujuan ulang). Beri/cabut lewat `/persetujuan`.
- `center` = tombol tengah tab bar (keputusan 9 Okt, spec D5): `absen` sebelum check-in/ketika form tersedia; `workspace` setelah check-in; `absen` + `badge:true` mulai `scheduledEnd − 60 menit` sampai check-out; `workspace` setelah check-out / tak tersedia. `flipsAt` = instan perubahan berikutnya (`scheduledEnd − 60 menit`, hanya saat `checked_in` dan belum tiba) — pasang timer, tanpa polling.
- `today.day` berisi `selfieUrl` bertanda tangan milik sendiri (perilaku lama, tidak diubah).

---

## 3. Riwayat bulan

### `GET /absensi/riwayat?bulan=YYYY-MM`
Bentuk lama utuh (`period`, `recap{…row, days[], logs[]}`; `bulan` salah → bulan berjalan) dengan tambahan:

- top-level `today` (`YYYY-MM-DD`, tanggal kantor sekarang) dan `correction` (§5);
- tiap `recap.days[]` (sel kalender) = kunci lama (`date, kind, isWorkday, holidayName, dayId, statusLabel, lateMinutes, earlyLeaveMinutes, workMinutes, overtimeMinutes, isSuspicious, shiftName, checkIn, checkOut`) **ditambah**:

| Kunci | Isi |
|---|---|
| `status` | nilai status baris hari (`present|late|early_leave|absent|leave|permit|sick|business_trip|holiday|wfh|needs_correction`) atau `null` |
| `scheduledStart`, `scheduledEnd`, `checkInAt`, `checkOutAt` | ISO UTC atau `null` |
| `locationLabel` | nama lokasi check-in; bila di luar radius = label metode ("WFH / lapangan", "QR kiosk"); `null` tanpa log |
| `workPlan` | `list<string>` rencana kerja (kosong `[]` bila tak ada) |
| `note` | catatan hari |
| `flags` | `[{code,label}]` dari log masuk/pulang yang boleh dilihat pemilik, kata netral (tanpa "mencurigakan"); `new_ip` (informasi saja) disembunyikan |
| `isCorrected` | `true` bila log masuk/pulang berasal dari koreksi HR (`corrected_by`) |
| `request` | `{id, number, type, category, categoryLabel, status, statusLabel, portion}` pengajuan yang menjadi sumber hari (cuti/izin/sakit/dinas) atau `null` |
| `correction` | `{canCorrect, deadline, pendingRequest}` (§5) |

`isSuspicious` lama tetap ada (kompatibilitas; aplikasi dianjurkan memakai `flags`/`isCorrected` untuk teks). Tanpa selfie, tanpa saldo cuti.

---

## 4. Detail hari & rekap

### `GET /absensi/hari/{date}` — `date = YYYY-MM-DD`
Sel kalender tanggal itu dari `MonthlyRecap` yang sama dengan kalender (kind/status tidak mungkin berbeda). Tanggal salah/bukan tanggal nyata/<2000 → 422 `errors.date` ("Format tanggal harus YYYY-MM-DD, mis. 2026-10-13."). Selalu data pemilik token.
```json
{
  "date": "2026-10-05", "dateLabel": "Sen, 5 Okt 2026",
  "day": { …sel §3 (checkIn/checkOut tanpa kunci selfieUrl)… },
  "logs": [ { "id","type":"check_in","typeLabel":"Check-in","method":"gps_selfie","methodLabel":"GPS + selfie","occurredAt":"…Z",
              "locationName":"Kantor Pusat"|null,"inside":true,"distanceM":33|null,"accuracyM":12|null,"note":null,
              "flags":[{"code","label"}],"isCorrection":false,"reviewedAt":null } ],
  "correction": { "available": true, "typeId": "01…", "typeCode": "KOR", "typeName": "Koreksi absensi", "maxBackdateDays": 7 },
  "privacyNote": "Selfie hanya dapat dilihat oleh HR dan atasan langsung Anda, dan setiap akses tercatat."
}
```
`logs` = semua log hari itu (urut `occurredAt`); `[]` bila tak ada catatan. **Selfie tidak pernah dikembalikan** (tanpa URL maupun kunci).

### `GET /absensi/rekap?bulan=YYYY-MM`
Angka rekap pribadi dari `MonthlyRecap::employee` (sama dengan "Absensi Saya" web); tanpa saldo cuti, tanpa skor gabungan, tanpa `suspiciousDays`.
```json
{ "period": { "month","label","start","end","countedUntil","isRunning","previous","next" },
  "recap": { "shiftName": "Reguler 08.00–17.00"|null, "workDays": 22, "presentDays": 20, "lateCount": 2, "lateMinutes": 25,
             "earlyLeaveCount": 0, "absentDays": 0, "leaveDays": 1, "permitDays": 0, "sickDays": 1, "businessTripDays": 0,
             "wfhDays": 3, "needsCorrectionDays": 0, "offDays": 8, "overtimeHours": 1.5, "overtimeMinutes": 90,
             "attendanceRate": 95.2|null, "averageCheckIn": "07.58"|null },
  "downloadFormats": ["pdf"] }
```
`presentDays`/`leaveDays`/`permitDays` bisa pecahan (0,5 untuk setengah hari). Hari terlambat sudah termasuk Hadir.

### `GET /absensi/rekap/unduh?bulan=YYYY-MM&format=pdf`
Mengalirkan PDF pribadi web (`RecapPdf::personal`, A4 potret; `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="rekap-absensi-saya-YYYY-MM.pdf"`). `format` bawaan `pdf`. **Excel (`xlsx`) tidak ada**: web hanya punya PDF pribadi (Excel hanya untuk rekap perusahaan oleh HR) → `format=xlsx` (atau selain `pdf`) = 422 `errors.format` "Format unduhan rekap pribadi hanya PDF. Rekap Excel belum tersedia untuk karyawan.". Aplikasi mengunduh dengan header `Authorization: Bearer …` ke berkas lokal lalu membagikannya. Limiter 10/menit.

---

## 5. Pintu masuk koreksi absensi (`correction`)

Form dan `POST /pengajuan` koreksi **tidak dibangun di sini** (Bagian 4). API hanya memberi tahu apakah tombol "Ajukan koreksi" boleh tampil dan batasnya:

- Top-level / detail `correction`: `{ available, typeId, typeCode, typeName, maxBackdateDays }` — jenis pengajuan kategori `correction` (kode seeder `KOR`) milik perusahaan yang aktif, tidak terkunci, dan eligible; `available=false`/semua `null` bila tidak ada. `maxBackdateDays` = `leave_types.max_backdate_days` (bawaan seeder 7; `null` = tanpa batas). Aplikasi mengirim `typeId` ke `POST /pengajuan` (`GET /pengajuan/jenis` memuat jenis yang sama).
- Per hari `correction`: `{ canCorrect, deadline, pendingRequest }`:
  - `canCorrect` = jenis tersedia ∧ tanggal ≤ hari ini ∧ dalam batas `maxBackdateDays` ∧ (hari terjadwal ∨ ada catatan) ∧ tidak ada koreksi `pending`/`revision_requested` untuk tanggal itu;
  - `deadline` = tanggal terakhir (inklusif) koreksi masih bisa diajukan (`tanggal + maxBackdateDays`), `null` bila tanpa batas/tanpa jenis;
  - `pendingRequest` = `{id, number, status, statusLabel}` koreksi milik sendiri yang `pending|revision_requested|approved` untuk tanggal itu (terbaru), atau `null`.
  Validasi final tetap di server saat `POST /pengajuan` (`Koreksi maksimal N hari ke belakang.`).

---

## 6. Yang sengaja tidak dibangun / catatan

- **Excel rekap pribadi**: dilewati (web tidak punya; lihat §4). Bila diinginkan, perlu export baru di domain Attendance (keputusan pemilik: PDF cukup?).
- **Form/POST koreksi absensi**: Bagian 4 (pengajuan).
- **Persetujuan UU PDP**: sudah di B2-privasi (`/persetujuan`).
- **Antrean offline & `client_id`** (spec D13): Fase 3. **Check-in wajah**: Fase 3 (tidak ada `face_templates`).
- **Pratinjau pesan WhatsApp**: disusun di klien (spec D12), tanpa endpoint.
- **Laporan harian dari ajakan check-out** (spec D9): modul laporan (Bagian 4).
- **Perubahan web**: tidak ada perubahan perilaku web; `CheckInData`/`QrCheckInData` mendapat `mockLocation` (bawaan `false`), `LogFlag::MockLocation` ditambah, `FraudDetector` menandainya.

## Berkas

Kode: `app/Http/Controllers/Api/Attendance/{QrCheckController,AttendanceDayController,AttendanceRecapController}.php` (+ `MyAttendanceController`, `AttendanceHistoryController` diperluas), `app/Http/Requests/Api/AttendanceQrRequest.php` (+ `AttendanceCheckInRequest` menerima `mock_location`), `app/Http/Resources/Attendance/{MobileAttendanceState,MobileHistory}.php`, `app/Domain/Attendance/Services/CorrectionWindow.php`, `routes/api/auth/b2a-absensi.php`. Tes: `tests/Feature/Api/AttendanceMobileApiTest.php`.
