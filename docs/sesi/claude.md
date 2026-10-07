# Sesi claude

**Terakhir diperbarui:** 7 Okt 2026 · Claude Code (integrator)

## Tugas berjalan
Integrator di checkout utama. Lima agen backlog bekerja paralel (tugas #8–#12 di `docs/PEMBAGIAN-TUGAS.md`).

## Worktree / branch
| Agen | Worktree | Branch | Situs |
|---|---|---|---|
| batal | `../ruang-kerja-batal` | `claude/batal-pengajuan` | https://ruangkerja-batal.test |
| orgpng | `../ruang-kerja-orgpng` | `claude/ekspor-struktur` | https://ruangkerja-orgpng.test |
| dibaca | `../ruang-kerja-dibaca` | `claude/tanda-baca` | https://ruangkerja-dibaca.test |
| hadir | `../ruang-kerja-hadir` | `claude/presence-board` | https://ruangkerja-hadir.test |
| wal | `../ruang-kerja-wal` | `claude/wal-archiving` | https://ruangkerja-wal.test |

## Sudah selesai (7 Okt 2026)
- PR #5 integrasi Fase 2/3 di-merge (`f34fd62`); PR #3 dan #4 ikut tercatat merged.
- `5cc5b71` ci: Pest dibagi 3 shard berimbang waktu (`tests/.pest/shards.json`); sebelumnya job Pest kena batas 20 menit.
- PR #6 `fix(seeder)`: `db:seed` ulang tidak lagi bentrok di `employee_profiles_employee_number_unique`.
- PR #7 deploy dua VPS + object storage + image collab + alias domain.
- Worktree agen lama (13) dan branch yang sudah di-merge dibersihkan.

## Langkah berikutnya
1. Tinjau hasil tugas #8–#12, buka PR per branch, merge setelah CI hijau.
2. Deploy: menunggu pemilik (alamat dua VPS, domain, email Let's Encrypt, kredensial NEO Object Storage, secret GitHub Actions).

## Keputusan pengguna yang berlaku
- Fase 2 & 3: modul nyata di balik flag `FEATURE_*` (mati di produksi).
- Ditahan: login Google, Drive/Docs/Calendar/Meet, WhatsApp, aplikasi ponsel, mesin fingerprint.
- Penyimpanan file produksi: Biznet Gio NEO Object Storage.
- Push ke GitHub hanya setelah pengguna setuju.

## Verifikasi
`COMPOSER_PROCESS_TIMEOUT=0 composer test` · `composer lint` · `npm run typecheck` · `npm run lint` · `npm test` · `node scripts/sync-agent-skills.mjs --check` · `node scripts/ui-shots.mjs /dashboard`

## Jangan disentuh tanpa izin
`.env`, `secrets/`, server VPS, pengaturan repo GitHub.
