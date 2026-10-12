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
