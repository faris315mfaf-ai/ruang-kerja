# Kontrak API ponsel — B6 Sakit / izin di Absen (Bagian 5)

> 14 Okt 2026 · Claude Code (S1) · branch `claude/android-bagian-5`. Permintaan pemilik: "ajukan permohonan sakit/izin pada absen untuk di acc. Sakit maksimal diajukan jam 12.00 hari kerja. Izin maksimal juga jam 12.00 hari kerja, lewat itu alpha."
> Semua aturan ditegakkan **server** (jam server, waktu kantor `Asia/Jakarta`); klien hanya menampilkan dan boleh mengunci tombol lebih awal. Tidak ada rute baru: yang berubah adalah isi payload `GET /api/v1/absensi/hari-ini`, `GET /api/v1/pengajuan/jenis` dan galat 422 `POST /api/v1/pengajuan` (+ `/pengajuan/{id}/kirim`, `/kirim-ulang`).

## 1. Aturan

Untuk jenis berkategori `sick` (SKT) dan `permit` (IZN) yang punya `submit_cutoff_time` (bawaan `12:00`):

| Tanggal mulai (izin per jam: `date`) | Hasil kirim |
|---|---|
| **hari ini**, sebelum jam batas | diterima |
| **hari ini**, tepat jam batas atau sesudahnya (12:00:00 sudah terlambat) | **422** |
| **sudah lewat** (sebelum hari ini) | **422** |
| **mendatang** | diterima kapan saja |

- Pengajuan beberapa hari hanya dinilai dari **tanggal mulai**.
- **Simpan draf** (`POST /pengajuan/draf`, `PATCH /pengajuan/{id}`) tidak dibatasi; hanya **kirim** (`POST /pengajuan`, `POST /pengajuan/{id}/kirim`, `.../kirim-ulang`).
- Kirim ulang setelah revisi dengan **tanggal yang sama** dengan pengiriman semula tetap diterima (pengiriman semula tepat waktu); tanggal yang diubah dinilai ulang.
- Hari kalender biasa: akhir pekan/libur tidak dikhususkan di aturan jam; tanggal bukan hari kerja tetap ditolak oleh perhitungan periode seperti biasa (`Rentang tanggal tidak berisi hari kerja.`).
- Kategori lain (cuti, lembur, koreksi, dinas, barang) tidak terpengaruh. `submit_cutoff_time` null = tanpa batas dan tanpa penolakan tanggal lampau.
- HR mengubah/mengosongkan jam di Admin › Jenis pengajuan ("Batas pengajuan di hari-H (jam)"; web saja).

## 2. Galat kirim (422)

Bentuk Laravel biasa `{message, errors{field:[pesan]}}`, kunci = isian tanggal yang dinilai (`start_date`, atau `date` untuk izin per jam). Teks tetap (`kind` = `sakit` | `izin`):

- Hari ini lewat batas → `errors.start_date[0]` = `Batas pengajuan sakit untuk hari ini pukul 12.00 sudah lewat. Hari ini tercatat alpha bila Anda tidak absen.` (jam sesuai pengaturan; izin per jam: `errors.date`).
- Tanggal lampau → `errors.start_date[0]` = `Pengajuan sakit untuk tanggal yang sudah lewat tidak diterima, hari itu tercatat alpha. Hubungi HR bila perlu dikoreksi.`

Tidak ada `code` khusus; klien cukup menampilkan `errors.start_date[0]` / `errors.date[0]` dan menyegarkan `GET /absensi/hari-ini`.

## 3. Payload jenis (`GET /pengajuan/jenis`, juga di `type` semua item/detail)

Tiga kunci aditif pada setiap `type` (selalu ada; null/false untuk jenis tanpa batas):

```json
{ "code": "SKT", "submit_cutoff_time": "12:00",
  "submit_cutoff_label": "Batas pengajuan hari ini pukul 12.00",
  "submit_closed_today": false }
```

- `submit_cutoff_time`: `HH:MM` waktu kantor atau `null`.
- `submit_cutoff_label`: kalimat siap tampil atau `null`.
- `submit_closed_today`: `true` bila jam server sudah melewati batas **saat respons dibuat** (kuncikan pilihan "hari ini"; tanggal mendatang tetap boleh). Server tetap memutuskan saat kirim.

## 4. State Absen — `leaveShortcut`

Ada di `GET /absensi/hari-ini` pada `state.leaveShortcut` **dan** `today.leaveShortcut` (props web Absensi sama):

```json
{
  "available": true,
  "sickCutoff": "12:00", "permitCutoff": "12:00",
  "sickClosed": false,  "permitClosed": false,
  "sickType":   { "id": "01J…", "code": "SKT", "name": "Sakit" },
  "permitType": { "id": "01J…", "code": "IZN", "name": "Izin" },
  "closedReason": null,
  "pending": null
}
```

- `available` = hari ini hari kerja menurut jadwal (tanpa shift: Senin–Jumat tanpa libur), **belum check-in**, tidak ada pengajuan cuti/izin hari penuh/sakit yang sudah **disetujui** untuk hari ini, tidak ada pengajuan sakit/izin yang **menunggu** untuk hari ini, ada jenis sakit atau izin yang aktif, tidak terkunci, dan berhak, **dan** minimal satu jenisnya belum lewat batas. Selain itu `false`. Saat ada hari terbuka (sudah check-in, perlu check-out) selalu `false` dan `sickType`/`permitType` null.
- `sickType` / `permitType`: jenis yang dibuka pintasan (pertama yang aktif, tak terkunci, berhak); null bila tidak ada. `sickClosed` / `permitClosed`: batas jenis itu sudah lewat (satu bisa tertutup, satu masih terbuka, mis. batas izin diatur 14:00).
- `closedReason`: hanya bila pintasan tertutup **karena batas jam** (dan tidak ada pengajuan yang menunggu): `Batas pengajuan sakit/izin pukul 12.00 sudah lewat.` · `Batas pengajuan sakit pukul 12.00 dan izin pukul 14.00 sudah lewat.` · variasi satu jenis. Selain itu `null`. Tampilkan sebagai catatan redup; teks pendamping yang dipakai web: "Hari ini tercatat alpha bila Anda tidak absen."
- `pending`: `{id, number, typeLabel, status ('pending'|'revision_requested'), statusLabel}` bila ada sakit/izin hari ini yang menunggu keputusan/revisi, selain itu `null`. Tampilkan "Pengajuan {typeLabel} {number} menunggu persetujuan" dengan tautan ke `GET /pengajuan/{id}` (`revision_requested`: "perlu direvisi"). Tetap ada walau batas sudah lewat; saat `pending` ada, `available=false` dan `closedReason=null`.
- Bentuk lain di `state` tidak berubah (jendela absen `windows`, `center`, …). Server menghitung ulang tiap pemanggilan; segarkan setelah mengirim pengajuan, saat aplikasi dibuka kembali, dan tepat sesudah jam batas.

**Alur klien yang disarankan**: tombol/kartu "Tidak masuk? Ajukan sakit / izin" tampil bila `available`; pilihan Sakit/Izin membuka form pengajuan dengan jenis `sickType.id`/`permitType.id` dan tanggal = `state.officeDate` (izin: mode hari atau jam, ikut `modes` di `GET /pengajuan/jenis`). Sembunyikan pilihan yang `*Closed=true`. Hitung mundur lokal boleh, tetapi 422 server tetap menang.

Deep link web (bukan API): `/pengajuan/baru?jenis=SKT&tanggal=YYYY-MM-DD` (kode jenis atau id; jenis terkunci/tak berhak diabaikan).

## 5. Interaksi dengan absensi

- Pengajuan hari ini yang masih `pending` saat job tutup hari 00.30: hari itu ditulis **Alpha** dulu. Persetujuan berikutnya mengubah baris itu menjadi **Sakit/Izin** dan menautkan pengajuan (sama seperti persetujuan tanggal lampau mana pun); saldo/efek lain tidak berubah. Ditolak atau dibatalkan: tetap Alpha.
- Lewat batas jam tanpa pengajuan dan tanpa check-in: hari itu tetap Alpha saat ditutup.
- Pengajuan sakit/izin hari ini yang masih menunggu **tidak** memblokir check-in; sudah disetujui hari penuh → check-in diblokir seperti biasa; setengah hari/dinas tetap boleh check-in.

## Uji

`tests/Feature/Requests/SickPermitCutoffTest.php` (matriks batas, hari lampau/mendatang, multi-hari, izin per jam, tanpa batas, kategori lain, draf, kirim ulang, zona waktu, tutup hari + persetujuan terlambat) dan `tests/Feature/Requests/SickPermitShortcutTest.php` (state `leaveShortcut`, API `hari-ini` dan `jenis`, 422 kirim, pratinjau web, admin HR/staf, deep link, migrasi). Vitest: `resources/js/features/attendance/leave-shortcut.test.ts`, `map/card-map.test.tsx`.
