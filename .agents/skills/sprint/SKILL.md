---
name: sprint
description: Jalankan satu sprint RuangKerja dari docs/PROMPTS.md secara disiplin (rencana → bangun desktop & mobile → test → cek UI di localhost → ringkasan). Pakai saat pengguna meminta "sprint <nomor>" (/sprint <nomor> di Claude Code, $sprint di Codex).
argument-hint: [nomor-sprint, mis. 0 atau 5]
disable-model-invocation: true
---

# Sprint $ARGUMENTS

`$ARGUMENTS` = nomor sprint dari pengguna (agen yang tidak mengganti `$ARGUMENTS` otomatis: ambil dari pesan pengguna).

1. **Baca konteks.** Buka `docs/PROMPTS.md`, ambil blok prompt "Sprint $ARGUMENTS" (salin utuh ke ringkasan rencana). Baca dokumen yang disebut di blok itu, ditambah `AGENTS.md` dan `docs/PLATFORM.md`. Cari layar terkait di `docs/mockups/INDEX.md` dan `docs/ruangkerja-design/README.md`, lalu lihat PNG desktop **dan** mobile-nya.
2. **Cek lingkungan.** Jalankan bagian cepat skill `cek-lokal` (`docker compose ps`, `php artisan about --only=environment`). Bila Postgres/Redis mati, jalankan `docker compose up -d` dulu.
3. **Rencana.** Tulis rencana singkat: file yang dibuat/diubah, migrasi, policy, test, layar desktop & mobile yang terdampak, dan risiko. Tunjukkan ke pengguna sebelum menulis kode. Tanyakan hanya bila ada konflik dengan `docs/`.
4. **Bangun bertahap.** Buat branch `feat/sprint-$ARGUMENTS-<topik>`. Commit per langkah logis (Conventional Commits). Ikuti Definition of Done di `AGENTS.md`. Perbarui `docs/SESI-AKTIF.md` setiap selesai satu langkah (lihat AGENTS.md › Serah terima antar agen).
5. **Verifikasi otomatis.** `composer test`, `composer lint`, `npm run typecheck`, `npm run lint`, `npm test`. Perbaiki sampai hijau.
6. **Verifikasi tampilan.** Jalankan skill `cek-ui` untuk setiap layar yang disentuh sprint ini (desktop 1440 & mobile 390, terang & malam). Animasi baru mengikuti batasan gerak di `AGENTS.md`.
7. **Ringkasan akhir** (Bahasa Indonesia): apa yang selesai per acceptance criteria (centang), cara mencoba manual di `https://ruangkerja.test`, akun demo yang dipakai, keputusan yang diambil, dan sisa pekerjaan. Jangan `git push` tanpa izin.
