# Sprint 7 (tugas 7) — Lampiran task & komentar · Rencana

Cabang `feat/lampiran-tugas` di atas `main` (Sprint 0–9 + 10A). Melanjutkan `WIRING-SUMMARY.md` §Lampiran.

## Backend
- `Comment implements HasWorkspaceAttachments` (+ `attachments()`), `'comment' => Comment::class` di `AttachableTypes::MAP`. Komentar terhapus (soft) → `AttachableTypes::find` & morph `attachable` tidak menemukannya → 404; `CommentResource.attachments = []`.
- `AttachmentPolicy::delete` diperketat: hanya yang boleh `update` induk (tugas: bisa mengedit tugas; komentar: penulis). Pengunggah yang tidak lagi boleh mengedit tidak bisa melepas.
- Daftar lampiran dipindah ke query `App\Domain\Google\Queries\AttachmentList` (dipakai `AttachmentController` dan `TaskDetail`) → detail tugas langsung membawa lampiran (tanpa permintaan kedua / skeleton) + `attachments_count`.
- Event domain `AttachmentAdded` / `AttachmentRemoved` (after commit) dari `DriveFileRecorder::attach` (baris baru) dan `RemoveAttachment` (+ pelaku).
- Listener `App\Listeners\Tasks\RecordTaskAttachmentChange`: lampiran tugas → aktivitas `task.attachment_added` / `task.attachment_removed` (nama file, jenis); tugas maupun komentar → broadcast `attachment.added` / `attachment.removed` di `private-workspace.{id}` (antrean `realtime`, payload: task_id, attachable_type, attachable_id, attachment_id, attachments_count).
- "Dipakai di tugas" (tab File): juga lampiran komentar (komentar tidak terhapus), tautan `/w/KEY/tasks/N`.
- Notifikasi pengamat: tidak (berisik; aktivitas + realtime cukup) — dicatat di ringkasan.

## Frontend
- `AttachmentsPanel`: prop `initial` (data dari detail), varian `mobile` (Lampirkan + Kamera/Drive/File, kartu gulir horizontal sesuai MTaskDetail), grid 3 kolom desktop sesuai TaskDetail, tombol "Lampirkan dari Drive / Unggah / Dokumen baru".
- TaskSheet / layar penuh / mobile: seksi Lampiran setelah Sub-tugas, sebelum Aktivitas.
- Komposer komentar: tombol klip → Unggah / Pilih dari Drive / Dokumen baru (mobile: sheet + Kamera). Lampiran tertunda tampil sebagai chip; setelah komentar terkirim, dilampirkan ke komentar (unggah bertahap memakai endpoint `/lampiran/comment/{id}/unggah`).
- Komentar menampilkan lampirannya; saat diubah (penulis) memakai `AttachmentsPanel` komentar (tambah/lepas).
- Timeline: "melampirkan X" / "melepas lampiran X"; event `attachment.*` → muat ulang detail.

## Test
Pest: lampirkan/lepas di tugas & komentar, matriks otorisasi (owner/member/viewer/penulis komentar/bukan penulis/outsider/super admin), workspace privat 404, broadcast (Event::fake + payload/channel), komentar terhapus menyembunyikan lampiran, aktivitas, "Dipakai di tugas". Vitest: timeline text, panel `initial`, lampiran tertunda.
