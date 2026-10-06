---
name: cek-lokal
description: Periksa kesehatan lingkungan pengembangan lokal (macOS atau Windows: Herd, PHP, Composer, Node, Docker Postgres/Redis/Mailpit, .env, migrasi, Reverb, queue) dan perbaiki yang aman diperbaiki. Pakai saat localhost tidak jalan atau sebelum mulai sprint.
---

# Cek lingkungan lokal

Jalankan berurutan, catat hasilnya dalam tabel (Komponen · Status · Catatan). **Jangan membaca isi `.env`**; cek nilai lewat `php artisan about` dan `php artisan config:show <kunci>`.

macOS: bila `php`/`composer`/`herd` tidak ditemukan, tambahkan `export PATH="$HOME/Library/Application Support/Herd/bin:$PATH"`. Port lokal di Mac pengembang berbeda dari default (lihat `docs/SETUP-LOKAL.md` §10: Postgres 5434, Redis 6380, Mailpit UI 8026, Reverb 8081).

1. **Versi alat:** `php -v` (8.4.x), `php -m` (wajib `pdo_pgsql`, `pgsql`, `intl`, `mbstring`, `zip`, `gd`), `composer -V`, `node -v` (≥ 22), `npm -v`, `docker --version`, `herd --version` bila ada.
2. **Layanan Docker:** `docker compose ps`. Bila `postgres`, `redis`, `mailpit` tidak `running`/`healthy` → `docker compose up -d` lalu cek lagi.
3. **Aplikasi:** `php artisan about` (environment local, URL `https://ruangkerja.test`, DB pgsql, cache/queue/session redis, broadcast reverb). `php artisan migrate:status` (migrasi pending → `php artisan migrate`; jangan `migrate:fresh` tanpa izin).
4. **Situs Herd:** `curl -sk -o /dev/null -w "%{http_code}" https://ruangkerja.test/login` harus 200. Bila gagal: `herd link ruangkerja && herd secure ruangkerja` dari folder proyek, dan `APP_URL` cocok.
5. **Proses dev:** macOS/Linux `composer run dev` (server + Horizon + Reverb + Vite); Windows `composer run dev:win` (Vite + Reverb + queue:work + schedule:work). Bila hanya ingin melihat UI: `npm run build` cukup.
6. **Email:** `php artisan tinker --execute="Mail::raw('tes', fn(\$m) => \$m->to('a@demo.test')->subject('tes'));"` lalu cek UI Mailpit.
7. **Ringkas** temuan + perbaikan yang sudah dilakukan + yang harus dilakukan pengguna.

Galat umum:
- `could not find driver` → aktifkan `pdo_pgsql`/`pgsql` di PHP Herd, restart Herd.
- `SQLSTATE[08006] connection refused` → Docker belum jalan / kontainer `postgres` mati / port `.env` tidak cocok.
- Codex: perintah yang butuh jaringan lokal (Postgres, Redis, Herd https) gagal di sandbox → pastikan `.codex/config.toml` proyek terbaca (proyek harus *trusted*) atau jalankan dengan `-c sandbox_workspace_write.network_access=true`.
- Akhir baris CRLF membuat skrip shell gagal (Windows) → `git add --renormalize .`.
