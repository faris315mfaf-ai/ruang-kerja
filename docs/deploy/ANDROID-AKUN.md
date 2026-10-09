# Runbook: akun & tooling aplikasi Android (Tahap 0)

Panduan **Tahap 0 (M0)** bagi pemilik: semua akun, kunci, dan alat yang harus disiapkan sebelum aplikasi Android RuangKerja dibangun dan dirilis. Jalur yang dipilih pemilik (**keputusan 9 Okt 2026**): **Expo + EAS** (lihat `docs/PEMBAGIAN-TUGAS.md` baris 18; rencana lengkap di [`docs/fitur/aplikasi-ponsel-rencana.md`](../fitur/aplikasi-ponsel-rencana.md) — checklist prasyarat di §4, urutan kerja di §9).

> **Aturan rahasia:** berkas ini sengaja **tidak** memuat satu pun rahasia. Semua sandi, kunci, dan berkas unduhan (`.keystore`, `google-services.json`, JSON service account) disimpan di **password manager** dan lokasi aman lain — tidak pernah di-commit ke repo, tidak pernah ditempel di dokumen/chat. Detail isi `.env` server tidak dibahas di sini (lihat `docs/deploy/` lainnya).

## 0. Ringkasan biaya & waktu

| Hal | Biaya | Perkiraan waktu |
|---|---|---|
| Akun Google Play Console | **US$25 sekali** (tidak berulang) | daftar ±15 menit; verifikasi identitas umumnya 1–3 hari kerja, akun organisasi bisa lebih lama (D-U-N-S bisa mingguan) |
| Akun Expo + EAS | Gratis (plan gratis: kuota build terbatas; naik paket bila antrian build jadi hambatan) | ±10 menit |
| Proyek Firebase (FCM) | Gratis | ±20 menit |
| Keystore upload | Gratis (dibuat lewat EAS atau `keytool`) | ±15 menit |

Kerjakan berurutan §1 → §4; §5 adalah checklist centang akhir. Semua langkah bisa dikerjakan sebelum/menyertai backend M0 — hanya §1.5 (nama paket final) yang wajib diputuskan sebelum upload pertama.

## 1. Akun Google Play Console

1. Siapkan **satu akun Google khusus organisasi** (bukan email pribadi), mis. `android@spkd.store`. Aktifkan verifikasi 2 langkah — Play Console menuntutnya.
2. Buka https://play.google.com/console → **Daftar** (Sign up) → isi nama pengembang (mis. **SPKD**) → bayar biaya pendaftaran **US$25** (sekali seumur akun, kartu kredit/debit).
3. Selesaikan **verifikasi identitas**:
   - **Akun personal** → KTP/paspor + selfie; umumnya selesai 1–3 hari kerja.
   - **Akun organisasi** → butuh **nomor D-U-N-S** organisasi + dokumen pendukung; bisa lebih lama (pengurusan D-U-N-S baru bisa mingguan — mulai awal, lihat risiko di rencana §8).
   - Pemilik memilih jenis akun; untuk rilis internal karyawan (track tertutup), akun personal cukup, tetapi akun organisasi lebih pas untuk aplikasi kantor.
4. Setelah akun aktif: **Buat aplikasi** → nama **"RuangKerja"**, default language **Indonesia**, pilih *Application/Game: Application* dan *Free/Paid: Free*.
5. Tentukan **nama paket** (application ID): usulan dan default proyek ini adalah **`store.spkd.ruangkerja`**.
   - **Sekali dipakai di upload pertama, tidak bisa diubah selamanya** (ganti = aplikasi baru). Putuskan final sebelum langkah §3.3 dan upload pertama (rencana §10 butir 2).
   - Nama paket ini juga yang didaftarkan di Firebase (§3.3) dan yang mengikat `assetlinks.json` (rencana M0 backend B6).

## 2. Akun Expo + EAS CLI

1. Buat **akun Expo** di https://expo.dev/signup (email organisasi yang sama, sandi kuat + 2FA) — akun ini yang memegang build EAS, jangan akun pribadi per developer.
2. Di mesin kerja (pemilik/developer), pasang EAS CLI:

   ```bash
   npm i -g eas-cli
   eas login          # masuk dengan akun Expo organisasi
   eas whoami         # pastikan akun benar
   ```

3. **Proyek EAS** dibuat nanti di Tahap 2, saat folder `apps/mobile` sudah ada di repo: `cd apps/mobile && eas init` (mengikat proyek ke akun dan menuliskan `extra.eas.projectId` di config aplikasi). Jangan `eas init` sebelum folder ada.
4. Konfigurasi build **`eas.json`** (profile `development` / `preview` / `production`) juga disusun di **Tahap 2** — bukan sekarang.
5. **Rahasia build** (API key, kredensial server) dimasukkan lewat `eas secret:set` — tidak pernah ditulis di `eas.json`/repo. Daftar secret: `eas secret:list`.

## 3. Proyek Firebase (push notification FCM)

1. Buka https://console.firebase.google.com → **Buat proyek** (mis. `ruangkerja`) — boleh tanpa Google Analytics.
2. **Aktifkan Cloud Messaging (FCM)**: di konsol pilih ikon ⚙️ → *Project settings* → *Cloud Messaging*; Firebase API v1 aktif otomatis untuk proyek baru.
3. **Daftarkan aplikasi Android**: *Project settings* → ikon Android → isi **nama paket Android = `store.spkd.ruangkerja`** (**harus persis sama** dengan §1.5; beda satu huruf = push gagal). Nickname: `RuangKerja Android`. SHA-256 debugging boleh dikosongkan dulu.
4. **Unduh `google-services.json`** dari halaman settings proyek:
   - Posisinya **nanti di `apps/mobile/`** (folder aplikasi, dibuat di Tahap 2) — berkas ini berisi identifier, bukan kunci rahasia server, tetapi tetap **jangan di-commit** sebelum keputusan tim; tambahkan ke `.gitignore` folder mobile bila dianggap sensitif, dan simpan salinannya di password manager/vault.
   - Jangan ganti nama paket di Firebase setelah aplikasi mendaftar — daftar ulang, bukan ubah.
5. **Service account untuk server-push (menyusul, saat backend mengirim FCM)**: *Project settings* → *Service accounts* → *Generate new private key* (peran bawaan Firebase Admin). Simpan berkas JSON **di server produksi** (mis. di luar folder aplikasi, dibaca lewat path env) — **tidak pernah** di repo. Ini dipakai kanal notifikasi FCM (rencana §5 B7).

## 4. Keystore (kunci tanda tangan aplikasi)

Aplikasi baru di Play Console otomatis memakai **Play App Signing**: Google memegang kunci *signing* produksi, pemilik hanya mengelola **upload key**. Dua cara membuat upload key — pilih **satu**:

**Cara A — EAS managed credentials (rekomendasi):**

1. Setelah `eas init` (Tahap 2), jalankan `eas credentials` → pilih profil `production` → **Create keystore**; EAS membuat, menyimpan di server Expo, dan memakainya saat `eas build`.
2. **Unduh cadangan** keystore dari `eas credentials` (pilih *Export/backup*) dan simpan di password manager/vault — cadangan melindungi bila akun Expo bermasalah.

**Cara B — manual dengan keytool (butuh JDK):**

1. Simpan berkas di **luar repo** (mis. `~/kunci/`), bukan di folder proyek:

   ```bash
   keytool -genkeypair -v \
     -keystore ruangkerja-upload.keystore \
     -alias upload \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Jawab pertanyaan identitas (organisasi = SPKD); buat **store password & key password kuat** → simpan keduanya **bersama berkas di password manager** (kehilangan keystore + sandi = tidak bisa update aplikasi; lihat risiko rencana §8).
3. Jika memakai cara B, daftarkan keystore ini di EAS nanti (`eas credentials` → *Upload keystore*) supaya build CI memakai kunci yang sama.

**Mengambil SHA-256 sertifikat** (dibutuhkan `assetlinks.json` agar TWA/WebView tidak menampilkan bilah URL, rencana M0 backend B6):

```bash
# keystore milik sendiri
keytool -list -v -keystore ruangkerja-upload.keystore -alias upload

# keystore EAS yang diunduh (cadangan cara A) — perintah sama
# kunci signing produksi Play App Signing: Play Console → Setup → App signing (salin SHA-256 dari sana)
```

Salin baris `SHA-256: XX:YY:…` untuk diisi di config `assetlinks` (endpoint dibuat di M0; nilainya dimasukkan lewat config/env oleh developer, bukan di-commit). Cara mengisi di server sudah disiapkan developer di [`docs/deploy/ANDROID-IDENTITAS.md`](ANDROID-IDENTITAS.md) (endpoint `/.well-known/assetlinks.json`, env `ANDROID_PACKAGE`/`ANDROID_CERT_SHA256`).

## 5. Checklist kesiapan Tahap 0

Centang semua sebelum M1 (rencana §9 langkah 3). Sumber lengkap: [`docs/fitur/aplikasi-ponsel-rencana.md`](../fitur/aplikasi-ponsel-rencana.md) §3 (M0), §4 (checklist prasyarat), §9 (urutan kerja).

| ✓ | Butir | Bagian |
|---|---|---|
| ☐ | Jalur aplikasi diputuskan (Expo, keputusan pemilik 9 Okt 2026) | rencana §2, §10 |
| ☐ | **Nama paket final `store.spkd.ruangkerja`** (tak bisa diubah setelah upload pertama) | §1.5 |
| ☐ | Akun Google Play Console aktif (US$25 dibayar, verifikasi lolos, 2FA nyala) | §1 |
| ☐ | Aplikasi "RuangKerja" dibuat di Play Console | §1.4 |
| ☐ | Akun Expo + EAS CLI terpasang & login (`eas whoami` benar) | §2 |
| ☐ | Proyek Firebase aktif + FCM siap | §3.1–3.2 |
| ☐ | Aplikasi Android terdaftar di Firebase dengan nama paket sama; `google-services.json` tersimpan aman (posisi nanti `apps/mobile`) | §3.3–3.4 |
| ☐ | Service account FCM dibuat (bisa menyusul sampai backend push) — JSON di server, bukan repo | §3.5 |
| ☐ | Keystore upload dibuat (EAS managed atau manual) + cadangan + sandi di password manager | §4 |
| ☐ | SHA-256 sertifikat dicatat untuk `assetlinks.json` | §4 |
| ☐ | Kebijakan privasi publik di-host (mis. `https://spkd.store/privasi`), memuat data biometrik (rencana §6 UU PDP) | rencana §3 M0, §4 |
| ☐ | Branding resmi SPKD (`--brand-*` + ikon) — ikon APK mengikuti | rencana §4 |
| ☐ | Backend fondasi `devices` selesai (migrasi + model + action + policy — bagian B tugas ini) | rencana §5 B1–B3 |

Setelah tabel ini penuh, lanjutkan ke M1 (rencana §9): build pertama, track tertutup, uji internal.
