# Changelog

Semua perubahan penting RuangKerja dicatat di sini. Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/); aplikasi belum memakai nomor versi, jadi setiap bagian adalah satu sprint Fase 1 (urutan terbaru di atas). Rincian lengkap per sprint ada di `docs/sprints/*/SUMMARY*.md` (juga bisa dibaca di aplikasi: **Admin › Dokumentasi**), riwayat commit di `git log main`.

Kategori: **Ditambahkan** (fitur baru) · **Diubah** · **Diperbaiki** · **Keamanan**.

## [Belum dirilis]

### Diubah
- **Sistem desain Arus untuk seluruh aplikasi** (`docs/ruangkerja-design/`, `docs/DESIGN.md`): palet terang & Malam baru dengan nama token lama, pasangan status lembut (`bg-success-soft` …), gradien aksi/merek/hangat/indigo, latar halaman dua cahaya, huruf **Figtree** (isi 16px desktop, 17px ponsel, display 44px) + JetBrains Mono, skala radius 8–28, elevasi e-1/e-2/glow, kontrol 44px. Tema halaman Manajemen (`arus.css`) dilebur ke sistem global; Plus Jakarta Sans dihapus.
- Komponen dasar bergaya Arus: tombol gradien (varian `tonal`, `quiet`, ukuran 36/44/52/56), input/select 44px, checkbox/radio/switch, badge status & label, `SegmentedTabs`/`TabNav`, `Panel`, `KpiCard`, `Progress`, `ListRow`, empty state, dialog/sheet/menu kaca, toast inverse.
- Shell: menu bar kaca 64px, Dock dengan ubin putih & aktif bergradien, **Rail 96px untuk tablet** (768–1023px, menggantikan Dock tanpa magnifikasi), tab bar kapsul 70px dengan pil gradien, app bar ponsel berjudul besar. Konten desktop di kolom 1280px (1480px untuk board & tabel).
- Warna non-CSS (manifest PWA, halaman offline, email, `config/branding.php`) mengikuti Arus.
- Dashboard Saya/Divisi/HR dan Portofolio proyek mengikuti layar Arus (SBeranda·MSBeranda, DBeranda·MBeranda, DHR·PHRLive, DPortofolio·PDirutPortofolio): hero absensi & KPI sorotan, `Panel`/`KpiCard`/`Badge`/`ListRow`/`UserAvatar`, tren 8 minggu sebagai kolom gradien, daftar orang per status (ponsel HR), kartu proyek dengan cincin progres; `features/dashboard/panel.tsx`, `stat-card.tsx` dan `features/portfolio/sections.tsx` dihapus.
- **Pengajuan & Persetujuan** bergaya Arus (SPengajuan, SFormPengajuan, DPersetujuan, MS*/MPersetujuan): kartu saldo sorotan, daftar kartu + panel detail dengan jejak persetujuan, ubin jenis & kartu Ringkasan di formulir, antrean beravatar dengan filter jenis dan tombol Tolak/Setujui di kartu ponsel. Breadcrumb Persetujuan tidak lagi di bawah Absensi.

### Ditambahkan
- `/dev/komponen` (lokal, Super Admin): contoh hidup semua komponen Arus. Panduan agent modul: `docs/design/ARUS-GUIDE.md`.

### Dihapus
- Komponen tak terpakai `ui/sidebar`, `ui/navigation-menu`, `ui/icon`, `ui/placeholder-pattern`, hook `use-mobile*`, prop bersama `sidebarOpen`, paket `@radix-ui/react-navigation-menu` dan `@fontsource/plus-jakarta-sans`.

### Ditambahkan
- **Dashboard Manajemen** (`/manajemen`, Direksi · HR · Super Admin = `dashboard.view_company`; menu Dock "Manajemen" dan baris Menu ponsel): ringkasan perusahaan sesuai desain MgDashboard dengan tab Harian / Mingguan / Bulanan tanpa muat ulang — KPI kehadiran, tugas selesai dari rencana, tugas terlambat / tepat waktu (delta periode sebelumnya), proyek perlu perhatian; grafik rencana vs selesai per divisi / hari / minggu; absensi hari ini per divisi; tracking proyek aktif & milestone bulan ini (cakupan portofolio penonton). Data deferred + cache 5 menit per penonton; panel Jadwal & Notulensi menampilkan keadaan kosong sampai modul rapat (Fase 2) ada. Memakai sistem desain Arus global (terang & malam).
- **Admin › Dokumentasi** (`/admin/dokumentasi`, khusus Super Admin): dokumen repo pilihan (README, serah terima, arsitektur, database, desain, platform, setup lokal, PRD, ASVS L1, changelog, hal kritis, ringkasan sprint) dirender di server dengan daftar isi dan pencarian. Daftar dokumen dikunci di `config/docs.php`; URL hanya memuat slug, tidak pernah path.
- `docs/CHANGELOG.md` (berkas ini) dan `docs/CRITICAL.md` (hal kritis operasional + checklist go-live).
- **Kode aktivasi kiosk**: selain tautan sekali pakai, HR mendapat kode 8 karakter (mis. `ABCD-2345`, tanpa huruf/angka mirip) yang diketik di layar `/kiosk` perangkat. TTL sama dengan tautan (24 jam), sekali pakai, memakai tautan atau kode membatalkan keduanya; maks. 5 percobaan/menit per IP, kunci 15 menit setelah 10 kode salah.
- Shell desktop: Dock ala macOS (magnifikasi pegas), menu bar tipis, konten penuh layar.
- **Pengajuan** (`docs/sprints/FITUR-PENGAJUAN.md`): jenis bawaan Cuti melahirkan (90 hari kalender), Cuti alasan penting (maks. 3 hari per peristiwa), Cuti di luar tanggungan (tidak dibayar, tidak memotong saldo) dengan penanda **"Bawaan sementara"** sampai ditinjau HR; draf form tersimpan otomatis di perangkat ("Draf dipulihkan dari perangkat ini" + Buang); saldo cuti prorata untuk karyawan baru, **saldo awal**, **penyesuaian** beralasan (teraudit, tabel `leave_balance_adjustments`) dan **impor saldo CSV/XLSX** dengan pratinjau galat per baris.

### Keamanan
- Email/WhatsApp pengajuan tidak memuat catatan penolakan/revisi (hanya di aplikasi); pengajuan Sakit memakai subjek netral tanpa jenis/nomor; audit keputusan hanya menyimpan id + `has_note`.
- Penyetuju pengganti (delegasi) pengajuan Sakit hanya melihat tanggal, durasi, status — alasan, catatan, dan lampiran disembunyikan (juga unduhan lampiran dan pencarian).

## Perbaikan review Sprint 3–9 (bagian A, B, dan sisa akhir)

### Diperbaiki
- Absensi: rekap & ekspor gaji hanya menghitung hari dalam masa kerja (`users.deactivated_at`), cuti setengah hari dihitung setengah, "lupa check-out" baru muncul setelah jendela check-out lewat, koreksi shift malam setelah tengah malam ditambatkan ke hari berikutnya, hanya tinjauan pertama yang berlaku saat dua HR meninjau bersamaan, Dashboard HR tidak memuat shift malam yang masih berjalan.
- Kiosk: perangkat lama dikeluarkan tanpa merotasi remember token pemasangan baru.
- Notifikasi: akses dicek ulang sebelum notifikasi antrean dikirim, ringkasan harian diklaim atomik sekali per hari, hari libur dianggap hari tenang untuk email tertunda, pengingat tenggat tidak ganda, mention dinotifikasi sekali per komentar/deskripsi.
- Tugas: pindah status + ubah field dalam satu transaksi, pengingat terlambat dibereskan saat tugas dihapus/diarsipkan, event broadcast "tipis" (tanpa isi), 404 untuk non-penonton sebelum validasi.
- Proyek & dashboard: akses portofolio dicabut saat PIC/sponsor dilepas, snapshot burn-up memakai tanggal yang benar, keputusan proyek aman dari balapan, workspace terarsip tidak dihitung di metrik, "Fokus hari ini" dan "Minggu ini" disajikan langsung (tidak dari cache).
- Drive: batas mulai unggah per menit + batas unggahan tertunda per pengguna (pesan 429 berbahasa Indonesia), file Drive dicatat per workspace.
- Pencarian: tugas dicari dengan indeks full-text dan cuplikan deskripsi; akses lewat gate untuk karyawan aktif.

### Keamanan
- Scan QR tanpa GPS diberi flag `qr_no_location`; `ATTENDANCE_QR_REQUIRE_LOCATION=true` mewajibkan GPS.
- Kanal siaran absensi per perusahaan `company.{company}.attendance`, diotorisasi berdasarkan perusahaan penonton.
- Ekspor spreadsheet menulis teks mirip rumus sebagai teks biasa (cegah formula injection).
- Assertion service account Google hanya dikirim ke `oauth2.googleapis.com`.
- Akses Drive dicabut saat karyawan dinonaktifkan; reaksi komentar ikut limiter komentar.

## Sprint 10 — Platform, keamanan, privasi & kinerja

### Ditambahkan
- Header keamanan + **CSP dengan nonce** (`SecurityHeaders`, `config/security.php`), HSTS, Permissions-Policy, rate limiter bernama (`login`, `check-in`, `api`, dll.), cookie aman, mode strict model di luar produksi, endpoint `/health`.
- Image produksi FrankenPHP, `compose.prod.yml` (Caddy, app, Horizon, scheduler, Reverb, Postgres, Redis, backup), backup harian `pg_dump` + rclone ke S3 dengan skrip restore & uji pemulihan, workflow deploy GHCR → approval → SSH.
- Sentry opsional (`SENTRY_LARAVEL_DSN`, tanpa PII); Pulse & Horizon hanya Super Admin.
- **Privasi & data saya** (`/privasi`): lihat dan unduh (Excel/PDF) seluruh data pribadi, kebijakan privasi berversi dari Markdown (`/kebijakan-privasi`), cabut persetujuan lokasi/selfie memberi tahu HR.
- Uji regresi jumlah query untuk halaman utama (anti N+1), indeks kinerja, Lighthouse halaman Absensi ponsel 98.
- `docs/security/ASVS-L1.md`, README deploy VPS dari nol, serah terima (`docs/HANDOFF.md`).

### Diubah
- Mini-map lokasi tanpa Leaflet/tile, shell desktop & palet ⌘K dimuat terpisah, Reverb lokal lewat wss dengan sertifikat Herd.
- Mekanisme placeholder rute modul dihapus (semua modul Fase 1 sudah dibangun).

## Sprint 9 — Metrik, dashboard & portofolio proyek

### Ditambahkan
- Definisi metrik berbasis output dengan periode; **Dashboard Saya, Kepala Divisi, HR** dengan filter, cache, ekspor Excel; "Tandai ditinjau" & Koreksi di Dashboard HR.
- Pelacakan proyek: atribut proyek, milestone, risiko, update berkala, rumus progres, snapshot burn-up harian, pengingat update mingguan.
- **Dashboard Direksi `/portofolio`**, tab Ringkasan proyek, pengaturan proyek; seeder demo analitik (50 karyawan × 6 bulan).

## Sprint 8 — Notifikasi, Inbox & command palette

### Ditambahkan
- Infrastruktur notifikasi (`BaseNotification`, preferensi per kanal, "perlu tindakan", ringkasan harian), **Inbox** desktop & mobile, lonceng realtime.
- **Command palette ⌘K** + layar cari (provider Orang, Tugas, Workspace, Pengajuan), halaman pengaturan notifikasi, `docs/sprints/sprint-8/HOW-TO-NOTIFY.md`.

## Sprint 7 — Google Drive & Docs

### Ditambahkan
- Lapisan domain Google: klien Drive v3, service account + domain-wide delegation, job antrean dengan retry/backoff, tabel `google_accounts` (token terenkripsi), `php artisan ruangkerja:google-check`.
- Workspace tersambung ke Google Drive: folder per workspace, sinkron izin anggota, tab **File** & **Dokumen**, unggah bertahap (resumable) dengan progres, status akses Drive, Google Picker.
- Lampiran Drive di tugas & komentar (panel lampiran, aktivitas, broadcast).

## Sprint 6 — Detail tugas, komentar & realtime

### Ditambahkan
- Detail tugas (sheet + halaman penuh), editor Tiptap, komentar, mention, reaksi, checklist, watcher, timeline aktivitas.
- Realtime lewat Reverb/Echo (kanal workspace & tugas), saved view, pintasan keyboard, notifikasi tugas & tenggat.

## Sprint 5 — Workspace & Kanban

### Ditambahkan
- Workspace Pribadi (otomatis), Divisi (anggota tersinkron), Tim, dan Proyek; favorit, arsip, pengaturan, anggota.
- **Board Kanban** (dnd-kit, lexorank, optimistik + rollback, `Shift+←/→`), List (TanStack), Kalender, filter di query string, nomor tugas `KEY-n` atomik.
- **Tugas Saya** lintas workspace; `TaskLifecycle` (`status_category`, `started_at`, `completed_at`).

## Sprint 4 — Pengajuan & persetujuan

### Ditambahkan
- Jenis pengajuan & kuota, alur persetujuan bertingkat (atasan langsung, kepala divisi, peran, user) dengan kondisi, delegasi, nomor berurutan aman balapan (`CUT-2026-10-0001`).
- Form cuti, izin, sakit (lampiran privat), lembur, koreksi absensi, dinas luar; halaman Pengajuan Saya, Persetujuan (aksi massal), admin jenis & alur, saldo cuti + generator saldo tahunan dengan carry-over.
- Efek setelah disetujui: saldo pending → used, `attendance_days` ditulis (cuti tidak jadi alpha), lembur, koreksi.

### Diperbaiki (review 2/4/5)
- Satu orang paling banyak memutus satu langkah per putaran (termasuk sebagai delegasi), delegasi bebas siklus, tumpang tindih dicek ulang di bawah kunci per pengguna, koreksi absensi untuk shift malam, check-in tetap boleh saat cuti setengah hari/dinas.

## Sprint 3 — Kiosk QR, tinjauan HR, rekap & ekspor

### Ditambahkan
- Akun kiosk (guard `kiosk`) dengan tautan aktivasi sekali pakai; layar kiosk `/kiosk/{location}` dengan **QR dinamis HMAC** berganti tiap 30 detik; tab "Pindai QR" (`@zxing/browser`) di dialog check-in.
- Papan **Absensi hari ini** (realtime), tinjau log mencurigakan, **koreksi manual HR** (wajib alasan, diaudit), lihat selfie (URL bertanda tangan 5 menit, setiap akses diaudit).
- Rekap bulanan, **ekspor Excel/PDF** untuk gaji (`config/payroll_export.php`), Absensi Saya (kalender), retensi selfie bulanan.

## Sprint 2 — Absensi inti

### Ditambahkan
- Lokasi kantor (peta + radius geofence), shift (termasuk lintas tengah malam), penugasan shift mingguan + override, hari libur + impor CSV, `ScheduleResolver`.
- Persetujuan lokasi & selfie berversi sebelum check-in pertama; **check-in/out GPS + selfie** (JPEG ≤ 300 KB, disk privat), `FraudDetector` menandai tanpa memblokir.
- `attendance:close-day` 00.30 WIB (alpha/perlu koreksi), pengingat check-in, broadcast absensi, riwayat 30 hari.

## Sprint 1 — Organisasi, login & admin

### Ditambahkan
- Perusahaan, divisi, tim, jabatan, profil karyawan (NIK terenkripsi), scope `visibleTo`, hierarki atasan bebas siklus, permission per peran, `AuditLogger` + audit log append-only.
- **Login Google Workspace** (domain & `hd` dicek), login kata sandi khusus Super Admin dengan **TOTP wajib**, `ruangkerja:create-super-admin`.
- **Admin › Karyawan** (tabel, form, nonaktifkan/aktifkan, impor CSV/XLSX dengan pratinjau), **Admin › Organisasi** (divisi/tim/jabatan), **Struktur organisasi**, **Admin › Audit log**.

### Keamanan (review 0–1)
- Hanya Super Admin yang memberi peran super_admin/direksi/hr dan tidak ada yang bisa mengubah perannya sendiri; tautan reset sandi hanya untuk Super Admin dengan jawaban generik; sesi terikat hash sandi akun; cookie sesi aman bawaan; file impor (berisi NIK) tidak disimpan melewati sesinya; channel privat membandingkan ULID sebagai string.

## Sprint 0 — Fondasi

### Ditambahkan
- Laravel 13 + Inertia 3 + React 19 (TypeScript strict), Tailwind 4 + shadcn/ui, PostgreSQL 17 + Redis, **PK ULID**, Pest 4, Larastan level 8, Pint, Vite+ (oxlint + oxfmt).
- Shell desktop & mobile, token desain terang/gelap, tema per pengguna, login demo lokal, PWA, terjemahan Indonesia, CI, smoke visual Playwright.
