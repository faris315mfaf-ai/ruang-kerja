# Sesi glm

**Terakhir diperbarui:** 8 Okt 2026 (sesi 2, sore) · ZCode (GLM)

## Tugas berjalan
Butir §6.F selesai (U-06, R-14, R-06) + perbaikan temuan bug-hunt; sedang berjalan: §6.A (push/PR/merge), §6.B (deploy), §6.E (bersih-bersih) atas instruksi pemilik "kerjakan butir 6 sampai 7 semuanya".

## Worktree / branch
`/Users/godam/PROYEK/rk-integrasi-rapat` · `claude/integrasi-rapat`

## Sudah selesai (sesi 2)
- `49bf129` feat(akun): R-06 — sandi akun Direksi/HR hanya diatur Super Admin; sandi bawaan & reset massal mengecualikan direksi/hr (`Role::superAdminSetsPassword()`); matriks test diperbarui.
- `959ea0c` feat(rapat): R-14 — mikrofon & display-capture hanya di dokumen `/gabung`+`/ruang`; middleware baru `EnsureFullPageLoad` (409 + X-Inertia-Location untuk navigasi Inertia, partial lolos); throttle:api untuk final/buka/hapus tindak lanjut/batalkan.
- `945ecf4` fix(rapat): perbaikan bug-hunt — timer sambung ulang video dibersihkan (kamera hantu), race di use-minutes-collab (timer/404/double destroy), webhook kehadiran insertOrIgnore, validasi `attendance.*.user_id` se-perusahaan + filter `loadPeople`.
- (sesi 1) `b7401d1` U-06 dynamic import, `927e72e` docs.

## Temuan bug-hunt yang DITUNDA (3 agen, laporan lengkap di percakapan; masukkan ke backlog)
- **video**: retry/backoff saat fetch token kolaborasi gagal transien (mode off permanen); flush edit notulen tertunda saat keluar ruang (postKeepalive); guard konkurensi connect(); prejoin tidak bereaksi pembatalan rapat; polling kehadiran penyelenggara berhenti setelah closes_at; a11y Suspense fallback.
- **backend**: race `attendance_only` (merge di luar transaksi SaveMinutes); "Jadikan tugas" menghilangkan PIC non-anggota tanpa umpan balik; `MeetingOccurrences::resolve` seri berakhir >14 hari jatuh ke kemunculan pertama; enumerasi ruang serangkaian saat cancel.
- **keamanan**: persetujuan "Lupa kata sandi" akun direksi/hr masih oleh HR (pemohon yang mengetik sandi — keputusan produk; usul: diputus Super Admin atau konfirmasi pemilik akun).

## Langkah berikutnya
1. Agen 9: verifikasi penuh (composer test/lint, typecheck, vp, vitest, build) — berjalan.
2. Agen 10: ui-shots halaman rapat.
3. §6.A: push + PR (isi `/tmp/rk-pr-body.md`) + CI + merge; perbarui checkout main.
4. §6.B: deploy spkd.store (migrasi 830100/840100, supervisor-long).
5. §6.C/D: langkah pemilik (EMPLOYEE_DEFAULT_PASSWORD, DNS notulen, TRANSCRIBER_*, MINUTES_LLM_API_KEY) — tidak bisa dikerjakan agen.
6. §6.E: bersih-bersih worktree rapatui/rapatbe/notulen/dok/audit/sandi + integrasi-rapat setelah merge; jangan sentuh `ruang-kerja-codex` (milik Codex).
7. §6.G (GPU) & §6.H (Android) menunggu pemilik; §7 memo keputusan disertakan di laporan akhir.

## Keputusan pengguna yang berlaku
- 8 Okt 2026: "kerjakan butir 6 sampai 7 semuanya" + "lanjutkan seluruhnya dengan 10 agent" — mengizinkan push/PR/merge/deploy §6.A–B dan menetapkan R-06 (hanya Super Admin).
- Tanpa izin spesifik: tidak menyentuh server selain prosedur §5.1/§6.B, tidak menjalankan migrasi ulang DB produksi di luar deploy.

## Butuh dari pemilik / agen lain
- Rahasia & DNS (§6.C/D) diisi pemilik sendiri.
- CHANGELOG diperbarui integrator saat merge (butir bersama).

## Verifikasi terakhir
Sesi 2 terarget: Pest Auth+Policies+Admin+Platform+Meetings 358 test lulus; typecheck/lint/vitest video 46 lulus. Verifikasi penuh (agen 9) berjalan saat catatan ini ditulis.
