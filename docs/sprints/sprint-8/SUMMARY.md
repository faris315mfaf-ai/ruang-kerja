# Sprint 8 — Ringkasan: Notifikasi, Inbox, command palette (infrastruktur)

Cabang `feat/sprint-8-notifikasi`. Modul domain (absensi, pengajuan, workspace, tugas) dibangun paralel oleh agent lain, jadi Sprint 8 dikirim sebagai **infrastruktur generik + titik ekstensi**, didemokan dengan notifikasi bawaan (pengumuman sistem, notifikasi uji) dan data demo Inbox. Panduan modul: [`HOW-TO-NOTIFY.md`](HOW-TO-NOTIFY.md) (termasuk bagian Pencarian). Rencana: [`PLAN.md`](PLAN.md).

## Acceptance criteria (PROMPTS.md Sprint 8 + brief)

| # | Kriteria | Status |
|---|---|---|
| 1 | Kelas notifikasi untuk ditugaskan, disebut, komentar, tenggat H-1/terlewat, pengajuan baru/diputus, lupa check-in/out; kanal database + mail + broadcast; `via()` membaca `notification_preferences` dengan default `config/notifications.php` | ✓ infrastruktur: registry `NotificationType`/`NotificationEvent` mencakup semua kejadian, `BaseNotification` dengan `via()` lengkap. ✗ kelas konkret per modul belum ada (modelnya belum ada di cabang ini) — modul menulis ±20 baris per kelas sesuai HOW-TO |
| 2 | Antarmuka WhatsApp (`WhatsAppChannel` + `WhatsAppProvider`), belum aktif | ✓ `NullWhatsAppProvider`, flag `NOTIFICATIONS_WHATSAPP_ENABLED`, kolom "Segera hadir" di matriks |
| 3 | Inbox: daftar + "Perlu tindakan", tandai dibaca, arsip, filter | ✓ desktop (daftar + detail, J/K/E/U/Enter) & mobile (geser Dibaca/Arsipkan, filter di bottom sheet); tab Semua/Belum dibaca/Perlu tindakan; filter Disebut/Tugas/Pengajuan/Absensi/Sistem + Arsip; tandai semua dibaca; infinite scroll |
| 4 | Lonceng topbar dengan jumlah belum dibaca (realtime) | ✓ shared prop `inbox.unread` (indeks parsial) di lonceng topbar, app bar mobile, sidebar Inbox, tab Inbox; realtime Echo + fallback polling 30 dtk; toast glass |
| 5 | Pengaturan › Notifikasi: matriks kejadian × kanal | ✓ matriks (desktop), accordion (mobile), simpan otomatis, kanal terkunci, jam tenang, tahan saat cuti, tema, kirim notifikasi uji |
| 6 | Ringkasan harian 07.30 Asia/Jakarta, tidak dikirim bila kosong, email bermerek | ✓ jam per pengguna (kelipatan 5 menit), hari kerja, idempoten, catch-up 60 mnt, registry seksi; seksi bawaan "Perlu tindakan di Inbox". Seksi tenggat/terlambat/persetujuan ditambahkan modul Tugas & Pengajuan |
| 7 | Command palette ⌘K/Ctrl+K (cmdk, glass): aksi, tugas, orang, workspace, dokumen; hormati otorisasi | ✓ palette 640px + layar `/cari` mobile; registry `SearchProvider`; provider Aksi (difilter peran) & Orang (`User::visibleTo`). Provider Tugas/Workspace/Dokumen menyusul modulnya |
| 8 | Job harian tenggat H-1 & terlewat tanpa duplikat | ◐ helper `NotificationHistory::wasSent()` + `ResolveNotificationsForSubject` tersedia; job-nya milik modul Tugas |
| AC | Test: email off → tidak terkirim; ringkasan kosong tidak terkirim; palette tidak menampilkan data tanpa akses | ✓ (`BaseNotificationTest`, `DailyDigestTest`, `SearchTest`) |
| + | Otorisasi channel broadcast + test | ✓ — sekaligus **perbaikan bug keamanan Sprint 0**: `(int)` cast ULID membuat banyak user lolos otorisasi channel orang lain |

## Cara uji manual (https://ruangkerja.test)

1. `php artisan migrate:fresh --seed` (seeder `NotificationDemoSeeder` mengisi Inbox demo).
2. Masuk sebagai **kadiv@demo.test** (Dimas): `/inbox` menampilkan 9 notifikasi (6 belum dibaca, 3 perlu tindakan) seperti mockup. Pilih item → detail kanan; `J`/`K` pindah, `E` arsip (+ Urungkan di toast), `U` dibaca/belum. Filter corong → Disebut / Arsip.
3. Lebar 375px: `/inbox` → geser baris ke kiri → **Dibaca** / **Arsipkan**; ikon corong & centang ganda di app bar.
4. `/pengaturan/notifikasi`: ubah kotak/sakelar → "Tersimpan otomatis"; in-app "Pengajuan menunggu persetujuan saya" terkunci; WhatsApp "Segera hadir". **Kirim notifikasi uji** → lonceng bertambah, toast muncul (realtime bila Reverb jalan; tanpa Reverb muncul ≤ 30 dtk lewat polling). "Buka versi email" / `/pengaturan/notifikasi/pratinjau-ringkasan` = email ringkasan hari ini.
5. `⌘K`/`Ctrl+K` di desktop: kosong = aksi cepat; ketik "wulan" → Orang (HR/Direksi melihat semua karyawan; anggota hanya diri & bawahan). Mobile: ikon cari → `/cari` dengan chip filter & pencarian terakhir.
6. Ringkasan: `php artisan notifications:send-daily-digests` pada/sesudah jam kirim (WIB, hari kerja) → email di Mailpit http://localhost:8026. Scheduler: tiap 5 menit; `notifications:prune` 02.15 WIB.

## Keputusan

1. **Dua tingkat registry**: `NotificationEvent` = baris preferensi (`notification_preferences.event`, sesuai DATABASE.md), `NotificationType` = jenis rinci di payload (ikon, nada, perlu tindakan). Approved/rejected/revisi berbagi satu preferensi "Pengajuan saya diputus".
2. **Skema**: `notifications.id` tetap uuid (paket), `notifiable`/`subject` morph ULID, `data` jsonb; kolom tambahan `archived_at`, `action_required`, `resolved_at`, `subject_type/subject_id` (+ indeks parsial unread). `notification_preferences` diberi `id` ULID + timestamps. Tabel baru **`notification_settings`** (1:1 user: `digest_time`, `quiet_hours`, `pause_while_on_leave`, `digest_last_run_on`) — dipisah dari `users` agar tidak berbenturan dengan migrasi organisasi. DATABASE.md §6 diperbarui. `notifications.type` = nilai enum (`databaseType()`), bukan nama kelas.
3. In-app **terkunci** untuk `request.pending` (penyetuju harus melihat) dan `system`; kanal lain bisa dimatikan.
4. **Jam tenang** default aktif (sesuai mockup): email di luar 07.00–17.30 / akhir pekan ditunda ke 07.00 hari kerja berikutnya (`withDelay`), in-app tetap langsung.
5. **Tahan saat cuti**: hanya catatan Inbox (tanpa toast/email/WA), lewat kontrak `UserAvailability` yang di-bind modul Pengajuan.
6. Notifikasi `ShouldQueueAfterCommit` (aman dipanggil di dalam `DB::transaction`).
7. Model Inbox `App\Models\InboxNotification` (extends `DatabaseNotification`) — nama dipilih agar tidak bentrok dengan facade `Notification`. Tidak mengubah `User.php`.
8. URL payload wajib path relatif (`/…`) — `/inbox/{id}/open` tidak bisa jadi open redirect.
9. Channel realtime memakai nama bawaan Laravel `App.Models.User.{id}`; `useNotificationsChannel` jatuh ke polling `GET /inbox/feed` (30 dtk, hanya saat tab terlihat) bila Echo tidak terkonfigurasi/terputus, kembali ke realtime saat tersambung; de-duplikasi antar jalur.
10. Rate limiter bernama (`notification-feed` 10/mnt, `notification-test` 5/mnt, `search` 120/mnt) — `throttle:N,M` tanpa nama berbagi kuota per user sehingga polling sempat memblokir tombol uji.
11. Orang di pencarian: `User::visibleTo($viewer)->active()` dari core Sprint 1 (bukan direktori terbuka); hasil `mailto:` sampai ada halaman profil.
12. Route modul di `routes/notifications.php` (satu `require`), termasuk `/cari`. Placeholder `inbox` & `pengaturan/notifikasi` dihapus dari `$upcoming`.
13. Halaman pengaturan notifikasi memakai nav "Akun saya" sendiri (bukan `SettingsLayout` starter); entri "Notifikasi" juga ditambahkan ke `SettingsLayout`.
14. Edit kecil shell bersama: `app-topbar.tsx` (palette, titik lonceng), `mobile/app-bar.tsx` (cari → `/cari`, titik lonceng), `mobile/tab-bar.tsx` & `app-sidebar.tsx` (badge), `app-layout.tsx` (listener + prop `appBarActions`), `mobile/swipeable-row.tsx` (ikon + nada `info`), `components/ui/{command,switch}.tsx` baru.

## Paket baru

Tidak ada. Memakai `cmdk`, `@laravel/echo-react`, `sonner` yang sudah terpasang. `Switch` ditulis tanpa dependensi Radix tambahan.

## Uji

- Pest: `tests/Feature/Notifications/*` (BaseNotification/preferensi/jam tenang/cuti/WhatsApp/payload/email, Inbox & otorisasi lintas peran, aksi, channel broadcast, pengaturan & rate limit, ringkasan harian dengan `Mail::fake` + `travelTo`, seeder demo), `tests/Feature/Policies/NotificationPoliciesTest.php` (matriks peran), `tests/Feature/Search/SearchTest.php`. Suite penuh setelah merge `main`: **694 test hijau**.
- Vitest: utils Inbox (grup hari WIB, judul tebal), unread store, `useNotificationsChannel` (polling fallback, realtime, reconnect), registry detail, highlight & pencarian terakhir — **81 test hijau** (seluruh suite).
- `composer lint` (Pint + Larastan 8), `npm run typecheck`, `npm run lint` bersih. Migrasi diuji rollback.
- Dicek di browser (1440 & 390, gelap): Inbox desktop/mobile + geser, palette, `/cari`, pengaturan desktop/mobile, toast via polling.

## Sisa pekerjaan / risiko

- Kelas notifikasi konkret, job tenggat H-1/terlewat, seksi ringkasan (tenggat, terlambat, persetujuan) dan provider pencarian Tugas/Workspace/Dokumen dikerjakan modul masing-masing (lihat HOW-TO). Data demo Inbox untuk tugas/pengajuan hanya teks (tanpa subjek nyata), tautannya ke halaman daftar.
- Pratinjau kaya di panel detail Inbox (komentar tugas seperti mockup) menunggu modul Tugas (`registerNotificationDetail`).
- Pengingat absensi di matriks belum menampilkan jamnya ("· 08.15") — butuh data shift (Sprint 2).
- Realtime end-to-end dengan Reverb sungguhan belum diuji di sesi ini (Reverb lokal tidak berjalan); jalur polling terverifikasi di browser, broadcast terverifikasi lewat test payload & otorisasi channel.
- Belum ada snapshot Playwright 3 lebar (PLATFORM.md §5.7) — sama seperti sprint lain.
