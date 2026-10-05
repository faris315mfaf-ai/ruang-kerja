# Sprint 4 — Ringkasan: Pengajuan & approval

Cabang `feat/sprint-4-pengajuan`. Dibangun di atas Sprint 1 core, lalu `feat/sprint-8-notifikasi` dan `main` (Sprint 1 login/karyawan/struktur, Sprint 2 absensi, Sprint 5 workspace, Sprint 7 Google, Sprint 8, Sprint 10A) di-merge. Rencana: `PLAN.md`.

## Acceptance criteria (docs/PROMPTS.md Sprint 4)

| Kriteria | Status | Bukti |
|---|---|---|
| Migrasi + model `leave_types`, `leave_balances`, `requests`, `approval_flows`, `approval_flow_steps`, `request_approvals`, `approval_delegations` | ✓ | `database/migrations/2026_10_05_4001*–4004*` (+ `request_sequences`, FK `attendance_days.request_id`), model di `app/Models`. Rollback diuji. DATABASE.md §3 diperbarui. |
| Admin HR: CRUD jenis & kuota; CRUD alur dengan langkah (atasan langsung, kepala divisi, peran, user) + kondisi jsonb; seed alur default Atasan → HR | ✓ | `/admin/pengajuan` (mockup AlurApproval: daftar jenis, editor langkah, kondisi "total lembur bulan ini > 40 jam", sakelar lewati-diri-sendiri & delegasi, pratinjau untuk contoh karyawan), `/admin/saldo-cuti` (jatah/bawaan per karyawan, "Buat saldo {tahun}"). Mobile: `DesktopOnlyNotice`. |
| Generator saldo tahunan (command + otomatis 1 Januari) dengan carry-over | ✓ | `requests:generate-balances {year?}`, jadwal `yearlyOn(1, 1, '00:05')` Asia/Jakarta; carry-over = min(sisa tahun lalu, `carry_over_max_days`); idempoten; cuti besar hanya untuk yang berhak (`min_service_months`). |
| Form per kategori (cuti rentang + setengah hari + hari kerja sesuai jadwal; izin jam/hari; sakit + lampiran wajib > N hari di disk privat; lembur tanggal + jam; koreksi tanggal + jam; dinas luar); tampilkan sisa saldo & validasi tumpang tindih | ✓ | `/pengajuan/baru` desktop (FormPengajuan: kartu kategori, ringkasan langsung, kalender bulan, rekan yang tidak masuk, alur) & mobile (MFormPengajuan: chip, sakelar setengah hari, "Ambil foto"/"Pilih file", bilah aksi bawah). Ringkasan dari `GET /pengajuan/pratinjau`. Simpan draf. |
| Nomor berurutan (CUT-2026-10-0001), aman race condition | ✓ | `RequestNumberGenerator`: satu `INSERT … ON CONFLICT DO UPDATE … RETURNING` (row lock Postgres) per prefiks+bulan kantor. |
| ApprovalFlowResolver + ApproveStep/RejectStep/RequestRevision (ARCHITECTURE §3.4), delegasi, lompat bila penyetuju = pemohon | ✓ | `app/Domain/Requests/Services/ApprovalFlowResolver.php`, `Actions/*`. Kondisi dievaluasi saat kirim; penyetuju diresolusi saat langkah aktif; delegasi aktif → delegate (`delegated_from_id`) + `requests:route-delegations` harian & saat delegasi dibuat; pemohon = penyetuju → dilewati (atau naik ke atasan bila sakelar mati); penyetuju yang sudah menyetujui → dilewati; semua terlewati → cadangan HR → Direksi → Super Admin. |
| Efek setelah disetujui: saldo pending → used; tulis `attendance_days`, `overtime_minutes`, koreksi; batal sebelum diputus mengembalikan pending | ✓ | `BalanceLedger` (lockForUpdate + CHECK DB), `AttendanceDayEffects` (status cuti/izin/sakit/dinas + `request_id`, lembur dari `ApprovedOvertime`, koreksi jam + status + audit), `CancelRequest`. |
| Halaman Pengajuan Saya (daftar + detail timeline), Persetujuan (antrean, aksi massal setuju), detail dengan lampiran | ✓ | `/pengajuan` (PengajuanSaya / MPengajuanSaya), `/pengajuan/{id}`, `/persetujuan` (Persetujuan: tabel + pilih massal + panel keputusan; MPersetujuan: kartu geser Tolak/Setujui, sheet alasan), `/persetujuan/{id}` (MPersetujuanDetail, "1 dari 5", lanjut ke berikutnya). Delegasi lewat dialog. |
| Notifikasi database + email di setiap langkah | ✓ | Kelas di `app/Domain/Requests/Notifications` di atas `BaseNotification` Sprint 8 (preferensi, Inbox, broadcast, email bermerek). "Perlu tindakan" diselesaikan saat diputus/dibatalkan/dikirim ulang. Tipe baru `request.canceled`. |
| **Test:** alur 2 langkah lengkap | ✓ | `ApprovalFlowTest` "runs a complete two-step flow" |
| tolak di langkah 1 menghentikan alur | ✓ | `ApprovalFlowTest` "stops the flow when step 1 rejects" |
| kondisi lembur menambah langkah Direksi | ✓ | `ApprovalFlowTest` "adds the Direksi step only when monthly overtime exceeds 40 hours" (38 jam → dilewati, 42 jam → Direksi) |
| delegasi aktif mengarahkan ke delegate | ✓ | `ApprovalFlowTest` "routes the step to an active delegate", "ignores delegations outside their period…" |
| pemohon tidak bisa menyetujui diri sendiri | ✓ | `ApprovalFlowTest` "never lets a requester approve their own request", "skips a step whose approver is the requester" |
| saldo tidak bisa minus | ✓ | `BalanceAndOverlapTest` "never lets a balance go negative" (+ CHECK DB) |
| pengajuan tumpang tindih ditolak | ✓ | `BalanceAndOverlapTest` "rejects overlapping requests" |
| cuti yang disetujui membuat close-day tidak menandai alpha | ✓ | `AttendanceIntegrationTest` "approved leave prevents close-day alpha" (+ alpha yang sudah tertulis diganti saat cuti/sakit disetujui) |

Test modul: **94 Pest** di `tests/Feature/Requests` (607 asersi) + Vitest `lib/requests.test.ts`, `features/admin-requests/flow-summary.test.ts`. Seluruh repo (setelah merge `main` terakhir, termasuk Sprint 5): **1262 Pest hijau**, **191 Vitest hijau**; `composer lint` (Pint + Larastan level 8), `npm run typecheck`, `npm run lint` hijau.

## Cara uji manual (https://ruangkerja.test, sandi `password`)

`php artisan migrate:fresh --seed` membuat alur (Default, Lembur bersyarat > 40 jam, Cuti besar, Dinas luar), 7 jenis (CUT 12 hari + bawaan maks. 5, CBR, SKT lampiran > 1 hari, IZN, LBR, KOR maks. 7 hari, DNS), saldo tahun berjalan, dan pengajuan demo.

1. **anggota@demo.test (Rizky)** → Pengajuan: saldo "12 hari tersisa" (jatah 12 + bawaan 2 · terpakai 2), riwayat (izin disetujui, lembur ditolak dengan alasan, cuti & sakit lama), cuti minggu depan menunggu Dimas. Klik baris → panel detail + timeline + "Batalkan pengajuan". **Ajukan baru** → coba tiap kategori; ringkasan kanan berubah (hari kerja tanpa libur, saldo 12 → 9, "Nadia Putri juga tidak masuk…", alur Dimas → HR). Coba rentang yang menabrak cuti lain → pesan tumpang tindih. Ponsel 390 px: chip kategori, sakelar setengah hari, Ambil foto.
2. **kadiv@demo.test (Dimas)** → Persetujuan (badge 3): pilih dua baris → "Setujui 2 pengajuan"; panel kanan: Tolak tanpa catatan → galat, Minta revisi. Ponsel: geser kartu ke kiri → Tolak (sheet alasan) / Setujui; ketuk kartu → detail "1 dari 3". Tombol **Delegasi** → tunjuk rekan + periode → langkah yang menunggu pindah ke delegate.
3. **hr@demo.test (Hana)** → Persetujuan: cuti Maya menunggu HR (langkah 2). Admin › **Jenis pengajuan**: pilih Lembur, ubah kondisi/urutan, lihat pratinjau, Simpan alur; "…" → Ubah jenis (kuota, lampiran wajib, masa kerja). Admin › **Saldo cuti**: ubah jatah, "Buat saldo 2027".
4. **direksi@demo.test (Hendra)** → Persetujuan: cuti Hana menunggu (langkah HR akan dilewati karena Hana satu-satunya HR → cadangan).
5. Absensi: setujui cuti Rizky sampai akhir, lalu `php artisan attendance:close-day --date=<tanggal cuti>` → hari itu berstatus Cuti, bukan Alpha. Koreksi absensi Sari yang disetujui mengisi jam check-out di riwayat absensinya.

## Keputusan

1. Model di `app/Models` (konvensi), logika di `app/Domain/Requests/{Actions,Services,Enums,Data,Contracts,Support,Notifications,Digest}`. Model pengajuan bernama **`EmployeeRequest`** (tabel `requests`) agar tidak bentrok dengan `Illuminate\Http\Request`.
2. `leave_types.code` = prefiks nomor (CUT, IZN, …, sesuai mockup), unik per perusahaan termasuk yang terhapus; periode nomor = bulan pengiriman (waktu kantor). Draf belum bernomor (`number` nullable).
3. Semua langkah direncanakan saat kirim (kondisi dievaluasi saat itu; tidak terpenuhi → `skipped` dengan penjelasan "38 jam, tidak lebih dari 40 jam"); penyetuju diresolusi saat langkah aktif. Status langkah tambahan `queued`. Salinan tipe/peran langkah disimpan di `request_approvals` sehingga perubahan alur hanya berlaku untuk pengajuan baru.
4. Langkah **peran**: siapa pun pemegang peran (selain pemohon, satu perusahaan) boleh memutus; `approver_id` terisi saat diputus. Delegasi berlaku untuk langkah personal (atasan, kepala divisi, user).
5. Kepala divisi tanpa kepala (null) → naik ke divisi induk. Atasan langsung tidak ada → langkah dilewati. Semua langkah terlewati → cadangan peran `config('requests.fallback_roles')`.
6. Revisi: pemohon mengubah & kirim ulang → putaran baru (`round + 1`), nomor tetap, riwayat putaran lama tampil di timeline; saldo dilepas saat revisi dan dipesan ulang saat kirim ulang.
7. Saldo hanya untuk jenis ber-kuota; pengajuan lintas tahun untuk jenis ber-kuota ditolak ("pisahkan per tahun"); cuti besar memakai `min_service_months`.
8. Tumpang tindih: cuti/izin/sakit/dinas saling bentrok; lembur dengan lembur; koreksi dengan koreksi. Yang dihitung: pending, revision_requested, approved.
9. Hari kerja = `ScheduleResolver` (pola shift + override + libur); karyawan tanpa penugasan shift (mis. Direksi) → Senin–Jumat minus libur perusahaan.
10. Efek absensi: hari yang sudah check-in tidak ditimpa cuti; lembur = jumlah lembur disetujui per tanggal (`ApprovedOvertime`) dan disinkronkan juga saat `attendance:close-day` (lembur yang disetujui sebelum harinya); koreksi menghitung ulang terlambat/pulang cepat/menit kerja dan dicatat `attendance_day.corrected`. Izin per jam tidak mengubah status hari.
11. Lampiran: tabel `attachments` Sprint 7 (`source = storage`) di disk privat `local` (`config/requests.php`), maks. 5 berkas PDF/JPG/PNG 5 MB, unduh lewat rute ber-policy + audit.
12. Badge Persetujuan = shared prop `approvals.pending` (closure, satu `count`). Delegasi juga bisa diakhiri HR.
13. Notifikasi: `UserAvailability` = cuti/sakit/izin harian/dinas yang disetujui (tahan notifikasi saat cuti); seksi ringkasan harian "Menunggu persetujuan Anda" ditambahkan sebelum `InboxActionSection` (keduanya bisa memuat item yang sama — lead dapat mencabut salah satu).
14. Seeder demo tidak menulis audit log (baris audit dari aksi demo dihapus) agar sesuai `OrganizationSeederTest`; di produksi tanpa perusahaan seeder tidak melakukan apa pun.
15. "Kirim tautan ke email saya" di banner desktop-only memakai versi `main` (Salin tautan).
16. Aksi massal desktop hanya **Setujui** (tolak butuh alasan per pengajuan).

## Paket baru

Tidak ada (memakai yang sudah terpasang). `composer install`/`npm install` hanya menyinkronkan lockfile hasil merge `main`.

## Perubahan di luar modul (kecil, perlu diperhatikan saat integrasi)

- `CloseAttendanceDay`: menyinkronkan `overtime_minutes` dari lembur disetujui; baris sistem dengan lembur tidak dihapus.
- `SwipeableRow`: aksi disembunyikan saat diam (tidak ada garis tipis di tepi kartu).
- `NotificationType`: case baru `RequestCanceled`. `config/notifications.php`: seksi digest `PendingApprovalsSection`.
- `navigation.ts`: `badge`, admin "Jenis pengajuan" & "Saldo cuti" (desktopOnly); `navigation.test.ts` diperbarui.

## Sisa pekerjaan / risiko

- Test konkurensi nomor berjalan sekuensial (RefreshDatabase satu koneksi); keamanan race bergantung pada upsert atomik Postgres.
- Pembatalan pengajuan yang **sudah disetujui** (oleh HR) belum ada UI; `AttendanceEffects::revert()` sudah tersedia.
- Lembur yang disetujui untuk hari tanpa baris absensi baru tercatat saat baris itu ada (check-in/tutup hari).
- ~~Pencarian ⌘K untuk pengajuan~~ — selesai Sprint 10B (`RequestSearchProvider`).
