# Absensi ke grup WhatsApp manajemen (Evolution API)

> **Status:** **Nyata** (keputusan pemilik 8 Okt 2026, membuka hold "notifikasi WhatsApp"). Alur: karyawan mengisi **rencana kerja hari ini** sebelum check-in → setelah check-in sukses, sistem otomatis mengirim ringkasan ke **grup WhatsApp manajemen** lewat gateway self-hosted Evolution API. Mati secara default (`NOTIFICATIONS_WHATSAPP_ENABLED=false`) sampai gateway dipasang.
> **Penelusuran keputusan provider:** riset perbandingan TWA/Evolution/Baileys/Cloud API (Cloud API resmi dibatasi 8 peserta/grup → tidak layak) — pembahasan sesi GLM 8 Okt 2026; singgung `docs/sesi/glm.md` bila perlu.

## 1. Alur

1. Karyawan membuka layar Absen (ponsel/tab), mengambil selfie.
2. Di langkah tinjau (`SelfieReview`), **"Rencana kerja hari ini" wajib diisi** (maks 2.000 karakter) — teks biasa, boleh bernomor "1) … 2) …".
3. Check-in terkirim (`work_plan` ikut); tersimpan di `attendance_days.work_plan`.
4. Job antrean `SendCheckInWhatsApp` mengirim pesan ke **grup perusahaan karyawan** (`companies.settings.whatsapp.group_jid`, lihat §3a) lewat Evolution API:

   ```
   🟢 *Rizky Aditya* absen masuk
   🕒 07.52 WIB · Tepat waktu
   📋 Rencana kerja:
   1) Selesaikan laporan mingguan
   2) Meeting klien 14.00
   ```

5. Kegagalan gateway **tidak pernah menggangu absensi**: job dicoba ulang (5×, backoff 60 dtk–30 mnt), lalu dicatat `Log::warning` dan berhenti. Rekaman absensi tetap satu-satunya sumber kebenaran.

Catatan jalur lain: absen lewat **QR/kiosk** tidak melewati form rencana — pesan grup menulis *"tidak diisi — absen lewat QR/kiosk"*.

> Bagian 1 di atas adalah bentuk awal (8 Okt). Format terkini (foto bercap, absen pulang, laporan kerja — keputusan pemilik 13 Okt 2026) ada di **§1b**.

## 1b. Foto bercap + laporan kerja (13 Okt 2026)

Absen **masuk dan pulang** kini mengirim **foto selfie yang diberi cap** ke grup, dengan teks di keterangan foto (caption). Pagi disebut **Rencana Kerja**, sore (absen pulang) **Laporan Kerja** (`attendance_days.work_report`, jsonb `list<string>`, diisi saat check-out).

**Cap pada foto** (`App\Domain\Attendance\Services\StampedSelfie`, GD + FreeType, dikomposisi **di memori** — gambar bercap tidak pernah ditulis ke disk, selfie asli di disk privat tidak diubah): pita gradien gelap di bawah foto berisi jam besar (mis. `17:38`, zona kantor), hari + tanggal Indonesia (`Selasa` / `06 Oktober 2026`), nama tempat, dan **peta mini** (ubin OpenStreetMap zoom 16, pin merah, tulisan "© OpenStreetMap"). Lebar maks. 1080 px, JPEG kualitas 82, orientasi EXIF dihormati. Font: DejaVu Sans Bold (`resources/fonts/`, lisensi Bitstream Vera, permisif).

Nama tempat: nama geofence kantor → `WFH` → selain itu reverse-geocode Nominatim (kelurahan/lingkungan/kecamatan, cache 24 jam per koordinat dibulatkan 3 desimal, ≥ 1 detik antar permintaan, timeout 4 dtk) → bila gagal, teks lokasi deskriptif yang sama dengan baris `Lokasi:`. Kegagalan ubin/Nominatim **tidak pernah** menggagalkan pengiriman: foto tetap keluar tanpa peta / dengan teks tempat saja.

**Keterangan foto (caption):**

```
🟢 ABSEN MASUK
Nama: Rizky Aditya
Tanggal: Selasa, 06 Oktober 2026
Jam: 07.52
Lokasi: Kantor Pusat

📝 Rencana Kerja:
1. Selesaikan laporan mingguan
2. Meeting klien 14.00
```

```
🔴 ABSEN PULANG
Nama: Rizky Aditya
Tanggal: Selasa, 06 Oktober 2026
Jam: 17.38
Lokasi: Kantor Pusat

📝 Laporan Kerja:
1. Laporan mingguan selesai
2. Meeting klien beres

Durasi kerja: 9 jam 46 menit
```

- **Absen offline** (aplikasi ponsel, 14 Okt 2026; `docs/sesi/ponsel-b7-offline.md`): setelah baris `Lokasi:` ditambah `⚠️ Absen offline — tersinkron 09.40` (jam kantor saat server menerima log, `attendance_logs.received_at`); `Jam:` dan cap foto tetap jam perangkat saat tombol ditekan.
- Tanpa selfie (QR/kiosk) **atau** pembuatan cap gagal total → pesan teks biasa dengan isi yang sama (`sendText`). Laporan kosong → `_(tidak diisi — absen lewat QR/kiosk)_`.
- Caption WhatsApp dipotong ±1024 karakter: bila teks > 900 karakter, foto membawa baris judul (+ durasi) dan **poin menyusul sebagai pesan teks kedua lewat job terpisah** (`part = points`), sehingga percobaan ulang tidak pernah memposting foto dua kali.
- Gateway: Evolution API v2 `POST /message/sendMedia/{instance}` (`mediatype: image`, `mimetype: image/jpeg`, `media` base64, `fileName`, `caption`, `number`, `delay`). Foto **tanpa** retry otomatis di klien HTTP (retry hanya lewat antrean).

**Privasi (disadari pemilik):** dengan fitur ini **selfie keluar dari sistem ke grup WhatsApp** (salinan di server WhatsApp & ponsel anggota grup, di luar kebijakan retensi selfie 12 bulan) dan **koordinat dikirim ke OpenStreetMap** (ubin peta + Nominatim) saat pengiriman. Matikan peta/permintaan OSM dengan `ATTENDANCE_STAMP_MAP=false` (cap tetap berisi jam, tanggal, tempat dari nama kantor/WFH/teks deskriptif). Kebijakan privasi **v2.0 (14 Okt 2026)** dan layar persetujuan (web + ponsel) kini menyebut tujuan ini: selfie bercap + lokasi ke grup, di luar kendali aplikasi, di luar retensi 12 bulan, serta koordinat ke Nominatim dari server (`resources/markdown/privacy-policy.md` bagian 5–6).

## 2. Komponen

| Lapisan | Berkas | Peran |
|---|---|---|
| Migrasi | `database/migrations/2026_10_15_100000_add_work_plan_to_attendance_days.php` | kolom `work_plan` text null (bisa di-rollback) |
| Data | `app/Domain/Attendance/Data/CheckInData.php` (+`CheckInRequest`) | `work_plan` nullable, maks 2.000, pesan Indonesia |
| Action | `app/Domain/Attendance/Actions/CheckIn.php` | simpan trim ke hari; dispatch job setelah sukses |
| Service | `app/Domain/Notifications/Services/EvolutionWhatsApp.php` | klien REST Evolution (`POST /message/sendText/{instance}`, header `apikey`, `delay` 800 ms); `enabled()` = URL+key+flag |
| Service | `app/Domain/Attendance/Services/StampedSelfie.php` | cap foto (§1b); `EvolutionWhatsApp::sendImage()` = `sendMedia` |
| Job | `app/Domain/Notifications/Jobs/SendAttendanceWhatsApp.php` (masuk + pulang) | antrean, 5 percobaan, backoff `[60,300,900,1800]`, `failed()` = log warning |
| UI | `flow/selfie-review.tsx` + `use-check-flow.ts` | daftar poin bernomor + tombol + (wajib, check-in saja), dipakai shell ponsel & desktop |
| Presenter | `AttendancePresenter::day()` | `workPlan` ikut payload detail (HR/manajemen) |

## 3. Konfigurasi

| Env | Isi |
|---|---|
| `NOTIFICATIONS_WHATSAPP_ENABLED` | `true` untuk menyalakan (juga mengaktifkan kanal `whatsapp` di preferensi notifikasi) |
| `EVOLUTION_URL` | dev `http://localhost:8082`; produksi `http://evolution:8080` (jaringan internal Docker) |
| `EVOLUTION_API_KEY` | API key global gateway (rahasia; diisi `AUTHENTICATION_API_KEY` kontainer) |
| `EVOLUTION_INSTANCE` | nama instance gateway (default `ruangkerja`) |
| `WHATSAPP_GROUP_JID` | jid grup `…@g.us` — **cadangan** satu perusahaan saja; grup per perusahaan ada di `companies.settings` (§3a) |
| `ATTENDANCE_STAMP_MAP` | `true` (bawaan) = peta mini + reverse-geocode OSM pada cap foto; `false` = tanpa peta & tanpa permintaan ke OpenStreetMap |
| `OSM_USER_AGENT` | User-Agent deskriptif untuk OSM (bawaan `RuangKerja/1.0 (+https://spkd.store)`; kebijakan OSM mewajibkannya); opsional `OSM_TILE_URL`, `OSM_NOMINATIM_URL` |

### 3a. Grup per perusahaan (Fase 1 multi-perusahaan, 18 Okt 2026)

- Grup tujuan disimpan **per perusahaan** di `companies.settings` (`whatsapp.group_jid`, opsional `whatsapp.enabled = false` untuk mematikan salinan perusahaan itu), dibaca lewat `App\Domain\Tenancy\Settings\CompanySettings`. `CheckIn`/`CheckOut`/`SendAttendanceWhatsApp` memakai `EvolutionWhatsApp::attendanceGroupFor($companyId)`: absen karyawan perusahaan B **tidak pernah** masuk grup perusahaan A (celah C9, `docs/sesi/fase1-celah.md`).
- Perusahaan **tanpa grup** tidak dikirimi apa pun (tanpa galat; log info `whatsapp.attendance skipped: company has no group`).
- `WHATSAPP_GROUP_JID` (env) hanya **cadangan** selama perusahaan itu satu-satunya di basis data (instalasi lama tetap jalan). Migrasi `2026_10_23_235100_copy_integration_settings_to_first_company` menyalin nilainya ke perusahaan pertama (SPKD); begitu ada perusahaan kedua, env tidak dipakai lagi.
- Kredensial gateway (`EVOLUTION_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`) dan `NOTIFICATIONS_WHATSAPP_ENABLED` tetap **global** (satu gateway, satu nomor, banyak grup). Gateway/nomor per perusahaan = Fase 3.
- Mengatur (UI pengaturan = Fase 3): `php artisan company:configure <id|domain|nama> --whatsapp-group=1203…@g.us` · matikan: `--whatsapp=off` · hapus grup: `--whatsapp-group=""`. Lihat yang berlaku: `php artisan company:list`. Setiap perubahan tercatat di audit log (`company.configured`).

Pengaturan lain di `config/attendance.php` › `stamp` (zoom 16, lebar maks. 1080, kualitas JPEG 82, cache 24 jam, jeda Nominatim 1 dtk).

`phpunit.xml` mengosongkan semua kunci ini agar test tidak pernah bergantung `.env` lokal.

## 4. Pemasangan gateway

**Lokal (macOS):** `docker compose --profile whatsapp up -d evolution` (sekali: `docker compose exec postgres createdb -U ruangkerja evolution`) → buka `http://localhost:8082/manager`, buat instance `ruangkerja`, pindai QR dengan **nomor gateway khusus** (bukan nomor pribadi), ambil API key dari pengaturan instance → isi `.env` + `php artisan config:cache` (Herd otomatis).

**Produksi (spkd.store):** lihat `docs/deploy/WHATSAPP.md` (kontainer profil `whatsapp`, pairing lewat tunnel SSH tanpa expose publik, `createdb evolution`, env internal).

## 5. Risiko & batasan (disadari pemilik)

- Gateway memakai protokol WhatsApp Web **tak resmi** → melanggar ToS WhatsApp; nomor gateway bisa diblokir. Mitigasi: nomor khusus, volume rendah (pesan hanya saat check-in), `delay` 800 ms, gagal = diam.
- Grup adalah **salinan** untuk manajemen, bukan rekaman resmi; data pribadi dalam rencana kerja sebaiknya dijaga karyawan sendiri (form memberi hint tujuan pengiriman).
- Bila nanti kanal `whatsapp` dipakai notifikasi per-orang (F2-4 otomasi), pesan **tidak pernah** berisi data sensitif (NIK, selfie, koordinat presisi); alur itu tetap menunggu keputusan pemilik.

## 6. Test

- Pest `tests/Feature/Attendance/CheckInWorkPlanTest.php`: poin tersimpan di hari (jsonb); baris kosong dibuang; opsional di API (QR/kiosk); >8 poin atau poin >300 karakter ditolak.
- Pest `tests/Feature/Notifications/StampedSelfieTest.php`: JPEG valid dengan ubin + geocode palsu; tanpa peta saat ubin/Nominatim gagal; skala ke 1080 px tanpa mengubah selfie asli; cache tempat; kantor/WFH tanpa geocoder; peta dimatikan = tanpa permintaan OSM; tanpa selfie/berkas rusak = null.
- Pest `tests/Feature/Notifications/AttendanceWhatsAppTest.php` (diperbarui 13 Okt: payload `sendMedia`, caption Rencana/Laporan Kerja, teks polos tanpa selfie, caption panjang dipecah, 500 → lempar): dispatch masuk & pulang saat kanal nyala; tidak saat mati; payload Evolution benar (URL/instance/apikey/jid/format pesan/tanggal Indonesia/lokasi deskriptif/durasi); 500 → lempar untuk dicoba ulang.
- Pest `tests/Feature/Tenancy/CompanyIntegrationsTest.php` + `BackgroundLeakTest` (C9): cadangan env hanya untuk satu-satunya perusahaan, grup per perusahaan, perusahaan tanpa grup dilewati, `company:configure`/`company:list`, migrasi data.
- Vitest `use-check-flow.test.ts`: rencana kosong memblokir kirim check-in; terisi → ikut `FormData`.

## 7. Yang menyusul (belum)

- UI Pengaturan untuk HR (cek koneksi gateway, pilih grup dari daftar, tombol uji kirim) — sementara lewat `php artisan company:configure` (Fase 3).
- Pilihan grup per divisi; gateway/nomor per perusahaan (Fase 3). Grup & opt-out per perusahaan sudah ada (§3a).
- Kanal `whatsapp` untuk notifikasi personal (menunggu F2-4).
