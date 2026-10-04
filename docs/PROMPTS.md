# Prompt Pengembangan — RuangKerja (Fase 1)

Prompt ini dipakai berurutan, **satu sprint per sesi**. Jangan menempel semuanya sekaligus. AI coding tool bekerja paling baik dengan tugas yang jelas batasnya dan bisa diuji.

## Cara pakai

### Claude Code
1. Siapkan laptop sesuai **`docs/SETUP-LOKAL.md`** (Windows + Herd + Docker + Chrome). Seluruh kit ini ada di root repo; Claude Code otomatis membaca `CLAUDE.md` dan `.claude/settings.json`.
2. Mulai di folder proyek dengan `claude --chrome`. Satu sesi per sprint: ketik **`/sprint <nomor>`**. Skill ini membaca blok prompt sprint di file ini, membuat rencana (setujui dulu), membangun versi desktop & mobile, menjalankan test, lalu mengecek tampilan di https://ruangkerja.test terhadap `docs/mockups/`. Bila ingin manual: masuk **Plan Mode** (`Shift+Tab` sampai mode plan), tempel prompt sprint di bawah.
3. Setelah selesai: cek manual di browser, jalankan **`/tinjau`** (atau Prompt Review di bagian akhir) di sesi baru, lalu commit/merge.

### Z-AI
- **Jika Z-AI dipakai lewat agent yang membaca repo** (CLI/IDE, termasuk Claude Code dengan model GLM): pastikan `AGENTS.md` ada di root. Pakai prompt sprint yang sama.
- **Jika lewat chat web tanpa akses repo:** tempel **Prompt 0 (Konteks)** di awal percakapan, lalu prompt sprint. Lampirkan isi `docs/DATABASE.md` bagian yang relevan. Minta keluaran per file lengkap dengan path-nya.
- Untuk tugas besar (sprint 2, 4, 5), lebih aman dikerjakan di agent yang bisa menjalankan test.

### Aturan umum untuk semua sprint
- Kerjakan **hanya** scope sprint tersebut.
- Setiap layar dibangun dalam **versi desktop dan mobile** sesuai `docs/PLATFORM.md` dan mockup canvas (halaman "Desktop ·" dan "Mobile ·"). Sprint belum selesai bila salah satunya belum ada.
- Akhiri dengan: ringkasan perubahan, cara uji manual, daftar keputusan, dan sisa pekerjaan.
- Semua test, lint, dan typecheck harus hijau.

---

## Prompt 0 — Konteks (untuk Z-AI chat / sesi tanpa akses repo)

```text
Anda adalah senior full-stack engineer (Laravel + React) yang membangun "RuangKerja", aplikasi kantor internal untuk puluhan karyawan. Modul Fase 1: absensi (GPS+geofence+selfie, QR dinamis, WFH, shift, libur), pengajuan cuti/izin/sakit/lembur/koreksi dengan approval bertingkat, workspace (pribadi/tim/divisi/proyek), task Kanban dengan komentar & mention realtime, integrasi Google Drive/Docs (Shared Drive), notifikasi in-app & email, dan dashboard monitoring berbasis output (tanpa skor produktivitas gabungan, tanpa pelacakan aktivitas/screenshot).

Stack wajib: PHP 8.4, Laravel 13, PostgreSQL 17, Redis, Inertia.js 3, React 19 + TypeScript strict, Tailwind CSS 4, shadcn/ui, Lucide, Laravel Reverb, Horizon, Pest, Larastan, Pint. PK memakai ULID. Waktu disimpan UTC, zona kantor Asia/Jakarta. UI 100% Bahasa Indonesia, kode dalam bahasa Inggris.

Arsitektur: monolit modular. Logika bisnis di app/Domain/<Modul>/Actions, controller tipis (FormRequest → Policy → Action → Inertia). Semua endpoint wajib Policy. Panggilan Google API di job antrean dengan retry.

Peran global (spatie/laravel-permission, bisa bertumpuk): super_admin, direksi, hr, kepala_divisi, anggota. Struktur: Perusahaan → Direksi → Divisi → Tim → Anggota, setiap user punya manager_id (atasan langsung = penyetuju pertama).

Desain: minimal profesional ala Linear, glassmorphism tipis hanya untuk lapisan mengambang (sidebar, topbar, command palette, modal, toast), warna teal/hijau-biru (primer #0A7C85 terang, #2FC0B0 gelap), font Plus Jakarta Sans + JetBrains Mono, mode terang & gelap. Warna hanya lewat CSS variable token.

Platform: satu aplikasi web (PWA) dengan dua shell. Desktop ≥ 1024px: sidebar 240px + topbar; tablet 768–1023px: rail 56px; mobile < 768px: app bar 56px + tab bawah (Beranda · Absen · Tugas · Inbox · Menu), panel detail menjadi layar penuh/bottom sheet, tabel menjadi daftar kartu, board satu kolom per layar, input 16px, target sentuh ≥ 44px. Admin (alur persetujuan, lokasi/shift, impor, audit) hanya desktop; di mobile tampilkan banner "Tersedia di desktop".

Saat menulis kode: berikan file lengkap dengan path, sertakan migration, model, policy, action, controller, route, halaman React, dan test Pest. Jangan mengarang fitur di luar scope yang saya minta. Jika ada yang ambigu, tanyakan dulu.
```

---

## Sprint 0 — Fondasi proyek

```text
Baca AGENTS.md, docs/ARCHITECTURE.md, docs/PLATFORM.md, docs/SETUP-LOKAL.md, dan docs/mockups/INDEX.md (lihat PNG Main, MBeranda, MMenu).

Tugas: siapkan fondasi proyek RuangKerja. Lingkungan: Windows + Laravel Herd (PHP 8.4, Node 22) di https://ruangkerja.test, layanan Postgres/Redis/Mailpit dari compose.yml yang SUDAH ADA di repo (jalankan `docker compose up -d` bila belum).

0. Repo ini SUDAH berisi dokumen & konfigurasi (AGENTS.md, CLAUDE.md, README.md, docs/, .claude/, compose.yml, docker/, scripts/, .env.example, .gitignore, .gitattributes, .editorconfig, resources/css/tokens.css). Buat kerangka Laravel 13 + starter kit React (Inertia + TypeScript) di folder sementara DI LUAR repo (mis. `composer create-project laravel/react-starter-kit ../_rk_scaffold`), lalu salin isinya ke root repo TANPA menimpa file di atas. Untuk .env.example, .gitignore, .gitattributes, .editorconfig, README.md: gabungkan, versi repo menang bila bentrok. Hapus folder sementara. Commit: "chore: kerangka Laravel 13 + React".
1. `copy .env.example .env` bila belum ada (jangan membaca/menampilkan isinya), `php artisan key:generate`, `composer require predis/predis`. TypeScript strict.
2. Konfigurasi PostgreSQL (DB `ruangkerja`, test memakai `ruangkerja_testing` di phpunit.xml) dan Redis (cache, session, queue). `php artisan migrate` harus berhasil.
3. Pasang & konfigurasi: laravel/reverb, laravel/horizon (hanya dipakai di server Linux; jangan dijalankan di Windows), laravel/pulse, laravel/socialite, spatie/laravel-permission, pestphp/pest, larastan/larastan (level 8), laravel/pint. Frontend: tailwindcss 4, shadcn/ui, lucide-react, @tanstack/react-table, @dnd-kit/core, @dnd-kit/sortable, cmdk, sonner, date-fns (locale id), @fontsource/plus-jakarta-sans, @fontsource/jetbrains-mono.
4. Terapkan design token dari resources/css/tokens.css ke Tailwind 4 (@theme) dan shadcn/ui. Kelas `.dark` di <html>, toggle tema (system/light/dark) disimpan di cookie + kolom users.theme. Font di-self-host (@fontsource).
5. Buat shell sesuai docs/PLATFORM.md §2 & §5 dan mockup `Main` (sidebar penuh) serta `MBeranda`/`MMenu` (mobile): `AppLayout` memilih `DesktopLayout` (sidebar glass 240px bisa diciutkan → rail 56px; otomatis rail di 768–1023px; topbar glass dengan breadcrumb, tombol cari ⌘K, tombol check-in, lonceng) atau `MobileLayout` (< 768px: app bar 56px dengan judul/kembali/aksi + tab bawah glass Beranda · Absen · Tugas · Inbox · Menu, safe-area, sembunyi saat keyboard terbuka) lewat hook `useBreakpoint()` yang aman untuk SSR. Komponen mobile dasar: `BottomSheet`, `SwipeableRow`, `Fab`, `ChipScroller`. Halaman placeholder "Menu" untuk mobile. Latar mode gelap dengan dua cahaya radial tipis. PWA manifest + ikon.
6. Helper resources/js/lib/format.ts: formatDate, formatTime ("08.05"), formatRelative ("2 jam lalu"), formatNumber ("1.250"), semua id-ID & Asia/Jakarta. Dengan test Vitest.
7. config/branding.php (nama aplikasi, logo, warna) dan config('app.office_timezone').
8. Struktur folder app/Domain/* kosong sesuai ARCHITECTURE.md §2.
9. Script composer: `dev:win` (Windows + Herd: `npx concurrently` untuk `npm run dev`, `php artisan reverb:start --port=8080`, `php artisan queue:work --tries=3`, `php artisan schedule:work`; TANPA `php artisan serve` karena disajikan Herd, TANPA `pail`), `dev` (Linux/CI: dengan serve + horizon), `test`, `lint`. Script npm: dev, build, typecheck, lint. Vite: pastikan aset dimuat di https://ruangkerja.test (deteksi sertifikat Herd / `detectTls`).
10. Auth bawaan starter kit boleh tetap sementara, tetapi matikan registrasi publik. Sediakan login demo HANYA bila `APP_ENV=local` dan `DEMO_LOGIN_ENABLED=true`: tombol per akun admin@/direksi@/hr@/kadiv@/anggota@demo.test (seeder minimal user demo, sandi `password`). Sprint 1 akan menggantinya dengan Google.
11. GitHub Actions: lint + test (service postgres & redis), runner ubuntu.
12. Halaman /dashboard sementara dengan empty state berbahasa Indonesia, memakai shell desktop & mobile.
13. Verifikasi: jalankan skill `cek-lokal`, lalu `cek-ui /dashboard` (1440 & 390, terang & gelap) di Chrome terhadap mockup `Main` dan `MBeranda` (bentuk shell, bukan isi).

Acceptance criteria:
- `docker compose up -d` + `composer run dev:win` → https://ruangkerja.test tampil benar di terang & gelap, desktop (sidebar & rail) dan 390px (app bar + tab bawah). Tidak ada error di console.
- `composer test`, `composer lint`, `npm run typecheck`, `npm run lint` hijau.
- Tidak ada warna hex hard-coded di komponen.
- Dokumen & konfigurasi repo (docs/, .claude/, AGENTS.md, CLAUDE.md, compose.yml) utuh, tidak tertimpa.

Di luar scope: login Google, model domain, fitur apa pun.
```

## Sprint 1 — Autentikasi & organisasi

```text
Baca AGENTS.md, docs/PRD.md §3 & M1, docs/DATABASE.md §1.

Tugas:
1. Migration + model + factory: companies, divisions, teams, positions, users (sesuai DATABASE.md), employee_profiles, audit_logs. Peran spatie: super_admin, direksi, hr, kepala_divisi, anggota beserta permission dasar.
2. Login Google via Socialite:
   - Tolak bila domain email ≠ companies.google_domain (cek klaim `hd` DAN akhiran email di server).
   - Tolak bila email belum terdaftar sebagai user aktif ("Akun Anda belum didaftarkan HR").
   - Simpan google_id, avatar, last_login_at.
   - Login email+password hanya untuk super_admin dengan 2FA TOTP wajib.
   - Di APP_ENV=local, sediakan login demo tanpa Google.
3. Middleware EnsureActiveEmployee (user nonaktif langsung logout).
4. Modul Admin › Karyawan (HR & Super Admin): tabel (TanStack) dengan cari, filter divisi/peran/status; form tambah/ubah (divisi, tim, jabatan, atasan, mode kerja, peran, tanggal bergabung); nonaktifkan; impor CSV/XLSX dengan pratinjau & laporan galat per baris.
5. Admin › Divisi, Tim, Jabatan: CRUD. Divisi punya code (unik, huruf besar, maks 10) dan is_board.
6. Halaman Struktur Organisasi: bagan pohon dari Direksi → Divisi → Tim → anggota, berdasarkan data.
7. Audit log otomatis untuk create/update/delete users, divisions, roles. Halaman Admin › Audit Log (Super Admin) dengan filter.
8. Seeder demo: 1 perusahaan, divisi Direksi + 4 divisi (Keuangan, Operasional, Pemasaran, SDM), 20 karyawan dengan atasan yang konsisten, satu akun per peran.

Acceptance criteria:
- Test: login domain salah ditolak; email tak terdaftar ditolak; user nonaktif tidak bisa masuk; anggota tidak bisa membuka admin (403); HR bisa CRUD karyawan; impor CSV dengan baris salah melaporkan nomor baris.
- Tidak bisa membuat siklus atasan (A atasan B, B atasan A). Divalidasi.
- Semua label UI Bahasa Indonesia.

Di luar scope: absensi, workspace.
```

## Sprint 2 — Absensi inti (jadwal, check-in GPS + selfie, tutup hari)

```text
Baca AGENTS.md, docs/PRD.md M2, docs/DATABASE.md §2, docs/ARCHITECTURE.md §3.1 & §3.3.

Tugas:
1. Migration + model: office_locations, shifts, shift_assignments, holidays, attendance_days, attendance_logs, attendance_consents. Enum AttendanceStatus, AttendanceMethod, LogFlag dengan label Indonesia.
2. Admin (HR): CRUD lokasi kantor dengan peta (Leaflet + OpenStreetMap) untuk memilih titik & radius; CRUD shift; penugasan shift (pola mingguan + override tanggal, bisa massal per divisi); hari libur (CRUD + impor CSV).
3. ScheduleResolver: untuk (user, waktu) mengembalikan work_date, shift, jadwal mulai/selesai, termasuk shift lintas tengah malam dan hari libur. Unit test lengkap.
4. Layar persetujuan (lokasi & selfie) sebelum check-in pertama, versi kebijakan dari config. Tanpa persetujuan, check-in ditolak.
5. Halaman Absensi (prioritas ponsel):
   - Kartu check-in: jam sekarang (mono, besar), jadwal hari ini, status, tombol 44px "Check-in"/"Check-out".
   - Dialog check-in: minta lokasi (enableHighAccuracy, timeout 15 dtk) + kamera depan, pratinjau selfie, kompres JPEG ≤ 300 KB di klien, kirim.
   - Riwayat 30 hari dengan badge status.
6. Action CheckIn/CheckOut sesuai ARCHITECTURE.md §3.1: geofence haversine, aturan per work_mode, FraudDetector (akurasi > 100 m, client_time selisih > 5 menit, perangkat/IP baru, perpindahan tak mungkin > 150 km/jam antar log) → flags + is_suspicious, tidak memblokir. Selfie ke disk privat (s3 di prod, local di dev).
7. Pesan galat informatif, mis. "Anda berada 340 m dari Kantor Pusat (batas 100 m)."
8. Command attendance:close-day (dijadwalkan 00:30 Asia/Jakarta), idempoten: alpha untuk yang terjadwal tanpa log & tanpa pengajuan disetujui; needs_correction bila lupa check-out.
9. Pengingat: notifikasi database 15 menit setelah jam masuk bila belum check-in (job terjadwal per 5 menit).
10. Broadcast AttendanceRecorded ke channel private `company.attendance` (HR, Direksi) dan `division.{id}.attendance` (Kadiv).

Acceptance criteria (test Pest dengan travelTo):
- Tepat waktu, terlambat (melewati toleransi), pulang cepat, shift malam lintas hari, hari libur, di luar radius (ditolak untuk office, diterima sebagai wfh untuk wfh/field), check-in ganda ditolak, check-out tanpa check-in ditolak, close-day idempoten.
- Selfie tidak bisa diakses tanpa URL bertanda tangan.

Di luar scope: QR, pengajuan, rekap/ekspor, face recognition.
```

## Sprint 3 — QR dinamis, tinjauan HR, rekap & ekspor

```text
Baca AGENTS.md, docs/PRD.md M2, docs/ARCHITECTURE.md §3.2.

Tugas:
1. Akun & halaman kiosk /kiosk/{location}: layar penuh, QR berganti tiap 30 detik (HMAC(ATTENDANCE_QR_SECRET, location_id|window)), jam besar, nama lokasi, tanpa navigasi. Akun kiosk hanya bisa membuka halaman ini.
2. Di dialog check-in: tab "Pindai QR" memakai kamera (pustaka @zxing/browser atau html5-qrcode). Validasi HMAC & jendela ±1 di server, method = qr, GPS tetap direkam bila diizinkan.
3. Halaman HR › Absensi Hari Ini: siapa hadir/terlambat/belum/cuti per divisi, realtime via Echo; filter; panel log mencurigakan dengan tombol "Tandai sudah ditinjau".
4. Melihat selfie: hanya HR & atasan langsung (permission attendance.view_selfie), URL bertanda tangan 5 menit, setiap akses masuk audit_logs.
5. Koreksi manual oleh HR (method manual, wajib alasan, audit).
6. Rekap bulanan per karyawan (hari kerja, hadir, terlambat kali & menit, alpha, cuti, izin, sakit, dinas, lembur jam). Ekspor Excel (maatwebsite/excel) & PDF (dompdf). Format kolom dapat diatur di config/payroll_export.php.
7. Halaman "Absensi Saya" menampilkan rekap pribadi per bulan.
8. Job bulanan: hapus selfie lebih lama dari ATTENDANCE_SELFIE_RETENTION_MONTHS.

Acceptance criteria:
- Test: QR kedaluwarsa ditolak, HMAC palsu ditolak, kiosk tidak bisa membuka halaman lain, Kadiv tidak bisa melihat selfie divisi lain, akses selfie tercatat, angka rekap cocok dengan data uji.

Di luar scope: pengajuan & approval.
```

## Sprint 4 — Pengajuan & approval

```text
Baca AGENTS.md, docs/PRD.md M2 (Pengajuan & approval), docs/DATABASE.md §3, docs/ARCHITECTURE.md §3.4.

Tugas:
1. Migration + model: leave_types, leave_balances, requests, approval_flows, approval_flow_steps, request_approvals, approval_delegations.
2. Admin (HR): CRUD jenis pengajuan & kuota; CRUD alur approval dengan langkah (direct_manager, division_head, role, user) dan kondisi jsonb (contoh: lembur bulanan > 40 jam → tambah langkah Direksi). Seed alur default: Atasan langsung → HR.
3. Generator saldo cuti tahunan (command + otomatis 1 Januari), dengan carry-over sesuai jenis.
4. Form pengajuan per kategori: cuti (rentang tanggal, setengah hari bila diizinkan, hitung hari kerja tanpa libur/akhir pekan sesuai jadwal), izin (jam), sakit (lampiran wajib bila > N hari, disimpan di disk privat), lembur (tanggal + jam mulai/selesai), koreksi absensi (tanggal + jam yang diminta), dinas luar. Tampilkan sisa saldo dan validasi tumpang tindih.
5. Nomor pengajuan berurutan (CUT-2026-10-0001), aman dari race condition.
6. ApprovalFlowResolver + ApproveStep/RejectStep/RequestRevision sesuai ARCHITECTURE.md §3.4, termasuk delegasi dan lompat langkah bila penyetuju = pemohon.
7. Efek setelah disetujui: kurangi saldo (pending → used), tulis attendance_days, overtime_minutes, atau terapkan koreksi. Pembatalan oleh pemohon sebelum diputus mengembalikan pending.
8. Halaman: "Pengajuan Saya" (daftar + detail dengan timeline langkah), "Persetujuan" (antrean penyetuju, aksi massal setuju), detail dengan lampiran.
9. Notifikasi database + email di setiap langkah.

Acceptance criteria (test):
- Alur 2 langkah lengkap; tolak di langkah 1 menghentikan alur; kondisi lembur menambah langkah Direksi; delegasi aktif mengarahkan ke delegate; pemohon tidak bisa menyetujui diri sendiri; saldo tidak bisa minus; pengajuan tumpang tindih ditolak; cuti yang disetujui membuat close-day tidak menandai alpha.

Di luar scope: notifikasi WhatsApp.
```

## Sprint 5 — Workspace & board Kanban

```text
Baca AGENTS.md, docs/PRD.md M3 & M4, docs/DATABASE.md §4, docs/DESIGN.md §6.

Tugas:
1. Migration + model: workspaces, workspace_members, task_statuses, labels, tasks, task_assignees, task_labels, task_watchers, checklist_items, activities.
2. Workspace pribadi otomatis untuk setiap user; workspace divisi otomatis saat divisi dibuat dan anggotanya tersinkron (SyncDivisionMembers dijalankan saat user pindah divisi). Workspace tim dan proyek dibuat manual.
3. WorkspacePolicy sesuai ARCHITECTURE.md §4 (workspace pribadi hanya pemilik, termasuk terhadap Super Admin). Test matriks peran.
4. Sidebar: daftar workspace yang bisa diakses, dikelompokkan (Pribadi, Divisi, Tim, Proyek), bisa diciutkan, urutan favorit.
5. Halaman workspace dengan tab: Tugas, Dokumen (placeholder), File (placeholder), Aktivitas, Pengaturan (anggota & peran, status/kolom, label, key).
6. Task:
   - Buat cepat (tombol + di kolom, pintasan C) dan form lengkap.
   - Nomor KEY-n dengan increment atomik.
   - Tampilan Board (dnd-kit, lexorank, optimistic update, rollback bila gagal), List (TanStack Table, grup per status, sortir & filter), Kalender (bulan, berdasarkan due_date).
   - Filter: penanggung jawab, prioritas, label, tenggat (terlambat/hari ini/minggu ini), teks.
   - status_category tersinkron saat status berubah; started_at & completed_at terisi otomatis.
7. Halaman "Tugas Saya" lintas workspace (dikelompokkan: Terlambat, Hari ini, Minggu ini, Nanti, Tanpa tenggat).
8. Kartu & ikon status/prioritas persis seperti docs/DESIGN.md §2 & §6.
9. Activities ditulis untuk create, status berubah, assign, tenggat berubah.

Acceptance criteria:
- Board 500 task tetap lancar (virtualisasi kolom bila perlu).
- Test: nomor unik di bawah konkurensi, pindah kartu memperbarui status_category & completed_at, anggota viewer tidak bisa mengubah, non-anggota workspace private mendapat 404, sinkron anggota divisi.

Di luar scope: komentar, mention, realtime, Drive.
```

## Sprint 6 — Detail task, komentar, mention, realtime

```text
Baca AGENTS.md, docs/PRD.md M4, docs/ARCHITECTURE.md §3.5.

Tugas:
1. TaskSheet (panel kanan 640px, bisa dibuka layar penuh, URL /w/{key}/tasks/{number}): judul inline-edit, deskripsi editor Tiptap (heading, list, checklist, code, tautan, mention @orang, rujukan #KEY-n), properti di kolom kanan, sub-task, checklist, aktivitas + komentar dalam satu timeline.
2. Migration + model: comments, mentions, reactions, saved_views.
3. Komentar Tiptap dengan mention & reaksi emoji; edit (tandai "diedit") & hapus (soft). MentionParser mengambil node mention → mentions → notifikasi. Penulis komentar otomatis jadi watcher.
4. Realtime dengan Reverb + Echo: channel private workspace.{id}. Event TaskCreated, TaskUpdated, TaskMoved, CommentPosted. Board/list/sheet memperbarui diri tanpa reload. Indikator "X sedang melihat tugas ini" (presence channel).
5. Saved views: simpan filter + layout, pribadi atau dibagikan ke workspace.
6. Pintasan keyboard ala Linear di board/list: J/K navigasi, Enter buka, C buat, A assign ke saya, S ubah status, P prioritas, D tenggat, Shift+←/→ pindah kolom, ? daftar pintasan.
7. Fallback polling 30 detik bila WebSocket putus, dengan indikator koneksi kecil.

Acceptance criteria:
- Dua browser dengan user berbeda melihat perubahan < 1 detik.
- Test: mention membuat notifikasi untuk user yang punya akses saja (mention orang di luar workspace private tidak membocorkan isi), otorisasi channel broadcast, hapus komentar oleh bukan penulis ditolak (kecuali admin workspace).

Di luar scope: Drive, chat.
```

## Sprint 7 — Integrasi Google Drive & Docs

```text
Baca AGENTS.md, docs/PRD.md M5, docs/DATABASE.md §5, docs/ARCHITECTURE.md §3.6, README bagian "Menyiapkan Google Workspace".

Tugas:
1. GoogleClientFactory: (a) service account dengan domain-wide delegation, impersonasi GOOGLE_IMPERSONATE_USER; (b) klien per user dari google_accounts (token terenkripsi, refresh otomatis). Minta scope drive.file saat login (incremental auth bila belum).
2. Command ruangkerja:google-check: uji akses Shared Drive & tampilkan diagnosa yang jelas.
3. Job CreateDriveFolder saat workspace (selain pribadi) dibuat → folder "<Nama Workspace> [KEY]" di Shared Drive → simpan drive_folder_id. Workspace pribadi: folder dibuat saat pertama kali dipakai.
4. Job SyncDrivePermissions saat anggota berubah: owner/admin/member → writer, viewer → reader; cabut izin anggota yang keluar. Idempoten, backoff eksponensial, tangani 403 rate limit & 404.
5. Tab File: daftar isi folder (cache drive_files, sinkron saat dibuka bila > 5 menit), unggah (resumable, maks 100 MB), buat folder, buka di Drive, pratinjau iframe /preview.
6. Tab Dokumen: daftar Docs/Sheets/Slides milik workspace + tombol "Dokumen baru" (pilih jenis, beri nama) → dibuat di folder workspace → buka.
7. Lampiran di task & komentar: "Unggah", "Pilih dari Drive" (Google Picker dengan token user & API key), "Dokumen baru". Simpan attachments.
8. Penanganan galat ramah: token kedaluwarsa → minta hubungkan ulang; Drive tidak terkonfigurasi → pesan untuk admin.

Acceptance criteria:
- Semua test memakai fake Google client, tanpa panggilan nyata.
- Test: anggota baru mendapat izin; anggota dikeluarkan kehilangan izin; job aman diulang; user tanpa akses workspace tidak bisa melihat metadata file.

Di luar scope: Google Calendar (Fase 2).
```

## Sprint 8 — Notifikasi, Inbox, command palette

```text
Baca AGENTS.md, docs/PRD.md M6 & M9.

Tugas:
1. Kelas Notification untuk: ditugaskan, disebut, komentar di task yang diamati, tenggat H-1, tenggat terlewat, pengajuan baru (penyetuju), pengajuan diputus (pemohon), lupa check-in, lupa check-out. Kanal database + mail (+ broadcast untuk lonceng realtime). via() membaca notification_preferences dengan default dari config/notifications.php.
2. Antarmuka NotificationChannel untuk WhatsApp (kelas kosong WhatsAppChannel + interface WhatsAppProvider), belum aktif. Fase 2 tinggal mengimplementasikan provider.
3. Halaman Inbox: daftar notifikasi + "Perlu tindakan" (persetujuan menunggu, task terlambat saya), tandai dibaca, arsipkan, filter.
4. Lonceng di topbar dengan jumlah belum dibaca (realtime).
5. Pengaturan › Notifikasi: matriks kejadian × kanal.
6. Ringkasan harian email 07.30 Asia/Jakarta: tenggat hari ini, terlambat, persetujuan menunggu. Tidak dikirim bila kosong. Template email bermerek, Bahasa Indonesia.
7. Command palette (cmdk, ⌘K/Ctrl+K, glass): aksi (Check-in, Ajukan cuti, Tugas baru, Ganti tema), cari tugas (full-text search_vector), orang, workspace, dokumen. Hasil menghormati otorisasi.
8. Tenggat: job harian untuk H-1 dan terlewat, tanpa duplikat.

Acceptance criteria:
- Test: preferensi email off → tidak terkirim; ringkasan kosong tidak terkirim; palette tidak menampilkan task dari workspace tanpa akses.
```

## Sprint 9 — Dashboard monitoring

```text
Baca AGENTS.md, docs/PRD.md M7 & M10, docs/DATABASE.md §4 (kolom proyek, milestones, project_updates, project_risks, project_progress_snapshots) & §10, docs/PLATFORM.md.

Tugas:
1. app/Domain/Analytics/MetricDefinitions: satu kelas per metrik (tingkat penyelesaian, ketepatan waktu, task terlambat, beban kerja, lead time median, kedisiplinan hadir, rata-rata terlambat) dengan rumus persis seperti PRD. Unit test dengan data sintetis yang hasilnya dihitung manual.
2. DashboardQueries dengan cakupan sesuai peran (scope visibleTo). Cache Redis 5 menit per (peran, filter).
3. Dashboard Saya, Kepala Divisi, HR sesuai PRD M7. Pengguna dengan beberapa peran mendapat pemilih tampilan dashboard.
3b. Proyek & portofolio (PRD M10): migration kolom proyek + milestones, milestone_tasks, project_updates, project_risks, project_progress_snapshots; form atribut proyek di pengaturan workspace proyek; CRUD milestone & risiko (PIC/admin); form "Update proyek" (status kesehatan, ringkasan, hambatan, keputusan dibutuhkan) + pengingat Jumat 15.00; job snapshot harian 23.55; aksi Direksi "Minta update", "Beri arahan", "Tandai keputusan selesai".
3c. Dashboard Direksi = PORTOFOLIO PROYEK sesuai mockup DashboardDireksi & MDashboardDireksi: KPI portofolio, tabel proyek (status PIC + penanda sistem, bar progres aktual dengan penanda rencana, milestone berikutnya, target, terlambat, umur update), roadmap Agu–Des dengan garis hari ini & milestone, "Butuh keputusan Anda", feed update PIC, dan HANYA satu widget absensi kecil yang menaut ke Dashboard HR. Halaman detail proyek (tab Ringkasan) sesuai mockup ProyekDetail & MProyekDetail, termasuk burn-up dari project_progress_snapshots.
4. Komponen: StatCard (angka tnum + delta vs periode lalu), grafik tren (Recharts) 8 minggu, tabel beban kerja per orang (bar horizontal), daftar task terlambat, kehadiran hari ini (donut + daftar), workspace proyek berisiko.
5. Filter periode (minggu ini, bulan ini, kuartal, kustom), divisi, tim. Simpan di URL query.
6. Ekspor tampilan dashboard ke Excel.
7. Tidak ada "skor produktivitas" gabungan. Setiap metrik punya tooltip definisi.

Acceptance criteria:
- Test: Kadiv hanya melihat divisinya; angka dashboard = hasil rumus pada data uji; delta periode lalu benar.
- Test proyek: progres aktual & rencana sesuai rumus (termasuk batas 0–100% dan bobot estimasi); penanda sistem muncul tepat pada selisih ≤ −15 poin, milestone terlewat, update > 7 hari; hanya PIC/admin yang bisa menulis update; Direksi melihat semua proyek, Kadiv hanya proyek yang melibatkan divisinya.
- Dashboard memuat < 1 detik dengan seed 50 karyawan × 6 bulan data.
```

## Sprint 10 — Pengerasan, privasi, deploy

```text
Baca AGENTS.md, docs/ARCHITECTURE.md §5 & §6, docs/PRD.md §8.

Tugas:
1. Keamanan: rate limit (login 10/menit/IP, check-in 6/menit/user), header keamanan & CSP (izinkan domain Google yang dibutuhkan), Permissions-Policy, cookie secure. Audit dengan checklist OWASP ASVS L1, laporkan temuan.
2. Privasi: halaman "Data Saya" (lihat & ekspor data absensi pribadi, riwayat persetujuan), kebijakan privasi versi, pencabutan persetujuan (menonaktifkan check-in GPS/selfie dan memberi tahu HR).
3. Kinerja: cek N+1 (preventLazyLoading di non-prod), indeks sesuai DATABASE.md, Lighthouse ≥ 90 untuk halaman Absensi di ponsel. Jadikan aplikasi PWA (manifest, ikon, service worker untuk shell saja).
4. Docker produksi: Dockerfile multi-stage, compose.prod.yml (caddy, app, queue/horizon, scheduler, reverb, postgres, redis, backup) sesuai ARCHITECTURE.md §6. Caddyfile dengan proxy WebSocket Reverb.
5. Backup: kontainer backup pg_dump harian 02.00 ke object storage S3-compatible, retensi 30 hari, script restore + dokumentasi uji pemulihan.
6. GitHub Actions deploy: build image → GHCR → SSH deploy dengan approval manual → migrate → horizon:terminate.
7. Observabilitas: Pulse, Horizon dashboard (hanya super_admin), integrasi Sentry (opsional via env), endpoint /up untuk uptime monitor.
8. Perbarui README & docs dengan langkah deploy aktual.

Acceptance criteria:
- Deploy bersih ke VPS staging dari nol mengikuti README.
- Restore dari backup berhasil dan diverifikasi.
- Semua test hijau, tidak ada temuan keamanan tingkat tinggi terbuka.
```

---

## Prompt pendukung

### Prompt Review (jalankan setelah setiap sprint, idealnya di sesi baru)

```text
Anda reviewer senior. Tinjau perubahan pada branch ini terhadap main (git diff main...HEAD) berdasarkan AGENTS.md dan docs/.

Periksa dan laporkan per kategori, urut dari paling berat:
1. Keamanan & otorisasi: endpoint/channel tanpa Policy, kebocoran data lintas divisi/workspace, data sensitif di log.
2. Kebenaran logika: zona waktu, batas tanggal, race condition, transaksi, idempotensi job.
3. Kesesuaian dengan PRD/DATABASE (nama kolom, aturan bisnis, scope fase).
4. Test yang hilang untuk alur kritis.
5. UI: teks non-Indonesia, warna hard-coded, mode gelap, empty/loading/error state, aksesibilitas.
6. Kinerja: N+1, query tanpa indeks.

Untuk setiap temuan: file:baris, masalah, skenario gagal konkret, saran perbaikan. Jangan mengubah kode. Jangan melaporkan selera gaya yang sudah ditangani Pint/ESLint.
```

### Prompt perbaikan bug

```text
Bug: <deskripsi singkat>
Langkah reproduksi: <1, 2, 3>
Yang diharapkan: <...>
Yang terjadi: <... + pesan galat/log>

Tugas: tulis dulu test yang gagal untuk bug ini, temukan akar masalahnya (jelaskan singkat), perbaiki dengan perubahan sekecil mungkin, pastikan seluruh test hijau. Jangan mengubah perilaku lain.
```

### Prompt mengganti branding (setelah nama, logo & warna SPKD tersedia)

```text
Ganti branding RuangKerja:
- Nama produk: <NAMA>
- Logo: <path file SVG> (versi terang & gelap)
- Warna resmi: primer <#HEX>, sekunder <#HEX>, aksen <#HEX>

Turunkan skala --brand-50…700 dari warna primer, sesuaikan nilai mode gelap, perbarui resources/css/tokens.css, config/branding.php, favicon & ikon PWA, template email, dan docs/DESIGN.md. Cek kontras WCAG AA untuk teks dan tombol di kedua mode dan laporkan rasionya. Ganti semua teks "RuangKerja" di UI.
```

---

## Fase 2 & 3 (garis besar prompt, ditulis rinci saat Fase 1 selesai)

| Sprint | Isi |
|---|---|
| F2-1 | Chat: channels, channel_members, messages, thread, mention, lampiran Drive, status baca, pencarian |
| F2-2 | Catatan realtime: Tiptap + Yjs + Hocuspocus (auth token Laravel), riwayat versi |
| F2-3 | Google Calendar & Meet: sinkron tenggat & cuti, buat rapat dengan tautan Meet |
| F2-4 | WhatsApp provider (setelah provider diputuskan), task berulang, template, otomasi sederhana |
| F3-1 | API Sanctum + aplikasi Expo (absensi, Inbox, tugas) |
| F3-2 | Anti fake-GPS, Play Integrity, face recognition + liveness dengan persetujuan |
| F3-3 | Endpoint ADMS mesin fingerprint ZKTeco, OKR divisi |
