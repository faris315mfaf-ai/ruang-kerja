# Bagian 7 — Aplikasi ponsel offline-first (kontrak backend BO1)

Keputusan pemilik 14 Okt 2026: aplikasi harus **bekerja tanpa internet dan menyinkronkan sendiri** begitu koneksi kembali. Tulis offline: absen masuk/pulang, tugas & komentar, catatan, laporan harian, pengajuan. Aturan jam absen: **jam perangkat saat tombol absen ditekan**, ditandai "offline" untuk ditinjau HR, **maks. 72 jam**. (Batas 12.00 sakit/izin untuk pengajuan yang antre offline dinilai dengan waktu **server saat dikirim** — tidak ada yang dibangun di sini.)

Dokumen ini = kontrak **sisi server** yang dipakai agen aplikasi (`apps/mobile/**`). Semua endpoint di bawah awalan `/api/v1`, header `Authorization: Bearer <token>`, `Accept: application/json`.

## A. Idempotency-Key — semua tulis API v1 terautentikasi

Middleware `App\Http\Middleware\IdempotentRequests` ada di grup `auth:sanctum` (semua `POST/PUT/PATCH/DELETE` setelah login: absensi, tugas, komentar, catatan, laporan, pengajuan, obrolan, …).

**Header:** `Idempotency-Key: <kunci>` — 16–64 karakter `[A-Za-z0-9_-]` (UUID v4 tanpa/dengan tanda hubung cocok). Buat **satu kunci per aksi pengguna** (satu antrean = satu kunci) dan pakai kunci yang **sama** untuk setiap percobaan ulang aksi itu. Tanpa header, perilaku persis seperti sebelumnya. `GET` mengabaikan header.

| Situasi | Respons |
|---|---|
| Kunci baru | handler berjalan normal; hasil disimpan |
| Kunci sama + method & path sama, sudah selesai | **status, badan, `Content-Type` yang sama** + header `Idempotent-Replayed: true`; handler **tidak dijalankan** (tidak ada check-in/tugas/komentar ganda) |
| Kunci sama, method atau path beda | `422 {message, reason: "idempotency_conflict"}` |
| Kunci sama, permintaan pertama masih diproses | `409 {message, reason: "idempotency_in_progress"}` + `Retry-After: 2` → ulangi setelah ≥ 2 detik (klaim tanpa hasil > 120 detik dianggap ditinggalkan dan diambil alih) |
| Format kunci salah | `422 {message, reason: "idempotency_key_invalid"}` |

**Yang disimpan (dan diputar ulang):** `2xx` serta `4xx` deterministik: `400, 403, 404, 409, 410, 422` — jadi absen yang ditolak bisnis (`outside_geofence`, `check_in_window`, `already_checked_in`, …) diputar ulang sama persis. **Tidak disimpan** (klaim dilepas, percobaan ulang dijalankan lagi): `401`, `419`, `429`, semua `5xx`, dan galat tak tertangkap. Konsekuensi untuk aplikasi: jangan memakai ulang kunci setelah pengguna **memperbaiki** isian yang ditolak `422` — buat kunci baru.

Batasan: badan respons > 256 KB tidak disimpan; bila `2xx`, percobaan ulang dijawab `200 {message: "Sudah diproses.", replayed: true}` (baca ulang sumber dayanya). Respons streaming/berkas tidak bisa diputar ulang (klaim dilepas). Badan **permintaan** (termasuk unggahan multipart/selfie) tidak pernah disimpan; hanya respons. Kunci disimpan **72 jam** (`api:prune-idempotency`, harian 03.30 WIB) — sama dengan batas absen offline; antrean yang lebih tua dari itu harus memakai kunci baru. Kunci dipisah per pengguna.

Urutan kirim: aplikasi harus mengirim antrean **berurutan menurut waktu aksi** (mis. absen masuk sebelum absen pulang; tugas dibuat sebelum komentarnya) dan menunggu respons sebelum aksi yang bergantung padanya.

## B. Absen offline

Berlaku untuk `POST /absensi/check-in`, `POST /absensi/check-out` (multipart, GPS + selfie) dan `POST /absensi/check-in/qr`, `POST /absensi/check-out/qr` (JSON/form). Dua field tambahan, opsional:

| Field | Tipe | Aturan |
|---|---|---|
| `offline` | boolean (`true`/`false`/`1`/`0`) | `true` = absen ditekan tanpa internet. Selain `true` → perilaku online persis seperti biasa (dan `offline_at` **diabaikan**) |
| `offline_at` | ISO-8601 **dengan offset** (mis. `2026-10-14T07:55:12+07:00` atau `…Z`) | wajib bila `offline=true`: jam perangkat **saat tombol ditekan** (bukan saat sinkron) |

Contoh (check-in GPS, multipart):

```
POST /api/v1/absensi/check-in
Idempotency-Key: 6f1c0f1a-2b7e-4a39-9d0c-8c1d6e2f7a10
latitude=-6.2003&longitude=106.8167&accuracy=12&selfie=<file>&work_plan[]=Selesaikan laporan
offline=true&offline_at=2026-10-14T07:55:12+07:00
```

### Apa yang berubah bila `offline=true`

`offline_at` dipakai sebagai "sekarang" di semua hitungan: tanggal kerja / hari terbuka (hari kemarin dengan shift malam), jadwal & shift, menit terlambat / pulang cepat, menit kerja, jendela **jam absen perusahaan** (`attendance_windows` dinilai pada `offline_at`), pembukaan absen masuk shift, verifikasi kode **QR** (jendela kode 30 detik dinilai pada `offline_at`; baris kode kiosk disimpan 4 hari), `occurred_at` log, `check_in_at`/`check_out_at` hari itu. Geofence tetap memakai GPS yang dikirim; persetujuan lokasi/selfie tetap diperiksa pada saat sinkron.

### Penolakan tambahan (422, bentuk sama dengan `outside_geofence` dst.: `{message, reason, context}`)

| `reason` | Kapan | `message` |
|---|---|---|
| `offline_clock_invalid` | `offline_at` hilang / bukan ISO-8601 beserta offset; **lebih dari 5 menit** di depan jam server; sebuah **absen pulang** dengan `offline_at` ≤ jam absen masuk hari itu; **tidak berurutan**: perangkat yang sama sudah menyinkronkan absen offline **bertipe sama** dengan `offline_at` **lebih baru** | `Jam perangkat tidak valid.` |
| `offline_expired` | `offline_at` lebih tua dari **72 jam** dari saat server menerima | `Absen offline lebih dari 72 jam tidak bisa disinkronkan; ajukan koreksi absensi.` |

Penolakan biasa tetap berlaku dan dinilai pada `offline_at`: `consent_required`, `already_checked_in` (mis. pengguna sempat absen online di hari yang sama), `already_checked_out`, `not_checked_in` (kirim masuk dulu, baru pulang), `too_early`, `check_in_window` / `check_out_window`, `outside_geofence`, `day_has_request`, `qr_*`. Untuk `offline_expired` dan `offline_clock_invalid` aplikasi menampilkan pesan lalu menawarkan **ajukan koreksi absensi**; antrean itu dibuang. Validasi bentuk (`offline` bukan boolean) → 422 Laravel standar `{message, errors}`.

### Log, penanda, peninjauan HR

- `attendance_logs.occurred_at` = `offline_at`; kolom baru **`received_at`** (null untuk log online) = waktu server benar-benar menerima.
- `flags` ditambah **`offline`** (label **"Absen offline"**); karena itu `is_suspicious = true` → log muncul di **"Perlu ditinjau"** HR (`GET /absensi/tim/perlu-ditinjau`) dan hari ditandai `isSuspicious`. Flag `clock_skew` **tidak** ditambahkan untuk log offline; `new_device`, `mock_location`, `low_accuracy`, `impossible_travel`, `dark_selfie` tetap bekerja (riwayat dibandingkan pada `offline_at`).
- Payload yang ditambah (semua `null`/`false` untuk log online):
  - respons check-in/out `result`: `isOffline` (bool), `receivedAt` (ISO UTC);
  - hari-ini (`AttendancePresenter::day()`): `checkIn` / `checkOut` (log ringkas) memuat `isOffline`, `receivedAt`;
  - riwayat/detail hari `GET /absensi/hari/{tanggal}` → `logs[].receivedAt` dan `flags[]` berisi `{code: "offline", label: "Absen offline"}`;
  - HR "Perlu ditinjau" → `items[].receivedAt` (+ `occurredAt` = jam perangkat) dan `flags[]` `{value: "offline", label: "Absen offline"}`.
- Salinan WhatsApp ke grup manajemen: baris `⚠️ Absen offline — tersinkron 09.40` ditambahkan setelah `Lokasi:` (jam kantor `received_at`); `Jam:` dan cap foto tetap jam perangkat.

### Hari yang sudah ditutup 00.30

`attendance:close-day` tidak menunggu absen offline; aturan yang berlaku (batas 72 jam):

- Hari **tanpa log apa pun** ditutup `absent` pukul 00.30 seperti biasa. Absen masuk offline (≤ 72 jam) untuk tanggal itu tetap **diterima** dan **menggantikan baris `absent`** dengan status sebenarnya (Hadir/Terlambat/WFH), menit terlambat dihitung dari `offline_at`.
- Hari dengan absen masuk tanpa absen pulang ditutup `needs_correction` (+ notifikasi "Check-out belum tercatat"). Absen pulang offline yang tiba kemudian diterima dan **mengembalikan status** (Hadir / Terlambat / WFH / Pulang cepat) serta menghitung menit kerja dari `offline_at`.
- Pengajuan cuti/izin/sakit/dinas penuh yang disetujui tetap memblokir absen (`day_has_request`), seperti online.

### Catatan untuk aplikasi

- Limiter `check-in` (6 permintaan/menit per pengguna) tetap berlaku untuk keempat endpoint; saat sinkron massal tangani `429` dengan `Retry-After` (klaim idempotensi dilepas pada 429, kunci boleh dipakai ulang).
- Kirim item absen **berurutan menurut `offline_at`**; antrean `check-in` sebelum `check-out` hari yang sama.
- Jam perangkat dapat diubah pengguna: server hanya menerima ≤ 5 menit di depan dan ≤ 72 jam di belakang, memeriksa urutan per perangkat, dan menandai semuanya untuk ditinjau HR — jam yang dipalsukan tidak diblokir otomatis.
- `selfie` dikirim saat sinkron (foto disimpan di perangkat sampai itu); cap waktu pada foto WhatsApp memakai `occurred_at` (jam perangkat).

## C. Variabel & operasional

- Tabel `api_idempotency_keys` + kolom `attendance_logs.received_at` (migrasi `2026_10_21_100000_*`, `2026_10_21_100100_*`, bisa di-rollback); perintah `api:prune-idempotency` terjadwal harian 03.30 WIB.
- `config/attendance.php` `qr.prune_after_days` dinaikkan 2 → 4 (kode QR yang dipindai offline diverifikasi saat sinkron).
- Uji: `tests/Feature/Api/IdempotencyApiTest.php`, `tests/Feature/Api/AttendanceOfflineApiTest.php`.
