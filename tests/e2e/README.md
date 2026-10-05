# Uji visual (Playwright)

Smoke test visual untuk `/dashboard` dan `/menu` di 3 lebar (375 · 834 · 1440 px) × 2 tema (terang · gelap) = 6 proyek. Tiap halaman dicek: status 200, tidak ada galat console (termasuk pelanggaran CSP), tidak ada gulir horizontal, dan cocok dengan screenshot acuan.

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
