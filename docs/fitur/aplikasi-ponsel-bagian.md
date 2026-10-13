# Aplikasi Android — pembagian pembangunan (5 bagian)

> Dibuat 13 Okt 2026 (Claude Code) setelah mockup Android selesai (`docs/mockups/android/`, kanvas Artifact https://claude.ai/artifact/RqRTnjQXebU8bRRoYhW1Mj). Acuan layar: `docs/mockups/android/spec/NN-*.md` + `screens/`. Pertanyaan keputusan: `docs/mockups/android/spec/PERTANYAAN-PEMILIK.md`.

Tiap bagian = irisan vertikal (endpoint API Laravel + layar Expo + tes Pest + uji cold-start emulator + APK). Aturan: controller API tipis di atas Action/Policy web; UI Bahasa Indonesia; token Arus; satu bagian = satu branch `claude/android-bagian-N`.

## Keputusan pemilik (13 Okt 2026)
- Paket "fondasi UI" disetujui: `lucide-react-native` + `react-native-svg`, `expo-linear-gradient`, `expo-blur`, `expo-font` + Figtree/JetBrains Mono, `react-native-reanimated` + `react-native-gesture-handler`, bottom sheet. **Lucide menggantikan Ionicons.**
- Push `glm/ponsel-api` ke GitHub **ditunda** (pekerjaan bercabang dari branch itu).
- **TOTP native** untuk Super Admin dibangun di Bagian 1 (API + aplikasi).

## Bagian
| # | Nama | Modul | Isi |
|---|---|---|---|
| 1 | Fondasi & akun | 13, 01, sebagian 12 | Sistem desain RN, tab bar kapsul kontekstual, komponen dasar, `GET /saya` diperluas, login/TOTP/lupa sandi/wajib ganti sandi/biometrik/perangkat/profil/pengaturan/privasi, izin Android, versi wajib update |
| 2 | Kehadiran harian | 03, 02, 10 | Absensi lengkap, beranda staf/Kadiv/HR + briefing, inbox/pengumuman/cari/pengaturan notifikasi, push FCM, widget |
| 3 | Kerja inti | 05, 07, 09 | Tugas lengkap, workspace, catatan, obrolan |
| 4 | Persetujuan & rapat | 04, 08, laporan harian | Pengajuan, persetujuan, delegasi, rapat/notulen/video |
| 5 | Manajemen & rilis | 06, 11, 12 sisa | Portofolio/proyek/OKR/monitoring, HR/hiring, tablet/lipat, aset Play, rilis internal |

Urutan: 1 → (2 ∥ 3) → 4 → 5. Bagian 2–5 hanya boleh dimulai setelah Bagian 1 di-merge ke branch dasar.

## Bagian 1 — paket kerja
- **B1 Backend auth** (`app/Http/Controllers/Api/Auth*`, Actions, tes): `GET /auth/saya` diperluas (peran, `is_staff_only`, flag fitur, divisi/tim/atasan/no. karyawan/tgl bergabung); TOTP: login mengembalikan tantangan bila 2FA aktif, endpoint tantangan (kode/recovery), Super Admin boleh masuk dengan TOTP; ganti sandi (`ChangeOwnPassword`), lupa sandi 3 endpoint (minta/status/selesai, reuse Action web), `GET /konfigurasi` publik (versi minimal, pemeliharaan).
- **B2 Backend privasi & perangkat**: Data Saya (baca + ekspor lewat Bearer), persetujuan lokasi/selfie (baca/beri/cabut), kebijakan privasi JSON publik, sakelar biometrik per perangkat, "kirim tautan desktop ke email saya".
- **F1 Fondasi UI app** (`apps/mobile/src/ui`, tema, font, ikon, tab bar, komponen modul 13): pasang paket, token terang/malam, Lucide, komponen (Button, Input, DateInput, Card, Badge, Avatar, Sheet, Dialog Material, Snackbar, AppBar, TabBar kapsul, Empty/Skeleton/Error/Offline/Terkunci), migrasi `ui.tsx` lama tanpa merusak layar yang ada.
- **S1 Layar akun app** (modul 01): sesudah F1 + kontrak B1/B2.
- **Integrasi**: Pest penuh, lint, tsc/eslint app, `expo export`, build APK, cold-start emulator ×2.

Kontrak endpoint ditulis per agen: `docs/sesi/ponsel-b1-auth.md`, `docs/sesi/ponsel-b2-privasi.md` (digabung ke `docs/sesi/ponsel.md` oleh integrator).

## Keputusan pemilik untuk Bagian 4 (13 Okt 2026)
- **Ruang rapat video native** (LiveKit React Native: `@livekit/react-native` + `@livekit/react-native-webrtc`, izin kamera/mikrofon) sesuai mockup 08 — bukan membuka browser.
- **Persetujuan: geser kanan = setujui, kiri = form tolak (alasan wajib); keputusan dikirim setelah 6 detik tanpa "Urungkan"** (urungkan sepenuhnya di sisi aplikasi, server tidak berubah).
- **Notulensi cepat dari ponsel memakai templat paragraf polos** (Peserta/Agenda/Pembahasan/Keputusan/Tindak lanjut sebagai paragraf) sehingga langsung bisa disunting di editor teks polos ponsel; templat web tetap berformat.
- Bagian 4 = modul 04 (pengajuan + persetujuan + delegasi + pembatalan HR + **form koreksi absensi** yang ditunda dari Bagian 2), modul 08 (rapat, kalender, notulen, tindak lanjut, video, notulen otomatis, jadwal manajemen), laporan progres harian (tulis, riwayat, pembaca).

## Keputusan pemilik untuk Bagian 5 (13 Okt 2026)
- **Semua dikerjakan, 3 jalur paralel**: 5A Manajemen (modul 06 tanpa laporan harian yang sudah selesai di Bagian 4), 5B HR & admin + Hiring (modul 11), 5C Android (sisa modul 12: tablet/lipat, ikon/splash, aset Play, build rilis).
- **HR & hiring ikut mockup**: rekap absensi per karyawan + detail kalender (ekspor tetap desktop), pengaturan lowongan bisa diedit kecuali pemasangan skrip Google Form (desktop), **Unduh PNG struktur organisasi ditunda** (banner "tersedia di desktop"), Direksi melihat daftar & profil karyawan tanpa NIK/riwayat, data pelamar **tidak** di-cache ke disk.
- **Tablet & lipat**: Rail 96dp pada lebar ≥ 600dp, Tugas dua panel, Obrolan tiga kolom; **tablet boleh diputar** (`expo-screen-orientation`), ponsel tetap potret.
- **Rilis internal**: keystore upload baru dibuat lokal di `secrets/` (tidak di-commit; pemilik wajib mencadangkan keystore + sandinya), build AAB + APK rilis bertanda tangan, aset & draf listing Play. Unggah ke Play Console oleh pemilik.
- Bawaan yang diambil dari usulan mockup (tanpa pertanyaan baru): Portofolio/Manajemen/OKR di tab Lainnya, monitoring sebagai Beranda Direksi; label keputusan "Tandai selesai" (bukan "Setujui"); layar "Proyek divisi" Kadiv dibangun; riwayat update proyek + risiko teratasi ditambahkan; catatan tindakan diurutkan dengan Naikkan/Turunkan; "Jadwal terdekat" Dashboard Manajemen diisi rapat `leadership`; HR tetap tanpa portofolio.

## Bagian 5 — paket kerja
- **B5-A Backend manajemen** (`routes/api/auth/b5a-manajemen.php`, kontrak `docs/sesi/ponsel-b5a-manajemen.md`): portofolio, detail proyek (KPI, burn-up, milestone, update + riwayat, risiko, tugas terlambat, tim), aksi PIC (update, milestone, risiko), aksi Direksi (minta update, arahan, tandai keputusan selesai), proyek divisi Kadiv, Dashboard Manajemen + beban kerja + jadwal pimpinan, catatan tindakan, OKR (daftar, detail, check-in, tautkan tugas, form, tutup), monitoring Direksi (harian, mingguan, proyek, detail laporan).
- **B5-B Backend HR** (`b5b-hr.php`, `ponsel-b5b-hr.md`): karyawan (daftar + profil), permintaan reset sandi (daftar, setujui/tolak), struktur organisasi, Absensi HR (hari ini, perlu ditinjau + selfie bertanda tangan + audit, koreksi manual, rekap bulanan per karyawan, kedisiplinan), saldo cuti (lihat + penyesuaian), pengumuman ke divisi/tim.
- **B5-H Backend hiring** (`b5h-hiring.php`, `ponsel-b5h-hiring.md`): lowongan (daftar, detail, ubah, pertanyaan, tim penilai), pengaturan hiring, kandidat (papan per tahap, tambah manual, pindah tahap, tolak), profil kandidat (Profil, Wawancara jawaban + poin, Checklist, Notulensi, Keputusan akhir).
- **5C Android** (hanya `apps/mobile` + `secrets/`): Rail tablet, dua/tiga panel, rotasi tablet, ikon adaptif + monokrom, ikon notifikasi, splash Android 12 terang/gelap, signing rilis (plugin config membaca `secrets/`), aset & draf listing Play + Data safety.
- **Gelombang 2 (layar)**: S5-A modul 06, S5-B modul 11 (HR), S5-H hiring — setelah kontrak backend.
