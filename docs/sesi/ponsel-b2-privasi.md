# Kontrak API — Bagian 1 / B2: Privasi & perangkat

> Ditulis 13 Okt 2026 (Claude Code, agen B2). Digabung ke `docs/sesi/ponsel.md` oleh integrator. Semua rute di bawah `/api/v1`, JSON, Bahasa Indonesia, Bearer token Sanctum kecuali dinyatakan lain. Pengguna harus aktif; semua endpoint hanya menyentuh data **pemilik token** (tidak ada parameter id pengguna).
>
> Galat umum: `401` tanpa/invalid token; `422` validasi `{message, errors{kolom:[pesan]}}`; `429` `{message:"Terlalu banyak permintaan. Coba lagi beberapa saat lagi.", code:"throttled"}` (limiter `api-v1` 60/menit per pengguna) atau body bawaan Laravel untuk limiter per-rute di bawah.

## Ringkasan

| Metode | Path | Auth | Limiter tambahan |
|---|---|---|---|
| GET | `/privasi/data-saya` | Bearer | — |
| GET | `/privasi/ekspor?format=xlsx\|pdf` | Bearer | 10/menit |
| GET | `/persetujuan` | Bearer | — |
| POST | `/persetujuan` | Bearer | 20/menit |
| DELETE | `/persetujuan` | Bearer | 20/menit |
| GET | `/kebijakan-privasi` | **publik** | `api-v1` per IP (60/menit) |
| PATCH (atau PUT) | `/perangkat/{device}/biometrik` | Bearer | — |
| POST | `/tautan-desktop` | Bearer | **3/menit** |

## 1. Data Saya

### `GET /privasi/data-saya`
Prinsip sama dengan halaman web `/privasi` (`MyData`), tetapi semua blok dimuat sekaligus. NIK **selalu tersamar**; NIK mentah tidak pernah dikirim.

200:
```json
{
  "policy": { "version": "1.0", "effective_date": "2026-10-05" },
  "profile": {
    "name": "…", "email": "…", "employee_number": "EMP-00042" | null,
    "nik_masked": "••••••••••••0123" | null, "phone": null, "birth_date": "2000-01-31" | null,
    "address": null, "emergency_contact": "Nama · Hubungan · 0812…" | null,
    "division": "…" | null, "team": null, "position": null, "manager": null,
    "work_mode": "Kantor", "status": "Aktif", "joined_at": "2024-01-02" | null,
    "roles": ["anggota"], "google_linked": false, "two_factor": false,
    "last_login_at": "2026-10-05T02:00:00+00:00" | null
  },
  "consent": { …bentuk sama seperti GET /persetujuan → consent… },
  "status_labels": { "present": "Hadir", "late": "Terlambat", … },
  "attendance": {
    "total_days": 12, "counts": { "present": 10, "late": 2 },
    "first_date": "2026-01-05" | null, "logs": 24, "selfies": 20,
    "days": [ { "date": "2026-10-02", "status": "late", "status_label": "Terlambat", "shift": "Reguler",
                "check_in_at": "ISO8601|null", "check_out_at": "…", "check_in": "08.12", "check_out": "17.01",
                "method": "GPS + selfie", "location": "Kantor Pusat", "late_minutes": 12,
                "early_leave_minutes": 0, "work_minutes": 480, "overtime_minutes": 0, "note": null } ]   // ≤ 31 hari terbaru
  },
  "requests":  { "count": 3, "items": [ { "id","number","type","summary","reason","status","status_label","submitted_at","decided_at","url" } ] },   // ≤ 20 terbaru
  "decisions": { "count": 0, "items": [ { "id","request_id","number","requester","type","summary","decision","decision_label","note","decided_at","url" } ] } // ≤ 20 terbaru
}
```
`url` pada requests/decisions adalah path web (bukan endpoint API). Batas daftar dari `config/privacy.php` (`page.*`); rekap lengkap lewat ekspor.

### `GET /privasi/ekspor?format=xlsx|pdf`
Mengalirkan berkas yang **sama** dengan web (`ExportMyData`): `xlsx` = satu lembar per jenis data, `pdf` = A4 lanskap. Respons berkas (`Content-Disposition: attachment; filename="data-saya-<nama>-<yyyymmdd>.xlsx|pdf"`; `Content-Type` xlsx = `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, pdf = `application/pdf`). Setiap ekspor diaudit (`privacy.data_exported`, pelaku = pemilik).
Aplikasi mengunduh dengan header `Authorization: Bearer …` ke berkas lokal lalu membagikannya (share sheet).
Galat: 422 `errors.format` — "Format unduhan wajib dipilih (xlsx atau pdf)." / "Format unduhan harus xlsx atau pdf."; 429 setelah 10 permintaan/menit.

## 2. Persetujuan lokasi & selfie (UU PDP)

Bentuk `consent` (dipakai GET/POST/DELETE dan di Data Saya):
```json
{
  "granted": true,                  // lokasi DAN selfie, versi terkini, belum dicabut
  "version": "1.0",                 // versi persetujuan saat ini (config attendance.consent.version)
  "policy_version": "1.0",          // versi kebijakan privasi
  "granted_version": "1.0" | null,  // versi persetujuan aktif milik pengguna
  "granted_at": "ISO8601" | null,
  "needs_renewal": false,           // pernah setuju, tetapi versi lama → minta setuju ulang (mis. v1.1)
  "retention_months": 12,           // retensi selfie
  "types": {
    "location": { "label": "Lokasi",     "granted": true, "granted_version": "1.0", "granted_at": "ISO8601" },
    "selfie":   { "label": "Foto selfie", "granted": true, "granted_version": "1.0", "granted_at": "ISO8601" }
  },
  "history": [ { "id","type":"location|selfie","type_label","version","granted_at","revoked_at":null|"ISO8601" } ]   // terbaru dulu
}
```
Layar: belum setuju = `granted:false, needs_renewal:false`; perlu ulang = `needs_renewal:true`.

- `GET /persetujuan` → `200 { "consent": {…} }`.
- `POST /persetujuan` body `{ "types": ["location","selfie"] }` → `200 { "message": "Persetujuan data lokasi & selfie disimpan.", "consent": {…} }`. Memakai `GiveAttendanceConsent` web (idempoten; audit `attendance.consent_granted`). **Kedua jenis wajib dikirim bersamaan** (check-in GPS + selfie membutuhkan keduanya dan Action mencatatnya bersama); 422 `errors.types` — "Persetujuan lokasi dan selfie harus diberikan bersama untuk check-in GPS + selfie." atau "Jenis persetujuan tidak dikenal." / "Jenis persetujuan wajib dikirim." / "Jenis persetujuan terduplikasi."
- `DELETE /persetujuan` → `200 { "message": "Persetujuan data lokasi & selfie dicabut.", "revoked": 2, "consent": {…} }`. Memakai `RevokeAttendanceConsent` web: audit `attendance.consent_revoked` dan notifikasi `attendance.consent_revoked` ke HR perusahaan. Idempoten: tanpa persetujuan aktif → `revoked: 0`, tanpa audit/notifikasi. Setelah dicabut, check-in GPS + selfie ditolak (`consent_required`) sampai disetujui lagi; QR dan koreksi tetap tersedia.

## 3. Kebijakan privasi (publik)

### `GET /kebijakan-privasi`  (tanpa Authorization)
Sumber Markdown yang sama dengan web (`resources/markdown/privacy-policy.md` + `config/privacy.php`; placeholder terisi, komentar editor dibuang, tag HTML mentah dihapus). Dipecah pada judul `## `. `Cache-Control: public, max-age=300`.
```json
{
  "title": "Kebijakan Privasi",
  "version": "1.0",
  "effective_date": "2026-10-05",
  "sections": [ { "title": "1. Ringkasan", "body_markdown": "…" }, … ]   // saat ini 9 seksi; bila ada teks sebelum judul pertama → seksi "Pendahuluan" di awal
}
```
`body_markdown` memakai Markdown biasa (paragraf, daftar, **tebal**, tautan). Aplikasi menyimpan salinan terakhir untuk mode luring.

## 4. Sakelar biometrik per perangkat

### `PATCH /perangkat/{device}/biometrik`  (juga diterima `PUT`)
Body `{ "enabled": true|false }`. `{device}` = ULID perangkat. Hanya perangkat **milik sendiri** (`DevicePolicy::update`); perangkat orang lain / HR / Super Admin → `403`; perangkat tak ada → `404`.
200: `{ "message": "Buka dengan sidik jari diaktifkan." | "…dimatikan.", "device_id": "<ulid>", "biometric_login": true }`. Perubahan nilai diaudit `device.biometric_changed`; nilai sama = tanpa audit. 422 `errors.enabled` — "Pilihan aktif atau nonaktif wajib dikirim." / "…tidak valid."
**Kolom `devices.biometric_login` (bool, default false) sudah ada sejak F3-1 — tidak ada migrasi baru.** Daftar `GET /perangkat` sudah memuat `biometric_login` per perangkat. Server hanya menyimpan penanda pilihan; pemeriksaan biometrik (BiometricPrompt + kunci Keystore) sepenuhnya di aplikasi.

## 5. Kirim tautan desktop ke email saya

### `POST /tautan-desktop`
Body `{ "path": "/pengaturan/keamanan" }`. Antrekan email (`DesktopLinkMail`, antrean) berisi URL absolut `APP_URL + path` ke **alamat email pemilik token saja** (field lain seperti `email`/`to` diabaikan). Tanpa token tertanam: tautan baru terbuka setelah masuk di web. Audit `account.desktop_link_sent` (hanya path).
200: `{ "message": "Tautan dikirim ke <email>.", "email": "<email>" }`.
422 `errors.path` — "Halaman ini tidak dapat dikirim sebagai tautan." bila path tidak valid atau di luar allowlist; "Halaman tujuan wajib diisi." / "…terlalu panjang." Limiter **3/menit** per pengguna (429).

Aturan path: harus berupa path internal polos `^/[A-Za-z0-9._~\-/]*$` (tanpa skema/host, query, fragmen, spasi, backslash, `//`, segmen `.`/`..`) **dan** cocok salah satu pola `config/api_app_links.php` → `allowed_paths` (wildcard `*`): `/pengaturan/keamanan`, `/settings/security`, `/pengaturan/perangkat`, `/organisasi/struktur`, `/admin/*`, `/manajemen`, `/manajemen/*`, `/hiring`, `/hiring/*`, `/absensi/rekap`, `/absensi/kedisiplinan[/*]`, `/portofolio[/*]`, `/okr[/*]`, `/otomasi[/*]`. Tambah pola di berkas konfigurasi itu bila modul berikutnya butuh.

## Berkas

- Rute: `routes/api.php` (blok `// --- B2 privasi ---`, dua blok: publik + terautentikasi).
- Controller: `app/Http/Controllers/Api/Privacy/{MyDataController,ConsentController,PrivacyPolicyController}`, `Api/Devices/DeviceBiometricController`, `Api/Account/DesktopLinkController`.
- Domain: `app/Domain/Privacy/Services/{ConsentOverview,PolicyDocument}`, `Devices/Actions/UpdateDeviceBiometric`, `Organization/Actions/SendDesktopLink`, `Organization/Mail/DesktopLinkMail` (+ `resources/views/mail/desktop-link*.blade.php`).
- FormRequest: `app/Http/Requests/Api/{MyDataExportRequest,GrantConsentRequest,BiometricRequest,DesktopLinkRequest}`.
- Tes: `tests/Feature/Api/PrivacyApiTest.php` (33 kasus).

## Catatan untuk integrator / B1
- Endpoint privasi sengaja **tidak** ada di daftar putih `EnsureApiAccountUsable::ALLOWED_ROUTES`: akun yang wajib ganti sandi harus menggantinya dulu.
- Spesifikasi `01-akses-akun.md` menulis `PUT /perangkat/{device}/biometrik`; tugas B2 meminta `PATCH` — keduanya diterima.
- Rute persetujuan memakai path `/persetujuan` (bukan `/absensi/persetujuan` seperti saran spesifikasi 03); aplikasi cukup satu klien untuk Absensi dan Privasi.
