# Laporan Cek Bug — Prototipe Fase 2 & 3

> Agen Cek Bug · 6 Okt 2026 · worktree `claude/project-overview-status-ebff38` · aplikasi di https://ruangkerja-proto.test (Herd, aset hasil `npm run build`)

Cakupan: lima modul pratinjau buatan Agen A–E (Obrolan & Catatan, Rapat & Kalender, Otomasi & WhatsApp & Kinerja, Aplikasi ponsel, OKR & Mesin absensi & Dashboard peran) ditambah rute utama Fase 1.

## 1. Ringkasan perintah

| Perintah | Hasil awal | Hasil akhir |
|---|---|---|
| `npm run typecheck` | hijau (0 galat) | hijau |
| `npm run lint` (`vp check`) | **merah**: format `compose.shared.yml` | hijau: 735 file terformat, 0 peringatan lint di 722 file |
| `npm test` (Vitest) | **merah**: 4 test gagal (`lib/device.test.ts`, `features/search/recent-searches.test.ts`) | hijau: 75 file, 496 test |
| `composer test` (Pest) | hijau: 2.095 test, 13.271 asersi | hijau (tidak ada perubahan PHP) |
| `composer lint` (Pint + Larastan) | hijau (0 galat) | hijau |
| `npm run build` (dengan `build.lock`) | sukses | sukses |
| `E2E_BASE_URL=https://ruangkerja-proto.test npx playwright test tests/e2e/prototype-smoke.spec.ts --workers=2 --retries=1` | (spesifikasi baru) | **348 lulus, 1 flaky** (lulus saat diulang), 0 gagal |

Catatan e2e: dengan worker bawaan (9) atau 4 worker, Herd mulai menjawab **502 untuk aset statis** dan chunk lazy gagal dimuat (`Failed to fetch dynamically imported module`), terutama saat agen lain ikut menjalankan Playwright (±90 proses node pada saat uji). Itu beban lingkungan lokal, bukan cacat halaman. Karena itu spesifikasi mencantumkan `--workers=2 --retries=1`.

## 2. Bug yang diperbaiki

| # | File | Gejala | Perbaikan |
|---|---|---|---|
| 1 | `vite.config.ts` (`fmt.ignorePatterns`) | `npm run lint` merah karena `compose.shared.yml` (file deploy baru, YAML 2 spasi) tidak lolos oxfmt (4 spasi). | Menambah `compose.shared.yml` ke daftar abaikan format, sama seperti `compose.yml` dan `compose.prod.yml`. Isi file tidak diubah. |
| 2 | `vite.config.ts` (`test.setupFiles`) + file baru `resources/js/test/vitest.setup.ts` | 4 test lama gagal di Node 26: `TypeError: Cannot read properties of undefined (reading 'clear')`. Penyebab: Node ≥ 25 punya getter global `localStorage` yang bernilai `undefined` tanpa `--localstorage-file`, dan lingkungan jsdom Vitest tidak menimpa global yang sudah ada, sehingga `window.localStorage` kosong. | File setup khusus test: bila `globalThis.localStorage`/`sessionStorage` `undefined`, arahkan ke instance `Storage` milik jsdom (`globalThis.jsdom.window`). Spy pada `Storage.prototype` tetap jalan. Tidak menyentuh kode aplikasi dan tidak ikut di-bundle. |
| 3 | `resources/js/features/dashboard/trend-chart.tsx` (Fase 1, sepele) | `/dashboard` di 375 px menggulir horizontal (26 px untuk direksi@, 5 px untuk kadiv@). Penyebabnya `<table className="sr-only">`: tabel tidak mematuhi kotak 1 px dari `sr-only`, jadi lebarnya melewati viewport. | Tabel dibungkus `<div className="sr-only">`. Pembaca layar tetap membaca tabelnya. Overflow menjadi 0 di 375/834. |
| 4 | `resources/js/features/okr/kr-chart.tsx`, `resources/js/features/automation/performance/week-chart.tsx` | Pola `table.sr-only` yang sama (berisiko overflow bila wadahnya tidak memotong). | Dibungkus `div.sr-only` seperti #3. |
| 5 | `resources/js/features/automation/recurring/recurring-screen.tsx` | Tablet 834 px (Rail): baris "Tugas berulang" sempit. Kolom meta dikunci 360 px mulai `md`, jadi judul terpotong per kata ("Rekap stok / mingguan") dan pola ulang menjadi 5 baris. | Tata letak baris (flex-row + kolom meta 360 px) dipindah dari `md:` ke `lg:`. Di tablet meta turun ke bawah judul, seperti di ponsel. |
| 6 | `resources/js/features/meetings/minutes-view.tsx` | Ponsel (`/rapat/standup-ops/notulen`): tombol "Hapus keputusan/butir" 36 px dan checkbox "Selesai: …" 24–26 px, di bawah aturan sentuh 44 px. | Tombol hapus `max-md:size-11`. Checkbox mendapat area sentuh 44 px lewat pseudo-elemen `after:-inset-2.5` (konstanta `HIT_AREA`), tanpa mengubah tata letak. |
| 7 | `resources/js/features/chat/composer.tsx` | Kotak tulis pesan di ponsel hanya 40 px tingginya. | `min-h-11` + `py-2.5` (44 px). |
| 8 | `resources/js/features/meetings/meeting-form.tsx`, `resources/js/features/meetings/people-picker.tsx` | Tautan "Atur WhatsApp" setinggi 26 px dan tombol hapus chip peserta 32 px di form Jadwalkan rapat. | Area sentuh diperluas ke ≥ 44 px dengan pseudo-elemen `after:` (tata letak tetap). |

Semua perubahan sudah diformat (`vp check --fix`), lolos typecheck, dan dicek ulang di browser (overflow 0, target kecil yang disebut di atas tidak muncul lagi).

## 3. Bug terbuka

| # | File | Gejala | Keparahan | Alasan tidak diperbaiki |
|---|---|---|---|---|
| 1 | `resources/js/features/dashboard/personal.desktop.tsx:205-230`, `personal.mobile.tsx:41-45` | **Sudah diketahui, terverifikasi crash.** Login sebagai `anggota@demo.test`, buka `/dashboard`: layar kosong di 1440 dan 375 px, `pageerror: Cannot read properties of undefined (reading 'total')`. Bukti: `PersonalDashboard::live()` (`app/Domain/Analytics/Queries/PersonalDashboard.php:68-90`) hanya mengirim `profile`, `leave_balance`, `requests`. `live.focus` & `live.week` sudah pindah ke prop `planner` ("Ruang saya", commit 69cf9f0), tetapi `live.focus.total` / `live.week.total` masih dibaca. Kadiv@ & direksi@ tidak terdampak karena melihat dashboard divisi. | Kritis (Beranda anggota tidak bisa dipakai) | **Diperbaiki setelah laporan ini:** UI Ruang saya (`resources/js/features/dashboard/ruang-saya/`) memakai prop `planner`; Beranda desktop & ponsel tanpa galat, aksi rencanakan diuji (PUT `/ruang-saya/tugas/{id}` 200). |
| 2 | `tests/e2e/visual-smoke.spec.ts` (Fase 1) | Pola abaikan `/status of 429 \(Too Many Requests\)/` tidak cocok di HTTP/2. Teks status kosong, sehingga pesannya `status of 429 ()`. Akibatnya galat polling `/inbox/feed` tetap menggagalkan test. | Rendah (hanya test) | **Diperbaiki (tugas #6):** pola diganti `/status of 429\b/`. |
| 3 | `resources/js/features/tasks/detail/reactions.tsx` (Fase 1, dipakai ulang di Obrolan) | Di ponsel, chip reaksi (36 px) dan tombol "Tambah reaksi" (36×36) di bawah 44 px. | Rendah | **Diperbaiki (tugas #6):** utilitas `hit-area` (area sentuh ≥ 44×44 lewat pseudo-elemen) di chip reaksi; ukuran visual tetap. |
| 4 | Primitif bersama `components/ui/switch.tsx` (md 52×32), `components/mobile/chip-scroller.tsx` (42 px), `components/ui/tabs.tsx` SegmentedTabs (38 px) | Pemeriksa target sentuh menandai ketiganya di banyak layar ponsel (Otomasi, WhatsApp, Perangkat, OKR, Dashboard peran, `/tugas`, `/portofolio`). | Rendah / keputusan desain | **Diperbaiki (tugas #6) tanpa mengubah ukuran Arus:** `hit-area` (`resources/css/app.css`) di Switch, ChipScroller, dan item SegmentedTabs. |
| 5 | `resources/js/features/mobile-app/devices-view.tsx` | Di tablet 834, tabel perangkat bergulir horizontal di dalam kartunya (halaman tidak ikut bergulir). | Rendah | **Diperbaiki (tugas #6):** di bawah `lg` kolom "Terakhir aktif" dan "Integritas" pindah ke bawah nama perangkat. |
| 6 | `resources/js/features/fingerprint/use-fingerprint.ts` | Hasil "Uji koneksi" dan mesin baru memakai jam nyata (`new Date()`), sedangkan waktu relatif lain memakai "sekarang" fixture (5 Okt 08.45). Jam yang tampil bisa tidak sejalan dengan data contoh. | Kosmetik | **Diperbaiki (tugas #6):** jam mengikuti jam contoh (`initial.now` + waktu sejak halaman dimuat). |
| 7 | `/rapat/baru` (input `type=date/time` bawaan) | Format tanggal/jam mengikuti locale browser (Chromium Playwright: `10/06/2026`, `03:00 PM`). | Kosmetik | Masuk tugas #2 (Codex, `docs/tugas/02-f2-rapat-kalender.md` §7): form rapat diganti pemilih jam 24 jam. |
| 8 | `/manajemen` sebagai kadiv@ | 403 "Akses ditolak". | Bukan bug | Sesuai desain: butuh permission `dashboard.view_company`. |

## 4. Cakupan pemeriksaan

**Otomatis (Playwright, skrip `storage/app/proto-check/bug/audit.mjs`, diabaikan git)**: 45 rute × 3 lebar (375 · 834 · 1440) × 2 tema (terang · malam) × 2 akun (kadiv@, direksi@) = **540 halaman**, ditambah `/dashboard` sebagai anggota@.
- Rute pratinjau: `/pratinjau`, `/obrolan`, `/obrolan/umum`, `/catatan`, `/catatan/sop-onboarding`, `/rapat`, `/rapat/baru`, `/rapat/standup-ops`, `/rapat/standup-ops/notulen`, `/kalender`, `/manajemen/jadwal`, `/pengaturan/whatsapp`, `/otomasi`, `/otomasi/berulang`, `/otomasi/template`, `/kinerja`, `/pratinjau/ponsel` + `masuk`, `integritas`, `offline`, `widget`, `kunci`, `aksi-cepat`, `/absensi/wajah`, `/pengaturan/perangkat`, `/okr`, `/okr/q4-ops-1`, `/admin/mesin-absensi`, `/peran/{dirut, direktur, hr, corsec, marketing, programming, implementer, analis}`.
- Rute Fase 1: `/dashboard`, `/menu`, `/tugas`, `/absensi`, `/pengajuan`, `/persetujuan`, `/inbox`, `/manajemen`, `/portofolio`.
- Yang diperiksa per halaman: `pageerror` & console error (WebSocket Reverb dan 429 polling diabaikan), respons HTTP ≥ 400, gulir horizontal, elemen interaktif < 44 px di ponsel (tautan inline dan area sentuh pseudo-elemen dikecualikan), ukuran huruf input ponsel < 16 px, teks bahasa Inggris yang tampil (teks node + `aria-label`/`placeholder`/`title`).
- Hasil: **0 pageerror/console error** di semua rute pratinjau. Satu-satunya 4xx adalah `/manajemen` 403 untuk kadiv (sesuai desain). Overflow hanya di `/dashboard` 375 (sudah diperbaiki, #3). **0 input < 16 px. 0 teks Inggris.**
- Screenshot ditinjau lewat lembar kontak (`storage/app/proto-check/bug/sheets/`) di 1440 malam, 834 terang/malam, dan 375 terang/malam. Mode malam semua modul terbaca (kontras token benar, tidak ada permukaan putih tersisa).

**Alur inti per modul (skrip `flows.mjs`) di 1440 terang, 375 terang, dan 834 malam (direksi@)**, semuanya lulus:
tautan hub `/pratinjau` (24 tautan, semua 200) · kirim pesan obrolan · ketik di editor catatan → "Tersimpan" · Isi contoh → Periksa → Kirim undangan · notulen "Jadikan tugas" → OPS-1xx · kalender tampilan Minggu · validasi "Aturan baru" otomasi · WhatsApp nomor → kode 246810 → Terhubung · dialog Tugas berulang baru · ganti periode Kinerja · masuk biometrik → Berhasil · antrean offline "Coba kirim sekarang" · persetujuan biometrik wajah → Mulai pemindaian · cabut perangkat (konfirmasi → hilang dari daftar) · OKR kartu → detail → dialog check-in KR · dialog Tambah mesin · alur HR "Tinjau cuti Sari" → Setujui · ganti peran (SegmentedTabs/ChipScroller) mengubah URL.

**Fokus keyboard** (Tab ×12 di `/obrolan`, `/rapat/baru`, `/okr`, 1440 dan 834): setiap elemen yang terfokus punya indikator (outline/cincin).

**Spesifikasi e2e baru** `tests/e2e/prototype-smoke.spec.ts` (pola `visual-smoke.spec.ts`, tanpa baseline screenshot): 36 rute pratinjau + `?keadaan=memuat|kosong|galat` di 6 modul + tautan tak dikenal → "tidak ditemukan" (`/obrolan`, `/catatan`, `/rapat`, `/okr`), di 6 proyek (375/834/1440 × terang/malam). Diperiksa: status 200, tidak dialihkan ke login, banner pratinjau tampil, tidak ada gulir horizontal, console bersih (429 hanya diabaikan untuk `/inbox/feed`).
