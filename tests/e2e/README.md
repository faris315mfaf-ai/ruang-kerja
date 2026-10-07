# Uji visual (Playwright)

Smoke test visual untuk `/dashboard` dan `/menu` di 3 lebar (375 · 834 · 1440 px) × 2 tema (terang · gelap) = 6 proyek. Tiap halaman dicek: status 200, tidak ada galat console (termasuk pelanggaran CSP), tidak ada gulir horizontal, dan cocok dengan screenshot acuan.

Galat console yang sengaja diabaikan (bukan cacat halaman): koneksi WebSocket gagal (Reverb tidak dijalankan) dan respons 429 dari polling latar belakang (semua proyek memakai satu akun demo).

**Tidak** termasuk `npm test` (Vitest) dan tidak jalan di CI.

## Menjalankan

Prasyarat: aplikasi lokal jalan dengan `APP_ENV=local`, `DEMO_LOGIN_ENABLED=true`, database sudah di-seed (`php artisan migrate --seed`), dan aset ter-build (`npm run build`) atau `npm run dev` hidup.

```bash
npx playwright install chromium     # sekali per mesin (browser TIDAK di-commit)
npm run test:e2e:baseline           # sekali: membuat screenshot acuan
npm run test:e2e                    # target: E2E_BASE_URL → APP_URL → https://ruangkerja.test
E2E_BASE_URL=http://127.0.0.1:8000 npm run test:e2e
E2E_DEMO_EMAIL=admin@demo.test npm run test:e2e -- --project=desktop-dark
npx playwright show-report          # laporan HTML (playwright-report/)
```

## Screenshot acuan

- Disimpan di `tests/e2e/__screenshots__/<platform>/<proyek>/` dan **tidak di-commit** (bergantung OS, font, dan data seed lokal).
- Buat acuan dengan `npm run test:e2e:baseline` sebelum mengubah UI, lalu `npm run test:e2e` setelahnya untuk melihat selisih (laporan HTML menampilkan expected/actual/diff). Tanpa acuan, `test:e2e` gagal sekali sambil menulis acuan.
- Perubahan tampilan yang memang disengaja: jalankan ulang `npm run test:e2e:baseline`.

## Ekspor PNG struktur organisasi

`tests/e2e/org-chart-export.spec.ts` masuk sendiri sebagai `kadiv@demo.test` (staf mendapat 404; ganti dengan `E2E_CHART_EMAIL`), menekan **Unduh PNG** (ponsel: menu "…" app bar) dan memeriksa unduhan berupa PNG bernama `struktur-organisasi-YYYY-MM-DD.png`. Tanpa screenshot acuan.

```bash
E2E_BASE_URL=https://ruangkerja-<agen>.test npx playwright test tests/e2e/org-chart-export.spec.ts --workers=2
```

## Realtime dua pengguna (Sprint 6, manual)

`tests/e2e/realtime-two-users.mjs` membuka dua sesi (Dimas & Rizky): presence "Rizky sedang melihat", komentar dengan mention, reaksi, dan pindah status dari sheet B ke board A — mencetak latensi (ms, harus < 1000) dan screenshot (detail layar penuh terang/gelap, mobile, tablet).

Prasyarat: Reverb hidup, worker antrean `realtime` (`php artisan queue:work --queue=realtime --sleep=0` atau Horizon `supervisor-realtime`), data baru di-seed.

```bash
php artisan migrate:fresh --seed
E2E_BASE_URL=https://ruangkerja.test node tests/e2e/realtime-two-users.mjs
```

## Kehadiran per kartu board (dua pengguna, manual)

`node tests/e2e/board-presence-two-users.mjs` membuka board `/w/PLQ` sebagai Dimas dan tugas PLQ-21 sebagai Rizky, lalu memeriksa avatar, petunjuk "mengetik…", dan hilangnya kehadiran saat sheet/tab ditutup. Butuh Reverb berjalan (`php artisan reverb:start`), tidak butuh queue worker.

## Skrip manual dua pengguna

- `realtime-two-users.mjs`, `board-presence-two-users.mjs`: realtime tugas (butuh Reverb).
- `rapat-video-two-users.mjs`: Video RuangKerja — Dimas (desktop, terang) dan Rizky (ponsel, malam) bergabung ke ruang LiveKit yang sama dengan kamera/mikrofon palsu Chromium; memeriksa ubin peserta lain, video jarak jauh berputar, angkat tangan, chat, bisukan oleh penyelenggara, jumlah di ruang dari webhook, keluar. Butuh LiveKit lokal (`docs/SETUP-LOKAL.md` › "Rapat video") dan `E2E_MEETING` = rapat video yang sedang dalam jendela gabung.
