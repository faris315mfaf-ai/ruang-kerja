# Sprint 2, 4, 5 — Perbaikan hasil code review

Cabang `fix/sprint-2-4-5-review`. Satu commit per temuan (`fix(<area>): ...`). Setiap temuan diverifikasi dulu di kode, lalu diberi test regresi yang **gagal sebelum perbaikan** (dicek dengan menjalankan test baru terhadap kode lama via `git stash` kode aplikasi) dan hijau sesudahnya. Beberapa test tambahan sengaja ikut lulus di kode lama karena berfungsi sebagai pagar perilaku (disebut di bawah). `main` (termasuk Sprint 3 QR/rekap, Sprint 7 Drive bagian B, dan Sprint 9 dashboard) sudah di-merge; seluruh pemeriksaan hijau setelah merge.

| # | Tingkat | Commit |
|---|---|---|
| 1 | High | `4612d77` fix(requests): one person approves at most one step per round |
| 2 | Medium | `641139a` fix(attendance): allow check-in on half-day leave and business trips |
| 3 | Medium | `2d54254` fix(requests): allow overnight attendance corrections for night shifts |
| 4 | Medium | `4284c62` fix(requests): fill carry-over on balances created before the yearly run |
| 5 | Medium | `617b665` fix(workspaces): drop former owners from division and team workspaces |
| 6 | Medium | `f10117f` fix(requests): make delegation routing cycle-free and reversible |
| 7 | Low | `cc7ab7b` fix(requests): re-check overlaps under a per-user lock when submitting |
| 8 | Low | `4a59124` fix(requests): bulk approve role steps without requests.view_all |
| 9 | Low | `81a8e16` fix(requests): compute queue colleague warnings in one batch |
| 10 | Low | `12a8be4` fix(workspaces): never reveal invisible workspaces via redirects or validation |
| 11 | Low | `88dfdcb` fix(workspaces): resolve workspace keys within the user's company |
| 12 | Low | `25929fd` fix(tasks): lock columns before deleting a board column |
| 13 | Low | `8539f3e` fix(tasks): load quick-create options without N+1 queries |
| 14 | Low | `a28a796` fix(attendance): broadcast attendance to parent division channels too |

Migrasi baru (semua bisa di-rollback, diuji `migrate:rollback` + `migrate`): `2026_10_06_200100_add_request_portion_to_attendance_days`, `2026_10_06_200200_add_generated_at_to_leave_balances`, `2026_10_06_200300_mark_division_workspace_owner_rows_synced` (perbaikan data; `down()` sengaja kosong). `docs/DATABASE.md` diperbarui.

---

## 1. Satu orang bisa menyetujui dua langkah (High)

**Temuan.** `ApprovalQueue::canDecide` hanya memeriksa apakah aktor pemegang peran/penyetuju langkah. Kadiv yang juga HR bisa menyetujui langkah "Atasan langsung" lalu langkah peran HR. `ApprovalFlowResolver::resolve()` tidak mengecualikan penyetuju terdahulu untuk langkah peran maupun delegasi.

**Perbaikan.**
- `EmployeeRequest::approverIdsOfRound()`: semua `approver_id` **dan** `delegated_from_id` dari langkah yang sudah disetujui di putaran berjalan (delegator ikut dihitung — persetujuan delegate adalah persetujuan atas namanya).
- `canDecide()` menolak aktor yang ada di daftar itu; `waitingFor()` (antrean, badge, digest) menyaring dengan `NOT EXISTS` yang sama.
- `resolve()` langkah peran: bila semua pemegang peran (selain pemohon) sudah menyetujui, langkah dialihkan ke peran cadangan berikutnya (`config('requests.fallback_roles')`: HR → Direksi → Super Admin), `approver_role` langkah ikut diganti dan catatan "Pemegang peran HR sudah menyetujui di langkah sebelumnya; dialihkan ke Direksi." Bila tidak ada cadangan → langkah dilewati.
- Delegasi tidak pernah diarahkan ke delegate yang sudah menyetujui (saat aktivasi maupun di `RouteToDelegates`).

**Test.** `tests/Feature/Requests/ApprovalSeparationTest.php` (5 test): Kadiv HR menyetujui langkah atasan lalu ditolak di langkah HR (antrean 0, `can('decide')` false, `ApproveStep` melempar); HR tunggal sudah menyetujui → langkah pindah ke Direksi; delegate = penyetuju terdahulu → langkah tetap di penyetuju asli (termasuk job harian); langkah yang terlanjur di tangan penyetuju terdahulu ditolak; delegator tidak bisa menyetujui lagi setelah delegate-nya memutus.

## 2. Cuti setengah hari & dinas luar memblokir check-in (Medium)

**Temuan.** `CheckIn::pickSchedule` menolak semua hari ber-status pengajuan (`dayHasRequest`), termasuk cuti/izin setengah hari dan dinas luar; `LocationVerifier` menolak check-in di luar geofence saat dinas; `AttendanceDayEffects` tidak menyimpan porsi setengah hari.

**Perbaikan.**
- Kolom baru `attendance_days.request_portion` (`full` | `half_day`, CHECK; enum `RequestPortion`), diisi `applyAbsence()` dan di-backfill dari `requests.payload.half_day`.
- `AttendanceDay::blocksCheckIn()`: hanya cuti/izin/sakit **sehari penuh** yang memblokir. Setengah hari dan dinas (`business_trip`) boleh check-in/out.
- Check-in pada hari pengajuan mempertahankan status pengajuan dan `request_id`, `late_minutes` = 0; check-out tidak menghitung pulang cepat.
- Dinas: `DaySchedule::asBusinessTrip()` → `allowsRemoteCheckIn()` true (catatan wajib, metode `wfh`), juga di prop halaman Absensi (`allowsRemote`) agar klien meminta catatan.
- Setengah hari yang disetujui **setelah** check-in: baris ditautkan (`request_id`, `request_portion`) tanpa ditimpa status absen; dinas setelah check-in menjadi status Dinas. `revert()` mengembalikan hari yang sempat dikerjakan menjadi absensi biasa.
- Papan "Absensi hari ini" (Sprint 3, dari merge `main`): hari setengah-cuti/dinas yang sudah check-in tampil hadir, bukan "cuti".

**Test.** `tests/Feature/Requests/RequestDayCheckInTest.php` (4 test): check-in/out pada cuti setengah hari (status & request tetap, tutup hari tidak mengubah); cuti sehari penuh tetap ditolak; dinas di luar radius tanpa catatan → `note_required`, dengan catatan → diterima, check-out lapangan; setengah hari disetujui setelah check-in + revert.

## 3. Koreksi lintas tengah malam mustahil (Medium)

**Temuan.** `RequestDurationCalculator::correction()` menolak jam pulang ≤ jam masuk, padahal `AttendanceDayEffects` sudah menggeser jam pulang ke hari berikutnya.

**Perbaikan.** Kontrak `WorkingDayCalculator::crossesMidnight(User, date)` (implementasi jadwal: shift hari itu `crosses_midnight`; fallback Senin–Jumat: false). Jam pulang ≤ jam masuk diterima hanya bila shift tanggal itu lintas tengah malam, dengan batas 16 jam ("Jam kerja lintas tengah malam maksimal 16 jam."). Shift siang tetap ditolak.

**Test.** `tests/Feature/Requests/OvernightCorrectionTest.php` (3 test): shift malam 22.05 → 06.10 diterima dan diterapkan sebagai 06.10 hari berikutnya (menit kerja benar); batas 16 jam; shift siang tetap ditolak (pagar perilaku, lulus juga di kode lama). `DurationTest` ikut diperbarui untuk kontrak baru.

## 4. Carry-over hilang bila saldo tahun depan dibuat lebih awal (Medium)

**Temuan.** `BalanceLedger::balanceFor()` membuat saldo tahun berikutnya tanpa carry-over saat cuti Januari diajukan di Desember; `GenerateAnnualBalances` melewati baris yang sudah ada, jadi carry-over tidak pernah diisi.

**Perbaikan.** Kolom `leave_balances.generated_at`: kapan carry-over ditetapkan. Generator membuat baris baru dengan `generated_at`, dan untuk baris yang sudah ada tetapi `generated_at` null mengisi carry-over **tepat sekali** (dengan row lock) — dilaporkan sebagai "dilengkapi" (`completed`) di command dan toast admin. Ubahan HR (`UpdateLeaveBalance`) menetapkan `generated_at` sehingga tidak ditimpa. Migrasi menandai baris yang sudah punya carry-over > 0.

**Test.** `AttachmentAndBalanceGeneratorTest`: "fills the carry-over of a next-year balance created early, exactly once" (saldo dibuat Desember → generator 1 Januari mengisi 5 hari, pending tetap, run kedua tidak mengubah) dan "never overwrites a carry-over HR already set" (pagar perilaku).

## 5. Workspace divisi menyimpan mantan pemilik (Medium)

**Temuan.** `CreateWorkspace` menulis baris pemilik dengan `is_synced = false`; `MemberSynchronizer` lalu menurunkan mantan pemilik menjadi admin selamanya, walau bukan lagi kepala maupun anggota divisi.

**Perbaikan.** Baris pemilik yang dibuat otomatis untuk workspace divisi/tim kini `is_synced = true`, sehingga sinkron berikutnya menghapus mantan pemilik/kepala (atau Super Admin cadangan) yang bukan anggota; yang masih anggota turun ke peran sinkron (member). Anggota manual tidak disentuh; baris pemilik lama yang manual tetap turun ke admin. Migrasi data menandai baris pemilik saat ini pada workspace divisi/tim (tertaut tim) sebagai synced.

**Test.** `SyncDivisionMembersTest` (+3): kepala dari luar divisi diganti → dihapus, anggota manual tetap; Super Admin cadangan dihapus saat divisi mendapat kepala; owner row synced hanya untuk workspace divisi/tim (proyek tidak). `WorkspaceSeederTest` diperbarui (GDG: 4 baris synced, termasuk pemilik).

## 6. Routing delegasi (Medium)

**Temuan.** `SaveApprovalDelegation` menerima siklus (A→B, B→A); `RouteToDelegates` tidak berurutan tetap dan menimpa `delegated_from_id`; `activeDelegate` hanya satu lompatan; menghapus/berakhirnya delegasi meninggalkan langkah di delegate.

**Perbaikan.**
- `SaveApprovalDelegation`: tolak siklus langsung maupun berantai pada periode yang beririsan ("Delegasi tidak boleh melingkar.").
- `ApproverResolver::activeDelegate`: mengikuti rantai (A→B→C = C) dengan visited set; berhenti di siklus atau delegate nonaktif.
- `RouteToDelegates` ditulis ulang sebagai rekonsiliasi: urutan tetap (`activated_at`, `id`); penyetuju asli = `delegated_from_id ?? approver_id` tidak pernah ditimpa; delegasi aktif → ke delegate, tidak ada (kedaluwarsa/dihapus) → kembali ke penyetuju asli; tetap menghormati `allow_delegation`, pemohon, dan temuan #1.
- `DeleteApprovalDelegation` menjalankan rekonsiliasi untuk delegator & delegate; job harian menangani kedaluwarsa.

**Test.** `tests/Feature/Requests/DelegationRoutingTest.php` (5 test): siklus langsung & berantai ditolak (periode tak beririsan boleh); rantai diikuti dan siklus lama tidak berputar; delegate mendelegasikan lagi → `delegated_from_id` tetap delegator asli; hapus delegasi → kembali; kedaluwarsa → kembali (run kedua 0 perubahan).

## 7. Race tumpang tindih saat kirim (Low)

**Temuan.** `SubmitRequest` memeriksa tumpang tindih di luar transaksi; dua kiriman paralel orang yang sama bisa lolos keduanya.

**Perbaikan.** Pemeriksaan dipindah ke dalam transaksi setelah `pg_advisory_xact_lock(hashtextextended('requests.submit:<user>', 0))` — kiriman per orang berurutan, orang lain tidak terblokir.

**Test.** `tests/Feature/Requests/SubmitOverlapLockTest.php`: urutan query (lock lalu cek tumpang tindih, keduanya di dalam transaksi aksi); sesi lain memegang kunci karyawan → kiriman karyawan menunggu (lock timeout), kiriman manajer tetap jalan.

## 8. Setujui massal gagal untuk langkah peran tanpa `requests.view_all` (Low)

**Temuan.** `BulkApprove` memuat pengajuan lewat `visibleTo($actor)`; pemegang peran tanpa izin lihat-semua (mis. Kepala Divisi lain pada langkah peran) mendapat "tidak ditemukan".

**Perbaikan.** Dimuat berdasarkan id saja; otorisasi tetap di `ApproveStep` (DecisionGuard → `canDecide`). Toast hanya berisi jumlah, jadi tidak ada kebocoran per id.

**Test.** `ApprovalPagesTest` "bulk-approves role steps for approvers without requests.view_all".

## 9. N+1 di halaman Persetujuan (Low)

**Temuan.** `ApprovalController` memanggil `ColleagueAbsences::around()` per kartu antrean (3 query × hingga 100 kartu).

**Perbaikan.** `ColleagueAbsences::forRequests()` menghitung peringatan semua kartu dengan jumlah query tetap (ukuran tim/divisi via `GROUP BY` + satu query absensi rekan untuk rentang gabungan, disaring per kartu di PHP, maks. 20 per kartu seperti sebelumnya). `request.user.team` ikut di-eager-load. `around()` (detail/form) memakai helper yang sama.

**Test.** `ApprovalPagesTest`: "builds the approval queue with a fixed number of queries" (2 vs 8 kartu → jumlah query sama, cache izin dipanaskan dulu) dan kesetaraan hasil kartu dengan `around()`.

## 10. Kebocoran keberadaan workspace (Low)

**Temuan.** Binder `/w/{workspace}` mengalihkan key lama/huruf kecil (301) sebelum otorisasi; FormRequest workspace/tugas memvalidasi (422) sebelum `Gate` di controller — keduanya membocorkan keberadaan workspace privat.

**Perbaikan.** Binder memeriksa `view` sebelum redirect (404 bila tidak boleh melihat). Trait `App\Http\Requests\Concerns\HidesInvisibleWorkspaces` di `TaskRequest`, `MoveTaskRequest`, `LabelRequest`, `TaskStatusRequest`, `UpdateWorkspaceRequest`, `WorkspaceMemberRequest`: `authorize()` menjawab 404 untuk non-viewer workspace/tugas, sehingga validasi tidak pernah jalan lebih dulu. Viewer tetap mendapat 422/403 seperti sebelumnya.

**Test.** `tests/Feature/Workspaces/WorkspaceExistenceLeakTest.php` (3 test): key lama/huruf kecil → 404 untuk orang luar, 301 untuk anggota; PATCH/POST workspace, label, kolom, anggota, tugas dengan data salah → 404 untuk orang luar; PATCH tugas & pindah tugas → 404.

## 11. `Workspace::findByKey` tidak dibatasi perusahaan (Low)

**Perbaikan.** `findByKey(string $key, ?string $companyId)` mencari key dan `previous_keys` hanya di perusahaan pengguna; binder meneruskan `company_id` pengguna yang masuk.

**Test.** `tests/Feature/Workspaces/WorkspaceKeyScopeTest.php` (2 test, dua perusahaan dengan key sama): `/w/OPS` membuka workspace perusahaan sendiri; key lama `OLD` dialihkan ke workspace perusahaan sendiri.

## 12. Race saat menghapus kolom (Low)

**Temuan.** `DeleteTaskStatus` memeriksa "kolom terakhir" dan "ada tugas" di luar transaksi; tugas yang dibuat/dipindah ke kolom itu di antaranya membuat hapus gagal (FK) atau dua hapus paralel menyisakan nol kolom.

**Perbaikan.** Di dalam transaksi, semua kolom workspace dikunci dulu (`FOR UPDATE`, urutan id → tanpa deadlock; `CreateTask`/`MoveTask` mengunci kolom tujuan sehingga terserialisasi), lalu pemeriksaan diulang; kolom yang sudah terhapus diabaikan.

**Test.** `tests/Feature/Tasks/DeleteTaskStatusTest.php`: kunci kolom terjadi sebelum cek tugas, keduanya di dalam transaksi; perilaku tujuan/kolom asing/kolom terakhir (pagar perilaku).

## 13. N+1 di opsi form tugas (Low)

**Perbaikan.** `TaskFormOptionsController` memakai `withMembershipOf($user)` (peran sendiri untuk policy) dan eager-load `memberships.user`; `WorkspacePage::members()` memakai relasi yang sudah dimuat.

**Test.** `WorkspacePagesTest` "serves quick-create options with a fixed number of queries" (2 vs 6 workspace → jumlah query sama, anggota tetap lengkap).

## 14. `AttendanceRecorded` hanya ke divisi sendiri (Low)

**Perbaikan.** Event menyiarkan ke `division.{id}.attendance` untuk divisi karyawan **dan semua divisi induknya** (`Division::withAncestorIds()`, aman dari siklus), karena Kepala Divisi juga memimpin sub-divisinya (`ledDivisionIds` sudah menyertakan turunan untuk otorisasi channel).

**Test.** `AttendanceBroadcastTest` "the event also reaches the channels of every parent division" (tiga tingkat divisi).

---

## Keputusan

1. Delegator dihitung "sudah menyetujui" bila delegate-nya memutus langkah atas namanya (#1) — konsisten dengan `delegated_from_id`.
2. Peran cadangan saat semua pemegang peran sudah menyetujui mengikuti `requests.fallback_roles` (melewati peran yang sama). Bila alur memang punya langkah Direksi setelahnya, Direksi yang memutus langkah cadangan akan membuat langkah Direksi berikutnya juga pindah ke cadangan (Super Admin) atau dilewati — prinsip "satu orang satu langkah" diutamakan.
3. Hari setengah hari/dinas yang sudah check-in tidak dihitung terlambat/pulang cepat (jamnya dijelaskan pengajuan); dinas = metode `wfh` dengan catatan wajib.
4. Kunci per pengguna saat kirim pengajuan memakai advisory lock Postgres (tidak mengunci baris `users`).
5. Baris `admin` mantan pemilik yang sudah diturunkan sebelum perbaikan #5 tidak bisa dibedakan dari admin manual; dibiarkan (HR/pemilik bisa menghapusnya).

## Sisa / risiko

- Koreksi manual HR (`CorrectAttendance`, Sprint 3) masih menolak semua tanggal ber-status pengajuan, termasuk setengah hari/dinas yang lupa check-out; koreksi tetap bisa lewat pengajuan koreksi karyawan.
- Pengingat check-in (`SendCheckInReminders`) tetap tidak dikirim pada hari setengah cuti/dinas (sengaja tidak mengganggu).
- Dashboard Sprint 9 (`PersonalDashboard`, `TodayAttendance`) masih menghitung hari ber-status pengajuan sebagai "tidak di tempat" walau sudah check-in (setengah hari/dinas); bisa disesuaikan dengan `AttendanceDay::blocksCheckIn()`/`request_portion` bila diinginkan.
- Saluran broadcast `workspace.{id}` sekarang menjawab 404 (bukan 403) untuk non-viewer karena binder; tetap ditolak.

## Pemeriksaan

Setelah merge `main` terakhir: **1570 Pest hijau** (`rk_test`), **229 Vitest hijau**, `composer lint` (Pint + Larastan level 8) hijau, `npm run typecheck` dan `npm run lint` hijau.
