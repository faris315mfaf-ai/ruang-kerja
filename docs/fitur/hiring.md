# Hiring (rekrutmen)

> **Status:** **Nyata** (keputusan pemilik 6 Okt 2026) · tanpa flag fitur · rute `/hiring*` (`routes/hiring.php`) + webhook `POST /api/hiring/form/{token}` · data di `hiring_settings`, `hiring_positions`, `hiring_questions`, `candidates`, `candidate_checklist_items`, `interview_answers`, `interview_scores`, `candidate_notes`, `candidate_decisions` (`docs/DATABASE.md` §4b). Indeks: [README](README.md).

## 1. Tujuan

HR membuka lowongan dan memproses pelamar di satu tempat:

- Pelamar mengisi **Google Form**; setiap jawaban otomatis masuk ke RuangKerja lewat **Google Apps Script** (webhook bertanda tangan HMAC) — server RuangKerja tidak memegang kredensial Google.
- **Profil kandidat**: data kontak, tautan CV (dibuka di tab baru; file tetap di Drive pelamar/HR, tidak disimpan RuangKerja), semua jawaban formulir, dan berkas yang diunggah.
- **Checklist** per pemeriksa: HR, pewawancara ("tim luar"), dan penyetuju akhir (mis. **Faris** dan **Dio**). Masing-masing hanya mencentang butirnya sendiri; HR bisa menambah butir.
- **Wawancara**: HR menyiapkan pertanyaan per lowongan; saat wawancara HR mengisi kolom **Jawaban kandidat** (tersimpan otomatis), setiap pewawancara mengisi **poin** (1..maks) + catatan miliknya sendiri. HR dan penyetuju akhir melihat semua poin, rata-rata per pertanyaan, dan total.
- **Notulensi** wawancara (tambah; ubah/hapus milik sendiri).
- **Keputusan akhir** oleh penyetuju akhir: semua menyetujui → **Diterima**; satu menolak → **Ditolak** (dengan alasan).

## 2. Peran & akses

| Peran | Akses |
|---|---|
| HR, Super Admin | Semua lowongan & kandidat perusahaan: buat/ubah lowongan, pertanyaan, pemetaan field, webhook, pengaturan; pindah tahap; isi jawaban kandidat; tambah/hapus butir checklist; centang butir HR; notulensi |
| Pewawancara lowongan | Lihat lowongan & kandidatnya; isi **poin miliknya sendiri** (tidak melihat poin pewawancara lain); centang checklist miliknya; notulensi |
| Penyetuju akhir lowongan | Lihat lowongan & kandidatnya; lihat **semua** poin; centang checklist miliknya; notulensi; **Setujui/Tolak** saat kandidat di Keputusan akhir |
| Karyawan lain (Kadiv lain, Direksi lain, anggota), perusahaan lain, karyawan nonaktif | **404** di semua rute Hiring; ubin Hiring tidak tampil |

Penyetuju akhir **bawaan** diatur HR di tab Pengaturan (`hiring_settings.default_final_approver_ids`) dan disalin ke setiap lowongan baru; bisa diubah per lowongan. Pewawancara dipilih per lowongan. Hanya karyawan aktif perusahaan yang bisa dipilih. Kebijakan: `HiringPositionPolicy`, `CandidatePolicy`, `CandidateChecklistItemPolicy`, `InterviewScorePolicy`, `CandidateNotePolicy` (+ `HiringSettingPolicy`, `HiringQuestionPolicy`, `InterviewAnswerPolicy`, `CandidateDecisionPolicy`).

## 3. Layar

"Workspace khusus" tanpa baris `workspaces`: halaman `/hiring` bergaya workspace (ubin gradien, judul, baris hitungan, `TabNav` **Kandidat · Lowongan · Pengaturan**). Tampil sebagai **kartu Hiring** pertama di `/workspace`, entri **Hiring** di stack Workspace pada Dock (desktop) dan Rail (tablet), serta baris **Hiring · rekrutmen** di bagian Workspace tab Lainnya (ponsel) — hanya untuk HR, Super Admin, dan pewawancara/penyetuju yang ditugaskan (prop bersama `features.hiring`).

| Rute | Isi | Desktop / tablet | Ponsel |
|---|---|---|---|
| `/hiring` | Kandidat | Papan per tahap (7 kolom, bergulir di dalam papan); pindah tahap lewat menu **Pindahkan** di kartu (tanpa seret) | Chip tahap (dengan jumlah) + daftar kartu; FAB "Tambah kandidat manual" |
| `/hiring/kandidat/{id}` | Profil kandidat | Tab Profil · Wawancara · Checklist · Notulensi · Keputusan + kolom Ringkasan (≥ 1024) | Satu kolom, Ringkasan di atas tab Profil |
| `/hiring/lowongan` | Lowongan | Kartu lowongan (status, jumlah pelamar/proses/diterima, peran Anda) + "Lowongan baru" | Sama, FAB "Lowongan baru" |
| `/hiring/lowongan/{id}` | Pengaturan lowongan (HR) | Detail & status, tim penilai, pemetaan field, pertanyaan, sambungan Google Form, hapus (bila tanpa kandidat) | Satu kolom, tombol simpan menempel di bawah |
| `/hiring/pengaturan` | Pengaturan hiring (HR) | Penyetuju akhir bawaan + templat checklist per peran | Satu kolom |

Filter Kandidat (`?lowongan=` & `?q=`) tersimpan di URL; tab profil di `?tab=` (notifikasi "Beri keputusan" membuka `?tab=keputusan`).

## 3a. Jadwal wawancara (keputusan pemilik 20 Okt 2026)

HR mengatur tanggal, jam, dan tempat wawancara satu kandidat di profil kandidat selama kandidat masih di **Masuk · Seleksi berkas · Wawancara · Penilaian** (`PUT /hiring/kandidat/{id}/wawancara`, rute `hiring.candidates.interview`, Policy `CandidatePolicy::manage`, Action `ScheduleInterview`).

- Isian `interview_at` dalam waktu kantor (`YYYY-MM-DD HH:MM`, juga format `datetime-local`), disimpan UTC di `candidates.interview_at`; `interview_location` maks. 200 karakter. Kosongkan `interview_at` = hapus jadwal (tanpa notifikasi). Tanggal tidak valid (mis. 30 Feb) ditolak dengan pesan di `interview_at`.
- Setiap kali jadwal dibuat/berubah, pewawancara **aktif** lowongan mendapat notifikasi `hiring.interview_scheduled` ("Wawancara {nama}: Kam, 22 Okt 2026 10.30"; email hanya menyebut lowongan).
- Audit `hiring.interview_scheduled` hanya berisi id kandidat dan apakah terjadwal.
- Props profil: `candidate.interview = {at (ISO UTC), local ("Y-m-d H:i" waktu kantor), location, can_schedule}`.
- Jadwal tampil di **Ruang HR › Jadwal** dan agenda **Ringkasan** (`docs/fitur/ruang-hr.md`).

## 4. Alur tahap

**Masuk → Seleksi berkas → Wawancara → Penilaian → Keputusan akhir → Diterima / Ditolak**

- HR memindah tahap ke mana saja (juga membuka kembali kandidat yang sudah diputus), kecuali **Diterima** (hanya lewat penyetuju). **Ditolak** manual wajib alasan.
- **Keputusan akhir** hanya bisa dimasuki bila semua butir checklist **wajib** milik HR dan pewawancara aktif sudah dicentang, dan lowongan punya minimal satu penyetuju akhir aktif. Saat masuk, setiap penyetuju mendapat notifikasi **Perlu tindakan** (`hiring.decision_needed`).
- Penyetuju menyetujui setelah butir wajib miliknya dicentang; menolak wajib catatan. Selama kandidat masih di Keputusan akhir, penyetuju boleh mengubah keputusannya.
- Hasil otomatis: satu penolakan → Ditolak (alasan = catatan penolak); semua penyetuju **aktif** setuju → Diterima. HR mendapat notifikasi `hiring.candidate_decided`; item "Perlu tindakan" penyetuju diselesaikan.
- Memindah kandidat keluar dari Keputusan akhir (atau membuka kembali kandidat yang diputus) menghapus keputusan putaran itu.
- Setiap perpindahan tahap dan keputusan dicatat di `audit_logs` (`hiring.stage_changed`, `hiring.decision_recorded`, `hiring.candidate_decided`) — hanya id, tahap, dan jenis keputusan; data pelamar (nama, email, alasan) tidak ditulis ke audit maupun log.

## 5. Menyambungkan Google Form (langkah demi langkah)

1. **Buat lowongan** di RuangKerja: Hiring › Lowongan › **Lowongan baru** (tersimpan sebagai *Draf*). Draf sudah menerima kiriman, jadi formulir bisa diuji sebelum lowongan dibuka.
2. **Siapkan Google Form** dengan pertanyaan minimal: *Nama lengkap*, *Email* (atau aktifkan "Kumpulkan alamat email"), *No. HP*, dan pertanyaan **Unggah file** *CV* (atau pertanyaan teks berisi tautan CV). Pertanyaan lain (pengalaman, portofolio, ekspektasi gaji, …) bebas; semuanya tampil di profil kandidat.
3. Di RuangKerja buka **Pengaturan lowongan** › **Sambungan Google Form** › **Buat tautan & secret**. Secret hanya tampil sekali — salin, atau langsung klik **Salin skrip** (URL dan secret sudah terisi).
4. Di Google Form: menu titik tiga › **Apps Script**. Hapus isi `Code.gs`, tempel skrip (lihat §6), pastikan `RK_URL` dan `RK_SECRET` terisi, lalu **Simpan**.
5. Pilih fungsi **`pasangPemicu`** di toolbar, klik **Jalankan**, lalu izinkan akses (Form, permintaan ke layanan eksternal, pemicu). Langkah ini sekali saja.
6. **Uji**: isi formulir sekali. Dalam beberapa detik kandidat muncul di tahap **Masuk** dan HR menerima notifikasi "… melamar …". Bila tidak muncul, buka Apps Script › **Eksekusi** untuk melihat galat (mis. `401` = secret salah, `410` = lowongan ditutup).
7. Jawaban yang sudah ada sebelum skrip dipasang bisa dikirim dengan menjalankan **`kirimUlangSemua`** (aman diulang: kiriman dengan `response_id` sama tidak membuat kandidat ganda).
8. Ubah status lowongan menjadi **Dibuka**. Saat **Ditutup**, kiriman baru ditolak (`410`).

**Membuat ulang tautan & secret** langsung mematikan nilai lama; skrip di Google Form harus diperbarui (ulangi langkah 3–4; pemicu tidak perlu dipasang ulang).

### Pemetaan field

RuangKerja mengisi Nama, Email, No. HP, dan CV kandidat dari jawaban formulir. Pengaturan lowongan › **Pemetaan field formulir** berisi judul pertanyaan Google Form untuk setiap data (huruf besar/kecil, spasi ganda, dan tanda `*`/`:` di akhir diabaikan). Bila dikosongkan, dipakai tebakan bawaan:

| Data kandidat | Tebakan bawaan (judul pertanyaan) |
|---|---|
| Nama lengkap | `Nama lengkap`, `Nama`, `Full name`, `Name` |
| Email | `Email`, `E-mail`, `Alamat email`, `Surel`, `Email address` (juga email responden bila Form mengumpulkan email) |
| No. HP | `No. HP`, `No HP`, `Nomor HP`, `No. Telepon`, `Nomor telepon`, `Telepon`, `No. WhatsApp`, `Nomor WhatsApp`, `WhatsApp`, `Phone` |
| CV | `CV`, `Curriculum vitae`, `CV / Resume`, `Resume`, `Unggah CV`, `Upload CV`, `Tautan CV`, `Link CV` — dari jawaban teks (tautan) atau berkas unggahan berjudul sama; bila formulir hanya punya satu pertanyaan unggah, berkas itu dianggap CV |

Tanpa nama, kandidat tetap tersimpan sebagai "Pelamar tanpa nama" (HR bisa memperbaiki lewat **Ubah data**). Email yang tidak valid dan tautan selain `http(s)` diabaikan.

### Kontrak webhook

`POST /api/hiring/form/{token}` — di luar sesi, cookie, dan CSRF; dibatasi 60 permintaan/menit per IP; badan maks. 512 KB.

```http
POST /api/hiring/form/3f0c…(40 karakter)
Content-Type: application/json
X-RuangKerja-Signature: <hex HMAC-SHA256 dari badan mentah dengan secret lowongan>   (boleh diawali "sha256=")

{"response_id":"2_ABaOnud…","submitted_at":"2026-10-05T02:30:00.000Z",
 "answers":[{"question":"Nama lengkap","answer":"Nadia Putri"}, …],
 "files":[{"label":"CV","url":"https://drive.google.com/open?id=…"}]}
```

| Respons | Arti |
|---|---|
| `201 {"status":"created","candidate_id":…}` | Kandidat baru di tahap Masuk; audit `hiring.candidate_received`; notifikasi in-app ke HR |
| `200 {"status":"duplicate",…}` | `response_id` sudah pernah diterima (kiriman ulang) — tidak ada perubahan |
| `401` | Tanda tangan salah/tidak ada |
| `404` | Token tidak dikenal (atau lowongan dihapus) |
| `410` | Lowongan ditutup |
| `413` / `422` | Badan terlalu besar / bukan JSON atau tanpa `response_id` |

## 6. Skrip Apps Script (siap tempel)

Skrip yang sama ada di aplikasi (Pengaturan lowongan › Sambungan Google Form › **Salin skrip**, dengan URL & secret terisi; sumber: `resources/js/features/hiring/apps-script.ts`, diuji `apps-script.test.ts`). JSON dikirim dalam ASCII (karakter non-ASCII di-escape `\uXXXX`) agar tanda tangan dihitung atas byte yang persis sama di kedua sisi.

```js
/**
 * RuangKerja · Hiring — kirim jawaban Google Form ke RuangKerja.
 * 1. Buka Google Form > titik tiga > Apps Script, hapus isi Code.gs, tempel skrip ini.
 * 2. Isi RK_URL dan RK_SECRET dari Pengaturan lowongan di RuangKerja.
 * 3. Simpan, pilih fungsi pasangPemicu, klik Jalankan, lalu izinkan akses.
 * Setiap jawaban baru otomatis masuk ke tahap "Masuk". Kiriman ulang aman (tidak dobel).
 */
const RK_URL = 'TEMPEL_TAUTAN_WEBHOOK_DI_SINI';
const RK_SECRET = 'TEMPEL_SECRET_DI_SINI';

/** Jalankan sekali: memasang pemicu "saat formulir dikirim". */
function pasangPemicu() {
  const form = FormApp.getActiveForm();
  ScriptApp.getProjectTriggers()
    .filter(function (trigger) { return trigger.getHandlerFunction() === 'kirimKeRuangKerja'; })
    .forEach(function (trigger) { ScriptApp.deleteTrigger(trigger); });
  ScriptApp.newTrigger('kirimKeRuangKerja').forForm(form).onFormSubmit().create();
}

/** Dipanggil pemicu setiap ada jawaban baru. */
function kirimKeRuangKerja(e) {
  kirim_(e.response);
}

/** Opsional: kirim semua jawaban yang sudah ada (aman diulang). */
function kirimUlangSemua() {
  FormApp.getActiveForm().getResponses().forEach(function (response) { kirim_(response); });
}

function kirim_(response) {
  const answers = [];
  const files = [];
  const email = response.getRespondentEmail();

  if (email) {
    answers.push({ question: 'Email', answer: email });
  }

  response.getItemResponses().forEach(function (itemResponse) {
    const item = itemResponse.getItem();
    const title = item.getTitle();
    const value = itemResponse.getResponse();

    if (item.getType() === FormApp.ItemType.FILE_UPLOAD) {
      (value || []).forEach(function (fileId) {
        files.push({ label: title, url: 'https://drive.google.com/open?id=' + fileId });
      });
      return;
    }

    let answer = value;
    if (Array.isArray(value)) {
      answer = value.map(function (part) { return Array.isArray(part) ? part.join(' / ') : part; }).join(', ');
    }
    answers.push({ question: title, answer: answer === null || answer === undefined ? '' : String(answer) });
  });

  // ASCII-only JSON: the signature is computed over exactly these bytes.
  const body = JSON.stringify({
    response_id: response.getId(),
    submitted_at: response.getTimestamp().toISOString(),
    answers: answers,
    files: files,
  }).replace(/[\u007f-\uffff]/g, function (c) {
    return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
  });

  const signature = Utilities.computeHmacSha256Signature(body, RK_SECRET, Utilities.Charset.UTF_8)
    .map(function (byte) { return ('0' + (byte & 0xff).toString(16)).slice(-2); })
    .join('');

  const result = UrlFetchApp.fetch(RK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: body,
    headers: { 'X-RuangKerja-Signature': signature },
    muteHttpExceptions: true,
  });

  const code = result.getResponseCode();
  if (code !== 200 && code !== 201) {
    throw new Error('RuangKerja menolak kiriman (' + code + '): ' + result.getContentText());
  }
}
```

## 7. Notifikasi

| Jenis | Penerima | Keterangan |
|---|---|---|
| `hiring.candidate_received` | HR (peran `hr`) | Pelamar baru dari Google Form (bukan untuk kandidat manual) |
| `hiring.decision_needed` | Penyetuju akhir aktif | **Perlu tindakan** sampai ia memutus, kandidat diputus, atau dipindah keluar dari Keputusan akhir |
| `hiring.candidate_decided` | HR | Diterima / Ditolak (alasan hanya in-app) |
| `hiring.interview_scheduled` | Pewawancara aktif lowongan | Jadwal wawancara dibuat/diubah (Ruang HR, 20 Okt 2026) |

Satu baris pengaturan notifikasi: **Hiring: kandidat baru & keputusan akhir** (`hiring.activity`; bawaan in-app nyala, email mati). Email (bila dinyalakan) tidak memuat nama pelamar — hanya judul lowongan.

## 8. Data demo (lokal)

`HiringDemoSeeder` (dipanggil `DatabaseSeeder`): akun demo **Faris** (`faris@demo.test`) dan **Dio** (`dio@demo.test`), peran Direksi, sandi `password`, juga ada di pemilih akun demo; keduanya penyetuju akhir bawaan. Satu lowongan **Staf Programmer Backend** (dibuka, divisi Programming) dengan pewawancara **Dimas** (`kadiv@`) dan **Arif** (`programmer@`), lima pertanyaan, dan enam kandidat: Masuk, Seleksi berkas, Wawancara (poin satu pewawancara), Penilaian, Keputusan akhir (Faris sudah setuju, Dio belum), Diterima.

Coba: masuk sebagai `hr@` → Hiring → pindahkan Yoga (Penilaian) ke Keputusan akhir → masuk sebagai `dio@` → Inbox "Perlu tindakan" → buka Ratna → tab Checklist (centang butir Dio) → tab Keputusan → Setujui → Ratna **Diterima**, HR mendapat notifikasi. Sebagai `programmer@`: tab Wawancara hanya menampilkan poin miliknya. `anggota@`, `maya.lestari@`, `direksi@` mendapat 404 di `/hiring`.

## 9. Yang ditahan / di luar cakupan

- **Integrasi Google API** (membaca Form/Drive langsung, menyimpan CV ke Shared Drive) ditahan pemilik; sambungan memakai Apps Script milik pemilik Form.
- **Ekspor** data pelamar sengaja tidak dibuat (data pribadi).
- Tanpa unggah file ke RuangKerja: CV dan berkas tetap berupa tautan.
- Pewawancara/penyetuju yang ditambah saat kandidat sudah di Keputusan akhir tidak menerima notifikasi ulang (pindahkan kandidat keluar lalu masuk lagi untuk memicu ulang).
- Retensi/penghapusan otomatis data pelamar belum diatur (perlu kebijakan pemilik; UU PDP).

## Retensi data pelamar (keputusan pemilik 6 Okt 2026)

Data pelamar disimpan **30 hari** (`HIRING_RETENTION_DAYS`, `config/hiring.php`), dihitung sejak keputusan akhir (Diterima/Ditolak), sejak HR menghapus kandidat, atau — untuk kandidat yang belum diputus — sejak lowongan ditutup. Setelah itu job harian `PurgeExpiredApplicantData` (02.30 WIB) menghapus permanen kandidat beserta checklist, jawaban, poin, notulensi, keputusan, dan notifikasi Inbox tentangnya. Audit hanya mencatat jumlah yang dihapus (`hiring.applicants_purged`). Bila pelamar diterima, data yang perlu disimpan dipindah HR ke profil karyawan sebelum masa retensi habis.
