# Sesi claude

**Terakhir diperbarui:** 6 Okt 2026 · Claude Code

## Tugas berjalan
Tugas #1 `docs/PEMBAGIAN-TUGAS.md`: F2-1 Obrolan — backend nyata menggantikan data contoh di `resources/js/features/chat`. Rencana disetujui pengguna: `docs/fitur/obrolan.md` §6–7 + keputusan di bawah.

## Worktree / branch
`.claude/worktrees/project-overview-status-ebff38` · `claude/f2-obrolan` (di atas `claude/kerja-paralel`, PR #2) · https://ruangkerja-claude.test · DB `ruangkerja_claude` / test `ruangkerja_testing_claude`

## Sudah selesai
- `29c5dc7` klaim tugas · `c95b06a` skema + model · `5a33af2` Policy + matriks · `8815a27` Action/notifikasi/event/sinkron workspace · `f49cac2` halaman & endpoint di balik FEATURE_CHAT · `d62f672` data demo + anti-N+1 · `9b16466` frontend server + realtime · (commit ini) dokumentasi.
- Verifikasi: Pest 2.163, Vitest 514, typecheck/lint/Larastan bersih; Playwright kirim/muat ulang/reaksi/DM baru tanpa galat; ui-shots 1440/834/390 terang & malam bersih.

## Langkah berikutnya
1. Buka PR `claude/f2-obrolan` → `main` (setelah PR #2 masuk) dan tunggu review/CI.
2. (Sudah selesai, catatan rencana awal:) Migrasi `channels`, `channel_members`, `messages` + model/enum/factory + `docs/DATABASE.md` §7.
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
