# Ekspor PNG struktur organisasi

> 7 Okt 2026 · branch `claude/ekspor-struktur` · sebelumnya ditunda di `docs/HANDOFF.md`.

`/organisasi/struktur` (bukan untuk staf: 404, sama seperti halamannya) bisa diunduh sebagai gambar PNG untuk dicetak atau dibagikan.

## Cara memakai

| Platform | Letak | Catatan |
|---|---|---|
| Desktop & tablet | Tombol **Unduh PNG** di header, di samping pengalih Bagan · Daftar (hanya tampilan **Bagan**) | Saat memproses tombol menjadi "Menyiapkan PNG…" dan nonaktif |
| Ponsel | Tombol **…** (Aksi lainnya) di app bar › **Unduh PNG bagan** | Ponsel menampilkan daftar, tetapi ekspor tetap berupa bagan lengkap |

Hasil: `struktur-organisasi-YYYY-MM-DD.png` (tanggal kantor, Asia/Jakarta). Toast hijau bila berhasil, toast peringatan bila resolusi diturunkan, toast galat bila gagal (coba lagi atau persempit dengan pencarian).

## Isi gambar

- Header: nama perusahaan, **Struktur organisasi**, jumlah divisi/tim/orang, tanggal gaya `lib/format` (`formatDayDate`, mis. "Rabu, 07/10/2026"), dan "Hasil pencarian “…”" bila pencarian aktif.
- **Seluruh bagan**, bukan hanya area yang terlihat/ter-zoom: Direksi lengkap (tanpa "+N lainnya"), semua tim dan anggota dibuka, anggota tanpa divisi, nama panjang dibungkus (tidak dipotong "…"). Tanpa tombol, tanpa penanda "(Anda)".
- **Mengikuti pencarian** di layar (filter yang sama dengan `filterChart`). Cakupan data = props halaman (`OrganizationTree`), jadi tidak ada data baru yang keluar dari server.
- Selalu **tema terang** (ramah cetak) dan ukuran huruf desktop, apa pun mode Malam atau lebar layar.
- Foto profil diganti **inisial**: foto berasal dari Google (origin lain) dan CSP `connect-src 'self'` tidak mengizinkan halaman mengambilnya; inisial juga membuat hasil konsisten.
- Font Figtree & JetBrains Mono **tertanam** di gambar.

## Cara kerja

Semua di peramban, tanpa headless browser di server:

1. `chart-export.tsx` (`useChartExport`) memuat `export-chart-png.tsx` secara lazy saat tombol ditekan.
2. `ChartExportSheet` dirender dengan `createRoot` ke `div` di luar layar (`position: fixed; left: -100000px`, `aria-hidden`, `inert`). Tema terang dibuat dengan menyalin semua custom property `:root` di luar media query dari stylesheet (`rootCustomProperties`) ke `div` itu, sehingga token `.dark` di `<html>` tertimpa untuk subtree tersebut.
3. `modern-screenshot` (`domToBlob`) mengubah DOM → SVG `foreignObject` → kanvas → PNG, lalu berkas diunduh lewat `<a download>`; `div` dilepas lagi.
4. Skala **2x**, dibatasi `capExportScale`: sisi ≤ 16.384 px, luas ≤ 16,7 juta piksel di perangkat sentuh (batas kanvas iOS Safari) atau ≤ 33,5 juta piksel di desktop. Bila dibatasi, skala diturunkan dan pengguna diberi peringatan.

Ponsel: app bar dirender oleh layout, bukan halaman, jadi halaman mendaftarkan fungsi ekspornya ke store kecil di `chart-export.tsx`; menu app bar memanggilnya dan membaca status sibuk dari store yang sama.

### Mengapa `modern-screenshot`

| Pilihan | Keputusan |
|---|---|
| `modern-screenshot` 4.x | **Dipilih.** MIT, tanpa dependensi, rilis aktif (4.7, Apr 2026), turunan `html-to-image` dengan perbaikan font (hanya font yang dipakai yang ditanam), `scale`, `domToBlob`. Dimuat lazy (± 9 kB gzip) hanya saat ekspor. |
| `html-to-image` 1.11 | Populer tetapi rilis terakhir 2025 dan banyak isu font/gambar terbuka; menanam semua `@font-face`. |
| `html2canvas(-pro)` | Menggambar ulang CSS sendiri (tidak lengkap untuk `color-mix`, `oklch`, Tailwind 4), paket besar (± 5 MB terpasang). |
| Headless browser di server | Ditolak: butuh Chromium di VPS, antrean, dan izin data terpisah. |

PDF tidak dibuat: perlu paket tambahan (mis. jsPDF) atau dialog cetak; PNG 2x sudah cukup untuk dicetak A4/A3. Bisa ditambahkan nanti dengan `domToCanvas` yang sama.

## Berkas

- `resources/js/features/organization/chart/export-utils.ts` (+ `.test.ts`): nama berkas, batas skala, `printableChart`, `rootCustomProperties`.
- `…/chart-export-sheet.tsx`, `…/export-chart-png.tsx`, `…/chart-export.tsx`.
- `…/org-chart-desktop.tsx`: isi bagan dipisah menjadi `OrgChartCanvas` (dipakai tampilan zoom dan ekspor), mode `printable`.
- `resources/js/pages/organization/structure.tsx`: tombol header + `appBarActions`.
- `tests/e2e/org-chart-export.spec.ts`: unduh PNG di 375/834/1440 × terang/gelap (masuk sebagai `kadiv@demo.test`).

## Batasan

- Bagan yang sangat besar (ratusan orang) bisa memakan waktu beberapa detik dan resolusinya diturunkan; pakai pencarian untuk mengekspor sebagian.
- Foto profil tidak ikut (lihat di atas).
