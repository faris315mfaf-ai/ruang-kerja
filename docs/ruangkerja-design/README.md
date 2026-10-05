# RuangKerja · paket desain (Arus)

Sumber: kanvas desain "RuangKerja · Desain Modern Gradien" di claude.ai. Paket ini untuk dibaca Claude Code saat mengimplementasikan UI di repo Laravel 13 + Inertia React.

## Cara membaca file `.dc.html`

- Satu file = satu layar atau komponen. Markup dan gaya ada di HTML (gaya inline), data contoh ada di `<script type="text/x-dc">` di bawahnya (class `Component`, method `renderVals()`).
- `{{nama.field}}` adalah isian dari `renderVals()`. `<sc-for list=...>` = perulangan, `<sc-if value=...>` = kondisi, `<dc-import name="X">` = memakai komponen `X.dc.html`.
- File ini tidak bisa dibuka langsung di browser (butuh runtime kanvas `support.js`). Perlakukan sebagai spesifikasi visual + data contoh, lalu tulis ulang sebagai komponen React/Inertia + Tailwind.
- Komponen bersama: `MenuBar`, `Dock` (navigasi desktop, prop `role`), `TabBar` (navigasi ponsel, prop `set`), `Rail` (tablet lipat), `RoleDesk`/`RolePhone` (dashboard per peran SPKD, prop `role`).
- File berakhiran `Malam.dc.html` = versi mode malam dari layar yang sama. Saat implementasi, cukup satu komponen dengan dukungan tema (CSS variables / `dark:`), bukan dua salinan.

## Token desain

| Token | Terang | Malam |
|---|---|---|
| Latar | `#F3F6FA` | `#070B14` |
| Permukaan/kartu | `#FFFFFF` | `#0F1622` |
| Permukaan 2 | `#EEF2F7` | `#172131` |
| Garis | `#DDE4EC` | `#233247` |
| Garis tegas | `#C3CEDA` | `#34465E` |
| Teks | `#0B1A2B` | `#EAF1F8` |
| Teks sekunder | `#46576B` | `#A6B4C6` |
| Teks samar | `#8495A8` | `#7D8FA5` |
| Sukses teks/latar | `#0F7A55 / #E3F6EE` | `#4ADE9B / #0E2A20` |
| Peringatan | `#9A5800 / #FFF1DC` | `#F6B95C / #2E2210` |
| Bahaya | `#C42137 / #FDE7EA` | `#FF7A8A / #3A1520` |
| Info | `#1A4CB0 / #E6EEFE` | `#A9C2FF / #14223F` |
| Teal tautan | `#09656E / #E8FBF8` | `#5AD6C8 / #0E2A2C` |

Gradien: aksi `linear-gradient(135deg, #0B7F86, #1E5FD6)` · merek `#14B8A6 → #2F7BEA` · hangat `#C2410C → #BE185D` · indigo `#2F7BEA → #6D4AE0`.
Huruf: Figtree 400–800 (+ JetBrains Mono untuk kode/ID). Desktop isi 16px, ponsel 17px, display 44px. Radius tombol/input 12, kartu 20–24. Tinggi kontrol 44, aksi utama 52–58. Target sentuh ponsel minimal 44px.

## Daftar layar per halaman kanvas

### 1 · Fondasi desain

- `screens/Main.dc.html` — Warna & gradien (1440×1560)
- `screens/Tipografi.dc.html` — Tipografi (1440×1560)
- `screens/Ruang.dc.html` — Spasi, radius, elevasi & ikon (1440×1560)
- `screens/Komponen.dc.html` — Komponen (1440×2000)
- `screens/Navigasi.dc.html` — Navigasi: menu bar, Dock, tab bar (1440×1760)
- `screens/MenuBar.dc.html` — Komponen · MenuBar (1440×64)
- `screens/Dock.dc.html` — Komponen · Dock (1200×380)
- `screens/TabBar.dc.html` — Komponen · TabBar ponsel (390×110)
- `screens/Rail.dc.html` — Komponen · Rail tablet (96×1104)
- `screens/RoleDesk.dc.html` — Komponen · RoleDesk (templat dashboard peran) (1440×1500)
- `screens/RolePhone.dc.html` — Komponen · RolePhone (beranda ponsel peran) (390×844)

### 2 · Desktop

- `screens/DLogin.dc.html` — Masuk (1440×900)
- `screens/DBeranda.dc.html` — Beranda · Kepala Divisi (1440×1500)
- `screens/DAbsensi.dc.html` — Absensi saya (1440×1260)
- `screens/DBoard.dc.html` — Board proyek PLQ (gelap) (1440×1160)
- `screens/DTugas.dc.html` — Detail tugas (1440×1320)
- `screens/DPersetujuan.dc.html` — Persetujuan (1440×1200)
- `screens/DPortofolio.dc.html` — Portofolio proyek · Direksi (1440×1760)
- `screens/DHR.dc.html` — Dashboard HR (1440×1360)
- `screens/DInbox.dc.html` — Inbox (1440×1080)

### 3 · Ponsel

- `screens/MBeranda.dc.html` — Beranda (390×844)
- `screens/MAbsen.dc.html` — Absen · check-in (390×844)
- `screens/MSukses.dc.html` — Check-in berhasil (390×844)
- `screens/MTugas.dc.html` — Tugas saya (390×844)
- `screens/MPersetujuan.dc.html` — Persetujuan (390×844)
- `screens/MInbox.dc.html` — Inbox (390×844)
- `screens/MMenu.dc.html` — Menu (390×844)

### 4 · Proyek & tugas

- `screens/DProyek.dc.html` — Monitoring per proyek · PLQ (1440×2080)
- `screens/DMonitorTugas.dc.html` — Monitoring tugas · Kepala Divisi (1440×1900)
- `screens/DTodo.dc.html` — Todolist proyek · PLQ (1440×2000)
- `screens/MProyek.dc.html` — Ponsel · Monitoring proyek (390×844)
- `screens/MTodo.dc.html` — Ponsel · Todolist proyek (390×844)

### 5 · Tampilan staf

- `screens/SBeranda.dc.html` — Staf · Beranda (Dashboard saya) (1440×1500)
- `screens/STugasSaya.dc.html` — Staf · Tugas saya (1440×1360)
- `screens/SDetailTugas.dc.html` — Staf · Detail tugas (1440×1440)
- `screens/SAbsensi.dc.html` — Staf · Absensi & riwayat (1440×1560)
- `screens/SPengajuan.dc.html` — Staf · Pengajuan saya (1440×1280)
- `screens/SFormPengajuan.dc.html` — Staf · Ajukan cuti/izin/lembur (1440×1400)
- `screens/SProyekSaya.dc.html` — Staf · Workspace & proyek saya (PIC) (1440×1560)
- `screens/SKinerja.dc.html` — Staf · Kinerja saya (1440×1440)
- `screens/SPengaturan.dc.html` — Staf · Profil, notifikasi & privasi (1440×1480)
- `screens/MSBeranda.dc.html` — Staf ponsel · Beranda (390×844)
- `screens/MSDetailTugas.dc.html` — Staf ponsel · Detail tugas (390×844)
- `screens/MSRiwayat.dc.html` — Staf ponsel · Riwayat absensi (390×844)
- `screens/MSPengajuanSaya.dc.html` — Staf ponsel · Pengajuan saya (390×844)
- `screens/MSFormPengajuan.dc.html` — Staf ponsel · Ajukan cuti (390×844)
- `screens/MSProyekSaya.dc.html` — Staf ponsel · Proyek saya & update PIC (390×844)
- `screens/MSKinerja.dc.html` — Staf ponsel · Kinerja saya (390×844)
- `screens/MSPengaturan.dc.html` — Staf ponsel · Pengaturan & privasi (390×844)

### 6 · Rapat & notulen

- `screens/DRapat.dc.html` — Rapat · agenda & gabung (1440×1400)
- `screens/DNotulen.dc.html` — Notulensi rapat (1440×1700)
- `screens/DRapatBaru.dc.html` — Jadwalkan rapat (Meet / Zoom) (1440×1240)
- `screens/DNotifRapat.dc.html` — Pemberitahuan rapat online (1440×1300)
- `screens/MRapat.dc.html` — Ponsel · Rapat hari ini (390×844)
- `screens/MRapatDetail.dc.html` — Ponsel · Detail rapat & gabung (390×844)
- `screens/MNotulen.dc.html` — Ponsel · Notulensi (390×844)
- `screens/MNotifRapat.dc.html` — Ponsel · Notifikasi rapat dimulai (390×844)

### 7 · SPKD per peran

- `screens/PeranDirut.dc.html` — Direktur Utama (1440×1500)
- `screens/PeranDirektur.dc.html` — Direktur (1440×1500)
- `screens/PeranHR.dc.html` — HR (1440×1500)
- `screens/PeranCorsec.dc.html` — Sekretaris Perusahaan (1440×1500)
- `screens/PeranMarketing.dc.html` — Divisi Branding & Marketing (1440×1500)
- `screens/PeranProgramming.dc.html` — Divisi Programming (1440×1500)
- `screens/PeranImplementer.dc.html` — Divisi Implementer (1440×1500)
- `screens/PeranAnalis.dc.html` — Divisi Analis (Analis Koding) (1440×1500)
- `screens/PeranMDirut.dc.html` — Ponsel · Direktur Utama (390×844)
- `screens/PeranMDirektur.dc.html` — Ponsel · Direktur (390×844)
- `screens/PeranMHR.dc.html` — Ponsel · HR (390×844)
- `screens/PeranMCorsec.dc.html` — Ponsel · Sekretaris Perusahaan (390×844)
- `screens/PeranMMarketing.dc.html` — Ponsel · Divisi Branding & Marketing (390×844)
- `screens/PeranMProgramming.dc.html` — Ponsel · Divisi Programming (390×844)
- `screens/PeranMImplementer.dc.html` — Ponsel · Divisi Implementer (390×844)
- `screens/PeranMAnalis.dc.html` — Ponsel · Divisi Analis (Analis Koding) (390×844)

### 8 · Manajemen

- `screens/MgDashboard.dc.html` — Manajemen · Dashboard (1440×2100)
- `screens/MgKerja.dc.html` — Manajemen · Tracking kerja harian/mingguan/bulanan (1440×1900)
- `screens/MgAbsensi.dc.html` — Manajemen · Tracking absensi (1440×2000)
- `screens/MgProyek.dc.html` — Manajemen · Proyek & milestone (1440×2200)
- `screens/MgJadwal.dc.html` — Manajemen · Jadwal & notulensi (1440×1900)
- `screens/TfDashboard.dc.html` — Tablet · Dashboard (884×1104)
- `screens/TfKerja.dc.html` — Tablet · Tracking kerja (884×1104)
- `screens/TfAbsensi.dc.html` — Tablet · Tracking absensi (884×1104)
- `screens/TfProyek.dc.html` — Tablet · Proyek & milestone (884×1104)
- `screens/TfJadwal.dc.html` — Tablet · Jadwal & notulensi (884×1104)
- `screens/MgPDashboard.dc.html` — Ponsel · Ringkasan (390×844)
- `screens/MgPKerja.dc.html` — Ponsel · Tracking kerja (390×844)
- `screens/MgPAbsensi.dc.html` — Ponsel · Absensi (390×844)
- `screens/MgPProyek.dc.html` — Ponsel · Proyek & milestone (390×844)
- `screens/MgPJadwal.dc.html` — Ponsel · Jadwal & notulen (390×844)

### 9 · Ponsel lanjutan

- `screens/MFondasi.dc.html` — Fondasi mobile: zona jempol, huruf, gestur, keadaan, notifikasi, ukuran (1440×2700)
- `screens/MLogin.dc.html` — Masuk biometrik (390×844)
- `screens/MLockScreen.dc.html` — Layar kunci · notifikasi dengan aksi (390×844)
- `screens/MWidget.dc.html` — Widget layar utama (390×844)
- `screens/MNotifCenter.dc.html` — Pusat notifikasi (390×844)
- `screens/MQuickAdd.dc.html` — Aksi cepat (tombol +) (390×844)
- `screens/MOffline.dc.html` — Offline & antrean sinkron (390×844)
- `screens/MDark.dc.html` — Mode gelap (390×844)
- `screens/PDirutKeputusan.dc.html` — Direktur Utama · putuskan (390×844)
- `screens/PDirutPortofolio.dc.html` — Direktur Utama · portofolio (390×844)
- `screens/PDirekturSetuju.dc.html` — Direktur · setujui (390×844)
- `screens/PDirekturKapasitas.dc.html` — Direktur · kapasitas tim (390×844)
- `screens/PHRLive.dc.html` — HR · kehadiran langsung (390×844)
- `screens/PHRCuti.dc.html` — HR · tinjau cuti (390×844)
- `screens/PCorsecSurat.dc.html` — Sekretaris · disposisi surat (390×844)
- `screens/PCorsecNotulis.dc.html` — Sekretaris · notulen langsung (390×844)
- `screens/PMarketingKalender.dc.html` — Branding · kalender konten (390×844)
- `screens/PMarketingReview.dc.html` — Branding · review materi (390×844)
- `screens/PProgSprint.dc.html` — Programming · board sprint (390×844)
- `screens/PProgBug.dc.html` — Programming · bug kritis (390×844)
- `screens/PImplCheckin.dc.html` — Implementer · check-in di klien (390×844)
- `screens/PImplTiket.dc.html` — Implementer · tiket klien (390×844)
- `screens/PAnalisUAT.dc.html` — Analis · jalankan UAT (390×844)
- `screens/PAnalisReview.dc.html` — Analis · review kode (390×844)
- `screens/MgPDivisi.dc.html` — Manajemen · detail divisi (390×844)
- `screens/MgPMilestone.dc.html` — Manajemen · milestone 3 bulan (390×844)
- `screens/MgPNotulen.dc.html` — Manajemen · notulen & tindak lanjut (390×844)

### 10 · Mode malam

- `screens/DLoginMalam.dc.html` — Masuk · malam (1440×900)
- `screens/DBerandaMalam.dc.html` — Beranda · Kepala Divisi · malam (1440×1500)
- `screens/DAbsensiMalam.dc.html` — Absensi saya · malam (1440×1260)
- `screens/DTugasMalam.dc.html` — Detail tugas · malam (1440×1320)
- `screens/DPersetujuanMalam.dc.html` — Persetujuan · malam (1440×1200)
- `screens/DPortofolioMalam.dc.html` — Portofolio proyek · Direksi · malam (1440×1760)
- `screens/DHRMalam.dc.html` — Dashboard HR · malam (1440×1360)
- `screens/DInboxMalam.dc.html` — Inbox · malam (1440×1080)
- `screens/MBerandaMalam.dc.html` — Beranda · malam (390×844)
- `screens/MAbsenMalam.dc.html` — Absen · check-in · malam (390×844)
- `screens/MSuksesMalam.dc.html` — Check-in berhasil · malam (390×844)
- `screens/MTugasMalam.dc.html` — Tugas saya · malam (390×844)
- `screens/MPersetujuanMalam.dc.html` — Persetujuan · malam (390×844)
- `screens/MInboxMalam.dc.html` — Inbox · malam (390×844)
- `screens/MMenuMalam.dc.html` — Menu · malam (390×844)
- `screens/DProyekMalam.dc.html` — Monitoring per proyek · PLQ · malam (1440×2080)
- `screens/DMonitorTugasMalam.dc.html` — Monitoring tugas · Kepala Divisi · malam (1440×1900)
- `screens/DTodoMalam.dc.html` — Todolist proyek · PLQ · malam (1440×2000)
- `screens/MProyekMalam.dc.html` — Ponsel · Monitoring proyek · malam (390×844)
- `screens/MTodoMalam.dc.html` — Ponsel · Todolist proyek · malam (390×844)
- `screens/SBerandaMalam.dc.html` — Staf · Beranda (Dashboard saya) · malam (1440×1500)
- `screens/STugasSayaMalam.dc.html` — Staf · Tugas saya · malam (1440×1360)
- `screens/SDetailTugasMalam.dc.html` — Staf · Detail tugas · malam (1440×1440)
- `screens/SAbsensiMalam.dc.html` — Staf · Absensi & riwayat · malam (1440×1560)
- `screens/SPengajuanMalam.dc.html` — Staf · Pengajuan saya · malam (1440×1280)
- `screens/SFormPengajuanMalam.dc.html` — Staf · Ajukan cuti/izin/lembur · malam (1440×1400)
- `screens/SProyekSayaMalam.dc.html` — Staf · Workspace & proyek saya (PIC) · malam (1440×1560)
- `screens/SKinerjaMalam.dc.html` — Staf · Kinerja saya · malam (1440×1440)
- `screens/SPengaturanMalam.dc.html` — Staf · Profil, notifikasi & privasi · malam (1440×1480)
- `screens/MSBerandaMalam.dc.html` — Staf ponsel · Beranda · malam (390×844)
- `screens/MSDetailTugasMalam.dc.html` — Staf ponsel · Detail tugas · malam (390×844)
- `screens/MSRiwayatMalam.dc.html` — Staf ponsel · Riwayat absensi · malam (390×844)
- `screens/MSPengajuanSayaMalam.dc.html` — Staf ponsel · Pengajuan saya · malam (390×844)
- `screens/MSFormPengajuanMalam.dc.html` — Staf ponsel · Ajukan cuti · malam (390×844)
- `screens/MSProyekSayaMalam.dc.html` — Staf ponsel · Proyek saya & update PIC · malam (390×844)
- `screens/MSKinerjaMalam.dc.html` — Staf ponsel · Kinerja saya · malam (390×844)
- `screens/MSPengaturanMalam.dc.html` — Staf ponsel · Pengaturan & privasi · malam (390×844)
- `screens/DRapatMalam.dc.html` — Rapat · agenda & gabung · malam (1440×1400)
- `screens/DNotulenMalam.dc.html` — Notulensi rapat · malam (1440×1700)
- `screens/DRapatBaruMalam.dc.html` — Jadwalkan rapat (Meet / Zoom) · malam (1440×1240)
- `screens/DNotifRapatMalam.dc.html` — Pemberitahuan rapat online · malam (1440×1300)
- `screens/MRapatMalam.dc.html` — Ponsel · Rapat hari ini · malam (390×844)
- `screens/MRapatDetailMalam.dc.html` — Ponsel · Detail rapat & gabung · malam (390×844)
- `screens/MNotulenMalam.dc.html` — Ponsel · Notulensi · malam (390×844)
- `screens/MNotifRapatMalam.dc.html` — Ponsel · Notifikasi rapat dimulai · malam (390×844)
- `screens/PeranDirutMalam.dc.html` — Direktur Utama · malam (1440×1500)
- `screens/PeranDirekturMalam.dc.html` — Direktur · malam (1440×1500)
- `screens/PeranHRMalam.dc.html` — HR · malam (1440×1500)
- `screens/PeranCorsecMalam.dc.html` — Sekretaris Perusahaan · malam (1440×1500)
- `screens/PeranMarketingMalam.dc.html` — Divisi Branding & Marketing · malam (1440×1500)
- `screens/PeranProgrammingMalam.dc.html` — Divisi Programming · malam (1440×1500)
- `screens/PeranImplementerMalam.dc.html` — Divisi Implementer · malam (1440×1500)
- `screens/PeranAnalisMalam.dc.html` — Divisi Analis (Analis Koding) · malam (1440×1500)
- `screens/PeranMDirutMalam.dc.html` — Ponsel · Direktur Utama · malam (390×844)
- `screens/PeranMDirekturMalam.dc.html` — Ponsel · Direktur · malam (390×844)
- `screens/PeranMHRMalam.dc.html` — Ponsel · HR · malam (390×844)
- `screens/PeranMCorsecMalam.dc.html` — Ponsel · Sekretaris Perusahaan · malam (390×844)
- `screens/PeranMMarketingMalam.dc.html` — Ponsel · Divisi Branding & Marketing · malam (390×844)
- `screens/PeranMProgrammingMalam.dc.html` — Ponsel · Divisi Programming · malam (390×844)
- `screens/PeranMImplementerMalam.dc.html` — Ponsel · Divisi Implementer · malam (390×844)
- `screens/PeranMAnalisMalam.dc.html` — Ponsel · Divisi Analis (Analis Koding) · malam (390×844)
- `screens/MgDashboardMalam.dc.html` — Manajemen · Dashboard · malam (1440×2100)
- `screens/MgKerjaMalam.dc.html` — Manajemen · Tracking kerja harian/mingguan/bulanan · malam (1440×1900)
- `screens/MgAbsensiMalam.dc.html` — Manajemen · Tracking absensi · malam (1440×2000)
- `screens/MgProyekMalam.dc.html` — Manajemen · Proyek & milestone · malam (1440×2200)
- `screens/MgJadwalMalam.dc.html` — Manajemen · Jadwal & notulensi · malam (1440×1900)
- `screens/TfDashboardMalam.dc.html` — Tablet · Dashboard · malam (884×1104)
- `screens/TfKerjaMalam.dc.html` — Tablet · Tracking kerja · malam (884×1104)
- `screens/TfAbsensiMalam.dc.html` — Tablet · Tracking absensi · malam (884×1104)
- `screens/TfProyekMalam.dc.html` — Tablet · Proyek & milestone · malam (884×1104)
- `screens/TfJadwalMalam.dc.html` — Tablet · Jadwal & notulensi · malam (884×1104)
- `screens/MgPDashboardMalam.dc.html` — Ponsel · Ringkasan · malam (390×844)
- `screens/MgPKerjaMalam.dc.html` — Ponsel · Tracking kerja · malam (390×844)
- `screens/MgPAbsensiMalam.dc.html` — Ponsel · Absensi · malam (390×844)
- `screens/MgPProyekMalam.dc.html` — Ponsel · Proyek & milestone · malam (390×844)
- `screens/MgPJadwalMalam.dc.html` — Ponsel · Jadwal & notulen · malam (390×844)
- `screens/MNotifCenterMalam.dc.html` — Pusat notifikasi · malam (390×844)
- `screens/MQuickAddMalam.dc.html` — Aksi cepat (tombol +) · malam (390×844)
- `screens/MOfflineMalam.dc.html` — Offline & antrean sinkron · malam (390×844)
- `screens/PDirutKeputusanMalam.dc.html` — Direktur Utama · putuskan · malam (390×844)
- `screens/PDirutPortofolioMalam.dc.html` — Direktur Utama · portofolio · malam (390×844)
- `screens/PDirekturSetujuMalam.dc.html` — Direktur · setujui · malam (390×844)
- `screens/PDirekturKapasitasMalam.dc.html` — Direktur · kapasitas tim · malam (390×844)
- `screens/PHRLiveMalam.dc.html` — HR · kehadiran langsung · malam (390×844)
- `screens/PHRCutiMalam.dc.html` — HR · tinjau cuti · malam (390×844)
- `screens/PCorsecSuratMalam.dc.html` — Sekretaris · disposisi surat · malam (390×844)
- `screens/PCorsecNotulisMalam.dc.html` — Sekretaris · notulen langsung · malam (390×844)
- `screens/PMarketingKalenderMalam.dc.html` — Branding · kalender konten · malam (390×844)
- `screens/PMarketingReviewMalam.dc.html` — Branding · review materi · malam (390×844)
- `screens/PProgSprintMalam.dc.html` — Programming · board sprint · malam (390×844)
- `screens/PProgBugMalam.dc.html` — Programming · bug kritis · malam (390×844)
- `screens/PImplCheckinMalam.dc.html` — Implementer · check-in di klien · malam (390×844)
- `screens/PImplTiketMalam.dc.html` — Implementer · tiket klien · malam (390×844)
- `screens/PAnalisUATMalam.dc.html` — Analis · jalankan UAT · malam (390×844)
- `screens/PAnalisReviewMalam.dc.html` — Analis · review kode · malam (390×844)
- `screens/MgPDivisiMalam.dc.html` — Manajemen · detail divisi · malam (390×844)
- `screens/MgPMilestoneMalam.dc.html` — Manajemen · milestone 3 bulan · malam (390×844)
- `screens/MgPNotulenMalam.dc.html` — Manajemen · notulen & tindak lanjut · malam (390×844)
- `screens/RoleDeskMalam.dc.html` — Komponen · RoleDesk malam (1440×1500)
- `screens/RolePhoneMalam.dc.html` — Komponen · RolePhone malam (390×844)
- `screens/RailMalam.dc.html` — Komponen · Rail malam (96×1104)

## Contoh perintah untuk Claude Code

```
Baca docs/design/ruangkerja-design/README.md lalu implementasikan layar
screens/MgDashboard.dc.html sebagai halaman Inertia React
resources/js/Pages/Manajemen/Dashboard.tsx. Pakai token di README sebagai
CSS variables (terang + malam), ganti data contoh dengan props dari controller.
```
