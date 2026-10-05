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

## Skill desain & animasi (terpasang global di `~/.claude/skills`)

Pakai skill berikut saat relevan; hasilnya tetap harus patuh pada `docs/DESIGN.md`, `docs/PLATFORM.md`, dan aturan token warna di AGENTS.md. Bila saran skill bertentangan dengan dokumen proyek, **dokumen proyek menang**.

| Kebutuhan | Skill |
|---|---|
| Review layar/alur terhadap Apple HIG (navigasi, form, aksesibilitas, mode gelap, layout mobile) | `apple-hig` |
| Gestur, sheet, spring, material/glass, tipografi ala Apple untuk web | `apple-design` |
| Membuat animasi baru (perlu tidaknya, properti, kurva, durasi, interupsi) | `animate` |
| Me-review animasi pada diff / komponen | `review-animations` |
| Audit seluruh gerak di codebase (hanya rencana) | `improve-animations`, `find-animation-opportunities` |
| Prinsip motion, ikon/loop tanpa sambungan, Lottie | `motion-design` |
| Rasa "native" PWA di ponsel (tap highlight, safe area, 100vh) | `mobile-native` |
| Stress-test UI dengan data terburuk | `break-ui` |

Batasan proyek untuk semua animasi:
- Durasi & easing dari DESIGN.md §7 (`duration-120` / `duration-180`, `ease-brand`); loop ikon/ambient boleh lebih lama tetapi frame awal = frame akhir (tanpa sambungan).
- Animasikan hanya `transform`/`opacity` bila bisa; warna lewat token, tanpa hex.
- Wajib menghormati `prefers-reduced-motion` (sudah ada aturan global di `tokens.css`; animasi loop harus berhenti di frame diam yang bermakna).
- Jangan menambah pustaka animasi baru tanpa alasan di ringkasan. Utamakan CSS/`tw-animate-css`; Lottie hanya bila aset dari desainer, dimuat lazy, dan tidak ada di bundle awal halaman Absensi.
- Setelah menambah/mengubah animasi, jalankan `review-animations` pada perubahan itu sebelum commit.

