<!--
  Kebijakan privasi {{aplikasi}}. Silakan sesuaikan teks ini dengan kebutuhan
  perusahaan. Setelah mengubah isinya, naikkan PRIVACY_POLICY_VERSION (dan
  PRIVACY_POLICY_DATE) di .env: setiap karyawan akan diminta menyetujui ulang
  sebelum check-in GPS + selfie berikutnya. Placeholder yang tersedia:
  {{aplikasi}}, {{perusahaan}}, {{versi}}, {{tanggal_berlaku}},
  {{retensi_selfie_bulan}}, {{kontak}}. Komentar ini tidak ditampilkan.
-->

## 1. Ringkasan

{{aplikasi}} adalah aplikasi kerja internal {{perusahaan}} untuk absensi, pengajuan cuti/izin, kolaborasi tugas, dan pemantauan kerja **berbasis hasil**. Kebijakan ini menjelaskan data pribadi apa yang kami proses, untuk apa, siapa yang dapat mengaksesnya, berapa lama disimpan, dan hak Anda sesuai Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).

Prinsip kami: data dipakai untuk menjalankan pekerjaan dan kewajiban kepegawaian, **bukan** untuk memantau aktivitas Anda di luar itu. Anda dapat melihat dan mengunduh data diri Anda kapan saja di **Menu → Privasi & data saya**.

## 2. Pengendali data

Pengendali data adalah {{perusahaan}} selaku pemberi kerja. Pertanyaan dan permintaan terkait data pribadi dapat disampaikan kepada {{kontak}}.

## 3. Data yang kami proses

- **Identitas & kepegawaian:** nama, email kantor, nomor karyawan, NIK, nomor telepon, tanggal lahir, alamat, kontak darurat, divisi, tim, jabatan, atasan, mode kerja, tanggal bergabung, dan peran akses. NIK hanya ditampilkan tersamar.
- **Absensi:** jam masuk dan pulang, status harian, metode check-in, **lokasi GPS dan akurasinya hanya pada saat Anda menekan check-in/check-out**, foto selfie pada saat itu, alamat IP, jenis browser, penanda acak perangkat yang dibuat aplikasi, serta catatan lokasi/aktivitas saat WFH atau dinas.
- **Pengajuan & persetujuan:** pengajuan cuti, izin, sakit, lembur, koreksi absensi, dan dinas beserta alasan dan lampirannya; keputusan yang Anda berikan sebagai penyetuju.
- **Pekerjaan:** tugas, komentar, berkas dan dokumen yang Anda buat atau lampirkan di workspace.
- **Rapat & rapat video:** undangan, jawaban kehadiran, notulen dan tindak lanjut rapat; untuk rapat video, nama dan foto profil yang tampil kepada peserta lain serta **jam masuk dan keluar ruang rapat video**. Gambar, suara, layar yang dibagikan, dan chat di dalam rapat video **tidak direkam**: semuanya hanya diteruskan server rapat perusahaan di Indonesia selama rapat berlangsung.
- **Rapat video dengan notulen otomatis** (hanya bila penyelenggara menyalakannya): suara Anda di rapat itu direkam sementara per peserta untuk dibuat transkrip, lalu **audionya dihapus segera setelah transkripsi**. Transkrip dan draf notulen buatan AI disimpan untuk notulis. Anda dapat memilih **"Jangan transkrip suara saya"** sebelum, selama, atau sesudah rapat; suara Anda lalu tidak direkam, rekaman yang terlanjur ada dihapus, dan ucapan Anda dihapus dari transkrip serta draf AI — kecuali bagian yang sudah dimasukkan notulis ke notulen rapat.
- **Akun:** riwayat login, pengaturan notifikasi dan tampilan, serta tautan akun Google Workspace kantor Anda.
- **Log audit:** catatan perubahan data penting dan akses ke data sensitif (misalnya siapa yang membuka selfie).

## 4. Tujuan dan dasar pemrosesan

- Mencatat kehadiran sesuai jadwal kerja dan menyusun rekap untuk penggajian (pelaksanaan perjanjian kerja dan kewajiban hukum ketenagakerjaan).
- Memastikan check-in dilakukan sendiri di lokasi yang benar. Lokasi dan selfie diproses **berdasarkan persetujuan eksplisit** Anda, yang diminta sebelum check-in pertama dan setiap kali versi kebijakan ini berubah.
- Memproses pengajuan dan persetujuan, mengelola pekerjaan tim, dan mengirim notifikasi yang Anda atur.
- Menjalankan rapat kerja (termasuk rapat video) dan mencatat kehadiran rapat untuk notulen. Kehadiran rapat tidak mengubah absensi harian Anda.
- Menjaga keamanan sistem dan menelusuri penyalahgunaan (log audit).

Data **tidak** dipakai untuk menilai produktivitas dari aktivitas di luar hasil kerja, tidak dijual, dan tidak dibagikan ke pihak lain di luar penyedia layanan yang disebut di bawah.

## 5. Siapa yang dapat mengakses

- **Anda sendiri** — seluruh data diri Anda di halaman Data Saya.
- **Atasan langsung dan Kepala Divisi** — data absensi dan pengajuan tim yang dipimpinnya.
- **HR** — data kepegawaian dan absensi seluruh karyawan untuk keperluan administrasi.
- **Direksi** — ringkasan dan rekap, bukan selfie.
- **Super Admin** — pengaturan sistem; tidak dapat melihat selfie maupun isi workspace pribadi.

Selfie hanya dibuka lewat tautan sementara (berlaku 5 menit) oleh Anda, atasan langsung, dan HR; setiap akses oleh orang lain tercatat di log audit.

Penyedia layanan yang memproses data atas nama {{perusahaan}}: penyedia server dan penyimpanan objek di Indonesia (aplikasi, basis data, selfie, lampiran, cadangan, server rapat video) dan Google Workspace (login, Drive, dokumen). Bila ringkasan AI notulen otomatis diaktifkan admin, teks transkrip rapat beserta nama tampilan pembicara, judul, dan agenda rapat (tanpa email atau nomor identitas) dikirim ke penyedia AI yang ditetapkan (bawaan: DeepSeek) yang **memproses data di luar Indonesia**, hanya untuk menyusun draf notulen.

## 6. Penyimpanan dan retensi

- **Selfie** disimpan di penyimpanan privat dan **dihapus otomatis setelah {{retensi_selfie_bulan}} bulan**.
- **Catatan kehadiran, pengajuan, dan data kepegawaian** disimpan selama hubungan kerja dan sesudahnya sepanjang diwajibkan peraturan ketenagakerjaan dan perpajakan.
- **Data rapat** (notulen, tindak lanjut, kehadiran rapat video) disimpan bersama rapatnya dan hanya dapat dilihat penyelenggara, notulis, dan peserta rapat itu; rapat pimpinan juga dapat dibaca Direksi, HR, dan Super Admin.
- **Transkrip rapat (notulen otomatis)** dihapus otomatis setelah 90 hari (dapat diatur admin) dan hanya bisa dibuka peserta rapat; audio rapat tidak disimpan.
- **Cadangan basis data** disimpan terenkripsi selama 30 hari.
- **Log audit** disimpan untuk keperluan keamanan dan pemeriksaan.

## 7. Keamanan

Akses dilindungi login akun kantor, koneksi HTTPS, pembatasan akses berbasis peran, autentikasi dua langkah untuk administrator, dan pencatatan audit. Token Google dan rahasia aplikasi disimpan terenkripsi.

## 8. Hak Anda

- **Melihat dan mengunduh** data diri Anda (Excel atau PDF) di **Menu → Privasi & data saya**.
- **Memperbaiki** data yang keliru: ajukan koreksi absensi lewat Pengajuan, atau hubungi {{kontak}} untuk data kepegawaian.
- **Mencabut persetujuan** lokasi & selfie kapan saja di halaman Data Saya atau Absensi. Setelah dicabut, check-in GPS + selfie tidak dapat dilakukan sampai Anda menyetujui lagi; HR akan diberi tahu dan mengatur cara absensi lain (misalnya kiosk QR atau koreksi manual).
- **Meminta penghapusan atau pembatasan** pemrosesan, sepanjang tidak bertentangan dengan kewajiban hukum yang mengharuskan data disimpan. Sampaikan permintaan kepada {{kontak}}.
- **Mengajukan keberatan atau pengaduan** kepada {{kontak}}, atau kepada lembaga pelindungan data pribadi sesuai UU PDP.

## 9. Perubahan kebijakan

Bila kebijakan ini berubah, nomor versinya dinaikkan dan Anda akan diminta menyetujui ulang sebelum check-in GPS + selfie berikutnya. Versi yang berlaku ditampilkan di bagian atas halaman ini.
