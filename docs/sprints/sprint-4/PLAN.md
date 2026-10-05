# Sprint 4 — Rencana: Pengajuan & approval

Acuan: `docs/PROMPTS.md` blok Sprint 4 (acceptance criteria), `docs/PRD.md` M2 (Pengajuan & approval), `docs/DATABASE.md` §3, `docs/ARCHITECTURE.md` §3.4, `docs/PLATFORM.md`, mockup `FormPengajuan`, `MFormPengajuan`, `PengajuanSaya`, `MPengajuanSaya`, `Persetujuan`, `MPersetujuan`, `MPersetujuanDetail`, `AlurApproval`. Fondasi: `docs/sprints/sprint-1/CORE.md`.

## Urutan kerja

1. Skema + model + enum + factory + policy.
2. Domain: nomor, saldo, durasi/hari kerja, resolver alur, Action submit/approve/reject/revisi/batal, generator saldo, admin.
3. HTTP + halaman (desktop & mobile), badge sidebar, admin HR (desktop saja).
4. Notifikasi (pakai infrastruktur Sprint 8 bila `HOW-TO-NOTIFY.md` sudah ada, selain itu Notification Laravel biasa).
5. Seeder demo.
6. Integrasi absensi: kontrak `AttendanceEffects` + `WorkingDayCalculator`; implementasi nyata setelah `feat/sprint-2-absensi` selesai (merge), plus test "cuti disetujui → close-day tidak alpha".
7. Merge `main`, ringkasan.

## Skema (DATABASE.md §3, + tambahan yang didokumentasikan)

| Tabel | Catatan / tambahan |
|---|---|
| `approval_flows` | + `skip_self_approval` bool (default true), `allow_delegation` bool (default true), `deleted_at` — dua sakelar di mockup AlurApproval |
| `approval_flow_steps` | sesuai dokumen; `condition` jsonb `{"overtime_month_minutes_gt": 2400}` (kunci `<metrik>_<op>`, metrik `overtime_month_minutes` · `days` · `minutes`, op `gt` · `gte` · `lt` · `lte`, semua kunci AND) |
| `leave_types` | `code` dipakai juga sebagai prefiks nomor (CUT, IZN, SKT, LBR, KOR, DNS, CBR — sesuai mockup). + `description`, `max_backdate_days` (koreksi "maks. 7 hari lalu"), `min_service_months` (cuti besar "Belum berhak"), `is_active`, `sort_order`, `deleted_at` |
| `leave_balances` | CHECK: semua kolom ≥ 0 dan `entitled + carried − used − pending ≥ 0` (saldo tidak pernah minus, juga di level DB) |
| `requests` | `number` nullable (draf belum bernomor; unik bila terisi). + `substitute_id` (pengganti selama cuti), `round` (putaran setelah revisi) |
| `request_approvals` | + `round`, `approver_type`, `approver_role`, `activated_at`; status + `queued` (langkah berikutnya, belum aktif). `approver_id` null untuk langkah peran yang masih menunggu (siapa pun pemegang peran boleh memutus; terisi saat diputus) |
| `approval_delegations` | + `reason` |
| `request_sequences` | baru: `key` unik (mis. `CUT-2026-10`), `last_number`. Nomor diambil dengan satu `INSERT … ON CONFLICT DO UPDATE … RETURNING` (atomik, row lock Postgres) |

Lampiran pengajuan: disk privat `local` (`storage/app/private/request-attachments/...`), baris di tabel `attachments` (Sprint 7, `source = storage`); unduh lewat controller + policy + audit `request.attachment_viewed`. (Rencana awal: metadata di payload — diganti setelah Sprint 7 masuk `main`.)

## Domain (`app/Domain/Requests`, model di `app/Models`)

- Enum: `RequestCategory`, `RequestStatus`, `ApprovalStatus`, `ApproverType`, `ConditionMetric`.
- Model: `EmployeeRequest` (tabel `requests`; nama `Request` bentrok dengan `Illuminate\Http\Request`), `LeaveType`, `LeaveBalance`, `ApprovalFlow`, `ApprovalFlowStep`, `RequestApproval`, `ApprovalDelegation`.
- Service: `RequestNumberGenerator`, `BalanceLedger` (reserve/release/consume dengan `lockForUpdate`), `RequestDurationCalculator`, `OverlapDetector`, `ConditionEvaluator`, `ApproverResolver`, `ApprovalFlowResolver` (rencana langkah + aktivasi langkah: delegasi, lewati diri sendiri, lewati penyetuju yang sudah menyetujui), `ApprovalQueue` (antrean & hitungan badge), `RequestPreview` (ringkasan form).
- Kontrak: `Contracts\AttendanceEffects` (`applyAbsence`, `applyOvertime`, `applyCorrection`, `revert`), `Contracts\WorkingDayCalculator` (`workingDates`). Default: no-op & Senin–Jumat; di-bind di `RequestsServiceProvider`.
- Action: `SaveRequestDraft`, `SubmitRequest`, `ApproveStep`, `RejectStep`, `RequestRevision`, `CancelRequest`, `BulkApprove`, `GenerateAnnualBalances`, `SaveLeaveType`, `DeleteLeaveType`, `SaveApprovalFlow`, `DeleteApprovalFlow`, `UpdateLeaveBalance`, `SaveApprovalDelegation`, `DeleteApprovalDelegation`.
- Command `requests:generate-balances {year?}` + jadwal 1 Januari 00.05 Asia/Jakarta (carry-over = min(sisa tahun lalu, `carry_over_max_days`)).

### Aturan inti (keputusan)

- Alur dipilih dari `leave_types.approval_flow_id`; tanpa alur → alur default perusahaan (nama "Default").
- Semua langkah direncanakan saat submit (kondisi dievaluasi saat itu; tidak terpenuhi → `skipped` dengan catatan). Langkah aktif berikutnya diresolusi saat aktif (delegasi berlaku pada tanggal aktivasi).
- Penyetuju = pemohon → langkah dilewati (`skip_self_approval`), atau naik ke atasan pemohon (`ManagerHierarchy::chainOf`) bila sakelar mati. Atasan langsung tidak ada → dilewati. Penyetuju yang sama dengan yang sudah menyetujui langkah sebelumnya → dilewati. Semua langkah terlewati → cadangan: peran HR → Direksi → Super Admin (pemegang selain pemohon).
- Delegasi aktif (tanggal kantor) mengarahkan langkah ke delegate (`delegated_from_id`); delegate juga bisa memutus langkah yang sudah menunggu sebelum delegasi dimulai.
- Saldo: hanya jenis dengan `annual_quota_days`. Submit → `pending += days`; disetujui → `pending → used`; tolak/revisi/batal → `pending` dikembalikan. Cuti lintas tahun ditolak ("pisahkan per tahun").
- Tumpang tindih ditolak: kategori ketidakhadiran (cuti/izin/sakit/dinas) saling bentrok; lembur dengan lembur; koreksi dengan koreksi pada tanggal sama. Status yang dihitung: pending, revision_requested, approved.
- Batal: pemohon, selama status `draft` / `pending` / `revision_requested`.
- Revisi: pemohon mengubah lalu mengirim ulang → putaran baru (`round + 1`), riwayat putaran lama tetap.

## HTTP & halaman

`routes/requests.php` (dimuat satu baris dari `routes/web.php`; placeholder `pengajuan` & `persetujuan` dihapus).

| Rute | Halaman | Desktop | Mobile |
|---|---|---|---|
| `/pengajuan` | `requests/index` | kartu saldo + tabel + panel detail kanan (PengajuanSaya) | kartu saldo geser + chip filter + kartu (MPengajuanSaya), FAB |
| `/pengajuan/baru`, `/pengajuan/{id}/ubah` | `requests/form` | tab kategori + form + ringkasan/kalender/alur (FormPengajuan) | chip kategori + form + ringkasan + bilah aksi bawah (MFormPengajuan) |
| `/pengajuan/{id}` | `requests/show` | detail + timeline | layar penuh |
| `/persetujuan` | `approvals/index` | tabel pilih massal + panel keputusan (Persetujuan) | kartu geser Tolak/Setuju (MPersetujuan) |
| `/persetujuan/{id}` | `approvals/show` | detail + keputusan | MPersetujuanDetail + bilah aksi bawah |
| `/admin/pengajuan` | `admin/request-types` | AlurApproval: daftar jenis + editor langkah & kondisi + pratinjau | `DesktopOnlyNotice` |
| `/admin/saldo-cuti` | `admin/leave-balances` | tabel saldo per karyawan/tahun, ubah jatah, buat saldo tahunan | `DesktopOnlyNotice` |

Badge sidebar Persetujuan: shared prop `approvals.pending` (closure → hanya dihitung saat dibutuhkan, satu query `count`).

## Otorisasi

`EmployeeRequestPolicy` (view: pemohon, penyetuju/delegate di pengajuan itu, `requests.view_all`, atau pemohon dalam `User::visibleTo`; update/submit: pemohon saat draf/revisi; cancel; decide: penyetuju langkah aktif ≠ pemohon), `RequestApprovalPolicy`, `LeaveTypePolicy`, `ApprovalFlowPolicy`, `ApprovalFlowStepPolicy`, `LeaveBalancePolicy`, `ApprovalDelegationPolicy`. List lewat `EmployeeRequest::visibleTo($user)`. Keputusan approval & lihat lampiran → `audit_logs`.

## Test (Pest)

Acceptance: alur 2 langkah lengkap; tolak di langkah 1 menghentikan alur; kondisi lembur > 40 jam menambah Direksi; delegasi aktif → delegate; pemohon tidak bisa menyetujui diri sendiri (+ lewati otomatis); saldo tidak bisa minus; tumpang tindih ditolak; cuti disetujui → close-day tidak alpha (setelah merge Sprint 2). Ditambah: nomor berurutan per prefiks/bulan, batal mengembalikan pending, revisi & kirim ulang, generator saldo + carry-over, lampiran wajib sakit > N hari & disk privat, matriks policy peran × aksi, controller/halaman, admin CRUD, notifikasi.

## Risiko

- Efek absensi & hari kerja bergantung Sprint 2 (`attendance_days`, shift, libur) — dibangun di balik kontrak.
- Tabel `notifications` milik Sprint 8.
- Tabel `attachments` milik Sprint 7 — sudah tersedia lewat merge `main`.
