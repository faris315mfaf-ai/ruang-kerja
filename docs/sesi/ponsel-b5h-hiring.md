# Kontrak API ponsel — B5-H Hiring (Bagian 5)

> 13 Okt 2026 · Claude Code (agen B5-H) · branch `claude/android-bagian-5`. Acuan layar: `docs/mockups/android/spec/11-hr-admin-hiring.md` (layar 07–18, baris Rekrutmen di 01, keadaan di 09, 404/konflik di 27). Fitur web: `docs/fitur/hiring.md`. Semua rute di bawah `/api/v1/hiring`, wajib `Authorization: Bearer <token Sanctum>` (401 tanpa token), limiter grup `api-v1` (**60/menit per pengguna untuk seluruh API**) + limiter per rute bila disebut. Super Admin baru bisa memakai API setelah TOTP aktif (`EnsureApiAccountUsable`).
>
> Galat selalu JSON berbahasa Indonesia: validasi/bisnis **422** `{message, errors{field:[pesan]}}` (pesan mesin web), **403** `{message}` bila peran melihat objeknya tetapi tidak berhak atas aksi itu (mis. pewawancara mengubah lowongan), **404** `{message}` bila objek tidak terlihat (orang tanpa akses Hiring, lowongan tidak ditugaskan, perusahaan lain — keberadaannya tidak bocor), **409** untuk keputusan pada kandidat yang tidak lagi di Keputusan akhir.

Rute: `routes/api/auth/b5h-hiring.php` (nama `api.v1.hiring.*`). Controller tipis `app/Http/Controllers/Api/Hiring/*` di atas Action/Policy/Query/FormRequest web: `CandidateBoard`, `CandidateProfile`, `HiringOverview`, `PositionList`, `HiringPeople`, `CreateCandidate`, `UpdateCandidate`, `MoveCandidateStage`, `RecordInterviewAnswer`, `ScoreInterviewQuestion`, `AddChecklistItem`, `SetChecklistItem`, `DeleteChecklistItem`, `SaveCandidateNote`, `DeleteCandidateNote`, `DecideCandidate`, `CreateHiringPosition`, `UpdateHiringPosition`, `SaveHiringQuestion`, `DeleteHiringQuestion`, `ReorderHiringQuestions`, `SaveHiringSettings`, semua Policy Hiring, dan FormRequest `App\Http\Requests\Hiring\*` (yang menjawab 404 **sebelum** validasi untuk objek tak terlihat). Presenter ponsel: `App\Http\Resources\Api\Hiring\CandidateDetail`, `PositionDetail`. Tanpa perubahan skema, tanpa paket baru, tanpa perubahan domain.

## Aturan bersama

- **Tidak boleh di-cache.** Setiap respons Hiring membawa `Cache-Control: no-store, private` + `Pragma: no-cache` (middleware `NoStoreApplicantData`). Aplikasi **tidak** menyimpan data pelamar ke disk (TanStack Query tanpa persist untuk kunci `hiring`), sehingga Hiring tidak bisa dibuka offline (keputusan pemilik). Antrean tulis offline (jawaban/poin "Menunggu jaringan") cukup di memori.
- **Audit** sama dengan web: hanya id, tahap, jenis keputusan, nama field yang berubah — tidak pernah nama/email/alasan pelamar.
- **Tidak ada ekspor** data pelamar, **tidak ada hapus kandidat** (web pun tidak punya; retensi 30 hari diurus job `PurgeExpiredApplicantData`), **tidak ada unggah CV** (hanya tautan).
- **Google Form = desktop.** Secret webhook **tidak pernah** dikirim ke ponsel dan tidak ada endpoint "Buat ulang tautan & secret" di API (`POST /hiring/lowongan/{id}/webhook` → 404). Ponsel menampilkan URL webhook (Salin) + tombol "Kirim tautan ke email saya" → `POST /api/v1/tautan-desktop {path: google_form.desktop_path}` (B2; `/hiring/*` sudah di allowlist).
- **Simpan otomatis**: karena limiter 60/menit untuk seluruh API, debounce jawaban kandidat ≥ 1,5 detik per pertanyaan (bukan 600 ms) dan gabungkan ketikan; `PUT` per pertanyaan idempoten (kirim ulang aman).
- Waktu = ISO 8601 UTC. Teks label (`*_label`) sudah Bahasa Indonesia; aplikasi tidak perlu peta label sendiri.

### Bentuk bersama

**`person`** = `{id, name, avatar|null, position|null}` (jabatan). Di pengaturan lowongan/hiring ada tambahan `active: bool` (karyawan nonaktif tetap tampil di daftar lama, tidak bisa dipilih lagi).

**`hiring`** (HiringOverview) = `{can_manage: bool, counts: {open_positions, new_candidates, awaiting_decision}}` — `awaiting_decision` untuk HR = semua kandidat di Keputusan akhir; untuk penyetuju = yang menunggu keputusan **dia**.

**Tahap** (`stage`): `applied` Masuk · `screening` Seleksi berkas · `interview` Wawancara · `assessment` Penilaian · `final_review` Keputusan akhir · `hired` Diterima · `rejected` Ditolak.
**Status lowongan**: `draft` Draf · `open` Dibuka · `closed` Ditutup. **Peran pemeriksa**: `hr` HR · `interviewer` Pewawancara · `approver` Penyetuju akhir. **Sumber**: `google_form` · `manual`.

## Matriks akses

| Endpoint | HR / Super Admin | Pewawancara lowongan | Penyetuju akhir lowongan | Lainnya (Direksi/Kadiv lain, staf, perusahaan lain*) |
|---|---|---|---|---|
| `GET akses` | ✓ | ✓ | ✓ | 200 `has_access:false` |
| Daftar kandidat / lowongan | semua perusahaan | lowongannya saja | lowongannya saja | 404 |
| Profil kandidat | ✓ | ✓ (poin **hanya miliknya**) | ✓ (semua poin) | 404 |
| Tambah/ubah kandidat, pindah tahap, jawaban kandidat, tambah/hapus butir checklist | ✓ | 403 | 403 | 404 |
| Poin wawancara | 403 | ✓ (miliknya, kandidat belum diputus) | 403 | 404 |
| Centang checklist | butir HR | butir miliknya | butir miliknya | 404 |
| Notulensi tambah · ubah/hapus | ✓ · milik sendiri | ✓ · milik sendiri | ✓ · milik sendiri | 404 |
| Keputusan akhir | 403 (kecuali juga penyetuju) | 403 | ✓ saat Keputusan akhir | 404 |
| Pengaturan lowongan, pertanyaan, buat/hapus lowongan | ✓ | 403 | 403 | 404 |
| Pengaturan hiring | ✓ | 403 | 403 | 404 |

\* HR perusahaan lain = HR di perusahaannya sendiri (melihat 0 kandidat Anda; objek Anda 404).

---

## 1. Akses menu Lainnya

### `GET /hiring/akses`
Selalu **200** (agar menu bisa menyembunyikan baris). Tanpa akses:
```json
{"has_access": false, "can_manage": false, "counts": null, "badge": 0}
```
Dengan akses:
```json
{"has_access": true, "can_manage": true,
 "counts": {"open_positions": 1, "new_candidates": 3, "awaiting_decision": 1},
 "badge": 4}
```
`badge` = HR/SA: `new_candidates + awaiting_decision`; pewawancara/penyetuju: `awaiting_decision` (kandidat yang menunggu keputusan **dia**). Tab Pengaturan hanya bila `can_manage`.

---

## 2. Kandidat

### `GET /hiring/kandidat?lowongan=&q=&tahap=`
Query (semua opsional): `lowongan` = id lowongan (tak dikenal/tak terlihat → diabaikan, `filters.position: null`), `q` = cari nama/email (≤ 100), `tahap` = nilai tahap (422 bila asing). Maks. 500 kartu terbaru (`truncated: true` bila lebih).
`stages[].count` = jumlah per tahap setelah filter lowongan + `q`, **sebelum** filter `tahap` (angka chip tetap benar saat satu chip dipilih). `candidates` urut `applied_at` terbaru.
```json
{
 "hiring": {"can_manage": true, "counts": {"open_positions": 1, "new_candidates": 1, "awaiting_decision": 0}},
 "positions": [{"id": "01…", "title": "Staf Programmer", "status": "open"}],
 "stages": [{"value": "applied", "label": "Masuk", "count": 1}, {"value": "screening", "label": "Seleksi berkas", "count": 0}, "… 7 tahap urut pipeline"],
 "candidates": [{
   "id": "01…", "full_name": "Nadia Putri", "email": "nadia@contoh.id",
   "position": {"id": "01…", "title": "Staf Programmer"},
   "stage": "applied", "stage_label": "Masuk", "source": "manual",
   "applied_at": "2026-10-13T06:26:41+00:00", "has_cv": true,
   "checklist": {"done": 0, "total": 10},
   "awaiting_me": false
 }],
 "truncated": false,
 "filters": {"position": null, "q": null, "stage": null},
 "can": {"manage": true, "create_candidate": true, "move": true}
}
```
- `awaiting_me` = kartu "Menunggu keputusan Anda" (penyetuju, kandidat di Keputusan akhir, belum memutus).
- `checklist` = butir **wajib** selesai/total (semua pemeriksa).
- `can.create_candidate` = FAB "Tambah kandidat manual" (HR/SA dan ada ≥ 1 lowongan). `can.move` = tombol "Pindahkan…".
- 404 bila tidak punya akses Hiring.

### `POST /hiring/kandidat` (30/menit) — tambah kandidat manual (HR/SA)
Body `{position_id (ULID, wajib), full_name (2–150, wajib), email?, phone? (≤ 40), cv_url? (http/https, ≤ 2000)}`.
→ **201** `{message: "Rani Wijaya ditambahkan ke tahap Masuk.", candidate: <profil §3>}` (tahap Masuk, sumber manual, checklist dari templat). Email disimpan huruf kecil.
Galat: 422 `errors.full_name|email|cv_url|position_id`; lowongan tak terlihat → 404; pewawancara/penyetuju → 403.

### `PATCH /hiring/kandidat/{id}` — "Ubah data" (HR/SA)
Body `{full_name (wajib), email?, phone?, cv_url?}` (field kosong/null = dihapus). → 200 `{message: "Data kandidat disimpan.", candidate: <profil>}`. 403 reviewer, 404 lainnya.

### `PUT /hiring/kandidat/{id}/tahap` — "Pindahkan…", Tolak, Buka kembali (HR/SA)
Body `{stage, reason?}`. → 200 `{message: "Nadia Putri dipindah ke Seleksi berkas.", previous_stage: "applied", candidate: <profil>}`.
- `stage: hired` → 422 `errors.stage: "Kandidat diterima lewat keputusan semua penyetuju akhir, bukan dipindah manual."`.
- `stage: rejected` tanpa `reason` → 422 `errors.reason: "Tulis alasan penolakan."` (sheet Tolak).
- `stage: final_review` dengan butir wajib HR/pewawancara aktif belum dicentang → 422 `errors.stage: "Masih ada N butir checklist wajib (HR & pewawancara) yang belum dicentang."`; tanpa penyetuju akhir aktif → 422 `errors.stage: "Lowongan ini belum punya penyetuju akhir. Atur di pengaturan lowongan."`. Berhasil → penyetuju mendapat notifikasi "Perlu tindakan".
- Keluar dari Keputusan akhir, atau **membuka kembali** kandidat Diterima/Ditolak (pindah ke tahap terbuka mana pun), menghapus keputusan putaran itu; `rejected_reason` dikosongkan.
- Tahap sama dengan sekarang → 200 tanpa perubahan.
- **Urungkan** (snackbar): panggil lagi endpoint ini dengan `stage: previous_stage` (aturan di atas tetap berlaku; keputusan yang terhapus tidak kembali).

---

## 3. Profil kandidat

### `GET /hiring/kandidat/{id}`
→ 200 `{candidate: <profil>}`; 404 bila tak terlihat. Bentuk **profil** (juga dikembalikan oleh POST/PATCH/tahap/keputusan):
```json
{
 "candidate": {
  "id": "01…", "full_name": "Nadia Putri", "email": "nadia@contoh.id", "phone": "0873…",
  "cv_url": "https://drive.google.com/open?id=…",
  "attachments": [{"label": "Portofolio", "url": "https://…"}],
  "form_answers": [{"question": "Pengalaman", "answer": "3 tahun"}],
  "stage": "applied", "stage_label": "Masuk", "rejected_reason": null,
  "source": "manual", "source_label": "Ditambahkan manual", "is_manual": true,
  "applied_at": "2026-10-13T06:26:41+00:00", "decided_at": null,
  "position": {"id": "01…", "title": "Staf Programmer", "status": "open", "status_label": "Dibuka", "division": "Programming"}
 },
 "questions": [{
   "id": "01…", "prompt": "Ceritakan proyek Anda.", "guidance": null, "max_score": 5,
   "answer": null,
   "my_score": {"score": 4, "note": "Jelas."},
   "scores": [{"interviewer": {"id": "01…", "name": "Dimas", "avatar": null, "position": null}, "score": 4, "note": "Jelas."}],
   "average": 4
 }],
 "checklist": [{
   "id": "01…", "label": "CV dan berkas lamaran lengkap", "role": "hr", "role_label": "HR", "required": true,
   "reviewer": null, "checked_at": null, "checked_by": null, "note": null,
   "can_check": true, "can_delete": true, "mine": true
 }],
 "notes": [{"id": "01…", "body": "Komunikatif.", "author": {"id": "01…", "name": "Faris", "avatar": null, "position": null},
   "created_at": "…", "edited_at": null, "can_edit": false}],
 "decisions": [{"approver": {"id": "01…", "name": "Faris", "avatar": null, "position": null},
   "decision": null, "decision_label": "Belum memutus", "note": null, "decided_at": null}],
 "reviewers": {"interviewers": ["person…"], "approvers": ["person…"]},
 "can": {"manage": true, "edit": true, "move": true, "answer": true, "add_checklist": true, "note": true,
   "score": false, "decide": false, "see_all_scores": true, "is_interviewer": false, "is_approver": false},
 "blockers": {"before_final": 6, "my_approval": 0},
 "my_decision": null,
 "summary": {
   "checklist": {"done": 0, "total": 10},
   "score": {"total": 4, "max": 5, "scored_questions": 1, "questions": 3,
     "by_interviewer": [{"interviewer": "person", "total": 4, "max": 5, "count": 1}]},
   "my_score": null,
   "decisions": {"approved": 0, "rejected": 0, "pending": 2, "total": 2}
 },
 "move_targets": [
   {"stage": "screening", "label": "Seleksi berkas", "requires_reason": false, "blocked": null},
   {"stage": "final_review", "label": "Keputusan akhir", "requires_reason": false, "blocked": "Masih ada 6 butir checklist wajib (HR & pewawancara) yang belum dicentang."},
   {"stage": "rejected", "label": "Ditolak", "requires_reason": true, "blocked": null}
 ]
}
```
Arti per tab:
- **Profil**: `candidate.*` (CV/berkas = tautan http(s), buka di Custom Tab; `form_answers` urut formulir; kandidat manual: `attachments`/`form_answers` kosong). **Ringkasan** di atas tab = `summary` (cincin checklist `summary.checklist`, total poin `summary.score` — informasi saja, tidak ada skor gabungan untuk keputusan — dan `summary.decisions`).
- **Wawancara**: `questions[]` urut. `answer` = jawaban kandidat yang diketik HR (tampil untuk semua yang melihat profil; tulis hanya `can.answer`). `my_score` = poin+catatan milik penonton (null bila belum). `scores`/`average` = **null untuk pewawancara** (spanduk "hanya poin Anda sendiri yang terlihat"), terisi untuk HR & penyetuju (`can.see_all_scores`). Tombol poin 1..`max_score` hanya bila `can.score` (pewawancara lowongan, kandidat belum diputus). Sakelar "Ringkasan poin" = `summary.score` (HR/penyetuju) atau `summary.my_score` (pewawancara: total poin miliknya; null bila bukan pewawancara dan belum memberi poin).
- **Checklist**: kelompokkan per `role` + `reviewer.id` (HR dulu, lalu pewawancara, lalu penyetuju). Kotak centang aktif bila `can_check`; `mine` = butir milik penonton; "Hapus" bila `can_delete` (HR, butir belum dicentang). "Tambah butir" bila `can.add_checklist`. Judul tab "Checklist n/m" = `summary.checklist`.
- **Notulensi**: semua yang melihat profil boleh menambah (`can.note`); menu ⋯ ubah/hapus hanya bila `can_edit`.
- **Keputusan**: `decisions[]` satu baris per penyetuju akhir lowongan (urut pengaturan lowongan). Form Setujui/Tolak hanya bila `can.decide` (penyetuju + kandidat di Keputusan akhir). Tombol Setujui nonaktif bila `blockers.my_approval > 0` ("Centang dulu N butir checklist Anda" + "Buka checklist"). `my_decision` = keputusan penonton putaran ini (boleh diubah selama masih Keputusan akhir). Kandidat belum di Keputusan akhir → tampilkan keadaan "Belum di tahap keputusan".
- **Menu ⋯ / Pindahkan**: `can.edit` (Ubah data), `can.move` + `move_targets` (sheet Pindahkan; `blocked` ≠ null = opsi nonaktif dengan alasannya; `requires_reason` = buka sheet Tolak). `blockers.before_final` = jumlah butir wajib HR+pewawancara aktif yang masih terbuka. Server tetap memeriksa ulang.

### `PUT /hiring/kandidat/{id}/jawaban/{questionId}` — jawaban kandidat (HR/SA, simpan otomatis)
Body `{answer: string|null}` (≤ 20.000; kosong/null = hapus). → 200 `{question_id, answer: "Sistem absensi."|null, saved_at: ISO|null}` (spasi tepi dibuang). Pertanyaan lowongan lain → 404. Pewawancara/penyetuju → 403.

### `PUT /hiring/kandidat/{id}/poin/{questionId}` — poin milik sendiri (pewawancara)
Body `{score: 1..max_score|null, note?: string|null (≤ 5.000)}`. → 200 `{question_id, max_score, my_score: {score, note}|null, saved_at|null}`.
- `score` null **dan** `note` kosong = hapus poin sendiri (`my_score: null`).
- `score` di luar 1..maks → 422 `errors.score: "Poin harus antara 1 dan 5."`; `score` > 10 → 422 validasi umum; catatan tanpa poin → 422 `errors.score: "Pilih poin dulu sebelum menulis catatan."`.
- HR/penyetuju → 403 `"Hanya pewawancara lowongan ini yang dapat memberi poin."`; kandidat sudah diputus → 403 `"Kandidat sudah diputus; poin tidak bisa diubah lagi."`; pertanyaan lowongan lain → 404.

### `POST /hiring/kandidat/{id}/checklist` — tambah butir (HR/SA)
Body `{label (2–200), reviewer_id?: ULID|null (null = butir HR), required?: bool (bawaan true)}`. `reviewer_id` harus pewawancara/penyetuju lowongan ini, selain itu 422 `errors.reviewer_id: "Pilih HR, pewawancara, atau penyetuju akhir lowongan ini."`. → **201** `{message: "Butir checklist ditambahkan.", item: <butir checklist seperti di profil>}`.

### `PATCH /hiring/checklist/{itemId}` — centang/lepas + catatan
Body `{checked: bool (wajib), note?: string|null (≤ 2.000)}`. → 200 `{item}` (`checked_by` = pencentang pertama; melepas centang mengosongkan). Butir orang lain → 403 `"Anda hanya dapat mencentang butir milik Anda."`; kandidat diputus → 403 `"Kandidat sudah diputus; checklist tidak bisa diubah lagi."`; tak terlihat → 404.

### `DELETE /hiring/checklist/{itemId}` (HR/SA) → **204**. Butir tercentang → 403 `"Butir yang sudah dicentang tidak bisa dihapus."`.

### `POST /hiring/kandidat/{id}/notulensi` — tambah notulensi
Body `{body (2–20.000)}`. → **201** `{message: "Notulensi ditambahkan.", note: {id, body, author: person, created_at, edited_at, can_edit}}`.

### `PATCH /hiring/notulensi/{noteId}` (penulis saja) → 200 `{message: "Notulensi disimpan.", note}` (`edited_at` terisi bila isi berubah). Orang lain → 403 `"Anda hanya dapat mengubah notulensi milik Anda."`.
### `DELETE /hiring/notulensi/{noteId}` (penulis saja) → **204**.

### `POST /hiring/kandidat/{id}/keputusan` — Setujui / Tolak (penyetuju akhir)
Body `{decision: "approve"|"reject", note?: string (≤ 2.000; **wajib** bila reject)}`.
→ 200
```json
{"message": "Keputusan Anda dicatat. Menunggu penyetuju lain.", "outcome": null, "candidate": "<profil>"}
```
- `outcome`: `null` (masih menunggu penyetuju lain), `"hired"` (semua penyetuju **aktif** setuju → "Semua penyetuju setuju: Nadia Putri diterima."), `"rejected"` (satu penolakan → "Nadia Putri ditolak.", `candidate.candidate.rejected_reason` = catatan penolak). HR diberi tahu hasilnya; item "Perlu tindakan" diselesaikan.
- Dialog konfirmasi D13 ("Ratna langsung Diterima…"): tampilkan bila `summary.decisions.pending === 1` dan `my_decision === null` serta tidak ada penolakan.
- Galat: tolak tanpa catatan → 422 `errors.note: "Tulis alasan penolakan."`; setujui sebelum butir wajib sendiri dicentang → 422 `errors.decision: "Centang dulu N butir checklist wajib Anda sebelum menyetujui."`; bukan penyetuju → 403; tak terlihat → 404.
- **Konflik → 409** bila penyetuju memutus kandidat yang **tidak lagi / belum** di Keputusan akhir (HR memindahkannya, atau sudah Diterima/Ditolak, termasuk balapan dengan penyetuju lain):
```json
{"message": "Kandidat ini sudah diputus atau tidak lagi di tahap Keputusan akhir. Keputusan Anda tidak disimpan.",
 "code": "bukan_tahap_keputusan", "candidate": "<profil terbaru>"}
```
  → banner "Keputusan Anda tidak disimpan" + Muat ulang (atau langsung pakai `candidate`).

---

## 4. Lowongan

### `GET /hiring/lowongan`
→ 200
```json
{
 "hiring": {"can_manage": true, "counts": {"open_positions": 1, "new_candidates": 1, "awaiting_decision": 0}},
 "positions": [{
   "id": "01…", "title": "Staf Programmer", "status": "open", "status_label": "Dibuka",
   "division": "Programming", "description": null,
   "opened_at": "…", "closed_at": null,
   "candidates_count": 6, "open_candidates_count": 5, "hired_count": 1,
   "interviewers_count": 2, "approvers_count": 2,
   "my_roles": ["interviewer"]
 }],
 "divisions": [{"id": "01…", "name": "Programming"}],
 "can": {"create": true}
}
```
Urut: Dibuka, Draf, Ditutup, lalu terbaru. `my_roles` ⊂ `interviewer`, `approver` (kosong untuk HR yang bukan pemeriksa). `divisions` (pilihan sheet "Lowongan baru") hanya untuk HR/SA (`[]` untuk lainnya). Ketuk kartu: HR → pengaturan (`GET /hiring/lowongan/{id}`); pewawancara/penyetuju → daftar kandidat dengan `?lowongan={id}` (pengaturan lowongan 403 untuk mereka).

### `POST /hiring/lowongan` (30/menit) — "Lowongan baru" (HR/SA)
Body `{title (3–150), division_id?: ULID (bukan unit Direksi; asing → diabaikan), description? (≤ 5.000)}`. → **201** `{message: "Lowongan dibuat sebagai draf. Lengkapi pengaturannya.", ...<pengaturan lowongan>}` (status Draf; penyetuju akhir = bawaan Pengaturan hiring).

### `GET /hiring/lowongan/{id}` — pengaturan lowongan (HR/SA; pewawancara/penyetuju 403, lainnya 404)
```json
{
 "position": {
  "id": "01…", "title": "Staf Programmer", "division_id": null, "division": null, "description": null,
  "status": "open", "status_label": "Dibuka", "opened_at": "…", "closed_at": null,
  "interviewer_ids": ["01…"], "final_approver_ids": ["01…"],
  "interviewers": [{"id": "01…", "name": "Dimas", "avatar": null, "position": null, "active": true}],
  "approvers": [{"id": "01…", "name": "Faris", "avatar": null, "position": null, "active": true}],
  "field_map": {"full_name": "Nama pelamar"},
  "candidates_count": 6
 },
 "questions": [{"id": "01…", "prompt": "Ceritakan proyek Anda.", "guidance": null, "max_score": 5, "position": 1, "locked": true, "can_delete": false}],
 "field_defaults": [{"field": "full_name", "label": "Nama lengkap", "aliases": ["nama lengkap", "nama", "full name", "name"]}, "… email, phone, cv_url"],
 "statuses": [{"value": "draft", "label": "Draf"}, {"value": "open", "label": "Dibuka"}, {"value": "closed", "label": "Ditutup"}],
 "employees": [{"id": "01…", "name": "Arif", "avatar": null, "position": "Programmer"}],
 "divisions": [{"id": "01…", "name": "Programming"}],
 "google_form": {"desktop_only": true, "webhook_url": "https://spkd.store/api/hiring/form/…", "has_submissions": false, "desktop_path": "/hiring/lowongan/01…"},
 "can": {"update": true, "delete": false, "regenerate_webhook": false}
}
```
- `field_map` = objek (`{}` bila semua kosong = pakai tebakan bawaan `field_defaults[].aliases`, tampilkan sebagai placeholder).
- `questions[].locked` = sudah ada jawaban/poin (tidak bisa dihapus; `max_score` tidak boleh di bawah poin tertinggi yang sudah diberikan).
- `employees` = karyawan aktif perusahaan (pemilih pewawancara & penyetuju; mencari di klien).
- `can.delete` = lowongan belum pernah punya kandidat (termasuk yang sudah dihapus).
- `google_form`: kartu "tersedia di desktop" (D14) — URL boleh disalin; secret tidak ada; "Kirim tautan ke email saya" → `POST /tautan-desktop {path: desktop_path}`.

### `PUT /hiring/lowongan/{id}` — "Simpan perubahan" (HR/SA)
Body (form utuh):
```json
{"title": "Staf Programmer Backend", "division_id": null, "description": null, "status": "open",
 "interviewer_ids": ["01…"], "final_approver_ids": ["01…"],
 "field_map": {"full_name": "Nama pelamar", "email": null, "phone": null, "cv_url": null}}
```
Aturan: `title` 3–150; `status` ∈ draft/open/closed (Dibuka mengisi `opened_at` sekali, Ditutup mengisi `closed_at`, kiriman Form baru ditolak 410); `interviewer_ids` wajib ada (boleh `[]`, ≤ 30), `final_approver_ids` wajib ada (boleh `[]`, ≤ 10) — id yang bukan karyawan aktif perusahaan **dibuang diam-diam** (respons menunjukkan hasil akhirnya); `field_map.*` ≤ 500 (kosong = tebakan bawaan). Mengubah pemeriksa menyinkronkan checklist kandidat yang masih berproses.
→ 200 `{message: "Pengaturan lowongan disimpan.", ...<pengaturan lowongan>}`. Galat 422 per field.

### `DELETE /hiring/lowongan/{id}` (HR/SA) → **204**; bila pernah punya kandidat → 422 `{message: "Lowongan yang sudah punya kandidat tidak bisa dihapus. Tutup saja lowongannya.", code: "punya_kandidat", errors.position: [...]}`.

### Pertanyaan wawancara (HR/SA; pewawancara/penyetuju 403, lainnya 404)
Setiap respons membawa daftar lengkap terurut `questions` (bentuk seperti di pengaturan lowongan).
- `POST /hiring/lowongan/{id}/pertanyaan` `{prompt (3–2.000), guidance? (≤ 2.000), max_score (1–10)}` → **201** `{message: "Pertanyaan ditambahkan.", question_id, questions}` (ditaruh paling akhir).
- `PUT /hiring/pertanyaan/{questionId}` (body sama) → 200 `{message: "Pertanyaan disimpan.", question_id, questions}`. `max_score` di bawah poin tertinggi yang sudah ada → 422 `errors.max_score: "Sudah ada poin 4 untuk pertanyaan ini; poin maksimal tidak boleh lebih kecil."`.
- `PUT /hiring/lowongan/{id}/urutan-pertanyaan` `{ids: [semua id pertanyaan lowongan, urutan baru]}` → 200 `{questions}`; tidak lengkap → 422 `errors.ids: "Urutan pertanyaan tidak lengkap. Muat ulang halaman lalu coba lagi."`. (Naikkan/Turunkan di ponsel = kirim seluruh urutan.)
- `DELETE /hiring/pertanyaan/{questionId}` → 200 `{message: "Pertanyaan dihapus.", questions}`; sudah punya jawaban/poin → **403** `{message: "Pertanyaan yang sudah punya jawaban atau poin tidak bisa dihapus."}` (sembunyikan tombol bila `can_delete:false`).

---

## 5. Pengaturan hiring (HR/SA; pewawancara/penyetuju 403, lainnya 404)

### `GET /hiring/pengaturan`
```json
{
 "settings": {
  "default_final_approver_ids": ["01…"],
  "default_final_approvers": [{"id": "01…", "name": "Faris", "avatar": null, "position": "Direktur", "active": true}],
  "checklist_template": {
   "hr": [{"label": "CV dan berkas lamaran lengkap", "required": true}, {"label": "Data kontak sudah diverifikasi", "required": true}, {"label": "Ekspektasi gaji sesuai anggaran", "required": false}],
   "interviewer": [{"label": "Wawancara sudah dilakukan", "required": true}, {"label": "Poin setiap pertanyaan sudah diisi", "required": true}],
   "approver": [{"label": "Profil, poin, dan notulensi sudah ditinjau", "required": true}]
  }
 },
 "roles": [{"value": "hr", "label": "HR"}, {"value": "interviewer", "label": "Pewawancara"}, {"value": "approver", "label": "Penyetuju akhir"}],
 "limits": {"approvers": 10, "items_per_role": 12, "label": 200},
 "employees": ["person…"]
}
```

### `PUT /hiring/pengaturan`
Body `{default_final_approver_ids: [ULID…] (wajib ada, ≤ 10), checklist_template: {hr: [...], interviewer: [...], approver: [...]} (wajib; tiap peran wajib ada, ≤ 12 butir, butir {label ≤ 200, required: bool})}`. Daftar kosong = peran itu tanpa butir. Penyetuju nonaktif/bukan karyawan perusahaan **dibuang** (keadaan "galat penyetuju nonaktif" di mockup: bandingkan id yang dikirim dengan `default_final_approver_ids` di respons). Hanya berlaku untuk lowongan/kandidat **baru**.
→ 200 `{message: "Pengaturan hiring disimpan.", settings, roles, limits, employees}`.

---

## 6. Belum / sengaja tidak dibuat
- Hapus kandidat (menu ⋯ "Hapus" di mockup 18): web tidak punya aksinya; tidak ditambahkan agar tidak mengubah domain. Bila pemilik ingin, perlu Action baru (soft delete + audit id saja) dan keputusan retensi.
- "Bagikan" profil kandidat (mockup 18): tidak ada endpoint; bila dibuat, cukup tautan web `/hiring/kandidat/{id}` (hanya terbuka bagi yang berhak).
- Buat ulang tautan & secret webhook, pemasangan skrip Apps Script: desktop.
- Notifikasi push `hiring.*` mengikuti kanal notifikasi umum (modul 10/12), di luar paket ini.

## 7. Uji
`tests/Feature/Api/HiringCandidateApiTest.php` (12 uji: akses, papan + filter, profil per peran, tambah/ubah, pindah tahap + gerbang checklist + buka kembali, wawancara, checklist, notulensi, keputusan diterima/ditolak/409, Super Admin) dan `tests/Feature/Api/HiringPositionApiTest.php` (7 uji: daftar per peran, buat, pengaturan tanpa secret, ubah + sinkron checklist, hapus, pertanyaan, pengaturan hiring). Jalankan: `vendor/bin/pest --bootstrap=<boot DB pribadi> tests/Feature/Api/HiringCandidateApiTest.php tests/Feature/Api/HiringPositionApiTest.php` → 19 lulus, 401 asersi.
