# Sesi claude

**Terakhir diperbarui:** 8 Okt 2026 · Claude Code (integrator) — **diserahkan ke ZCode (GLM)**

## Tugas berjalan
Tidak ada. Pekerjaan dilanjutkan di ZCode/GLM; seluruh status, prosedur, dan daftar tugas ada di `docs/SERAH-TERIMA-GLM.md`.

## Worktree / branch
- `claude/integrasi-rapat` (`/Users/godam/PROYEK/rk-integrasi-rapat`): gabungan ruang rapat arah C, backend rapat, notulen otomatis tahap 1, empat putaran audit, dan dokumentasi. Semua cek hijau; **belum di-push**.
- Worktree agen (`ruang-kerja-{rapatui,rapatbe,notulen,dok,audit,sandi}`) sudah termuat di branch integrasi; dibersihkan setelah merge (`docs/SERAH-TERIMA-GLM.md` §6.E).

## Sudah selesai (7–8 Okt 2026)
- PR #8 backlog #8–#12, PR #9 landing spkd.store, PR #10 Video RuangKerja (LiveKit), PR #11 sandi bawaan — semuanya di `main`.
- Deploy manual `main` ke spkd.store (`b6908757f39b`); server rapat LiveKit `103.125.181.244` terpasang dan teruji (webhook aktif).
- Branch integrasi rapat: Pest 3.201 · Vitest 778 · lint/typecheck/build bersih · collab 23 · worker pytest 34.

## Langkah berikutnya
Lihat `docs/SERAH-TERIMA-GLM.md` §6 (A: PR & merge → B: deploy → C: reset sandi bawaan → D: worker notulen → E: bersih-bersih).

## Keputusan pengguna yang berlaku
- Fase 2 & 3: modul nyata di balik flag `FEATURE_*` (mati di produksi kecuali diputuskan).
- Ditahan: login Google, Drive/Docs/Calendar/Meet, WhatsApp, aplikasi ponsel, mesin fingerprint.
- Ruang rapat memakai desain arah C "Notulen Hidup"; video sendiri dengan LiveKit (bukan Google Meet).
- Notulen otomatis tahap 1 tanpa GPU; ringkasan lewat API kompatibel OpenAI, awalnya DeepSeek (dapat diganti lewat `.env`).
- Sandi bawaan karyawan dari `EMPLOYEE_DEFAULT_PASSWORD` (diisi pemilik), wajib ganti saat login pertama.
- Penyimpanan file produksi: Biznet Gio NEO Object Storage.
- Push ke GitHub dan deploy hanya setelah pengguna setuju.

## Verifikasi
`COMPOSER_PROCESS_TIMEOUT=0 composer test` · `composer lint` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` · `node scripts/sync-agent-skills.mjs --check`

## Jangan disentuh tanpa izin
`.env`, `secrets/`, server VPS, pengaturan repo GitHub.
