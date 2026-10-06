# Dashboard pimpinan & modul Absensi (keputusan pemilik 6 Okt 2026)

> **Status:** **Nyata** (branch `claude/pimpinan`). Tanpa flag fitur. Data laporan harian berasal dari modul Laporan progres harian (form & seeder milik agen `claude/staf`).

## 1. Apa yang berubah

| Tempat | Isi sekarang | Yang dipindah keluar |
|---|---|---|
| `/dashboard/direksi` (baru; bawaan Direksi) | Monitoring kerja **harian**, **mingguan**, **per proyek**; **catatan tindakan**; **akses cepat workspace** | Tingkat penyelesaian, lead time, kedisiplinan, rata-rata terlambat, tren penyelesaian, kehadiran hari ini, tugas terlambat |
| `/dashboard/hr` | Pengajuan menunggu HR, kartu "Absensi hari ini" (angka + tautan), kartu Hiring | Kehadiran per divisi, belum check-in, lupa check-out, perlu ditinjau, rekap & tren kedisiplinan → Absensi |
| `/absensi/hari-ini` · `/absensi/rekap` · `/absensi/kedisiplinan` | Tab Absensi: papan hari ini (per divisi, belum check-in, lupa check-out, perlu ditinjau), rekap bulanan, **Kedisiplinan** (rekap + tren + penyelesaian + lead time + per orang, ekspor Excel) | — |
| `/manajemen` | + **Beban kerja** (per divisi → per orang) + catatan tindakan | — |
| `/dashboard/divisi` | + panel **Laporan tim hari ini** | — |
| Workspace (`/w/…`) | Direksi, HR, Super Admin melihat semua workspace tim/divisi/proyek; bila bukan anggota tampil banner **Mode lihat saja** | Komentar/reaksi/amati/lampiran/ubah tugas untuk non-anggota manajemen |

Akses tampilan dashboard: Direksi → Saya · Direksi (bawaan Direksi). Super Admin → Saya · Kepala Divisi · HR · Direksi. HR → Saya · Kepala Divisi · HR. Direksi yang juga HR/Super Admin atau memimpin divisi operasional tetap mendapat tab terkait; memimpin unit Direksi (board) tidak.

## 2. Cara pakai

- **Harian:** pilih tanggal (← tanggal →, tidak bisa ke depan). Ringkasan per divisi (terjadwal, sudah lapor, draf, belum lapor), daftar yang belum lapor, laporan terbaru (ringkasan, tugas + persen, hambatan disorot). Klik laporan → panel detail (baca saja).
- **Mingguan:** pilih minggu (Senin–Minggu). Matriks orang × hari per divisi (angka = jumlah tugas di laporan; D = draf; ! = belum lapor), tugas paling banyak dikerjakan, hambatan minggu ini. Klik sel/hambatan → detail laporan.
- **Per proyek:** proyek berjalan dengan status PIC, progres aktual vs rencana (penanda rencana), milestone berikutnya, laporan & orang minggu ini; tautan ke ringkasan proyek dan Portofolio.
- **Catatan tindakan:** ketik lalu Enter/+, tenggat opsional, centang selesai, klik teks untuk ubah, panah untuk urutan, tempat sampah untuk hapus. Hanya terlihat oleh pemiliknya.
- **Akses cepat workspace:** cari nama/kode, chip Semua · Proyek · Divisi · Tim; label "Lihat saja" bila bukan anggota.
- **Ponsel:** tab Harian · Mingguan · Proyek · Catatan (akses cepat workspace di tab Proyek). Ekspor di desktop.

## 3. Teknis

- Query: `app/Domain/Monitoring/Queries/{DailyWorkMonitor,WeeklyWorkMonitor,ProjectWorkMonitor,WorkspaceDirectory,ManagementNotes}`; judul tugas di laporan mengikuti visibilitas tugas (`Support/ReportTasks`).
- Catatan: tabel `management_notes`, `ManagementNotePolicy`, Action `Create/Update/Delete/ReorderManagementNotes`, rute JSON `POST|PATCH|DELETE /catatan-tindakan…`, `PUT /catatan-tindakan/urutan`.
- Detail laporan: `GET /monitoring/laporan/{id}` (Gate `monitorDailyReport`).
- Kedisiplinan: `AttendanceDisciplineController`, `Queries/AttendanceDisciplineReport`, `Services/AttendanceScopeResolver`, ekspor `BuildDisciplineExport`.
- Mode lihat saja: `WorkspacePolicy::isViewOnly`, `TaskPolicy::comment/watch`, ability `view_only` + `can.watch` di detail tugas. Uji matriks mutasi: `tests/Feature/Workspaces/ViewOnlyManagementTest.php`.

## 4. Yang ditahan / belum

- Kartu Hiring hanya tautan bila rute `/hiring` ada (modul hiring dibangun agen lain).
- Banner pengumuman di atas dashboard dipasang agen `claude/staf`.
- Super Admin tetap memegang `workspaces.manage` (pengaturan workspace) — hanya tugas/komentar yang baca saja bila bukan anggota.
