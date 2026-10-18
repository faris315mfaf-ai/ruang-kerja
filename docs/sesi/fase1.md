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

## Langkah 2c — integrasi per perusahaan (selesai)
- `e0b47b76` `App\Domain\Tenancy\Settings\CompanySettings` (`#[Scoped]`, memo per request, di-flush oleh event `Company` & `ConfigureCompany`): `whatsapp.group_jid`/`whatsapp.enabled`, `google.shared_drive_id`/`shared_drive_name` di `companies.settings`; config global (env) hanya cadangan selama perusahaan itu **satu-satunya**. `ConfigureCompany` (row lock, audit `company.configured`), `php artisan company:configure {company} --whatsapp-group= --whatsapp=on|off --shared-drive= --shared-drive-name= --timezone=` (timezone hanya menulis kolom) dan `company:list`; `CompanyLookup` (ULID/domain/nama). Migrasi data `2026_10_23_235100_copy_integration_settings_to_first_company` (env lewat `config()` → perusahaan tertua/SPKD).
- `64354d63` C9 tertutup: `EvolutionWhatsApp::attendanceGroupFor($companyId)` dipakai `CheckIn`/`CheckOut`/`SendAttendanceWhatsApp`; perusahaan tanpa grup tidak dikirimi (log info). Gateway Evolution tetap global (per perusahaan = Fase 3).
- `a5ddce37` Shared Drive per perusahaan: `GoogleFeatures::enabled/ensureEnabled/missingDriveSettings(?companyId)` (null = `CompanyContext`, tanpa konteks = config global seperti dulu), `GoogleClientFactory::sharedDriveId(?companyId)` + `serviceAccount($timeout, $companyId)`, `DriveFolderService`/`DriveFolderContentsSync`/unggah/listener/kueri workspace memakai perusahaan workspace. Perusahaan tanpa Shared Drive → Drive nonaktif (pesan & `DriveUnavailable` yang ada; Super Admin melihat "Shared Drive perusahaan (php artisan company:configure --shared-drive=…)"), tanpa folder di Drive perusahaan lain. `FakeDriveClient::addSharedDrive()`, `ruangkerja:google-check --company=`.
- `0a44895b` Email: `CompanyBranding::name()` (perusahaan penerima → konteks → `BRANDING_COMPANY_NAME`) di `mail/layout.blade.php`; `DesktopLinkMail` membawa nama perusahaan penerima. `RecapPdf` sudah memakai perusahaan aktor; `errors/minimal` & `app.blade.php` hanya nama platform (tidak diubah). `CompanyIntegrationsTest` (18 tes).
- Catatan: `google.oauth.allowed_domain` (GOOGLE_ALLOWED_DOMAIN) tetap global — `StoreGoogleAccount` juga mewajibkan akun Google = email karyawan sendiri, jadi tidak lintas perusahaan; bila diisi, karyawan perusahaan lain tidak bisa menyambungkan akun (batasan, bukan kebocoran; per perusahaan = Fase 3). `GOOGLE_IMPERSONATE_USER` & service account global: Shared Drive perusahaan lain harus dikelola akun impersonasi itu. Halaman publik `/kebijakan-privasi` untuk tamu masih `BRANDING_COMPANY_NAME` (Fase 3).
- Deploy produksi: `docs/deploy/VPS-BERSAMA.md` §4a, `docs/deploy/WHATSAPP.md` §2a.
- Gerbang 2c (18 Okt 2026, bersama perubahan 2a/2b di worktree): `pest --parallel` penuh hijau 4151 tes tanpa skip; Pint bersih; PHPStan 1 galat di luar 2c (`app/Http/Requests/Admin/AuditLogIndexRequest.php:93`, milik 2a); tanpa perubahan TS.

## Langkah 2b — zona waktu & penjadwal per perusahaan (selesai)
- `620fea4a` Zona kantor dari perusahaan konteks: `CurrentCompany::timezone()` (= `CompanyContext::timezone()`, cadangan `app.office_timezone`) dipakai semua helper waktu dan ±60 pembaca langsung (controller, FormRequest, query, SQL mentah `PersonalPerformance`/`OnTimeRate` sebagai binding). `OfficeTimezone`: `companies.timezone` wajib zona IANA saat disimpan (`Company::saving` di `TenancyServiceProvider`), nilai tidak sah di DB → zona aplikasi. `CompanyTimezoneTest`.
- `0c48eab6` Penjadwal per perusahaan: `CompanySchedule` + `LocalTask` (tugas berjam lokal, event tiap 5 menit, klaim `scheduled_runs (task, company_id, local_date)` dengan `INSERT … ON CONFLICT DO NOTHING`, jalan di `CompanyContext::run`, gagal = klaim dilepas), `ForEachCompany::run()/sum()` di semua job & perintah terjadwal (dalam konteks = satu perusahaan; tanpa konteks = tiap perusahaan dalam konteks & zonanya), query dibatasi `CurrentCompany::id()`, `companyUniqueId()` untuk job unik. Tes jadwal lama disesuaikan (ekspresi `*/5` + jam lokal tugas). `CompanyScheduleTest`: WIB/WITA/WIT — tutup hari, pengingat check-in, ringkasan harian, tenggat 07.00, laporan 16.30 terjadi pada jam lokal masing-masing, sekali, A tidak terpengaruh; kegagalan satu perusahaan; kunci unik per perusahaan.
- `5fbce2f8` Web: shared prop `officeTimezone` (baris di `HandleInertiaRequests` ikut ter-commit di `3e46c2b1` milik 2a), `lib/format.ts` `officeTimezone()/setOfficeTimezone()/officeDateFormat()/officeUtcOffset()` (formatter dibuat saat dipakai), dipasang di `app.tsx` (`withApp` + `router.on('navigate')`); 17 berkas TS. API `GET auth/saya` → `office_timezone`.
- `450448a8` Aplikasi: `src/lib/zonaKantor.ts` (`zonaKantor()/aturZonaKantor()/formatKantor()`), dipasang `SessionProvider` dari profil; 15 berkas format.
- `abf9fa87` jam salinan absensi WhatsApp, `eb1801dc` PHPStan.
- Gerbang: `pest --parallel` penuh hijau (4151 tes), Pint, PHPStan, `npm run typecheck`, `npm run lint`, `npm test` (939), aplikasi `tsc`/`eslint` (node_modules dipinjam lewat symlink sementara dari worktree bagian5; tsconfig tidak berubah).
- Batas: tugas berjam lokal dikejar maks. 2 jam (tutup hari & delegasi 12 jam, saldo 1 Jan sehari) — deploy siang hari tidak mengirim ulang pengingat pagi (pengingat juga ber-de-dup sendiri). Saat deploy pertama, tugas yang targetnya < 2 jam lalu bisa berjalan lagi hari itu: semuanya idempoten (de-dup `notification_dispatch_logs`, klaim kemunculan berulang, upsert snapshot). Retensi & pembersihan infrastruktur tetap global. Flag fitur tetap global (Fase 3).

## Keputusan desain
- **Tanpa global scope otomatis.** Konteks hanya informasi; isolasi tetap oleh `visibleTo()` + Policy (keputusan rencana). Konteks kosong (tamu, scheduler) = perilaku lama.
- **Penangkapan perusahaan job:** `Queue::createPayloadUsing()` (TenancyServiceProvider) memanggil `captureCompany()` tepat sebelum job diserialisasi: konteks saat ini → properti model pertama ber-`company_id` → (notifikasi) penerimanya. Tidak perlu mengubah konstruktor job. Pemulihan lewat `middleware()` trait; kelas yang punya middleware sendiri menggabung `companyMiddleware()` (`SyncDrivePermissions`). Notifikasi: middleware ikut per kanal, termasuk pengiriman tertunda jam tenang. Mailable antre (`DesktopLinkMail`) belum ikut — tidak membaca konteks.
- **Prioritas middleware:** `appendToPriorityList(after: EnsureActiveEmployee, append: ResolveCompanyContext)` agar berjalan setelah `auth`/`auth:sanctum`; rute server-ke-server yang membuang `EnsureActiveEmployee` juga membuang `ResolveCompanyContext`.
- **Registri:** jenis `morph` ditambahkan (komentar, reaksi, mention, lampiran, notifikasi, token Sanctum, peran spatie) karena tidak cocok dengan `via`/`user`.
- **Daftar celah di tes:** `knownRouteGaps()` / `knownListingGaps()` (entri yang sudah tertutup membuat tes gagal, jadi daftar ikut menyusut) dan skip bersyarat di `BackgroundLeakTest` (otomatis hijau saat celah ditutup).

## Langkah berikutnya
1. Langkah 2a (data & otorisasi): C1 audit_logs.company_id, C5 hari libur per perusahaan, + butir rencana #2–#8, #10, #11; hapus entri `knownListingGaps()` dan skip C5.
2. ~~Langkah 2b (zona waktu & scheduler per perusahaan)~~ selesai (lihat seksi Langkah 2b).
3. ~~Langkah 2c (integrasi)~~ selesai (lihat seksi Langkah 2c).
4. Langkah 3: `PerformanceFixtures::grow()` dua perusahaan, ADR & dokumen.

## Verifikasi
`TENANCY_DEBUG=1 vendor/bin/pest tests/Feature/Tenancy` (ringkasan jumlah) · composer test · composer lint
