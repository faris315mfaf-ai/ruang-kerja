# Fitur navigasi — Dock Organisasi, dock kapsul mobile, mode "Pilih" Persetujuan

Cabang `feat/fitur-navigasi`. Hanya frontend; backend tidak disentuh (endpoint `approvals.bulk` sudah ada).

## Kriteria penerimaan

| # | Kriteria | Status |
|---|---|---|
| 1 | Dock desktop punya stack **Organisasi**: Struktur organisasi (semua peran), Kelola organisasi `/admin/organisasi` (HR/Super Admin), Karyawan / Anggota divisi `/admin/karyawan` | ✓ |
| 1 | Ketiganya dihapus dari tile utama & stack Admin → setiap tujuan muncul tepat sekali | ✓ (test "lists every desktop destination exactly once per role") |
| 1 | Stack Admin tetap: Absensi hari ini, Rekap absensi, Lokasi & shift, Audit log, Jenis pengajuan, Saldo cuti + **Dokumentasi** `/admin/dokumentasi` (Super Admin, desktop saja, ikon `BookOpen`) | ✓ |
| 1 | Menu mobile konsisten, tidak ada baris yang hilang | ✓ (Struktur organisasi, Karyawan/Anggota divisi, Absensi hari ini — sama seperti sebelumnya; test) |
| 2 | Tab bawah jadi *dock kapsul*: 10px dari tepi, `bottom: calc(env(safe-area-inset-bottom) + 10px)`, `rounded-full`, glass, `--dock-shadow`, maks 420px di tengah | ✓ |
| 2 | Pil aktif bergeser (transform 180ms `ease-brand`, instan dengan reduced motion), umpan balik saat ditekan, target ≥ 44px, badge tetap, sembunyi saat keyboard terbuka | ✓ |
| 2 | Padding konten, FAB, bilah aksi bawah tetap bebas dari kapsul | ✓ (semua memakai `--tab-bar-height`; ringkasan proyek yang memakai `64px` tetap ikut diperbaiki; toast mobile juga digeser) |
| 3 | Persetujuan mobile: tombol **Pilih** → kartu bercentang (44px), geser nonaktif, bilah bawah lengket **Batal · Setujui (n)** via `approvals.bulk`, Pilih semua dalam tab | ✓ |
| — | Test Vitest navigasi, Dock, TabBar, seleksi, layar Persetujuan mobile | ✓ |

## Keputusan

- **Label "Kelola organisasi"** untuk `/admin/organisasi` (sebelumnya "Organisasi") agar tidak sama dengan nama stack-nya.
- **Stack berisi satu entri tampil sebagai tile biasa.** Anggota dan Direksi hanya melihat Struktur organisasi, jadi mereka tetap mendapat tile "Struktur organisasi" seperti sebelumnya (stack satu isi hanya menambah ketukan).
- Helper baru `organizationNavItems(roles)` di `lib/navigation.ts`; `adminNavItems` tidak lagi memuat Karyawan/Organisasi. Menu mobile memakai helper yang sama (difilter `desktopOnly`).
- **`--tab-bar-height` kini berarti ruang yang dipakai kapsul di atas safe area** = kapsul 60px (`--tab-bar-capsule`) + angkat 10px (`--screen-gutter`) + 8px ruang napas = 78px. Semua kalkulasi lama `calc(var(--tab-bar-height) + env(safe-area-inset-bottom))` otomatis benar, termasuk berkas modul lain (mis. formulir pengajuan mobile) tanpa perlu diubah.
- **Pil bergerak saat diketuk** (sebelum halaman berikutnya datang) lalu mengikuti URL; bila kunjungan batal, pil kembali (`router.on('finish')`). Umpan balik tekan memakai `:active` (scale .9, 120ms) — muncul saat jari turun.
- **Toast mobile** memakai `--toast-offset-bottom` yang hanya aktif saat tab bar tampil (`:root:has(nav[data-tab-bar])`), jadi tidak menutupi kapsul dan halaman tamu tidak terpengaruh.
- **Tombol "Pilih" di baris toolbar** (di bawah tab, menggantikan petunjuk "Geser kartu…" saat memilih), bukan di app bar: props layout statis sehingga app bar butuh store global; toolbar lebih sederhana dan tetap satu jangkauan jempol. Pilih hanya ada di tab *Menunggu*; pindah tab membatalkan seleksi.
- **Hanya setujui massal**, sama dengan desktop: menolak butuh alasan per pengajuan. "Pilih semua" dibatasi 100 (batas `BulkApproveRequest`); galat validasi tampil sebagai toast.
- Seluruh kartu dalam mode Pilih adalah satu `role="checkbox"` (label: nama, jenis, periode); tidak ada tautan/geser agar tidak salah ketuk.

## Perbaikan yang ditemukan saat verifikasi

- **Glass tidak pernah blur di Chrome.** `tokens.css` menulis `backdrop-filter` lalu `-webkit-backdrop-filter`; minifier CSS menggabungkannya menjadi versi `-webkit-` saja, yang tidak dikenali Chrome/Android. Urutan dibalik → kedua properti ada di build. Berdampak ke semua lapisan glass (menu bar, Dock, tab bar, popover, sheet).
- **Ikon di stack Dock tak terlihat**: `DropdownMenuItem` shadcn meredupkan SVG tanpa kelas `text-*` (abu di atas abu). Ikon stack kini `text-on-brand`.

## Cara mencoba manual (https://ruangkerja.test)

1. Desktop 1440, `admin@demo.test`: Dock → tile **Organisasi** (3 entri) dan **Admin** (7 entri, termasuk Dokumentasi). `hr@demo.test`: Admin tanpa Audit log/Dokumentasi. `anggota@demo.test`: tile Struktur organisasi biasa, tanpa stack Organisasi/Admin.
2. Ponsel 390 (DevTools), `kadiv@demo.test`: tab bawah berbentuk kapsul; ketuk tab → pil bergeser. Buka Menu: Struktur organisasi, Anggota divisi, Absensi hari ini masih ada.
3. Ponsel, `kadiv@demo.test` → Persetujuan → **Pilih** → centang 2 kartu → **Setujui (2)** → toast "2 pengajuan disetujui." dan mode Pilih tertutup.

## Verifikasi

- Alur nyata mode Pilih diuji via Playwright: 2 dicentang → "2 pengajuan disetujui.", kartu tersisa 1, mode Pilih tertutup.
- `npm run build` ✓; Playwright headless (server lokal worktree) desktop 1440 terang/gelap (Dock, stack Organisasi & Admin, Dock anggota) dan mobile 390 terang/gelap (Beranda, Menu, Tugas + FAB, Persetujuan & mode Pilih). Tidak ada error halaman.
- `rk_test` 1877 test hijau, `composer lint` hijau, `npm run typecheck` / `npm run lint` hijau, `npm test` 52 berkas / 303 test hijau.
- Skill `review-animations` tidak bisa dipanggil agent (khusus pengguna); animasi ditinjau manual terhadap DESIGN.md §7 (hanya transform/opacity, 120/180ms, `ease-brand`, reduced motion).

## Paket baru

Tidak ada.

## Sisa

- Rute `/admin/dokumentasi` dibangun agent lain; entri navigasinya sudah ada (404 sampai cabang itu digabung).
- Disarankan pemilik menjalankan `/review-animations` pada `tab-bar.tsx` dan `approvals.mobile.tsx`.
