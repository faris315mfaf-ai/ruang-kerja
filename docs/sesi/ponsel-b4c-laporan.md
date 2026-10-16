# Kontrak API — Bagian 4 / B4-C: Laporan progres harian

> Aplikasi Android (Expo), 13 Okt 2026. Prefiks `/api/v1`, semua butuh `Authorization: Bearer <token Sanctum>` (grup `auth:sanctum` + `throttle:api-v1`, 60/menit). Rute di `routes/api/auth/b4c-laporan.php`. Controller tipis (`app/Http/Controllers/Api/Reports/*`, `Api/Monitoring/MonitoringReportController`) di atas Action / Query / Policy web yang sama: `SaveDailyReport`, `SubmitDailyReport` (pindah tugas lewat `MoveTask` + `TaskPolicy::move`), `MyDailyReports`, `ReportTaskOptions`, `ReportPresenter`, `DailyWorkMonitor`, `ReportReaders`, `DailyReportPolicy`, Gate `monitorDailyReport`. Satu Query baru: `App\Domain\Reports\Queries\MonthlyReportCalendar` (riwayat per bulan terhadap jadwal). Tes: `tests/Feature/Api/LaporanHarianApiTest.php`. Acuan layar: `docs/mockups/android/spec/06-proyek-okr-monitoring.md` layar 28–34 (+ 38 detail monitoring). Aturan produk: `docs/PRD.md` M7 "Laporan progres harian", `docs/DATABASE.md` §4 `daily_reports`.
>
> **Konvensi galat** (sama dengan B1/B2): 401 tanpa token · 403 `{message}` tak berhak · 404 untuk yang tidak boleh diketahui keberadaannya (laporan orang lain yang tidak dibaca, draf orang lain) · 422 `{message, errors:{field:[…]}}` pesan Indonesia · 429 limiter. Waktu = ISO-8601 UTC/offset, tanggal = `YYYY-MM-DD` **tanggal kantor** (Asia/Jakarta). Laporan hanya bisa ditulis untuk tanggal kantor hari ini sampai 23.59.59; sesudahnya **403 `laporan_terkunci`** (§2).

## Objek bersama

**Report** (`ReportPresenter::report` + `locked`) — dipakai `GET/PUT /laporan/hari-ini`, kirim, dan detail:
```jsonc
{
  "id": "01…|null",                    // null = belum ada laporan hari ini
  "date": "2026-10-07",
  "status": "missing|draft|submitted", // missing hanya di GET /laporan/hari-ini sebelum simpan pertama
  "submitted_at": "iso|null",          // kirim PERTAMA (tidak berubah saat kirim ulang)
  "updated_at": "iso|null",
  "editable": true,                    // tanggal laporan = hari ini
  "locked": false,                     // kebalikan editable (tanggal sudah lewat)
  "summary": "string|null", "blockers": "string|null", "notes": "string|null",
  "items_count": 2,
  "hours": 3.5,                        // jumlah jam item, null bila 0
  "items": [ ReportItem ]
}
```
**ReportItem**:
```jsonc
{
  "id": "01…",
  "task_id": "01…|null",               // null = di luar tugas ATAU tugas yang tidak boleh dilihat pembaca
  "task_key": "PRJ-1|null",            // salinan saat lapor (selalu ada untuk item tugas)
  "task_title": "string|null",         // hanya bila pembaca boleh melihat tugasnya
  "is_task": true,                     // false = pekerjaan di luar tugas
  "progress_note": "string",
  "percent": 50,                       // 0–100 | null
  "hours": 3.5,                        // 0,25–24 | null
  "move_status_id": "01…|null",        // kolom "pindahkan ke" (null bila tugas tak terlihat)
  "status_category_after": "backlog|todo|in_progress|review|done|canceled|null"  // terisi setelah kirim
}
```
**TaskOption** (`ReportTaskOptions` — saran, pilihan yang sudah ada di laporan, hasil cari):
```jsonc
{
  "id": "01…", "key": "PRJ-1", "title": "Rekap stok gudang",
  "workspace": { "id", "key", "name", "type": "personal|team|division|project" },
  "status": { "id", "name", "category": "in_progress" },
  "due_date": "2026-10-09|null",
  "planned_today": true,               // direncanakan "Hari ini" di Ruang saya
  "can_move": true,                    // TaskPolicy::move (false: mode lihat saja / viewer)
  "statuses": [ { "id", "name", "category" } ]   // kolom workspace urut papan = target "pindahkan ke"; [] bila can_move false
}
```

## 1. Formulir hari ini

### `GET /laporan/hari-ini`
Policy `DailyReportPolicy::create` (karyawan aktif).
```jsonc
{
  "date": "2026-10-07",                       // tanggal kantor hari ini
  "deadline": "2026-10-07T16:59:59+00:00",    // 23.59.59 WIB dalam UTC
  "locked": false,                            // selalu false untuk hari ini (laporan lama: GET /laporan/{id})
  "scheduled": true,                          // hari kerja menurut jadwal shift (ScheduleResolver)
  "holiday": "Libur kantor|null",             // nama hari libur bila hari ini libur (scheduled=false)
  "can": { "edit": true, "submit": true },
  "report": Report,                           // status "missing" + id null bila belum pernah disimpan
  "suggestions": [ TaskOption ],              // ≤40: "Hari ini" di Ruang saya, ditugaskan ke saya, workspace pribadi (terbuka)
  "chosen": [ TaskOption ],                   // opsi tugas yang sudah ada di laporan (kolomnya diketahui walau tidak lagi disarankan)
  "limits": { "items": 30, "note": 2000, "text": 5000 }
}
```
Tidak terjadwal / hari libur tetap boleh menulis (seperti web); app menampilkan keadaan "hari libur".

### `PUT /laporan/hari-ini` — autosave (throttle `60,1` seperti web)
Body (aturan & pesan = `SaveDailyReportRequest` web):
```jsonc
{
  "report_date": "2026-10-07",   // opsional; kosong = hari ini. KIRIM tanggal saat formulir dibuka agar simpan sesudah 23.59 ditolak, bukan masuk laporan besok
  "summary": "…|null", "blockers": "…|null", "notes": "…|null",   // maks 5.000
  "items": [                      // WAJIB ada (boleh []): item diganti utuh; maks 30
    { "task_id": "ulid|null", "progress_note": "… (maks 2.000; boleh kosong di draf)",
      "percent": 0-100|null, "hours": 0.25-24|null, "move_status_id": "ulid|null" }
  ]
}
```
`200 { "report": Report }` — idempoten (body sama → laporan sama, satu baris per orang per tanggal). Laporan yang sudah terkirim tetap bisa diubah sampai 23.59 (`status` tetap `submitted`, `submitted_at` tetap).

Galat 422 (`errors`): `items` (tidak ada / > 30 / tugas sama dua kali), `items.N.task_id` ("Tugas tidak ditemukan atau tidak bisa Anda lihat."), `items.N.move_status_id` ("Kolom tujuan tidak ada di workspace tugas ini." / "Anda tidak bisa memindahkan PRJ-1."), `items.N.percent|hours|progress_note`, `summary|blockers|notes` (terlalu panjang), `report_date` (format salah).

### `POST /laporan/hari-ini/kirim` — kirim (throttle `30,1` seperti web)
Body sama dengan `PUT`. Tambahan wajib: minimal satu item (`items` 422 "Tambahkan minimal satu pekerjaan…"), tiap `progress_note` terisi (`items.N.progress_note` 422 "Tulis catatan progres…"). Menyimpan isi, memindah tugas yang punya `move_status_id` berbeda dari kolomnya sekarang (`MoveTask`, tunduk `TaskPolicy::move`), mengisi `status_category_after`, dan mengisi `submitted_at` pada kirim pertama. Boleh dikirim ulang sampai 23.59.

**Semua atau tidak sama sekali** (sama dengan web): bila satu pindah ditolak Policy → 422 `items.N.move_status_id`, tidak ada yang tersimpan dan tidak ada tugas yang dipindah.
```jsonc
{
  "report": Report,                       // status "submitted"
  "move_results": [                       // satu per item yang punya task_id + move_status_id
    {
      "task_id": "01…", "task_key": "PRJ-1",
      "moved": true,                      // kirim ini memindah tugasnya
      "from": { "id", "name", "category" } | null,   // kolom sebelum kirim
      "to":   { "id", "name", "category" } | null,   // kolom tujuan
      "error": null                       // teks bila tugas/kolom hilang di tengah jalan (moved=false); kirim ulang tanpa perubahan → moved=false, error=null
    }
  ],
  "message": "Laporan hari ini terkirim."
}
```

### 2. Terkunci — `403 laporan_terkunci`
`PUT` / `POST …/kirim` dengan `report_date` ≠ tanggal kantor hari ini (mis. formulir 7 Okt dikirim 8 Okt 00.01):
```json
{ "code": "laporan_terkunci",
  "message": "Laporan tanggal itu sudah terkunci (batas pukul 23.59). Muat ulang untuk menulis laporan hari ini.",
  "report_date": "2026-10-07", "today": "2026-10-08",
  "errors": { "report_date": ["…pesan yang sama…"] } }
```
App: tampilkan keadaan "terkunci" (baca saja) lalu muat ulang `GET /laporan/hari-ini` (laporan baru untuk hari ini).

### `GET /laporan/cari-tugas?q=` — pilih tugas lain (throttle `search` 120/menit seperti web)
`q` ≥ 2 karakter (dipotong 100), judul (ilike) atau kunci persis `KEY-12`, hanya tugas di workspace yang terlihat & tidak diarsipkan, maks 20, tugas terbuka dulu. `200 { "tasks": [ TaskOption ] }` (`[]` bila `q` < 2).

## 3. Riwayat

### `GET /laporan?bulan=YYYY-MM`
Laporan milik sendiri dalam satu bulan (bawaan: bulan ini). Hari yang ditampilkan = hari kerja terjadwal **atau** yang punya laporan, dari max(awal bulan, `joined_at`) sampai min(akhir bulan, hari ini), terbaru dulu.
```jsonc
{
  "bulan": "2026-10", "today": "2026-10-07",
  "bulan_sebelumnya": "2026-09",
  "bulan_berikutnya": null,                // null bila melewati bulan ini
  "counts": { "scheduled": 5, "submitted": 2, "draft": 1, "missing": 2 },  // missing = hari terjadwal tanpa laporan, HARI INI TIDAK dihitung
  "days": [
    {
      "date": "2026-10-07", "is_today": true,
      "scheduled": true,
      "holiday": "string|null",            // hanya muncul bila hari libur punya laporan
      "status": "submitted|draft|missing", // "missing" = hari terjadwal tanpa laporan (padanan "none")
      "report": null | {
        "id", "submitted_at", "updated_at", "summary", "has_blockers": bool,
        "items_count": 2, "hours": 3.5|null,
        "locked": true                     // tanggal sudah lewat
      }
    }
  ],
  "hari_ini": { "date", "status": "missing|draft|submitted", "submitted_at", "updated_at", "items_count", "locks_at" }  // = kartu Beranda (MyDailyReports::status)
}
```
422 `errors.bulan` bila format salah atau bulan di masa depan.

### `GET /laporan/{id}` — detail satu laporan
`DailyReportPolicy::view`: pemilik (draf atau terkirim, tanggal apa pun) atau pembaca untuk laporan **terkirim** (atasan langsung, Kepala Divisi divisinya, Direksi, HR, Super Admin; satu perusahaan). Lainnya / draf orang lain → **404**.
```jsonc
{
  "owner": { "id", "name", "avatar", "position", "division" },
  "mine": true,
  "report": Report,                         // judul tugas hanya bila penonton boleh melihat tugasnya
  "can": { "edit": true }                   // pemilik + tanggal hari ini → buka formulir GET /laporan/hari-ini
}
```

### `GET /laporan/orang/{user}` — riwayat satu orang (pembaca)
Policy `viewReportsOf` (sama dengan web `/laporan/{user}`; 404 bila bukan pembaca). Pembaca hanya melihat laporan terkirim; pemilik melihat semuanya. Maks 60 terbaru.
```jsonc
{
  "owner": { "id", "name", "avatar", "position", "division" },
  "mine": false,
  "reports": [ { "id", "date", "status": "submitted|draft", "submitted_at", "summary",
                 "has_blockers", "items_count", "hours", "editable" } ]
}
```

## 4. Pembaca

### `GET /laporan/tim?tanggal=YYYY-MM-DD`
Orang yang laporannya dibaca penonton (`ReportReaders::readableUsers`: bawahan langsung, divisi yang dipimpin Kepala Divisi termasuk sub-divisi, semua karyawan aktif untuk Direksi/HR/Super Admin; tidak termasuk diri sendiri). Tidak membaca siapa pun (staf) → **403** `{message}`. `tanggal` bawaan hari ini; format salah / masa depan → 422 `errors.tanggal`. Isi = query monitoring web `DailyWorkMonitor::for` (sama dengan panel Kadiv & monitoring Direksi):
```jsonc
{
  "date": "2026-10-07", "is_today": true,
  "totals": { "people": 2, "scheduled": 2, "reported": 1, "draft": 1, "missing": 0 },
    // reported = terkirim (terjadwal atau tidak); draft = ada draf; missing = terjadwal tanpa laporan apa pun
  "divisions": [ { "id": "01…|null", "name": "Operasional|Tanpa divisi", "people", "scheduled", "reported", "draft", "missing" } ],
  "missing": [ { "id", "name", "avatar", "division", "draft": true } ],
    // terjadwal & belum terkirim; draft=true = punya draf (ISI DRAF TIDAK PERNAH DIKIRIM)
  "reports": [                              // terkirim, terbaru dulu, maks 60
    {
      "id", "date",
      "user": { "id", "name", "avatar", "division" },
      "submitted_at", "summary", "blockers": "string|null",
      "items_count", "hours": 3.5|null,
      "items": [ MonitorItem ]
    }
  ]
}
```
**MonitorItem** (`ReportTasks::item`): `{ id, task_id (null bila tak terlihat / di luar tugas), key, title (null bila tak terlihat), url ("/w/KEY/tasks/N" web, null bila tak terlihat), workspace (nama|null), progress_note, percent, hours, status_category_after }`.

### `GET /monitoring/laporan/{id}`
Gate `monitorDailyReport` (sama dengan web `GET /monitoring/laporan/{id}`): penulis, Direksi/HR/Super Admin perusahaan (`dashboard.view_company`), atasan langsung, Kepala Divisi divisi penulis. Draf (siapa pun, termasuk penulis) dan lainnya → **404**.
```jsonc
{ "report": { "id", "date", "user": { "id", "name", "avatar", "division" }, "submitted_at",
              "summary", "blockers", "items_count", "hours", "items": [ MonitorItem ],
              "notes": "string|null" } }
```

## Catatan & keputusan
- **Konfirmasi kirim** (pertanyaan #5 spec 06) dan **draf offline** (#6) adalah urusan app; API tidak berubah: kirim selalu butuh koneksi, simpan lokal disinkron lewat `PUT` dengan `report_date` aslinya (bila sudah lewat 23.59 → `laporan_terkunci`, draf lokal dibuang/ditampilkan baca saja).
- Autosave: debounce ≥ 1,2 dtk. Limiter `api-v1` (60/menit untuk semua API) dan `60,1` web berlaku bersamaan.
- **"Sebagian gagal"** pada hasil pindah tidak terjadi untuk penolakan Policy (kirim ditolak utuh, sama dengan web); `move_results[].error` hanya untuk tugas/kolom yang hilang di tengah jalan.
- `missing` dipakai di seluruh modul (Beranda `laporan_hari_ini.status`, web) sebagai padanan "belum lapor / none".
- Tidak ada perubahan berkas web: hanya Query baru `MonthlyReportCalendar` di domain Reports.
