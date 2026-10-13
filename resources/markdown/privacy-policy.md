<!--
  Kebijakan privasi {{aplikasi}}. Silakan sesuaikan teks ini dengan kebutuhan
  perusahaan. Setelah mengubah isinya, naikkan PRIVACY_POLICY_VERSION (dan
  PRIVACY_POLICY_DATE) di .env: setiap karyawan akan diminta menyetujui ulang
  sebelum check-in GPS + selfie berikutnya. Placeholder yang tersedia:
  {{aplikasi}}, {{perusahaan}}, {{versi}}, {{tanggal_berlaku}},
  {{retensi_selfie_bulan}}, {{kontak}}. Komentar ini tidak ditampilkan.
  Teks yang sama secara substansi juga ada di resources/views/privacy/public.blade.php
  (halaman publik tanpa login) dan resources/js/pages/attendance/privacy-policy.tsx
  (kebijakan data absensi); ubah ketiganya bersama-sama.
-->

## 1. Ringkasan

{{aplikasi}} adalah aplikasi kerja internal {{perusahaan}} (aplikasi web dan aplikasi Android) untuk absensi, pengajuan cuti/izin, kolaborasi tugas, dan pemantauan kerja **berbasis hasil**. Kebijakan ini menjelaskan data pribadi apa yang kami proses, untuk apa, siapa yang dapat mengaksesnya, berapa lama disimpan, dan hak Anda sesuai Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).

Prinsip kami: data dipakai untuk menjalankan pekerjaan dan kewajiban kepegawaian, **bukan** untuk memantau aktivitas Anda di luar itu. Anda dapat melihat dan mengunduh data diri Anda kapan saja di **Menu → Privasi & data saya**.

Tiga hal yang perlu Anda ketahui sejak awal:

- **Foto selfie absen Anda dikirim ke grup WhatsApp perusahaan.** Foto itu diberi cap jam, tanggal, dan lokasi (termasuk peta kecil) lalu dikirim bersama rencana atau laporan kerja Anda. Setelah terkirim, salinannya berada di luar kendali aplikasi (bagian 5).
- **Lokasi Anda ditampilkan di peta OpenStreetMap**, dan pada foto bercap koordinat Anda dapat dikirim ke layanan pencarian nama tempat OpenStreetMap (bagian 6).
- **Aplikasi Android menyimpan sebagian data, termasuk selfie dan lokasi yang belum terkirim, di ponsel Anda** agar dapat dipakai tanpa internet (bagian 7).

## 2. Pengendali data

Pengendali data adalah {{perusahaan}} selaku pemberi kerja. Pertanyaan dan permintaan terkait data pribadi dapat disampaikan kepada {{kontak}}.

## 3. Data yang kami proses

- **Identitas & kepegawaian:** nama, email kantor, nomor karyawan, NIK, nomor telepon, tanggal lahir, alamat, kontak darurat, divisi, tim, jabatan, atasan, mode kerja, tanggal bergabung, dan peran akses. NIK hanya ditampilkan tersamar.
- **Absensi:** jam masuk dan pulang, status harian, metode check-in, **lokasi GPS dan akurasinya hanya pada saat Anda menekan check-in/check-out**, foto selfie pada saat itu, alamat IP, jenis browser, penanda acak perangkat yang dibuat aplikasi, serta catatan lokasi/aktivitas saat WFH atau dinas. Di aplikasi Android juga tercatat sinyal lokasi palsu (mock location) bila terdeteksi, untuk ditinjau HR.
- **Rencana dan laporan kerja harian absensi:** poin rencana kerja yang Anda isi saat check-in dan poin laporan kerja saat check-out.
- **Pesan absensi di grup WhatsApp:** foto selfie bercap (jam, tanggal, nama tempat, peta kecil) dan keterangan berisi nama, tanggal, jam, lokasi, rencana atau laporan kerja, serta lama kerja (bagian 5).
- **Pengajuan & persetujuan:** pengajuan cuti, izin, sakit, lembur, koreksi absensi, dan dinas beserta alasan dan lampirannya; keputusan yang Anda berikan sebagai penyetuju.
- **Pekerjaan:** tugas, komentar, berkas dan dokumen yang Anda buat atau lampirkan di workspace.
- **Rapat & rapat video:** undangan, jawaban kehadiran, notulen dan tindak lanjut rapat; untuk rapat video, nama dan foto profil yang tampil kepada peserta lain serta **jam masuk dan keluar ruang rapat video** dan **lama bicara** Anda di ruang (untuk membantu pembagian giliran bicara, bukan penilaian kinerja; dihapus bersama transkrip). Gambar, suara, layar yang dibagikan, dan chat di dalam rapat video **tidak direkam**: semuanya hanya diteruskan server rapat perusahaan di Indonesia selama rapat berlangsung.
- **Rapat video dengan notulen otomatis** (hanya bila penyelenggara menyalakannya): suara Anda di rapat itu direkam sementara per peserta untuk dibuat transkrip, lalu **audionya dihapus segera setelah transkripsi**. Transkrip dan draf notulen buatan AI disimpan untuk notulis. Anda dapat memilih **"Jangan transkrip suara saya"** sebelum, selama, atau sesudah rapat; suara Anda lalu tidak direkam, rekaman yang terlanjur ada dihapus, dan ucapan Anda dihapus dari transkrip serta draf AI — kecuali bagian yang sudah dimasukkan notulis ke notulen rapat.
- **Data di ponsel (aplikasi Android):** salinan data terakhir yang Anda buka dan antrean perubahan yang belum terkirim, termasuk selfie, titik GPS, dan lampiran (bagian 7).
- **Akun:** riwayat login, pengaturan notifikasi dan tampilan, serta tautan akun Google Workspace kantor Anda.
- **Log audit:** catatan perubahan data penting dan akses ke data sensitif (misalnya siapa yang membuka selfie).

## 4. Tujuan dan dasar pemrosesan

- Mencatat kehadiran sesuai jadwal kerja dan menyusun rekap untuk penggajian (pelaksanaan perjanjian kerja dan kewajiban hukum ketenagakerjaan).
- Memastikan check-in dilakukan sendiri di lokasi yang benar. Lokasi dan selfie diproses **berdasarkan persetujuan eksplisit** Anda, yang diminta sebelum check-in pertama dan setiap kali versi kebijakan ini berubah.
- Menyampaikan kehadiran dan laporan kerja harian kepada anggota grup WhatsApp perusahaan untuk **memantau kehadiran dan laporan kerja**. Pengiriman foto selfie bercap dan lokasi ke grup itu termasuk dalam persetujuan eksplisit lokasi & selfie di atas, dan dijelaskan pada layar persetujuan sebelum Anda menyetujuinya.
- Menampilkan peta dan nama tempat pada layar Absen dan pada foto bercap (bagian 6).
- Menyimpan data sementara di ponsel agar aplikasi Android tetap dapat dipakai tanpa internet dan perubahan Anda tidak hilang (bagian 7).
- Memproses pengajuan dan persetujuan, mengelola pekerjaan tim, dan mengirim notifikasi yang Anda atur.
- Menjalankan rapat kerja (termasuk rapat video) dan mencatat kehadiran rapat untuk notulen. Kehadiran rapat tidak mengubah absensi harian Anda.
- Menjaga keamanan sistem dan menelusuri penyalahgunaan (log audit).

Data **tidak** dipakai untuk menilai produktivitas dari aktivitas di luar hasil kerja, tidak dijual, dan tidak dibagikan kepada pihak lain selain yang dijelaskan dalam kebijakan ini: anggota grup WhatsApp (bagian 5) dan penyedia layanan (bagian 8).

## 5. Pengiriman absensi ke grup WhatsApp

Setiap kali Anda check-in atau check-out, aplikasi mengirim pesan otomatis ke grup WhatsApp perusahaan untuk laporan harian (grup "DAILY REPORT"). Pesan dikirim lewat gerbang WhatsApp (Evolution API) yang dijalankan di server perusahaan sendiri. Kegagalan pengiriman tidak memengaruhi absensi Anda.

**Yang dikirim**

- **Check-in/check-out dengan GPS + selfie (web dan Android):** foto selfie Anda yang diberi cap berisi jam, hari dan tanggal, nama tempat, serta **peta kecil dengan penanda posisi Anda** (cakupan sekitar 600 meter). Keterangan foto berisi nama Anda, tanggal, jam, lokasi (nama kantor, "WFH", atau jarak dari kantor terdekat bila Anda di luar kantor), **rencana kerja** (saat masuk) atau **laporan kerja** dan lama kerja (saat pulang), serta tanda "absen offline" bila Anda absen tanpa internet. Angka koordinat tidak ditulis di pesan, tetapi peta pada foto menunjukkan sekitar tempat Anda berada, **termasuk saat WFH atau bertugas di luar kantor** (misalnya sekitar rumah Anda).
- **Check-in lewat kiosk QR atau tanpa selfie:** hanya pesan teks berisi nama, tanggal, jam, dan lokasi.

Foto bercap dibuat sementara di memori server untuk dikirim; salinan bercap itu tidak disimpan di server. Selfie asli tetap disimpan di penyimpanan privat aplikasi (bagian 9).

**Siapa yang menerima.** Penerimanya adalah seluruh anggota grup tersebut. Daftar anggota grup ditetapkan perusahaan di WhatsApp, bukan di aplikasi ini, dan tidak dapat Anda ubah. Perusahaan bertanggung jawab agar anggota grup hanya pihak yang berkepentingan memantau kehadiran dan laporan kerja.

**Setelah terkirim, di luar kendali aplikasi.** Pesan dan foto yang sudah terkirim tersimpan pada layanan WhatsApp (Meta Platforms) dan pada perangkat setiap anggota grup. Aplikasi tidak dapat menarik kembali, membatasi penyimpanan, atau mencegah anggota grup menyimpan, meneruskan, atau menangkap layar pesan itu. Batas penyimpanan selfie {{retensi_selfie_bulan}} bulan pada bagian 9 **tidak berlaku** untuk salinan di WhatsApp. WhatsApp memproses data menurut ketentuannya sendiri dan dapat memprosesnya di luar Indonesia. Permintaan penghapusan pesan dari grup dapat disampaikan kepada {{kontak}}; penghapusan itu tidak dapat menjangkau salinan yang sudah disimpan anggota grup.

**Bila Anda keberatan.** Anda dapat mencabut persetujuan lokasi & selfie (bagian 11); check-in GPS + selfie lalu tidak dapat dilakukan dan HR akan mengatur cara absensi lain. Catatan: absensi lewat kiosk QR tetap mengirim pesan teks (nama, jam, lokasi) ke grup yang sama.

## 6. Peta, lokasi, dan layanan OpenStreetMap

Koordinat GPS Anda dipakai untuk menghitung jarak ke lokasi kantor dan untuk menampilkan peta. Peta dan nama tempat berasal dari **OpenStreetMap**, layanan yang dikelola OpenStreetMap Foundation di luar Indonesia (data berlisensi ODbL, © OpenStreetMap contributors). Cara kerjanya:

- **Peta di layar Absen aplikasi Android:** ponsel Anda tidak menghubungi OpenStreetMap. Ponsel meminta potongan peta (ubin) ke server RuangKerja, lalu server meneruskan permintaan ke OpenStreetMap hanya dengan **nomor ubin** (tingkat zoom, kolom, baris), memakai identitas aplikasi (User-Agent "RuangKerja/1.0") dan alamat IP server kami. Koordinat Anda, nama Anda, dan alamat IP ponsel Anda tidak dikirim. Server menyimpan salinan ubin selama 7 hari agar tidak diminta berulang.
- **Peta di web:** peramban Anda mengambil ubin peta langsung dari OpenStreetMap, sehingga OpenStreetMap menerima alamat IP peramban Anda dan nomor ubin untuk daerah yang Anda lihat.
- **Foto selfie bercap untuk grup WhatsApp:** server mengambil ubin peta di sekitar posisi Anda dari OpenStreetMap (hanya nomor ubin). Bila Anda berada di luar lokasi kantor dan bukan WFH, server juga **mengirim koordinat GPS Anda** ke layanan pencarian nama tempat OpenStreetMap (Nominatim) untuk mendapat nama kelurahan atau kecamatan yang dicantumkan pada foto. Permintaan berasal dari server (dengan identitas aplikasi dan alamat IP server), tanpa nama atau identitas Anda; hasil nama tempat disimpan di server 24 jam agar tidak diminta berulang. Bila pencarian atau peta gagal, foto tetap dikirim tanpa peta atau dengan teks lokasi saja. Perusahaan dapat mematikan peta dan pencarian nama tempat pada foto bercap.

## 7. Aplikasi Android dan penyimpanan data di ponsel (mode offline)

Aplikasi Android dapat dipakai tanpa internet. Untuk itu aplikasi menyimpan data di ponsel Anda:

- **Salinan data baca:** halaman yang terakhir Anda buka (misalnya beranda, tugas dan workspace, catatan, rapat, kalender, pengajuan, inbox, obrolan, pengumuman, laporan harian, absensi hari ini dan riwayat, serta daftar nama rekan kerja) agar tetap terbaca saat offline. Salinan dibatasi 25 MB dan paling lama 14 hari. Data berikut **tidak** disimpan: rekrutmen (hiring), administrasi dan data HR, persetujuan, pengaturan privasi, foto selfie yang sudah tersimpan di server, dan transkrip atau video rapat.
- **Antrean perubahan:** yang Anda tulis saat offline (absen masuk/pulang, tugas, komentar, catatan, laporan harian, pengajuan) disimpan di ponsel sampai terkirim. Antrean berisi isi tulisan Anda, dan untuk absen juga **foto selfie dan titik GPS**, serta lampiran (maks. 5 MB per berkas). Setelah terkirim, item dihapus dari ponsel.
- **Enkripsi:** semua data di atas disimpan dalam basis data terenkripsi (SQLCipher). Kuncinya acak dan disimpan di penyimpanan aman perangkat Android. Bila perangkat tidak mendukung, data disimpan di folder privat aplikasi tanpa enkripsi tambahan, dan status ini ditampilkan di Pengaturan › Penyimpanan offline. Kami menyarankan Anda memakai kunci layar pada ponsel.
- **Absen offline:** waktu absen memakai **jam ponsel saat tombol absen ditekan**. Absen seperti ini ditandai "absen offline" dan masuk daftar peninjauan HR (jam ponsel dapat diubah, sehingga sistem memeriksanya). Batasnya **72 jam**; lewat itu absen tidak dapat disinkronkan dan Anda perlu mengajukan koreksi absensi.
- **Pengiriman otomatis:** antrean dikirim sendiri begitu sambungan internet tersedia, termasuk oleh tugas latar belakang sistem Android bila diizinkan perangkat Anda. Pengiriman ulang tidak membuat satu aksi tercatat dua kali.
- **Penghapusan:** keluar dari akun, atau akun dinonaktifkan, menghapus seluruh data aplikasi di ponsel, termasuk antrean yang belum terkirim (aplikasi memperingatkan lebih dulu). Bila sesi Anda berakhir sendiri, hanya salinan data baca yang dihapus dan antrean dipertahankan sampai Anda masuk lagi. Anda juga dapat menghapus salinan data baca kapan saja di **Pengaturan → Penyimpanan offline → Hapus data offline**; antrean yang belum terkirim tidak ikut terhapus (hapus lewat layar Antrean sinkron). Mencopot aplikasi menghapus semuanya.

## 8. Siapa yang dapat mengakses

- **Anda sendiri** — seluruh data diri Anda di halaman Data Saya.
- **Atasan langsung dan Kepala Divisi** — data absensi dan pengajuan tim yang dipimpinnya.
- **HR** — data kepegawaian dan absensi seluruh karyawan untuk keperluan administrasi.
- **Direksi** — ringkasan dan rekap di aplikasi, bukan selfie.
- **Super Admin** — pengaturan sistem; tidak dapat melihat selfie maupun isi workspace pribadi.
- **Anggota grup WhatsApp laporan harian** — foto selfie bercap, lokasi, serta rencana dan laporan kerja Anda, sebagaimana dijelaskan pada bagian 5. Hak akses ini ditetapkan lewat keanggotaan grup di WhatsApp, bukan lewat peran di aplikasi.

Di dalam aplikasi, selfie hanya dibuka lewat tautan sementara (berlaku 5 menit) oleh Anda, atasan langsung, dan HR; setiap akses oleh orang lain tercatat di log audit. Aturan ini tidak berlaku untuk salinan yang sudah dikirim ke grup WhatsApp.

Penyedia layanan yang memproses data atas nama {{perusahaan}}:

- Penyedia server dan penyimpanan objek di Indonesia (aplikasi, basis data, selfie, lampiran, cadangan, server rapat video, dan gerbang WhatsApp milik perusahaan).
- Google Workspace (login, Drive, dokumen).
- **WhatsApp (Meta Platforms)** — menerima dan menyimpan pesan absensi yang dikirim ke grup (bagian 5); dapat memproses data di luar Indonesia dan di luar kendali perusahaan.
- **OpenStreetMap (OpenStreetMap Foundation)** — menerima nomor ubin peta dan, untuk foto bercap di luar kantor, koordinat GPS untuk pencarian nama tempat (bagian 6); berada di luar Indonesia.
- Bila ringkasan AI notulen otomatis diaktifkan admin, teks transkrip rapat beserta nama tampilan pembicara, judul, dan agenda rapat (tanpa email atau nomor identitas) dikirim ke penyedia AI yang ditetapkan (bawaan: DeepSeek) yang **memproses data di luar Indonesia**, hanya untuk menyusun draf notulen.

## 9. Penyimpanan dan retensi

- **Selfie** disimpan di penyimpanan privat aplikasi dan **dihapus otomatis setelah {{retensi_selfie_bulan}} bulan**. Ini tidak berlaku untuk salinan yang sudah terkirim ke grup WhatsApp (bagian 5) maupun yang tersimpan sementara di ponsel sebelum terkirim (bagian 7).
- **Pesan di grup WhatsApp** (foto bercap dan keterangannya) tidak dikelola aplikasi; lama penyimpanannya mengikuti WhatsApp dan perangkat anggota grup.
- **Nama tempat dan ubin peta untuk foto bercap** disimpan sementara di server (nama tempat dan ubin peta foto bercap 24 jam; ubin peta layar Absen Android 7 hari). Foto bercap sendiri tidak disimpan.
- **Data di ponsel (aplikasi Android):** salinan data baca paling lama 14 hari; antrean sampai terkirim, dibuang, atau Anda keluar dari akun (bagian 7).
- **Catatan kehadiran, pengajuan, dan data kepegawaian** disimpan selama hubungan kerja dan sesudahnya sepanjang diwajibkan peraturan ketenagakerjaan dan perpajakan.
- **Data rapat** (notulen, tindak lanjut, kehadiran rapat video) disimpan bersama rapatnya dan hanya dapat dilihat penyelenggara, notulis, dan peserta rapat itu; rapat pimpinan juga dapat dibaca Direksi, HR, dan Super Admin.
- **Transkrip rapat (notulen otomatis)** dihapus otomatis setelah 90 hari (dapat diatur admin) dan hanya bisa dibuka peserta rapat; audio rapat tidak disimpan.
- **Cadangan basis data** disimpan terenkripsi selama 30 hari.
- **Log audit** disimpan untuk keperluan keamanan dan pemeriksaan.

## 10. Keamanan

Akses dilindungi login akun kantor, koneksi HTTPS, pembatasan akses berbasis peran, autentikasi dua langkah untuk administrator, dan pencatatan audit. Token Google dan rahasia aplikasi disimpan terenkripsi. Gerbang WhatsApp berjalan di server perusahaan dan tidak dibuka ke internet publik. Data offline di ponsel disimpan terenkripsi (bagian 7).

## 11. Hak Anda

- **Melihat dan mengunduh** data diri Anda (Excel atau PDF) di **Menu → Privasi & data saya**.
- **Memperbaiki** data yang keliru: ajukan koreksi absensi lewat Pengajuan, atau hubungi {{kontak}} untuk data kepegawaian.
- **Mencabut persetujuan** lokasi & selfie kapan saja di halaman Data Saya atau Absensi. Setelah dicabut, check-in GPS + selfie tidak dapat dilakukan sampai Anda menyetujui lagi (sehingga foto selfie Anda tidak lagi dikirim ke grup WhatsApp); HR akan diberi tahu dan mengatur cara absensi lain (misalnya kiosk QR atau koreksi manual). Pencabutan tidak menarik kembali pesan yang sudah terkirim ke grup.
- **Meminta penghapusan atau pembatasan** pemrosesan, sepanjang tidak bertentangan dengan kewajiban hukum yang mengharuskan data disimpan. Sampaikan permintaan kepada {{kontak}}.
- **Menghapus data offline di ponsel** kapan saja di Pengaturan → Penyimpanan offline, atau dengan keluar dari akun.
- **Mengajukan keberatan atau pengaduan** kepada {{kontak}}, atau kepada lembaga pelindungan data pribadi sesuai UU PDP.

## 12. Perubahan kebijakan

Bila kebijakan ini berubah, nomor versinya dinaikkan dan Anda akan diminta menyetujui ulang sebelum check-in GPS + selfie berikutnya. Versi yang berlaku ditampilkan di bagian atas halaman ini.

**Versi 2.0 (14 Oktober 2026)** menambahkan penjelasan tentang pengiriman foto selfie bercap dan keterangan absensi ke grup WhatsApp perusahaan (bagian 5), penggunaan peta dan layanan OpenStreetMap (bagian 6), serta penyimpanan data terenkripsi di ponsel untuk mode offline aplikasi Android (bagian 7).
