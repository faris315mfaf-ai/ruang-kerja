# Sesi glm

**Terakhir diperbarui:** 9 Okt 2026 (sesi 8) · ZCode (GLM)

## Tugas berjalan
**Frontend kartu Briefing** (keputusan pemilik 9 Okt 2026, ditugaskan koordinator; backend sudah ada dari sesi 6) — **selesai, belum di-commit**.

1. Komponen mandiri `resources/js/features/briefings/`: `briefing-card.tsx` (kartu "Catat briefing" hanya bila `can_record` + jendela terbuka; judul "Briefing pagi/sore · {date_label}"; textarea ber-label dengan **autosave draf lokal** per user+tanggal+periode (`rk.briefing-draft.v1.*`, debounce 500 ms, aman private-mode); tombol **"Simpan & kirim ke semua"** → POST `/briefing`; setelah tersimpan → badge "Terkirim", teks "tanpa notifikasi ulang", tombol jadi "Simpan perubahan" (server idempoten); tombol **"Delegasikan"**; baris "Didelegasikan ke {nama}" / "Anda ditunjuk oleh {nama}" untuk delegasi). `delegate-dialog.tsx` (Dialog desktop / BottomSheet ponsel; pilih periode yang belum selesai & belum tersimpan + **cari orang lewat `GET /cari/hasil?group=people`** (`useSearch` reuse, diri sendiri dikecualikan); POST `/briefing/delegasi`; delegasi ulang mengganti target). `latest-briefing-card.tsx` (kartu kecil "Briefing terakhir" cuplikan 3 baris + dialog baca isi penuh). Pendukung: `briefing-state.ts`, `draft.ts`, `use-briefing-draft.ts`, `api.ts` (submit Inertia pola role-dashboards — toast sukses dari flash server, galat validasi jendela/server → toast).
2. Pemasangan: dashboard **Saya** (desktop+mobile — kartu pencatat sebelum `TugasHariIniCard`, kartu terakhir tepat sesudahnya) dan **HR** (desktop+mobile, setelah ViewPicker — view landing HR). Dashboard divisi/direksi TIDAK dipasang (pencatat realistis = HR/Super Admin/delegasi karyawan; sudut kasus kadiv/direksi yang didelegasikan mendarat di view mereka — dicatat sebagai keterbatasan). Tipe `briefing?: BriefingCardData | null` ditambah ke `DashboardSharedProps` (`resources/js/types/dashboard.ts`). Catatan: kartu "Briefing terakhir" hanya tampil bagi pemegang props `briefing` (pencatat/delegasi) karena backend mengirim null untuk karyawan biasa — karyawan biasa menerima briefing via Inbox (keputusan backend sesi 6).
3. Verifikasi sesi 8: `npx tsc --noEmit` bersih; `npx vp check --fix` bersih; `npx vp test run` penuh **120 berkas / 828 test hijau** (termasuk `briefing-state.test.ts` + `draft.test.ts` baru, 24 test). Pest tidak dijalankan (larangan koordinator).

## Tugas berjalan (sebelumnya)
**Frontend dashboard "Tugas hari ini" + tombol tengah tab bar Workspace** (keputusan pemilik 9 Okt 2026, ditugaskan koordinator) — **selesai, belum di-commit**.

1. Wiring: `DashboardController::personal()` kini memuat props `tugasHariIni` (`App\Domain\Tasks\Queries\TugasHariIni`); props `planner` (Ruang saya) dan `dailyReport` (kartu Laporan hari ini) dicabut dari halaman itu. Anggaran `PageQueryCountTest` tidak berubah (net 0: +6 TugasHariIni −5 planner −1 laporan); komentar diperbarui — **jalankan `QUERY_COUNTS=1` untuk kalibrasi**.
2. Dashboard Saya (desktop `personal.desktop.tsx` + mobile `personal.mobile.tsx`): kartu **"Tugas hari ini"** segmen **Pribadi · Tim · Semua** (SegmentedTabs + badge jumlah, default Pribadi, EmptyState per segmen, baris = kunci·workspace·chip status·prioritas·penanda "dari absen"/"penugasan atasan", ketuk → url tugas, tautan "Kelola tugas" → /tugas) menggantikan: kartu Ruang saya (folder `features/dashboard/ruang-saya/` **dihapus**; rute JSON `/ruang-saya` & PlannerController tetap), kartu Laporan hari ini, KPI saldo cuti/tugas terbuka/tepat waktu, kartu Pengajuan. Ubin KPI mobile kini Disiplin hadir + Selesai (semua peran; saldo cuti hilang). KPI desktop tersisa: Selesai/Kedisiplinan/Rata-rata terlambat (grid xl 3 kolom).
3. Tombol tengah tab bar (`components/mobile/tab-bar.tsx` + `lib/navigation.ts`): setelah absen masuk / done / unavailable → tombol **WORKSPACE** (LayoutGrid, gaya bulat gradien sama) membuka **BottomSheet** `components/mobile/workspace-sheet.tsx` (grup **Pribadi · Tim · Proyek** dari props `workspaces` shell; ketuk → `/w/{key}`; baris "Semua workspace" → /workspace). Logika: `check_in` → Absen; `check_out` dengan `end` ≤1 jam lagi → Absen; `check_out` + `end` null → Absen; selain itu → Workspace; status tak dikenal → Absen. `tabNavItems`/`activeTabIndex` kini terima `CenterAction | null`; item tengah Workspace memiliki `matchPrefixes: ['/workspace','/w']`.
4. Docs: `docs/PLATFORM.md` §2.1/§3/§5 dan `docs/PRD.md` (baris dashboard Saya + kartu laporan) diperbarui.

Verifikasi: `npx tsc --noEmit` bersih; `npx vp check` bersih (934 berkas); `npx vp test` penuh **118 berkas / 804 test hijau** (termasuk `tab-bar.test`, `navigation.test`, `tugas-hari-ini.test` baru). Pest TIDAK dijalankan (DB test dipakai proses lain).

## Tugas berjalan (sebelumnya)
**Backend modul Briefing pagi & sore** (keputusan pemilik 9 Okt 2026) — **selesai, belum di-commit** (menunggu perintah; DB test dipakai proses lain jadi Pest **belum dijalankan**, verifikasi: php -l + Pint + Larastan level 8 per berkas, semua hijau).

- Notulensi harian dua periode: **pagi 08.00–11.00**, **sore 16.00–18.00** (zona `app.office_timezone`, enum `BriefingPeriod`). Pencatat **HR & Super Admin**; bisa **mendelegasikan** per tanggal+periode ke karyawan mana pun (`briefing_delegations`, unik per perusahaan+tanggal+periode, delegasi ulang mengganti target). Tanggal selalu diturunkan server (klien kirim `period` + `content` saja).
- Simpan = **upsert** (unik `company_id, briefing_date, period`, `lockForUpdate`) + **notifikasi `briefing.posted`** (kategori baru **Informatif**, tanpa tindakan; judul "Briefing pagi 9 Oktober 2026", body = **isi lengkap**) ke **semua pengguna aktif perusahaan termasuk pencatat** via job `SendBriefingNotifications` (chunk 200). Notifikasi hanya pada penyimpanan **pertama** (idempoten: simpan ulang = revisi tanpa spam). Audit `briefing.saved` / `briefing.delegated`. Notifikasi ke terdelegasi memakai `SystemAnnouncement` (in-app terkunci).
- Rute `routes/briefings.php` (auth+verified, throttle 20,1): `POST /briefing`, `POST /briefing/delegasi`. Kartu "Catat briefing" = props Inertia `briefing` di **semua view dashboard** (`DashboardController::render` → `BriefingWindow::card`, null untuk karyawan biasa tanpa delegasi) — **frontend kartu belum dibuat (agen lain)**; bentuk data: `date`, `date_label`, `current`, `can_record`, `is_recorder`, `periods[{value,label,starts_at,ends_at,status}]`, `delegations{pagi|sore:{to,by}}`, `saved`, `latest`, `urls{store,delegate}`.
- `NotificationEvent`/`NotificationType` baru `briefing.posted` **ditambahkan di akhir** (indeks matriks pengaturan stabil); `NotificationEvent::matrix()` kini dibungkus `array_values` (DailyDigest bukan case terakhir lagi → celah kunci). Config default: `in_app` true, `email` false, `whatsapp` false. **IndonesianDate** dapat metode `dayMonthYear()` ("9 Oktober 2026").
- Test ditulis **belum dijalankan**: `tests/Feature/Briefings/BriefingTest.php` (jendela aktif/nonaktif, matriks policy, simpan+notifikasi isi lengkap, delegasi, idempoten upsert, satu notulensi per periode, validasi). Query budget dashboard di `PageQueryCountTest` dinaikkan (+1 karyawan non-pencatat; +4 HR) **estimasi — jalankan `QUERY_COUNTS=1` untuk kalibrasi**.
- **Draf DATABASE.md di `/tmp/db-notes-briefing.md`** (BELUM digabung ke docs/ sesuai instruksi koordinator; berisi baris "Ringkasan per domain" + subseksi §6 `briefings` & `briefing_delegations`).

## Langkah berikutnya
1. Jalankan `composer test` (minimal `tests/Feature/Briefings/BriefingTest.php tests/Feature/Notifications/NotificationSettingsTest.php tests/Feature/Performance/PageQueryCountTest.php`) saat DB test bebas; kalibrasi budget query.
2. Commit per langkah logis (`feat(briefing): …`) setelah izin; gabungkan draf DATABASE.md.
3. Frontend kartu "Catat briefing" (agen lain) memakai props `briefing` + `POST /briefing`, `POST /briefing/delegasi`.

## Keputusan yang diambil (implementasi)
- Notifikasi dikirim ke semua pengguna **termasuk pencatat** ("SEMUA pengguna perusahaan", tanpa pengecualian seperti pengumuman).
- Delegasi boleh dilakukan kapan saja sebelum/selama jendela (tidak dibatasi jendela); delegasi hanya berlaku tanggal+periode yang ditunjuk; pencatat HR/SA menyimpan sendiri → `delegated_from` null.
- Luar jendela → galat validasi ramah ("…hanya bisa dicatat pukul 08.00–11.00…"), bukan 403; 403 hanya untuk yang bukan pencatat/delegasi.
- Edit notulensi setelah terkirim tidak mengirim ulang notifikasi (isi revisi hanya di baris briefings; Inbox berisi versi pertama).
- Tidak ada rute lihat/hapus briefing terpisah (data penuh ada di Inbox + props dashboard); `update`/`delete` policy = false.

## Keputusan menunggu pemilik
1. **Dikte catatan** (warisan sesi 5): audio lewat Google (Web Speech API) atau self-host WhisperLive? → `docs/fitur/catatan-stt.md` §2.
2. Push/PR/deploy branch `glm/catatan-minimal` (termasuk pekerjaan editor catatan yang sudah di-commit `3b8c085`+`f9ac9bc`).

## Worktree / branch
`/Users/godam/PROYEK/ruang-kerja-glm` · `glm/catatan-minimal` · https://ruangkerja-glm.test

## Butuh dari pemilik / agen lain
- Jalankan/kalibrasi test bila DB test bebas; integrator menggabungkan draf `/tmp/db-notes-briefing.md` ke `docs/DATABASE.md`.
- CHANGELOG diisi integrator saat merge.

## Verifikasi terakhir
php -l (semua berkas baru/ubah) + `vendor/bin/pint --test` (26 berkas PASS) + `vendor/bin/phpstan analyse` level 8 per berkas terkait (OK, no errors). Pest/Vitest belum dijalankan (DB test dipakai proses lain).

## Riwayat singkat (sesi 1–5)
Sesi 5: editor catatan minimalis (app bar judul + 3 ikon, toolbar auto-hide; commit `3b8c085`+`f9ac9bc` di branch ini) + riset STT `docs/fitur/catatan-stt.md` (rekomendasi Web Speech API). Sesi 4: absensi → grup WhatsApp manajemen (Evolution API, 8 Okt): PR #13 `fb8b12c` + PR #14 `c8b0384`; panduan `docs/fitur/absensi-whatsapp.md`, `docs/deploy/WHATSAPP.md`. Sesi 3: rencana aplikasi ponsel `dcb8a3a`. Sesi 2: PR #12 `2d724e1`, deploy spkd.store `4ae50a2245fb`. Sesi 1: U-06 dynamic import Hocuspocus/Yjs.
