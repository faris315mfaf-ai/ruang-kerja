# Sesi claude

**Terakhir diperbarui:** 6 Okt 2026 · Claude Code

## Tugas berjalan
Menyiapkan kerja paralel Claude Code + Codex (`scripts/agen-mulai.sh`, database test per worktree, `docs/PEMBAGIAN-TUGAS.md`, `docs/sesi/`). Branch `claude/kerja-paralel` di atas PR #1.

## Branch / worktree
- Branch `claude/project-overview-status-ebff38` (worktree `.claude/worktrees/project-overview-status-ebff38`), disajikan Herd di `https://ruangkerja-proto.test`.
- `main` (checkout utama `/Users/godam/PROYEK/ruang-kerja`, `https://ruangkerja.test`) = `bf711aa`, sudah di-push. Branch ini beberapa commit di depan `main` dan **belum di-merge / di-push**.

## Sudah selesai
- `78e649f` chore(agen): kerja paralel (branch `claude/kerja-paralel`). Diuji: worktree `../ruang-kerja-codex` (branch `codex/kerja`, https://ruangkerja-codex.test) dan worktree ini sebagai agen `claude` (https://ruangkerja-claude.test); dua `composer test` bersamaan → 2.104 + 2.104 lulus dengan database test terpisah.

## Sudah selesai (PR #1, `claude/project-overview-status-ebff38`)
- `60a3559` fix(ci): Vitest (detectTls Herd) dan SessionCookieTest hijau di GitHub Actions. CI `main` (`bf711aa`) masih merah sampai commit ini masuk.
- `0448bb3` feat(demo): pemilih akun demo di atas (5 persona).
- `533f25f` feat(demo): tugas contoh staf programmer + perbaikan status absensi (lazy loading) + breadcrumb.
- `7e3ab94` chore(agen): dukungan Codex (AGENTS.md sumber tunggal, `.agents/skills`, `.codex/config.toml`, `scripts/ui-shots.mjs`, `scripts/sync-agent-skills.mjs`, berkas ini).

## Langkah berikutnya
1. PR #1 menunggu CI lalu di-merge ke `main`; setelah itu buka PR `claude/kerja-paralel` → `main`. Worktree `codex/kerja` dibuat dari `claude/kerja-paralel`: setelah merge cukup `git rebase main`.
2. Klaim tugas di `docs/PEMBAGIAN-TUGAS.md` (usulan: Claude #1 Obrolan, Codex #2 Rapat & Kalender).
3. Deploy VPS bersama (`docs/deploy/VPS-BERSAMA.md`): menunggu dari pengguna — domain, email Let's Encrypt, izin menjalankan `scripts/server-bootstrap.sh` di `root@187.77.118.216`, object storage (ada/tidak). Isi secret & variabel GitHub Actions dilakukan pengguna sendiri.

## Keputusan pengguna yang berlaku
- Fase 2 & 3 dibangun sebagai **pratinjau frontend** dengan data contoh (`FEATURE_PROTOTYPE`, mati di produksi); backend menyusul.
- VPS dipakai bersama project lain: proxy edge bersama di `/opt/edge`, stack ini memakai `compose.shared.yml`.
- Deploy lewat GitHub Actions + GHCR; Postgres & Redis kontainer sendiri.

## Verifikasi
`composer test` · `composer lint` · `npm run typecheck` · `npm run lint` · `npm test` · `node scripts/sync-agent-skills.mjs --check` · `node scripts/ui-shots.mjs /dashboard`

## Jangan disentuh tanpa izin
`.env`, `secrets/`, `git push`, server VPS, pengaturan repo GitHub.
