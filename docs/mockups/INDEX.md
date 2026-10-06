# Indeks Mockup UI — RuangKerja

Sumber kebenaran tampilan untuk Claude Code / Z-AI. Ekspor dari canvas "RuangKerja — Mockup UI".

> **Ponsel:** acuan terbaru = canvas **"RuangKerja · Mockup Mobile-first"** (https://claude.ai/artifact/WWiCQBjLHrsdNPUo79dxjX, 43 layar: Masuk & Beranda per peran, Absensi, Pengajuan & Persetujuan, Tugas & Proyek, Obrolan & Rapat, Inbox/Cari/Profil, Fase 3, keadaan memuat/kosong/galat, mode malam). Bila berbeda dengan PNG `mobile/` di bawah, canvas itu yang berlaku (`docs/PLATFORM.md` §2.1).

- `html/<Nama>.html`: HTML statis, semua style inline. Bisa dibuka langsung di browser; tautan antarlayar juga berfungsi. Font dimuat dari Google Fonts.
- `png/desktop/<Nama>.png` (lebar 1440, skala 1) dan `png/mobile/<Nama>.png` (lebar 390, skala 2): gambar acuan. Claude Code bisa melihat PNG dengan membaca file gambarnya.

**Aturan pakai**
1. Struktur, urutan seksi, komponen, ikon, warna token, dan teks UI mengikuti mockup. **Data contoh (nama, angka, tanggal) hanyalah contoh.** Ambil data dari database/seeder.
2. Warna di mockup ditulis sebagai hex inline. Saat membangun, petakan ke token `resources/css/tokens.css` (lihat `docs/DESIGN.md`). Jangan menyalin hex ke komponen.
3. Mockup memakai div/SVG statis untuk grafik. Implementasi memakai komponen (Recharts/SVG) dengan tampilan yang setara.
4. Sidebar: `Main`, `Kanban`, `Persetujuan` memperlihatkan sidebar penuh 240px (default desktop ≥ 1024px). Layar desktop lain digambar dengan sidebar **diciutkan** (rail 56px) agar fokus pada konten. Keduanya harus ada (tombol ciutkan, disimpan per pengguna). Rail juga dipakai otomatis di tablet 768–1023px.
5. Hari ini di semua mockup = Senin, 5 Okt 2026. Persona: Dimas (Kepala Divisi Operasional), Hana (HR), Hendra (Direktur Utama), Rizky/Sari/Maya (anggota).

## Pasangan desktop ↔ mobile per fitur

| Fitur | Sprint | Peran contoh | Desktop | Mobile |
|---|---|---|---|---|
| Login Google | 1 | semua | `Login` | `MLogin` |
| Shell & navigasi (sidebar / tab bawah + Menu) | 0 | semua | `Main` (sidebar penuh), layar lain (rail 56px) | `MMenu`, tab bawah di semua layar mobile |
| Admin karyawan | 1 | HR | `Karyawan` | `MKaryawan` (terbatas) |
| Struktur organisasi | 1 | HR | `StrukturOrg` | — (daftar bertingkat, desktop-first) |
| Persetujuan data lokasi & selfie | 2 | anggota | — | `CheckinConsent` |
| Check-in GPS + selfie | 2 | anggota | tombol check-in di topbar/rail | `Absensi`, `CheckinSelfie`, `CheckinSukses`, `CheckinGagal` |
| Kiosk QR | 3 | perangkat lobi | `Kiosk` | — |
| Riwayat & rekap absensi | 3 | HR / anggota | `RekapAbsensi` | `MRiwayatAbsensi` |
| Lokasi, shift, hari libur | 2 | HR | `LokasiShift` | — (desktop saja) |
| Ajukan pengajuan | 4 | anggota | `FormPengajuan` | `MFormPengajuan` |
| Pengajuan saya | 4 | anggota | `PengajuanSaya` | `MPengajuanSaya` |
| Persetujuan | 4 | Kadiv | `Persetujuan` | `MPersetujuan`, `MPersetujuanDetail` |
| Alur persetujuan (admin) | 4 | HR | `AlurApproval` | — (desktop saja) |
| Board Kanban | 5 | Kadiv | `Kanban` | `MBoard` |
| Tugas saya | 5 | Kadiv | `TugasSaya` | `MTugasSaya` |
| Kalender tugas | 5 | Kadiv | `KalenderTugas` | `MKalender` |
| Buat tugas | 5 | semua | (dialog di `Kanban`) | `MTugasBaru` |
| Pengaturan workspace | 5 | Kadiv | `WorkspacePengaturan` | — (terbatas) |
| Detail tugas, komentar, mention | 6 | Kadiv | `TaskDetail` | `MTaskDetail` |
| File & dokumen Google Drive | 7 | Kadiv | `WorkspaceFile` | `MFile` |
| Inbox | 8 | Kadiv | `Inbox` | `MInbox` |
| Cari / command palette | 8 | Kadiv | `CommandPalette` | `MCari` |
| Pengaturan notifikasi & tema | 8 | Kadiv | `PengaturanNotifikasi` | `MPengaturanNotifikasi` |
| Email ringkasan harian | 8 | Kadiv | `EmailRingkasan` | (email responsif yang sama) |
| Dashboard Saya | 9 | anggota | `DashboardSaya` | `MBeranda` |
| Dashboard Kepala Divisi | 9 | Kadiv | `Main` | `MDashboardKadiv` |
| Dashboard HR | 9 | HR | `DashboardHR` | `MDashboardHR` |
| Dashboard Direksi = portofolio proyek | 9 | Direksi | `DashboardDireksi` | `MDashboardDireksi` |
| Detail proyek | 9 | Direksi | `ProyekDetail` | `MProyekDetail` |

## Daftar lengkap (52 layar)

| Nama | Jenis | Ukuran | Halaman canvas | Judul |
|---|---|---|---|---|
| Main | desktop | 1440×1120 | Ikhtisar | Dashboard Kepala Divisi (gelap) |
| Kanban | desktop | 1440×1120 | Ikhtisar | Board workspace proyek (gelap) |
| Persetujuan | desktop | 1440×1000 | Ikhtisar | Antrean persetujuan (terang) |
| Login | desktop | 1440×900 | Desktop · Login & Organisasi | Masuk dengan Google Workspace |
| Karyawan | desktop | 1440×1000 | Desktop · Login & Organisasi | Admin · Karyawan (HR) |
| StrukturOrg | desktop | 1440×900 | Desktop · Login & Organisasi | Struktur organisasi |
| Kiosk | desktop | 1280×800 | Desktop · Absensi | Kiosk QR dinamis (lobi) |
| RekapAbsensi | desktop | 1440×1040 | Desktop · Absensi | Rekap & ekspor absensi (HR) |
| LokasiShift | desktop | 1440×1240 | Desktop · Absensi | Admin · Lokasi, shift & hari libur |
| FormPengajuan | desktop | 1440×960 | Desktop · Pengajuan | Ajukan cuti / izin / lembur |
| PengajuanSaya | desktop | 1440×920 | Desktop · Pengajuan | Pengajuan saya & saldo cuti |
| AlurApproval | desktop | 1440×920 | Desktop · Pengajuan | Admin · Alur persetujuan |
| TaskDetail | desktop | 1440×1640 | Desktop · Workspace & Tugas | Detail tugas, komentar & lampiran |
| TugasSaya | desktop | 1440×920 | Desktop · Workspace & Tugas | Tugas saya (list) |
| KalenderTugas | desktop | 1440×1080 | Desktop · Workspace & Tugas | Tampilan kalender |
| WorkspaceFile | desktop | 1440×1000 | Desktop · Workspace & Tugas | File & dokumen (Google Drive) |
| WorkspacePengaturan | desktop | 1440×2160 | Desktop · Workspace & Tugas | Pengaturan workspace |
| Inbox | desktop | 1440×960 | Desktop · Notifikasi & Navigasi | Inbox |
| CommandPalette | desktop | 1440×800 | Desktop · Notifikasi & Navigasi | Command palette (⌘K) |
| PengaturanNotifikasi | desktop | 1440×900 | Desktop · Notifikasi & Navigasi | Pengaturan notifikasi & tema |
| EmailRingkasan | desktop | 640×1120 | Desktop · Notifikasi & Navigasi | Email ringkasan harian |
| DashboardSaya | desktop | 1440×960 | Desktop · Dashboard | Dashboard Saya (anggota) |
| DashboardHR | desktop | 1440×1080 | Desktop · Dashboard | Dashboard HR (terang) |
| DashboardDireksi | desktop | 1440×1680 | Desktop · Dashboard | Dashboard Direksi · portofolio proyek |
| ProyekDetail | desktop | 1440×1560 | Desktop · Dashboard | Detail proyek (tampilan Direksi) |
| MLogin | mobile | 390×844 | Mobile · Akses & Navigasi | Masuk |
| MBeranda | mobile | 390×844 | Mobile · Akses & Navigasi | Beranda (anggota) |
| MMenu | mobile | 390×844 | Mobile · Akses & Navigasi | Menu & workspace |
| MCari | mobile | 390×844 | Mobile · Akses & Navigasi | Cari |
| MInbox | mobile | 390×844 | Mobile · Akses & Navigasi | Inbox |
| MPengaturanNotifikasi | mobile | 390×1480 | Mobile · Akses & Navigasi | Pengaturan notifikasi (gulir penuh) |
| MTugasSaya | mobile | 390×844 | Mobile · Tugas & Workspace | Tugas saya |
| MBoard | mobile | 390×844 | Mobile · Tugas & Workspace | Board (satu kolom) |
| MTugasBaru | mobile | 390×844 | Mobile · Tugas & Workspace | Buat tugas (bottom sheet) |
| MTaskDetail | mobile | 390×1560 | Mobile · Tugas & Workspace | Detail tugas (gulir penuh) |
| MKalender | mobile | 390×844 | Mobile · Tugas & Workspace | Kalender agenda |
| MFile | mobile | 390×844 | Mobile · Tugas & Workspace | File Drive + dokumen baru |
| Absensi | mobile | 390×844 | Mobile · Absensi & Pengajuan | Check-in |
| CheckinConsent | mobile | 390×844 | Mobile · Absensi & Pengajuan | Persetujuan data (UU PDP) |
| CheckinSelfie | mobile | 390×844 | Mobile · Absensi & Pengajuan | Ambil selfie |
| CheckinSukses | mobile | 390×844 | Mobile · Absensi & Pengajuan | Check-in berhasil |
| CheckinGagal | mobile | 390×844 | Mobile · Absensi & Pengajuan | Di luar radius kantor |
| MRiwayatAbsensi | mobile | 390×844 | Mobile · Absensi & Pengajuan | Riwayat absensi |
| MFormPengajuan | mobile | 390×1240 | Mobile · Absensi & Pengajuan | Ajukan pengajuan (gulir penuh) |
| MPengajuanSaya | mobile | 390×844 | Mobile · Absensi & Pengajuan | Pengajuan saya |
| MPersetujuan | mobile | 390×844 | Mobile · Absensi & Pengajuan | Persetujuan (geser kartu) |
| MPersetujuanDetail | mobile | 390×1100 | Mobile · Absensi & Pengajuan | Detail persetujuan |
| MDashboardKadiv | mobile | 390×1360 | Mobile · Dashboard & Admin | Dashboard Kepala Divisi |
| MDashboardHR | mobile | 390×1240 | Mobile · Dashboard & Admin | Dashboard HR |
| MDashboardDireksi | mobile | 390×2080 | Mobile · Dashboard & Admin | Dashboard Direksi · portofolio proyek |
| MProyekDetail | mobile | 390×2200 | Mobile · Dashboard & Admin | Detail proyek (Direksi) |
| MKaryawan | mobile | 390×844 | Mobile · Dashboard & Admin | Karyawan (terbatas di mobile) |

Jika mockup diperbarui di canvas, ekspor ulang folder ini dan commit bersama perubahan kodenya.
