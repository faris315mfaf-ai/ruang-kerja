# Pembagian tugas antar agen

Papan koordinasi untuk Claude Code dan Codex yang bekerja **bersamaan** (`AGENTS.md` › Kerja paralel). Sebelum mulai, agen mengklaim satu baris (isi Agen, Branch, Status `dikerjakan`) dan meng-commit perubahan papan ini di branch-nya; integrator menggabungkan. Satu modul = satu agen dari backend sampai frontend dan test.

Status: `bebas` · `dikerjakan` · `review` (PR terbuka) · `selesai` (sudah di `main`).

## Peran

| Peran | Siapa | Tugas |
|---|---|---|
| Integrator | Claude Code di checkout utama atau sesi khusus | merge/rebase ke `main`, berkas bersama (lihat AGENTS.md), CHANGELOG, HANDOFF, menyelesaikan konflik |
| Agen modul | Claude Code, Codex | satu modul per waktu di worktree sendiri |

## Antrean

Prioritas dari atas. "Folder milik" = satu-satunya tempat agen itu menulis (selain migrasi, test, dan seksi tabelnya sendiri di `docs/DATABASE.md`).

| # | Tugas | Folder milik | Agen | Branch | Status |
|---|---|---|---|---|---|
| 1 | F2-1 Obrolan: backend (tabel `channels`, `channel_members`, `messages`; Action, Policy, broadcast Reverb) menggantikan data contoh di `features/chat` | `app/Domain/Chat`, `routes/chat.php`, `resources/js/features/chat`, `resources/js/pages/chat` | Claude Code | `claude/f2-obrolan` | review |
| 2 | F2-3 Rapat & Kalender: backend (`calendar_events`, job Google Calendar/Meet di-mock) menggantikan data contoh di `features/meetings` | `app/Domain/Meetings`, `routes/meetings.php`, `resources/js/features/meetings`, `resources/js/pages/meetings` — brief lengkap: `docs/tugas/02-f2-rapat-kalender.md` | Codex | `codex/f2-rapat` (dari `claude/f2-obrolan`) | bebas |
| 3 | F2-2 Catatan bersama: backend (`notes`, `note_versions`; Yjs/Hocuspocus diputuskan dulu) | `app/Domain/Notes`, `routes/notes.php`, `resources/js/features/notes`, `resources/js/pages/notes` | — | — | bebas |
| 4 | F2-4 Otomasi & tugas berulang: backend (aturan, jadwal berulang, template) | `app/Domain/Automation`, `routes/automation.php`, `resources/js/features/automation`, `resources/js/pages/automation` | — | — | bebas |
| 5 | F3-3 OKR divisi: backend (`objectives`, `key_results`) | `app/Domain/Okr`, `routes/okr.php`, `resources/js/features/okr`, `resources/js/pages/okr` | — | — | bebas |
| 6 | Bug ringan dari `docs/sprints/fase-2-3-prototipe/BUG-REPORT.md` (target sentuh < 44px, tabel perangkat tablet, input jam) | sesuai temuan | — | — | bebas |
| 7 | Tinjau PR agen lain (`$tinjau` / `/tinjau`) | — (hanya laporan) | agen yang menganggur | — | berulang |

Tugas Fase 2/3 backend wajib mengikuti `docs/PRD.md` §6–7 dan `docs/DATABASE.md` §7–8; bila sebuah keputusan produk belum ada (mis. provider WhatsApp, Hocuspocus), tulis pertanyaannya di catatan sesi dan tanyakan pengguna.
