# Review Sprint 3–9 (bagian A) — Perbaikan keamanan, notifikasi, realtime

Cabang `fix/review-3-9-security`. Satu commit per temuan. Setiap temuan diverifikasi dulu di kode, lalu diberi test regresi yang **gagal sebelum perbaikan** (dicek dengan menjalankan test baru terhadap kode lama lewat `git stash -u` folder `app`/`config`/`routes`) dan hijau sesudahnya. Beberapa test sengaja ikut lulus di kode lama karena berfungsi sebagai pagar perilaku (disebut di bawah). Temuan absensi/analitik (selain dua file ekspor di #4) dikerjakan agen lain; lampiran tugas/komentar juga agen lain (sudah masuk lewat merge `main`).

| # | Tingkat | Commit |
|---|---|---|
| 1 | High | `0274ad4` fix(organization): revoke Drive access when an employee is deactivated |
| 2 | High | `ff824ba` fix(notifications): re-check access before delivering queued notifications |
| 3 | Medium | `edb65b1` fix(tasks): broadcast thin task and comment events |
| 4 | Medium | `4dc0fec` fix(exports): write formula-like text as plain text in spreadsheets |
| 5 | Medium | `101a1b9` fix(projects): drop portfolio access and notices of removed PIC/sponsor |
| 7 | Medium | `f34ba8e` fix(tasks): settle overdue reminders on delete, unassign, archive and removal |
| 8 | Medium | `c0487eb` fix(notifications): de-duplicate deadline reminders independent of channels |
| 9 | Medium | `9d86497` fix(tasks): notify each person at most once per comment or description mention |
| 17 | Low | `5067f7c` fix(drive): throttle upload starts and cap pending uploads per user |
| 18 | Low | `966147e` fix(notifications): claim the daily digest atomically, once per day |
| 19 | Low | `2426c13` fix(tasks): run the status move and field changes of an update in one transaction |
| 20 | Low | `7da02d7` fix(tasks): answer 404 for checklist lines whose task was deleted |
| 21 | Low | `4cacbb3` fix(projects): make resolving a decision and requesting an update race-safe |
| 22 | Low | `89b36f6` fix(tasks): throttle comment reactions with the comments limiter |
| 23 | Low | `2734477` fix(search): search tasks with the full-text index and show a description excerpt |
| 29 | Low | `d700901` perf: remove N+1 queries in task audience, task references and digest dispatch |
| 30 | Low | `e86de21` (Drive recorder), `4715def` (token_uri), `e2f3bf0` (kanal absensi), `de6bfc7` (FormRequest 404), `58fee84` (gate pencarian) |

Migrasi baru (bisa di-rollback, diuji `migrate:rollback` + `migrate`): `2026_10_07_300100_create_notification_dispatch_logs_table`. `docs/DATABASE.md` diperbarui. Paket baru: tidak ada.

---

## 1. Penonaktifan karyawan tidak mencabut akses Drive (High)

**Temuan.** `DeactivateEmployee` memakai `saveQuietly()` sehingga tidak ada event; izin folder Drive workspace tidak pernah disinkron ulang.

**Perbaikan.** Action baru `App\Domain\Google\Actions\SyncUserDriveAccess`: untuk setiap workspace yang diikuti orang itu dan sudah punya folder, `SyncDrivePermissions` di-dispatch **setelah commit** (`afterCommit()`). `Workspace::driveMembers()` sudah melewati pengguna nonaktif, jadi sinkron = cabut akses. Dipanggil dari `DeactivateEmployee` dan `ReactivateEmployee` (akses dipulihkan). Tidak jalan bila Google belum dikonfigurasi.

**Test.** `tests/Feature/Workspaces/WorkspaceDriveWiringTest.php` (+2): izin dicabut saat resign dan kembali saat diaktifkan ulang (FakeDriveClient); job ter-queue per workspace.

## 2. Notifikasi antre/tertunda tetap terkirim setelah akses hilang (High)

**Perbaikan.**
- `BaseNotification::shouldSend($notifiable, $channel)` (final) — Laravel memanggilnya per kanal tepat sebelum kirim (termasuk email yang ditunda jam tenang). Menolak penerima nonaktif dan mendelegasikan ke `stillVisibleTo()` yang bisa di-override.
- Notifikasi tugas (`TaskNotification`): tugas tidak terhapus, workspace (baris segar, soft-delete scope) masih ada, dan `Gate::forUser($u)->allows('view', $task)`. Komentar & mention: komentar tidak terhapus. Notifikasi proyek (keputusan, arahan, pengingat, permintaan update): workspace masih ada dan `view` diizinkan.
- `$deleteWhenMissingModels = true`: subjek yang dihapus permanen → job dibuang, bukan gagal.
- `DeleteComment` menghapus baris Inbox yang `data.meta.comment_id` = komentar itu (notifikasi "mengomentari" & mention), jadi isinya tidak tertinggal.

**Test.** `tests/Feature/Notifications/NotificationDeliveryGuardTest.php` (6): anggota dikeluarkan → `shouldSend` false & tidak ada baris Inbox; tugas/workspace dihapus; penerima resign; komentar dihapus; Inbox dibersihkan; notifikasi proyek.

## 3. Broadcast tetap menjangkau anggota yang dikeluarkan (Medium)

**Temuan.** Otorisasi kanal hanya saat subscribe; `CommentBroadcastEvent` mengirim isi komentar, event tugas mengirim `description_text`, judul, dll.

**Perbaikan.** Event tipis: tugas `{id, workspace_id, parent_id, status_id, status_category, position, updated_at}`, hapus tugas `{id, workspace_id, parent_id}`, komentar `{task_id, comment: {id}}` (event lampiran dari `main` memang sudah tipis). Klien mengambil ulang lewat endpoint berotorisasi:
- Papan/daftar: `GET /tugas/{id}?view=card` (bentuk kartu `TaskResource`, 404 bila akses hilang → kartu dihapus). `createCardRefresher` (`features/tasks/realtime/task-card.ts`) menggabungkan rentetan event per tugas jadi satu request.
- Detail tugas: event komentar/tugas → `refresh()` detail (`GET /tugas/{id}`); 404 → tampil "dihapus".

**Test.** `tests/Feature/Tasks/ThinBroadcastTest.php` (4): bentuk payload tanpa judul/deskripsi/isi komentar; endpoint kartu 200 untuk anggota, 404 setelah dikeluarkan. `CommentTest` disesuaikan. Vitest `task-card.test.ts` (2).

## 4. Injeksi formula Excel (Medium)

**Perbaikan.** `App\Support\Excel\SafeValueBinder`: string berawalan `=`, `+`, `-`, `@`, tab, CR (dan bukan angka seperti `-5`/`+62`) ditulis sebagai teks eksplisit. Didaftarkan sebagai binder default di `config/excel.php` (hanya kunci `value_binder`; sisanya default paket) sehingga semua ekspor (termasuk templat impor karyawan dan ekspor privasi di cabang lain) aman; `DashboardSheet` dan `PayrollRecapExport` juga memakainya eksplisit lewat trait `BindsValuesSafely` (`WithCustomValueBinder`).

**Test.** `tests/Feature/Support/SpreadsheetInjectionTest.php` (13, termasuk dataset): file xlsx dibaca ulang — sel formula-like bertipe `s`, angka tetap angka; nama karyawan `=cmd|…` di rekap gaji; binder default.

## 5. PIC/sponsor yang dikeluarkan tetap melihat portofolio & menerima notifikasi (Medium)

**Perbaikan.**
- `ProjectRolesReleaser`: PIC yang dikeluarkan dikosongkan (PIC wajib anggota); sponsor dikosongkan hanya bila **tidak lagi bisa melihat** proyek (sponsor Direksi tidak harus anggota). Dipanggil dari `RemoveWorkspaceMember` dan `MemberSynchronizer` (lewat `RemovedMembersCleanup`, lihat #7).
- `Workspace::scopePortfolioFor`: cabang PIC/sponsor mensyaratkan `id IN visibleTo(viewer)`.
- `SendProjectUpdateReminders` dan `GiveProjectDirection`: penerima harus lolos `view`.

**Test.** `tests/Feature/Projects/ProjectRolesAccessTest.php` (6). Test arahan ikut lulus di kode lama karena #2 (`shouldSend`) sudah menyaringnya — dipertahankan sebagai pagar.

## 7. "Perlu tindakan" lewat tenggat tidak pernah selesai (Medium)

**Perbaikan.** Action `ResolveOverdueNotices` (tugas atau seluruh tugas workspace, opsional per penerima) dipanggil di `DeleteTask`, `UpdateTask` (yang dilepas dari penugasan), `ArchiveWorkspace` (arsip), dan `RemovedMembersCleanup` (anggota yang dikeluarkan **dan** kehilangan akses; di workspace internal mereka masih bisa melihat sehingga tetap diingatkan). `PruneNotifications` kini menyelesaikan item "Perlu tindakan" yang subjeknya sudah hilang/terhapus, lalu menghapusnya bila melewati retensi.

**Test.** `tests/Feature/Tasks/OverdueResolutionTest.php` (8).

## 8. Email lewat tenggat terkirim tiap hari bila in-app dimatikan (Medium)

**Perbaikan.** Tabel `notification_dispatch_logs` + `NotificationDispatchLog::claim()` (INSERT … ON CONFLICT DO NOTHING pada unik `(type, subject, user, cycle)`). `SendDeadlineNotifications` mengklaim H-1 dan lewat tenggat per (tugas, penerima, tanggal tenggat) apa pun kanalnya. Klaim dilepas saat pengingat diselesaikan (`ResolveNotificationsForSubject`, `ResolveOverdueNotices`) sehingga siklus berikutnya (tugas dibuka lagi, tenggat baru) tetap diingatkan; klaim yatim dihapus saat prune.

**Test.** `tests/Feature/Tasks/ReminderDedupTest.php` (4): email-saja 3 hari → 1 email per tugas; H-1 dua kali sehari → 1; siklus baru setelah diselesaikan; klaim atomik.

## 9. Spam mention lewat edit (Medium)

**Perbaikan.** `SyncMentions` hanya memberi notifikasi bila klaim `(mention, komentar/deskripsi, orang, 'once')` berhasil — hapus lalu tambah ulang mention tidak memberi notifikasi lagi. (Mention yang dibuat sebelum migrasi tidak punya klaim: paling banyak satu notifikasi tambahan.)

**Test.** `MentionTest` (+2): komentar diedit 6× → 1 notifikasi; deskripsi juga.

## 17. Disk penuh lewat sesi unggah (Low)

**Perbaikan.** Limiter `drive-uploads` (`google.upload.starts_per_minute`, default 20/menit per pengguna) di `POST /w/{KEY}/file/unggah` dan `POST /lampiran/{type}/{id}/unggah`. `DriveUploadSessions::create()` di bawah lock per pengguna menghitung sesi yang belum selesai (indeks per pengguna di cache; selesai/gagal/batal/kedaluwarsa tidak dihitung): maksimal `google.upload.max_open_sessions` (5) dan `max_pending_bytes` (300 MB) → `DriveUploadQuotaExceeded` (429, pesan Indonesia). Semua bisa diatur via env `GOOGLE_UPLOAD_*`.

**Test.** `tests/Feature/Workspaces/DriveUploadQuotaTest.php` (3).

## 18. Ringkasan harian tidak atomik (Low)

**Perbaikan.** `DispatchDueDailyDigests` mengklaim hari dengan `UPDATE … WHERE digest_last_run_on IS NULL OR < today` (baris default dibuat dengan insertOrIgnore); hanya yang berhasil yang di-queue. Jadwal `notifications:send-daily-digests` dan `notifications:prune` memakai `withoutOverlapping()->onOneServer()`. `UpdateNotificationSettings` tidak lagi mengosongkan `digest_last_run_on` saat jam diganti (jam baru berlaku mulai hari kerja berikutnya bila hari ini sudah terkirim).

**Test.** `DailyDigestTest` (+4; "tanpa baris pengaturan" lulus juga di kode lama sebagai pagar), `NotificationSettingsTest` diperbarui.

## 19. `UpdateTask` tidak atomik (Low)

**Perbaikan.** Pindah kolom (MoveTask) dan perubahan field dalam satu transaksi luar. **Test.** `UpdateTaskTest` (+1): prioritas tidak valid setelah pindah kolom → status & aktivitas di-rollback.

## 20. ChecklistItemPolicy: tugas terhapus → TypeError 500 (Low)

**Perbaikan.** `denyAsNotFound()` bila `$item->task` null (PHPDoc `Task|null`). **Test.** `TaskDetailTest` (+1).

## 21. Race di keputusan proyek & minta update (Low)

**Perbaikan.** `ResolveProjectDecision`: `UPDATE … WHERE decision_resolved_at IS NULL`; hanya bila 1 baris berubah aktivitas/audit/notifikasi ditulis. `RequestProjectUpdate`: cek cooldown + tulis aktivitas di bawah `lockForUpdate` baris workspace (klaim). **Test.** `tests/Feature/Projects/ProjectRaceTest.php` (2).

## 22. Reaksi tanpa throttle (Low)

`POST /komentar/{id}/reaksi` memakai `throttle:comments` (30/menit, sama dengan komentar). **Test.** `CommentTest` (+1).

## 23. Pencarian tugas (Low)

**Perbaikan.** `TaskSearchProvider` memakai `search_vector @@ websearch_to_tsquery('simple', q)` (indeks GIN) ditambah kueri prefiks (`lapor:* & ming:*`, hanya huruf/angka) agar kata yang baru diketik sebagian tetap cocok; prefiks tidak dipakai bila kueri memakai sintaks web (`"frasa"`, `-kata`, `or`). Urutan: tugas terbuka dulu, lalu `ts_rank`, lalu terbaru. Kecocokan deskripsi menyertakan `ts_headline` sebagai `snippet`. Pencarian `KEY-n` tetap. Keputusan: substring di tengah kata (mis. "page" di "homepage") tidak lagi cocok — konsekuensi indeks teks penuh.

**Test.** `TaskWorkspaceSearchTest` (+2).

## 29. N+1 (Low)

- `TaskAudience::withAccess`: keanggotaan dimuat sekali; anggota tidak lagi memicu `roleOf()` per orang.
- `TaskDetail`: komentar dimuat sekali untuk timeline dan referensi; `#KEY-n` hanya diurai dari komentar yang tampil (bukan semua komentar).
- Ringkasan harian: preferensi per chunk (`NotificationPreferenceResolver::enabledFor`), pengaturan default tanpa query (`NotificationSetting::defaultsFor`).

**Test.** `tests/Feature/Platform/QueryCountTest.php` (3): jumlah query tidak tumbuh dengan jumlah orang; referensi komentar di luar timeline diabaikan.

## 30. Hardening (Low)

- **`DriveFileRecorder`** (keputusan): satu baris per file Drive (unik global). Bila baris milik workspace lain: dari folder workspace ini (sinkron folder, unggah, dokumen/subfolder baru) → baris pindah ke workspace ini (lokasi Drive = kebenaran); dari "tautkan file" → baris hidup workspace lain dibiarkan (tidak di-undelete/dipindah, metadata diperbarui), baris yang sudah dihapus workspace lain dipindah ke sini (tidak dipulihkan diam-diam di sana). Test `tests/Feature/Google/DriveFileRecorderTest.php` (4; kasus "baris hidup" lulus juga di kode lama sebagai pagar).
- **`token_uri`** service account wajib `https://oauth2.googleapis.com` (tanpa user/port) → selain itu `GoogleNotConfigured`. Test di `ServiceAccountTokenProviderTest` (dataset 8).
- **Kanal `company.attendance`** (keputusan): nama dipertahankan (dipakai `AttendanceRecorded` & klien), otorisasi berdasarkan perusahaan penonton: hanya bila instalasi punya tepat satu perusahaan = perusahaan penonton. Dengan banyak perusahaan, papan langsung kembali ke polling. Kanal per perusahaan (`company.{id}.attendance`) butuh perubahan di `app/Domain/Attendance` (milik agen lain) → tindak lanjut. Test `tests/Feature/Platform/CompanyAttendanceChannelTest.php` (2).
- **`CommentRequest` / `ChecklistItemRequest` / `SavedViewRequest`**: `authorize()` menjalankan `Gate::authorize('view', …)` lebih dulu → 404 untuk non-penonton sebelum validasi. Test `tests/Feature/Tasks/RequestAuthorizationOrderTest.php` (3; tampilan tersimpan sudah 404 lewat binding workspace — pagar).
- **Pencarian**: gate `search` (karyawan aktif) di `SearchController::index/results`. Test `SearchTest` (+1).

---

## Hasil pemeriksaan

`rk_test` 1817 test hijau · `composer lint` (Pint + Larastan level 8) bersih · `npm run typecheck` · `npm run lint` · `npm test` (261) hijau. `main` sudah di-merge (lampiran tugas & komentar); konflik di `TaskDetail`, `CommentBroadcastEvent`, `workspace-channel.ts`, `use-task-detail.ts` diselesaikan: event lampiran ikut daftar event tipis, timeline tetap memuat komentar sekali.

## Catatan / belum selesai

- Kanal absensi per perusahaan (lihat #30) menunggu perubahan di modul Absensi.
- Klaim mention/pengingat hanya berlaku untuk notifikasi sejak migrasi ini (tanpa backfill).
- Pesan 429 bawaan throttle (bukan kuota) masih teks bawaan Laravel di klien unggah.

## Cara mencoba manual (https://ruangkerja.test)

1. `kadiv@demo.test`: buka papan proyek di dua jendela (satu `anggota@demo.test`), keluarkan anggota dari workspace privat → jendela anggota tidak lagi menerima judul/isi; kartu yang berubah hilang (404).
2. `anggota@demo.test`: matikan Inbox untuk "Tugas lewat tenggat", biarkan email; jalankan `php artisan tasks:notify-deadlines` dua kali/dua hari → Mailpit (http://localhost:8026) hanya menerima satu email per tugas.
3. Ekspor dashboard dengan judul tugas `=HYPERLINK("http://contoh","x")` → di Excel tampil sebagai teks.
4. Edit komentar: hapus lalu tambah ulang `@nama` → orang itu hanya mendapat satu notifikasi.
