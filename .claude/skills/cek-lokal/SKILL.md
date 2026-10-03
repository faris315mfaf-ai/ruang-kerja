---
name: cek-lokal
description: Periksa kesehatan lingkungan pengembangan lokal Windows (Herd, PHP, Composer, Node, Docker Postgres/Redis/Mailpit, .env, migrasi, Reverb, queue) dan perbaiki yang aman diperbaiki. Pakai saat localhost tidak jalan atau sebelum mulai sprint.
---

# Cek lingkungan lokal

Jalankan berurutan, catat hasilnya dalam tabel (Komponen · Status · Catatan). Jangan membaca isi `.env` (dilarang di settings); cek keberadaan kunci lewat `php artisan about` dan `php artisan config:show`.

1. **Versi alat:** `php -v` (harus 8.4.x), `php -m` (wajib ada `pdo_pgsql`, `pgsql`, `redis` atau pakai Predis, `intl`, `mbstring`, `gd` atau `imagick`, `zip`), `composer -V`, `node -v` (≥ 22), `npm -v`, `docker --version`, `herd --version` bila ada.
2. **Layanan Docker:** `docker compose ps`. Bila `postgres`, `redis`, `mailpit` tidak `running`/`healthy` → `docker compose up -d` lalu cek lagi. Port: 5432, 6379, 8025 (UI Mailpit), 1025 (SMTP).
3. **Aplikasi:** `php artisan about` (environment, URL `https://ruangkerja.test`, driver DB pgsql, cache/queue/session redis, broadcast reverb). `php artisan migrate:status` (bila ada migrasi pending → `php artisan migrate`; jangan `migrate:fresh` tanpa izin).
4. **Situs Herd:** `curl -I https://ruangkerja.test` harus 200/302. Bila gagal: pastikan folder proyek ada di path Herd (`herd park` di folder induk atau `herd link ruangkerja` di folder proyek) dan `APP_URL` cocok.
5. **Proses dev:** pastikan berjalan (atau beri tahu pengguna perintahnya): `npm run dev` (Vite), `php artisan reverb:start --port=8080`, `php artisan queue:work --tries=3` (Horizon tidak berjalan di Windows; di server Linux tetap Horizon), `php artisan schedule:work`. Semuanya sudah digabung di `composer run dev:win`.
6. **Email:** kirim tes `php artisan tinker --execute="Mail::raw('tes', fn($m) => $m->to('a@demo.test')->subject('tes'));"` lalu cek http://localhost:8025.
7. **Ringkas** temuan + perbaikan yang sudah dilakukan + yang harus dilakukan pengguna (mis. memasang ekstensi PHP lewat Herd → PHP → Extensions).

Galat umum di Windows:
- `could not find driver` → aktifkan `pdo_pgsql`/`pgsql` di `php.ini` Herd, restart Herd.
- `SQLSTATE[08006] connection refused` → Docker Desktop belum jalan / container `postgres` mati.
- Port 5432 bentrok dengan PostgreSQL lokal yang terpasang → ubah `DB_FORWARD_PORT` di `.env` dan `DB_PORT`.
- Perubahan file tidak terdeteksi Vite → pastikan proyek di disk NTFS lokal (bukan OneDrive/folder sinkron).
- Akhir baris CRLF membuat skrip shell gagal → repo memakai `.gitattributes` `eol=lf`; jalankan `git add --renormalize .`.
