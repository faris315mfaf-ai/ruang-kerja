# Fitur pengajuan — melengkapi celah modul Pengajuan

Cabang `feat/fitur-pengajuan` (di atas Sprint 4 + perbaikan review 2/4/5). Prinsip: hanya menambah yang belum ada, memperluas jalur kode yang sudah ada, tidak menghapus perilaku lama. Satu commit per butir.

| # | Butir | Status | Commit |
|---|---|---|---|
| 1 | Jenis cuti bawaan baru + penanda "Bawaan sementara" | ✓ | `feat(requests): default leave types …` |
| 2 | Autosave draf di perangkat (form desktop & mobile) | ✓ | `feat(requests): autosave unsent request form …` + perbaikan baseline |
| 3 | Saldo cuti: prorata, saldo awal, penyesuaian beraudit, impor CSV/XLSX | ✓ | `feat(requests): leave proration, opening balance …` |
| 4 | Privasi notifikasi & audit | ✓ | `feat(requests): keep decision notes and sick details out of email and audit` |
| 5 | Penyetuju pengganti tidak melihat data sakit | ✓ | `feat(requests): hide sick-leave details from substitute approvers` |

## 1. Jenis cuti bawaan & "Bawaan sementara"

- Seeder (`RequestSeeder`, idempoten) menambah **Cuti melahirkan** (`CML`), **Cuti alasan penting** (`CAP`), **Cuti di luar tanggungan** (`CLT`). CUT/CBR/SKT/IZN/LBR/KOR/DNS tetap; **Izin tetap satu jenis** dengan sakelar per jam/per hari yang sudah ada.
- Aturan (terinspirasi UU Ketenagakerjaan, sementara sampai ditinjau HR):
  - Melahirkan: kategori Cuti, tanpa saldo tahunan, **dihitung hari kalender**, maks. **90 hari kalender** per pengajuan, lampiran selalu wajib, dibayar.
  - Alasan penting: per peristiwa, maks. **3 hari kerja** per pengajuan, tanpa saldo (keterangan merinci menikah 3, anak menikah/khitan/baptis 2, istri melahirkan/keguguran 2, keluarga meninggal 2).
  - Di luar tanggungan: **tidak dibayar** (`is_paid` false), tanpa saldo → tidak memotong cuti tahunan; alur "Cuti besar" (Atasan → HR → Direksi).
- Kolom baru `leave_types` (migrasi `2026_10_08_410100`): `counts_calendar_days`, `max_days_per_request` (CHECK > 0), `is_provisional_default`. Hanya kolom yang tidak bisa dinyatakan dengan kolom lama.
- `RequestDurationCalculator`: jenis hari kalender menghitung `selisih hari + 1` (rentang akhir pekan saja tetap sah; efek absensi tetap hanya pada hari kerja); batas per pengajuan → "Maksimal 90 hari kalender per pengajuan untuk cuti melahirkan."
- **Bawaan sementara**: semua jenis yang dibuat seeder bertanda `is_provisional_default = true` (migrasi juga menandai jenis seeder lama yang belum pernah diubah, `updated_at = created_at`). Otomatis `false` saat HR menyimpan jenis (`SaveLeaveType`) atau menetapkan alurnya (`SaveApprovalFlow`). Seeder tidak pernah menimpa jenis yang sudah ada (termasuk yang dihapus).
- UI: lencana "Bawaan sementara" di daftar Admin › Jenis pengajuan, judul editor alur, dialog "Ubah jenis" (+ ajakan meninjau), dan petunjuk di bawah pemilih jenis pada form (`LeaveTypeHint`: keterangan, maks. per pengajuan, "Tidak dibayar"). Dialog jenis punya isian "Maks. per pengajuan" dan sakelar "Dihitung hari kalender". Satuan durasi "hari kalender/hari kerja/hari" (`LeaveType::dayUnit()`, `dayUnit()` di `lib/requests.ts`) dipakai di ringkasan, daftar, detail, email.

## 2. Draf otomatis di perangkat

- `features/requests/draft-storage.ts`: kunci `rk.request-draft.v1.<user>.<baru|id pengajuan>.<kategori>`; hanya nilai isian biasa (tanpa lampiran/biner, tanpa intent); semua akses `localStorage` dibungkus try/catch (mode privat/kuota penuh → autosave mati diam-diam).
- `use-request-form.ts` (dipakai desktop & mobile): autosave debounce **500 ms** bila isian berbeda dari nilai awal kategori itu (sekadar membuka/berpindah kategori tidak menyimpan apa pun; kembali ke nilai awal menghapus draf). Saat dibuka (dan saat berpindah kategori) draf dipulihkan dengan pemberitahuan **"Draf dipulihkan dari perangkat ini"** + tombol **Buang** (`DeviceDraftNotice`).
- Dihapus setelah kirim berhasil, **Simpan draf** server berhasil, Buang, atau pembatalan pengajuan (`RequestActions`). "Simpan draf" server tetap seperti semula.
- Vitest `draft-storage.test.ts` (7 test).

## 3. Saldo cuti

**a. Prorata karyawan baru** (`App\Domain\Requests\Services\LeaveEntitlement`):
`sisa bulan` = bulan masuk s.d. Desember, bulan masuk dihitung bila bergabung tanggal **1–15**; `jatah = kuota × sisa bulan / 12`, **dibulatkan ke bawah per 0,5 hari**. Bergabung sebelum tahun itu / tanggal masuk kosong → kuota penuh; bergabung setelah tahun itu → 0. Contoh kuota 12: masuk 1 Jul → 6; 20 Jul → 5; 10 Mar → 10; kuota 15 masuk 5 Jun → 8,5. Dipakai `GenerateAnnualBalances`, `BalanceLedger::balanceFor` (saat dibuat) dan `peek`. Halaman Saldo cuti menandai baris "prorata" dan menjelaskan aturannya.

**b. Saldo awal & penyesuaian** (migrasi `2026_10_08_410200`):
- `leave_balances.opening_days` (saldo awal, ≥ 0) dan `adjustment_days` (Σ penyesuaian, boleh minus). CHECK diperluas: `entitled + carried_over + opening + adjustment − used − pending ≥ 0` (saldo tetap tidak pernah minus).
- Tabel `leave_balance_adjustments` (`balance_id`, `delta_days` ≠ 0, `reason` wajib, `actor_id`, `created_at`), hanya ditambah. Aksi `AdjustLeaveBalance` (row lock, audit `leave_balance.adjusted`). `UpdateLeaveBalance` menerima `opening_days` opsional (klien lama tanpa kolom itu tetap jalan; audit memuat `opening_days`).
- `available()`/`total()` di `LeaveBalance` menghitung semua komponen; carry-over tahun berikutnya ikut memperhitungkannya. Kartu saldo karyawan menampilkan "+ saldo awal / ± penyesuaian".

**c. Impor CSV/XLSX** (Admin › Saldo cuti › **Impor saldo**):
kolom `email*, jenis*, tahun*, saldo_awal, jatah, bawaan, penyesuaian, alasan`; templat CSV/XLSX (`/admin/saldo-cuti/impor/templat/{csv|xlsx}`). Berkas yang sama dikirim dua kali: `mode=preview` (tidak menulis apa pun, galat per baris + sisa "sebelum → sesudah") lalu `mode=commit` (hanya baris valid, lewat `UpdateLeaveBalance`/`AdjustLeaveBalance` sehingga teraudit; baris gagal dilewati dan dilaporkan). Validasi: karyawan aktif di perusahaan, jenis ber-saldo, tahun 4 angka, kelipatan 0,5, alasan wajib untuk penyesuaian, baris ganda, saldo tidak boleh minus. Membaca berkas memakai `EmployeeSheetReader` (impor karyawan) + maatwebsite/excel; berkas tidak disimpan.

UI desktop: kolom Saldo awal & Penyesuaian, tombol **Sesuaikan** (dialog jumlah ± dan alasan + riwayat penyesuaian dimuat sesuai permintaan, prop opsional `history`), isian Saldo awal di "Ubah", dialog Impor. Ponsel: tetap `DesktopOnlyNotice`.

## 4. Privasi notifikasi & audit

- `BaseNotification::externalPayload()` (bawaan = `payload()`) dipakai `toMail` dan `toWhatsApp`.
- `RequestNotification`: email/WhatsApp penolakan & permintaan revisi **tidak memuat catatan**; diganti "Keputusan sudah dibuat. Buka RuangKerja untuk melihat detail dan catatannya." Catatan tetap tampil di aplikasi (Inbox/detail).
- Kategori **Sakit**: subjek & isi email netral tanpa nama jenis/nomor ("Pengajuan Anda ditolak oleh …", "Pengajuan Anda disetujui", "Pengajuan Rizky Aditya menunggu persetujuan Anda"); subjek email tanpa kode `SKT-…`. Ringkasan harian: seksi "Menunggu persetujuan" memakai lencana "Pengajuan" tanpa nomor; seksi "Perlu tindakan" memakai `meta.external_title` (kunci meta baru, terdokumentasi di `NotificationPayload`).
- Audit `request.rejected`, `request.revision_requested` (dan juga `request.step_approved`, demi konsistensi) hanya menyimpan `step`, `step_id`, status, **`has_note`** — tidak ada teks catatan.

## 5. Penyetuju pengganti & data sakit

- Policy baru `EmployeeRequestPolicy::viewHealthDetails`: untuk pengajuan Sakit, akses penuh hanya untuk pemohon, pemegang `requests.view_all` (HR/Direksi/Super Admin), penyetuju asli (termasuk pemberi delegasi dan pemegang peran pada langkah peran yang menunggu) serta atasan/garis manajemen pemohon. Yang hanya terlibat lewat delegasi melihat tanggal, durasi, status saja.
- `RequestPresenter::detail`: `reason` kosong, `attachments` kosong, `health_details_hidden: true`, catatan keputusan orang lain di timeline/`decision_note` disembunyikan. UI (`RequestFields`): "Detail kesehatan disembunyikan untuk penyetuju pengganti" pada Alasan & Lampiran (dipakai panel desktop dan detail mobile).
- Unduh lampiran (`viewAttachment`) memakai aturan yang sama → 403 untuk penyetuju pengganti. Pencarian ⌘K tidak menemukan pengajuan sakit lewat kata di alasan bagi penyetuju pengganti.

## Test

Baru: `LeaveTypeDefaultsTest` (7), `LeaveBalanceLedgerTest` (28 termasuk dataset), `NotificationPrivacyTest` (5), `SickDetailsPrivacyTest` (12), Vitest `draft-storage.test.ts` (7) + `dayUnit` di `lib/requests.test.ts`.

Test lama yang ekspektasinya berubah karena perilaku baru: `RequestSeederTest` (daftar kode jenis kini 10, menambah CML/CAP/CLT). `UserFactory.joined_at` kini rentang tetap 2021-07-01…2025-06-30 (bukan relatif ke jam asli) agar test yang "berjalan di waktu" tidak acak-acakan mengenai karyawan baru tengah tahun (prorata) dan tetap < 6 tahun masa kerja (asumsi test Cuti besar).

## Cara uji manual (`php artisan migrate:fresh --seed`, sandi `password`)

1. **hr@demo.test** → Admin › Jenis pengajuan: lencana "Bawaan sementara" di semua jenis bawaan; buka Cuti melahirkan → "…" → Ubah jenis → Simpan → lencana hilang.
2. Admin › Saldo cuti: karyawan demo analitik (bergabung 8 bulan lalu) bertanda "prorata" (11 hari). **Sesuaikan** → +1,5 dengan alasan → kolom Penyesuaian +1,5, riwayat tampil. **Impor saldo** → unduh templat, unggah, lihat pratinjau galat per baris, Terapkan.
3. **anggota@demo.test** → Ajukan baru → isi Alasan, muat ulang halaman → "Draf dipulihkan dari perangkat ini" → Buang. Pilih Cuti melahirkan → ringkasan "… hari kalender".
4. Delegasi: kadiv@demo.test → Persetujuan → Delegasi ke rekan; anggota mengajukan Sakit; rekan membuka Persetujuan → Alasan/Lampiran "Detail kesehatan disembunyikan untuk penyetuju pengganti"; HR tetap melihat semuanya.
5. Mailpit (http://localhost:8026): tolak pengajuan → email tanpa catatan; pengajuan Sakit → subjek netral.

## Keputusan

1. Kode jenis baru: `CML`, `CAP`, `CLT`; alur CLT = "Cuti besar" (perlu Direksi) karena tidak dibayar.
2. Maks. per pengajuan berlaku untuk kategori hari penuh (cuti, izin per hari, sakit, dinas); kategori lain mengabaikannya.
3. Penanda "Bawaan sementara" dihapus juga saat HR menetapkan alur untuk jenis itu (dianggap meninjau jenis).
4. Prorata: bulan masuk dihitung bila tanggal 1–15; dibulatkan ke bawah per 0,5 hari (tidak pernah melebihi hak).
5. `adjustment_days` disimpan terdenormalisasi di `leave_balances` agar CHECK DB tetap menjamin saldo tidak minus.
6. Impor tanpa penyimpanan berkas di server (berkas dikirim ulang saat Terapkan) — data hanya email & angka, jadi tidak perlu sesi/TTL seperti impor karyawan (yang berisi NIK).
7. Saluran eksternal = email **dan WhatsApp** (sama-sama keluar aplikasi).
8. Penyetuju pengganti juga tidak melihat catatan keputusan orang lain pada pengajuan sakit (bisa berisi diagnosis); catatannya sendiri tetap terlihat.

## Paket baru

Tidak ada.

## Sisa / risiko

- Draf perangkat untuk kategori yang dikunjungi setelah teks terbawa dari kategori sebelumnya ikut tersimpan; saat dibuka ulang hanya kategori awal yang dipulihkan otomatis (kategori lain dipulihkan saat dipilih).
- Mobile Persetujuan (`approvals.mobile.tsx`, milik agen navigasi) tidak diubah; detail mobile memakai `RequestFields` sehingga pemberitahuan tetap tampil.
- Cuti melahirkan belum dibatasi jenis kelamin (data gender tidak ada).
