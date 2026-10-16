# Kontrak API ponsel — B4-A Pengajuan & persetujuan (Bagian 4)

> 13 Okt 2026 · Claude Code · branch `claude/android-bagian-4`. Acuan layar: `docs/mockups/android/spec/04-pengajuan-persetujuan.md`. Semua rute di bawah `/api/v1`, wajib `Authorization: Bearer <token Sanctum>` (401 tanpa token), limiter grup `api-v1` (60/menit/user) + limiter per rute bila disebut. Galat selalu JSON: validasi/bisnis **422** `{message, errors{field:[pesan]}}` berbahasa Indonesia (pesan mesin web), **403** `{message}` Indonesia, **404** bila pengajuan/delegasi tidak terlihat (keberadaannya tidak bocor), **409** `{message, code, request}` untuk keputusan yang sudah diambil.

Rute baru: `routes/api/auth/b4a-pengajuan.php`. Rute lama (`GET /pengajuan`, `GET /pengajuan/jenis`, `POST /pengajuan`) tetap di `routes/api.php` dan **diperluas secara aditif** (bentuk lama tidak berubah, kecuali `jenis` kini juga memuat jenis terkunci/belum berhak dengan penanda — lihat §1).

Controller tipis di atas Action/Policy/FormRequest web: `SubmitRequest`, `SaveRequestDraft`, `CancelRequest`, `ApproveStep`, `RejectStep`, `RequestRevision`, `CancelApprovedRequest`, `SaveApprovalDelegation`, `DeleteApprovalDelegation`, `ApprovalQueue`, `EmployeeRequestPolicy`, `ApprovalDelegationPolicy`, presenter `RequestPresenter`. Baru di domain: `DeleteRequestDraft`, `AddRequestAttachments`, `RemoveRequestAttachment`, mode ubah di `SaveApprovalDelegation` (audit `approval_delegation.updated`), `EmployeeRequestPolicy::delete` (= draf milik sendiri), `ApprovalDelegationPolicy::update` (= pemberi delegasi).

> **Catatan jalur:** `GET/POST/DELETE /persetujuan` sudah dipakai **persetujuan privasi** (B2, `consent.*`). Karena itu daftar antrean persetujuan pengajuan ada di **`GET /persetujuan/daftar`** (bukan `/persetujuan?tab=`). Rute lain di bawah `/persetujuan/…` tidak bentrok.

## 0. Bentuk bersama

**`type`** (RequestPresenter::type): `{id, code, name, category, category_label, description, annual_quota_days, requires_attachment_after_days, allow_half_day, max_backdate_days, is_paid, counts_calendar_days, max_days_per_request, day_unit, is_provisional_default, locked, locked_reason}`.

**`person`**: `{id, name, avatar, position, division}` (position/division bisa null).

**`item`** (baris daftar, RequestPresenter::item): `{id, number|null, status (draft|pending|approved|rejected|revision_requested|canceled), status_label, type, user: person, start_at, end_at (ISO), days|null, minutes|null, payload, round, step_position|null, step_count, waiting: {label, approver: person|null, since}|null, decision_note: {status, note, by, at}|null, submitted_at, created_at, updated_at, decided_at}`.
`payload` per jenis: izin hari `{mode:'days', half_day}`, izin jam `{mode:'hours', date, start_time, end_time}`, cuti `{half_day}`, lembur `{date, start_time, end_time}`, koreksi `{date, check_in|null, check_out|null}`, dinas `{destination}`, barang `{item_name, quantity, unit, unit_price, total (dihitung server), reference_url|null, urgency (biasa|mendesak)}`.

**`detail`** (RequestDetail = RequestPresenter::detail web + perubahan API) = `item` + 
- `reason` (`''` bila disembunyikan), `health_details_hidden` (sakit + penyetuju pengganti), `substitute: person|null`
- `attachments: [{id, filename, mime_type, size_bytes, url}]` — `url` = stream API `GET /pengajuan/{id}/lampiran/{att}` (Bearer); `[]` bila detail kesehatan disembunyikan
- `timeline: [{id, round, current_round, step_order, label, approver_type, status (queued|waiting|approved|rejected|revision_requested|skipped), status_label, approver: person|null, delegated_from: person|null ("Mewakili"), note|null, activated_at, decided_at}]` — langkah putaran aktif + keputusan putaran sebelumnya
- `balance: {year, before, after, summary{id, year, entitled, carried_over, opening, adjustments, used, pending, total, available, remaining}}|null` — **kunci tidak ada sama sekali untuk staf** (keputusan pemilik 6 Okt 2026)
- `colleagues: {group, size, people[{id, name, dates[]}]}|null` (peringatan rekan absen)
- `cancellation: {by: person|null, by_requester, at, reason|null, after_approval}|null`
- `cancel_preview: {refund_days|null, balance_year|null, attendance{removed_dates[], unlinked_dates[], overtime_date, correction_date, blocker}, past_dates[], blocker|null, reason_min:10, reason_max:500}|null` — hanya untuk yang boleh `cancel_approved`
- `can: {edit, cancel, decide, cancel_approved, submit (draf), resubmit (revisi), delete (draf), attach, approve, reject, revise}`
- `form: {leave_type_id, mode (izin: days|hours, lainnya null), start_date, end_date, date, start_time, end_time, check_in, check_out, half_day, destination, item_name, quantity, unit, unit_price, reference_url, urgency, substitute_id, reason}|null` — nilai isian tersimpan (hanya bila `can.edit`), untuk mengisi form ubah.

## 1. Jenis & form

### `GET /pengajuan/jenis`
→ 200 `{categories: [{value, label, slug, locked (semua jenisnya terkunci), types: [type + {eligible, ineligible_reason|null, needs_substitute (cuti), modes (izin: ['days','hours'], lainnya null), fields, balance?}]}], today: 'Y-m-d', limits: {reason:500, max_files:5, max_kilobytes:5120, mimes:['pdf','jpg','jpeg','png']}}`.
- **Jenis terkunci kini ikut** dengan `locked:true` + `locked_reason` (ubin bergembok D1); jenis belum berhak ikut dengan `eligible:false` + `ineligible_reason`. Keduanya tetap ditolak server saat kirim **dan** simpan draf (422 `errors.leave_type_id`: `"{Nama} belum bisa diajukan. {alasan}"` / `"Anda belum berhak atas {Nama}."`).
- `fields` = isian form web per kategori: cuti `[start_date,end_date,(half_day),substitute_id,reason,(attachments)]`; izin `{days:[start_date,end_date,(half_day),reason,…], hours:[date,start_time,end_time,reason,…]}`; sakit `[start_date,end_date,(half_day),reason,attachments]`; lembur `[date,start_time,end_time,reason]`; koreksi `[date,check_in,check_out,reason]` (+ `max_backdate_days`); dinas `[start_date,end_date,destination,reason,attachments]`; barang `[item_name,quantity,unit,unit_price,reference_url,urgency,reason]`. Wajib/tidaknya diputuskan server.
- `balance` (ringkasan saldo tahun berjalan; `null` untuk jenis tanpa kuota) **hanya untuk non-staf**; staf tidak menerima kunci `balance`.

### `GET /pengajuan/pratinjau?leave_type_id=&…isian form…&request_id?` (120/menit)
Controller web `RequestPreviewController` apa adanya → `{period{start_at,end_at,days,minutes,work_dates}|null, errors{field:pesan}|null, balance|null (selalu null untuk staf), overlap: string|null, colleagues|null, flow:[{step_order, approver_type, label, role, status, approver: person|null, delegated_from, note}], attachment_required: bool}`. 422 `{message:'Jenis pengajuan tidak tersedia.'}` bila jenis tak dikenal. Isian izin per jam: `start_time`/`end_time` (+`date`).

## 2. Pengajuan saya

### `GET /pengajuan?status=&jenis=&tahun=&page=`
→ 200 `{requests: [item], meta{current_page, from, last_page, per_page:20, to, total}, filter{status, jenis, tahun}, counts{semua, menunggu, disetujui, ditolak, revisi, draf, dibatalkan}, balances?}`.
- `status`: `semua` (bawaan) · `menunggu` (pending + revisi) · `disetujui` · `ditolak` · `revisi` · `draf` · `dibatalkan`; nilai asing → `semua`.
- `jenis`: slug/nilai kategori (`izin`/`permit`, `cuti`, `sakit`, `lembur`, `koreksi`, `dinas`, `barang`) **atau** id jenis.
- `tahun`: `YYYY` (tanggal mulai, waktu kantor).
- `counts` mengikuti filter jenis/tahun tetapi tidak filter status (lencana chip).
- `balances` (kartu saldo web: `[{type, kind (balance|info|ineligible), year, balance: summary|null}]`) **hanya non-staf**.

### `POST /pengajuan` (30/menit) — kirim baru (sudah ada, tidak berubah)
JSON atau multipart `{type|leave_type_id, reason, …isian, substitute_id?, attachments[]?}` → 201 `{request: item}`. Izin per jam: kirim `date`, `start_time`, `end_time`.

### `POST /pengajuan/draf` (30/menit) — simpan draf baru
Body sama (JSON/multipart, `attachments[]` boleh), plus `mode?: days|hours` (izin). `reason` boleh kosong. → **201** `{request: detail}` (status `draft`, `number:null`). Jenis terkunci → 422 seperti kirim.

### `GET /pengajuan/{id}` → 200 `{request: detail}` · 404 bila tak terlihat.

### `PATCH /pengajuan/{id}` (30/menit) — ubah draf / pengajuan yang diminta revisi tanpa mengirim
Kirim **hanya isian yang berubah**; sisanya diambil dari nilai tersimpan (`form`). `type` ganti jenis; `mode` izin mengosongkan isian mode lain; `remove_attachments[]` (id) boleh. → 200 `{request: detail}` (status tetap). Bukan milik sendiri → 404; sudah dikirim/diputus → 422 `errors.status: 'Pengajuan ini tidak bisa diubah lagi.'`.

### `POST /pengajuan/{id}/kirim` (30/menit) — kirim draf
Body opsional (isian yang diubah, digabung seperti PATCH). → 200 `{request: detail}` (pending, bernomor, notifikasi penyetuju pertama). Bukan draf → 422 `errors.status: 'Pengajuan ini bukan draf. Gunakan "Revisi & kirim ulang".'`. Aturan bisnis web (benturan, saldo, surat sakit, batas koreksi) 422.

### `POST /pengajuan/{id}/kirim-ulang` (30/menit) — revisi & kirim ulang
Sama dengan `kirim` untuk status `revision_requested` → putaran (`round`) + 1. Status lain → 422 `errors.status: 'Pengajuan ini tidak sedang diminta revisi.'`.

### `POST /pengajuan/{id}/batal` — dibatalkan pemohon (draf/menunggu/revisi)
→ 200 `{request: detail}` (`status: canceled`, `cancellation.by_requester: true`; saldo yang dicadangkan dilepas, penyetuju diberi tahu — `CancelRequest`). Sudah diputus → 422 `errors.status: 'Pengajuan yang sudah diputus tidak bisa dibatalkan.'`. Orang lain yang bisa melihat → 403.

### `DELETE /pengajuan/{id}` — hapus draf yang belum pernah dikirim
→ **204**. Draf + lampirannya (baris & berkas) hilang. Status lain → 422 `errors.status: 'Hanya draf yang bisa dihapus. Batalkan pengajuan ini.'`. Draf lama jenis terkunci: hapus atau batalkan (D6).

### `POST /pengajuan/{id}/batal-disetujui` (30/menit) — HR/Super Admin membatalkan pengajuan disetujui
Body `{reason}` (wajib, 10–500 karakter). → 200 `{request: detail, effects: {refund_days|null, balance_year|null, removed_dates[], unlinked_dates[], reclosed_dates[] (tanggal lewat yang langsung ditutup ulang → tanpa check-in = Alpha), overtime_date|null, correction_date|null}}`.
Galat: bukan HR/SA, pengajuan sendiri, atau beda perusahaan → 403 `'Hanya HR atau Super Admin yang bisa membatalkan pengajuan yang sudah disetujui.'`; alasan pendek → 422 `errors.reason: 'Tulis alasan pembatalan minimal 10 karakter.'`; **blocker** (hari koreksi sudah berubah) → 422 `{message: <blocker>, code: 'tidak_bisa_dibatalkan', errors{reason:[blocker]}}` sebelum apa pun berubah; belum/tidak lagi disetujui → 422 (`'Pengajuan ini sudah dibatalkan.'` dst.).

## 3. Lampiran (disk privat `config/requests.php`)

- `POST /pengajuan/{id}/lampiran` (multipart, 30/menit): `attachments[]` **atau** satu `file`; PDF/JPG/JPEG/PNG, ≤ 5 MB per berkas, total ≤ 5 per pengajuan. Hanya draf/revisi milik sendiri. → **201** `{request: detail}`. Galat 422 (`'Lampiran harus PDF, JPG, atau PNG.'`, `'Ukuran lampiran maksimal 5 MB.'`, `'Maksimal 5 lampiran.'`, `'Pilih berkas yang akan dilampirkan.'`); status tak bisa diubah → 403.
- `GET /pengajuan/{id}/lampiran/{attachment}` → stream berkas (`Content-Type` asli, `Cache-Control: no-store, private`, `X-Content-Type-Options: nosniff`), audit `request.attachment_viewed`. Tak terlihat → 404; lampiran **sakit** untuk penyetuju pengganti → 403 `'Detail kesehatan disembunyikan untuk penyetuju pengganti.'`; lampiran milik pengajuan lain → 404 (scoped binding).
- `DELETE /pengajuan/{id}/lampiran/{attachment}` → 200 `{request: detail}`; hanya draf/revisi milik sendiri (403 selain itu).

Aturan "sakit > n hari wajib surat" diperiksa saat kirim (`errors.attachments`).

## 4. Persetujuan

### `GET /persetujuan/daftar?tab=menunggu|diputus|disetujui&page=`
→ 200 `{tab, tabs: ['menunggu','diputus'(, 'disetujui')], counts{menunggu, diputus(, disetujui)}, items, meta (20/halaman), can_cancel_approved, delegation{active: {id, delegate: person, starts_on, ends_on}|null, representing: [{id, delegator: person, ends_on}]}}`.
- `menunggu` (urut terlama menunggu): `item + {colleagues|null, step{id, label, on_behalf_of: person|null ("Mewakili X"), since}}`.
- `diputus` (keputusan saya, terbaru dulu): `item + {my_decision{status, status_label, note, decided_at, on_behalf_of|null}}`.
- `disetujui` hanya HR/Super Admin (`requests.cancel_approved`): pengajuan disetujui orang lain dalam cakupan, terbaru diputus dulu; selain itu jatuh ke `menunggu`.
- Staf mendapat antrean kosong (tidak 403). Tidak ada setujui massal (desktop saja).

### `GET /persetujuan/hitung` → 200 `{menunggu: int}` (satu query hitung; lencana Lainnya/Beranda).

### `GET /persetujuan/{id}` → 200 `{request: detail, queue{position|null, total, next_id|null}, my_step: {id, label, step_order, on_behalf_of: person|null, since}|null (hanya bila giliran saya), my_decision: {status, status_label, note, decided_at}|null}`. 404 bila tak terlihat.

### Keputusan (60/menit)
- `POST /persetujuan/{id}/setujui` `{note?}` (≤ 1000)
- `POST /persetujuan/{id}/tolak` `{reason}` wajib (≤ 1000; `note` diterima sebagai alias) → 422 `errors.reason: 'Alasan wajib diisi saat menolak.'`
- `POST /persetujuan/{id}/revisi` `{note}` wajib → 422 `errors.note: 'Catatan wajib diisi saat meminta revisi.'`

Sukses → 200 `{request: detail, next_id|null (pengajuan berikut di antrean saya), menunggu: int}`.
**409** `{message, code: 'sudah_diputus', request{id, status, status_label}}` bila pengajuan tidak lagi menunggu (`'Pengajuan ini sudah ditolak. Tidak ada keputusan yang perlu diambil.'`) atau langkah untuk saya/peran saya sudah diputus (`'Langkah ini sudah diputus oleh {nama|Anda}.'`) — termasuk balapan di dalam row lock. **403** `'Anda tidak bisa memutus pengajuan ini.'` bila memang bukan penyetujunya (mis. pemohon sendiri, belum giliran). 404 bila tak terlihat.

## 5. Delegasi

- `GET /persetujuan/delegasi` → 200 `{today, mine: [delegation], received: [delegation]}` — yang belum berakhir (`ends_on ≥ hari ini`), urut mulai. `delegation = {id, delegator: person, delegate: person, starts_on, ends_on, reason|null, active}`. `received` = "Anda mewakili …".
- `POST /persetujuan/delegasi` (30/menit) `{delegate_id, starts_on, ends_on, reason?}` → **201** `{delegation}`; langkah menunggu langsung dialihkan ke penerima (`RouteToDelegates`, menghormati `allow_delegation` alur). 422: `'Pilih rekan sebagai delegasi.'`, `'Pilih rekan aktif lain sebagai delegasi.'` (diri sendiri/nonaktif/beda perusahaan), `'Tanggal selesai tidak boleh sebelum tanggal mulai.'`, `'Sudah ada delegasi pada rentang tanggal ini.'`, delegasi melingkar.
- `PATCH /persetujuan/delegasi/{id}` (30/menit) — isian yang tidak dikirim tetap; aturan sama (tumpang tindih tidak menghitung dirinya). → 200 `{delegation}`. Hanya pemberi delegasi (HR → 403 `'Hanya pemberi delegasi yang bisa mengubah delegasi ini.'`); tak terlihat → 404.
- `DELETE /persetujuan/delegasi/{id}` → **204**; langkah kembali ke penyetuju asli. Pemberi delegasi atau HR/Super Admin perusahaan (`requests.manage_flows`); lainnya 403/404.
- Pemilih rekan: `GET /orang?q=` (B2-B).

## Uji
`tests/Feature/Api/PengajuanB4aApiTest.php` (14 test): jenis terkunci/eligible/fields/saldo per peran; filter & hitungan daftar; draf → PATCH parsial → unggah/unduh(audit)/hapus lampiran → kirim; jenis terkunci ditolak untuk draf; sakit wajib surat, koreksi batas mundur, total barang server, dinas wajib tujuan; hapus draf, batal, 404 orang luar; detail timeline & saldo non-staf; antrean, hitung, setujui, 409 `sudah_diputus` (diri sendiri & HR lain), tolak wajib alasan; revisi + kirim ulang putaran 2; pembatalan HR + efek + blocker; delegasi (buat, alih langkah, Mewakili, ubah, tumpang tindih, HR hanya menghentikan); penyetuju pengganti sakit tanpa detail kesehatan; pratinjau; 401. `tests/Feature/Api/PengajuanApiTest.php` diperbarui (jenis terkunci kini ditandai, bukan disembunyikan).
