# Sprint 8 — Rencana: Notifikasi, Inbox, command palette (infrastruktur)

> Cabang `feat/sprint-8-notifikasi`. Dibangun paralel dengan modul domain (absensi, pengajuan, workspace, tugas) yang **belum ada** di cabang ini. Karena itu Sprint 8 dibangun sebagai **infrastruktur generik** dengan titik ekstensi yang terdokumentasi, didemokan dengan notifikasi bawaan (pengumuman sistem & notifikasi uji).

## Lingkup

1. **Model & skema** — tabel `notifications` (bawaan Laravel, `id` uuid, `notifiable` ULID morph, `data` jsonb) + kolom tambahan `archived_at`, `action_required`, `resolved_at`, `subject_type/subject_id`; tabel `notification_preferences` (sesuai DATABASE.md) dan `notification_settings` (jam ringkasan, jam tenang, tahan saat cuti).
2. **Registry** — enum `NotificationEvent` (baris matriks pengaturan; kunci `notification_preferences.event`), `NotificationType` (jenis rinci pada payload: ikon, nada, perlu tindakan), `NotificationChannel`, `NotificationCategory`. Default kanal di `config/notifications.php`.
3. **BaseNotification** — `via()` membaca preferensi (in-app bisa dikunci per kejadian, email sesuai preferensi + jam tenang = ditunda, WhatsApp F2 nonaktif), payload seragam `{type,title,body,url,actor,subject,meta}`, email bermerek, broadcast realtime, `afterCommit`.
4. **Kanal** — `InAppChannel` (DatabaseChannel + kolom tambahan), `WhatsAppChannel` + kontrak `WhatsAppProvider` (implementasi Null), kontrak `UserAvailability` (cuti; implementasi default "selalu tersedia").
5. **Realtime** — broadcast ke `private-App.Models.User.{id}` (perbaikan otorisasi ULID di `routes/channels.php`), hook `useNotificationsChannel` dengan fallback polling 30 dtk (`GET /inbox/feed`), toast glass.
6. **Inbox** `/inbox` — desktop (daftar + detail) & mobile (geser: Dibaca/Arsipkan), tab Semua/Belum dibaca/Perlu tindakan, filter kategori/Disebut/Arsip, tandai dibaca/belum, tandai semua, arsip. Hitungan belum dibaca dibagikan lewat shared prop (closure, satu `count` dengan indeks parsial) → lonceng topbar, sidebar, tab mobile.
7. **Pengaturan notifikasi** `/pengaturan/notifikasi` — matriks (desktop) & accordion (mobile), ringkasan harian + jam kirim + pratinjau, jam tenang, tahan saat cuti, tema; simpan otomatis.
8. **Pencarian** — registry `SearchProvider` (`config/search.php`), provider `Actions` & `People`; command palette ⌘K/Ctrl+K (cmdk, glass 640px) + layar `/cari` mobile; endpoint JSON `/cari/hasil`.
9. **Ringkasan harian** — command `notifications:send-daily-digests` tiap 5 menit, per jam preferensi (Asia/Jakarta), hari kerja, tidak dikirim bila kosong, registry `DigestSection` (`config/notifications.php`), Mailable `DailyDigestMail` sesuai mockup `EmailRingkasan`.
10. **Retensi** — `notifications:prune` harian (30 hari, kecuali yang masih perlu tindakan).

## File utama

- `app/Domain/Notifications/{Enums,Data,Channels,Contracts,Support,Services,Actions,Digest}`; `app/Domain/Search/{Contracts,Data,Providers,Services,Actions}`.
- `app/Models/{InboxNotification,NotificationPreference,NotificationSetting}.php`; policy per model.
- `app/Http/Controllers/{Notifications,Search}/*`; `routes/notifications.php`, `routes/search.php` (satu `require` di `routes/web.php`).
- `app/Providers/NotificationServiceProvider.php` (binding kontrak & registry).
- Frontend: `features/notifications/*`, `features/search/*`, `pages/inbox/index.tsx`, `pages/notifications/settings.tsx`, `pages/search/index.tsx`, `hooks/use-notifications-channel.ts`, `components/ui/command.tsx`.
- Edit kecil pada shell: `app-topbar.tsx`, `mobile/app-bar.tsx`, `mobile/tab-bar.tsx`, `app-sidebar.tsx`, `layouts/app-layout.tsx`, `mobile/swipeable-row.tsx` (ikon + nada info).

## Uji

Preferensi dihormati `via()` (matriks kejadian × kanal, kanal terkunci, WhatsApp nonaktif, jam tenang menunda email, cuti), aksi Inbox hanya untuk notifikasi sendiri (matriks peran), otorisasi channel broadcast, pencarian menghormati visibilitas/peran, ringkasan harian (zona waktu, hari kerja, kosong tidak dikirim, idempoten) dengan `Mail::fake` + `travelTo`, prune, payload seragam. Vitest: util judul/grup hari/pencarian terakhir.

## Risiko & keputusan

- Modul domain belum ada → kelas notifikasi konkret (tugas, pengajuan, absensi) dibuat oleh modul masing-masing memakai `BaseNotification`; registry jenis sudah tersedia. Panduan: `HOW-TO-NOTIFY.md`.
- "Perlu tindakan" memakai flag `action_required` + `resolved_at` (modul memanggil `ResolveNotificationsForSubject` saat aksi selesai).
- Visibilitas Orang: direktori perusahaan (semua karyawan). Bila core Sprint 1 menyediakan scope `visibleTo` pada `User`, provider otomatis memakainya.
