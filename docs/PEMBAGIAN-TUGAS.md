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
| 1 | F2-1 Obrolan: backend (tabel `channels`, `channel_members`, `messages`; Action, Policy, broadcast Reverb) menggantikan data contoh di `features/chat` | `app/Domain/Chat`, `routes/chat.php`, `resources/js/features/chat`, `resources/js/pages/chat` | Claude Code | `claude/f2-obrolan` | selesai (PR #5) |
| 2 | F2-3 Rapat, notulen, kalender & jadwal manajemen: tabel `meetings`, `meeting_participants`, `meeting_minutes`, `meeting_minute_versions`, `meeting_action_items` (sinkron Google Calendar/Meet **ditahan**) | `app/Domain/Meetings`, `routes/meetings.php`, `resources/js/features/meetings`, `resources/js/pages/meetings` | Claude Code (dialihkan dari Codex, 6 Okt) | `claude/f2-rapat` | selesai (PR #5) |
| 3 | F2-2 Catatan bersama: `notes`, `note_versions`, `note_shares`, server Hocuspocus/Yjs (`collab/`) | `app/Domain/Notes`, `routes/notes.php`, `collab/`, `resources/js/features/notes`, `resources/js/pages/notes` | Claude Code | `claude/f2-catatan` | selesai (PR #5) |
| 4 | F2-4 Otomasi (aturan, tugas berulang, template) + Kinerja saya (WhatsApp **ditahan**) | `app/Domain/Automation`, `routes/automation.php`, `resources/js/features/automation`, `resources/js/pages/automation` | Claude Code | `claude/f2-otomasi` | selesai (PR #5) |
| 5 | F3-3 OKR divisi: `objectives`, `key_results`, `key_result_checkins`, `key_result_tasks` | `app/Domain/Okr`, `routes/okr.php`, `resources/js/features/okr`, `resources/js/pages/okr` | Claude Code | `claude/f3-okr` | selesai (PR #5) |
| 6 | Dashboard per jabatan `/peran/{role}` (melengkapi dashboard per peran; `positions.dashboard_role`) | `app/Domain/RoleDashboards`, `routes/roles.php`, `resources/js/features/role-dashboards`, `resources/js/pages/roles` | Claude Code | `claude/f3-peran` | selesai (PR #5) |
| 6a | Panduan pratinjau (`docs/fitur/PANDUAN-PRATINJAU.md` + `/pratinjau/panduan`) | `docs/fitur`, `app/Domain/Documentation`, `resources/js/pages/prototype`, `resources/js/features/docs` | Claude Code | `docs/panduan-pratinjau` | selesai (PR #5) |
| 6b | Bug ringan dari `docs/sprints/fase-2-3-prototipe/BUG-REPORT.md` | sesuai temuan | Claude Code | `claude/bug-ringan` | selesai (PR #5) |
| 8 | Pembatalan pengajuan yang sudah disetujui oleh HR (UI + Action; `AttendanceEffects::revert()`, saldo kembali) | `app/Domain/Requests`, `resources/js/features/requests`, `resources/js/features/approvals` | Claude Code | `claude/batal-pengajuan` | selesai (PR #8) |
| 9 | Ekspor PNG struktur organisasi | `resources/js/features/organization`, `resources/js/pages/organization` | Claude Code | `claude/ekspor-struktur` | selesai (PR #8) |
| 10 | Tanda baca (*read receipt*) komentar tugas | `app/Domain/Tasks` (komentar), `resources/js/features/tasks/detail` | Claude Code | `claude/tanda-baca` | selesai (PR #8) |
| 11 | Kehadiran (*presence*) per kartu board | `routes/channels.php` (kanal baru), `resources/js/features/tasks` (board) | Claude Code | `claude/presence-board` | selesai (PR #8) |
| 12 | WAL archiving Postgres + pemulihan ke titik waktu (PITR) | `compose.*.yml`, `docker/`, `scripts/`, `docs/deploy` | Claude Code | `claude/wal-archiving` | selesai (PR #8) |
| 13 | Ruang rapat arah C "Notulen Hidup" (UI) | `resources/js/features/meetings/video`, `resources/js/pages/meetings/{join,room}.tsx` | Claude Code | `claude/rapat-ui` → `claude/integrasi-rapat` | review (belum di-PR) |
| 14 | Backend rapat (notulen bersama, waktu bicara, Panggil, kehadiran, larangan masuk) | `app/Domain/Meetings` | Claude Code | `claude/rapat-backend` → `claude/integrasi-rapat` | review (belum di-PR) |
| 15 | Notulen otomatis tahap 1 (worker transkripsi + ringkasan LLM) | `transcriber/`, `app/Domain/Meetings/Transcripts` | Claude Code | `claude/notulen-otomatis` → `claude/integrasi-rapat` | review (belum di-PR); worker belum dipasang |
| 16 | Audit keamanan rapat (4 putaran) | `docs/security/AUDIT-RAPAT-2026-10.md` | Claude Code | `claude/audit-*` → `claude/integrasi-rapat` | review (belum di-PR) |
| 17 | Lanjutan setelah serah terima: merge, deploy, worker notulen, reset sandi | lihat `docs/SERAH-TERIMA-GLM.md` §6 | ZCode (GLM) | — | bebas |
| 7 | Tinjau PR agen lain (`$tinjau` / `/tinjau`) | — (hanya laporan) | agen yang menganggur | — | berulang |

**Ditahan oleh pemilik (6 Okt 2026), jangan dikerjakan:** login Google, Google Drive & Docs, notifikasi WhatsApp + provider, aplikasi ponsel (biometrik, integritas, offline, widget, check-in wajah, perangkat), mesin fingerprint, dan fitur yang belum ada sama sekali (lihat `docs/fitur/PANDUAN-PRATINJAU.md`).

Tugas Fase 2/3 backend wajib mengikuti `docs/PRD.md` §6–7 dan `docs/DATABASE.md` §7–8; bila sebuah keputusan produk belum ada (mis. provider WhatsApp, Hocuspocus), tulis pertanyaannya di catatan sesi dan tanyakan pengguna.
