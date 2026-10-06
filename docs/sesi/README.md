# Catatan sesi per agen

Satu berkas per agen: `docs/sesi/<agen>.md` (`claude.md`, `codex.md`, `codex2.md`, …). Hanya agen pemiliknya yang menulis berkasnya, jadi dua agen yang bekerja bersamaan tidak saling bentrok. Aturan: `AGENTS.md` › Serah terima antar agen dan › Kerja paralel.

Diperbarui setiap selesai satu langkah logis dan sebelum berhenti (mis. kuota habis). Agen yang melanjutkan pekerjaan agen lain membaca berkas agen itu, lalu `git log --oneline -15` dan `git status` di worktree-nya.

## Templat

```markdown
# Sesi <agen>

**Terakhir diperbarui:** <tanggal jam> · <Claude Code | Codex>

## Tugas berjalan
<satu kalimat; nomor tugas di docs/PEMBAGIAN-TUGAS.md>

## Worktree / branch
<folder> · <branch> · https://ruangkerja-<agen>.test

## Sudah selesai
- `<hash>` <ringkasan commit>

## Langkah berikutnya
1. …

## Keputusan pengguna yang berlaku
- …

## Butuh dari integrator / agen lain
- <perubahan pada berkas bersama yang diperlukan, mis. tile Dock, CHANGELOG>

## Verifikasi
composer test · composer lint · npm run typecheck · npm run lint · npm test
```
