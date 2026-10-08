# Absensi ke grup WhatsApp manajemen (Evolution API)

> **Status:** **Nyata** (keputusan pemilik 8 Okt 2026, membuka hold "notifikasi WhatsApp"). Alur: karyawan mengisi **rencana kerja hari ini** sebelum check-in → setelah check-in sukses, sistem otomatis mengirim ringkasan ke **grup WhatsApp manajemen** lewat gateway self-hosted Evolution API. Mati secara default (`NOTIFICATIONS_WHATSAPP_ENABLED=false`) sampai gateway dipasang.
> **Penelusuran keputusan provider:** riset perbandingan TWA/Evolution/Baileys/Cloud API (Cloud API resmi dibatasi 8 peserta/grup → tidak layak) — pembahasan sesi GLM 8 Okt 2026; singgung `docs/sesi/glm.md` bila perlu.

## 1. Alur

1. Karyawan membuka layar Absen (ponsel/tab), mengambil selfie.
2. Di langkah tinjau (`SelfieReview`), **"Rencana kerja hari ini" wajib diisi** (maks 2.000 karakter) — teks biasa, boleh bernomor "1) … 2) …".
3. Check-in terkirim (`work_plan` ikut); tersimpan di `attendance_days.work_plan`.
4. Job antrean `SendCheckInWhatsApp` mengirim pesan ke grup (jid `WHATSAPP_GROUP_JID`) lewat Evolution API:

   ```
   🟢 *Rizky Aditya* absen masuk
   🕒 07.52 WIB · Tepat waktu
   📋 Rencana kerja:
   1) Selesaikan laporan mingguan
   2) Meeting klien 14.00
   ```

5. Kegagalan gateway **tidak pernah menggangu absensi**: job dicoba ulang (5×, backoff 60 dtk–30 mnt), lalu dicatat `Log::warning` dan berhenti. Rekaman absensi tetap satu-satunya sumber kebenaran.

Catatan jalur lain: absen lewat **QR/kiosk** tidak melewati form rencana — pesan grup menulis *"tidak diisi — absen lewat QR/kiosk"*. Check-out tidak mengirim apa pun.

## 2. Komponen

| Lapisan | Berkas | Peran |
|---|---|---|
| Migrasi | `database/migrations/2026_10_15_100000_add_work_plan_to_attendance_days.php` | kolom `work_plan` text null (bisa di-rollback) |
| Data | `app/Domain/Attendance/Data/CheckInData.php` (+`CheckInRequest`) | `work_plan` nullable, maks 2.000, pesan Indonesia |
| Action | `app/Domain/Attendance/Actions/CheckIn.php` | simpan trim ke hari; dispatch job setelah sukses |
| Service | `app/Domain/Notifications/Services/EvolutionWhatsApp.php` | klien REST Evolution (`POST /message/sendText/{instance}`, header `apikey`, `delay` 800 ms); `enabled()` = URL+key+flag |
| Job | `app/Domain/Notifications/Jobs/SendCheckInWhatsApp.php` | antrean, 5 percobaan, backoff `[60,300,900,1800]`, `failed()` = log warning |
| UI | `resources/js/features/attendance/flow/selfie-review.tsx` + `use-check-flow.ts` | textarea wajib (check-in saja), dipakai shell ponsel & desktop |
| Presenter | `AttendancePresenter::day()` | `workPlan` ikut payload detail (HR/manajemen) |

## 3. Konfigurasi

| Env | Isi |
|---|---|
| `NOTIFICATIONS_WHATSAPP_ENABLED` | `true` untuk menyalakan (juga mengaktifkan kanal `whatsapp` di preferensi notifikasi) |
| `EVOLUTION_URL` | dev `http://localhost:8082`; produksi `http://evolution:8080` (jaringan internal Docker) |
| `EVOLUTION_API_KEY` | API key global gateway (rahasia; diisi `AUTHENTICATION_API_KEY` kontainer) |
| `EVOLUTION_INSTANCE` | nama instance gateway (default `ruangkerja`) |
| `WHATSAPP_GROUP_JID` | jid grup tujuan `…@g.us` |

`phpunit.xml` mengosongkan semua kunci ini agar test tidak pernah bergantung `.env` lokal.

## 4. Pemasangan gateway

**Lokal (macOS):** `docker compose --profile whatsapp up -d evolution` (sekali: `docker compose exec postgres createdb -U ruangkerja evolution`) → buka `http://localhost:8082/manager`, buat instance `ruangkerja`, pindai QR dengan **nomor gateway khusus** (bukan nomor pribadi), ambil API key dari pengaturan instance → isi `.env` + `php artisan config:cache` (Herd otomatis).

**Produksi (spkd.store):** lihat `docs/deploy/WHATSAPP.md` (kontainer profil `whatsapp`, pairing lewat tunnel SSH tanpa expose publik, `createdb evolution`, env internal).

## 5. Risiko & batasan (disadari pemilik)

- Gateway memakai protokol WhatsApp Web **tak resmi** → melanggar ToS WhatsApp; nomor gateway bisa diblokir. Mitigasi: nomor khusus, volume rendah (pesan hanya saat check-in), `delay` 800 ms, gagal = diam.
- Grup adalah **salinan** untuk manajemen, bukan rekaman resmi; data pribadi dalam rencana kerja sebaiknya dijaga karyawan sendiri (form memberi hint tujuan pengiriman).
- Bila nanti kanal `whatsapp` dipakai notifikasi per-orang (F2-4 otomasi), pesan **tidak pernah** berisi data sensitif (NIK, selfie, koordinat presisi); alur itu tetap menunggu keputusan pemilik.

## 6. Test

- Pest `tests/Feature/Attendance/CheckInWorkPlanTest.php`: rencana tersimpan di hari; opsional di API (QR/kiosk); >2.000 karakter ditolak.
- Pest `tests/Feature/Notifications/CheckInWhatsAppTest.php`: dispatch saat kanal nyala; tidak saat mati; payload Evolution benar (URL/instance/apikey/jid/isi pesan); 500 → lempar untuk dicoba ulang; check-out tidak mengirim.
- Vitest `use-check-flow.test.ts`: rencana kosong memblokir kirim check-in; terisi → ikut `FormData`.

## 7. Yang menyusul (belum)

- UI Pengaturan untuk HR (cek koneksi gateway, pilih grup dari daftar, tombol uji kirim) — sementara lewat env.
- Opt-out per perusahaan/divisi & pilihan grup per divisi.
- Kanal `whatsapp` untuk notifikasi personal (menunggu F2-4).
