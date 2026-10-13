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

- Tidak ada pengiriman di latar belakang saat aplikasi tak aktif (tanpa `expo-background-task`): sinkron berjalan saat aplikasi di latar depan.
- Jalur 401 saat sesi berjalan (antrean dijeda → masuk ulang → lanjut) dikodekan tetapi belum diuji live.
- Cold start offline di build debug tak teruji (lihat catatan); jalur kode sama dengan kembali dari latar belakang.
- Bug yang ditemukan & diperbaiki saat uji: pemantauan jaringan sempat ikut dilepas saat keluar akun sehingga status "offline" basi membuat login gagal cepat → kini `PemantauJaringan` seumur aplikasi.
- Handler per fitur (absen, tugas, komentar, catatan, laporan, pengajuan) belum ada; `penanganFitur.ts` kosong.
- `orang` (direktori nama) masuk daftar cache agar pemilih penanggung jawab/mention bisa dipakai offline; keluarkan dari `IZIN_AWALAN` bila pemilik menilai ini data karyawan sensitif.
