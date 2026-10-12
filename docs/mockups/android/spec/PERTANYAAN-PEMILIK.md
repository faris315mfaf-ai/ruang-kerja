# Pertanyaan & keputusan untuk pemilik — mockup Android

Dikumpulkan otomatis dari bagian "Pertanyaan…" tiap spesifikasi (`_kit/build-index.mjs`). Jawaban Anda mengunci arah implementasi; urutan per modul.

## 01-akses-akun

1. **Fallback biometrik**: pratinjau web F3-1 menulis "Masuk dengan Google", tetapi login Google ditahan (keputusan 6 Okt). Mockup memakai **kata sandi** sebagai fallback. Setuju?
2. **Buka biometrik = Kunci aplikasi?** Token tetap di SecureStore sehingga "masuk biometrik" praktis sama dengan kunci aplikasi. Mockup menyatukannya: satu sakelar "Buka dengan sidik jari" + pengaturan "Kunci setelah" (segera/1/5/15 menit). Perlu satu sakelar atau dua? Dan apakah `devices.biometric_login` cukup sebagai penanda server?
3. **Ganti kata sandi wajib & lupa sandi di dalam aplikasi** (butuh 3 endpoint baru) atau tetap dilempar ke peramban? Mockup menampilkan keduanya: kondisi sekarang (file 04 layar 1) dan usulan native (layar 2–3, file 05–07).
4. **Super Admin di ponsel**: dukung TOTP native (file 04 layar 5) atau akun Super Admin web-saja? Jika web-saja, copy "untuk saat ini" perlu diganti ("Akun Super Admin hanya untuk web").
5. **Batas 5 perangkat**: pesan server meminta mencabut perangkat di "Perangkat saya", padahal pengguna belum bisa masuk. Perlu jalur: halaman web nyata untuk mencabut perangkat (halaman `/pengaturan/perangkat` sekarang hanya pratinjau berdata contoh) atau HR/Super Admin yang mencabut. Usulan: ubah pesan menjadi "…hubungi HR untuk mencabut perangkat lama".
6. **Tema**: simpan hanya di perangkat atau di akun (`users.theme`, sama di semua perangkat seperti web)? Menentukan perlu tidaknya `PUT /pengaturan/tampilan`.
7. **Versi wajib update**: siapa yang menetapkan `min_version` (env server atau tabel pengaturan Super Admin)? Dan tanggapan 426 vs pengecekan saat buka.
8. **Retensi perangkat tidak aktif**: perangkat tidak aktif > X hari dicabut otomatis? (daftar sekarang tak pernah bersih).
9. **Ekspor Data Saya di ponsel**: boleh mengunduh berkas berisi data pribadi ke folder Unduhan (tidak terenkripsi)? Alternatif: kirim ke email kantor.
10. **Teks kebijakan privasi masih draf** (menunggu `BRANDING_COMPANY_NAME`, kontak, persetujuan); salinan Android memakai teks yang sama + penyesuaian "Lainnya → Privasi & data saya".

## 02-beranda-dashboard

1. **Kartu Laporan hari ini di Beranda Android.** Web mencabutnya dari Beranda pada 9 Okt (digantikan Tugas hari ini) walau PRD/`laporan-harian.md` masih menyebut; laporan kini lewat Lainnya/pengingat 16.30. Mockup `01` & `10` menampilkannya sebagai usulan (tampil hanya mulai ~15.30 atau bila belum lapor). **Tampilkan, atau ikuti web (tanpa kartu)?**
2. **Super Admin tidak bisa masuk ke aplikasi** (API menolak 403 `two_factor_required`; TOTP belum didukung). Layar `22` hanya spesifikasi untuk saat TOTP tersedia. **Apakah 2FA ditambahkan ke API v1, atau Super Admin tetap web-only?**
3. **Tampilan awal per peran multi-tampilan.** Web memakai tampilan "landing" (Direksi → Direksi, HR → HR) atau yang terakhir dibuka? Usulan Android: ingat tampilan terakhir per perangkat. **Setuju?**
4. **Cache baca-saja (offline).** Tugas hari ini, briefing terakhir, dan dashboard tampil dari data terakhir saat offline (mockup `03`/`04`/`14`). Memerlukan penyimpanan lokal (paket baru). **Ya/tidak untuk v1?** (PLATFORM §2.1 #5: antrean tulis offline hanya Fase 3.)
5. **Menu cepat tahan-lama pada baris tugas** ("Kirim ke Review"/"Tulis komentar") bukan keputusan web. **Boleh ditambahkan atau hanya buka detail?**
6. **Briefing: pengingat jendela.** Notifikasi 08.00 dan 16.00 ke pencatat (HR/Super Admin/ditunjuk) agar jendela tidak terlewat — belum ada di web. **Usulan; setuju?**
7. **Dashboard divisi untuk jabatan 5 divisi — "Ditahan".** Dipertahankan jujur seperti web. Bila ingin tampak "hidup" di Android, modulnya (surat masuk, tiket, UAT, bug) harus dibuat dulu. **Konfirmasi tidak membuat layar P\* ditahan.**
8. **Ekspor Excel/PDF** dashboard (Kadiv/Direksi, Kedisiplinan) tetap desktop (PLATFORM §3). Mockup tidak punya tombol ekspor; **cukup banner "Tersedia di desktop" + "Kirim tautan ke email saya" di menu ⋯?**
9. **Ikon Lainnya vs Workspace:** foundation memakai `layout-grid` untuk Lainnya dan web memakai `LayoutGrid` untuk Workspace — identik saat sebelahan. Mockup modul ini memakai `menu` untuk Lainnya (seperti kode `menu-outline`). **Setuju diseragamkan?**
10. **Pengumuman: baca penuh.** Spanduk memotong 2 baris; web tidak punya detail. Usulan sheet baca penuh (mockup `09`-8). **Setuju (satu ketukan)?**

## 03-absensi

1. ❓ **Geser sebagai aksi final di layar Absen** (D1/D2) atau geser setelah tinjau selfie seperti web? Usulan: final di layar Absen.
2. ❓ **Rencana kerja untuk QR**: opsional (usulan) atau wajib seperti GPS+selfie? Wajib berarti QR lewat form yang sama.
3. ❓ **Check-out menawarkan laporan harian** (D9) dan menampilkan rencana pagi baca-saja untuk dilaporkan — setuju? Atau tanpa ajakan.
4. ❓ **Peta**: sketsa SVG (usulan, nol biaya) atau peta sungguhan (butuh kunci Google Maps/Mapbox)?
5. ❓ **Konfirmasi biometrik sebelum kirim** (sidik jari saat geser selesai) sebagai opsi di Pengaturan — dibutuhkan? Saat ini tidak ada; hanya widget (modul 12) yang membahasnya.
6. ❓ **Mock location**: menandai saja (usulan, konsisten PRD) atau memblokir check-in di aplikasi native Fase 3? Perlu `mock_location` di API + keputusan.
7. ❓ **Unduh rekap**: cukup "kirim tautan ke email" atau diinginkan PDF langsung di ponsel (butuh endpoint unduh Sanctum + berbagi berkas)?
8. ❓ **Pengingat check-in/check-out** (notifikasi lokal) default menyala? Jam pulang − 60 menit sudah dipakai tab tengah; selaraskan.
9. ❓ **Check-in "terlalu pagi"**: jendela 120 menit sebelum masuk — apakah rencana kerja boleh disiapkan lebih dulu (usulan, 03-3) atau form disembunyikan?

## 04-pengajuan-persetujuan

1. ❓ **Geser kartu**: setuju geser kanan = setujui langsung (dengan Urungkan 6 detik) tanpa konfirmasi? Alternatif: geser kanan hanya menandai, keputusan lewat tombol. Risiko: salah geser pada keputusan yang meneruskan ke HR/Direksi. Usulan: Urungkan hanya bisa **selama pengajuan belum diteruskan ke langkah berikutnya diproses** — butuh aturan baru di server (G4).
2. ❓ **Urungkan keputusan** belum ada di web. Perlu Action baru (`UndoStepDecision`, jendela 6–10 detik, hanya bila langkah berikutnya belum diputus)? Atau cukup tampilkan "Dikirim" tanpa Urungkan dan andalkan tombol (tidak ada risiko salah geser)?
3. ❓ **Tampilan default Persetujuan**: Tumpukan (mockup) atau Daftar (web saat ini)? Usulan: Tumpukan bila ≤ 10 menunggu, Daftar bila lebih; ikon pengalih mengingat pilihan terakhir.
4. ❓ **Cuti & lembur terkunci di API**: biarkan `/pengajuan/jenis` menyembunyikan jenis terkunci (perilaku sekarang) dan tampilkan ubin bergembok statis di klien, atau kirim jenis terkunci dengan `locked_reason` agar pesan HR berubah otomatis (disarankan, mockup mengasumsikan ini)?
5. ❓ **Penyetuju pengganti (delegasi)**: apakah keputusan tercatat "atas nama Rizky, mewakili Dimas" (tampilan mockup) — apakah audit sudah menyimpan `delegated_from_id`? Dan apakah pengajuan yang **sudah** menunggu Dimas dialihkan ke penerima saat delegasi dibuat (pekerjaan `requests:route-delegations`) atau hanya yang baru?
6. ❓ **Offline untuk pengajuan**: cukup draf lokal + banner (mockup), atau antrean offline kirim pengajuan di Fase 3 (idempoten via `client_id`)? Tembolok detail/jenis untuk dibaca offline belum digambar.
7. ❓ **Lampiran dari share sheet** (WhatsApp/Galeri → "Lampirkan ke RuangKerja"): masuk Tahap 2 (modul 12)? Perlu memilih pengajuan/draf tujuan.
8. ❓ **Pengajuan lembur/cuti baru setelah SOP**: kunci dibuka HR di web; apakah ponsel perlu menampilkan form cuti dengan saldo dan pemilihan pengganti (tidak digambar karena terkunci, tetapi akan dibutuhkan)? Disarankan membuat setelah SOP terbit agar mockup tidak usang.
9. ❓ **Dikirim ulang setelah ditolak**: web tidak punya "Ajukan ulang dari pengajuan ditolak". Tambahkan tombol "Buat pengajuan serupa" (salin isian ke form baru)? Tidak digambar.
10. ❓ **Setujui massal**: pertahankan di ponsel (dibatasi hanya mode Pilih di daftar) atau hanya desktop (`docs/PLATFORM.md` §3: "Aksi massal hanya desktop")? Mockup menyertakan karena web mobile sudah memilikinya.

## 05-tugas-workspace

1. **Penerima titipan dan Tunda**: web mengizinkan penerima memindah, merencanakan, berkomentar, mencentang, melampirkan — tetapi mengubah tenggat (Tunda) ditolak `update`. Apakah **Tunda** untuk tugas titipan disembunyikan, atau diubah jadi "Rencanakan" (hanya rencana pribadi)? Mockup menyembunyikannya dan menawarkan Rencanakan.
2. **Tombol Pindahkan di detail titipan**: detail mobile web menyembunyikan status track bila `can.edit=false`. Mockup menampilkan tombol **Pindahkan** (sesuai aturan 9 Okt "penerima tetap boleh move"). Setuju?
3. **Mention/rujukan/reaksi/sunting komentar**: kontrak komentar API sekarang teks polos. Apakah v1 Android memakai komentar kaya penuh (butuh perluasan kontrak) atau menunda (hanya teks + reaksi)? Mockup menggambarkan penuh.
4. **Offline**: PLATFORM §2.1 #5 menyatakan antrean offline untuk aplikasi native (Fase 3). Untuk tugas: antre hanya komentar/centang/pindah/selesai (dengan penanda "Menunggu kirim") atau baca-saja total?
5. **Kehadiran "sedang melihat" dan "Dibaca oleh"**: tanpa WebSocket di v1 — pakai polling 30 detik, atau tunda ke Reverb di aplikasi?
6. **Tampilan tersimpan lintas workspace** untuk Tugas saya: DATABASE memungkinkan (`workspace_id` null) tetapi web belum punya UI. Dibangun sekarang atau ditunda?
7. **Aturan otomasi di ponsel**: PLATFORM menyebut kartu + FAB + bottom sheet; mockup memberi pembuat aturan sheet layar penuh dan banner desktop untuk kondisi majemuk. Cukup baca + jeda di v1 dan pembuat di desktop?
8. **Pembuatan workspace (proyek) dari ponsel** dan **pengaturan workspace** (kolom status, label, anggota): hanya desktop (mockup: baca-saja + "Kirim tautan ke email saya")? Siapa yang boleh membuat proyek (staf)?
9. **Duplikat tugas** dan **template tugas saat buat**: ada di web desktop; masuk v1 ponsel atau tidak?
10. **Sheet tombol tengah vs daftar `/workspace`**: dua jalan masuk ke workspace (sheet cepat, daftar penuh). Pertahankan keduanya (sheet = pintasan, baris "Semua workspace" = daftar)?
11. Batas unggah ponsel (web 100 MB/file): sama? Kompres foto kamera otomatis (mis. ≤ 2 MB seperti selfie ≤ 200 KB)?
12. Deskripsi/komentar mengandung dokumen Tiptap: renderer WebView atau konversi node → komponen native (konsisten dengan modul Catatan 07)?

## 06-proyek-okr-monitoring

1. **Penempatan menu**: Portofolio, Manajemen, OKR, Riwayat laporan di tab *Lainnya* dan Monitoring sebagai tampilan Beranda Direksi — setuju? Alternatif: tab khusus "Pimpinan" untuk Direksi.
2. **Label "Tandai selesai"** pada keputusan Direksi (di web hanya menandai selesai, tidak menyetujui). Mockup desain lama bertuliskan "Setujui"; dipakai "Tandai selesai" + "Diskusikan" agar tidak menyiratkan persetujuan formal. Setuju?
3. **Layar "Proyek divisi" untuk Kepala Divisi (04)** tidak punya padanan web (web hanya grup "Proyek yang diikuti" di `/workspace` dan panel risiko di dashboard Kadiv). Dibangun sebagai usulan atau cukup memakai daftar workspace modul 05?
4. **Riwayat update proyek (09) dan tab Risiko teratasi (13-3)** adalah tampilan baru (web hanya menampilkan update terbaru + 4 riwayat dalam panel dan risiko terbuka). Lanjutkan sebagai tambahan presenter?
5. **Konfirmasi kirim laporan harian**: web mengirim langsung; ponsel diberi konfirmasi ringkas karena kirim memindahkan status tugas. Pertahankan atau samakan dengan web?
6. **Draf laporan offline**: `docs/PLATFORM.md` §2.1 butir 5 menunda antrean offline ke Fase 3. Android native adalah Fase 3 — izinkan draf laporan (bukan kirim) tersimpan lokal dan disinkron? Kirim tetap butuh koneksi.
7. **Seret-untuk-urut catatan tindakan** (butuh gesture-handler/reanimated) atau cukup Naikkan/Turunkan?
8. **Pustaka**: setuju menambah `react-native-svg`, bottom sheet (`@gorhom/bottom-sheet`), `datetimepicker`, `slider`, dan penyimpanan lokal? (AGENTS.md: paket baru butuh alasan di ringkasan.)
9. **Jadwal terdekat** pada Dashboard Manajemen: web mengirim `agenda: []` karena modul rapat dulu belum ada; sekarang modul Rapat ada — isi dari rapat `leadership` (mockup 16 menampilkannya) atau pertahankan kosong sampai web diperbarui?
10. **Pengingat**: notifikasi 16.30 (laporan), Jumat 15.00 (update proyek, check-in OKR) — jenis saluran Android dan jam tenang dipegang modul 10/12; cukup deep link seperti §4?
11. **Akses HR ke portofolio**: HR melihat Dashboard Manajemen tetapi tidak portofolio (web). Pertahankan?

## 07-catatan-notulensi

1. **Dikte (STT)** — Google (Android `SpeechRecognizer`/Web Speech; audio lewat server Google, kualitas id-ID terbaik, tanpa biaya server) **atau** self-host saja (WhisperLive; suara tetap di server perusahaan, latensi/kualitas lebih rendah). Teks consent di 23 ("Audio diproses oleh Google…") hanya berlaku bila pilihan **a**; keputusan tertunda di `docs/fitur/catatan-stt.md` §2.
2. **Editor kaya di aplikasi (Fase paritas)** — buat editor berformat lengkap (WebView, REST autosave tanpa kolaborasi, sebagian konten dibatasi ke whitelist) **atau** pertahankan teks polos + "Sunting di web" untuk catatan berformat. Mockup menggambarkan opsi pertama; opsi kedua berarti layar 11/12/21 hanya berlaku di web.
3. **Kolaborasi realtime di ponsel** — Yjs tidak ada di API v1. Terima polling + 409 + presence berbasis polling (26, USULAN) atau tambahkan klien Yjs/Hocuspocus di aplikasi?
4. **Cache offline daftar catatan** (02, USULAN) dan antrean simpan offline di aplikasi (dikaitkan keputusan antrean offline `docs/PLATFORM.md` §2.1 butir 5: "hanya native Fase 3").
5. **"Bagikan sebagai teks"/ekspor** (24, USULAN) — web belum punya ekspor catatan; cukup share teks polos lewat share sheet atau perlu PDF/Docs?
6. **Hapus catatan** — mockup memakai dialog Material (sesuai brief); web memakai bottom sheet. Tetap dialog di Android?
7. **Pil mode catat di Android** — tetap pil dalam-aplikasi saja, atau tambah notifikasi sementara (ongoing) agar mudah kembali dari luar aplikasi?
8. **Batas panjang catatan/tab** — web membatasi tab 2 tingkat; tidak ada batas jumlah catatan di UI. Perlu batas di ponsel (daftar panjang)?

## 08-rapat-kalender-video

1. **Video native atau tetap browser?** Mockup mengasumsikan ruang video **native** (LiveKit RN) karena ponsel adalah perangkat rapat utama. Alternatif bertahap: tahap A tetap membuka `/rapat/{id}/gabung` di browser (sekarang); tahap B native. Native membutuhkan development build, token endpoint API v1, dan foreground service.
2. **Bagikan layar dari ponsel** perlu foreground service + banner permanen. Apakah dibuka untuk semua peserta atau hanya penyelenggara/notulis?
3. **Notulen hidup di ponsel**: cukup mode autosave satu penyunting (sederhana), atau wajib kolaboratif (Yjs lewat WebView)? Rekomendasi: autosave dulu.
4. **Jadwalkan/ubah rapat dari ponsel** (form 10-12): masuk rilis berikutnya atau tetap web-only sambil ponsel baca + RSVP? Saat ini ponsel hanya baca + RSVP.
5. **Push notifikasi (FCM)** untuk `meeting.starting` dan "Rapat sudah dimulai — Gabung" — perlu FCM + `PUT /perangkat/{device}/push-token`. Tanpa push, pengingat hanya muncul saat aplikasi terbuka.
6. **Notulen otomatis**: opt-out (sekarang) atau opt-in; di ponsel kartu persetujuan wajib terlihat sebelum masuk (dipertahankan). Dasar hukum penyedia AI di luar Indonesia (privasi §10) masih terbuka.
7. **Orientasi**: izinkan lanskap hanya di ruang video (usulan) atau juga di layar lain (modul 12, tablet/lipat)?
8. **Layar menyala & baterai**: keep-awake otomatis selama di ruang; apakah perlu peringatan baterai ≤ 15 % (mockup 19) atau cukup sistem?
9. **Pembatalan satu kemunculan seri** dan **pemulihan versi notulen** belum ada di web; mockup hanya menandai "belum tersedia".
10. **Tamu eksternal** (email) belum melihat apa pun; tidak ada layar tamu di ponsel.
11. **Tab bar di layar rapat**: mockup mengikuti kode (Stack tanpa tab bar). Tetap seperti itu, atau tampilkan tab bar di agenda/kalender (seperti web PLATFORM)?

## 09-obrolan

1. **Gabung kanal publik**: pertahankan perilaku web (pesan pertama = gabung otomatis) atau tambah tombol "Gabung" eksplisit (mockup `06` memakainya)? Eksplisit butuh endpoint baru.
2. **Nama grup**: skema mengunci `name` null untuk DM/grup (CHECK), sehingga grup dinamai otomatis "Maya, Rizky +1". Apakah grup boleh diberi nama? (butuh ubah skema + `docs/DATABASE.md`).
3. **Bisukan**: cukup hidup/mati seperti web, atau durasi (1 jam, sampai besok, selamanya)? Mockup memakai hidup/mati.
4. **Keluar/arsip kanal & tambah anggota** setelah dibuat: belum ada di web; masuk cakupan ponsel atau tunggu web?
5. **Pencarian pesan lintas kanal** (mockup `03` #1 menampilkannya sebagai usulan): perlu endpoint pencarian server (`search_vector` sudah ada). Dibangun sekarang atau ditunda?
6. **Isi pesan di notifikasi & layar kunci**: tampilkan isi (kenyamanan) atau "Pesan baru dari Maya" (privasi, lebih aman bagi data kantor)? Mockup menampilkan isi dengan catatan "ikuti pengaturan sistem".
7. **Antrean offline untuk pesan**: PLATFORM §2.1 butir 5 menunda antrean offline ke Fase 3; mockup `13` #2 hanya "Gagal terkirim · Coba lagi". Setuju?
8. **Lampiran dari kamera/galeri**: dikerjakan bersama endpoint unggah ke folder Drive workspace (belum ada di web) atau hanya Drive dulu?
9. **Waktu baca per orang** ("Dibaca pukul 08.01") tidak ada di data (hanya pointer pesan terakhir); cukup nama pembaca seperti di web?
10. **Badge tab Obrolan**: jumlah *kanal* belum dibaca (web `chatUnread`) — dipertahankan, bukan jumlah pesan?

## 10-inbox-notifikasi-cari

1. **Pintu Quick add**: tombol tengah tab bar sudah dipakai Absen↔Workspace, jadi mockup memakai **tekan lama tombol tengah**. Kurang mudah ditemukan; alternatif: FAB "+" di Beranda/Tugas atau ikon "+" di app bar. Mana?
2. **Rapat di Buat cepat**: perlu `POST /rapat` yang belum ada. Masukkan sekarang (dengan endpoint baru) atau tampil sebagai pintasan ke web sampai modul 08 memutuskan? Mockup menampilkan banner celah.
3. **Notulensi cepat & dikte**: "Mulai notulensi cepat" mengikuti web; tile "Rekam catatan suara" dari desain lama tidak dimasukkan karena keputusan STT (Web Speech vs WhisperLive) belum diambil.
4. **Susunan hasil cari**: urutan baca atas→bawah dengan kolom cari di bawah (dipakai di mockup) vs urutan terbalik (paling relevan paling dekat jempol). Pilih satu.
5. **Tab "Belum dibaca"**: di web ia tab; di brief tab = Semua · Perlu tindakan · Diarsipkan, jadi "Belum dibaca" menjadi chip. Setuju? Sekalian: apakah tab Perlu tindakan menampilkan badge jumlah (dipakai) dan lencana ikon aplikasi memakai jumlah belum dibaca (dipakai) atau Perlu tindakan?
6. **Push sebagai kanal baru di matriks?** Mockup membuat push mengikuti kolom In-app (tanpa kolom keempat). Alternatif: kolom "Ponsel (push)" per event. Pilih satu sebelum B7 (`NotificationChannel` fcm).
7. **Jendela jam tenang** 07.00–17.30 tetap dikonfigurasi server (tidak ada kontrol per pengguna di web). Biarkan, atau beri pengaturan jam per pengguna?
8. **Detail pengumuman** tidak ada di web (hanya daftar + `?pilih=`). Mockup menambah layar detail (tutup dari beranda, hapus). Setuju atau cukup daftar?
9. **Swipe kanan**: web hanya menyediakan geser kiri (Dibaca + Arsipkan). Android sering memakai dua arah; tambah geser kanan = Dibaca?
10. **Jumlah saluran Android** (9 saluran + 1 teknis) cukup atau terlalu banyak? Menggabungkan "Pengingat harian" dan "Proyek, OKR & hiring" menjadi satu mengurangi pilihan di pengaturan sistem.
11. **Tandai semua dibaca** menandai semua notifikasi (bukan hanya yang tampil karena filter) dan tidak menyelesaikan "Perlu tindakan". Dialog konfirmasi ditambahkan; perlu?

## 11-hr-admin-hiring

1. **Q1 — PNG struktur organisasi di ponsel**: web merender di peramban (`modern-screenshot`). Di Android pilih (a) render di **server** (butuh endpoint + Chromium/GD di VPS — sebelumnya ditolak di `docs/fitur/ekspor-struktur-organisasi.md`), (b) render di perangkat dengan `react-native-view-shot` (paket baru, bagan besar berat), atau (c) **tunda** ekspor di ponsel dan tampilkan banner "Unduh PNG tersedia di desktop"? Mockup menggambar (a)/(b) sama.
2. **Q2 — Perluasan rekap di ponsel (D16)**: PLATFORM menyebut Rekap ◐ "ringkasan saja". Apakah daftar per karyawan + detail kalender boleh ada di ponsel? (Data sudah tersedia; hanya ekspor tetap desktop.)
3. **Q3 — Pengaturan lowongan di ponsel (D14)** boleh diubah, atau cukup baca-saja + "Kirim tautan ke email saya" seperti `docs/PLATFORM.md` ("Satu kolom, tombol simpan menempel di bawah" ✓)? Mockup menggambar edit penuh kecuali pemasangan Apps Script.
4. **Q4 — Tab "Wawancara" tunggal (D10)** vs enam tab (Profil/Jawaban/Checklist/Poin/Notulensi/Keputusan) seperti permintaan brief. Mockup memakai lima tab web dengan dua bagian di Wawancara.
5. **Q5 — Reset sandi akun Direksi/HR**: web mengizinkan HR menyetujui permintaan akun Direksi/HR tetapi sandi diatur hanya Super Admin. Konfirmasi bahwa **penyetujuan** reset tetap boleh HR (mockup 04-ketiga memperlihatkan itu, dengan catatan).
6. **Q6 — "Kirim tautan ke email saya"**: izinkan tautan hanya ke email akun sendiri (tanpa mengetik alamat lain) dan hanya path web ber-allowlist. Apakah email notifikasi perlu template/izin baru (preferensi `system`)?
7. **Q7 — Super Admin di ponsel**: API login saat ini **menolak Super Admin** (403 `two_factor_required`, TOTP belum didukung). Selama itu, layar khusus SA (audit, permintaan reset sandi milik SA, kelola semua) tidak tercapai di aplikasi. Prioritaskan TOTP di API atau biarkan SA web-saja?
8. **Q8 — Daftar Karyawan untuk Direksi**: web memberi `employees.view` ke Direksi (lihat saja). Konfirmasi Direksi boleh melihat daftar + profil (tanpa NIK/riwayat) di ponsel.
9. **Q9 — Data pelamar offline**: mockup melarang cache disk data pelamar. Setuju (konsekuensi: Hiring tidak bisa dibuka offline)?
10. **Q10 — Retensi selfie 12 bulan**: pesan "Selfie sudah dihapus sesuai masa retensi (12 bulan)" mengikuti `docs/PRD.md` §8; pastikan angka sesuai kebijakan terkini.

## 12-android-native

1. **Antrean check-in offline native** (berkas 13–14): aktifkan di Tahap 4.4 atau tetap "butuh koneksi"? Bila aktif: batas 72 jam, flag `offline`/`clock_skew`, siapa menyetujui?
2. **Setujui/Tolak langsung dari notifikasi & layar kunci** (butuh API putusan + autentikasi perangkat); "Urungkan 5 detik" ya/tidak? Revisi tetap hanya di aplikasi.
3. **Pengecualian baterai** (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`): disarankan **tidak** (kebijakan Play, FCM cukup); setuju memakai panduan per merek saja?
4. **Widget:** boleh menandai tugas selesai langsung dari widget? Sembunyikan judul tugas di widget (layar utama terlihat orang lain)? Setuju menambah `react-native-android-widget`?
5. **Rapat video:** tetap lewat peramban (v1) atau native (LiveKit RN, izin kamera/mikrofon, postur meja)?
6. **Orientasi:** tetap potret terkunci selain ruang video, atau buka lanskap untuk Tugas (berkas 20, usulan)?
7. **Shell tablet:** Rail 96dp di semua lebar ≥ 600dp (usulan) — berbeda dengan web ≥ 1024px (MenuBar + Dock). Setuju?
8. **Saluran notifikasi:** 7 saluran (termasuk Keamanan akun) dan semua pesan Rapat (undangan + mulai) berbunyi; atau pisahkan "Info rapat" berimportance DEFAULT?
9. **Ikon & Play:** adopsi usulan ikon adaptif (tile 56dp + monokrom)? Feature graphic **A** atau **B**? Nama pengembang dan kontak yang tampil di toko?
10. **Fallback biometrik** = kata sandi (bukan Google, karena login Google ditahan). Setuju memperbarui `docs/fitur/aplikasi-ponsel.md`?
11. **Play Console:** akun personal atau organisasi (D-U-N-S)? Penguji tertutup (siapa)? Akun **peninjau** produksi untuk "Akses aplikasi"?
12. **Mikrofon:** hapus `RECORD_AUDIO` sampai dikte/rapat native ada; dikte pakai STT apa (Web Speech di WebView tidak ada di RN; opsi WhisperLive tertunda)?
13. **Sentry/Crashlytics** (memengaruhi Data safety dan kebijakan privasi)?
14. **Retensi:** selfie 12 bulan (PRD) dan template wajah aktif + 30 hari — dinyatakan di kebijakan privasi sebelum submit?
15. **Pembaruan wajib:** kebijakan versi minimum (426) dan masa tenggang; prioritas Play per rilis siapa yang menetapkan?

## 13-fondasi-desain

1. **Paket baru** (AGENTS.md: tiap paket harus diberi alasan): `lucide-react-native` + `react-native-svg` (ikon identik web), `expo-linear-gradient` (gradien aksi/merek — RN tak punya), `expo-blur` (kaca tab bar/sheet), `expo-font` + `@expo-google-fonts/figtree` + `@expo-google-fonts/jetbrains-mono`, `react-native-reanimated` + `react-native-gesture-handler` (geser baris, sheet, gerak 120/180 ms), `@gorhom/bottom-sheet` (opsional). Setujui sebagai satu paket "fondasi UI"?
2. **Ikon**: pindah penuh ke Lucide (disarankan) atau tetap Ionicons dengan tabel padanan?
3. **Ikon tab**: Absen = `fingerprint` (Android) walau web `map-pin`; Lainnya = `menu` agar tidak bentrok dengan `layout-grid` (Workspace). Setuju?
4. **Radius**: samakan nama dengan skala web (migrasi `radius.sm→md` dst.) atau pertahankan skala RN sekarang? Disarankan migrasi.
5. **Tombol bahaya**: solid `--danger` (di dialog konfirmasi) atau tetap latar lembut seperti sekarang?
6. **Check-in tanpa sinyal**: ditolak (butuh verifikasi lokasi) atau diantre dengan penanda? Mockup menampilkan *ditolak*, antrean hanya untuk centang tugas/komentar/draf laporan/catatan.
7. **Ukuran huruf**: tab bar dibatasi 1,3× dan elemen lain sampai 200% — setuju?
8. **Mode Terang/Gelap manual**: tambahkan Tampilan (Ikuti sistem · Terang · Gelap) di Pengaturan (modul 01) dan sinkron ke profil?
9. **Mode lihat-saja**: kontrol disembunyikan bila bisa, nonaktif + banner bila tata letak menuntut — cukup?
10. **Peran/flag di profil** (`GET /saya`): izinkan menambah `roles`, `is_staff_only`, `features`, `can` ke kontrak API v1 (tugas backend kecil)?
11. **Reduced motion**: skala animator 0 dianggap "hapus animasi"; setuju fade ≤ 120 ms tetap diizinkan?
