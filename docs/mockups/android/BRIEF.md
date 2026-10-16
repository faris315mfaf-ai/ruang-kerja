# Brief — Mockup aplikasi Android RuangKerja

Tujuan: persiapan membangun aplikasi Android (Expo / React Native, UI native penuh; keputusan pemilik 9 Okt 2026). Mockup ini menjadi **spesifikasi visual per layar** untuk implementasi di `apps/mobile`, melengkapi paket desain Arus (`docs/ruangkerja-design/`) dan mockup mobile-first lama (`docs/mockups/png/mobile/`). Bila berbeda, brief ini + aturan di bawah yang berlaku untuk Android.

## 1. Keluaran per modul

1. **Layar HTML statis** di `docs/mockups/android/screens/<NN-modul>/<nn-nama-layar>.html` (kebab-case, awali nomor urut dua digit). Satu berkas = satu layar, ATAU satu berkas berisi beberapa `.phone` berdampingan untuk matriks keadaan/varian (render akan menghasilkan satu PNG per `.phone`: `nama-1-terang.png`, `nama-2-terang.png` …). Pakai berkas multi-`.phone` untuk keadaan kecil (kosong/memuat/galat/offline), berkas tunggal untuk layar utama.
2. **Spesifikasi** `docs/mockups/android/spec/<NN-modul>.md` (Bahasa Indonesia): inventaris layar (tabel: berkas · nama · peran yang melihat · keadaan yang tercakup), peta navigasi (mermaid), pemetaan layar → endpoint API (`docs/sesi/ponsel.md`; tandai **ADA** / **BELUM ADA** untuk endpoint yang belum tersedia), kemampuan khas Android yang dipakai (izin, gestur, notifikasi), matriks keadaan (memuat/kosong/galat/offline/terkunci/baca-saja), catatan implementasi Expo (komponen, gestur, pustaka yang sudah ada di `apps/mobile`), **pertanyaan/keputusan untuk pemilik**, dan celah yang ditemukan (fitur web yang belum punya wujud ponsel).
3. Terang **dan** malam: cukup satu HTML — tema dipilih lewat `?tema=malam` (token CSS berganti otomatis). Jangan membuat salinan "Malam".

Target: **sangat lengkap** — semua layar utama modul, semua sheet/dialog/menu, semua keadaan (memuat dengan skeleton, kosong, galat, offline, terkunci/tanpa akses, baca-saja), semua varian peran yang relevan, form lengkap dengan keadaan fokus/galat/terkirim. Perkiraan 15–35 layar per modul. Kedalaman lebih penting daripada jumlah berkas; jangan mengulang layar yang identik.

## 2. Sumber yang WAJIB dibaca (sesuai modul)

- `AGENTS.md`, `docs/PLATFORM.md` (§2, §2.1 keputusan mobile-first, §3 matriks fitur ponsel, §4 aturan sentuh), `docs/DESIGN.md` (token, tipografi, komponen, gerak), `docs/PRD.md` bagian modul Anda.
- `docs/fitur/<modul>.md` yang terkait, `docs/fitur/aplikasi-ponsel*.md`, `docs/sesi/ponsel.md` (kontrak API v1 + catatan aplikasi).
- Implementasi aplikasi saat ini: `apps/mobile/app/**` dan `apps/mobile/src/**` — mockup harus mencakup semua yang sudah ada **dan** yang seharusnya ada (paritas dengan web sesuai `docs/PLATFORM.md` §3).
- Desain acuan: `docs/ruangkerja-design/screens/M*.dc.html` (+ `README.md` cara membacanya), `docs/mockups/html/M*.html` / `docs/mockups/png/mobile/*.png` (lihat PNG-nya dengan Read).
- Halaman web yang ada di `resources/js/pages/**` dan `resources/js/features/**` untuk modul Anda (teks UI, status, urutan seksi, aturan akses).

## 3. Kit mockup (`docs/mockups/android/_kit/`) — JANGAN diubah

- Mulai dari `_kit/TEMPLATE.html`; contoh lengkap: `screens/00-fondasi/beranda-staf.html` (lihat PNG-nya di `png/00-fondasi/`).
- Gaya dari `kit.css`: token Arus (terang/malam), `.phone` (412×915; layar panjang `style="--h:1700px"`; tablet/lipat `style="--w:834px;--h:1112px"`), `.body`, `.appbar`, `.bar-sub` (bar turunan dengan tombol kembali), `.tabbar` + `.tab` + `.tab.center`, `.card`, `.hero`, `.kpi`, `.list > .li`, `.chip(s)`, `.seg`, `.btn(.primary/.outline/.tonal/.quiet/.danger/.sm/.block/.off)`, `.input(.focus/.err/.area)`, `.field`, `.switch`, `.check`, `.radio`, `.badge(.ok/.warn/.bad/.info/.link)`, `.tag`, `.avatar(.sm/.lg/.ring/.teal/.amber/.neutral)`, `.progress`, `.banner`, `.empty`, `.skel`, `.scrim`, `.sheet`, `.dialog`, `.snack`, `.bottom-bar`, `.fab`, `.cam`, `.map`, tipografi `.t-display/.t-h1/…/.t-meta/.t-over/.t-kpi`.
- Ikon: `<i data-i="nama-lucide"></i>` (semua ikon Lucide; `data-s="28"` mengubah ukuran). Nama salah akan ditandai render.
- Status bar dan gesture bar Android ditambahkan otomatis. Elemen mengambang (tab bar, FAB, sheet, dialog, snackbar, bottom-bar) diletakkan sebagai anak langsung `.phone`, bukan di dalam `.body`.
- Butuh gaya tambahan? Tulis `<style>` lokal di berkas layar (prefiks kelas unik, mis. `.abs-`). Warna HANYA dari variabel (`var(--primary)` dst.); hex hanya untuk placeholder foto/peta. Kebutuhan kit yang umum → catat di spec ("Kebutuhan kit"), jangan edit kit (agen lain memakainya bersamaan).
- Tanpa jaringan eksternal, tanpa JS selain `kit.js`/`icons.js` (boleh `<script>` kecil lokal bila perlu).

## 4. Aturan konten & desain

- Bahasa Indonesia untuk semua teks UI (lihat `docs/DESIGN.md` §8); data contoh realistis, masuk akal, dan konsisten dengan `docs/mockups/INDEX.md`: hari ini **Selasa, 13 Okt 2026**; persona Sari Wulandari (staf), Rizky, Maya Lestari, Dimas Pratama (Kepala Divisi Operasional), Hana (HR), Hendra (Direktur Utama); workspace `PRG`, `GDG`, `PLQ`, `KEU`; lokasi "Kantor Pusat". Jam `08.05`, tanggal "Sel, 13 Okt 2026", angka `1.250`.
- Android: tombol kembali = panah di `.bar-sub` (gestur kembali sistem diasumsikan), tab bawah kapsul 5 item (Beranda · Tugas · Absen tengah · Obrolan · Lainnya; Absen ↔ Workspace kontekstual — lihat `docs/sesi/glm.md`/`beranda-briefing-tugas`), snackbar untuk umpan balik ringan, dialog gaya Material untuk konfirmasi destruktif, dialog izin runtime Android untuk kamera/lokasi/notifikasi, bottom sheet untuk pilihan/aksi.
- Target sentuh ≥ 44px, teks yang harus dibaca ≥ 14px (13px hanya meta), input 17px, status = ikon/titik + teks (bukan warna saja), kontras AA di terang & malam, fokus terlihat.
- Aturan produk yang berlaku (jangan dilanggar): **staf** (hanya peran `anggota`) tanpa saldo cuti & tanpa struktur organisasi; **jenis cuti & lembur terkunci** (ubin bergembok, alasan "Dikunci sampai SOP cuti/lembur ditetapkan."); pengajuan barang penuh; Direksi/HR/Super Admin **baca saja** di workspace non-anggota; tugas titipan hanya bisa diubah pembuat/atasan (penerima tetap bisa pindah status, rencana, komentar, centang checklist, lampiran); fitur desktop-saja tampil sebagai versi baca-saja atau banner "Tersedia di desktop" + "Kirim tautan ke email saya" (`docs/PLATFORM.md` §3), bukan tata letak desktop terpotong; tidak ada skor produktivitas gabungan; login hanya email + kata sandi (Google ditahan); WhatsApp absensi ke grup manajemen (poin rencana kerja bernomor).
- Gerak (anotasi saja): sebutkan di spec bila ada gerak khusus (durasi 120/180 ms, `ease-brand`, reduced motion) — mockup statis tidak perlu animasi.
- Boleh menambah catatan kuning kecil `.note` (anotasi) pada layar bila perlu menjelaskan perilaku; pakai hemat.

## 5. Verifikasi (wajib sebelum lapor)

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.3/bin:$PATH"
node docs/mockups/android/_kit/render.mjs <NN-modul>      # harus tanpa baris "MASALAH"
```
Buka (Read) minimal 6 PNG hasil render — campuran terang & malam, layar panjang, sheet/dialog — dan perbaiki teks terpotong, tumpang tindih, kontras buruk, ikon hilang. PNG ada di `docs/mockups/android/png/<NN-modul>/` (tidak di-commit).

## 6. Commit

Hanya jalur milik Anda; agen lain bekerja bersamaan di folder berbeda:

```bash
git add docs/mockups/android/screens/<NN-modul> docs/mockups/android/spec/<NN-modul>.md
git commit -m "docs(android): mockup modul <nama> — <N> layar" -- docs/mockups/android/screens/<NN-modul> docs/mockups/android/spec/<NN-modul>.md
```
(ulangi bila `index.lock` ada). Pesan commit Bahasa Indonesia, diakhiri baris `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Jangan `git push`, jangan menyentuh `_kit/`, `.gitignore`, atau folder modul lain. Jangan membaca `.env`.

## 7. Laporan akhir

Ringkas: jumlah berkas HTML & PNG, daftar layar per kelompok, hasil render (MASALAH nol), keputusan desain penting, celah/pertanyaan untuk pemilik, hash commit.

## 8. Daftar modul

| NN | Modul | Cakupan inti |
|---|---|---|
| 01 | Akses, akun & pengaturan | splash, masuk, biometrik, lupa sandi (tunggu HR), wajib ganti sandi, 2FA Super Admin, blokir 403 `password_change_required`/`two_factor_required`, sesi habis, versi wajib update, profil, pengaturan, keamanan, perangkat saya, tema, privasi & Data Saya, kebijakan privasi, kunci aplikasi, keluar |
| 02 | Beranda & dashboard per peran | beranda staf/Kadiv/HR/Direksi/Super Admin, 8 dashboard jabatan SPKD, Tugas hari ini (3 segmen), briefing pagi/sore (+catat, delegasi), pengumuman, kartu laporan harian, Kinerja saya, pemilih peran |
| 03 | Absensi | beranda absen, persetujuan UU PDP, check-in GPS+selfie (izin, kamera, review, rencana kerja bernomor), QR, WFH/lapangan, sukses/gagal (luar radius, mock location), check-out (+laporan), riwayat & rekap, detail hari, koreksi, status offline, wajah (Fase 3) |
| 04 | Pengajuan & persetujuan | pilih jenis (terkunci), form cuti/izin/sakit/lembur/koreksi/dinas/barang, lampiran kamera, pengajuan saya, detail & timeline, batal/revisi, tumpukan persetujuan (geser), detail persetujuan, tolak/revisi, delegasi, daftar disetujui, pembatalan oleh HR |
| 05 | Tugas & workspace | tugas saya, filter/tampilan tersimpan, detail tugas (+checklist, lampiran Drive, subtugas, komentar, mention, reaksi, tanda baca, riwayat), buat tugas cepat, ubah, workspace (daftar kelompok, detail, anggota, aktivitas, file/dokumen Drive), board satu kolom, list, kalender agenda, tugas berulang & otomasi (baca/atur ringkas) |
| 06 | Proyek, portofolio, OKR & monitoring | portofolio Direksi, detail proyek (milestone, update PIC, risiko, burn-up, arahan), Dashboard Manajemen, catatan tindakan, beban kerja, OKR (objective/KR/check-in), laporan progres harian (tulis/riwayat/pembaca), monitoring harian/mingguan |
| 07 | Catatan & notulensi | daftar/pohon catatan per workspace, editor minimalis (3 ikon, toolbar auto-hide, mode catat), tab dokumen, warna teks/stabilo, berbagi & peran, riwayat versi & pulihkan, mulai notulensi cepat, dikte (STT), konflik 409/catatan berformat lengkap baca-saja, tanda belum tersimpan |
| 08 | Rapat, kalender & video | daftar/agenda rapat, kalender (strip minggu + agenda, bulan), detail rapat, buat/ubah, RSVP, pra-gabung video, ruang video (petak/sorotan, berbagi layar, chat, angkat tangan, moderasi, notulen hidup), notulen (tulis/final), tindak lanjut → tugas, jadwal manajemen, notifikasi mulai rapat |
| 09 | Obrolan | daftar percakapan, kanal workspace/publik/privat, DM & grup baru, linimasa, thread, reaksi, mention, lampiran Drive, cari pesan, anggota/detail kanal, status baca, notifikasi, kosong/galat/offline |
| 10 | Inbox, notifikasi & cari | Inbox (semua/perlu tindakan/arsip), swipe aksi, pengumuman (daftar, detail, buat), cari global (kolom di bawah), quick add, pengaturan notifikasi (matriks → accordion), jam tenang, ringkasan harian, kosong/galat |
| 11 | HR, admin & hiring (ponsel) | karyawan (cari/profil, baca), atur sandi (desktop-only banner), permintaan reset sandi (setujui/tolak), struktur organisasi (daftar bertingkat, bukan staf), hiring (lowongan, papan→chip tahap, kandidat, checklist, skor, keputusan), rekap & kedisiplinan absensi, audit/alur/jenis pengajuan sebagai banner desktop |
| 12 | Fitur khas Android | widget layar utama (check-in, tugas hari ini, rapat berikut), bayangan notifikasi (berkelompok, aksi cepat, rapat mulai, persetujuan), layar kunci, pintasan ikon (app shortcuts), terima berbagi (share sheet), deep link, prompt biometrik, dialog izin runtime, antrean offline & sinkron, pembaruan dalam aplikasi, tablet/lipat (Rail), lanskap, aksesibilitas (font 200%, TalkBack), ikon adaptif & aset Play Store |
| 13 | Fondasi desain Android | katalog komponen (semua keadaan), token terang/malam, tipografi, ikon, pola kosong/memuat/galat/offline/terkunci, tab bar kontekstual, snackbar/dialog/sheet, kartu per jenis, panduan gerak, grid & spasi, ringkasan peta navigasi seluruh aplikasi |
