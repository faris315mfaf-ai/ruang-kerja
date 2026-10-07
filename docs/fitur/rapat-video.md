# Rapat video & notulen otomatis: panduan pengguna

> **Status 7 Okt 2026.** **Video RuangKerja** (rapat video bawaan di server sendiri) sudah **nyata** di balik `FEATURE_MEETINGS` + `LIVEKIT_*`. Tampilannya sedang diganti ke arah desain **C "Notulen Hidup"** (pemilik, 7 Okt 2026): dokumen notulen menjadi pusat layar, video menjadi pita di atas. **Notulen otomatis** (transkrip setelah rapat + draf notulen dari AI) sedang dibangun; **subtitle langsung** adalah tahap 2. Langkah yang bergantung pada pekerjaan yang belum selesai diberi catatan **Menunggu**. Privasi: [rapat-video-privasi](rapat-video-privasi.md) · operasional: `docs/deploy/RAPAT-VIDEO.md` · jadwal, notulen & kalender: [rapat-kalender](rapat-kalender.md) · indeks: [README](README.md).

| Saya… | Baca |
|---|---|
| Diundang rapat video | [§2 Untuk semua peserta](#2-untuk-semua-peserta) |
| Notulis rapat | [§3 Untuk notulis](#3-untuk-notulis) |
| Penyelenggara rapat | [§4 Untuk penyelenggara](#4-untuk-penyelenggara) |
| HR atau pimpinan | [§5 Untuk HR & pimpinan](#5-untuk-hr--pimpinan) |
| Mengalami masalah | [§7 Mengatasi masalah](#7-mengatasi-masalah) |

## 1. Sekilas

- **Video RuangKerja** adalah tempat rapat bawaan: tanpa tautan Meet/Zoom, langsung dari detail rapat di RuangKerja, berjalan di server rapat perusahaan di Indonesia. Rapat **tidak direkam**; chat tidak disimpan.
- **Notulen Hidup**: selama rapat, notulen yang ditulis bersama terbuka di tengah layar, dengan bagian per agenda, keputusan, dan tindak lanjut yang bisa langsung menjadi tugas. Wajah peserta tetap terlihat di pita atas.
- **Notulen otomatis** (bila dinyalakan penyelenggara): setelah rapat, suara peserta ditulis menjadi transkrip berlabel nama, lalu AI menyiapkan draf ringkasan, keputusan, dan usulan tindak lanjut untuk diperiksa notulis. Setiap orang boleh menolak suaranya ditranskrip.
- **Kehadiran** tercatat otomatis dari ruang video (jam masuk & keluar).

## 2. Untuk semua peserta

### 2.1 Sebelum rapat: perangkat

- **Browser**: Chrome, Edge, Firefox, atau Safari versi terbaru, di laptop atau ponsel. Browser lain menampilkan *"Browser ini belum didukung untuk rapat video…"*.
- **Jaringan**: minimal ±3 Mbps unduh dan ±1,5 Mbps unggah. Wi-Fi kantor dan 4G sama-sama bisa; jaringan yang memblokir UDP tetap bisa masuk lewat port 443 (sedikit lebih lambat).
- **Suara**: pakai headset atau earphone agar tidak terjadi gema; matikan mikrofon saat tidak bicara.
- Tutup aplikasi rapat lain (Zoom, Teams) yang memakai kamera/mikrofon.

### 2.2 Gabung rapat

1. Buka rapat dari **Rapat** (agenda), **Kalender**, notifikasi **"Rapat dimulai"** (tombol **Gabung**), atau Inbox.
2. Di detail rapat, kartu video menampilkan siapa yang sudah di ruang ("N orang di ruang rapat"). Tekan **Gabung rapat video**.
   - Ruang dibuka **15 menit sebelum** rapat mulai sampai **2 jam sesudah** rapat selesai. Sebelum itu kartu menampilkan *"Ruang dibuka 08.45"* dan hitung mundur (*"Dibuka dalam 12 menit"*). Penyelenggara bisa masuk kapan saja.
   - Hanya orang yang **diundang** (penyelenggara, notulis, peserta) yang bisa masuk. Rapat yang dibatalkan tidak bisa dibuka.
3. **Layar pra-gabung**: izinkan kamera dan mikrofon saat browser bertanya. Periksa pratinjau kamera, nyalakan/matikan mikrofon dan kamera, pilih perangkat (⚙). Pilihan perangkat diingat di browser itu.
4. Bila **Notulen otomatis aktif**, ada kartu pemberitahuan: *"Suara Anda ditranskrip setelah rapat, audio langsung dihapus. Transkrip hanya untuk peserta, 90 hari."* Nyalakan **Jangan transkrip suara saya** bila Anda tidak mau suaranya ditranskrip (§2.5).
5. Tekan **Masuk dan buka notulen**.

> **Menunggu (`claude/rapat-ui`):** tombol & teks pra-gabung baru ("Masuk dan buka notulen", pilihan notulen untuk notulis, kartu persetujuan) belum ada di `main`; layar saat ini memakai tombol **Gabung sekarang**. Periksa ulang teks persis setelah UI baru digabung.

### 2.3 Di ruang rapat

Tata letak desktop (rancangan C):

| Bagian | Isi |
|---|---|
| Pita video (atas) | wajah semua peserta; yang sedang bicara diberi bingkai dan ubin lebih lebar |
| Tengah | **notulen rapat** yang sedang ditulis bersama; kursor rekan yang mengetik terlihat |
| Kiri | daftar **Bagian** (agenda) untuk melompat |
| Kanan | **Waktu bicara** per orang (§3.3) |
| Bawah tengah | bilah kontrol: mikrofon, kamera, bagikan layar, angkat tangan, chat, **Keluar** |

- **Presentasi**: saat seseorang membagikan layar, layar itu tampil besar di kiri dan notulen mengecil ke kolom kanan; notulen **tetap bisa diketik**.
- **Kehadiran**: panel kanan menampilkan siapa yang sudah masuk (jam masuk, tanda terlambat) dan siapa yang belum (§4.3).
- **Ponsel**: dua tab **Video | Notulen** (titik merah muda pada tab Notulen menandai ada perubahan), bilah kontrol di bawah. Subtitle tampil di atas bilah kontrol.
- **Chat** dan **angkat tangan** hanya berlaku selama rapat; chat tidak disimpan.
- **Suara tidak terdengar** saat baru masuk? Tekan **Aktifkan suara rapat** (browser memblokir suara sampai Anda mengklik halaman).
- Koneksi putus sebentar → *"Menyambungkan ulang…"*, lalu kembali sendiri.

Pintasan keyboard di layar saat ini: ⌘/Ctrl+D mikrofon, ⌘/Ctrl+E kamera, ⌘/Ctrl+Alt+C chat, ⌘/Ctrl+Alt+P daftar orang, ⌘/Ctrl+Alt+H angkat tangan.

> **Menunggu (`claude/rapat-ui`):** ruang rapat arah C (pita video, notulen di tengah, Bagian, Waktu bicara, tab ponsel) dan apakah pintasan, tata letak, berbagi layar dengan audio tab, dan daftar orang tetap sama. Gambar layar: §9.

### 2.4 Subtitle

Bila subtitle aktif, kotak di atas bilah kontrol menampilkan ucapan terbaru dengan **nama pembicara**, dan chip **"Notulen otomatis aktif · Subtitle ID"** terlihat di ruang. Tanpa subtitle, kotak itu tidak muncul sama sekali.

> **Menunggu (tahap 2, server GPU):** subtitle langsung belum tersedia. Ruang rapat baru sudah disiapkan untuk menampilkannya begitu server mengirim teks (`docs/deploy/RAPAT-VIDEO.md` §10).

### 2.5 Notulen otomatis dan menolak transkrip

- Notulen otomatis hanya berjalan bila **penyelenggara menyalakannya** untuk rapat itu. Anda selalu diberi tahu sebelum masuk dan melihat chip "Notulen otomatis aktif" di ruang.
- Yang diproses hanya **suara mikrofon** (bukan video, bukan layar). Audio disimpan sementara di server rapat, **dihapus segera setelah ditulis menjadi teks**, transkrip hanya untuk peserta rapat dan disimpan 90 hari.
- **Jangan transkrip suara saya**: suara Anda tidak pernah dikirim ke mesin transkripsi. Bila Anda menyalakannya **di tengah rapat**, rekaman suara Anda yang sudah terkumpul dihapus dan kalimat Anda tidak ada di transkrip. Peserta lain tetap mendengar Anda seperti biasa.
- Penjelasan lengkap & hak Anda: [rapat-video-privasi](rapat-video-privasi.md).

> **Menunggu (`claude/rapat-ui`, `claude/rapat-backend`):** letak sakelar di dalam ruang rapat (bukan hanya pra-gabung) dan apakah pilihan Anda diingat untuk rapat berikutnya.

### 2.6 Keluar

Tekan **Keluar**. Layar *"Anda keluar dari rapat"* menawarkan **Gabung lagi**, kembali ke detail, atau membuka notulen. Jam keluar Anda tercatat otomatis. Bila penyelenggara mengeluarkan Anda, muncul *"Penyelenggara mengeluarkan Anda dari rapat"*.

## 3. Untuk notulis

### 3.1 Pilih notulen sebelum masuk

Di layar pra-gabung, notulis memilih sumber notulen (rancangan C):

| Pilihan | Kapan |
|---|---|
| **Lanjutkan notulen rapat lalu** | rapat berulang: membawa struktur rapat sebelumnya, mis. *"1 Okt · 3 tindak lanjut masih terbuka"* |
| **Templat Rapat mingguan** | agenda, keputusan, tindak lanjut siap diisi |
| **Dokumen kosong** | mulai dari nol |

Kartu kuning **"Tindak lanjut terbuka dari …"** menampilkan tindak lanjut rapat lalu yang belum selesai (nomor tugas, penanggung jawab, tenggat), supaya bisa dibahas lebih dulu.

> **Menunggu (`claude/rapat-ui`, `claude/rapat-backend`):** pilihan sumber notulen, siapa saja yang boleh memilih, dan isi templat. Saat ini notulen dibuka dari detail rapat › **Notulen** (`docs/fitur/rapat-kalender.md` §3).

### 3.2 Menulis notulen hidup

- Tulis di bagian per agenda; semua peserta melihat perubahan secara langsung dan bisa ikut mengetik (kursor & nama mereka terlihat).
- Tandai **keputusan** (blok bendera) agar mudah ditemukan.
- Tulis **tindak lanjut** sebagai chip tugas (butir, penanggung jawab, tenggat). **Jadikan tugas** membuat tugas di workspace rapat (nomor mis. `OPS-1284`); rapat tanpa workspace meminta Anda memilih workspace dulu.
- Notulen tersimpan otomatis dan berversi. Setelah rapat: **Finalkan & bagikan** (terkunci, dikirim ke peserta); penyelenggara bisa **Buka kembali draf**.
- Kehadiran di notulen terisi otomatis dari ruang video (peserta yang pernah masuk ditandai hadir); periksa dan koreksi bila perlu.

> **Menunggu (`claude/rapat-ui`):** editor notulen di dalam ruang rapat (kolaborasi langsung). Halaman notulen yang sekarang (`/rapat/{id}/notulen`) sudah mendukung simpan otomatis, keputusan, tindak lanjut, Jadikan tugas, dan finalisasi.

### 3.3 Waktu bicara

Panel kanan menampilkan lama bicara tiap orang (menit dan bagian dari total), mis. *"Dimas bicara 40% waktu rapat. Yoga belum bicara."* Pakai untuk memberi giliran kepada yang belum bicara. Ini **bukan** penilaian kinerja dan tidak muncul di dashboard HR atau pimpinan.

> **Menunggu (`claude/rapat-ui`):** cara penghitungan (dari deteksi bicara di ruang) dan apakah angkanya disimpan setelah rapat.

### 3.4 Setelah rapat: periksa draf notulen otomatis

Bila notulen otomatis aktif, setelah semua peserta keluar transkrip diproses (biasanya beberapa menit sampai sekitar satu jam, tergantung lama rapat). Lalu halaman **Notulen otomatis · Draf** tersedia:

| Kiri: **Transkrip** | Kanan: **Draf notulen** (Diringkas AI · periksa sebelum final) |
|---|---|
| jam, foto, nama pembicara, kalimat | **Ringkasan** |
| kotak **Cari di transkrip…** | **Keputusan**, masing-masing dengan jam yang menaut ke kalimat sumbernya (kalimat sumber disorot di transkrip) |
| catatan: audio sudah dihapus, transkrip hanya untuk peserta, 90 hari | **Usulan tindak lanjut** (butir, penanggung jawab, tenggat) dengan tombol **Jadikan tugas** (setelah dibuat: nomor tugas + centang) |
| | **Perlu dicek**: hal yang tidak pasti, mis. dua tanggal berbeda disebut untuk satu kegiatan |

Langkah:

1. Baca ringkasan dan keputusan; klik jam keputusan untuk melihat kalimat aslinya.
2. Selesaikan setiap **Perlu dicek** (perbaiki tanggal, nama, angka).
3. **Jadikan tugas** untuk usulan tindak lanjut yang disetujui.
4. **Masukkan ke notulen** memindahkan draf ke notulen rapat (tetap draf, masih bisa diubah), lalu **Finalkan & bagikan** seperti biasa. Atau **Buang draf** bila tidak dipakai.

Ingat: transkrip mesin bisa salah dengar nama, istilah, dan angka. Notulen final adalah tanggung jawab notulis.

> **Menunggu (`claude/notulen-otomatis`, `claude/rapat-ui`):** rute halaman draf, apakah "Masukkan ke notulen" menggabung atau mengganti isi, status saat transkrip belum siap/gagal, dan siapa saja yang melihat draf.

## 4. Untuk penyelenggara

### 4.1 Jadwalkan rapat video

**Rapat › Jadwalkan rapat** → isi judul, tanggal, jam, durasi → Tempat rapat **Video RuangKerja** (pilihan bawaan bila server rapat sudah diatur; tanpa tautan) → peserta, agenda, notulis, ulangi, workspace (untuk "Jadikan tugas"), pengingat → **Periksa & kirim undangan**. Rapat berulang mendapat ruang baru setiap tanggal. Detail: `docs/fitur/rapat-kalender.md` §3.

### 4.2 Nyalakan notulen otomatis

Rancangan: penyelenggara menyalakan **Notulen otomatis** untuk rapat (atau satu kemunculan) sebelum rapat dimulai. Semua peserta akan melihat pemberitahuan dan bisa menolak.

Pertimbangkan sebelum menyalakan:
- Rapat berisi data pribadi sensitif (kesehatan, gaji, sanksi, wawancara kandidat) **sebaiknya tanpa** notulen otomatis.
- Draf AI dibuat oleh penyedia di luar Indonesia dari teks transkrip ([privasi §6](rapat-video-privasi.md#6-pemrosesan-di-luar-indonesia-penyedia-ai)).

> **Menunggu (`claude/rapat-backend`, `claude/notulen-otomatis`):** letak sakelar (formulir rapat, detail, atau pra-gabung), berlaku per seri atau per kemunculan, dan apakah bisa dimatikan di tengah rapat.

### 4.3 Kehadiran & panggil peserta

Panel **Kehadiran** (otomatis dari ruang) menampilkan setiap peserta dengan jam masuk dan tanda **Terlambat N mnt**, serta yang **belum masuk** dengan tombol **Panggil**.

> **Menunggu (`claude/rapat-ui`, `claude/rapat-backend`):** panel Kehadiran di ruang dan perilaku **Panggil** (notifikasi apa yang dikirim). Saat ini kehadiran terlihat di detail rapat › **Hadir di rapat video** dan daftar **Orang** di ruang (termasuk yang diundang tetapi belum bergabung).

### 4.4 Bisukan atau keluarkan peserta

Di daftar orang dalam ruang: **Bisukan** mematikan mikrofon peserta (dia bisa menyalakannya lagi); **Keluarkan** mengeluarkannya dari ruang (dicatat di log audit). Hanya penyelenggara yang bisa melakukannya, dan tidak untuk dirinya sendiri. Catatan: orang yang dikeluarkan saat ini masih bisa masuk lagi selama jendela gabung terbuka.

## 5. Untuk HR & pimpinan

### 5.1 Kehadiran rapat

- Detail rapat › **Hadir di rapat video**: jam masuk–keluar, durasi, dan siapa yang masih di ruang. Putus-sambung tercatat sebagai sesi terpisah.
- Anda melihatnya bila Anda bisa membuka rapat itu: sebagai penyelenggara/notulis/peserta, atau untuk **rapat pimpinan** sebagai Direksi/HR (baca saja). Pengamat rapat pimpinan yang tidak diundang **tidak** bisa masuk ruang video.
- Kehadiran rapat **bukan** data absensi kerja dan tidak mengubah status hadir harian.

### 5.2 Privasi

- Rapat tidak direkam; yang tersimpan hanya kehadiran, notulen, dan (bila dinyalakan) transkrip 90 hari.
- **Waktu bicara** dan transkrip tidak boleh dipakai untuk menilai kinerja atau perilaku karyawan.
- Permintaan karyawan untuk melihat atau menghapus data rapat ditangani kontak privasi (bawaan: tim HR). Rincian: [rapat-video-privasi](rapat-video-privasi.md) §8.

## 6. Pertanyaan umum

**Apakah rapat direkam?** Tidak. Video, suara, layar, dan chat tidak disimpan. Bila notulen otomatis aktif, hanya suara mikrofon yang direkam sementara untuk ditranskrip, lalu audionya dihapus.

**Siapa yang bisa membaca transkrip?** Rancangannya: hanya peserta rapat, selama 90 hari. Super Admin tidak otomatis melihat rapat Anda.

**Saya menolak transkrip. Apakah orang lain tahu?** Draf hanya menyebut jumlah orang yang menolak, tanpa nama (rancangan).

**Bisakah saya bergabung dari ponsel?** Bisa, lewat browser ponsel (Chrome atau Safari terbaru). Gunakan tab **Video | Notulen**.

**Kenapa tombol gabung belum aktif?** Ruang dibuka 15 menit sebelum rapat. Setelah 2 jam lewat dari jam selesai, ruang ditutup.

**Bisakah tamu dari luar perusahaan ikut?** Belum. Tamu eksternal disimpan sebagai peserta tetapi belum bisa masuk ruang video.

**Apakah chat tersimpan?** Tidak. Salin hal penting ke notulen.

**Transkrip salah dengar nama/angka.** Wajar untuk mesin. Perbaiki di notulen; transkrip bukan notulen resmi.

## 7. Mengatasi masalah

| Masalah | Penyebab umum | Yang dilakukan |
|---|---|---|
| *"Izin kamera atau mikrofon ditolak…"* | izin browser pernah ditolak | klik ikon gembok/kamera di bilah alamat → izinkan **Kamera** dan **Mikrofon** → muat ulang halaman. Di macOS juga: Pengaturan Sistem › Privasi & Keamanan › Kamera/Mikrofon → izinkan browser. Anda tetap bisa bergabung tanpa keduanya. |
| *"Kamera atau mikrofon sedang dipakai aplikasi lain…"* | Zoom/Teams/aplikasi kamera terbuka | tutup aplikasi itu, lalu coba lagi |
| *"Kamera atau mikrofon tidak terdeteksi…"* | perangkat tidak tersambung | colok ulang headset/kamera, pilih di ⚙ Perangkat; tetap bisa bergabung untuk mendengarkan |
| Tidak terdengar suara apa pun | browser memblokir suara otomatis; speaker salah | tekan **Aktifkan suara rapat**; pilih speaker di ⚙ (bila browser mendukung); periksa volume perangkat & tab tidak dibisukan |
| Orang lain tidak mendengar saya | mikrofon mati/dibisukan penyelenggara; mikrofon salah | nyalakan mikrofon; pilih mikrofon yang benar di ⚙; lihat indikator level mikrofon di pra-gabung |
| Gema atau suara berdenging | dua perangkat di ruangan yang sama / speaker laptop | pakai headset; satu ruangan cukup satu perangkat bersuara |
| *"Tidak bisa tersambung ke server rapat. Periksa jaringan Anda (UDP atau port 443 mungkin diblokir)."* | jaringan kantor/tamu memblokir UDP atau memeriksa lalu lintas TLS | coba lagi (sistem otomatis memakai jalur cadangan lewat port 443); bila tetap gagal, pindah ke 4G dan laporkan ke admin dengan nama jaringannya. Admin: runbook R1 di `docs/deploy/RAPAT-VIDEO.md` |
| *"Menyambungkan ulang…"* terus | koneksi tidak stabil | pindah ke jaringan lebih kuat, matikan kamera untuk menghemat bandwidth |
| Gambar patah-patah | bandwidth kecil | matikan kamera; aplikasi otomatis menurunkan kualitas video orang lain |
| *"Ruang rapat dibuka pukul HH.MM"* | belum masuk jendela gabung | tunggu sampai 15 menit sebelum rapat |
| *"Rapat sudah selesai. Ruang rapat sudah ditutup."* | lewat 2 jam dari jam selesai | minta penyelenggara (bisa membuka kapan saja) atau jadwalkan ulang |
| *"Anda tidak diundang ke rapat ini."* | belum diundang | minta penyelenggara menambahkan Anda |
| *"Video RuangKerja belum disiapkan di server ini."* | server rapat belum diatur | hubungi admin |
| Tidak bisa membagikan layar | browser/ponsel tidak mendukung; izin perekaman layar macOS | pakai Chrome/Edge desktop; macOS: Pengaturan Sistem › Privasi & Keamanan › Perekaman Layar → izinkan browser, lalu buka ulang browser |
| Transkrip/draf belum muncul | transkripsi masih berjalan setelah rapat | tunggu; bila lebih dari ±1 jam, laporkan ke admin (runbook R2) |

## 8. Status & yang menunggu

| Bagian | Status |
|---|---|
| Jadwalkan rapat video, jendela gabung, pra-gabung, ruang, berbagi layar, chat, angkat tangan, bisukan/keluarkan, kehadiran dari webhook | **Nyata** (tampilan lama, seperti Google Meet) |
| Tampilan arah C: pita video, notulen di tengah, Bagian, Waktu bicara, panel Kehadiran + Panggil, tab ponsel | **Menunggu** `claude/rapat-ui` + `claude/rapat-backend` |
| Pilihan sumber notulen (lanjutkan/templat/kosong), tindak lanjut terbuka di pra-gabung | **Menunggu** `claude/rapat-ui` + `claude/rapat-backend` |
| Notulen otomatis: worker transkripsi | **Dibangun** (`transcriber/`, branch `claude/notulen-otomatis`), belum dipasang di server |
| Notulen otomatis: simpan transkrip, draf AI, halaman periksa draf, retensi 90 hari | **Menunggu** `claude/notulen-otomatis` + `claude/rapat-ui` |
| Subtitle langsung | **Rencana** tahap 2 (server GPU) |

## 9. TODO gambar

Gambar dibuat setelah tampilan arah C digabung, ke `docs/fitur/img/rapat-video/` (JPEG, `desktop` 1440×900 terang, `desktop-malam`, `ponsel` 390×844):

- [ ] `pra-gabung-desktop.jpg`: kamera, perangkat, pilihan notulen, tindak lanjut terbuka, kartu "Notulen otomatis aktif"
- [ ] `pra-gabung-ponsel.jpg`
- [ ] `ruang-desktop.jpg` + `ruang-desktop-malam.jpg`: pita video, notulen hidup, Bagian, Waktu bicara, bilah kontrol
- [ ] `presentasi-desktop.jpg`: layar dibagikan + notulen di kolom kanan
- [ ] `kehadiran-desktop.jpg`: panel Kehadiran dengan Terlambat & Panggil
- [ ] `subtitle-desktop.jpg`: kotak subtitle + chip "Notulen otomatis aktif · Subtitle ID" (tahap 2; bisa memakai data contoh)
- [ ] `notulen-otomatis-desktop.jpg`: transkrip + draf AI
- [ ] `ruang-ponsel.jpg` + `notulen-ponsel.jpg`: tab Video | Notulen
- [ ] `izin-ditolak-desktop.jpg`: pesan izin kamera/mikrofon ditolak
