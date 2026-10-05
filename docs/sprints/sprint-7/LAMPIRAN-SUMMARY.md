# Sprint 7 (tugas 7) — Lampiran task & komentar · Ringkasan

Cabang `feat/lampiran-tugas` (di atas `main`: Sprint 0–9 + 10A). Rencana: [`LAMPIRAN-PLAN.md`](LAMPIRAN-PLAN.md). Melanjutkan [`WIRING-SUMMARY.md`](WIRING-SUMMARY.md) §Lampiran.

## Acceptance criteria

| # | Kriteria | Status |
|---|---|---|
| 1 | Seksi Lampiran di TaskSheet, layar penuh `/w/KEY/tasks/N`, dan MTaskDetail sesuai mockup, dengan jumlah | ✓ setelah Sub-tugas, sebelum Aktivitas. Desktop: "Lampiran 3" + **Lampirkan dari Drive · Unggah · Dokumen baru**, kartu 2 kolom (sheet 640px) / 3 kolom (layar penuh) lewat container query. Mobile: "Lampiran 3" + **Lampirkan** (sheet: Ambil foto, Unggah dari ponsel, Pilih dari Drive, Docs/Sheets/Slides baru) + **Kamera · Drive · File**, kartu digulir menyamping. Data lampiran ikut di payload detail (`attachments`, `task.attachments_count`) → tanpa permintaan kedua/skeleton |
| 2 | Lampiran di komentar: `Comment implements HasWorkspaceAttachments`, CommentPolicy view/update, `'comment'` di `AttachableTypes::MAP` | ✓ `attachmentWorkspace()` = workspace tugasnya; `attachments()` morphMany |
| 3 | Lampirkan dari komposer komentar (Unggah / Pilih dari Drive / Dokumen baru), tampil di bawah komentar | ✓ ikon klip di toolbar (desktop: menu; mobile: sheet + Kamera). Pilihan tampil sebagai chip; setelah komentar terkirim file dilampirkan ke komentar (`/lampiran/comment/{id}/…`; unggah bertahap dengan panel progres). Komentar menampilkan kartu lampirannya; penulis menambah/melepas lampiran saat **Ubah** (panel ringkas) |
| 4 | Entri aktivitas lampiran di timeline | ✓ `task.attachment_added` / `task.attachment_removed` ("Dimas Pratama melampirkan Wireframe v2.pdf"), juga di feed Aktivitas workspace ("… di PLQ-21"). Lampiran komentar tidak membuat entri (sudah terlihat di komentarnya) |
| 5 | Realtime: broadcast tambah/lepas di `private-workspace.{id}` | ✓ `attachment.added` / `attachment.removed` (antrean `realtime`, pola Sprint 6), payload hanya id + `attachments_count`; detail yang terbuka memuat ulang lewat GET yang diotorisasi (debounce 250 ms; polling 30 dtk tetap jadi cadangan) |
| 6 | "Dipakai di tugas" di tab File membuka `/w/KEY/tasks/N` | ✓ termasuk file yang dilampirkan di komentar (komentar tidak terhapus), tanpa duplikat |
| 7 | Notifikasi pengamat (opsional) | ✗ sengaja tidak — lihat Keputusan 4 |
| 8 | Otorisasi: hanya yang bisa mengedit tugas menambah/melepas; viewer melihat; lampiran komentar mengikuti hak edit komentar | ✓ `AttachmentPolicy`: lihat = `view` induk, tambah & lepas = `update` induk |
| T | Test (FakeDriveClient) | ✓ lihat §Test |
| UI | Desktop + mobile, terang & gelap | ✓ dicek di 1440 (gelap: layar penuh; terang: TaskSheet) dan 390 (gelap & terang) dengan `GOOGLE_FAKE=true` |

## Desain teknis
- **Query** `App\Domain\Google\Queries\AttachmentList` (dipakai `AttachmentController` & `TaskDetail`); `drive` kini juga memuat `fake` (mode Drive palsu tidak membuka tab baru).
- **Event domain** `App\Domain\Google\Events\AttachmentAdded` (dari `DriveFileRecorder::attach`, hanya baris baru — Picker, Dokumen baru, unggahan selesai) dan `AttachmentRemoved` (dari `RemoveAttachment`, kini menerima pelaku). Keduanya `ShouldDispatchAfterCommit`.
- **Listener** `App\Listeners\Tasks\RecordTaskAttachmentChange` (auto-discovery): aktivitas untuk lampiran tugas + `TaskAttachmentAdded/Removed` (`App\Events\Tasks`) untuk tugas maupun komentar. Komentar/tugas yang sudah terhapus tidak diproses.
- **CommentResource** memuat `attachments` (kosong bila komentar dihapus); eager-load terpusat di `CommentResource::RELATIONS` (timeline, respons komentar, broadcast komentar) → tanpa N+1.
- **Frontend**: `features/drive/attach-actions.tsx` (input file/kamera, Picker + prompt "Hubungkan akun Google", menu & sheet "Lampirkan") dipakai bersama oleh `AttachmentsPanel` (prop baru `initial`, `variant: desktop|mobile|compact`) dan komposer (`features/tasks/detail/comment-attachments.tsx`). `DrivePicker` memakai prompt yang sama. `NewItemDialog` mendapat `submitLabel`/`hint` opsional.

## Keputusan
1. **Lepas lampiran diperketat**: sebelumnya pengunggah boleh melepas lampirannya walau hanya viewer; kini hanya yang boleh `update` induk (sesuai brief). Pengunggah yang diturunkan ke viewer tidak bisa melepas. Test kebijakan bagian A disesuaikan.
2. **Lampiran komentar = hak edit komentar** (penulis saja, workspace tidak diarsipkan). Akibatnya viewer pun bisa melampirkan file ke komentarnya sendiri (file masuk folder Drive workspace lewat service account). Owner/admin yang bukan penulis tidak bisa menambah/melepas lampiran komentar orang lain (mereka tetap bisa menghapus komentarnya → lampiran ikut tersembunyi).
3. **Komentar tetap wajib berisi teks**; lampiran dari komposer baru dibuat/diunggah setelah komentar tersimpan (komentar butuh id). Placeholder berubah menjadi "Tulis komentar untuk lampiran ini…". "Dokumen baru" dari komposer tidak membuka tab otomatis (bukan lagi gestur klik) — toast punya tombol **Buka**.
4. **Tanpa notifikasi pengamat** untuk lampiran: aktivitas + realtime sudah memberi tahu yang sedang membuka tugas; notifikasi per file berisik (unggah 5 file = 5 notifikasi) dan komentar berlampiran sudah memicu notifikasi komentar.
5. Komentar terhapus **menyembunyikan** lampirannya (GET/POST/DELETE 404, `attachments: []`, tidak dihitung di "Dipakai di tugas"); baris `attachments` tidak dihapus sehingga data tetap ada untuk audit.
6. Lampiran komentar tidak masuk hitungan "Lampiran N" tugas (hanya lampiran tugas), tetapi masuk "Dipakai di tugas".

## Cara mencoba manual
1. `GOOGLE_FAKE=true` di `.env`, `php artisan migrate:fresh --seed`, worker antrean (`composer run dev`) + Reverb untuk realtime.
2. **Dimas (kadiv@demo.test)** → `/w/PLQ/tasks/21` → Lampiran: **Dokumen baru › Google Docs** "Brief landing page" → kartu muncul, timeline "Dimas Pratama melampirkan Brief landing page". **Unggah** file (> 2 MB untuk melihat progres per potongan). Lepas dengan ✕ → "melepas lampiran …".
3. Komposer: klip › Google Docs "Catatan uji ponsel" → chip → tulis komentar → Kirim → kartu di bawah komentar. Menu komentar › **Ubah** → panel "Lampiran komentar" (Lampirkan / ✕).
4. Jendela privat **Rizky (anggota@demo.test)** membuka PLQ-21: lampiran Dimas muncul tanpa muat ulang saat Dimas menambah/melepas; Rizky tidak bisa melampirkan ke komentar Dimas (tombol klip hanya di komposernya sendiri / saat mengubah komentarnya).
5. Viewer workspace: seksi Lampiran tanpa tombol, tanpa ✕.
6. Tab **File**: kolom "Dipakai di tugas" → klik PLQ-21 → layar penuh tugas.
7. Mobile 390 px: `/w/PLQ/tasks/21` → Lampirkan / Kamera / Drive / File; klip di kotak komentar bawah.

## Test
- Pest **1737 hijau** (`rk_test`, 4 proses). Baru: `tests/Feature/Tasks/TaskAttachmentsTest.php` (23 test, 160 asersi): aktivitas + broadcast tambah/lepas (kanal, nama event, antrean, payload), tanpa aktivitas ganda untuk file yang sama, payload detail (lampiran, jumlah, hak viewer), matriks tugas (owner/admin/member/viewer/Direksi/outsider × lihat/tambah/unggah/lepas), workspace diarsipkan, pengunggah yang diturunkan, lampiran komentar (dokumen, unggah bertahap, broadcast `attachable_type=comment`), matriks komentar (penulis/owner/admin/viewer/outsider), viewer melampirkan ke komentarnya sendiri, komentar terhapus menyembunyikan lampiran, workspace pribadi tidak bocor ke Direksi/owner workspace lain/outsider (task & komentar, GET/POST/DELETE), id/tipe tidak valid, "Dipakai di tugas" (tugas + komentar → `/w/PLQ/tasks/N`). `GooglePoliciesTest` disesuaikan (Keputusan 1).
- Vitest **259 hijau** (baru: `comment-attachments.test.tsx` 3, `attachments-panel.test.tsx` +3, `timeline.test.ts` +1, `activity-text.test.ts` +1).
- `composer lint` (Pint + Larastan 8), `npm run typecheck`, `npm run lint` bersih. Tidak ada migrasi baru (hanya nilai `activities.event` baru, DATABASE.md diperbarui).

## Paket baru
Tidak ada.

## Sisa / risiko
- Belum diuji dengan Google sungguhan (Picker & unggah nyata); mode palsu saja.
- Realtime lampiran diverifikasi lewat test broadcast (kanal/payload) dan handler klien; belum diukur dengan dua browser + Reverb seperti Sprint 6 (pemeriksaan UI memakai server lokal tanpa Reverb → mode polling).
- "Folder Drive" per tugas di panel properti mockup (`PLQ-21 Landing page`) tidak dibuat: file tetap di akar folder workspace (keputusan Sprint 7B).
- Kartu board belum menampilkan ikon/jumlah lampiran (mockup board tidak memintanya).
- Komposer Inbox (balas dari pratinjau notifikasi) belum menawarkan lampiran; lampiran komentar tetap tampil di sana.
