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

---

# Aplikasi — fondasi offline (agen AO1, 14 Okt 2026)

Kode: `apps/mobile/src/offline/**`. Agen fitur (absen, tugas & komentar, catatan, laporan harian, pengajuan) **membangun di atas API ini**; jangan membuat penyimpanan/antrean sendiri.

## 1. Penyimpanan

- `expo-sqlite` **dengan SQLCipher aktif** (config plugin `["expo-sqlite", {"useSQLCipher": true}]` di `app.json`; build debug SDK 57 / RN 0.86 arsitektur baru berhasil). Kunci acak 256-bit dibuat sekali (`expo-crypto`), disimpan di `expo-secure-store` (`rk.offline.kunci.v1`), dipasang lewat `PRAGMA key`. Terverifikasi di emulator: `PRAGMA cipher_version` terisi dan 16 byte pertama `rk-offline.db` acak (bukan "SQLite format 3"). Bila suatu build tak memuat SQLCipher, kode jatuh ke SQLite biasa di folder privat aplikasi dan layar Pengaturan › Penyimpanan offline menulis "Disimpan di folder privat aplikasi" (`statusEnkripsi()` = `'polos'`).
- Kunci hilang / berkas rusak → basis data dibuat ulang (isinya hanya salinan; **item antrean ikut hilang** — risiko kecil, terjadi hanya bila Keystore ter-reset).
- Berkas biner antrean (selfie, lampiran ≤ 5 MB per berkas, ≤ 20 MB per item) disimpan sebagai **BLOB di tabel `berkas` basis data terenkripsi**, bukan berkas telanjang di `documentDirectory` (menyimpang dari saran awal agar selfie ikut terenkripsi). Dihapus bersama itemnya (sukses/dibuang/keluar). Berkas sumber (`uri`) yang berada di folder cache dihapus setelah disalin (`hapusSumber`).
- Dibuka **malas** (saat sesi diketahui + setelah interaksi awal, atau saat pertama dipakai); modul `expo-sqlite` dimuat lewat `import()` dinamis. Skema berversi `PRAGMA user_version` (`MIGRASI` di `db.ts`; tambah entri di akhir, jangan ubah yang lama). Semua akses lewat satu mutex (`denganDb` / `denganTransaksi`).
- Tabel: `cache`, `antrean`, `berkas`, `meta`. Semua baris bersekat per `uid` pengguna.

## 2. Jaringan (`jaringan.ts`)

`useOnline()`, `adalahOnline()`, `terakhirOnline()`, `periksaSegera()`, `saatOnline(cb)`. `online = OS terhubung (expo-network) && server terjangkau`. Jangkauan dipelajari dari permintaan nyata (status 0 → tak terjangkau; jawaban HTTP apa pun → terjangkau) dan probe `GET /konfigurasi` dengan backoff 3 → 30 dtk hanya saat OS terhubung dan aplikasi di latar depan. **Tanpa polling** saat OS tanpa jaringan / di latar belakang. `PemantauJaringan` dipasang seumur aplikasi di `app/_layout.tsx` (termasuk layar Masuk — lihat catatan bug di bawah).

`apiRequest` (src/api/client.ts):
- jaringan diketahui mati → **gagal cepat** (`ApiError { status: 0, offline: true }`) tanpa menyentuh jaringan; GET yang punya salinan cache dijawab dari cache. Server baru saja gagal → permintaan tetap dicoba dengan batas waktu ≤ 8 dtk.
- opsi baru: `cache?: false` (lewati cache), `idempotencyKey`, `hasil?: HasilPermintaan` (`dariCache`, `cachedAt`, `replayed`, `status`).
- `ApiError.offline: boolean` baru.

## 3. Cache baca (stale-while-revalidate)

Hanya GET. **Jaringan dulu**, salinan hanya dipakai bila jaringan gagal (perilaku online tidak berubah); respons sukses menulis cache (dibuffer 500 ms, satu transaksi). Batas: 25 MB total (buang yang paling lama dipakai sampai 80%), 1,5 MB per entri, umur maks. 14 hari. Kunci = path + query terurut, bersekat per pengguna.

- **Boleh** (`bolehCache` di `cache.ts`): `beranda`, `briefing*`, `tugas*`, `workspace*`, `catatan*`, `rapat*`, `kalender`, `pengajuan*` (daftar/detail/jenis; bukan `pengajuan/pratinjau`), `inbox*`, `obrolan*`, `pengumuman*`, `kinerja`, `dashboard/{tampilan,saya,divisi}`, `orang` (direktori nama), plus persis `auth/saya`, `konfigurasi`, `absensi/hari-ini`, `absensi/riwayat`, `absensi/rekap`, `laporan`, `laporan/hari-ini`.
- **Tidak pernah** (dicek lebih dulu): `hiring*`, `admin*`, `hr*`, `auth*` (kecuali `auth/saya`), `perangkat*`, `persetujuan*`, `privasi*`, `saldo-cuti`, `absensi/log*` (selfie), `absensi/tim*`, `absensi/hari/*`, `karyawan*`, `cari`, `monitoring`, `manajemen`, `okr`, `portofolio`, `proyek`, `organisasi`, `laporan/{tim,orang,cari}`, `catatan-tindakan`, dan path memuat `selfie`, `/video/`, `/transkrip`, `/notulen-otomatis`, `/dibaca-oleh`, `/versi`, `/cari`, `/lampiran`. Menambah modul: edit `IZIN_*`/`TOLAK_*` di `cache.ts` (modul sensitif: jangan).
- **Chip "data basi"**: `Screen` (`src/ui/Screen.tsx`) memasang `ChipDataBasi` otomatis — "Offline · data per 09.12"; begitu online lagi menjadi "Data per 09.12 · tarik ke bawah untuk memperbarui" dan `onRefresh` layar dipanggil sekali otomatis. Hook `useDataBasi(): { basi, ts }` untuk layar yang tidak memakai `Screen`. Layar **tidak perlu diubah** agar data cache tampil.
- Dihapus: keluar akun (semua), 401 (cache saja), Pengaturan › "Hapus data offline" (cache saja).

## 4. Antrean tulis (`antrean.ts`)

Impor dari `@/offline`:

```ts
enqueue(masukan: MasukanAntrean): Promise<ItemAntrean>
daftarkanPenangan(jenis: string, p: Penangan): () => void
onAntrean(l): () => void                       // 'diantrekan' | 'sukses' | 'konflik' | 'dibuang' | 'selesai'
useAntrean(selector?) / useRingkasanAntrean()  // { total, menunggu, perluPeriksa, sinkron }
cobaLagi(id, patch?) · hapusItem(id) · perbaruiItem(id, patch) · tulisUlangMenunggu(pred, fn)
sinkronkanSekarang() · ambilItem(id) · cariItem(pred) · bacaBerkasItem(id) · jumlahTertunda()
buatUlid()  useOnline()  adalahOnline()
```

`MasukanAntrean`: `jenis`, `label` (judul di layar), `ringkas?`, `method`, `path` (relatif API), `json?` | `formFields? + berkas?[{field,nama,mime,uri|bytes}]`, `clientId?` (= `Idempotency-Key`; bawaan ULID — beri sendiri bila id yang sama dipakai sebagai id sementara di UI), `urutanKunci?` (bawaan `jenis`; item berkunci sama dikirim satu per satu sesuai urutan masuk, kunci berbeda boleh paralel maks. 2; **item `konflik`/`gagal` menahan item berikutnya dengan kunci sama** — pakai kunci yang sama untuk item yang saling bergantung, mis. `tugas:<id>`, `absensi`), `dedupeKunci?` (item menunggu/konflik/gagal berkunci sama digantikan; hasil akhir menang), `meta?` (JSON bebas milik fitur), `dibuatPada?` (waktu kejadian di perangkat, ISO/Date; bawaan sekarang), `kedaluwarsaJam?` (lebih tua → `konflik` "tidak dikirim otomatis"; absen: 72), `waktuOfflineKey?` (nama field, mis. `offline_at`, yang diisi `dibuatPada` saat kirim di json/formFields).

**Mendaftarkan penangan** (opsional per jenis; tanpa penangan item dikirim apa adanya): buat berkas milik fitur, mis. `src/features/absensi/offline.ts`, panggil `daftarkanPenangan('absensi.masuk', {...})` di level modul, lalu tambah satu baris `import '@/features/absensi/offline';` ke **`src/offline/penanganFitur.ts`** (diimpor `OfflineMonitor` saat aplikasi dibuka sehingga terdaftar sebelum mesin mengirim sisa sesi lalu; jangan daftarkan di dalam komponen). Callback:
- `bangunPermintaan(item)` → `{method?, path?, json?, formFields?}` untuk menulis ulang isi (ganti id sementara dengan id asli dari item sebelumnya; set `offline: 'true'`), atau `'lewati'` (buang tanpa kirim);
- `sesudahSukses(item, respons, {replayed})` — item sudah dihapus; perbarui state lokal / panggil `tulisUlangMenunggu(...)` untuk item bergantung. `replayed` = server memutar ulang hasil (`respons` bisa `{message:"Sudah diproses.", replayed:true}`: baca ulang sumber dayanya);
- `sesudahKonflik(item, galat)` — 4xx; item tinggal `konflik`;
- `sesudahDibuang(item)` — pengguna menghapus; kembalikan state optimistis;
- `ubah(item)` — mengaktifkan tombol "Ubah" di layar Antrean (buka layar ubah; simpan lewat `cobaLagi(id, patch)`).

**Perilaku**: status `menunggu` / `mengirim` (hanya memori) / `gagal` / `konflik`. Kirim dengan header `Idempotency-Key: <kunciIdem>`. Jaringan gagal/status 0 → tetap `menunggu` (tidak dihitung percobaan, dicoba lagi saat online). 5xx/429/408/425/`idempotency_in_progress` → backoff 5 dtk × 2ⁿ (maks. 15 mnt, hormati `Retry-After`), setelah 12 percobaan → `gagal`. **401 → seluruh antrean dijeda** sampai masuk ulang (strip merah "Sinkron dijeda"). Semua 4xx lain (422, 409, 403, 404, `idempotency_conflict`) → `konflik` dengan pesan server. Sesuai kontrak server (bagian A): kunci yang **ditolak 4xx diputar ulang** → `cobaLagi` pada item `konflik` otomatis membuat **kunci idempotensi baru** (`kunciIdem`), sedangkan `gagal` (5xx) memakai kunci yang sama. Pemicu: online kembali, aplikasi aktif, setelah `enqueue`, "Sinkronkan sekarang", dan satu pewaktu (≤ 30 dtk) hanya selama ada item menunggu & online & foreground. Proses mati: item tersimpan di DB; saat mulai, status `mengirim` dikembalikan ke `menunggu` (kunci sama → server tidak menggandakan). Item akun lain dibuang saat sesi baru dimulai.

**Catatan untuk fitur absen**: absen offline = `enqueue({ jenis:'absensi.masuk', urutanKunci:'absensi', method:'POST', path:'absensi/check-in', formFields:{latitude,…}, berkas:[{field:'selfie',uri,…}], dibuatPada:<jam tombol ditekan>, kedaluwarsaJam:72, waktuOfflineKey:'offline_at' })` + `bangunPermintaan` yang menambah `offline:'true'`; `offline_at` dikirim ISO dengan `Z` (diterima server). Item `konflik` berkode `offline_expired`/`offline_clock_invalid` → tawarkan "ajukan koreksi absensi" lalu `hapusItem`.

## 5. UI

- **Strip status** (`StatusOffline.tsx`, `KerangkaOffline` di `app/_layout.tsx`): satu strip 44 dp di bawah status bar, **di dalam alur** (tidak menutup app bar/FAB/tab bar); saat tampil konteks area aman anak memakai `top = 0`. "Offline · N menunggu" (kuning, baru tampil setelah 1,5 dtk offline) · "Menyinkronkan N…"/"N menunggu dikirim" (biru) · "N perubahan perlu diperiksa" (merah, menetap) · "Sinkron dijeda · masuk lagi…" (merah) · "Semua tersinkron" (hijau, hilang 3 dtk). Ketuk → `/sinkron`.
- **`/sinkron`** (`app/sinkron.tsx` → `LayarSinkron`): daftar item (label, `HH.mm`, chip status, pesan galat, Coba lagi / Ubah / Hapus dengan konfirmasi, target 48 dp), "Sinkronkan sekarang", keadaan kosong, tarik untuk sinkron. Masuk lewat Lainnya › Pekerjaan › "Antrean sinkron" (lencana jumlah) dan strip. Terdaftar di `Stack.Protected`.
- **Snackbar** (`OfflineMonitor`): "N item tersinkron" (hijau); konflik → peringatan dengan pesan server (satu item) atau "N perubahan perlu diperiksa" + aksi "Lihat".
- **Pengaturan › Penyimpanan offline** (`app/pengaturan/penyimpanan-offline.tsx`): ukuran cache & basis data, status enkripsi, jumlah menunggu, sinkron terakhir, "Hapus data offline" (hanya cache; antrean aman).
- **Keluar akun**: dialog memperingatkan bila ada item (`jumlahAntreanTertunda()` di `useKeluar` kini nyata); keluar/akun nonaktif menghapus **semuanya**; 401 (sesi berakhir) hanya menghapus cache, antrean dipertahankan untuk masuk ulang dengan akun sama.

## 6. Cara uji offline di emulator

```bash
D=emulator-5568        # emulator milik agen sendiri
adb -s $D shell cmd connectivity airplane-mode enable   # offline (strip kuning muncul ±1,5 dtk)
adb -s $D shell cmd connectivity airplane-mode disable  # online; sinkron otomatis
# alternatif: adb -s $D shell svc wifi disable && adb -s $D shell svc data disable
```

Catatan: build **debug** memuat bundle dari Metro lewat `adb reverse`; cold start saat airplane mode tidak bisa dites di build debug (bundle tak termuat) — mulai ulang aplikasi saat online, lalu aktifkan airplane. Setelah airplane mode, jalankan ulang `adb reverse tcp:8081 tcp:8081 tcp:8001` bila perlu. Ubah paket native: `CI=1 npx expo prebuild --platform android` lalu `./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a`.

Hasil uji manual (emulator 5568, akun maya.lestari, server lokal dengan migrasi `api_idempotency_keys`): cache terisi online → airplane → layar tetap terbaca dengan chip "Offline · data per …"; 4 komentar diantre offline → airplane off → terkirim otomatis, server berisi **tepat 4 komentar dan 4 kunci** (tanpa duplikat); 3 komentar diantre lalu aplikasi dimatikan paksa → dibuka ulang → 3 terkirim (total 10, 10 kunci); kegagalan server (tabel idempotensi belum ada, 500) tampil sebagai item "Menunggu" dengan pesan dan backoff, lalu terkirim setelah migrasi; keluar akun dengan 1 item menampilkan dialog peringatan dan item tidak terkirim setelah masuk lagi; data cache hilang setelah keluar.

## 7. Belum / diketahui

- ~~Tidak ada pengiriman di latar belakang~~ — kini ada (lihat bagian "Sinkron latar belakang" di bawah); mesin foreground tetap hanya berjalan saat aplikasi aktif.
- Jalur 401 saat sesi berjalan (antrean dijeda → masuk ulang → lanjut) dikodekan tetapi belum diuji live.
- Cold start offline di build debug tak teruji (lihat catatan); jalur kode sama dengan kembali dari latar belakang.
- Bug yang ditemukan & diperbaiki saat uji: pemantauan jaringan sempat ikut dilepas saat keluar akun sehingga status "offline" basi membuat login gagal cepat → kini `PemantauJaringan` seumur aplikasi.
- Handler per fitur (absen, tugas, komentar, catatan, laporan, pengajuan) belum ada; `penanganFitur.ts` kosong.
- `orang` (direktori nama) masuk daftar cache agar pemilih penanggung jawab/mention bisa dipakai offline; keluarkan dari `IZIN_AWALAN` bila pemilik menilai ini data karyawan sensitif.

---

# Penangan fitur: absen/pengajuan (agen AO2, 14 Okt 2026)

Kode: `apps/mobile/src/features/absensi/{offline,overlay,kirim,HasilAntre}.ts(x)`, `src/features/pengajuan/{offline,DetailAntre,ChipSinkron}`. Dua baris `import` di `src/offline/penanganFitur.ts`. Tambahan kecil pada fondasi (aditif): `Penangan.pesanSukses` (teks snackbar khusus fitur, dipakai `OfflineMonitor`), `Penangan.catatan` (catatan di baris Antrean, mis. peringatan 60 jam) dan `Penangan.aksiKonflik` (tombol tambahan di item `konflik`, mis. "Ajukan koreksi absensi").

## Absen masuk/pulang

- **Yang diantre**: GPS+selfie, WFH (`POST absensi/check-in|check-out`, multipart; selfie = BLOB, `work_plan[i]` / `work_report[i]`, `latitude/longitude/accuracy/mock_location/device_id/note`, `client_time`, `offline=true`) dan pindai QR (`.../qr`, JSON). `offline_at` diisi mesin dari `dibuatPada` = **jam HP saat tombol ditekan** (`waktuOfflineKey`). Item `absensi.masuk|pulang[.qr]`, `kedaluwarsaJam=72`.
- **Kapan diantre**: perangkat tidak online (`adalahOnline()` salah) **atau** kirim online gagal status 0. Kunci idempotensi dibuat sekali per aksi dan dipakai percobaan online **dan** item antrean (`clientId`), jadi absen yang ternyata sudah diterima server tidak ganda (diputar ulang). Jalur online lain tidak berubah (hanya header `Idempotency-Key` ditambah).
- **Urutan**: satu `urutanKunci` `absen:<uid>` → masuk sebelum pulang, per urutan tekan; item `konflik`/`gagal` menahan item berikutnya (UI mengunci absen baru + banner sampai diperiksa di Antrean).
- **Keadaan hari di HP** (`overlay.ts`, murni): `keadaanEfektif(state, {sekarang HP, offline, windowsApply, antre, konfirm})` — salinan cache `hari-ini` dari hari lain → "Belum check-in" (jadwal/libur/pengajuan tak bisa dipastikan, ada pesan jujur); `too_early`/`window_closed` dan `canCheckOut` + `checkOutBlockedReason` dihitung ulang dari `windows` perusahaan dengan jam HP (inklusif per menit seperti server); jam server dari cache **tidak** dipakai sebagai offset jam (`info.dariCache`). Aturan shift ("dibuka X menit sebelum masuk") memakai `windowOpensAt` tersimpan. Server tetap hakim.
- **Lapisan optimistis**: masuk diantre → `checked_in` "Sudah check-in HH.mm · menunggu sinkron" (kartu Absen, Beranda `HeroAbsensi`, tombol tengah bergeser ke Workspace + penanda awan di `TabBar`) dan menawarkan "Check-out lebih awal"/pulang; pulang diantre → "Selesai · menunggu sinkron" (durasi perkiraan, rencana & laporan dari antrean); masuk kedua di hari yang sama diblokir. Setelah tersinkron: `catatTersinkron` (memori) + `umumkanAbsenBerubah` → layar Absen & `AttendanceStatusProvider` memuat ulang; snackbar "Absen masuk 22.16 tersinkron".
- **Hasil**: layar `HasilAntre` ("Tersimpan di HP · akan dikirim otomatis saat online", jam HP, jarak ke kantor dari data tersimpan, catatan "ditandai Absen offline untuk ditinjau HR, maks. 72 jam"). Tanpa data lokasi kantor tersimpan: banner jujur, absen tetap boleh.
- **Konflik**: pesan server tampil di banner Absen + baris Antrean; `offline_expired`/`offline_clock_invalid`/`kedaluwarsa` → tombol "Ajukan koreksi absensi" (`/pengajuan/baru?jenis=KOR&tanggal=…`), lalu pengguna menghapus item. Item ≥ 60 jam: catatan kuning di baris Antrean ("kalau tidak absen ini hangus"). 429 ditangani mesin.
- **Tetap online-saja**: unduh rekap, riwayat/detail hari (hanya cache baca), koreksi oleh HR, persetujuan lokasi (consent) — consent tersimpan di `state` cache; bila server menolak `consent_required` saat sinkron → konflik.
- **Risiko**: jam HP diubah pengguna (server memeriksa ≤ 5 menit di depan, urutan per perangkat, menandai semuanya); hari berganti saat offline lama → keadaan hari dibangun dari asumsi "belum absen" (server menolak `already_checked_in`/`day_has_request` bila salah); kunci Keystore hilang membuang antrean; shift malam: overlay "aktif" masuk < 20 jam.

## Pengajuan

- **Diantre**: pengajuan **baru** = satu `POST pengajuan` (buat + kirim; lampiran ≤ 5 MB sebagai BLOB ikut multipart `attachments[]`; `urutanKunci pengajuan:<idSementara>`, id sementara = `Idempotency-Key`); **draf server** = `POST pengajuan/{id}/lampiran` lalu `POST pengajuan/{id}/kirim` (satu `urutanKunci pengajuan:<id>`). Kirim online yang gagal status 0 memakai kunci yang sama saat diantre.
- **Pengajuan saya**: kartu antre di atas daftar (Semua/Menunggu) dengan chip "Menunggu sinkron" / "Gagal sinkron" (+ pesan server), tanpa nomor; detail untuk id sementara = salinan lokal read-only (`DetailAntre`: Sinkronkan, Ubah, Hapus; draf server hanya Hapus/Sinkronkan). Saat tersinkron, id sementara dipetakan ke id asli (`idAsli`) dan layar yang terbuka berpindah ke detail asli; daftar dimuat ulang (`onPengajuanBerubah`).
- **Kejujuran**: banner form offline ("disimpan di HP dan dikirim otomatis saat online"), catatan sakit/izin "Offline: pengajuan dinilai saat terkirim (batas hari-H pukul 12.00)" (form, layar terkirim, detail, baris Antrean); `submit_closed_today` dari cache dihitung ulang dari jam HP; ringkasan alur/saldo tak tersedia offline. Tombol "Simpan & kirim nanti".
- **Konflik**: 422 (batas 12.00 lewat, tanggal lampau, saldo, bentrok, dll.) → `konflik` dengan pesan server; "Ubah & kirim" membuka form berisi isian (lampiran dipulihkan dari BLOB ke cache) → kirim membuat kunci baru dan menghapus item lama.
- **Online-saja** ("Butuh koneksi", tidak pernah diantre): batal pengajuan, ubah/hapus draf server, **kirim ulang revisi**, pembatalan HR, **persetujuan** (setuju/tolak/revisi, delegasi). Layar detail menukar tombol dengan banner "Butuh koneksi" saat offline.

## Verifikasi (emulator 5576, `programmer@demo.test`, server lokal)

Airplane on → check-in (selfie kamera virtual + GPS di Kantor Pusat + rencana) selesai lokal; Absen/Beranda/tombol tengah menunjukkan "menunggu sinkron"; check-out (laporan) diantre dan Absen menampilkan "Selesai · menunggu sinkron" → airplane off → tepat **satu** check-in dan **satu** check-out di server (`attendance_logs`: `occurred_at` = jam HP, `received_at` terisi, `flags` = `["dark_selfie","offline"]`, `is_suspicious` true, hari `present` dengan `work_plan`/`work_report`), snackbar "Absen masuk 22.16 tersinkron". Konflik: absen pulang diantre lalu pulang ditembak langsung via API → sinkron menolak "Anda sudah check-out…" → banner Absen, baris Antrean `Perlu diperiksa`, Hapus. Aplikasi dimatikan paksa saat 2 pengajuan antre → dibuka online → sakit terkirim (`SKT-2026-10-0002`, tepat satu baris) dan izin tanggal lampau ditolak server → "Gagal sinkron" + pesan server + "Ubah & kirim" membuka form terisi. Data uji (`attendance_days/logs`, `requests`, kunci idempotensi, perangkat curl) dibersihkan.

**Belum teruji live**: pindai QR offline (tidak ada kiosk), antrean absen > 60 jam / `offline_expired` asli (hanya jalur kode & konflik lain), lampiran pengajuan dari antrean, kirim draf server offline (`pengajuan/{id}/kirim`), persetujuan offline (akun uji bukan penyetuju; hanya teks), TalkBack. Peringatan dev "Can't perform a React state update on a component that hasn't mounted yet" muncul sekali saat buka dingin (bersumber di luar modul ini; tidak direproduksi lagi).

---

# Penangan fitur: tugas, catatan, laporan harian (agen AO3, 14 Okt 2026)

Kode: `apps/mobile/src/offline/fitur/{tugas,tugasBersama,tugasOverlay,catatan,catatanOverlay,laporan,umum,useSetelahSinkron}.ts`, `src/offline/ChipMenunggu.tsx` (chip "Menunggu sinkron"/"Gagal sinkron", dibaca TalkBack), perubahan layar di `features/{tugas,workspace,catatan,laporan}`. Tiga baris `import` di `penanganFitur.ts`. Prinsip bersama: **kirim online dulu bila tak ada antrean untuk objek itu; offline (atau kirim gagal status 0, atau objek masih punya item di antrean) → antrean**. Pembuatan (tugas, komentar, catatan) memakai kunci idempotensi yang sama di percobaan online dan item antrean, jadi permintaan yang sampai tetapi jawabannya hilang tidak berujung data ganda. Overlay (tampilan lokal) **diturunkan dari antrean** (tersimpan di basis data terenkripsi): selamat dari proses dimatikan, hilang sendiri saat item terkirim/dibuang. Setelah sukses, tampilan ditahan 5 dtk (`pascaStore`) agar tidak berkedip sebelum data segar dimuat; layar memuat ulang senyap lewat `useSetelahSinkron`.

## Tugas & komentar

- **Diantre** (jenis `tugas.*`, `urutanKunci tugas:<id>`): buat tugas (`POST tugas`, id sementara `tmp_<ulid>`, plus checklist awal `POST …/checklist`), pindah status (`PATCH …/status`, juga "Pindahkan" papan, tandai selesai, tunda tenggat, buka kembali), ubah isian (`PATCH tugas/{id}`: judul, prioritas, tenggat, tanggal mulai, penanggung jawab, label, deskripsi, estimasi), komentar baru (`POST …/komentar`).
- **Penggabungan**: ubah isian berturutan = **satu PATCH menunggu** (nilai terakhir menang; nilai dasar field pertama dipertahankan). Pada tugas sementara yang `POST`-nya belum dikirim, ubahan dan pindah status **dilipat ke permintaan pembuatan** (satu `POST` saja: hasil uji "buat → pindah status → ubah → komentar" = 1 create + 1 komentar di server). Bila `POST` sedang terkirim, ubahan menyusul sebagai PATCH di belakangnya (`urutanKunci` sama).
- **Id sementara**: dipakai di UI (Tugas saya, papan, list, detail `/tugas/tmp_…`; kunci tampil "ML-…", tanpa nomor palsu). Setelah `POST` sukses, item di belakangnya ditulis ulang (`tulisUlangMenunggu`: path + `meta.tugasId`) dan baru **sesudahnya** peta `tmp→asli` dicatat (memori + tabel `meta` `idtugas:<tmp>`); layar detail berpindah ke id asli otomatis. Item baru sesudah itu tetap memakai `urutanKunci` `tugas:<tmp>` selama item lama masih menunggu (`kunciUrutan`) agar urutan tidak terbalik. Id sementara yang tak ditemukan petanya → konflik 404 yang jelas (tidak pernah kirim).
- **Deteksi bentrok** (server tugas **tidak** punya prasyarat versi/`updated_at`): sebelum PATCH/`status` dikirim, klien `GET tugas/{id}` (tanpa cache) dan membandingkan field yang Anda ubah dengan **nilai dasar** saat diubah: berubah di server dan ≠ nilai Anda → `409 berubah_di_server`, item `konflik` dengan pesan ("ML-4: prioritas sudah diubah orang lain…"). Field yang tidak Anda ubah tak pernah tertimpa (PATCH parsial). **"Coba lagi" = sengaja menimpa** (kunci idempotensi baru dikenali sebagai tanda), **"Hapus"** membuang. 404 (tugas dihapus) / 403 (lihat saja) / 422 → konflik dengan pesan server. Overlay menandai tugas "Gagal sinkron"; detail menampilkan banner dengan **Buang perubahan HP** / **Kirim ulang**; **"Ubah"** di Antrean membuka detail tugas. Membuang item pembuatan membuang semua item di belakangnya.
- **Online-saja** (pesan "Butuh koneksi — … tidak bisa dilakukan saat offline", tidak ada permintaan gagal): hapus tugas, checklist (centang/tambah/ubah/hapus/urut), lampiran, sunting/hapus komentar, reaksi, amati, rencana hari ("Rencanakan"), tampilan tersimpan. Pada tugas sementara juga: sub-tugas, watch, rencana. Banner offline di detail menjelaskan mana yang bisa. Daftar workspace + kolom/label/anggota Pribadi **dipanaskan** (`hangatkanFormTugas`) agar form "Tugas baru" jalan offline; workspace lain bergantung pada cache baca yang sudah ada.
- **Belum**: kalender workspace tidak memakai overlay; ringkasan angka ("9 aktif · 1 terlambat") memakai data server; pemilih @mention/#rujukan butuh server (komentar tetap bisa ditulis sebagai teks).

## Catatan

- **Diantre** (`catatan.*`, `urutanKunci catatan:<id>`): isi (`PATCH catatan/{id} {body_html, updated_at}`), judul (`PATCH {title}`), catatan baru (`POST catatan`, id sementara) dan **Notulensi cepat** (`POST catatan/notulensi {polos:true}` dengan templat polos lokal identik server). Isi berturutan = satu PATCH (teks terakhir menang, `updated_at` dasar pertama dipertahankan); judul catatan baru dilipat ke `POST`-nya; setelah item berhasil, `updated_at` baru ditulis ke item isi di belakangnya (judul/isi memajukan versi). Setelah `POST` sukses, isi menyusul sebagai PATCH dengan `updated_at` dari respons pembuatan.
- **Editor tetap berfungsi penuh offline** (`SesiSimpan`): simpanan gagal-jaringan tidak lagi "Belum tersimpan" melainkan masuk antrean — ikon ponsel+centang, chip "Tersimpan di HP · menunggu sinkron", status di sheet; **teks antrean menang atas salinan server/cache** saat catatan dibuka (juga setelah aplikasi dimatikan). Catatan baru muncul di pohon dengan chip; editor id sementara berpindah ke id asli setelah terkirim.
- **Konflik**: `409` (catatan berubah di server) → status konflik di editor + Antrean dengan pesan server (catatan kecil menjelaskan tombol): **"Coba lagi"** menimpa dengan teks HP (versi terbaru diambil dulu), **"Ubah"** membuka catatan dengan **teks HP diambil alih editor** (item konflik dibuang, simpan ulang dengan versi baru), "Muat ulang" di dialog konflik memakai versi server dan membuang antrean catatan itu. `rich_note` → catatan baca-saja seperti biasa.
- **Online-saja**: riwayat versi, bagikan/akses, pindah, hapus, ganti nama dari daftar, tab/sub-tab, folder baru, kirim tautan; pada catatan baru yang belum terkirim menu aksi menunggu terkirim ("Butuh koneksi" / "tersedia setelah terkirim"). Catatan berformat lengkap tetap baca-saja.

## Laporan harian

- **Diantre** (`urutanKunci laporan:<tanggal>`): `laporan.draf` (`PUT laporan/hari-ini`, simpan otomatis; berturutan digabung jadi satu item, isian lengkap terbaru) dan `laporan.kirim` (`POST …/kirim`, antre di belakang draf terbaru dan **menggantikan** draf menunggu karena badan kirim memuat isian lengkap; `pindahkan ke …` diterapkan server saat kirim, tidak berubah). Edit sesudah kirim diantre menjadi draf baru di belakangnya. Cadangan draf berkas lama (`drafLokal.ts`) dihapus: antrean terenkripsi menggantikannya.
- **UI**: chip "Tersimpan di HP · menunggu sinkron", lencana "Menunggu kirim", banner & satu baris catatan "Offline: terkirim otomatis saat online; laporan terkunci pukul 23.59.", tombol "Kirim (antre, terkirim saat online)". Form saat dibuka memakai isian dari antrean; salinan cache `laporan/hari-ini` dari hari lain **tidak** dipakai menulis (dibuka laporan kosong untuk hari ini). Setelah antrean tanggal itu kosong, metadata (status, waktu kirim) dimuat ulang tanpa menyentuh isian.
- **Terkunci 23.59**: item yang tiba sesudah tanggal berganti ditolak sebelum dikirim di perangkat (`bangunPermintaan`, tanggal kantor Asia/Jakarta) atau oleh server (`403 laporan_terkunci`) → `konflik` dengan pesan jelas "Laporan tanggal … sudah terkunci (batas pukul 23.59). Hubungi atasan atau HR…" + catatan merah di baris Antrean; hanya bisa **Hapus**. "Ubah" membuka form hari ini hanya bila tanggalnya hari ini; item bermasalah diambil alih form (isian dipulihkan dan dikirim ulang dengan kunci baru).

## Verifikasi (emulator 5574, `maya.lestari@demo.test`, server lokal 8001, Metro 8081)

Airplane on di emulator, lalu off dengan angka dicek lewat API:
- **Tugas**: buat tugas offline → ada di "Tugas saya"; kemudian pindah status + ubah prioritas + komentar offline → airplane off → server berisi tepat **1 tugas** (status & prioritas terlipat di POST) dan **1 komentar**, tanpa duplikat; aplikasi dimatikan paksa saat 1 tugas antre lalu dibuka online → terkirim tepat sekali. Tugas nyata: ubah prioritas + pindah status offline (2 item di Antrean, "Menunggu") → prioritas diubah via API di server → sinkron menghasilkan konflik "prioritas sudah diubah orang lain…" (item status tetap menunggu di belakang konflik); detail menampilkan banner "Perubahan gagal sinkron" + chip, "Buang perubahan HP" mengembalikan data server. Papan workspace: "Pindahkan" PLQ-36 offline → kartu pindah Backlog 4→3 / Todo 11→12, snackbar "Disimpan di HP", sinkron mengubah status di server.
- **Catatan**: edit isi catatan nyata offline → chip + ikon "Tersimpan di HP", "1 menunggu" di strip → airplane off → server berisi teks gabungan (satu PATCH); catatan baru dibuat offline (pohon + editor id sementara) dengan isi diketik offline → terkirim, judul & isi benar di server. Konflik: edit offline, catatan diubah via API, sinkron → dialog "Catatan berubah" + banner, "Muat ulang" menampilkan versi server.
- **Laporan**: draf offline ("Tersimpan di HP · menunggu sinkron", strip "1 menunggu") + "Kirim (antre)" → "Menunggu internet untuk mengirim" → online: laporan `submitted` dengan catatan benar (satu baris). Terkunci: draf diantre offline, jam emulator dimajukan ke 14 Okt → sinkron → konflik "Laporan tanggal Selasa, 13 Okt 2026 sudah terkunci (batas pukul 23.59). Hubungi atasan atau HR…" (jalur pemeriksaan perangkat; 403 server tidak dipanggil). Jam emulator dikembalikan.
Data uji (tugas ML-4/ML-5, 2 catatan) dihapus; laporan hari ini (13 Okt) milik maya tetap ada (tak ada API hapus). Kematian paksa & pemulihan, serta pembatasan "Butuh koneksi", diuji manual; TalkBack **tidak** diuji (label aksesibilitas ditambahkan pada chip & kartu).

## Risiko / belum

- 403 `laporan_terkunci` **dari server** (jam HP salah) tidak diuji live (pesan server + catatan Antrean hanya jalur kode). Pemeriksaan bentrok tugas memakai satu GET tambahan per tugas.
- Catatan yang diubah orang lain tanpa konflik 409 (mis. mereka menyunting lewat web setelah dasar, sebelum sinkron) tertangkap server (`updated_at` usang → 409), bukan klien.
- Celah sempit: proses mati tepat sesudah `POST` tugas/catatan sukses dan sebelum item di belakangnya ditulis ulang → item itu 404 "belum dibuat" (konflik aman, tidak pernah kirim ke id salah).
- Notulensi cepat offline tidak membawa `preset` templat web (sama dengan mode polos online); `CatatanDetail.penulis` kosong sampai sinkron.

---

# Sinkron latar belakang (15 Okt 2026)

Kode: `apps/mobile/src/offline/{latar,latarKerja,latarMeta}.ts`, `src/session/tokenTersimpan.ts`; perubahan kecil di `antrean.ts`, `jaringan.ts`, `api/client.ts`, `sesi.ts`, `index.ts`, `LayarPenyimpananOffline.tsx`. Paket `expo-background-task` + `expo-task-manager` (config plugin `expo-background-task` di `app.json` hanya mengubah Info.plist iOS; Android tidak menambah izin/manifest).

## Cara kerja

- **Pendaftaran.** `TaskManager.defineTask('ruangkerja-sinkron-antrean', …)` ada di `latar.ts`, diimpor dari `apps/mobile/index.ts` **sebelum** `expo-router/entry` — wajib di scope modul karena saat sistem menghidupkan aplikasi headless (proses sudah dimatikan) tidak ada komponen yang dirender. Isi task dimuat malas (`import('./latarKerja')`) agar buka dingin biasa tidak memuat mesin antrean lebih awal. `mulaiSesiOffline` mendaftarkan task (`registerTaskAsync`, `minimumInterval: 15` menit, idempoten, dilewati di Expo Go); `akhiriSesiOffline` (keluar, akun nonaktif, 401) membatalkannya. Daftar/batal diserialisasi.
- **Penjadwalan Android.** WorkManager (`OneTimeWorkRequest` berantai dengan `initialDelay` 15 menit, syarat `NetworkType.CONNECTED`; Android < 8 memakai periodik). Interval hanya **minimum**; sistem menggabungkan/menunda (Doze, App Standby bucket, penghemat baterai, vendor agresif seperti MIUI/ColorOS) — **bisa tertunda berjam-jam dan tidak ada jaminan waktu**. Expo hanya menjalankan task bila aplikasi tidak di latar depan. Setelah satu putaran selesai, jadwal berikutnya dibuat otomatis.
- **Isi task (`jalankanSinkronLatar`, anggaran 25 dtk, pengaman keras 28 dtk → `Failed`).** Pemeriksaan murah → mahal, berhenti di langkah pertama yang gagal dengan hasil `Success` (tanpa menyentuh jaringan sampai langkah 4):
  1. sesi tersimpan (`SecureStore` `rk.sesi`, dibaca tanpa React lewat `session/tokenTersimpan.ts`) — tanpa sesi → keluar;
  2. penanda "server menolak sesi" (`meta.latar_ditolak:<uid>`) tidak ada;
  3. ada item `menunggu` yang bisa dikirim (satu query SQL: item yang tidak tertahan `konflik`/`gagal` lebih awal pada `urutan_kunci` sama) — tidak ada → keluar;
  4. jaringan (`segarkanJaringan()`: baca keadaan OS + probe bila perlu).
  Lalu `sinkronkanLatar(uid, sisaWaktu)` di `antrean.ts`: memuat antrean (`mulaiAntrean`), mengabaikan masa backoff, dan memakai **mesin kirim yang sama** (FIFO per `urutanKunci`, `Idempotency-Key`, penangan fitur `penanganFitur.ts`, maks. 2 paralel). Selama jendela latar, item dikirim dengan batas waktu 20 dtk per permintaan dan **tidak ada item baru dimulai setelah anggaran habis**; yang masih berjalan boleh selesai/diulang kemudian (kunci idempotensi sama → server memutar ulang, tidak ganda). Waktu putaran terakhir + jumlah terkirim disimpan di `meta.latar_terakhir:<uid>`.
- **Kunci/instance ganda.** Mesin adalah singleton per proses JS dan satu mutex DB (`denganDb`), jadi latar depan dan latar belakang di proses yang sama tidak pernah mengirim bersamaan (`sedangJalan`, `latarJalan`). Bila proses hidup di latar, task memakai antrean di memori yang sama; bila proses mati, task membuka DB sendiri (kunci SQLCipher dari Keystore — jalur ini tidak butuh React). Proses ketiga tidak ada (WorkManager menjalankan di proses aplikasi); seandainya dua runtime berbagi berkas DB, WAL + kunci idempotensi menjaga tidak ada data ganda.
- **Token.** Bila ada getter sesi React (proses hidup), itu dipakai. Bila tidak (headless), token dari SecureStore dipasang sebagai `setTokenSementara` di `api/client.ts` selama task (getter sesi React selalu didahulukan, tidak pernah ditimpa) lalu dicabut.
- **401 / blokir akun / versi lama dari latar belakang.** Permintaan latar memakai `senyap: true` (penangan 401/403-blokir/426/503 di `client.ts` tidak dipanggil → sesi **tidak dihapus** dan tidak ada dialog dari proses tanpa layar). Mesin berhenti, item tetap `menunggu` (tidak jadi `konflik`, tidak dihitung percobaan), dan untuk 401 ditulis `meta.latar_ditolak:<uid>` sehingga task berikutnya melewati. Saat aplikasi dibuka, `mulaiSesiOffline` menghapus penanda, validasi sesi (`GET /auth/saya`) menangani 401 seperti biasa (dialog "Sesi berakhir"/keluar) lalu antrean dikirim normal. 5xx/429/jaringan: backoff seperti biasa, dicoba lagi pada putaran berikutnya.
- **Pengaturan › Penyimpanan offline**: baris "Sinkron latar belakang" — "Aktif · terakhir HH.mm" / "Aktif · belum pernah berjalan" / "Tidak tersedia" (Expo Go, dibatasi sistem, belum terdaftar) + catatan bahwa waktunya diatur sistem.

## Batasan yang harus dipahami (jangan dijanjikan ke pengguna)

- Tidak ada jaminan waktu: bisa 15 menit, bisa berjam-jam; perangkat yang mati/Doze dalam/baterai sangat rendah/"force stop" tidak menjalankannya. **Force stop** (Pengaturan › Hentikan paksa) membatalkan semua job aplikasi sampai aplikasi dibuka lagi.
- Batas 25 dtk per putaran → antrean besar (selfie 5 MB, banyak item) dikirim bertahap lintas putaran.
- Absen offline tetap dibatasi **72 jam** (`kedaluwarsaJam`): sinkron latar membantu mengirimnya sebelum hangus, tetapi kalau perangkat tak pernah mendapat jendela, item tetap jadi `konflik` "kedaluwarsa".
- Snackbar hasil sinkron hanya muncul bila aplikasi aktif; sinkron latar berjalan senyap (tanpa notifikasi). Pengguna melihat hasilnya di strip status/antrean saat membuka aplikasi.
- Peta id sementara → id asli (tugas/catatan) sudah disimpan di `meta`, jadi item yang bergantung tetap benar walau item induk terkirim dari latar belakang; status memori-saja (mis. `catatTersinkron` absen) hilang bersama prosesnya, layar memuat ulang dari server saat dibuka.

## Cara menguji di emulator/perangkat (build rilis atau debug, bukan Expo Go)

```bash
D=emulator-xxxx
PKG=store.spkd.ruangkerja
# 1. Buat antrean: airplane on → lakukan perubahan (mis. komentar/absen) → airplane OFF tetapi JANGAN buka aplikasi:
adb -s $D shell cmd connectivity airplane-mode enable
#   ...lakukan aksi di aplikasi → antrean berisi item → tekan Home...
adb -s $D shell cmd connectivity airplane-mode disable
# 2. Pastikan job terdaftar dan catat jobId (WorkManager = SystemJobService):
adb -s $D shell dumpsys jobscheduler | grep -B3 -A14 "$PKG"      # cari "androidx.work.impl.background.systemjob.SystemJobService", angka setelah "JOB #<uid>/<jobId>"
# 3. Matikan proses (BUKAN force-stop — itu membatalkan job): swipe aplikasi dari Recents, atau
adb -s $D shell am kill $PKG                                      # hanya bila proses di latar
adb -s $D shell pidof $PKG                                        # harus kosong
# 4. Paksa job jalan sekarang (abaikan delay 15 menit & constraint):
adb -s $D shell cmd jobscheduler run -f $PKG <jobId>
# 5. Amati:
adb -s $D logcat -s BackgroundTaskWork:V BackgroundTaskScheduler:V ReactNativeJS:V | head -60
```

Yang diverifikasi: `doWork: Running worker` muncul; server menerima item (tepat satu per kunci); buka aplikasi → antrean kosong dan "Sinkron latar belakang · terakhir HH.mm" terisi. Skenario tambahan: (a) tanpa item → log menunjukkan task selesai cepat tanpa permintaan jaringan (cek `adb logcat`/Mailpit/log server tidak ada request); (b) proses hidup di latar (Home, jangan matikan) lalu `run -f`; (c) token dibuat kedaluwarsa di server → item tetap `menunggu`, sesi tidak hilang, setelah aplikasi dibuka muncul dialog "Sesi berakhir"; (d) keluar akun → `dumpsys jobscheduler` tidak lagi memuat job paket; (e) masuk lagi → job muncul kembali. Di build **debug**, `BackgroundTask.triggerTaskWorkerForTestingAsync()` bisa memicu worker dari kode (hanya `__DEV__`).

