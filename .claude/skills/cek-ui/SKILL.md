---
name: cek-ui
description: Bandingkan halaman yang berjalan di localhost (https://ruangkerja.test) dengan mockup di docs/mockups pada lebar desktop dan mobile, lalu laporkan atau perbaiki perbedaannya. Pakai setelah membangun atau mengubah layar.
argument-hint: [rute atau nama layar, mis. /dashboard atau DashboardDireksi]
---

# Cek UI terhadap mockup: $ARGUMENTS

Prasyarat: Claude Code dijalankan dengan Chrome (`claude --chrome` atau `/chrome` → Enabled). Aplikasi jalan di `https://ruangkerja.test` (Herd) dan `npm run dev` aktif. Bila Chrome tidak tersedia, lakukan langkah 2–4 dengan Playwright (`npx playwright screenshot`) bila terpasang, atau minta pengguna mengirim screenshot.

1. **Temukan mockup.** Buka `docs/mockups/INDEX.md`, cari baris untuk "$ARGUMENTS" → dapatkan file desktop dan mobile (`*.dc.html`) beserta PNG-nya. Lihat kedua PNG (Read file gambar).
2. **Login demo** sesuai peran di mockup (lihat kolom "Peran" di INDEX: Direksi, Kadiv, HR, Anggota). Akun demo lokal: `direksi@demo.test`, `kadiv@demo.test`, `hr@demo.test`, `anggota@demo.test`, `admin@demo.test` (sandi `password`).
3. **Desktop:** buka rute di jendela ≈1440×900. Ambil screenshot. Periksa juga mode gelap dan terang (toggle tema).
4. **Mobile:** ubah ukuran jendela ke 390×844 (atau DevTools device mode). Ambil screenshot. Pastikan shell mobile (app bar + tab bawah) yang tampil, bukan sidebar.
5. **Bandingkan** dengan mockup per area: tata letak & urutan seksi, tipografi (Plus Jakarta Sans, angka tabular), warna token, ikon status/prioritas, state kosong/loading, teks Bahasa Indonesia, target sentuh ≥ 44px dan input 16px di mobile. Data contoh boleh berbeda; struktur tidak.
6. **Baca console** (filter `error|warning`) dan pastikan tidak ada galat.
7. **Laporkan** tabel singkat: Area · Mockup · Sekarang · Tindakan. Perbaiki yang jelas salah (bukan selera), lalu ulangi langkah 3–4 sekali. Hal yang butuh keputusan desain: tanyakan pengguna.
