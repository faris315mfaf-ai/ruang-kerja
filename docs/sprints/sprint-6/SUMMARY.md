# Sprint 6 — Ringkasan: Detail tugas, komentar, mention, realtime

Cabang `feat/sprint-6-task-detail` (digabung dengan `main` terbaru: Sprint 1–5, 7A/7B, 8, 9, 10A + review fix).

## Acceptance criteria (docs/PROMPTS.md Sprint 6)

| # | Kriteria | Status |
|---|---|---|
| 1 | TaskSheet panel kanan 640px, layar penuh `/w/{key}/tasks/{number}` | ✓ `features/tasks/detail/task-sheet.tsx` + `pages/tasks/show.tsx`; mobile layar penuh (MTaskDetail) dengan kotak komentar menempel di bawah |
| 1a | Judul inline-edit, deskripsi Tiptap (heading, list, checklist, code, tautan, @orang, #KEY-n) | ✓ editor lazy-load; server menyanitasi ulang semua dokumen (`RichText`) |
| 1b | Properti, sub-task, checklist, timeline aktivitas + komentar | ✓ |
| 2 | Migration + model `comments`, `mentions`, `reactions`, `saved_views` | ✓ 3 migrasi, bisa di-rollback; model + Policy + factory |
| 3 | Komentar dengan mention & reaksi; edit "(diedit)" & hapus soft; MentionParser → notifikasi; penulis jadi watcher | ✓ `PostComment`, `UpdateComment`, `DeleteComment` (audit bila dihapus moderator), `ToggleReaction`, `MentionParser`, `SyncMentions` |
| 4 | Reverb + Echo `private-workspace.{id}`; board/list/sheet tanpa reload; presence "X sedang melihat" | ✓ + `TaskDeleted`, `CommentUpdated`, `CommentDeleted`; presence `presence-task.{id}` |
| 5 | Saved views pribadi/dibagikan | ✓ menu "Tampilan" di toolbar |
| 6 | Pintasan J/K, Enter, C, A, S, P, D, Shift+←/→, ? | ✓ board, list, sheet |
| 7 | Polling 30 dtk bila WebSocket putus + indikator | ✓ |
| AC | Dua browser user berbeda melihat perubahan < 1 detik | ✓ diukur dengan Playwright dua sesi + Reverb lokal: presence 1–3 ms, komentar 76–182 ms, reaksi 77–281 ms, pindah status 75–77 ms |
| AC | Mention hanya untuk yang berakses, otorisasi channel, hapus komentar bukan penulis ditolak kecuali admin | ✓ `MentionTest`, `TaskChannelAuthorizationTest`, `CommentTest`, `CommentPolicyTest` |

Tambahan: notifikasi mention, komentar (pengamat), penugasan, H-1, terlambat; command `tasks:notify-deadlines` (07.00 WIB) + seksi ringkasan harian "Tenggat hari ini" & "Terlambat"; pratinjau tugas di Inbox; provider pencarian Tugas menaut ke `/w/KEY/tasks/N`.

## Cara mencoba (`php artisan migrate:fresh --seed`)

Butuh Reverb + worker antrean `realtime` (`composer run dev` atau `composer run dev:win`).

1. **Dimas (kadiv@demo.test)** buka `/w/PLQ`, klik **PLQ-21** → TaskSheet dengan deskripsi kaya, checklist, sub-tugas, komentar & reaksi.
2. Jendela privat sebagai **Rizky (anggota@demo.test)** buka PLQ-21 → Dimas melihat "Rizky sedang melihat"; komentar dengan `@Dimas` muncul langsung + notifikasi; ubah status → kartu pindah di board Dimas.
3. Board: `J/K`, `A`, `S`/`P`/`D`, `Shift+→`, `?`; menu **Tampilan** untuk saved views.
4. Layar penuh `/w/PLQ/tasks/21`; mobile 375 px membuka halaman MTaskDetail.
5. Inbox Dimas → notifikasi mention → pratinjau tugas + balas.
6. Hentikan Reverb → indikator "sinkron tiap 30 dtk".

## Keputusan

- API JSON detail `/tugas/{id}`; komentar `/tugas/{id}/komentar`, `/komentar/{id}` (+`/reaksi`); checklist; pengamat; saved view `/w/{KEY}/tampilan`.
- Sheet tidak mengubah URL board; tersedia "Salin tautan" & "Buka layar penuh".
- Hak komentar: semua yang bisa melihat workspace (tidak diarsipkan). Edit hanya penulis; hapus penulis atau owner/admin workspace, dicatat di audit bila bukan penulis.
- Mention hanya untuk user aktif yang bisa melihat workspace; selain itu menjadi teks biasa tanpa notifikasi. Label mention selalu nama asli.
- #rujukan hanya ke tugas yang terlihat oleh penulis dan penonton.
- Rich text dirender ke elemen React (tanpa `dangerouslySetInnerHTML`); TrimStrings dikecualikan untuk `body.content.*`/`description.content.*`.
- Broadcast di antrean `realtime` dengan worker sendiri (`supervisor-realtime`) agar tidak menunggu job email.
- Channel ditolak menjawab 403 atau 404 (binding workspace menyembunyikan workspace tak terlihat).

## Paket baru

- `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-list`, `@tiptap/extension-mention`, `@tiptap/suggestion`, `@tiptap/extensions` — editor kaya, dimuat lazy (±132 KB gzip hanya saat editor tampil).

## Test

- Pest 1714 hijau (±95 baru), Vitest 251 hijau; lint, typecheck, build bersih; migrasi diuji rollback.
- E2E dua pengguna: `tests/e2e/realtime-two-users.mjs` (lihat `tests/e2e/README.md`).

## Sisa / risiko

- Lampiran Drive di detail tugas belum dipasang (komponen `features/drive/attachments-panel.tsx` dari Sprint 7B siap dipakai).
- Presence per kartu di board, read receipts komentar, dan seret urutan checklist belum ada.
- Uji realtime lokal wajib menjalankan worker antrean `realtime`.
