---
name: sprint
description: Jalankan satu sprint RuangKerja dari docs/PROMPTS.md secara disiplin (rencana → bangun desktop & mobile → test → cek UI di localhost → ringkasan). Pakai saat pengguna menulis /sprint <nomor>.
argument-hint: [nomor-sprint, mis. 0 atau 5]
disable-model-invocation: true
---

# Sprint $ARGUMENTS

1. **Baca konteks.** Buka `docs/PROMPTS.md`, ambil blok prompt "Sprint $ARGUMENTS" (salin utuh ke ringkasan rencana). Baca dokumen yang disebut di blok itu, ditambah `AGENTS.md` dan `docs/PLATFORM.md`. Cari layar terkait di `docs/mockups/INDEX.md` lalu lihat PNG desktop **dan** mobile-nya (`docs/mockups/png/…`).
2. **Cek lingkungan.** Jalankan langkah skill `cek-lokal` (cukup bagian cepat: `docker compose ps`, `php artisan about --only=environment`). Bila Postgres/Redis mati, jalankan `docker compose up -d` dulu.
3. **Rencana.** Tulis rencana singkat: file yang dibuat/diubah, migrasi, policy, test, layar desktop & mobile yang terdampak, dan risiko. Tanyakan pengguna hanya bila ada konflik dengan `docs/`.
4. **Bangun bertahap.** Buat branch `feat/sprint-$ARGUMENTS-<topik>`. Commit per langkah logis (Conventional Commits). Ikuti Definition of Done di `AGENTS.md`.
5. **Verifikasi otomatis.** `composer test`, `composer lint`, `npm run typecheck`, `npm run lint`. Perbaiki sampai hijau.
6. **Verifikasi tampilan.** Jalankan skill `cek-ui` untuk setiap layar yang disentuh sprint ini (desktop 1440 & mobile 390, terang & gelap); `cek-ui` sudah mencakup review `apple-hig` dan `review-animations`. Animasi baru dibangun dengan skill `animate` / `motion-design` sesuai batasan di CLAUDE.md.
7. **Ringkasan akhir** (Bahasa Indonesia): apa yang selesai per acceptance criteria (centang), cara mencoba manual di `https://ruangkerja.test`, akun demo yang dipakai, keputusan yang diambil, dan sisa pekerjaan. Jangan `git push` tanpa izin.
