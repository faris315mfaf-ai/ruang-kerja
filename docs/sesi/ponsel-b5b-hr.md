# Kontrak API ponsel — B5-B HR & admin (Bagian 5)

> 13 Okt 2026 · Claude Code (agen B5-B) · branch `claude/android-bagian-5`. Acuan layar: `docs/mockups/android/spec/11-hr-admin-hiring.md` (layar 01–06, 19–27; hiring 07–18 milik B5-H, `docs/sesi/ponsel-b5h-hiring.md`). Semua rute di bawah `/api/v1`, wajib `Authorization: Bearer <token Sanctum>` (401 tanpa token), limiter grup `api-v1` + limiter per rute bila disebut. Super Admin baru bisa memakai API setelah TOTP aktif (`EnsureApiAccountUsable`).
>
> Galat selalu JSON berbahasa Indonesia: validasi/bisnis **422** `{message, errors{field:[pesan]}}`, **403** `{message}` bila peran tidak berhak (sama dengan web), **404** bila objek tidak terlihat (keberadaannya tidak bocor).

Rute: `routes/api/auth/b5b-hr.php` (nama rute `api.v1.hr.*`). Controller tipis di `app/Http/Controllers/Api/Hr/*` di atas Action/Policy/FormRequest/presenter web: `EmployeeDirectory`, `EmployeePresenter`, `UserPolicy`, `DecidePasswordReset`, `PasswordResetRequestPolicy`, `RejectPasswordResetRequest`, `OrganizationTree`, `DivisionPolicy::viewChart`, `TodayBoard`, `MarkLogReviewed`, `AttendanceLogPolicy`, `SelfieStorage`, `CorrectAttendance`, `CorrectionRequest`, `AttendanceDayPolicy`, `MonthlyRecap`, `RecapPresenter`, `AttendanceScopeResolver`, `AttendanceDisciplineReport`, `MetricCatalog`, `LeaveBalancePolicy`, `AdjustLeaveBalance`, `AdjustLeaveBalanceRequest`, `RequestPresenter`. Tanpa perubahan skema, tanpa paket baru. Satu perubahan domain: `TodayBoard::suspicious()` dipecah menjadi `suspiciousQuery()` + `suspiciousItem()` (perilaku web sama) agar daftar "Perlu ditinjau" ponsel memakai bentuk yang sama.

**Penamaan kunci.** Blok yang berasal dari presenter web dikirim **apa adanya** (paritas dengan web, satu sumber rumus) — sebagian camelCase: `board.*`, `suspicious.items[]`, `missing_check_out[]`, `report.*` rekap, `detail.*`, `day.*`, `chart.*`. Kunci tingkat atas buatan API memakai snake_case (`can`, `web_path`, `poll_seconds`, `missing_check_out`, `generated_at`).

**`web_path`** = path halaman web padanannya, untuk tombol "Kirim tautan ke email saya" (`POST /tautan-desktop {path}`, B2; semua path di sini sudah ada di allowlist `config/api_app_links.php`: `/admin/*`, `/organisasi/struktur`, `/absensi/rekap`, `/absensi/kedisiplinan`). `/absensi/hari-ini` **tidak** di allowlist (tidak perlu: papan lengkap tersedia di ponsel).

## Matriks akses ringkas

| Endpoint | HR | Super Admin | Direksi | Kepala Divisi | Atasan langsung (anggota) | Staf |
|---|---|---|---|---|---|---|
| Karyawan daftar/profil | semua (+NIK tersamar, riwayat) | semua (+NIK, riwayat) | semua, **tanpa** NIK/riwayat/status sandi | divisinya | 403 | 403 |
| Permintaan reset sandi | ✓ (bukan milik SA) | ✓ (termasuk SA lain) | 403 | 403 | 403 | 403 |
| Struktur organisasi | ✓ | ✓ | ✓ | ✓ | ✓ | **404** |
| Absensi tim (hari ini, perlu ditinjau, rekap, kedisiplinan) | perusahaan | perusahaan | perusahaan | divisinya | bawahan langsung | 403 |
| Tandai ditinjau | ✓ | ✓ | 403 | 403 | 403 | 403 |
| Selfie | ✓ | 403* | 403* | 403* (kecuali atasan langsung) | ✓ bawahan langsung | hanya milik sendiri |
| Koreksi manual | ✓ | ✓ | 403 | 403 | 403 | 403 |
| Saldo cuti (lihat + penyesuaian) | ✓ | ✓ | 403 | 403 | 403 | 403 |
| Pengumuman baru | semua/divisi/tim | semua/divisi/tim | semua/divisi/tim | divisi yang dipimpin | Ketua Tim: timnya | 403 |

\* `attendance.view_selfie` hanya dimiliki HR (Super Admin tidak — sama dengan web); atasan langsung lewat Policy. Tidak pernah ada `Gate::before`.

---

## 1. Karyawan

### `GET /admin/karyawan`
Izin: `UserPolicy::viewAny` (HR, Direksi, Super Admin; Kepala Divisi/pemimpin divisi tercakup divisinya). Staf → **403**.

Query (nama sama dengan web `EmployeeFilters`): `search` (nama/email, maks. 100), `division` (id), `status` (`active`·`inactive`·`resigned`), `role` (`super_admin`·`direksi`·`hr`·`kepala_divisi`·`anggota`), `sort` (`name`·`division`·`position`·`manager`·`work_mode`·`joined_at`·`status`, bawaan `name`), `direction` (`asc`·`desc`), `per_page` (10·25·50, bawaan 10), `page`. Nilai asing diabaikan.

→ 200
```json
{
  "employees": [{
    "id": "01J…", "name": "Rizky Aditya", "email": "rizky@kantor.co.id", "avatar_url": null,
    "division": {"id": "01J…", "name": "Operasional", "code": "OPS"},
    "team": {"id": "01J…", "name": "Tim Gudang"} ,
    "position": {"id": "01J…", "name": "Staf Gudang"},
    "manager": {"id": "01J…", "name": "Dimas Pratama", "avatar_url": null},
    "work_mode": "office", "roles": ["anggota"], "status": "active", "joined_at": "2021-11-19",
    "can": {"update": true, "deactivate": true}
  }],
  "meta": {"current_page": 1, "from": 1, "last_page": 3, "per_page": 25, "to": 25, "total": 58},
  "filters": {"search": null, "division": null, "role": null, "status": null, "sort": "name", "direction": "asc", "per_page": 25},
  "counts": {"active": 48, "inactive": 10},
  "divisions": [{"id": "01J…", "name": "Operasional", "code": "OPS", "count": 14}],
  "options": {
    "roles": [{"value": "super_admin", "label": "Super Admin"}, …],
    "statuses": [{"value": "active", "label": "Aktif"}, {"value": "inactive", "label": "Nonaktif"}, {"value": "resigned", "label": "Mengundurkan diri"}],
    "work_modes": [{"value": "office", "label": "Kantor"}, {"value": "hybrid", "label": "Hybrid"}, {"value": "wfh", "label": "WFH"}, {"value": "field", "label": "Lapangan"}],
    "sorts": ["name", "division", "position", "manager", "work_mode", "joined_at", "status"],
    "per_page": [10, 25, 50]
  },
  "password_resets_pending": 2,
  "can": {"manage": true, "decide_password_resets": true},
  "web_path": "/admin/karyawan"
}
```
- `counts` dan `divisions[].count` = seluruh cakupan penonton (tidak ikut filter) → lencana chip.
- `divisions`: semua divisi untuk HR/Direksi/SA; Kadiv hanya divisi yang dipimpin.
- `password_resets_pending` = jumlah permintaan menunggu yang bisa diputus penonton (kartu berlencana di atas daftar); `null` bila tidak berhak (Direksi, Kadiv) → kartu disembunyikan.
- `can.manage` false (Direksi/Kadiv) → sembunyikan banner "Tambah/impor tersedia di desktop".
- `employee.can.update/deactivate` hanya penanda (aksinya desktop).

### `GET /admin/karyawan/{id}`
Izin: `viewAny` (403 untuk staf) lalu `UserPolicy::view` — di luar cakupan / perusahaan lain → **404**.

→ 200
```json
{
  "employee": {
    "…kolom baris daftar…": "",
    "manager": {"id": "01J…", "name": "Dimas Pratama", "avatar_url": null, "position": "Kepala Divisi Operasional"},
    "division_head": {"id": "01J…", "name": "Dimas Pratama"},
    "team_lead": {"id": "01J…", "name": "Sari Wulandari"},
    "last_login_at": "2026-10-13T01:12:00+00:00", "deactivated_at": null,
    "employee_number": "EMP-00042", "phone": "+62812…",
    "nik_masked": "••••••••••••4821",
    "has_password": true, "password_change_required": false
  },
  "direct_reports": [{"id": "01J…", "name": "Bayu Saputra", "avatar_url": null, "position": "Staf", "status": "active"}],
  "audit": [{"id": "01J…", "action": "employee.updated", "actor": "Hana Kusuma", "fields": ["position_id"], "reason": null, "created_at": "…"}],
  "password_reset": {"id": "01J…", "employee": {…}, "requested_at": "…", "expires_at": "…", "ip": "10.0.0.5"},
  "password_rule": null,
  "can": {"manage": true, "update": true, "deactivate": true, "set_password": true, "decide_password_reset": true, "view_attendance": true},
  "web_path": "/admin/karyawan/01J…"
}
```
- **NIK** tidak pernah dikirim utuh. `nik_masked`, `has_password`, `password_change_required`, `audit` = `null` bila penonton tidak `employees.manage` (Direksi, Kadiv) — keputusan pemilik: Direksi tanpa NIK/riwayat. Layar NIK wajib `FLAG_SECURE`.
- `password_reset` = permintaan "Lupa kata sandi" menunggu milik orang ini yang bisa diputus penonton (panel di profil) atau `null`.
- **Atur kata sandi = desktop.** `can.set_password` true → banner "Atur kata sandi tersedia di desktop" + Kirim tautan (`web_path`). `password_rule` (string) bila HR membuka akun Direksi/HR/Super Admin: tampilkan pesan aturan R-06 *"Kata sandi akun Direksi, HR, dan Super Admin hanya bisa diatur oleh Super Admin."* sebagai pengganti banner. Nilai sandi bawaan tidak pernah lewat API.
- `can.view_attendance` = boleh membuka `GET /absensi/tim/rekap/{id}` (tombol "Lihat absensi").

## 2. Permintaan reset kata sandi

Izin: `PasswordResetRequestPolicy` — HR & Super Admin aktif (`employees.manage`). Direksi/Kadiv/staf → **403**. Permintaan yang tidak terlihat (milik sendiri, perusahaan lain, milik Super Admin bagi HR) → **404**. Setujui/Tolak **dinonaktifkan offline** di aplikasi.

### `GET /admin/permintaan-sandi`
Menunggu keputusan (pending, < 24 jam), terlama dulu, maks. 50.
```json
{
  "requests": [{
    "id": "01J…",
    "employee": {"id": "01J…", "name": "Sari Wulandari", "email": "sari@kantor.co.id", "avatar_url": null},
    "requested_at": "2026-10-13T02:31:00+00:00",
    "expires_at": "2026-10-14T02:31:00+00:00",
    "ip": "10.0.0.5",
    "privileged_account": false,
    "can": {"decide": true}
  }],
  "total": 1
}
```
`privileged_account` true = akun Direksi/HR/Super Admin: HR **tetap boleh menyetujui** (pemilik akun yang mengetik sandi baru), tampilkan catatan "sandi akun ini hanya diatur Super Admin".

### `POST /admin/permintaan-sandi/{id}/setujui` (30/menit)
Tanpa body. → 200
```json
{"message": "Permintaan Sari Wulandari disetujui. Ia bisa membuat kata sandi baru dalam 30 menit.",
 "request": {"id": "01J…", "status": "approved", "decided_at": "…", "setup_expires_at": "…(+30 menit)"}}
```
Efek (Action web): status `approved`, audit `user.password_reset_approved` pada karyawan, item "Perlu tindakan" HR diselesaikan untuk semua penerima; halaman tunggu karyawan pindah ke form sandi baru.

### `POST /admin/permintaan-sandi/{id}/tolak` (30/menit)
Body `{reason}` wajib, 3–500 karakter (ditampilkan di halaman tunggu karyawan). → 200 `{message: "Permintaan Sari Wulandari ditolak.", request: {…, status: "rejected", setup_expires_at: null}}`. Audit `user.password_reset_rejected` (+alasan).

Galat keduanya: sudah diputus orang lain / dibatalkan / kedaluwarsa → **422** `errors.request: ["Permintaan ini sudah diputus, dibatalkan, atau kedaluwarsa."]` (kartu "sudah diputus"); akun tidak aktif saat disetujui → 422 `errors.request: ["Akun karyawan ini tidak aktif, jadi kata sandinya tidak bisa direset."]`; alasan kosong/terlalu panjang → 422 `errors.reason`.

## 3. Struktur organisasi

### `GET /organisasi/struktur`
Izin: `DivisionPolicy::viewChart` — semua karyawan aktif **kecuali staf** (`isStaffOnly`) → **404** (layar "Halaman tidak ditemukan"; menu disembunyikan).

→ 200 (data `OrganizationTree` web, apa adanya, camelCase)
```json
{
  "chart": {
    "companyName": "PT SPKD",
    "board": {"id": "…", "name": "Direksi", "code": "DIR", "isBoard": true, "head": {…person}, "teams": [], "members": [person], "size": 3, "children": []} ,
    "divisions": [{
      "id": "01J…", "name": "Operasional", "code": "OPS", "isBoard": false,
      "head": {"id": "01J…", "name": "Dimas Pratama", "avatar": null, "position": "Kepala Divisi", "level": 2, "managerId": "01J…", "roles": ["kepala_divisi"]},
      "teams": [{"id": "01J…", "name": "Tim Gudang", "code": "GDG", "lead": {…person}|null, "members": [person], "size": 4}],
      "members": [person],
      "size": 14,
      "children": [ …sub-divisi, bentuk sama… ]
    }],
    "unassigned": [person],
    "stats": {"divisions": 6, "teams": 4, "people": 48}
  },
  "can": {"manage_employees": true, "manage_organization": true, "png_export": false},
  "web_path": "/organisasi/struktur"
}
```
- `person` = `{id, name, avatar, position, level, managerId, roles[]}` — **tanpa** email/telepon/status (direktori publik internal).
- Kepala divisi/ketua tim tampil di kartu unit (`head`/`lead`), tidak diulang di `members`. `board` null bila belum ada unit Direksi.
- **Unduh PNG tidak ada di ponsel** (`png_export` selalu false): menu ⋯ menampilkan "Unduh PNG tersedia di desktop" + Kirim tautan (`web_path`).
- Pencarian/buka-ciutkan dilakukan di klien.

## 4. Absensi tim (HR, Direksi, Super Admin, Kepala Divisi, atasan)

Izin dasar: `AttendanceDayPolicy::viewTeam` — `attendance.view_all` (HR, Direksi, SA: seluruh perusahaan), pemimpin divisi (divisinya + sub), atau punya bawahan langsung (bawahannya). Cakupan orang = `AttendanceDay::visibleUserIds`. Staf tanpa bawahan → **403**.

### 4.1 `GET /absensi/tim/hari-ini?lokasi=`
Polling setiap `poll_seconds` (60; Reverb tidak dipakai aplikasi v1). `lokasi` = id dari `locations` (nilai asing diabaikan).
```json
{
  "filters": {"lokasi": null},
  "locations": [{"id": "01J…", "name": "Kantor Pusat"}],
  "divisions": [{"id": "01J…", "name": "Operasional"}],
  "board": {
    "date": "2026-10-13", "generatedAt": "2026-10-13T02:40:00Z",
    "summary": {
      "scheduled": 48, "shifts": [{"name": "Reguler 08–17", "count": 40}],
      "present": 39, "late": 4, "onLeave": 3,
      "leaveBreakdown": [{"status": "leave", "label": "Cuti", "count": 2}, {"status": "sick", "label": "Sakit", "count": 1}],
      "notCheckedIn": 6
    },
    "divisions": [{"id": "01J…", "name": "Operasional", "scheduled": 14, "onTime": 10, "late": 2, "onLeave": 1, "notCheckedIn": 1}],
    "people": [{
      "id": "01J…", "name": "Bayu Saputra", "initials": "BS", "divisionId": "01J…", "divisionName": "Operasional",
      "locationId": "01J…", "locationName": "Kantor Pusat", "shiftName": "Reguler 08–17", "scheduled": true,
      "state": "late", "status": "late", "statusLabel": "Terlambat",
      "checkInAt": "2026-10-13T01:20:00Z", "checkOutAt": null, "lateMinutes": 10, "method": "gps_selfie", "isSuspicious": false
    }]
  },
  "suspicious": {"total": 3, "items": [ …item §4.2 (maks. 20)… ]},
  "missing_check_out": [{"dayId": "01J…", "userId": "01J…", "name": "Rizky Aditya", "initials": "RA", "workDate": "2026-10-12", "shiftName": "Reguler 08–17", "locationName": "Kantor Pusat", "checkInAt": "…Z"}],
  "can": {"correct": true, "review": true},
  "poll_seconds": 60,
  "web_path": "/absensi/hari-ini"
}
```
- `people[].state`: `on_time` · `late` · `leave` (cuti/izin/sakit/dinas tanpa check-in) · `not_checked_in`. Orang yang libur dan tidak check-in tidak ikut. `scheduled:false` + `summary.scheduled = 0` → keadaan "hari libur".
- Batang per divisi: `onTime`/`late`/`onLeave`/`notCheckedIn` (+teks angka, bukan warna saja).
- `missing_check_out` = hari kemarin dengan check-in tanpa check-out yang jendela pulangnya sudah tutup (shift malam yang masih berjalan tidak ikut).
- `can.correct`/`can.review` = HR & Super Admin; Kadiv/Direksi false → tanpa tombol Koreksi/Tandai, banner jalur pengajuan "Koreksi absensi".

### 4.2 `GET /absensi/tim/perlu-ditinjau?page=`
Semua log ditandai mencurigakan yang belum ditinjau dalam cakupan, terbaru dulu, 20 per halaman.
```json
{
  "items": [{
    "id": "01J…", "userId": "01J…", "name": "Bayu Saputra", "initials": "BS", "divisionName": "Operasional",
    "type": "check_in", "typeLabel": "Check-in", "method": "gps_selfie", "methodLabel": "GPS + selfie",
    "occurredAt": "…Z", "clientTime": "…Z", "locationName": "Kantor Pusat", "radiusM": 100,
    "accuracyM": 180, "distanceM": 35, "note": null,
    "flags": [{"value": "low_accuracy", "label": "Akurasi GPS rendah"}, {"value": "new_device", "label": "Perangkat baru"}],
    "hasSelfie": true, "canViewSelfie": true, "canReview": true
  }],
  "meta": {"current_page": 1, "from": 1, "last_page": 1, "per_page": 20, "to": 3, "total": 3}
}
```
Nilai `flags[].value`: `low_accuracy`, `clock_skew`, `new_device`, `new_ip`, `impossible_travel`, `dark_selfie`, `qr_location_mismatch`, `qr_no_location`, `mock_location` (label Indonesia selalu disertakan). `canViewSelfie` false untuk Kadiv yang bukan atasan langsung → sembunyikan "Lihat selfie". `hasSelfie:false` → selfie sudah dihapus retensi.

### 4.3 `POST /absensi/log/{log}/tinjau` (60/menit)
Izin `AttendanceLogPolicy::review` (HR/SA perusahaan yang sama, **bukan log sendiri**) → selain itu **403**. Tanpa body. Idempoten (peninjau pertama dipertahankan, audit `attendance.log_reviewed` sekali).
→ 200 `{"message": "Log Bayu Saputra ditandai sudah ditinjau.", "log": {"id": "01J…", "reviewed_at": "…Z", "reviewed_by": {"id": "01J…", "name": "Hana Kusuma"}}}`.
Tidak ada "Urungkan" di server (web juga tidak); snackbar Urungkan di mockup tidak didukung — tampilkan snackbar tanpa aksi.

### 4.4 Selfie — `GET /absensi/log/{log}/selfie-url` (30/menit) lalu `GET <url>`
Izin `AttendanceLogPolicy::viewSelfie`: HR (`attendance.view_selfie`), **atasan langsung** karyawan, atau karyawan itu sendiri; selain itu **403**.
1. Tampilkan dialog konfirmasi ("dicatat di audit log, tautan 5 menit").
2. `GET /absensi/log/{log}/selfie-url` → 200 `{"url": "https://…/api/v1/absensi/log/01J…/selfie?expires=…&signature=…", "expires_at": "2026-10-13T02:45:00+00:00"}` (`Cache-Control: no-store`; `expires_at` = sekarang + 5 menit). Selfie sudah dihapus retensi → **404** `{"message": "Selfie sudah dihapus sesuai masa retensi."}` → dialog "Selfie tidak tersedia".
3. Muat gambar dari `url` **dengan header `Authorization: Bearer`** (mis. `expo-image` `source={{uri, headers}}`) → `image/jpeg`, `Cache-Control: private, no-store`. Tanpa/rusak/kedaluwarsa tanda tangan → **403**; Policy tetap dicek ulang. **Setiap pengambilan gambar diaudit** `selfie.viewed` (`{employee_id, own}`), persis seperti web. Jangan menyimpan gambar ke cache disk; layar memakai `FLAG_SECURE` + hitung mundur sampai `expires_at`.

### 4.5 `POST /absensi/koreksi` (30/menit)
Izin `AttendanceDayPolicy::correct`: HR/SA perusahaan yang sama, **tidak untuk diri sendiri** → selain itu **403**. Body (FormRequest web `CorrectionRequest`):
```json
{"user_id": "01J…", "work_date": "2026-10-12", "check_in": "08:00", "check_out": "17:05", "reason": "Lupa check-out, dikonfirmasi atasan"}
```
`check_in`/`check_out` format `HH:MM` (minimal salah satu), `reason` wajib 5–500. → 200
```json
{"message": "Absensi Rizky Aditya dikoreksi.",
 "day": {"id": "01J…", "workDate": "2026-10-12", "status": "present", "statusLabel": "Hadir", "shiftName": "Reguler 08–17", "hours": "08.00–17.00",
         "scheduledStart": "…Z", "scheduledEnd": "…Z", "checkInAt": "…Z", "checkOutAt": "…Z", "lateMinutes": 0, "earlyLeaveMinutes": 0,
         "workMinutes": 490, "isSuspicious": false, "requestPortion": null, "workPlan": null,
         "checkIn": {"id": "…", "type": "check_in", "method": "manual", "methodLabel": "Manual oleh HR", "occurredAt": "…Z", "locationName": null, "distanceM": null, "inside": false, "note": "…", "isSuspicious": false, "selfieUrl": null},
         "checkOut": {…}}}
```
Efek: log `method = manual` (`corrected_by`, `note` = alasan), hari dihitung ulang, audit `attendance.corrected`. **Catatan:** Action web tidak mengirim notifikasi ke karyawan — snackbar "Koreksi disimpan." (bukan "… diberi tahu"). Galat: 422 `errors.reason` ("Alasan koreksi wajib diisi." / "Tulis alasan koreksi minimal 5 karakter."), `errors.check_in` ("Isi jam masuk, jam pulang, atau keduanya."), format jam, tanggal masa depan / jam pulang ≤ masuk (pesan Action web, 422). Tidak ada antrean offline.

### 4.6 `GET /absensi/tim/rekap?bulan=YYYY-MM&divisi=&q=`
Rekap bulanan `MonthlyRecap` web. `bulan` bawaan bulan berjalan; `divisi` hanya id dari `divisions`; `q` cari nama (maks. 80).
```json
{
  "period": {"month": "2026-10", "label": "Oktober 2026", "start": "2026-10-01", "end": "2026-10-31", "countedUntil": "2026-10-13", "isRunning": true, "previous": "2026-09", "next": "2026-11"},
  "filters": {"bulan": "2026-10", "divisi": null, "q": null},
  "divisions": [{"id": "01J…", "name": "Operasional"}],
  "report": {
    "summary": {"employees": 48, "calendarWorkDays": 22, "weekendDays": 9, "holidayDays": 0, "attendanceRate": 94, "lateCount": 12, "overtimeHours": 6.5, "lateToleranceMin": 10},
    "rows": [{
      "userId": "01J…", "name": "Rizky Aditya", "initials": "RA", "divisionName": "Operasional", "positionName": "Staf", "shiftName": "Reguler 08–17",
      "workDays": 9, "presentDays": 8, "lateCount": 1, "lateMinutes": 10, "earlyLeaveCount": 0, "absentDays": 0,
      "leaveDays": 1, "permitDays": 0, "sickDays": 0, "businessTripDays": 0, "wfhDays": 0, "needsCorrectionDays": 0, "offDays": 4,
      "overtimeHours": 0, "attendanceRate": 89, "averageCheckIn": "07.56", "suspiciousDays": 0
    }]
  },
  "generated_at": "2026-10-13T02:40:00Z",
  "can": {"export": true, "correct": true},
  "web_path": "/absensi/rekap"
}
```
- Semua orang dalam cakupan (tanpa paginasi; puluhan baris). `attendanceRate`/`averageCheckIn` bisa `null` bila belum ada hari terhitung.
- **Ekspor Excel/PDF = desktop**: `can.export` true (HR/SA) → banner "Ekspor tersedia di desktop" + Kirim tautan `web_path`.

### 4.7 `GET /absensi/tim/rekap/{userId}?bulan=YYYY-MM`
Orang di luar cakupan → **404**.
```json
{
  "period": {…sama §4.6…},
  "detail": {
    "…semua kolom baris §4.6…": "",
    "days": [{
      "date": "2026-10-01", "kind": "late", "isWorkday": true, "holidayName": null, "dayId": "01J…", "statusLabel": "Terlambat",
      "lateMinutes": 10, "earlyLeaveMinutes": 0, "workMinutes": 470, "overtimeMinutes": 0, "isSuspicious": false, "shiftName": "Reguler 08–17",
      "checkIn": {…log ringkas §4.5, selfieUrl selalu null…}, "checkOut": null
    }],
    "logs": [{"id": "01J…", "type": "check_in", "typeLabel": "Check-in", "method": "gps_selfie", "methodLabel": "GPS + selfie", "occurredAt": "…Z",
              "locationName": "Kantor Pusat", "distanceM": 35, "inside": true, "note": null, "isSuspicious": true, "selfieUrl": null,
              "accuracyM": 12, "flags": [{"value": "new_device", "label": "Perangkat baru"}], "reviewedAt": null, "isCorrection": false,
              "hasSelfie": true, "canViewSelfie": true, "canReview": true}]
  },
  "can": {"export": true, "correct": true}
}
```
- `days` = satu sel per tanggal bulan itu (kalender). `kind`: nilai status absensi (`present`, `late`, `early_leave`, `absent`, `leave`, `permit`, `sick`, `business_trip`, `holiday`, `wfh`, `needs_correction`) atau `off` (tidak terjadwal), `holiday`, `upcoming` (terjadwal, belum terhitung), `none` (terjadwal, tidak ada catatan).
- "Hari terakhir" = ambil dari `days` yang punya `dayId`, urut mundur. `logs` = log check-in/out bulan itu (untuk "Log check-in"); selfie lewat §4.4 (`canViewSelfie`), tinjau lewat §4.3 (`canReview`).
- `can.correct` = Policy untuk orang **ini** (false untuk diri sendiri dan non-HR) → tombol Koreksi (§4.5, `user_id` = id ini).

### 4.8 `GET /absensi/tim/kedisiplinan?periode=&dari=&sampai=&divisi=`
Data tab web Absensi › Kedisiplinan. `periode`: `minggu` · `bulan` (bawaan) · `kuartal` · `kustom` (+`dari`,`sampai` `YYYY-MM-DD`, maks. hari `analytics.max_custom_days`, lebih → kembali ke bulan). `divisi` di luar cakupan → **403** `"Divisi di luar cakupan Anda."`.
```json
{
  "filters": {"periode": "bulan", "dari": null, "sampai": null, "divisi": null, "tim": null,
              "period": {"preset": "bulan", "from": "2026-10-01", "to": "2026-10-31", "label": "1–31 Okt 2026", "previous_label": "bulan lalu"},
              "presets": [{"value": "minggu", "label": "Minggu ini"}, {"value": "bulan", "label": "Bulan ini"}, {"value": "kuartal", "label": "Kuartal"}, {"value": "kustom", "label": "Kustom"}],
              "divisions": [{"id": "01J…", "name": "Operasional"}], "teams": []},
  "scope": {"label": "Semua divisi", "member_count": 48},
  "definitions": {"completion_rate": {"label": "Tingkat penyelesaian", "definition": "Tugas berstatus Selesai …", "unit": "percent"}, "…": {}},
  "report": {
    "period": {…}, "compared": {"current": {…period s.d. hari ini}, "previous": {…}},
    "kpis": {
      "attendance_discipline": {"value": 57, "numerator": 4, "denominator": 7, "previous": null, "delta": null},
      "average_lateness": {"value": 15, "numerator": 30, "denominator": 2, "previous": null, "delta": null},
      "absent_days": {"value": 1, "numerator": 1, "denominator": 0, "previous": 0, "delta": 1},
      "late_days": {"value": 2, "…": ""},
      "completion_rate": {"value": 50, "numerator": 1, "denominator": 2, "previous": null, "delta": null},
      "lead_time": {"value": 2, "…": ""}
    },
    "trend": [{"week_start": "2026-08-17", "label": "17 Agu", "value": null, "numerator": 0, "denominator": 0}],
    "people": [{"user": {"id": "01J…", "name": "Sari Wulandari", "avatar": null, "division": "Operasional"},
                "scheduled": 2, "on_time": 1, "discipline": 50, "late_days": 0, "average_late": null, "absent_days": 1}]
  },
  "web_path": "/absensi/kedisiplinan"
}
```
- KPI 2×2 = `attendance_discipline` (%), `average_lateness` (menit), `absent_days`, `late_days`; sekunder berdampingan = `completion_rate` (%), `lead_time` (hari). **Tidak ada skor gabungan.** `value` bisa `null` (tidak ada data). `definitions` → sheet ⓘ.
- `trend` = 8 minggu (batang + angka). `people` sudah diurut "bermasalah dulu"; chip Perlu perhatian/Alpha/Terlambat difilter di klien (`absent_days`, `late_days`, `discipline`).
- Ekspor Excel = desktop (banner + `web_path`).

## 5. Saldo cuti (HR)

Izin: `LeaveBalancePolicy` — `requests.manage_flows` (HR & Super Admin). Direksi/Kadiv/staf → **403** (staf tidak pernah melihat saldo tahunan di modul ini). Mockup D20 menggambar **baca saja**; endpoint penyesuaian tersedia bila nanti dipakai (aturannya sama dengan web). Ubah jatah/bawaan, buat saldo, impor = desktop (banner + `web_path`).

### `GET /admin/saldo-cuti?jenis=&tahun=&cari=`
`jenis` = id jenis berkuota (bawaan jenis pertama), `tahun` 2000–2100 (bawaan tahun berjalan), `cari` nama (maks. 80). Maks. 500 karyawan aktif.
```json
{
  "types": [{"id": "01J…", "code": "CUT", "name": "Cuti tahunan", "category": "leave", "category_label": "Cuti", "annual_quota_days": 12, "…": "RequestPresenter::type"}],
  "type": {…jenis terpilih…},
  "year": 2026, "years": [2024, 2025, 2026, 2027], "search": "",
  "rows": [{
    "user": {"id": "01J…", "name": "Rizky Aditya", "avatar": null, "position": "Staf", "division": "Operasional"},
    "eligible": true,
    "balance": {"id": "01J…", "year": 2026, "entitled": 6, "carried_over": 0, "opening": 0, "adjustments": 0, "used": 1, "pending": 1, "total": 6, "available": 4, "remaining": 5},
    "prorated": true, "joined_at": "2026-07-01",
    "can": {"adjust": true}
  }],
  "web_path": "/admin/saldo-cuti"
}
```
`balance: null` = saldo tahun itu belum dibuat ("Saldo 2026 belum dibuat" + banner desktop). `eligible:false` = "Belum berhak" (masa kerja). `prorated` = bergabung di tahun itu (penanda Prorata).

### `GET /admin/saldo-cuti/{balanceId}/riwayat`
→ 200 `{"balance": {…summary…}, "items": [{"id": "01J…", "delta_days": 1.5, "reason": "Kompensasi lembur hari libur", "actor": "Hana Kusuma", "created_at": "…"}]}` (terbaru dulu, maks. 50). Saldo perusahaan lain → **404**.

### `POST /admin/saldo-cuti/{balanceId}/penyesuaian` (30/menit)
Body `{"delta_days": 1.5, "reason": "…"}` — `delta_days` ±0,5…365 kelipatan 0,5, bukan 0; `reason` wajib ≤ 255. → 200 `{"message": "Penyesuaian saldo Rizky Aditya dicatat.", "balance": {…summary baru…}, "items": [ …riwayat… ]}`. Audit `leave_balance.adjusted` (row lock, saldo tidak pernah minus). Galat 422: `errors.reason` "Alasan penyesuaian wajib diisi.", `errors.delta_days` ("Kelipatan 0,5 hari.", "Penyesuaian tidak boleh 0.", "Saldo tidak boleh minus: sisa yang bisa dikurangi 4 hari."). Saldo perusahaan lain → 403.

## 6. Pengumuman ke semua / divisi / tim (sudah ada, B2-B)

Tidak ada endpoint baru — pakai `routes/api/auth/b2b-beranda.php` (kontrak `docs/sesi/ponsel-b2b-beranda.md`):
- `GET /pengumuman/audiens` → `{audiences: [{value: "all"|"division"|"team", label}], divisions: [{id, name}], teams: [{id, name}]}` sesuai peran (HR/Direksi/SA: semua; Kadiv: divisi yang dipimpin; Ketua Tim: timnya). Staf → 403.
- `POST /pengumuman` (20/menit) `{title, body, audience, target_ids[], expires_on?}` → 201 `{message: "Pengumuman diterbitkan.", pengumuman}`; target di luar hak → 422 `target_ids`. Penerima diberi tahu lewat job antrean.
- Dialog "Kirim ke n orang": jumlah penerima belum dikirim server — tampilkan nama audiens (semua/divisi/tim) tanpa angka, atau hitung dari `divisions[].count` `GET /admin/karyawan` bila tersedia. (Bila angka pasti dibutuhkan: butuh endpoint baru, belum dibuat.)

## 7. Uji

`tests/Feature/Api/HrEmployeeApiTest.php` (12), `HrAttendanceApiTest.php` (11), `HrDisciplineLeaveApiTest.php` (7) — 30 tes, 345 asersi: jalur bahagia, matriks peran (HR, Super Admin ber-TOTP, Direksi, Kadiv, atasan langsung, staf → 403/404 seperti web), validasi, baris audit (`user.password_reset_*`, `attendance.log_reviewed`, `selfie.viewed`, `attendance.corrected`, `leave_balance.adjusted`), tautan selfie bertanda tangan (tanpa/rusak/kedaluwarsa → 403). `tests/Feature/Attendance/AttendanceBoardTest.php` tetap hijau setelah pemecahan `TodayBoard::suspicious`.

## 8. Belum dikerjakan / catatan

- Jumlah penerima pengumuman sebelum kirim (lihat §6).
- "Urungkan" tandai ditinjau (tidak ada di web).
- Detail log terpisah (peta sketsa + perangkat): data lokasi/akurasi/jarak/tanda ada di item §4.2 dan `detail.logs`; informasi perangkat (`user_agent`, `device_fingerprint`) sengaja tidak dikirim.
- Notifikasi ke karyawan setelah koreksi manual tidak ada di web (lihat §4.5).
- Super Admin hanya bisa memakai semua ini setelah TOTP aktif di akunnya.
