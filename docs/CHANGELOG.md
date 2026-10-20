# Changelog

Semua perubahan penting RuangKerja dicatat di sini. Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/); aplikasi belum memakai nomor versi, jadi setiap bagian adalah satu sprint Fase 1 (urutan terbaru di atas). Rincian lengkap per sprint ada di `docs/sprints/*/SUMMARY*.md` (juga bisa dibaca di aplikasi: **Admin › Dokumentasi**), riwayat commit di `git log main`.

Kategori: **Ditambahkan** (fitur baru) · **Diubah** · **Diperbaiki** · **Keamanan**.

## [Belum dirilis]

### Ditambahkan (20 Okt 2026, keputusan pemilik — Ruang HR; `docs/fitur/ruang-hr.md`)
- **Ruang HR** (`/hr`, HR & Super Admin; lainnya 403) menggantikan Dashboard HR: tab Ringkasan, Absensi, Monitoring, Penugasan, Jadwal, Catatan. `/dashboard` dan `/dashboard/hr` mengalihkan HR ke `/hr`; prop bersama `auth.home`. Layar React masih placeholder (backend & prop final).
- **Penugasan HR**: "Beri tugas" ke karyawan, divisi (termasuk sub-divisi), atau tim — satu tugas per orang atau satu tugas bersama, instruksi, tenggat, prioritas, checklist (maks. 20), maks. 200 penerima; audit `hr.task_assigned`. Tugas tinggal di workspace sistem "Penugasan HR" dengan **tugas privat** (`workspaces.tasks_private`): karyawan hanya melihat tugas yang ditugaskan kepadanya di semua jalur web & API (papan, detail, pencarian, aktivitas, notifikasi, anggota, Drive, otomasi).
- **Workspace sistem** "Tim HR" (catatan bersama) dan "Penugasan HR" per perusahaan (`workspaces.system_key`), admin otomatis = semua HR + Super Admin, tidak bisa diarsipkan/diganti key; disinkronkan setiap halaman Ruang HR dan tiap hari 01.00.
- **Ingatkan laporan harian** dari Ruang HR › Monitoring: karyawan terjadwal yang belum mengirim laporan, maks. sekali per orang per hari (terpisah dari pengingat 16.30).
- **Jadwal wawancara kandidat** (`candidates.interview_at`, `interview_location`; `PUT /hiring/kandidat/{id}/wawancara`) dengan notifikasi baru `hiring.interview_scheduled` ke pewawancara; tampil di Ruang HR › Jadwal bersama rapat, cuti seluruh perusahaan, dan hari libur.

### Diubah (20 Okt 2026, keputusan pemilik)
- Dashboard jabatan, Dashboard Manajemen, dan Otomasi disembunyikan dari navigasi kecuali Super Admin.

### Ditambahkan (20 Okt 2026, keputusan pemilik — absen pegawai & gaji harian; `docs/fitur/absensi-gaji.md`)
- **Absensi › Pegawai** (`/absensi/pegawai`, HR & Super Admin): kisi semua karyawan × tanggal satu bulan; atur status manual per tanggal (dengan jam untuk Hadir/Terlambat/WFH/Dinas) atau hapus catatan tanpa check-in, alasan wajib, diaudit (`attendance.status_set`, `attendance.day_cleared`). Status manual (`attendance_days.status_source = manual`) tidak ditimpa tutup hari; check-in/out sungguhan atau pengajuan yang disetujui menggantikannya. API ponsel HR: `PUT/DELETE /api/v1/absensi/hari/{karyawan}/{tanggal}`.
- **Absensi › Gaji** (`/absensi/gaji`): upah harian × hari dibayar per karyawan, aturan per perusahaan (Cuti/Sakit/Izin dibayar, potongan terlambat), kunci periode (snapshot; koreksi, status manual, dan upah di bulan terkunci ditolak), ekspor Excel. Izin baru `payroll.view` (Super Admin, HR, Direksi baca saja) dan `payroll.manage` (Super Admin, HR). Tabel baru `employee_wages`, `payroll_rules`, `payroll_periods`.

### Ditambahkan (18 Okt 2026, Fase 1 multi-perusahaan — keputusan pemilik; `docs/ARCHITECTURE.md` §4.1, ADR #11)
- **Isolasi data antar-perusahaan** di satu database: `CompanyContext` (web, API, kiosk, webhook, job & notifikasi), registri tabel `config/tenancy.php`, dan suite kebocoran otomatis (`tests/Feature/Tenancy`: semua rute ber-parameter, halaman/daftar/ekspor, penjadwal, WhatsApp, kanal broadcast, injeksi id). Celah yang ditutup: audit log per perusahaan (`audit_logs.company_id`), nomor pengajuan & nomor karyawan per perusahaan, hari libur & HR penyetuju per perusahaan, validasi `exists` per perusahaan, tidak ada lagi "perusahaan pertama", kunci cache & berkas privat (`company/{id}/…`) per perusahaan.
- **Zona waktu & penjadwal per perusahaan**: semua tanggal/jam kantor dari `companies.timezone` (WIB/WITA/WIT, label zona ikut perusahaan) di web, API, dan aplikasi; tugas harian (tutup hari, pengingat, ringkasan, tenggat, laporan 16.30, snapshot 23.55, …) berjalan pada jam lokal tiap perusahaan, sekali per tanggal (`scheduled_runs`), termasuk mengejar setelah penjadwal mati melewati tengah malam.
- **Integrasi per perusahaan**: grup WhatsApp absensi dan Shared Drive Google per perusahaan (`php artisan company:configure`, `company:list`); email memakai nama perusahaan penerima.
- `ruangkerja:create-super-admin`: `--company=` wajib bila ada beberapa perusahaan, `--new-company=<nama>` + `--domain=<domain>` (domain yang sudah dipakai ditolak dengan pesan jelas).
- **Perusahaan demo kedua** untuk uji lokal: `php artisan db:seed --class=SecondCompanyDemoSeeder` (PT Contoh Mitra, WITA, akun `admin@`/`hr@`/`anggota@contoh.test`); `scripts/ui-shots.mjs --larang/--wajib` memeriksa teks halaman. Anggaran query halaman utama kini diukur dengan perusahaan kedua bervolume (tidak berubah).


### Keamanan (7 Okt 2026, audit rapat video & sandi bawaan — `docs/security/AUDIT-RAPAT-2026-10.md`)
- **Sandi bawaan selalu wajib ganti** (R-01, Tinggi): "Sandi bawaan" dari HR tidak bisa lagi disimpan tanpa "wajib ganti" (centang dikunci, server memaksa), dan login dengan sandi bawaan selalu menyalakan wajib ganti untuk akun lama yang terlanjur.
- **Webhook LiveKit** (R-02): kejadian yang gagal diproses tidak lagi dianggap duplikat saat LiveKit mengirim ulang (kehadiran tidak tertinggal "masih di ruang").
- **Token video penyelenggara tanpa `roomAdmin`** (R-03): moderasi (bisukan, keluarkan) hanya lewat aplikasi dengan Policy + audit.
- **Selama wajib ganti sandi** (R-10): `inbox/feed` ditolak (403) dan shell tidak menerima data akun (jumlah persetujuan/notifikasi, workspace, status absensi) sampai sandi sendiri dipilih.
- **Audit tampil sandi bawaan** (R-11): setiap kali HR menampilkan sandi bawaan dicatat `user.default_password_revealed` (tanpa nilai).
- **Landing di edge bersama** (R-16): `site.caddy.template` + `deploy-remote.sh` menyajikan halaman depan `/` seperti stack mandiri; landing mendapat CSP ketat sendiri.

### Diubah (7 Okt 2026, keputusan pemilik — sandi bawaan)
- **Kata sandi bawaan karyawan** (`EMPLOYEE_DEFAULT_PASSWORD`, kosong = mati): karyawan baru dari Admin › Karyawan › Tambah karyawan dan impor CSV/XLSX langsung bisa login dengan sandi bawaan dan wajib menggantinya saat login pertama. Super Admin tidak pernah mendapatkannya.
- **Atur kata sandi**: pilihan "Sandi bawaan" (pertama, terpilih otomatis bila dikonfigurasi; nilai tersamar dengan tombol tampilkan/salin, diambil saat diminta) dan "Ketik sendiri". Generator "Buat sandi sementara" dihapus. Audit `user.password_set_by_hr` kini mencatat `mode` (`default`/`manual`), tidak pernah nilai.
- **Aturan sandi bebas untuk karyawan**: wajib, dikonfirmasi, maks. 255, dan bukan sandi bawaan ("Gunakan sandi selain sandi bawaan."). Berlaku untuk ganti paksa setelah login pertama, Pengaturan › Keamanan, Lupa kata sandi, dan "Ketik sendiri" HR. Super Admin tetap aturan ketat (min 8, bukan email, produksi cek sandi bocor). Browser tidak lagi diberi `passwordrules` untuk karyawan.
- **Perintah `php artisan ruangkerja:reset-default-passwords`** (`--dry-run`, `--force` wajib di produksi, `--only-without-password`, `--notify`): mengembalikan semua akun aktif & nonaktif (bukan Super Admin, bukan yang mengundurkan diri) ke sandi bawaan + wajib ganti, mengeluarkan semua sesinya, audit `user.password_reset_to_default` per akun.

### Ditambahkan (7 Okt 2026)
- **Dokumentasi Video RuangKerja arah C "Notulen Hidup" & notulen otomatis**: panduan pengguna per peran `docs/fitur/rapat-video.md`, privasi & UU PDP `docs/fitur/rapat-video-privasi.md`, operasional server rapat + worker transkripsi + LLM + rencana subtitle GPU + runbook di `docs/deploy/RAPAT-VIDEO.md` (ketiganya + audit rapat di Admin › Dokumentasi, gambar di `docs/fitur/img/rapat-video/`); token ruang rapat di `docs/DESIGN.md`; kebijakan privasi menyebut rapat video, lama bicara, dan notulen otomatis.
- **Video RuangKerja — rapat video bawaan pengganti Google Meet** (LiveKit di server sendiri, keputusan pemilik 7 Okt 2026): tempat rapat baru "Video RuangKerja" (bawaan bila `LIVEKIT_*` diisi), layar pra-gabung `/rapat/{id}/gabung` (cek kamera/mikrofon, pilih perangkat) dan ruang layar penuh `/rapat/{id}/ruang` (petak/sorotan, berbagi layar, chat, angkat tangan, daftar orang, bisukan/keluarkan oleh penyelenggara, pintasan seperti Meet, sambung ulang), jendela gabung 15 menit sebelum s.d. 2 jam sesudah rapat, kehadiran otomatis dari webhook LiveKit (`meeting_attendances`, panel "Hadir di rapat video", isian awal notulen), notifikasi "Rapat dimulai" dengan tombol Gabung. Paket baru `livekit-client`, `@livekit/components-react`; `firebase/php-jwt` jadi dependensi langsung. LiveKit lokal: `compose.yml` profil `video`. `docs/fitur/rapat-kalender.md` §6a, `docs/deploy/RAPAT-VIDEO.md`.
- **HR membatalkan pengajuan yang sudah disetujui** (`POST /persetujuan/{id}/batalkan`, permission `requests.cancel_approved` untuk HR & Super Admin, bukan pengajuan sendiri): alasan wajib 10–500 karakter (hanya tampil di aplikasi), saldo cuti dikembalikan, efek absensi dibatalkan (cuti/izin/sakit/dinas dihapus atau dilepas, lembur dihitung ulang, koreksi dipulihkan atau ditolak bila hari sudah berubah), tanggal lampau ditutup ulang, notifikasi `request.voided` ke pemohon + `request.canceled` ke penyetuju, audit tanpa isi alasan. Tab baru **Disetujui** di `/persetujuan` untuk HR. Deploy: jalankan `RoleSeeder`.
- **Tanda baca komentar tugas**: "Dibaca oleh N" (nama + jam) dan "Belum dibaca: …" untuk yang di-mention, ditandai saat daftar komentar terlihat ±1,2 detik; membuka komentar juga menandai notifikasi Inbox komentar itu terbaca; jumlah komentar + titik belum dibaca di kartu board & baris list (komentar orang lain ≤ 14 hari). Tabel `task_comment_reads`, realtime lewat `presence-task.{id}`. Manajemen view-only tidak dicatat; tersembunyi di workspace pribadi.
- **Kehadiran per kartu board**: avatar orang lain yang sedang membuka tugas (maks. 2 + "+N") dan petunjuk "mengetik…" di kartu board/ponsel, "sedang diedit oleh X" di baris list. Satu langganan `presence-workspace.{id}` per board (whisper `viewing`, `sync`); heartbeat 12 detik, kedaluwarsa 30 detik; tanpa Reverb tidak tampil apa pun.
- **Unduh PNG struktur organisasi** (`/organisasi/struktur`): bagan lengkap sesuai pencarian, header perusahaan + tanggal, selalu tema terang, 2x dengan batas piksel kanvas (peringatan bila diturunkan), font tertanam, `struktur-organisasi-YYYY-MM-DD.png`. Desktop: tombol di header tampilan Bagan; ponsel: menu "…" app bar. Dibuat di peramban dengan paket baru `modern-screenshot` (lazy). `docs/fitur/ekspor-struktur-organisasi.md`.

### Ditambahkan (7 Okt 2026, deploy)
- **WAL archiving + pemulihan ke titik waktu (PITR)** dengan pgBackRest ke object storage S3 (Biznet NEO / SeaweedFS): image `ruangkerja-postgres` (postgres:17-alpine + pgBackRest, `archive_timeout` 60 detik → kehilangan data terburuk ±1 menit), layanan `pitr` di `compose.prod.yml` & `compose.data.yml` (full Minggu + diff harian 01.30 WIB, retensi 4 full + 7 diff = jendela ±4 minggu, repositori terenkripsi AES-256 `PITR_CIPHER_PASS`), `wal-check` tiap 10 menit (heartbeat, kontainer unhealthy bila gagal), `pitr-restore --time`. Dump harian tetap jalan. Runbook `docs/deploy/PITR.md`, uji lokal `scripts/pitr-uji.sh`.

### Diperbaiki (7 Okt 2026, deploy)
- `compose.shared.yml` gagal di-parse (kunci `deploy` ganda di `collab`; batas sumber daya milik `reverb`), sehingga `COMPOSE_FILE=compose.prod.yml:compose.shared.yml` tidak bisa dipakai. CI kini memvalidasi compose prod, shared, data, dan web.

### Ditambahkan (6 Okt 2026, keputusan pemilik)
- **Login email + kata sandi untuk semua karyawan** (login Google ditahan): HR bisa mengatur sandi karyawan (opsi wajib ganti), karyawan ganti sandi sendiri di Pengaturan › Keamanan, **Lupa kata sandi** menunggu persetujuan HR lalu halaman tunggu otomatis pindah ke isi sandi baru (anti-enumerasi, token sekali pakai). Super Admin tetap wajib 2FA. `docs/fitur/akun-kata-sandi.md`.
- **Staf**: saldo cuti tidak dikirim/ditampilkan untuk staf; struktur organisasi 404 untuk staf; **cuti & lembur dikunci** (`leave_types.locked_reason`, HR bisa membuka); **pengajuan barang** (kategori `procurement`, alur atasan → Direksi); workspace dikelompokkan Pribadi · Divisi & tim · Proyek dengan chip filter berwarna (halaman, Menu, Dock/Rail).
- **Laporan progres harian** (`/laporan`, kartu di Beranda, pengingat 16.30) dan **pengumuman** (`/pengumuman`, banner di semua dashboard, bisa ditutup tetapi tetap di Inbox).
- **Hiring** (`/hiring`, HR): lowongan, kandidat dari Google Form lewat webhook Apps Script (HMAC), checklist per pemeriksa, pertanyaan & jawaban wawancara, poin per pewawancara, notulensi, keputusan akhir oleh penyetuju (bawaan Faris & Dio). `docs/fitur/hiring.md`.
- **Dashboard Direksi** (`/dashboard/direksi`): monitoring kerja harian, mingguan, per proyek dari laporan harian, catatan tindakan (`management_notes`), akses cepat workspace (baca saja). **Absensi bertab** Hari ini · Rekap · Kedisiplinan (`/absensi/kedisiplinan`: kedisiplinan, tren, penyelesaian, lead time, rata-rata terlambat); Dashboard HR diringkas; beban kerja pindah ke `/manajemen`; HR + Direksi melihat semua workspace tim **baca saja**; panel "Laporan tim hari ini" untuk Kepala Divisi.
- Modul pratinjau menjadi **nyata** (flag sendiri, nyala lokal, mati produksi): **Catatan bersama** dengan folder & kolaborasi Hocuspocus (`FEATURE_NOTES`, layanan `collab/`), **Rapat, notulen & kalender** (`FEATURE_MEETINGS`; Google Calendar/Meet ditahan), **Otomasi, tugas berulang, template, Kinerja saya** (`FEATURE_AUTOMATION`), **OKR divisi** (`FEATURE_OKR`), **Dashboard per jabatan** (`FEATURE_ROLE_DASHBOARDS`, `positions.dashboard_role`). Panduan `/pratinjau/panduan`.

### Ditambahkan (6 Okt 2026, Notulensi — keputusan pemilik)
- **Notulensi cepat** di Catatan: tombol **Mulai notulensi** di semua dashboard dan ⌘K membuat catatan bertemplat di workspace Pribadi (`notes.preset = minutes`) dan membukanya dalam **mode catat**; menu "Notulensi terakhir".
- **Tab & sub-tab dokumen** ala Google Docs (catatan anak/cucu), **warna teks & stabilo** bernama palet yang ikut mode terang/Malam (hanya di catatan), **ukuran huruf** A−/A+ 90–160% per perangkat.
- **Mode catat persisten**: pil "Kembali ke notulensi" di semua halaman, menu Catatan langsung kembali ke notulensi aktif, keluar hanya lewat "Selesai mencatat". `docs/fitur/catatan.md` §3.

### Diubah (6 Okt 2026)
- Semua isian tanggal memakai komponen `DateInput` berformat **"Hari, dd/mm/yyyy"** (mis. "Selasa, 06/10/2026") apa pun bahasa peramban; server tetap menerima `YYYY-MM-DD`.
- `/manajemen`: kartu "Kehadiran hari ini" dan KPI "Tugas terlambat" dihapus.
- Hiring: data pelamar dihapus permanen **30 hari** setelah keputusan, penghapusan, atau lowongan ditutup (`HIRING_RETENTION_DAYS`, job harian 02.30).
- Akun demo: Reynandio Wira Prathama (Direktur Utama, `dio@`) dan M. Faris Ahlul Firdaus (Project Leader, `faris@`) masuk unit Direksi; Hendra kini Direktur Operasional.
- Shell ponsel mobile-first: tombol Absen menonjol di tengah tab bar kini ikut dihitung di `--tab-bar-height` (bilah aksi bawah tidak tertutup).
- Ditahan pemilik: login Google, Google Drive/Docs/Calendar/Meet, WhatsApp + provider, aplikasi ponsel, mesin fingerprint.

### Ditambahkan
- **Obrolan nyata (F2-1)** di balik `FEATURE_CHAT` (nyala lokal, mati produksi): channel otomatis per workspace, channel publik/privat, DM & grup (dipakai ulang untuk orang yang sama), thread, @mention, #rujukan tugas, reaksi, lampiran Drive yang bisa dibuka semua anggota, tanda baca, bisukan, "Muat pesan sebelumnya", realtime Reverb (pesan, dibaca, mengetik, online) dengan polling cadangan. DM/grup/privat hanya bisa dibaca anggotanya. Notifikasi DM/grup ("Pesan langsung & grup obrolan", in-app) dan mention. Tile Obrolan di Dock/Rail + Menu dengan badge. Command `chat:sync-workspace-channels`. Middleware `EnsureFeatureEnabled:<flag>` menggantikan `EnsurePrototypeEnabled`.
- **Ruang saya** di Beranda (Dashboard Saya, desktop & ponsel): tugas baru yang diberikan orang lain (terima ke Hari ini / Minggu ini), lajur Hari ini · Minggu ini · Nanti dengan penempatan otomatis per tenggat dan penanda "terbawa dari kemarin", catatan pribadi cepat, tandai selesai (lewat Review bila kolom itu ada), progres "selesai hari ini". Rencana bersifat pribadi (`task_plans`). Seeder demo `PlannerDemoSeeder`.

- **Pemilih akun demo** (lokal saja) di bagian atas shell untuk meninjau UI per persona: Staf programmer, Staf admin & HR, Staf sosial media/branding & marketing, Admin, Direksi & manajemen. Akun demo baru `programmer@demo.test` (divisi baru Programming, kepala Yudi Hartono) dengan 12 tugas contoh, 2 tugas pribadi dan rencana Ruang saya; tombol masuk cepat di halaman login memakai nama persona.

### Diubah
- **Shell ponsel mobile-first** (`docs/PLATFORM.md` §2.1, canvas "RuangKerja · Mockup Mobile-first"): tab bawah Beranda · Tugas · **Absen** (tombol bulat gradien yang menonjol di tengah) · Obrolan · Lainnya; Inbox lewat lonceng berbadge di app bar (dan baris Inbox di Lainnya), kembali menjadi tab ke-4 bila `FEATURE_CHAT` mati. Beranda ponsel menampilkan cari + lonceng (profil lewat Lainnya). Tab Menu berganti nama menjadi Lainnya.

### Diperbaiki
- Status absensi di shell tidak lagi galat 500 di lokal (`LazyLoadingViolationException` pada `checkInLog`) untuk karyawan yang check-in kemarin dan hari ini tetapi belum check-out: log hari yang masih terbuka dimuat sekaligus.
- Breadcrumb menu bar tidak bertumpuk saat sempit: induk terpotong dengan elipsis, halaman aktif tetap utuh.
- Beranda anggota tidak lagi kosong (`Cannot read properties of undefined (reading 'total')`): bagian "Fokus hari ini" dan "Minggu ini" diganti Ruang saya.

### Diubah
- **Sistem desain Arus untuk seluruh aplikasi** (`docs/ruangkerja-design/`, `docs/DESIGN.md`): palet terang & Malam baru dengan nama token lama, pasangan status lembut (`bg-success-soft` …), gradien aksi/merek/hangat/indigo, latar halaman dua cahaya, huruf **Figtree** (isi 16px desktop, 17px ponsel, display 44px) + JetBrains Mono, skala radius 8–28, elevasi e-1/e-2/glow, kontrol 44px. Tema halaman Manajemen (`arus.css`) dilebur ke sistem global; Plus Jakarta Sans dihapus.
- Komponen dasar bergaya Arus: tombol gradien (varian `tonal`, `quiet`, ukuran 36/44/52/56), input/select 44px, checkbox/radio/switch, badge status & label, `SegmentedTabs`/`TabNav`, `Panel`, `KpiCard`, `Progress`, `ListRow`, empty state, dialog/sheet/menu kaca, toast inverse.
- Shell: menu bar kaca 64px, Dock dengan ubin putih & aktif bergradien, **Rail 96px untuk tablet** (768–1023px, menggantikan Dock tanpa magnifikasi), tab bar kapsul 70px dengan pil gradien, app bar ponsel berjudul besar. Konten desktop di kolom 1280px (1480px untuk board & tabel).
- Warna non-CSS (manifest PWA, halaman offline, email, `config/branding.php`) mengikuti Arus.
- **Tugas** bergaya Arus: board (DBoard: kolom panel, kartu 17px, sorot terlambat, info selesai tepat waktu/telat), List (DTodo: panel per status yang bisa dilipat), kalender, **Tugas saya** (STugasSaya/MTugas: grup berkepala warna, pil status, chip workspace, KPI "Selesai minggu ini"), detail tugas (DTugas/MSDetailTugas: chip status & prioritas, judul 40px, kartu checklist/sub-tugas/lampiran/komentar, kartu properti, jalur status sekali ketuk di ponsel).
- **Inbox, Cari & command palette** sesuai DInbox / MInbox / MNotifCenter: pil saring (status · jenis · arsip) menggantikan tab + menu corong, kartu daftar dengan grup hari dan ubin ikon 44px, panel detail melekat, app bar ponsel memakai `appBarIconButton`, toast notifikasi realtime bergaya inverse; layar Cari ponsel memakai gaya daftar MInbox.
- Dashboard Saya/Divisi/HR dan Portofolio proyek mengikuti layar Arus (SBeranda·MSBeranda, DBeranda·MBeranda, DHR·PHRLive, DPortofolio·PDirutPortofolio): hero absensi & KPI sorotan, `Panel`/`KpiCard`/`Badge`/`ListRow`/`UserAvatar`, tren 8 minggu sebagai kolom gradien, daftar orang per status (ponsel HR), kartu proyek dengan cincin progres; `features/dashboard/panel.tsx`, `stat-card.tsx` dan `features/portfolio/sections.tsx` dihapus.
- Arus · akun & masuk: halaman masuk mengikuti DLogin/MLogin (panel merek gradien, tombol Google 56px, kartu demo, ponsel malam beraurora), halaman auth lain berupa kartu panel; Pengaturan (profil, notifikasi, tampilan, akun Google, privasi, keamanan) memakai kartu identitas gradien + TabNav sesuai SPengaturan/MSPengaturan; kebijakan privasi & kebijakan data absensi bergaya panel; tab Menu ponsel mengikuti MMenu; template email dengan pita gradien, kartu radius 24, tombol gradien.
- Halaman Admin (organisasi, karyawan + profil + impor, absensi + penugasan + kiosk, jenis pengajuan & alur, saldo cuti, audit log, dokumentasi) bergaya Arus: header overline + judul display, `Panel`/tabel berkepala `bg-background`, `Badge` status/label, `TabNav`, `NativeSelect` 44px (`features/admin`).
- **Absensi gaya Arus**: `/absensi` (DAbsensi; ponsel MAbsen → layar sukses gradien MSukses), `/absensi/riwayat` (SAbsensi/MSRiwayat: strip Hari ini, KPI bulan, kalender, Catatan bulan ini), `/absensi/hari-ini` (DHR/PHRLive: Hadir sekarang, per divisi, Perlu ditinjau, daftar per orang), `/absensi/rekap` (MgAbsensi; ponsel ringkasan KPI), alur check-in, dialog koreksi/selfie/log, pengaturan absensi, dan layar `/kiosk/*`.
- **Pengajuan & Persetujuan** bergaya Arus (SPengajuan, SFormPengajuan, DPersetujuan, MS*/MPersetujuan): kartu saldo sorotan, daftar kartu + panel detail dengan jejak persetujuan, ubin jenis & kartu Ringkasan di formulir, antrean beravatar dengan filter jenis dan tombol Tolak/Setujui di kartu ponsel. Breadcrumb Persetujuan tidak lagi di bawah Absensi.
- Workspace & proyek dalam Arus: `/workspace` berupa kartu (SProyekSaya) dengan pil peran (prop baru `my_role`), header workspace + `TabNav`, Ringkasan proyek sesuai DProyek/MProyek (cincin progres, burn-up bergradien dengan proyeksi, linimasa milestone, update PIC, kotak arahan), tab Dokumen/File/Aktivitas/Pengaturan dan Struktur organisasi bergaya Arus.

- **Arus · pemolesan akhir**: toolbar board (jumlah tugas · sinkron · Filter · Tampilan · Board/List/Kalender) kini di garis tab workspace seperti DBoard (membungkus di jendela sempit; pencarian & chip filter di bawahnya); `TabNav` menerima `preserveScroll`/`prefetch`; `KpiCard` punya slot `bar` di antara nilai dan catatan (DHR "Hadir sekarang", DPortofolio "Proyek aktif") + `KpiBar`; `ChipScroller` memberi scroll padding sendiri; contoh tema memakai token tetap `preview-light`/`preview-dark`; breadcrumb selaras Dock/Rail (tujuan utama satu crumb, isi tumpukan Admin di bawah "Admin", Organisasi untuk struktur/kelola organisasi/karyawan, "Workspace › nama › tab"); halaman galat 403/404/419/429/500/503 bergaya Arus berbahasa Indonesia; sisa kelas lama (2FA, kata sandi, tombol kamera & Google) ke token Arus.

### Diperbaiki
- Cek bug pratinjau: `/dashboard` tidak lagi menggulir horizontal di 375 px (tabel `sr-only` grafik tren dibungkus `div.sr-only`); 4 test Vitest `localStorage` kembali hijau di Node 26 (`resources/js/test/vitest.setup.ts`); `npm run lint` mengabaikan format `compose.shared.yml`.
- Migrasi Arus: tab status Pengajuan, Tugas saya, Data organisasi, Persetujuan kembali mempertahankan posisi gulir; tab "Sudah diputus" desktop kembali menampilkan waktu keputusan; baris "Tugas terlambat" di Ringkasan proyek membuka halaman tugas (sebelumnya ke API JSON); notifikasi arahan `#arahan` kembali menggulir ke kotak Arahan Direksi untuk PIC; filter workspace di Tugas saya tidak macet saat chip-nya hilang.
- Toast desktop tidak lagi menimpa ujung kanan Dock (offset `--dock-space`); bayangan panel detail Inbox tidak terpotong; placeholder "[Nama Perusahaan]" tidak tampil di halaman tamu; kartu kalender tugas tidak patah baris; keterangan "Selesai … · telat" di List ponsel membungkus.
- Aksesibilitas: kartu KPI bertautan tidak lagi menyarangkan tombol definisi di dalam tautan dan nama tautannya memuat nilai; pilihan metode absensi diumumkan sebagai radiogroup (`SegmentedTabs semantics="radio"`); `aria-controls` grup List yang tertutup; kartu "Butuh keputusan" ponsel hanya tautan bila panelnya ada; definisi metrik "Butuh keputusan Anda" kembali.

### Ditambahkan
- **Pratinjau Fase 2 & 3** (frontend saja, data contoh, tidak menyimpan apa pun; flag `FEATURE_PROTOTYPE`, mati di produksi, rute 404 saat mati): hub `/pratinjau` (ubin Dock/Rail + seksi Menu ponsel) dan delapan modul desktop + ponsel dengan keadaan Memuat/Kosong/Galat (`?keadaan=`). **Obrolan** (F2-1: channel workspace/publik/privat, DM, grup, thread, @mention & #rujukan tugas, reaksi, lampiran Drive, tanda baca, cari, bisukan); **Catatan bersama** (F2-2: pohon per workspace, editor Tiptap dengan kursor kolaborator tiruan, simpan otomatis, riwayat versi + pulihkan, berbagi); **Rapat, notulen & kalender** (F2-3: agenda dengan Google Meet, jadwalkan + deteksi bentrok & usulan slot, pemberitahuan rapat dimulai, notulen dengan "Jadikan tugas" & finalisasi, kalender rapat/tenggat/cuti/libur, `/manajemen/jadwal`); **Otomasi & WhatsApp** (F2-4: verifikasi nomor OTP, opt-in per kejadian, jam tenang, aturan *Jika → Maka*, tugas berulang, template tugas/workspace) + **Kinerja saya** (`/kinerja`, metrik terpisah tanpa skor gabungan); **Aplikasi ponsel** (F3-1/F3-2: masuk biometrik, layar kunci beraksi, widget, check-in wajah dengan persetujuan biometrik & liveness, integritas perangkat/fake GPS, antrean offline, aksi cepat, Perangkat saya); **OKR divisi**, **Mesin fingerprint ZKTeco (ADMS)** dan **Dashboard per peran SPKD** (F3-3). Dokumentasi bergambar per modul + checklist backend: `docs/fitur/` (juga di Admin › Dokumentasi, grup "Fitur & pratinjau"); gambar dibuat ulang dengan `node scripts/docs-screenshots.mjs`. Smoke test e2e `tests/e2e/prototype-smoke.spec.ts`; laporan cek bug `docs/sprints/fase-2-3-prototipe/BUG-REPORT.md`.
- `/dev/komponen` (lokal, Super Admin): contoh hidup semua komponen Arus. Panduan agent modul: `docs/design/ARUS-GUIDE.md`.

### Dihapus
- Komponen tak terpakai `ui/sidebar`, `ui/navigation-menu`, `ui/icon`, `ui/placeholder-pattern`, hook `use-mobile*`, prop bersama `sidebarOpen`, paket `@radix-ui/react-navigation-menu` dan `@fontsource/plus-jakarta-sans`.
- Kode UI lama yang tidak terpakai: `features/attendance/today-card.tsx`, `components/ui/separator.tsx` (+ paket `@radix-ui/react-separator`), ekspor mati (`NavItem`, tipe 2FA, `SheetNavigation`, `formatMonthShort`, `fieldClass`/`FLAG_LABELS`/`RISK_TONES`/`healthRank` portofolio, `SORTABLE_COLUMNS`), variabel CSS `--brand-gradient`.

### Ditambahkan
- **Dashboard Manajemen** (`/manajemen`, Direksi · HR · Super Admin = `dashboard.view_company`; menu Dock "Manajemen" dan baris Menu ponsel): ringkasan perusahaan sesuai desain MgDashboard dengan tab Harian / Mingguan / Bulanan tanpa muat ulang — KPI kehadiran, tugas selesai dari rencana, tugas terlambat / tepat waktu (delta periode sebelumnya), proyek perlu perhatian; grafik rencana vs selesai per divisi / hari / minggu; absensi hari ini per divisi; tracking proyek aktif & milestone bulan ini (cakupan portofolio penonton). Data deferred + cache 5 menit per penonton; panel Jadwal & Notulensi menampilkan keadaan kosong sampai modul rapat (Fase 2) ada. Memakai sistem desain Arus global (terang & malam).
- **Admin › Dokumentasi** (`/admin/dokumentasi`, khusus Super Admin): dokumen repo pilihan (README, serah terima, arsitektur, database, desain, platform, setup lokal, PRD, ASVS L1, changelog, hal kritis, ringkasan sprint) dirender di server dengan daftar isi dan pencarian. Daftar dokumen dikunci di `config/docs.php`; URL hanya memuat slug, tidak pernah path.
- `docs/CHANGELOG.md` (berkas ini) dan `docs/CRITICAL.md` (hal kritis operasional + checklist go-live).
- **Kode aktivasi kiosk**: selain tautan sekali pakai, HR mendapat kode 8 karakter (mis. `ABCD-2345`, tanpa huruf/angka mirip) yang diketik di layar `/kiosk` perangkat. TTL sama dengan tautan (24 jam), sekali pakai, memakai tautan atau kode membatalkan keduanya; maks. 5 percobaan/menit per IP, kunci 15 menit setelah 10 kode salah.
- Shell desktop: Dock ala macOS (magnifikasi pegas), menu bar tipis, konten penuh layar.
- **Pengajuan** (`docs/sprints/FITUR-PENGAJUAN.md`): jenis bawaan Cuti melahirkan (90 hari kalender), Cuti alasan penting (maks. 3 hari per peristiwa), Cuti di luar tanggungan (tidak dibayar, tidak memotong saldo) dengan penanda **"Bawaan sementara"** sampai ditinjau HR; draf form tersimpan otomatis di perangkat ("Draf dipulihkan dari perangkat ini" + Buang); saldo cuti prorata untuk karyawan baru, **saldo awal**, **penyesuaian** beralasan (teraudit, tabel `leave_balance_adjustments`) dan **impor saldo CSV/XLSX** dengan pratinjau galat per baris.

### Keamanan
- Email/WhatsApp pengajuan tidak memuat catatan penolakan/revisi (hanya di aplikasi); pengajuan Sakit memakai subjek netral tanpa jenis/nomor; audit keputusan hanya menyimpan id + `has_note`.
- Penyetuju pengganti (delegasi) pengajuan Sakit hanya melihat tanggal, durasi, status — alasan, catatan, dan lampiran disembunyikan (juga unduhan lampiran dan pencarian).

## Perbaikan review Sprint 3–9 (bagian A, B, dan sisa akhir)

### Diperbaiki
- Absensi: rekap & ekspor gaji hanya menghitung hari dalam masa kerja (`users.deactivated_at`), cuti setengah hari dihitung setengah, "lupa check-out" baru muncul setelah jendela check-out lewat, koreksi shift malam setelah tengah malam ditambatkan ke hari berikutnya, hanya tinjauan pertama yang berlaku saat dua HR meninjau bersamaan, Dashboard HR tidak memuat shift malam yang masih berjalan.
- Kiosk: perangkat lama dikeluarkan tanpa merotasi remember token pemasangan baru.
- Notifikasi: akses dicek ulang sebelum notifikasi antrean dikirim, ringkasan harian diklaim atomik sekali per hari, hari libur dianggap hari tenang untuk email tertunda, pengingat tenggat tidak ganda, mention dinotifikasi sekali per komentar/deskripsi.
- Tugas: pindah status + ubah field dalam satu transaksi, pengingat terlambat dibereskan saat tugas dihapus/diarsipkan, event broadcast "tipis" (tanpa isi), 404 untuk non-penonton sebelum validasi.
- Proyek & dashboard: akses portofolio dicabut saat PIC/sponsor dilepas, snapshot burn-up memakai tanggal yang benar, keputusan proyek aman dari balapan, workspace terarsip tidak dihitung di metrik, "Fokus hari ini" dan "Minggu ini" disajikan langsung (tidak dari cache).
- Drive: batas mulai unggah per menit + batas unggahan tertunda per pengguna (pesan 429 berbahasa Indonesia), file Drive dicatat per workspace.
- Pencarian: tugas dicari dengan indeks full-text dan cuplikan deskripsi; akses lewat gate untuk karyawan aktif.

### Keamanan
- Scan QR tanpa GPS diberi flag `qr_no_location`; `ATTENDANCE_QR_REQUIRE_LOCATION=true` mewajibkan GPS.
- Kanal siaran absensi per perusahaan `company.{company}.attendance`, diotorisasi berdasarkan perusahaan penonton.
- Ekspor spreadsheet menulis teks mirip rumus sebagai teks biasa (cegah formula injection).
- Assertion service account Google hanya dikirim ke `oauth2.googleapis.com`.
- Akses Drive dicabut saat karyawan dinonaktifkan; reaksi komentar ikut limiter komentar.

## Sprint 10 — Platform, keamanan, privasi & kinerja

### Ditambahkan
- Header keamanan + **CSP dengan nonce** (`SecurityHeaders`, `config/security.php`), HSTS, Permissions-Policy, rate limiter bernama (`login`, `check-in`, `api`, dll.), cookie aman, mode strict model di luar produksi, endpoint `/health`.
- Image produksi FrankenPHP, `compose.prod.yml` (Caddy, app, Horizon, scheduler, Reverb, Postgres, Redis, backup), backup harian `pg_dump` + rclone ke S3 dengan skrip restore & uji pemulihan, workflow deploy GHCR → approval → SSH.
- Sentry opsional (`SENTRY_LARAVEL_DSN`, tanpa PII); Pulse & Horizon hanya Super Admin.
- **Privasi & data saya** (`/privasi`): lihat dan unduh (Excel/PDF) seluruh data pribadi, kebijakan privasi berversi dari Markdown (`/kebijakan-privasi`), cabut persetujuan lokasi/selfie memberi tahu HR.
- Uji regresi jumlah query untuk halaman utama (anti N+1), indeks kinerja, Lighthouse halaman Absensi ponsel 98.
- `docs/security/ASVS-L1.md`, README deploy VPS dari nol, serah terima (`docs/HANDOFF.md`).

### Diubah
- Mini-map lokasi tanpa Leaflet/tile, shell desktop & palet ⌘K dimuat terpisah, Reverb lokal lewat wss dengan sertifikat Herd.
- Mekanisme placeholder rute modul dihapus (semua modul Fase 1 sudah dibangun).

## Sprint 9 — Metrik, dashboard & portofolio proyek

### Ditambahkan
- Definisi metrik berbasis output dengan periode; **Dashboard Saya, Kepala Divisi, HR** dengan filter, cache, ekspor Excel; "Tandai ditinjau" & Koreksi di Dashboard HR.
- Pelacakan proyek: atribut proyek, milestone, risiko, update berkala, rumus progres, snapshot burn-up harian, pengingat update mingguan.
- **Dashboard Direksi `/portofolio`**, tab Ringkasan proyek, pengaturan proyek; seeder demo analitik (50 karyawan × 6 bulan).

## Sprint 8 — Notifikasi, Inbox & command palette

### Ditambahkan
- Infrastruktur notifikasi (`BaseNotification`, preferensi per kanal, "perlu tindakan", ringkasan harian), **Inbox** desktop & mobile, lonceng realtime.
- **Command palette ⌘K** + layar cari (provider Orang, Tugas, Workspace, Pengajuan), halaman pengaturan notifikasi, `docs/sprints/sprint-8/HOW-TO-NOTIFY.md`.

## Sprint 7 — Google Drive & Docs

### Ditambahkan
- Lapisan domain Google: klien Drive v3, service account + domain-wide delegation, job antrean dengan retry/backoff, tabel `google_accounts` (token terenkripsi), `php artisan ruangkerja:google-check`.
- Workspace tersambung ke Google Drive: folder per workspace, sinkron izin anggota, tab **File** & **Dokumen**, unggah bertahap (resumable) dengan progres, status akses Drive, Google Picker.
- Lampiran Drive di tugas & komentar (panel lampiran, aktivitas, broadcast).

## Sprint 6 — Detail tugas, komentar & realtime

### Ditambahkan
- Detail tugas (sheet + halaman penuh), editor Tiptap, komentar, mention, reaksi, checklist, watcher, timeline aktivitas.
- Realtime lewat Reverb/Echo (kanal workspace & tugas), saved view, pintasan keyboard, notifikasi tugas & tenggat.

## Sprint 5 — Workspace & Kanban

### Ditambahkan
- Workspace Pribadi (otomatis), Divisi (anggota tersinkron), Tim, dan Proyek; favorit, arsip, pengaturan, anggota.
- **Board Kanban** (dnd-kit, lexorank, optimistik + rollback, `Shift+←/→`), List (TanStack), Kalender, filter di query string, nomor tugas `KEY-n` atomik.
- **Tugas Saya** lintas workspace; `TaskLifecycle` (`status_category`, `started_at`, `completed_at`).

## Sprint 4 — Pengajuan & persetujuan

### Ditambahkan
- Jenis pengajuan & kuota, alur persetujuan bertingkat (atasan langsung, kepala divisi, peran, user) dengan kondisi, delegasi, nomor berurutan aman balapan (`CUT-2026-10-0001`).
- Form cuti, izin, sakit (lampiran privat), lembur, koreksi absensi, dinas luar; halaman Pengajuan Saya, Persetujuan (aksi massal), admin jenis & alur, saldo cuti + generator saldo tahunan dengan carry-over.
- Efek setelah disetujui: saldo pending → used, `attendance_days` ditulis (cuti tidak jadi alpha), lembur, koreksi.

### Diperbaiki (review 2/4/5)
- Satu orang paling banyak memutus satu langkah per putaran (termasuk sebagai delegasi), delegasi bebas siklus, tumpang tindih dicek ulang di bawah kunci per pengguna, koreksi absensi untuk shift malam, check-in tetap boleh saat cuti setengah hari/dinas.

## Sprint 3 — Kiosk QR, tinjauan HR, rekap & ekspor

### Ditambahkan
- Akun kiosk (guard `kiosk`) dengan tautan aktivasi sekali pakai; layar kiosk `/kiosk/{location}` dengan **QR dinamis HMAC** berganti tiap 30 detik; tab "Pindai QR" (`@zxing/browser`) di dialog check-in.
- Papan **Absensi hari ini** (realtime), tinjau log mencurigakan, **koreksi manual HR** (wajib alasan, diaudit), lihat selfie (URL bertanda tangan 5 menit, setiap akses diaudit).
- Rekap bulanan, **ekspor Excel/PDF** untuk gaji (`config/payroll_export.php`), Absensi Saya (kalender), retensi selfie bulanan.

## Sprint 2 — Absensi inti

### Ditambahkan
- Lokasi kantor (peta + radius geofence), shift (termasuk lintas tengah malam), penugasan shift mingguan + override, hari libur + impor CSV, `ScheduleResolver`.
- Persetujuan lokasi & selfie berversi sebelum check-in pertama; **check-in/out GPS + selfie** (JPEG ≤ 300 KB, disk privat), `FraudDetector` menandai tanpa memblokir.
- `attendance:close-day` 00.30 WIB (alpha/perlu koreksi), pengingat check-in, broadcast absensi, riwayat 30 hari.

## Sprint 1 — Organisasi, login & admin

### Ditambahkan
- Perusahaan, divisi, tim, jabatan, profil karyawan (NIK terenkripsi), scope `visibleTo`, hierarki atasan bebas siklus, permission per peran, `AuditLogger` + audit log append-only.
- **Login Google Workspace** (domain & `hd` dicek), login kata sandi khusus Super Admin dengan **TOTP wajib**, `ruangkerja:create-super-admin`.
- **Admin › Karyawan** (tabel, form, nonaktifkan/aktifkan, impor CSV/XLSX dengan pratinjau), **Admin › Organisasi** (divisi/tim/jabatan), **Struktur organisasi**, **Admin › Audit log**.

### Keamanan (review 0–1)
- Hanya Super Admin yang memberi peran super_admin/direksi/hr dan tidak ada yang bisa mengubah perannya sendiri; tautan reset sandi hanya untuk Super Admin dengan jawaban generik; sesi terikat hash sandi akun; cookie sesi aman bawaan; file impor (berisi NIK) tidak disimpan melewati sesinya; channel privat membandingkan ULID sebagai string.

## Sprint 0 — Fondasi

### Ditambahkan
- Laravel 13 + Inertia 3 + React 19 (TypeScript strict), Tailwind 4 + shadcn/ui, PostgreSQL 17 + Redis, **PK ULID**, Pest 4, Larastan level 8, Pint, Vite+ (oxlint + oxfmt).
- Shell desktop & mobile, token desain terang/gelap, tema per pengguna, login demo lokal, PWA, terjemahan Indonesia, CI, smoke visual Playwright.
