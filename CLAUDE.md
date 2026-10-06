# CLAUDE.md

Aturan proyek ada di AGENTS.md (dipakai bersama dengan Codex dan Z-AI). Selalu ikuti:

@AGENTS.md

Dokumen acuan:
- @docs/PRD.md
- @docs/DATABASE.md
- @docs/ARCHITECTURE.md
- @docs/DESIGN.md
- @docs/PLATFORM.md
- @docs/SETUP-LOKAL.md
- @docs/mockups/INDEX.md

Catatan khusus Claude Code (aturan umum, lingkungan, serah terima antar agen, dan batasan gerak ada di AGENTS.md):
- Gunakan Plan Mode untuk setiap sprint baru.
- Untuk interaksi di browser pakai panel browser bawaan atau Chrome (sesi `--chrome`); screenshot acuan tetap dari `node scripts/ui-shots.mjs`. Perintah siap pakai: `/sprint`, `/cek-ui`, `/cek-lokal`, `/tinjau` (sumbernya `.agents/skills/`, jangan edit `.claude/skills/` langsung).
- Bila kuota hampir habis atau pengguna akan pindah ke Codex: perbarui `docs/sesi/<agen>.md` dan commit sebelum berhenti.

## Skill desain & animasi (global, `~/.claude/skills`; juga tersedia untuk Codex di `~/.agents/skills`)

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

Setelah menambah/mengubah animasi, jalankan `review-animations` pada perubahan itu sebelum commit.
