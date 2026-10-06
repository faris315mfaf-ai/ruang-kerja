# Sesi aktif — serah terima antar agen

> Diperbarui oleh agen yang sedang bekerja (Claude Code / Codex) setiap selesai satu langkah dan sebelum berhenti. Agen berikutnya membaca ini dulu, lalu `git log --oneline -15` dan `git status`. Aturan: `AGENTS.md` › Serah terima antar agen.

**Terakhir diperbarui:** 6 Okt 2026 · Claude Code

## Tugas berjalan
Menyiapkan repo agar bisa dikerjakan bergantian oleh Claude Code dan Codex.

## Branch / worktree
- Branch `claude/project-overview-status-ebff38` (worktree `.claude/worktrees/project-overview-status-ebff38`), disajikan Herd di `https://ruangkerja-proto.test`.
- `main` (checkout utama `/Users/godam/PROYEK/ruang-kerja`, `https://ruangkerja.test`) = `bf711aa`, sudah di-push. Branch ini beberapa commit di depan `main` dan **belum di-merge / di-push**.

## Sudah selesai (branch ini, di atas `main`)
- `60a3559` fix(ci): Vitest (detectTls Herd) dan SessionCookieTest hijau di GitHub Actions. CI `main` (`bf711aa`) masih merah sampai commit ini masuk.
- `0448bb3` feat(demo): pemilih akun demo di atas (5 persona).
- `533f25f` feat(demo): tugas contoh staf programmer + perbaikan status absensi (lazy loading) + breadcrumb.
- `7e3ab94` chore(agen): dukungan Codex (AGENTS.md sumber tunggal, `.agents/skills`, `.codex/config.toml`, `scripts/ui-shots.mjs`, `scripts/sync-agent-skills.mjs`, berkas ini).

## Langkah berikutnya
1. Merge branch ini ke `main` (fast-forward) lalu push, supaya CI hijau dan Codex di checkout utama melihat semua perubahan.
2. Deploy VPS bersama (`docs/deploy/VPS-BERSAMA.md`): menunggu dari pengguna — domain, email Let's Encrypt, izin menjalankan `scripts/server-bootstrap.sh` di `root@187.77.118.216`, object storage (ada/tidak). Isi secret & variabel GitHub Actions dilakukan pengguna sendiri.

## Keputusan pengguna yang berlaku
- Fase 2 & 3 dibangun sebagai **pratinjau frontend** dengan data contoh (`FEATURE_PROTOTYPE`, mati di produksi); backend menyusul.
- VPS dipakai bersama project lain: proxy edge bersama di `/opt/edge`, stack ini memakai `compose.shared.yml`.
- Deploy lewat GitHub Actions + GHCR; Postgres & Redis kontainer sendiri.

## Verifikasi
`composer test` · `composer lint` · `npm run typecheck` · `npm run lint` · `npm test` · `node scripts/sync-agent-skills.mjs --check` · `node scripts/ui-shots.mjs /dashboard`

## Jangan disentuh tanpa izin
`.env`, `secrets/`, `git push`, server VPS, pengaturan repo GitHub.
