# Sesi claude

**Terakhir diperbarui:** 6 Okt 2026 · Claude Code

## Tugas berjalan
Tugas #1 `docs/PEMBAGIAN-TUGAS.md`: F2-1 Obrolan — backend nyata menggantikan data contoh di `resources/js/features/chat`. Rencana disetujui pengguna: `docs/fitur/obrolan.md` §6–7 + keputusan di bawah.

## Worktree / branch
`.claude/worktrees/project-overview-status-ebff38` · `claude/f2-obrolan` (di atas `claude/kerja-paralel`, PR #2) · https://ruangkerja-claude.test · DB `ruangkerja_claude` / test `ruangkerja_testing_claude`

## Sudah selesai
- (mulai) klaim tugas.

## Langkah berikutnya
1. Migrasi `channels`, `channel_members`, `messages` + model/enum/factory + `docs/DATABASE.md` §7.
2. `ChannelPolicy`/`MessagePolicy` + matriks test.
3. Actions (`CreateChannel`, `OpenDirectConversation`, `PostMessage`, `EditMessage`, `DeleteMessage`, `ToggleMessageReaction`, `MarkChannelRead`, `SetChannelMuted`, `AttachMessageFiles`, `SyncWorkspaceChannel`) + test.
4. Queries (`ChatInbox`, `ChannelTimeline`, `AttachableDriveFiles`), controller, `routes/chat.php`, flag `FEATURE_CHAT`.
5. Broadcast `chat.{channel}`, presence `chat-online.{company}`, notifikasi `chat.message` + mention.
6. `ChatDemoSeeder`. 7. Frontend store bersumber server + navigasi. 8. Verifikasi + docs → PR.

## Keputusan pengguna yang berlaku
- DM/grup/channel privat hanya dibaca anggota (Super Admin/HR/Direksi pun tidak). Channel workspace ikut akses workspace; publik = karyawan aktif satu perusahaan.
- Lampiran Drive boleh di DM/grup bila setiap anggota bisa melihat workspace pemilik file.
- Notifikasi hanya DM/grup + @mention; channel dibisukan hanya saat disebut.
- Obrolan keluar dari Pratinjau: flag `FEATURE_CHAT` (lokal nyala, produksi mati) + tile Dock/Rail + Menu ponsel.

## Butuh dari integrator / agen lain
- (Claude juga integrator) Navigasi `lib/navigation.ts`, `HandleInertiaRequests` (prop `chat.unread`), `NotificationType`/`NotificationEvent` diubah di branch ini — beri tahu Codex agar tidak menyentuhnya di #2.

## Verifikasi
composer test · composer lint · npm run typecheck · npm run lint · npm test
