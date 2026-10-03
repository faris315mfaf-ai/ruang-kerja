# CLAUDE.md

Aturan proyek ada di AGENTS.md (dipakai bersama dengan Z-AI). Selalu ikuti:

@AGENTS.md

Dokumen acuan:
- @docs/PRD.md
- @docs/DATABASE.md
- @docs/ARCHITECTURE.md
- @docs/DESIGN.md
- @docs/PLATFORM.md
- @docs/SETUP-LOKAL.md
- @docs/mockups/INDEX.md

Catatan khusus Claude Code:
- Gunakan Plan Mode untuk setiap sprint baru. Tunjukkan rencana sebelum menulis kode.
- Jalankan test & lint sendiri setelah setiap perubahan. Jangan meminta pengguna menjalankannya.
- Commit per langkah logis dengan format Conventional Commits.
- Lingkungan: Windows native + Git Bash. Aplikasi disajikan Laravel Herd di https://ruangkerja.test; layanan via `docker compose`. Jangan menjalankan `php artisan serve` kecuali untuk uji OAuth Google (lihat SETUP-LOKAL §6).
- Untuk memeriksa tampilan, pakai Chrome (sesi dijalankan dengan `--chrome`) dan bandingkan dengan `docs/mockups/png/`. Perintah siap pakai: `/sprint`, `/cek-ui`, `/cek-lokal`, `/tinjau`.
- Jangan membaca atau menampilkan isi `.env`; minta pengguna mengisi rahasia sendiri.
