# Pengumuman

> **Status:** **Nyata** (keputusan pemilik 6 Okt 2026). Tanpa flag fitur. Rute `routes/announcements.php`; domain `app/Domain/Announcements`; frontend `resources/js/features/announcements`, halaman `resources/js/pages/announcements/index.tsx`. Skema `announcements`, `announcement_dismissals` (`docs/DATABASE.md` §6).

## Cara pakai

- **`/pengumuman`**: "Untuk saya" (aktif, yang sudah ditutup ditandai) dan "Saya buat" (termasuk yang sudah berakhir). Tombol **Pengumuman baru** (desktop: dialog; ponsel: FAB + bottom sheet): judul, isi, penerima, "Tampil sampai" (opsional). Hapus milik sendiri (ikon tempat sampah) = hilang dari semua dashboard; notifikasi di Inbox tetap.
- **Spanduk** di atas Dashboard Saya, Divisi, HR, `/manajemen`, dan `/portofolio` (desktop & ponsel): maks. 3 terbaru + "Lihat semua pengumuman (n)". Dimuat terpisah dari dashboard (`GET /pengumuman/spanduk`), jadi tidak memperlambatnya. Tombol × menutup untuk orang itu saja (`announcement_dismissals`).
- Diterbitkan → notifikasi `system.announcement` (in-app selalu aktif) ke semua penerima kecuali pembuat, lewat antrean per 200 orang.

## Siapa menulis ke siapa (`AnnouncementTargets`, `AnnouncementPolicy`)

| Peran | Penerima |
|---|---|
| Direksi, HR, Super Admin | Semua karyawan, divisi mana pun, tim mana pun |
| Kepala Divisi | Divisi yang dipimpin (beserta sub-divisi) |
| Ketua Tim | Tim yang dipimpin |
| Lainnya | Tidak bisa membuat |

Penerima divisi termasuk anggota sub-divisinya. Pengumuman yang tidak ditujukan ke seseorang: 404.

## Yang ditahan / belum

- Tidak ada penjadwalan terbit di masa depan (terbit saat dibuat) dan tidak ada penyuntingan setelah terbit (hapus lalu buat ulang).
- Kanal email/WhatsApp mengikuti preferensi `system` (email mati secara bawaan); WhatsApp ditahan.
