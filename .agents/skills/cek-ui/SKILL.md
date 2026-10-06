---
name: cek-ui
description: Bandingkan halaman yang berjalan di localhost (https://ruangkerja.test) dengan mockup dan paket desain Arus pada lebar desktop dan mobile, lalu laporkan atau perbaiki perbedaannya. Pakai setelah membangun atau mengubah layar.
argument-hint: [rute atau nama layar, mis. /dashboard atau DashboardDireksi]
---

# Cek UI terhadap mockup: $ARGUMENTS

`$ARGUMENTS` = rute atau nama layar dari pengguna.

Prasyarat: aplikasi jalan di `https://ruangkerja.test` (Herd) dengan aset terbaru (`npm run build`, atau `npm run dev` aktif). Alat utama untuk semua agen: **`node scripts/ui-shots.mjs`** (Playwright: login demo, screenshot 1440/390 terang & malam, laporan galat konsol, HTTP 4xx/5xx, gulir horizontal). Agen yang punya browser sendiri (Claude Code: panel browser / Chrome) boleh memakainya untuk interaksi, tetapi screenshot acuan tetap dari skrip ini.

1. **Temukan acuan.** `docs/mockups/INDEX.md` (PNG di `docs/mockups/png/`) dan `docs/ruangkerja-design/README.md` (layar `.dc.html` Arus, versi `*Malam`). Lihat PNG desktop & mobile (buka file gambarnya).
2. **Pilih akun demo** sesuai peran layar: `programmer@demo.test` (staf programmer), `hr@demo.test` (HR), `maya.lestari@demo.test` (staf sosial media/branding), `admin@demo.test` (Super Admin), `direksi@demo.test` (Direksi), `kadiv@demo.test` (Kepala Divisi), `anggota@demo.test` (anggota).
3. **Ambil screenshot:** `node scripts/ui-shots.mjs <rute> --akun <email>` (tambah `--lebar 1440,834,390` untuk tablet, `--penuh` untuk halaman panjang). Hasil di `storage/app/ui-shots/`. Buka setiap PNG.
4. **Bandingkan** per area: tata letak & urutan seksi, tipografi Figtree (angka tabular), warna token (tanpa hex), ikon status/prioritas, keadaan kosong/memuat/galat, teks Bahasa Indonesia, target sentuh ≥ 44px dan input 17px di ponsel, shell yang benar (desktop MenuBar + Dock, tablet Rail, ponsel app bar + tab bar). Data contoh boleh berbeda; struktur tidak.
5. **Galat:** skrip keluar dengan kode 2 bila ada galat konsol/halaman, HTTP ≥ 400, atau gulir horizontal. Semua harus bersih.
6. **Review HIG & gerak** (bila agen punya skill `apple-hig` / `review-animations`): pakai untuk hierarki, navigasi, form, kontras, mode gelap, dan animasi yang disentuh. Ambil temuan yang tidak bertentangan dengan mockup dan `docs/DESIGN.md`.
7. **Laporkan** tabel singkat: Area · Mockup · Sekarang · Tindakan. Perbaiki yang jelas salah (bukan selera), lalu ulangi langkah 3 sekali. Hal yang butuh keputusan desain: tanyakan pengguna.
