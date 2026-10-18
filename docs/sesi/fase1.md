# Sesi fase1

**Terakhir diperbarui:** 18 Okt 2026 · Claude Code

## Tugas berjalan
Fase 1 multi-perusahaan (rencana disetujui pemilik: `~/.claude/plans/shimmying-scribbling-finch.md`), **Langkah 1 selesai**: fondasi konteks perusahaan dan jaring pengaman uji isolasi data. Langkah 2 (tutup celah, tiga agen paralel) belum dimulai.

## Worktree / branch
`/Users/godam/PROYEK/ruang-kerja-fase1` · `claude/fase1-isolasi` · https://ruangkerja-fase1.test · DB dev `ruangkerja_fase1`, DB test `ruangkerja_testing_fase1` (`.testing-db`)

## Sudah selesai (Langkah 1)
- `992f22e4` `App\Domain\Tenancy\CompanyContext` (scoped singleton: `id()`, `company()` dimuat sekali, `timezone()` dengan fallback `app.office_timezone`, `set()`, `run()` yang memulihkan konteks), middleware `ResolveCompanyContext` di grup web & api (dipin setelah `EnsureActiveEmployee`; pengguna atau guard `kiosk`), titik masuk publik mengisi konteks dari barisnya (tamu rapat, webhook hiring/LiveKit/notulen, server kolaborasi catatan & notulen), `HandleInertiaRequests` memakai konteks. Trait `CompanyAware` + job middleware `RestoreCompanyContext` di 33 job `ShouldQueue` dan `BaseNotification`.
- `e8f0c8c9` `config/tenancy.php`: 117 tabel diklasifikasikan (`company` / `via` / `user` / `morph` / `global`, dengan catatan CELAH) + `TenancyRegistryTest`.
- `3b7b7def` `tests/Support/tenancy-helpers.php`: `homeWorld()` (A, penanda `ZZA0H0M`) dan `foreignWorld()` (B lengkap lintas modul, penanda `ZZB0C0R`), `tenancyFingerprint()`; `CompanyFactory::foreign()` / `within()` (perusahaan asing tidak pernah jadi default).
- `aee434fa` `RouteBindingLeakTest` (451 pasangan metode + rute ber-parameter × 3 peran).
- `3f1755b3` `ListingLeakTest` (250 URL × 3 varian × 5 peran, prop tertunda, xlsx, PDF lewat data view).
- `e1c93595` `BackgroundLeakTest` (semua entri `routes/console.php`, WhatsApp absensi) + `BroadcastChannelLeakTest` (8 kanal).
- `41a3b306` urutan middleware `SyncDrivePermissions` (WithoutOverlapping tetap pertama).
- `00ea4168` dokumen ini + `docs/sesi/fase1-celah.md`.
- Gerbang: `composer test` penuh hijau (4073 tes, 2 skip bersyarat C5/C9), Pint & PHPStan bersih; tanpa perubahan TS.

## Keputusan desain
- **Tanpa global scope otomatis.** Konteks hanya informasi; isolasi tetap oleh `visibleTo()` + Policy (keputusan rencana). Konteks kosong (tamu, scheduler) = perilaku lama.
- **Penangkapan perusahaan job:** `Queue::createPayloadUsing()` (TenancyServiceProvider) memanggil `captureCompany()` tepat sebelum job diserialisasi: konteks saat ini → properti model pertama ber-`company_id` → (notifikasi) penerimanya. Tidak perlu mengubah konstruktor job. Pemulihan lewat `middleware()` trait; kelas yang punya middleware sendiri menggabung `companyMiddleware()` (`SyncDrivePermissions`). Notifikasi: middleware ikut per kanal, termasuk pengiriman tertunda jam tenang. Mailable antre (`DesktopLinkMail`) belum ikut — tidak membaca konteks.
- **Prioritas middleware:** `appendToPriorityList(after: EnsureActiveEmployee, append: ResolveCompanyContext)` agar berjalan setelah `auth`/`auth:sanctum`; rute server-ke-server yang membuang `EnsureActiveEmployee` juga membuang `ResolveCompanyContext`.
- **Registri:** jenis `morph` ditambahkan (komentar, reaksi, mention, lampiran, notifikasi, token Sanctum, peran spatie) karena tidak cocok dengan `via`/`user`.
- **Daftar celah di tes:** `knownRouteGaps()` / `knownListingGaps()` (entri yang sudah tertutup membuat tes gagal, jadi daftar ikut menyusut) dan skip bersyarat di `BackgroundLeakTest` (otomatis hijau saat celah ditutup).

## Langkah berikutnya
1. Langkah 2a (data & otorisasi): C1 audit_logs.company_id, C5 hari libur per perusahaan, + butir rencana #2–#8, #10, #11; hapus entri `knownListingGaps()` dan skip C5.
2. Langkah 2b (zona waktu & scheduler per perusahaan): pakai `CompanyContext::timezone()`; dispatcher per perusahaan.
3. Langkah 2c (integrasi): C9 `whatsapp.group_jid` per perusahaan, Shared Drive, nama perusahaan di email.
4. Langkah 3: `PerformanceFixtures::grow()` dua perusahaan, ADR & dokumen.

## Verifikasi
`TENANCY_DEBUG=1 vendor/bin/pest tests/Feature/Tenancy` (ringkasan jumlah) · composer test · composer lint
