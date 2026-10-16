# Kontrak API — Bagian 2 / B2-B: Beranda, briefing, pengumuman, kinerja

> Aplikasi Android (Expo), 13 Okt 2026. Prefiks `/api/v1`, semua butuh `Authorization: Bearer <token Sanctum>` (grup `auth:sanctum` + `throttle:api-v1`, 60/menit). Rute di `routes/api/auth/b2b-beranda.php`. Controller tipis di atas Action / Query / Policy web yang sama; tes: `tests/Feature/Api/{BerandaApiTest,DashboardApiTest,BriefingWriteApiTest,AnnouncementApiTest,PerformanceApiTest,PeopleApiTest}.php`. Acuan layar: `docs/mockups/android/spec/02-beranda-dashboard.md`.
>
> **Konvensi galat** (sama dengan B1): 401 tanpa token · 403 `{message}` tak berhak · 404 untuk yang tidak boleh diketahui keberadaannya · 422 `{message, errors:{field:[…]}}` pesan Indonesia · 429 limiter. Waktu = ISO-8601 (`…Z` UTC atau offset), tanggal = `YYYY-MM-DD` tanggal kantor (Asia/Jakarta). Akun Super Admin tanpa 2FA terblokir lebih awal oleh middleware (403 `two_factor_required`), jadi tidak ada endpoint di sini yang dapat dicapai tanpa 2FA selesai.

## 1. Beranda

### `GET /beranda?periode=minggu|bulan|kuartal`
Satu payload untuk layar Beranda saya (semua karyawan; `periode` hanya memengaruhi `ringkasan`, bawaan `bulan`). Tiap bagian = query web yang sama; bagian yang melempar galat dilaporkan lalu menjadi `null` dan namanya masuk `bagian_gagal` (200 tetap) agar app menampilkan kartu "sebagian gagal" — bukan layar galat penuh.

```jsonc
{
  "server_time": "2026-10-06T02:00:00Z",
  "today": "2026-10-06",                      // tanggal kantor
  "pengguna": { "id": "01…", "name": "Rizky Aditya", "is_staff_only": true },
  "tampilan": {                               // pemilih tampilan dashboard
    "awal": "saya",                           // tampilan landing (DashboardAccess::defaultView)
    "tersedia": [ { "key": "saya", "label": "Saya", "tersedia": true } ]
    // key: saya | divisi | hr | direksi. "tersedia": false = ada hak tapi API-nya belum ada
    // (direksi → Bagian 5); app menampilkan chip nonaktif / tautan "buka di web".
  },
  "flags": {
    "rapat": true,                            // FEATURE_MEETINGS
    "kinerja": true,                          // FEATURE_AUTOMATION (tautan /kinerja)
    "saldo_cuti": false,                      // false untuk staf (tidak pernah ada saldo)
    "briefing_catat": false,                  // kartu "Catat briefing" ada (HR/SA/ditunjuk hari ini)
    "pengumuman_buat": false                  // boleh membuat pengumuman (FAB)
  },
  "attendance_status": {                      // MyAttendance::status — status ringkas hero; detail/aksi: GET /absensi/hari-ini
    "action": "check_in|check_out|done|unavailable",
    "status": "present|late|…|null", "statusLabel": "Hadir|null",
    "checkInAt": "iso|null", "checkOutAt": "iso|null", "lateMinutes": 0,
    "locationName": "string|null", "isRemote": false, "shiftName": "string|null",
    "start": "iso|null", "startLabel": "08.00|null", "end": "iso|null", "endLabel": "17.00|null",
    "distanceM": 32, "isHoliday": false
  },
  "rapat_berikutnya": { /* baris agenda GET /rapat (MeetingSummary::agenda): id, key, occurrence_date, title,
                           starts_at, ends_at, platform, location, join_url, organizer, rsvp_saya, minutes_status, … */ },
                                              // null bila modul rapat mati / tak ada rapat dalam 30 hari; rapat yang sedang berjalan ikut dihitung
  "tugas_hari_ini": {                         // TugasHariIni — sama dengan GET /tugas/hari-ini
    "today": "2026-10-06",
    "pribadi": [ Item ], "tim": [ Item ], "semua": [ Item ],
    "counts": { "pribadi": 1, "tim": 1, "semua": 2 }
    // Item: { id, key, title, workspace:{key,name}, status:{name,category,is_done}, priority:"Tinggi|…",
    //         assignees:[nama], source, assigned_by_other:bool, url }
  },
  "briefing_terakhir": { "period": "pagi|sore", "label": "Briefing pagi", "date": "2026-10-06",
                         "content": "…", "oleh": "Hana HR", "updated_at": "iso" },   // null bila belum ada
  "briefing_catat": { /* kartu pencatat — bentuk sama dengan `jendela` di §3 */ },     // null bila bukan pencatat
  "pengumuman": {                             // spanduk: maks. 3 terbaru yang belum ditutup + total
    "items": [ PengumumanItem ], "total": 4
  },
  "laporan_hari_ini": { "date": "2026-10-06", "status": "missing|draft|submitted",
                        "submitted_at": "iso|null", "updated_at": "iso|null", "items_count": 0, "locks_at": "iso" },
  "ringkasan": {                              // PersonalDashboard::metrics (cache 5 menit per pengguna+periode)
    "period": { "preset": "bulan", "from": "2026-10-01", "to": "2026-10-06", "label": "…", "previous_label": "bulan lalu" },
    "compared": { "current": Period, "previous": Period },
    "kpis": {
      "open_tasks": { "value": 3, "overdue": 1 },
      "completed": Compared, "on_time_rate": Compared, "completion_rate": Compared, "lead_time": Compared
      // Compared = { value, numerator, denominator, previous, delta }  (persen; lead_time dalam hari, 1 desimal)
    },
    "attendance": {
      "days": { "items": [ { "date", "status", "label", "late_minutes" } ],
                "counts": { "present", "late", "absent", "away" }, "workdays": 0 },
      "attendance_discipline": Compared, "average_lateness": Compared
    }
  },
  "profil": { "position": "Staf Operasional|null", "manager": "Dimas Pratama|null" },
  "saldo_cuti": null,                         // staf: SELALU null. Non-staf: { type, remaining, year } | null
  "pengajuan_terbaru": [ /* ≤3 baris RequestPresenter::item, bukan draf */ ],
  "bagian_gagal": []                          // nama bagian yang gagal dimuat (mis. ["briefing_terakhir"])
}
```
`PengumumanItem` — lihat §4. Tidak ada skor produktivitas gabungan.

**Catatan keputusan layar:** kartu "Laporan hari ini" dikirim sebagai data (`laporan_hari_ini`) — tampil atau tidaknya mengikuti keputusan pemilik soal Pertanyaan #1 spec 02 (web mencabutnya dari Beranda 9 Okt). Formulir/riwayat laporan = Bagian 4.

### `GET /dashboard/tampilan`
`200 { "awal": "saya|divisi|hr|direksi", "tampilan": [ { "key", "label", "active": bool, "tersedia": bool } ] }` — daftar tampilan yang boleh dibuka (`DashboardAccess::views`) dan landing-nya (`active`). Staf hanya `saya`. Sama dengan `beranda.tampilan`, untuk memuat ulang pemilih tanpa memuat Beranda.

## 2. Dashboard non-staf

Cakupan orang/divisi/tim, periode, dan hak = `DashboardContextResolver` + Gate `viewDashboard` web. Query umum: `?periode=minggu|bulan|kuartal|kustom` (+ `dari=`/`sampai=` `YYYY-MM-DD` untuk `kustom`; nilai rusak → bawaan: Kadiv `minggu`, HR `bulan`), `?divisi={ulid}`, `?tim={ulid}`. Divisi/tim di luar cakupan → **403**. Tidak berhak atas tampilan itu → **403**. Dashboard Direksi / Manajemen / Peran = Bagian 5.

Kepala (header) bersama:
```jsonc
{
  "view": "divisi|hr",
  "filters": {
    "periode": "minggu", "dari": null, "sampai": null, "divisi": null, "tim": null,
    "period": { "preset", "from", "to", "label", "previous_label" },
    "presets": [ { "value": "minggu", "label": "Minggu ini" }, … ],
    "divisions": [ { "id", "name" } ], "teams": [ { "id", "name", "division_id" } ]
  },
  "scope": { "label": "Divisi Operasional", "member_count": 3 }
}
```

### `GET /dashboard/divisi?bagian=semua|langsung|metrik`
Gate `viewDashboard(divisi)`: Kepala Divisi (divisi yang dipimpin, termasuk sub-divisi; unit Direksi tidak dihitung), HR, Super Admin (semua divisi). `bagian` memecah muatan agar kerangka bisa tampil dulu (padanan prop `deferred` web): `langsung` = `attendance`+`approvals`+`reports` (tanpa cache); `metrik` = hanya `metrics` (cache 5 menit); `semua` (bawaan) = keduanya.
```jsonc
{
  …header,
  "attendance": { "date", "counts": { "scheduled","present","late","away","not_checked_in","absent","leave","permit","sick","business_trip" },
                  "shifts": [ { "name","count" } ],
                  "people": [ { "user":{id,name,avatar,division_id,division}, "state":"present|late|away|not_checked_in|absent",
                                "status","status_label","late_minutes","check_in_at","request_type","is_suspicious" } ] },
  "approvals": { "count": 2, "items": [ RequestPresenter::item ≤3 ] },       // antrean persetujuan pemilik token
  "reports": { "date", "totals": {people,scheduled,reported,draft,missing},
               "missing": [ { id,name,avatar,division,draft } ],
               "reports": [ { id, user:{id,name,avatar,division}, submitted_at, items_count, has_blockers } ] },
  "metrics": {
    "period", "compared": { current, previous },
    "kpis": { "completion_rate": Compared, "on_time_rate": Compared,
              "overdue_tasks": { "value", "people", "top_person" }, "lead_time": Compared,
              "attendance_discipline": Compared, "average_lateness": Compared },
    "trend": [ 8 × { "week_start", "label", "value", "numerator", "denominator" } ],
    "workload": [ { "user":{id,name,avatar}, "open", "overdue", "estimate_hours" } ],
    "overdue": { "total", "items": [ TaskSummary ≤8 ] },
    "projects": [ { id,key,name,url,health,health_label,last_update_at,stale,target_date,lead } ]   // proyek berisiko
  }
}
```
Detail laporan per orang (`GET /monitoring/laporan/{id}`) = Bagian 5.

### `GET /dashboard/hr`
Gate `viewDashboard(hr)`: HR dan Super Admin (Direksi saja → 403). Filter divisi/tim opsional seperti web.
```jsonc
{
  …header,
  "attendance": { "date", "counts": {…seperti di atas}, "shifts": [ { name,count } ],
                  "review_count": 0, "missing_check_out_count": 1 },            // angka saja, tanpa daftar orang
  "pending": { "count": 2, "items": [ RequestPresenter::item ≤4 ] },            // pengajuan menunggu HR
  "hiring": { "tersedia": true },                                               // modul Hiring (Bagian 5) ada di web
  "briefing": { /* kartu pencatat §3 atau null */ },
  "pengumuman": { "items": [ PengumumanItem ], "total": 0 }                      // slot pengumuman
}
```

## 3. Briefing — menulis

Hak: HR + Super Admin, atau karyawan yang ditunjuk untuk tanggal + periode itu. Jendela (waktu kantor, ditentukan jam server): **pagi 08.00–11.00, sore 16.00–18.00** (akhir eksklusif). Pembaca (`GET /briefing/terakhir`) sudah ada di `routes/api.php`.

### `GET /briefing/jendela`
`200 { "jendela": Card|null, "can_delegate": bool }`. `jendela` = `null` bagi karyawan yang bukan HR/Super Admin dan tidak ditunjuk hari ini (kartu disembunyikan). Tidak pernah 403.
```jsonc
Card = {
  "date": "2026-10-06", "date_label": "Selasa, 6 Oktober 2026",
  "is_recorder": true,                // HR/Super Admin (bukan sekadar ditunjuk)
  "current": "pagi|sore|null",        // jendela yang sedang terbuka
  "can_record": true,                 // boleh menyimpan sekarang (jendela terbuka + berhak)
  "periods": [ { "value":"pagi","label":"Briefing pagi","starts_at":"08:00","ends_at":"11:00","status":"before|open|after" }, {sore…} ],
  "delegations": { "pagi": { "to":{id,name}, "by":{id,name} } },   // delegasi hari ini per periode ({} / hanya milik sendiri bagi yang ditunjuk)
  "saved":  { "pagi": SavedItem|null, "sore": SavedItem|null },     // catatan hari ini
  "latest": { "pagi": SavedItem|null, "sore": SavedItem|null }      // catatan terakhir periode yang belum ada hari ini
}
SavedItem = { id, date, period, title, content, saved_by:{id,name}, delegated_from:{id,name}|null, saved_at }
```

### `POST /briefing`  (limiter 20/menit)
Body `{ "period": "pagi|sore", "content": "teks, maks. 10000" }`. `SaveBriefing` web: upsert per perusahaan + tanggal + periode; notifikasi ke semua karyawan **hanya pada simpan pertama** (job antrean), simpan ulang hanya memperbarui isi.
- `201` pertama kali / `200` simpan ulang: `{ "message": "Briefing tersimpan dan dikirim ke semua karyawan." | "Briefing diperbarui.", "created": bool, "briefing": { "id", "period", "label", "date", "content", "oleh", "updated_at" } }`
- `403` bukan HR/Super Admin/ditunjuk hari ini · `422 period` di luar jendela ("Briefing pagi hanya bisa dicatat pukul 08:00–11:00 waktu kantor.") atau bukan pencatat periode itu · `422 content` kosong / > 10000.

### `POST /briefing/delegasi`  (limiter 20/menit)
Hanya HR & Super Admin. Body `{ "user_id": "<ulid karyawan>", "period": "pagi|sore" }` — selalu untuk **hari ini**; satu delegasi per periode (menunjuk lagi menggantikan). Yang ditunjuk diberi notifikasi in-app.
- `200 { "message": "Delegasi pencatatan briefing disimpan.", "delegation": { "date", "period", "to":{id,name}, "by":{id,name} } }`
- `403` bukan HR/SA · `422 user_id` diri sendiri / bukan karyawan aktif perusahaan Anda / tidak ditemukan · `422 period` jendelanya sudah lewat.
- **Tidak ada `DELETE /briefing/delegasi/{id}`**: web tidak punya aksi mencabut delegasi (hanya menggantikan), jadi tidak dibuat.

### `GET /orang?q=`
Pemilih orang (delegasi, dll.). Cakupan = pencarian "Orang" web: karyawan **aktif** dalam `User::visibleTo(pemilik token)` — perusahaan sama; HR/Direksi/Super Admin melihat semua; peran lain hanya diri sendiri + bawahan langsung + divisi yang dipimpin. `q` opsional (maks. 100 karakter; cocok nama atau email, tanpa membedakan huruf; kosong = 20 pertama), diurut nama, **maks. 20** baris.
`200 { "orang": [ { "id", "name", "initials": "RA", "avatar": "url|null", "position": "…|null", "division": "…|null" } ] }` — email tidak dikembalikan. `422 q` bila > 100 karakter.

## 4. Pengumuman

`PengumumanItem`:
```jsonc
{ "id", "title", "body", "audience": "all|division|team", "audience_label": "Semua karyawan|Divisi Operasional, Keuangan|Tim Gudang",
  "author": { "id","name","avatar" } | null, "published_at": "iso", "expires_at": "iso|null",
  "active": true,          // belum kedaluwarsa
  "dismissed": false,      // spanduk sudah saya tutup (hanya bermakna di tab untuk-saya & detail)
  "can_delete": false }    // saya pembuatnya
```
Paginasi 20/halaman, blok `meta` sama dengan `GET /tugas` (`current_page, from, last_page, per_page, to, total`; `?page=`).

| Endpoint | Perilaku |
|---|---|
| `GET /pengumuman?tab=untuk-saya\|saya-buat` | Bawaan `untuk-saya`: pengumuman aktif yang ditujukan ke saya, terbaru dulu, yang sudah ditutup tetap ada (`dismissed:true`). `saya-buat`: yang saya tulis, kedaluwarsa ikut. `200 { tab, items:[PengumumanItem], meta, can_create }` (`can_create` → tampilkan tab "Saya buat"/FAB). |
| `GET /pengumuman/spanduk` | Spanduk Beranda/dashboard: `200 { items:[PengumumanItem ≤3], total }` (aktif, ditujukan ke saya, belum ditutup). |
| `GET /pengumuman/audiens` | Pilihan penerima untuk formulir: `200 { audiences:[{value,label}], divisions:[{id,name}], teams:[{id,name}] }`. Direksi/HR/SA: `all`+`division`+`team` (semua divisi/tim); Kepala Divisi: `division` (divisi yang dipimpin + sub-divisi, nama divisi); Ketua Tim: `team` (timnya). **403** bila tak boleh mengumumkan. |
| `GET /pengumuman/{id}` | `200 { pengumuman: PengumumanItem }`. **404** bila tidak ditujukan ke saya dan bukan saya pembuatnya (juga perusahaan lain / sudah dihapus). |
| `POST /pengumuman` | (limiter 20/menit) Body `{ title (≤160), body (≤5000), audience: all\|division\|team, target_ids?: [ulid] (maks 50), expires_on?: "YYYY-MM-DD" }`. `201 { message: "Pengumuman diterbitkan.", pengumuman }`; penerima (semua karyawan aktif sasaran kecuali pembuat) diberi notifikasi `system.announcement` lewat job `SendAnnouncementNotifications`. **403** peran tak berhak mengumumkan · `422` field validasi · `422 target_ids` audiens/target di luar hak ("Pilih divisi atau tim yang Anda pimpin.") · `422 expires_on` sebelum hari ini. `expires_on` = tampil sampai akhir hari itu (waktu kantor). |
| `DELETE /pengumuman/{id}` | Hanya pembuat. `204`. Hilang dari semua dashboard; notifikasi Inbox yang sudah terkirim tetap. **403** bila bukan pembuat tapi penerimanya · **404** bila tak terlihat. |
| `POST /pengumuman/{id}/tutup` | Tutup spanduk untuk saya saja (idempoten, notifikasi Inbox tidak berubah). `204`. **404** bila tidak ditujukan ke saya. |

## 5. Kinerja saya

Di balik flag `FEATURE_AUTOMATION` (404 saat mati). Metrik output berdampingan (`PersonalPerformance`), **tanpa skor produktivitas gabungan**. Hak = Gate `viewPerformance` web: diri sendiri; atasan langsung dan HR atas karyawan; selain itu **404** (tidak mengonfirmasi keberadaan orangnya — termasuk Direksi, Kepala Divisi lain, Super Admin, perusahaan lain). Membuka kinerja orang lain dicatat di audit (`performance.viewed`).

### `GET /kinerja?periode=minggu|bulan|kuartal`  ·  `GET /kinerja/{user}?periode=…`
`periode`: `minggu` (alias `8-minggu`, bawaan, = 8 minggu Senin) · `bulan` · `kuartal`; nilai lain → `minggu`.
```jsonc
{
  "periode": "minggu|bulan|kuartal",
  "kinerja": {
    "person": { "id", "name", "title": "jabatan|null", "is_self": true },
    "period": "8w|month|quarter", "period_label": "…",
    "counts": { "label", "due", "done_of_due", "done_with_due", "on_time", "lead_time": 2.5, "lead_time_samples",
                "division_lead_time": 3.0, "scheduled_days", "on_time_days", "attendance_label" },
    "weeks": [ { "week_start": "2026-08-17", "on_time": 3, "late": 1 } ],        // grafik mingguan (8 / menyesuaikan periode)
    "by_workspace": [ { "workspace": {id,key,name,color}, "done": 4 } ],         // workspace yang tak terlihat → "Workspace lain"
    "overdue": [ { "key","title","due_date","url" } ], "overdue_count": 1,         // ≤10, tugas workspace terlihat saja
    "attendance": { "label", "on_time_rate": 92, "average_check_in": "07.52|null" }
  }
}
```

## 6. Yang tidak dibangun / catatan untuk integrator
- **DELETE delegasi briefing**: web tidak punya (lihat §3).
- **Direksi / Manajemen / dashboard jabatan** (`/dashboard/direksi`, `/manajemen`, `/peran/*`, `/monitoring/laporan/{id}`, `/catatan-tindakan`): Bagian 5; di `beranda.tampilan` ditandai `tersedia:false`.
- **Laporan harian** (`/laporan/*`): Bagian 4; Beranda hanya membawa status kartunya.
- Perubahan di berkas web (bukan duplikasi): `AnnouncementFeed::present()` jadi `public` + `receivedPage()`/`authoredPage()` (paginasi untuk API), `Dashboard\DashboardController::teamReports()` & `hiringUrl()` jadi `public static` (dipakai ulang oleh controller API).
- Tes memakai `Sanctum::actingAs` (middleware `EnsureApiAccountUsable` tetap aktif); Super Admin tanpa 2FA tidak dapat diuji lewat jalur ini karena terblokir 403 sebelum controller.
- Menjalankan tes saat agen lain memigrasi DB tes yang sama (`ruangkerja_testing_bagian2`) bisa memunculkan galat migrasi/`relation does not exist` palsu; ulangi setelah ±30 detik.
