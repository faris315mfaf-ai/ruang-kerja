# Laporan progres harian

> **Status:** **Nyata** (keputusan pemilik 6 Okt 2026). Tanpa flag fitur. Rute `routes/reports.php`; domain `app/Domain/Reports`; frontend `resources/js/features/reports`, halaman `resources/js/pages/reports/*`. Skema: `daily_reports`, `daily_report_items` (+ `move_status_id`), lihat `docs/DATABASE.md` §4.

## Tujuan

Setiap karyawan mencatat apa yang dikerjakan hari itu, sehingga atasan dan Direksi melihat progres berbasis output tanpa menanyakan satu per satu. Paling menonjol untuk **staf** (hanya peran `anggota`).

## Cara pakai

| Layar | Rute | Isi |
|---|---|---|
| Kartu "Laporan hari ini" | `/dashboard` (Dashboard Saya, desktop & ponsel) | Status Belum lapor · Draf · Terkirim pukul …, tombol Tulis laporan / Lanjutkan & kirim / Ubah laporan, tautan Riwayat |
| Form | `/laporan/hari-ini` | Pekerjaan hari ini: tugas (saran = Ruang saya "Hari ini", tugas yang ditugaskan & terbuka, tugas pribadi; cari tugas lain yang terlihat) dengan catatan progres (wajib), persen & jam (opsional), "Pindahkan ke …" (kolom workspace, hanya bila Policy `move` mengizinkan); pekerjaan lain di luar tugas; Ringkasan, Hambatan, Catatan/notulensi (teks panjang, mendukung baris). Draf tersimpan otomatis (1,2 dtk setelah mengetik). **Kirim** bisa diulang sampai 23.59 hari itu, lalu terkunci |
| Riwayat & laporan tim | `/laporan` | Kartu hari ini, riwayat per tanggal (draf terlihat oleh pemilik saja). Bila membaca laporan orang lain: panel "Laporan tim hari ini" (dimuat terpisah) |
| Laporan orang lain | `/laporan/{user}`, `/laporan/{user}/{tanggal}` | Hanya laporan terkirim. Judul tugas tampil bila pembaca bisa melihat tugasnya, selain itu hanya kode (mis. `PRV-1`) |

Navigasi: tile Dock "Laporan harian", baris Menu ponsel, command palette ("Tulis laporan hari ini", "Laporan harian").

## Hak akses (`DailyReportPolicy`, `ReportReaders`)

Pemilik menulis laporannya sendiri pada tanggal kantor hari itu. Pembaca: atasan langsung, Kepala Divisi divisi pemilik (termasuk sub-divisi), Direksi, HR, Super Admin — satu perusahaan. Orang lain, perusahaan lain, dan akun nonaktif: 404. Draf tidak pernah terlihat pembaca.

## Pengingat

`SendDailyReportReminders` 16.30 WIB Senin–Jumat (`routes/console.php`): karyawan aktif yang terjadwal shift hari itu (bukan libur, bukan cuti/izin disetujui tanpa check-in) dan belum mengirim → notifikasi `report.reminder` (in-app; baris pengaturan "Pengingat laporan harian (16.30)"), sekali per orang per tanggal (`notification_dispatch_logs`).

## Untuk modul lain

`App\Domain\Reports\Queries\DailyReportFeed::forDate(Company|string $company, CarbonInterface|string $date, User $viewer, ?callable $people = null)` → `{date, counts{total, submitted, draft, missing}, people[{user, status, report|null}]}` untuk orang yang boleh dibaca viewer (bukan dirinya); bentuk lengkap di docblock kelasnya. Dipakai panel Kadiv "Laporan tim hari ini" dan monitoring Direksi (agen pimpinan).

## Yang ditahan / belum

- Tidak ada ekspor laporan harian.
- Lampiran file pada laporan tidak ada (pakai lampiran di tugas).
