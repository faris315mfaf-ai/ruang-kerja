# Kontrak API — Bagian 5 / B5-A: Manajemen (portofolio, proyek, Dashboard Manajemen, catatan tindakan, OKR, monitoring Direksi)

> Aplikasi Android (Expo), 13 Okt 2026. Prefiks `/api/v1`, semua butuh `Authorization: Bearer <token Sanctum>` (grup `auth:sanctum` + `throttle:api-v1`, 60/menit per pengguna). Rute di `routes/api/auth/b5a-manajemen.php`. Controller tipis (`app/Http/Controllers/Api/{Projects,Management,Okr}/*`, `Api/Monitoring/WorkMonitoringController`) di atas Query / Action / Policy / FormRequest **web yang sama**: `PortfolioDashboard`, `ProjectSummary`, `PostProjectUpdate`, `ResolveProjectDecision`, `RequestProjectUpdate`, `GiveProjectDirection`, `SaveMilestone`, `SetMilestoneCompletion`, `DeleteMilestone`, `SaveProjectRisk`, `DeleteProjectRisk`, `ManagementDashboard`, `ManagementNotes` + Action catatan, `MeetingFeed`, `OkrIndex`, `ObjectiveDetail`, Action OKR, `LinkableTasks`, `DailyWorkMonitor`, `WeeklyWorkMonitor`, `ProjectWorkMonitor`, `WorkspaceDirectory`. Presenter baru: `app/Http/Resources/Api/Manajemen/{ProjectApi,OkrApi}.php`. **Tanpa perubahan skema, tanpa paket baru, tanpa mengubah berkas web.**
>
> Tes: `tests/Feature/Api/Manajemen{Proyek,Dashboard,Okr,Monitoring}ApiTest.php` (49 tes). Acuan layar: `docs/mockups/android/spec/06-proyek-okr-monitoring.md` layar 01–27 dan 35–40 (laporan harian 28–34 = B4-C, `docs/sesi/ponsel-b4c-laporan.md`). Aturan produk: `docs/PRD.md` M7/M10, `docs/fitur/okr.md`, `docs/DATABASE.md` §4/§8.
>
> **Konvensi galat** (sama dengan B1–B4): 401 tanpa token · 403 `{message}` tak berhak (pesan Indonesia dari Policy bila ada, mis. "Keputusan ini sudah ditandai selesai.") · 404 untuk yang tidak boleh diketahui keberadaannya (proyek/objective/catatan yang tidak terlihat, workspace bukan proyek, fitur OKR mati) · 422 `{message, errors:{field:[…]}}` pesan Indonesia · 429 limiter. Super Admin tanpa TOTP → 403 `{code:"two_factor_setup_required"}` di semua API (EnsureApiAccountUsable, B1). Waktu = ISO-8601 (UTC, `+00:00` atau `Z`), tanggal = `YYYY-MM-DD` **tanggal kantor** (Asia/Jakarta). `DELETE` sukses = **204** tanpa badan. Field `url` di beberapa objek adalah rute **web** (`/w/PLQ/ringkasan`, `/w/OPS/tasks/1`) — aplikasi memakai `key` / `id` untuk navigasi, `url` boleh diabaikan.
>
> **Peran singkat** (Policy web): Direksi & Super Admin = `portfolio.view` (portofolio, monitoring, aksi pengarah). HR = `dashboard.view_company` tanpa portofolio/monitoring. Dashboard Manajemen & catatan tindakan = `dashboard.view_company` (Direksi, HR, Super Admin). Kepala Divisi = proyek yang melibatkan divisinya (baca saja). PIC & admin/owner workspace proyek = tulis update/milestone/risiko.

## Daftar endpoint

| # | Metode & path | Akses | Layar |
|---|---|---|---|
| P1 | `GET /portofolio` | Gate `viewPortfolio` (Direksi, Super Admin, Kepala Divisi) | 01–04 |
| P2 | `GET /proyek/{key}` | lihat proyek | 05–07, 10–15 |
| P3 | `GET /proyek/{key}/update` | lihat proyek | 09 |
| P4 | `POST /proyek/{key}/update` | PIC / admin | 08 |
| P5 | `POST /proyek/{key}/update/{updateId}/keputusan` | Direksi/Super Admin | 03, 05, 10 |
| P6 | `POST /proyek/{key}/minta-update` | Direksi/Super Admin | 03, 10 |
| P7 | `POST /proyek/{key}/arahan` | Direksi/Super Admin | 03, 10 |
| P8–P11 | `POST/PATCH/PATCH …/selesai/DELETE /proyek/{key}/milestone[/{id}]` | PIC / admin | 11–12 |
| P12–P15 | `POST/PATCH/PATCH …/status/DELETE /proyek/{key}/risiko[/{id}]` | PIC / admin | 13 |
| M1 | `GET /manajemen` | `dashboard.view_company` | 16, 20 |
| M2 | `GET /manajemen/ringkasan` | idem | 16–17 |
| M3 | `GET /manajemen/proyek` | idem | 16 |
| M4 | `GET /manajemen/beban-kerja` | idem | 18 |
| M5 | `GET /manajemen/jadwal-terdekat` | idem | 16 |
| N1–N6 | `GET/POST /catatan-tindakan`, `PATCH/DELETE /catatan-tindakan/{id}`, `POST /catatan-tindakan/{id}/pindah`, `PUT /catatan-tindakan/urutan` | pemilik (`dashboard.view_company`) | 16, 19, 35 (tab Catatan) |
| O1 | `GET /okr` | semua karyawan (isi sesuai akses) | 21–22, 27 |
| O2 | `GET /okr/{objectiveId}` | lihat objective | 23, 27 |
| O3 | `GET /okr/kr/{krId}` | lihat objective | 24 (deep link check-in) |
| O4–O6 | `POST /okr`, `PATCH /okr/{id}`, `POST /okr/{id}/tutup` | Kadiv divisi / Direksi | 26 |
| O7–O9 | `POST /okr/{id}/kr`, `PATCH/DELETE /okr/kr/{krId}` | pemilik objective/KR, Kadiv | 26 |
| O10 | `POST /okr/kr/{krId}/check-in` | pemilik KR, pemilik objective, Kadiv | 24 |
| O11–O13 | `GET/POST /okr/kr/{krId}/tugas`, `DELETE /okr/kr/{krId}/tugas/{taskId}` | idem | 25 |
| D1 | `GET /monitoring/harian` | Gate `viewDashboard` Direksi (Direksi, Super Admin) | 35 |
| D2 | `GET /monitoring/mingguan` | idem | 36 |
| D3 | `GET /monitoring/proyek` | idem | 37 |
| D4 | `GET /monitoring/workspace` | idem | 37 |
| — | `GET /monitoring/laporan/{id}` (sudah ada, B4-C) | Gate `monitorDailyReport` | 38 |
| — | `GET /manajemen/jadwal` (sudah ada, B4-B) | `dashboard.view_company` | jadwal pimpinan penuh |

`{key}` proyek = key workspace (`PLQ`, tidak peka huruf, key lama juga diterima) **atau** ULID-nya; binder web: tidak terlihat → 404 sebelum validasi apa pun; workspace yang bukan proyek → 404.

---

## Objek bersama

**Person**: `{ "id": "01…", "name": "Sari Wulandari", "avatar": "https://…|null" }`

**ProjectRef** (`WorkspaceResource::reference`): `{ "id", "key": "PLQ", "name", "type": "project", "color": "violet" }` — `color` = nama palet (`gray|slate|teal|blue|green|amber|orange|red|violet|pink`).

**Enum**
- `health` (status kesehatan **ditetapkan PIC**): `on_track` Sesuai jalur · `at_risk` Berisiko · `off_track` Bermasalah · `null` belum ada update.
- `project_status`: `planned` · `active` · `on_hold` · `completed` · `canceled`.
- `metrics.flags` (penanda sistem, dihitung): `behind` (selisih ≤ −15 poin) · `missed_milestone` · `stale_update` (update terakhir > 7 hari).
- milestone `status` (diturunkan): `not_started` Belum mulai · `in_progress` Berjalan · `completed` Selesai · `completed_late` Selesai terlambat · `missed` Terlewat.
- risiko `level`: `high` Tinggi · `medium` Sedang · `low` Rendah; `status`: `open` · `resolved`.
- tugas `status_category`: `backlog|todo|in_progress|review|done|canceled`.

**ProjectRow** (`ProjectPresenter::project`) — kartu proyek portofolio, kepala detail, monitoring proyek:
```jsonc
{
  "id": "01…", "key": "PLQ", "name": "Peluncuran Q4", "type": "project", "color": "violet",
  "division": "Operasional|null",            // divisi utama
  "lead": Person|null,                         // PIC
  "sponsor": Person|null,                      // Direksi sponsor
  "start_date": "2026-09-01|null", "target_date": "2026-10-27|null",
  "project_status": "active", "health": "at_risk|null",
  "last_update_at": "2026-10-11T03:00:00+00:00|null", "completed_at": "iso|null",
  "metrics": {
    "actual": 50,          // % progres aktual (0–100, null bila belum ada tugas)
    "planned": 75,         // % progres rencana (null tanpa tanggal)
    "variance": -25,       // poin persentase (aktual − rencana), null bila salah satu null
    "uses_estimates": false,   // true = aktual memakai bobot estimate_hours
    "flags": ["behind", "missed_milestone"],
    "overdue": 2,          // tugas terlambat
    "scope": 4, "done": 2, // tugas non-batal / selesai
    "update_age_days": 2|null, "days_left": 14|null,
    "milestones_total": 2, "milestones_done": 0,
    "missed_milestones": [ { "id", "name", "target_date" } ],
    "milestones": [ { "id", "name", "target_date", "status": "missed" } ]
  },
  "next_milestone": { "id", "name", "target_date", "status" } | null   // "Berikutnya: …" (pengganti roadmap)
}
```

**ProjectUpdate** (`ProjectApi::update`):
```jsonc
{
  "id": "01…", "health": "at_risk",
  "summary": "Landing page 4/7 bagian.", "blockers": "string|null",
  "decision_needed": "Tambahan anggaran vendor video.|null",
  "decision_resolved_at": "iso|null", "decision_resolved_by": "Hendra Wijaya|null",
  "progress_snapshot": 50|null, "planned_snapshot": 75|null,   // progres saat update ditulis (pakai ini, jangan hitung ulang)
  "author": Person|null, "created_at": "iso",
  "directions": [ Direction ],     // arahan Direksi yang membalas update ini, terlama dulu
  "can_resolve": true              // keputusan terbuka + penonton boleh "Tandai selesai"
}
```
**Direction**: `{ "id", "body", "author": Person|null, "project_update_id": "01…|null", "created_at" }` (`project_update_id` null = arahan umum).

**TaskRef**: `{ "id", "code": "PLQ-3", "title", "status_category", "status_color": "slate|null" }` (`status_color` hanya di detail proyek; di jawaban tulis milestone/risiko `null`).

---

## 1. Portofolio & proyek divisi

### P1 `GET /portofolio?periode=kuartal|bulan|semua&divisi={divisionId}&status=on_track|at_risk|off_track&arsip=1`
Gate `viewPortfolio`: **Direksi & Super Admin** melihat semua proyek (`mode: "direksi"`, `can.steer: true`); **Kepala Divisi** melihat proyek yang melibatkan divisinya + proyek tempat ia anggota/PIC/sponsor (`mode: "divisi"` = layar 04 "Proyek divisi", baca saja, tanpa Minta update/Beri arahan, `attendance: null`). **HR & staf → 403** (layar 02-6 terkunci). Nilai filter salah diabaikan (bawaan `kuartal`, tanpa divisi/status). `periode` menyaring proyek terbuka yang rentang [mulai, target]-nya beririsan; `arsip=1` menampilkan proyek selesai/batal (bukan yang terbuka). Chip status = `status` (Semua = tanpa parameter). Roadmap **tidak** dikirim (desktop saja, layar 40).
```jsonc
{
  "mode": "direksi|divisi",
  "as_of": "2026-10-13",
  "period_label": "Q4 2026",                     // "Oktober 2026" | "Semua periode"
  "filters": { "periode": "kuartal", "divisi": null, "status": null, "arsip": false },
  "division_options": [ { "value": "01…", "label": "Keuangan" } ],   // divisi utama proyek yang terlihat
  "can": { "steer": true },                      // Minta update / Beri arahan / Tandai selesai
  "kpis": {
    "active": { "count": 2, "health": { "on_track": 1, "at_risk": 1, "off_track": 0, "none": 0 } },  // hitungan chip
    "upcoming_milestones": { "count": 1, "items": [ { "key": "PLQ", "name": "Uji coba", "target_date": "2026-10-20" } ] }, // ≤ 14 hari, maks 6
    "missed_milestones": { "count": 1, "items": [ { "key", "name", "target_date" } ] },   // maks 4
    "overdue_tasks": { "count": 2, "projects": 1, "total_projects": 2, "top": { "key": "PLQ", "count": 2 } | null },
    "decisions": { "count": 1 }                  // "Butuh keputusan"
  },
  "projects": [ ProjectRow ],                    // urut: kesehatan terburuk dulu, lalu target terdekat
  "completed": [ { ...ProjectRef, "completed_at": "iso", "quarter": "Q3" } ],   // selesai sejak awal kuartal lalu
  "decisions": [                                  // panel "Butuh keputusan Anda", terlama dulu
    { "id": "<projectUpdateId>", "project": ProjectRef, "decision": "Tambahan anggaran vendor video.",
      "summary": "…", "author": Person|null, "created_at": "iso", "can_resolve": true }
  ],
  "attention": [                                  // "Perlu perhatian": Bermasalah atau update kedaluwarsa
    { "project": ProjectRef, "lead": Person|null, "is_sponsor": false, "health": "off_track|…", "metrics": ProjectRow.metrics }
  ],
  "feed": [ { "id", "project": ProjectRef, "author": Person|null, "health", "summary", "created_at" } ],  // "Update terbaru dari PIC", maks 6
  "attendance": { "present": 31, "total": 38, "on_leave": 3, "not_checked_in": 4 } | null,  // widget kehadiran (hanya Direksi)
  "health_options": [ { "value": "on_track", "label": "Sesuai jalur" }, { "value": "at_risk", "label": "Berisiko" }, { "value": "off_track", "label": "Bermasalah" } ]
}
```
"Tandai selesai" di panel keputusan → **P5** dengan `decisions[].id`; "Minta update"/"Beri arahan" → P6/P7 dengan `project.key`.

### P2 `GET /proyek/{key}`
WorkspacePolicy `view` (anggota, workspace `internal`, Direksi/HR/Super Admin lihat saja, Kepala Divisi divisi yang terlibat). Tidak terlihat / bukan proyek → 404. Isi = tab "Ringkasan" web (`ProjectSummary`) + `can` + `updates_total`.
```jsonc
{
  "project": { ...ProjectRow, "member_divisions": ["Pemasaran", "Operasional"] },
  "status_counts": { "backlog": 0, "todo": 2, "in_progress": 0, "review": 0, "done": 2, "canceled": 0 },  // bilah status tugas
  "milestones": [                                  // urut target
    { "id", "name", "description": "string|null", "target_date": "2026-10-05", "completed_at": "iso|null",
      "status": "missed", "tasks": [ TaskRef ] }   // detail milestone (layar 12-1) dari sini
  ],
  "burnup": {
    "start_date": "2026-09-01|null", "target_date": "2026-10-27|null", "today": "2026-10-13",
    "points": [ { "date": "2026-09-01", "scope": 12|null, "done": 3|null } ],  // mingguan dari mulai; titik terakhir = hari ini (langsung); null = belum ada snapshot
    "initial_scope": 12|null,
    "recent_pace": 1.5|null,        // tugas selesai/minggu, 4 minggu terakhir
    "required_pace": 1|null,        // tugas/minggu yang dibutuhkan agar selesai tepat target
    "milestones": [ { "id", "name", "target_date", "status" } ]
  },
  "updates": [ ProjectUpdate ],     // 12 terbaru (riwayat lengkap: P3)
  "updates_total": 1,
  "risks": [                        // terbuka dulu (tinggi → rendah), lalu teratasi (tab "Teratasi")
    { "id", "title", "level": "high", "status": "open|resolved", "resolved_at": "iso|null",
      "owner": Person|null, "task": TaskRef|null }
  ],
  "overdue_tasks": [ { ...TaskRef, "due_date": "2026-10-01", "assignee": Person|null } ],   // maks 20; buka → modul 05 GET /tugas/{id}
  "team_load": { "members": [ { "person": Person, "open": 3 } ], "idle": 3, "open_total": 2 },  // "Tim & beban" (tugas terbuka/orang; web tidak menghitung jam)
  "directions": [ Direction ],      // 10 arahan terbaru (semua update)
  "task_options": [ TaskRef ],      // hanya bila can.manage_*: tugas non-batal (maks 500) untuk pemilih tugas milestone/risiko; selain itu []
  "project_can": { "manage": true, "steer": false },   // warisan web; pakai `can`
  "health_options": [ { "value", "label" } ],
  "risk_level_options": [ { "value": "high", "label": "Tinggi" }, { "value": "medium", "label": "Sedang" }, { "value": "low", "label": "Rendah" } ],
  "today": "2026-10-13",
  "can": {
    "post_update": false,        // "Tulis update" / bilah "Update proyek" (PIC, owner/admin workspace, Super Admin pengelola)
    "manage_milestones": false,  // FAB "Milestone baru", ⋯ Ubah/Tandai selesai/Hapus
    "manage_risks": false,       // "Tambah" risiko, ⋯ Ubah/Tandai teratasi/Hapus
    "request_update": true,      // bilah bawah "Minta update" (Direksi/Super Admin)
    "give_direction": true,      // "Beri arahan"
    "resolve_decision": true,    // "Tandai keputusan selesai" (per update lihat updates[].can_resolve)
    "view_only": true,           // banner kuning "mode lihat saja" (Direksi/HR/Super Admin bukan anggota)
    "archived": false            // proyek diarsipkan: semua aksi tulis false
  }
}
```
Pemilih pemilik risiko memakai `GET /workspace/{key}/anggota` (B3-A2): pemilik risiko **harus anggota workspace**.

### P3 `GET /proyek/{key}/update?filter=semua|keputusan|arahan&sebelum={updateId}`
Riwayat update (layar 09), terbaru dulu, **10 per halaman**. `filter`: `keputusan` = update yang meminta keputusan (terbuka atau sudah selesai), `arahan` = update yang punya arahan Direksi; nilai lain = `semua`. Halaman berikutnya: kirim `sebelum=<next_cursor>`.
```jsonc
{ "filter": "semua", "updates": [ ProjectUpdate ], "next_cursor": "01…|null" }
```

## 2. Aksi PIC

### P4 `POST /proyek/{key}/update` — throttle 30/menit
Body: `{ "health": "on_track|at_risk|off_track", "summary": "string ≤2000 (wajib)", "blockers": "string ≤2000|null", "decision_needed": "string ≤1000|null" }` (string kosong = null). Server mengisi `progress_snapshot` & `planned_snapshot`, memperbarui `project.health` + `last_update_at`, menyelesaikan "Minta update" yang menunggu, dan memberi tahu sponsor (atau semua Direksi) bila `decision_needed` terisi.
- 201 `{ "message": "Update proyek terkirim.", "update": ProjectUpdate }`
- 403 bukan PIC/admin (Direksi, HR, anggota, Kadiv) · 404 tak terlihat · 422 mis. `errors.health: ["Pilih status kesehatan proyek."]`, `errors.summary: ["Ringkasan wajib diisi."]`, `"Ringkasan maksimal 2.000 karakter."`, `"Hambatan maksimal 2.000 karakter."`, `"Keputusan yang dibutuhkan maksimal 1.000 karakter."`.

### P8 `POST /proyek/{key}/milestone` — throttle 60/menit
Body: `{ "name": "≤160 (wajib)", "target_date": "YYYY-MM-DD (wajib)", "description": "≤1000|null", "task_ids": ["01…", …] (opsional, ≤100; tugas di luar proyek diabaikan) }`.
- 201 `{ "message": "Milestone ditambahkan.", "milestone": Milestone }`
- **Milestone** (jawaban tulis): `{ "id", "name", "description", "target_date", "completed_at": "iso|null", "tasks": [ TaskRef ] }` — **status turunan tidak ada di sini**; muat ulang P2 setelah menulis.
- 422: `"Nama milestone wajib diisi."`, `"Nama milestone maksimal 160 karakter."`, `"Target tanggal wajib diisi."`, `"Target tanggal tidak valid."`.

### P9 `PATCH /proyek/{key}/milestone/{id}`
Body sama dengan P8 (`name` & `target_date` wajib; `task_ids` tidak dikirim = tautan tugas tidak berubah, `[]` = lepas semua). 200 `{ "message": "Milestone disimpan.", "milestone" }`. Milestone proyek lain → 404.

### P10 `PATCH /proyek/{key}/milestone/{id}/selesai`
Body: `{ "completed": true|false }` (wajib, `"Pilih tandai selesai atau buka kembali."`). 200 `{ "message": "Milestone ditandai selesai." | "Milestone dibuka kembali.", "milestone" }`. Idempoten.

### P11 `DELETE /proyek/{key}/milestone/{id}` → 204
Tidak ada "Urungkan" di server (snackbar Urungkan = tunda kirim di app atau buat ulang).

### P12 `POST /proyek/{key}/risiko`
Body: `{ "title": "≤200 (wajib)", "level": "high|medium|low (wajib)", "owner_id": "<userId anggota workspace>|null", "task_id": "<taskId proyek ini>|null", "status": "open|resolved" (opsional) }`.
- 201 `{ "message": "Risiko ditambahkan.", "risk": Risk }` — **Risk** = bentuk `risks[]` P2 (dengan `status_color: null` pada task).
- 422: `"Judul risiko wajib diisi."`, `"Judul risiko maksimal 200 karakter."`, `"Pilih level risiko."`, `"Pemilik risiko harus anggota workspace."`, `"Tugas tidak ditemukan di proyek ini."`.

### P13 `PATCH /proyek/{key}/risiko/{id}` — form ubah
Body sama dengan P12 (kirim semua field; `owner_id`/`task_id` yang tidak dikirim menjadi null). 200 `{ "message": "Risiko disimpan.", "risk" }`.

### P14 `PATCH /proyek/{key}/risiko/{id}/status` — "Tandai teratasi" / "Buka lagi"
Body: `{ "status": "resolved|open" }` (`"Status risiko tidak valid."`). Field lain dipertahankan. 200 `{ "message": "Risiko ditandai teratasi." | "Risiko dibuka lagi.", "risk" }`.

### P15 `DELETE /proyek/{key}/risiko/{id}` → 204

Semua P8–P15: 403 bila `can.manage_milestones` / `can.manage_risks` false (Direksi, HR, anggota biasa, Kadiv baca saja, proyek diarsipkan), 404 tak terlihat / id milik proyek lain.

## 3. Aksi Direksi

### P6 `POST /proyek/{key}/minta-update` — throttle 30/menit
Body: `{ "note": "≤500|null" }` (`"Catatan maksimal 500 karakter."`). Memberi notifikasi "Perlu tindakan" ke PIC (atau pemilik bila tanpa PIC).
200 `{ "message": "Permintaan update dikirim ke Sari Wulandari.", "recipient": Person }`.

### P7 `POST /proyek/{key}/arahan`
Body: `{ "body": "≤2000 (wajib)", "project_update_id": "<updateId proyek ini>|null" }` (mengutip update/hambatan = isi `project_update_id`).
201 `{ "message": "Arahan terkirim ke PIC.", "direction": Direction }`. 422: `"Tulis arahan untuk PIC."`, `"Arahan maksimal 2.000 karakter."`, `"Update proyek tidak ditemukan."`.

### P5 `POST /proyek/{key}/update/{updateId}/keputusan` — "Tandai keputusan selesai"
Tanpa body. 200 `{ "message": "Keputusan ditandai selesai.", "update": ProjectUpdate }` (memberi tahu PIC). Sudah selesai / tanpa keputusan → **403 `{"message": "Keputusan ini sudah ditandai selesai."}`**.

P5–P7: hanya `portfolio.view` (Direksi, Super Admin) yang melihat proyek dan proyek tidak diarsipkan → selain itu 403 (PIC, HR, Kadiv, anggota), 404 tak terlihat. Label tombol = "Tandai selesai" (bukan "Setujui", keputusan pemilik 13 Okt).

---

## 4. Dashboard Manajemen

Semua M1–M5: Gate `viewManagementDashboard` (`dashboard.view_company`: Direksi, HR, Super Admin; Kepala Divisi & staf **403** = layar 20-4). Blok dipisah seperti `Inertia::defer` web → skeleton per blok (layar 20-1/20-2): muat M1 dulu, lalu M2–M4 paralel. M2–M4 di-cache server 5 menit per penonton.

### M1 `GET /manajemen`
```jsonc
{
  "company": "SPKD",                       // nama singkat perusahaan (lencana kepala)
  "today": "2026-10-13",
  "can": {
    "portfolio": true,    // tautan "Semua proyek" → P1 (HR: false)
    "notes": true,
    "schedule": true      // false bila modul rapat mati → sembunyikan "Jadwal terdekat"
  },
  "notes": [ Note ],      // catatan tindakan milik sendiri (= N1)
  "schedule": [ AgendaRow ]   // = M5
}
```

### M2 `GET /manajemen/ringkasan` — hero, tile, grafik (tab Harian · Mingguan · Bulanan)
```jsonc
{
  "generated_at": "iso",
  "attendance": {                       // hari ini, karyawan aktif yang terjadwal
    "date": "2026-10-13",
    "counts": { "scheduled", "present", "on_time", "late", "away", "not_checked_in", "absent" },
    "divisions": [ { "id", "name", "scheduled", "present" } ]
  },
  "periods": {
    "harian": {
      "range": { "from": "2026-10-13", "to": "2026-10-13", "label": "13 Okt 2026" },
      "attendance": { "kind": "today", "present", "scheduled", "rate": 92.5|null, "late", "not_checked_in" },
      "tasks": { "done": 4, "planned": 6, "rate": 66.7|null },   // tugas bertenggat dalam periode
      "overdue": { "count": 3, "top_division": { "name", "count" } | null },
      "on_time": null,
      "chart": [ { "key": "<divisionId|none|other>", "label": "Operasional", "full_label": "…", "planned": 3, "done": 2 } ]  // per divisi, terbanyak dulu (maks 7 kolom; sisanya digabung "Divisi lain", key "other")
    },
    "mingguan": {                       // Sen–Jum minggu kerja terakhir yang sudah lewat
      "range": { "from": "2026-10-05", "to": "2026-10-09", "label": "5–9 Okt 2026" },
      "attendance": { "kind": "average", "attended", "scheduled", "rate": 91.2|null },
      "tasks": { "done", "planned", "rate" },
      "overdue": null,
      "on_time": { "value": 88.0|null, "numerator", "denominator", "previous": 80.0|null, "delta": 8.0|null,
                   "previous_range": { "from", "to", "label" } },   // tile "Tepat waktu"
      "chart": [ { "key": "2026-10-05", "label": "Sen 5", "full_label": "Senin, 5 Okt 2026", "planned", "done" } ]  // 5 hari
    },
    "bulanan": { /* sama dengan mingguan; 4 minggu kerja, chart per minggu: label "Mg 38" */ }
  }
}
```
`rate`/`value` = persen (0–100, 1 desimal) atau `null` bila penyebut 0 (tampilkan "—"). Tidak ada skor gabungan.

### M3 `GET /manajemen/proyek` — "Tracking per proyek", "Proyek perlu perhatian", "Milestone bulan ini"
```jsonc
{
  "generated_at": "iso",
  "total": 6,                                 // proyek aktif (portfolioFor penonton)
  "projects": [                               // maks 8 baris, terburuk dulu
    { "id", "key", "name", "color", "url", "division": "string|null", "lead": "Nama|null",
      "health": "…|null", "actual": 58|null, "planned": 75|null, "flags": ["behind"], "attention": true,
      "milestone": { "name", "target_date", "missed": false, "days_left": 8 } | null }
  ],
  "attention": { "count": 2, "items": [ { "key", "name", "reason": "berisiko|bermasalah|tertinggal|milestone terlewat|update kedaluwarsa" } ] },
  "milestones": { "month": "Oktober", "from", "to", "done": 1, "total": 4,
                  "items": [ { "id", "name", "target_date", "project": { "key", "name", "url" }, "state": "done|missed|next|todo" } ] }
}
```

### M4 `GET /manajemen/beban-kerja` — layar 18
```jsonc
{
  "total": { "open": 42, "overdue": 5, "people": 12 },     // people = orang dengan tugas terbuka
  "divisions": [                                           // terpadat dulu
    { "id": "01…|null", "name": "Operasional|Tanpa divisi", "open": 18, "overdue": 2, "estimate_hours": 36.5|null,
      "people": [ { "user": Person, "open": 6, "overdue": 1, "estimate_hours": 12|null } ] }   // terpadat dulu (buka divisi → bilah per orang)
  ]
}
```

### M5 `GET /manajemen/jadwal-terdekat` — "Jadwal terdekat" (keputusan pemilik 13 Okt)
Kemunculan rapat **pimpinan** (`leadership`) yang terlihat penonton, belum berakhir, dari hari ini s.d. 14 hari, paling awal dulu, **maks 5**. Modul rapat mati → `[]`.
```jsonc
{ "schedule": [ AgendaRow ] }
```
**AgendaRow** = baris agenda `GET /rapat` (B4-B, `MeetingSummary::agenda`): `{ id, key: "<meetingId>:<YYYY-MM-DD>", occurrence_date, title, starts_at: "2026-10-14T02:00:00Z", ends_at, platform, platform_label, location, join_url, organizer: {id,name}, workspace: {id,key,name}|null, peserta_count, rsvp_saya: "pending|yes|maybe|no|null", terjadi_hari_ini, dapat_diedit, recurrence, recurrence_until, canceled, minutes_status: "none|draft|final" }`. Ketuk → `GET /rapat/{id}`; "Jadwal manajemen" penuh → `GET /manajemen/jadwal` (B4-B).

---

## 5. Catatan tindakan (pribadi)

ManagementNotePolicy: membuat/melihat daftar = pengguna aktif ber-`dashboard.view_company` (Direksi, HR, Super Admin; lainnya **403**); mengubah/memindah/menghapus = **hanya pemilik** — catatan orang lain **404** (termasuk Super Admin), dicek sebelum validasi. Maks 200 catatan per orang. Throttle tulis 60/menit.

**Note**: `{ "id", "body": "≤500", "due_on": "2026-10-20|null", "done": false, "done_at": "iso|null", "overdue": true /* terbuka & tenggat < hari ini → merah */, "created_at": "iso" }`

### N1 `GET /catatan-tindakan`
200 `{ "notes": [ Note ], "limit": 200 }` — terbuka (urutan pengguna) lalu ≤10 selesai terbaru (bagian "Selesai" dilipat).

### N2 `POST /catatan-tindakan`
Body `{ "body": "wajib, ≤500, tidak boleh hanya spasi", "due_on": "YYYY-MM-DD|null" }`. Catatan baru di **atas**. 201 `{ "note": Note }`. 422: `"Tulis catatan tindakan."`, `"Catatan maksimal 500 karakter."`, `"Tanggal tidak valid."`, atau batas 200 tercapai.

### N3 `PATCH /catatan-tindakan/{id}`
Body (semua opsional): `{ "body", "due_on": "YYYY-MM-DD|null" (kirim null untuk hapus tenggat), "done": true|false }`. Dibuka lagi (`done:false`) → paling bawah daftar terbuka. 200 `{ "note": Note }`.

### N4 `POST /catatan-tindakan/{id}/pindah` — Naikkan / Turunkan
Body `{ "arah": "naik|turun" }` (`"Pilih naikkan atau turunkan."`). Menukar dengan tetangga di daftar terbuka (sudah paling atas/bawah = tanpa perubahan). Catatan selesai → 422 `errors.arah: ["Catatan yang sudah selesai tidak bisa diurutkan."]`. 200 `{ "notes": [ Note ] }` (daftar lengkap terbaru, = N1 tanpa `limit`).

### N5 `PUT /catatan-tindakan/urutan`
Body `{ "ids": ["01…", …] }` = **seluruh** catatan terbuka milik sendiri, atas → bawah. 204. Daftar basi/berbeda → 422 `errors.ids: ["Daftar catatan sudah berubah. Muat ulang lalu coba lagi."]`. (Opsional; N4 cukup untuk ponsel.)

### N6 `DELETE /catatan-tindakan/{id}` → 204

---

## 6. OKR divisi (`FEATURE_OKR`)

Fitur mati → **semua O1–O13 404** (layar 27-5). Visibilitas (ObjectivePolicy): Direksi/HR/Super Admin semua; karyawan divisi itu; Kepala Divisi divisinya (+ sub-divisi); pemilik objective; pemilik salah satu KR. Lainnya → 404.

**Progres** (dihitung server, `ObjectiveProgress`/`KeyResultProgress` — app tidak menghitung ulang). Semua pecahan 0–1 (4 desimal; tampilkan × 100 %):
- KR `progress`: `{ "value": 0.16 /* tampil, 0–1 */, "raw": 0.16 /* bisa < 0 (mundur) atau > 1 (lewat target) */, "expected": 0.1413, "status": "on_track|at_risk|behind", "status_label": "Sesuai jalur|Berisiko|Tertinggal" }`
- Objective `progress`: `{ "value": 0.16 /* rata-rata berbobot */, "expected": 0.1413 /* bagian kuartal yang berlalu */, "status", "status_label", "regressed": 0 /* jumlah KR yang mundur */, "counts": { "on_track": 1, "at_risk": 0, "behind": 0 } /* KR per status */ }`

**Quarter** (kepala "hari ke-13 dari 92"): `{ "key": "2026-Q4", "label": "Q4 2026", "start": "2026-10-01", "end": "2026-12-31", "days": 92, "day": 13, "elapsed": 0.1413, "week": 2, "weeks": 14 }`

**Objective** (`OkrPresenter` + progress):
```jsonc
{
  "id", "company_id",
  "division": { "id", "name": "Operasional", "code": "OPS" },
  "quarter": "2026-Q4", "title", "description": "string|null",
  "owner": { "id", "name" },                 // PIC objective
  "status": "draft|active|closed",           // closed = baca saja (layar 22-6, 27-4)
  "created_at": "…Z", "updated_at": "…Z",
  "key_results": [ KeyResult ],
  "progress": { … },
  "can": { "update": true, "close": true, "add_key_result": true }   // hanya di detail (O2–O10), tidak di daftar
}
```
**KeyResult**:
```jsonc
{
  "id", "objective_id", "title",
  "unit": "number|percent|currency|days", "unit_label": "skenario",   // unit_label hanya untuk number
  "start_value": 140, "target_value": 190, "current_value": 148,      // target < awal = "makin kecil makin baik"
  "weight": 40,
  "owner": { "id", "name" },
  "progress": { … },
  // hanya di detail (O2, O3, jawaban tulis); di daftar O1 kosong / tanpa `can`:
  "tasks": [ LinkedTask ],
  "checkins": [ { "id", "key_result_id", "date": "2026-10-13", "value": 165, "confidence": 7|null, "note": "string|null", "author": { "id", "name" } } ],  // terlama dulu (grafik rencana vs aktual)
  "can": { "update": true, "checkin": true, "link_task": true, "delete": false }
}
```
**LinkedTask** (`OkrPresenter::task`): `{ "id", "key": "OPS-1", "title", "status_category", "assignee": { "id", "name" }|null, "due_date": "YYYY-MM-DD|null", "url": "/w/OPS/tasks/1" }` (detail hanya menampilkan tugas tertaut yang terlihat penonton).

### O1 `GET /okr?kuartal=2026-Q4&divisi={divisionId}`
Bawaan kuartal berjalan & semua divisi; divisi di luar `divisions` diabaikan.
```jsonc
{
  "today": "2026-10-13",
  "quarters": ["2027-Q1", "2026-Q4", "2026-Q3"],   // tab kuartal, terbaru dulu
  "current_quarter": "2026-Q4",
  "filters": { "quarter": "2026-Q4", "division": "all|<divisionId>" },
  "divisions": [ { "id", "name", "code" } ],        // chip divisi (semua untuk pembaca perusahaan, selain itu divisi sendiri/yang dipimpin/yang punya KR-nya)
  "quarter": Quarter,
  "kpis": { "count": 5, "average": 0.16|null, "expected": 0.1413, "on_track": 3, "at_risk": 1, "behind": 1 },  // objective per status
  "objectives": [ Objective ],                      // tanpa `can`, KR tanpa tasks/checkins/can
  "can": { "create": true },                        // FAB "Objective baru"
  "create": {                                        // null bila tidak boleh membuat
    "divisions": [ { "id", "name", "code" } ],      // Kadiv: divisinya (terkunci); Direksi: semua
    "people": [ { "id", "name", "division_id" } ],  // calon pemilik objective
    "quarters": ["2027-Q1", "2026-Q4", "2026-Q3"]
  }
}
```

### O2 `GET /okr/{objectiveId}`
```jsonc
{
  "today": "2026-10-13",
  "objective": Objective,                 // dengan can + KR lengkap
  "people": [ { "id", "name" } ],         // calon pemilik KR (karyawan aktif divisi + kepala divisi)
  "quarters": ["2027-Q1", "2026-Q4", "2026-Q3"],   // pilihan kuartal form ubah
  "quarter": Quarter
}
```
Varian peran (layar 27, ObjectivePolicy/KeyResultPolicy): Kepala Divisi divisi itu → semua `can` true (kecuali `close` bila sudah ditutup); pemilik objective → `add_key_result` + semua `can` KR; pemilik KR (anggota) → `objective.can` false, `key_results[i].can.update/checkin/link_task` true hanya untuk KR miliknya; Direksi → `objective.can.update` & `close` true, `add_key_result` dan semua `can` KR false (tidak check-in, kecuali ia pemilik); HR/Super Admin → semua false (baca saja). Objective `closed`: semua false kecuali `update` (= Buka kembali) untuk Kadiv/Direksi.

### O3 `GET /okr/kr/{krId}` — deep link `ruangkerja://okr/kr/{id}/check-in`
200 `{ "objective": Objective tanpa key_results (dengan can & progress), "key_result": KeyResult }`.

### O4 `POST /okr` — throttle 30/menit
Body: `{ "division_id": "01… (wajib)", "quarter": "YYYY-Qn (wajib)", "title": "5–200 (wajib)", "description": "≤2000|null", "owner_id": "<karyawan aktif / kepala divisi itu> (wajib)", "status": "draft|active" (bawaan active) }`.
201 `{ "message": "Objective dibuat. Tambahkan key result-nya.", "today", "objective": Objective, "people", "quarters", "quarter" }` (= O2 + message).
403 `"Hanya Kepala Divisi atau Direksi yang dapat membuat objective divisi ini."` · 422 (`quarter`, `title`, `owner_id`: `"Pemilik harus karyawan aktif atau kepala divisi ini."`, `division_id`).

### O5 `PATCH /okr/{objectiveId}` — ubah / **Buka kembali**
Body sama dengan O4 **tanpa** `division_id` (dikirim = 422 prohibited). `status` tidak dikirim = `active`: pada objective `closed` ini **membuka kembali**. 200 `{ "message": "Objective disimpan." | "Objective dibuka kembali.", …O2 }`. 403 `"Hanya Kepala Divisi atau Direksi yang dapat mengubah objective ini."`.

### O6 `POST /okr/{objectiveId}/tutup` — dialog "Tutup objective"
200 `{ "message": "Objective ditutup.", …O2 }` (semua `can` tulis jadi false). Sudah ditutup → 403 `"Objective ini sudah ditutup."`.

### O7 `POST /okr/{objectiveId}/kr` — throttle 60/menit
Body: `{ "title": "5–160", "unit": "number|percent|currency|days", "unit_label": "≤20|null", "start_value", "target_value" (≠ start_value), "current_value" — angka ≤2 desimal (percent: 0–100), "weight": 1–100 (bulat), "owner_id": "<karyawan aktif divisi / kepala divisi>" }`.
201 `{ "message": "Key result ditambahkan.", "objective": Objective tanpa key_results, "key_result": KeyResult }`. 403 objective ditutup (`"Objective sudah ditutup dan hanya bisa dibaca."`) / `"Hanya pemilik objective atau Kepala Divisi yang dapat menambah key result."`. 422 mis. `target_value` sama dengan awal (layar 26 galat), `owner_id`: `"Pemilik harus karyawan aktif atau kepala divisi objective ini."`.

### O8 `PATCH /okr/kr/{krId}`
Body = O7 (semua field). 200 `{ "message": "Key result diperbarui.", "objective", "key_result" }`. Pemilik KR, pemilik objective, Kadiv.

### O9 `DELETE /okr/kr/{krId}` → 204 (pemilik objective / Kadiv; pemilik KR saja → 403).

### O10 `POST /okr/kr/{krId}/check-in`
Body: `{ "value": angka ≤2 desimal (percent: 0–100) (wajib), "confidence": 1–10|null, "note": "≤500|null" }`. Tanggal check-in = hari ini (tanggal kantor). Menulis `current_value` + riwayat; memberi tahu bila status objective memburuk.
201 `{ "message": "Check-in tersimpan.", "objective": Objective tanpa key_results, "key_result": KeyResult }` (pakai untuk rollback/konfirmasi pembaruan optimistis). 403 `"Hanya pemilik key result, pemilik objective, atau Kepala Divisi yang dapat mencatat check-in key result ini."` / objective ditutup · 404 tak terlihat · 422 `value`, `confidence`.

### O11 `GET /okr/kr/{krId}/tugas?q=` — throttle `search` (120/menit)
Tugas yang bisa ditautkan (terlihat penonton, di workspace divisi objective / tim divisi itu / proyek berdivisi utama itu; bukan pribadi/diarsipkan), **belum tertaut**, terbuka dulu, maks 20. `q` = potongan judul atau `KEY-12`.
200 `{ "tasks": [ LinkedTask ] }`. 403 bila `can.link_task` false.

### O12 `POST /okr/kr/{krId}/tugas`
Body `{ "task_id": "01…" }`. 201 `{ "message": "Jalankan UAT sesi 3 ditautkan.", "task": LinkedTask }`. 422 `errors.task_id`: `"Pilih tugas."` / `"Tugas tidak ditemukan."` / `"Tugas ini tidak ada di workspace divisi objective atau tidak bisa Anda lihat."`.

### O13 `DELETE /okr/kr/{krId}/tugas/{taskId}` → 204 (dialog "Lepas tautan").

---

## 7. Monitoring kerja Direksi

D1–D4: Gate `viewDashboard` Direksi = `portfolio.view` (Direksi, Super Admin); HR, Kadiv, staf → **403** (layar 39-8). Tab "Catatan" = §5, detail laporan = `GET /monitoring/laporan/{id}` (B4-C, `docs/sesi/ponsel-b4c-laporan.md` §4). Cakupan orang = karyawan aktif perusahaan (DashboardContextResolver tampilan Direksi, sama dengan web). Tanggal: `YYYY-MM-DD` valid ≤ hari ini; salah format / masa depan → **hari ini** (tanpa 422, sama dengan web).

### D1 `GET /monitoring/harian?tanggal=YYYY-MM-DD`
```jsonc
{
  "today": "2026-10-07", "date": "2026-10-07",
  "daily": {
    "date": "2026-10-07", "is_today": true,
    "totals": { "people": 8, "scheduled": 5, "reported": 1, "draft": 1, "missing": 3 },
    "divisions": [ { "id": "01…|null", "name": "Keuangan|Tanpa divisi", "people", "scheduled", "reported", "draft", "missing" } ],
    "missing": [ { "id", "name", "avatar", "division", "draft": false } ],   // terjadwal & belum terkirim ("Belum lapor"); draft=true = punya draf (isi draf tak pernah dikirim)
    "reports": [                                                              // terkirim, terbaru dulu
      { "id", "date", "user": { "id", "name", "avatar", "division" }, "submitted_at", "summary", "blockers": "string|null",
        "items_count": 3, "hours": 3.5|null, "items": [ MonitorItem ] }
    ]
  }
}
```
**MonitorItem**: `{ id, task_id (null = di luar tugas / tak terlihat), key ("PRJ-1"|null), title (null bila penonton tak boleh melihat tugasnya — tampilkan key saja), url, workspace, progress_note, percent, hours, status_category_after }`. Hari libur/akhir pekan: `totals.scheduled` 0 (layar 39-3).

### D2 `GET /monitoring/mingguan?minggu=YYYY-MM-DD` (hari apa pun dalam minggu; bawaan minggu ini)
```jsonc
{
  "today": "2026-10-07", "week": "2026-10-05",
  "weekly": {
    "week": { "start": "2026-10-05", "end": "2026-10-11", "label": "5–11 Okt 2026", "is_current": true, "previous": "2026-09-28", "next": null },
    "days": [ { "date": "2026-10-05", "label": "Sen 5", "is_today": false, "is_future": false } ],   // 7 hari
    "totals": { "expected": 15, "reported": 2, "hours": 6.5, "people_reported": 2 },
    "divisions": [                         // kartu per divisi (matriks orang × hari)
      { "id", "name", "expected": 6, "reported": 1,
        "people": [ { "user": Person, "reported_days": 1, "scheduled_days": 3, "hours": 3,
                      "days": [ { "date", "state": "reported|draft|missing|off|future", "items": 3, "hours": 3.5|null, "report_id": "01…|null" } ] } ] }
    ],
    "top_tasks": [ { "task_id", "key", "title", "url", "workspace", "mentions": 2, "people": 2, "hours": 5, "last_percent": 50|null } ],  // "Tugas paling banyak dikerjakan" (tugas pribadi tidak pernah muncul)
    "blockers": [ { "report_id", "date", "user": { "id", "name", "avatar", "division" }, "text": "Menunggu data vendor." } ]
  }
}
```
Sel matriks: `reported` → angka `items`; `draft` → **D**; `missing` → **!**; `off` (tidak terjadwal/libur) → **–**; `future` kosong. Ketuk sel `reported` / hambatan → detail laporan `report_id`.

### D3 `GET /monitoring/proyek?minggu=YYYY-MM-DD`
```jsonc
{ "today", "week": "2026-10-05",
  "projects": { "total": 1, "projects": [ { ...ProjectRow, "url": "/w/PRJ/ringkasan", "week": { "reports": 2, "people": 2, "tasks": 1, "hours": 5 } } ] } }
```
Ketuk → P2 dengan `key`.

### D4 `GET /monitoring/workspace?q=&jenis=project|division|team` — "Akses cepat workspace"
Workspace tim/divisi/proyek yang terlihat (Direksi: semua; tidak pernah pribadi), tidak diarsipkan; `q` mencocokkan nama atau key (tanpa peka huruf); `jenis` lain diabaikan.
```jsonc
{ "filters": { "q": "konten|null", "jenis": "team|null" },
  "workspaces": [ { "id", "key", "name", "type": "project|division|team", "type_label": "Proyek", "color", "url",
                    "members_count": 4, "open_tasks_count": 12, "view_only": true /* chip "Lihat saja" */, "health": "…|null" } ] }
```
Ketuk proyek → P2; workspace lain → `GET /workspace/{key}/papan` (B3-A2).

---

## Catatan & keputusan
- **Proyek divisi Kadiv** (layar 04) = P1 dengan `mode: "divisi"` (Gate & cakupan web `viewPortfolio` / `portfolioFor` sudah memuat Kepala Divisi); tidak dibuat endpoint terpisah.
- **Riwayat update** (P3) dan **tab Risiko teratasi** (P2 `risks[].status`) ditambahkan sesuai keputusan pemilik; tidak ada halaman web padanannya.
- **Jadwal terdekat** (M5) diisi rapat `leadership` (keputusan pemilik 13 Okt); web `/manajemen` masih mengirim `agenda: []`.
- Naikkan/Turunkan catatan (N4) memakai `ReorderManagementNotes` web (lexorank), bukan seret.
- `PATCH …/risiko/{id}/status` dan `PATCH …/milestone/{id}/selesai` adalah pintasan ponsel di atas Action web yang sama (`SaveProjectRisk` / `SetMilestoneCompletion`).
- Progres OKR & `quarter` dihitung server (`OkrApi`) agar Android tidak menduplikasi rumus `features/okr/lib.ts`.
- Belum ada (di luar cakupan B5-A): ubah atribut proyek, buat proyek, roadmap, ekspor (desktop saja, layar 40 → `POST /tautan-desktop` B2); pembatalan arahan; Urungkan hapus di server.
- Verifikasi: `vendor/bin/pest --bootstrap=<bootstrap DB privat> tests/Feature/Api/Manajemen*ApiTest.php` → 49 lulus; Pint & Larastan bersih untuk berkas B5-A.
