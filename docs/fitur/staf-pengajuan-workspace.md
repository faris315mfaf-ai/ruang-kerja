# Staf, pengajuan & workspace (keputusan pemilik 6 Okt 2026)

> **Status:** **Nyata**, tanpa flag fitur.

## Definisi staf

Staf = pengguna yang **hanya** berperan `anggota` (tanpa `kepala_divisi`, `hr`, `direksi`, `super_admin`); Ketua Tim tanpa peran lain juga staf. Satu sumber: `User::isStaffOnly()` (`Role::aboveStaff()`) dan `isStaffOnly(roles)` di `resources/js/features/staff/roles.ts`.

- **Saldo cuti tahunan** tidak dikirim server ke staf: KPI Beranda (ponsel: diganti tile "Disiplin hadir"), kartu saldo Pengajuan saya, saldo di form/pratinjau, baris "Saldo cuti" di detail. Penyetuju non-staf tetap melihat dampak saldo pemohon.
- **Struktur organisasi** tidak ada untuk staf: hilang dari Dock/Rail/Menu, `/organisasi/struktur` 404 (`DivisionPolicy::viewChart`).

## Cuti & lembur dikunci

`leave_types.locked_reason` (migrasi mengunci semua jenis kategori `leave` & `overtime`: "Dikunci sampai SOP cuti/lembur ditetapkan."). Form desktop menampilkan ubin bergembok, ponsel daftar bergembok di bawah chip; form baru membuka kategori pertama yang tidak terkunci. Server menolak draf, kirim, dan pratinjau jenis terkunci ("Cuti tahunan belum bisa diajukan. …"); draf lama hanya bisa dibatalkan. Pengajuan yang sudah dikirim berjalan terus, yang disetujui tidak berubah. HR: Admin › Jenis pengajuan › ubah jenis › sakelar **Kunci** + alasan (kosong = alasan SOP).

## Pengajuan barang

Kategori `procurement` ("Pengajuan barang", slug `/pengajuan/baru?kategori=barang`): nama barang, jumlah, satuan, perkiraan harga satuan (Rp), total otomatis, tautan referensi (http/https), alasan/kebutuhan, tingkat kebutuhan (Biasa/Mendesak). Tanggal = tanggal dikirim; tidak bentrok dengan pengajuan lain, tanpa efek absensi/saldo/rekap/daftar rekan absen. Jenis bawaan `BRG` + alur "Pengajuan barang" (atasan langsung → Direksi) dibuat `RequestSeeder` — pada basis data yang sudah ada jalankan `php artisan db:seed --class=RequestSeeder` sekali.

## Workspace dikelompokkan

`/workspace`, grid Menu ponsel, dan stack Workspace Dock/Rail: **Pribadi** · **Divisi & tim** · **Proyek yang diikuti** (+ **Lainnya (lihat saja)** untuk workspace yang terlihat tanpa keanggotaan). Chip filter Semua · Pribadi · Divisi & tim · Proyek (bertitik warna token, aktif gradien aksi) disimpan di `?jenis=pribadi|divisi|proyek|lainnya`. Logika: `WorkspaceGroup` (PHP) dan `features/workspaces/groups.ts`.
