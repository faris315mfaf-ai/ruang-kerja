# Rapat video & notulen otomatis: panduan pengguna

> **Status 7 Okt 2026.** **Video RuangKerja** (rapat video bawaan di server sendiri) sudah **nyata** di balik `FEATURE_MEETINGS` + `LIVEKIT_*`. Tampilannya sedang diganti ke arah desain **C "Notulen Hidup"** (pemilik, 7 Okt 2026): dokumen notulen menjadi pusat layar, video menjadi pita di atas. **Notulen otomatis** (transkrip setelah rapat + draf notulen dari AI) sudah ada backend-nya di branch `claude/notulen-otomatis`; **subtitle langsung** adalah tahap 2. Perilaku di bawah diperiksa terhadap kode di `main` dan kontrak `docs/fitur/rapat-video-kontrak.md` (branch `claude/rapat-backend`) serta `docs/fitur/notulen-otomatis-kontrak.md`; bagian yang tampilannya belum ada diberi catatan **Menunggu**. Privasi: [rapat-video-privasi](rapat-video-privasi.md) · operasional: `docs/deploy/RAPAT-VIDEO.md` · jadwal, notulen & kalender: [rapat-kalender](rapat-kalender.md) · indeks: [README](README.md).

| Saya… | Baca |
|---|---|
| Diundang rapat video | [§2 Untuk semua peserta](#2-untuk-semua-peserta) |
| Notulis rapat | [§3 Untuk notulis](#3-untuk-notulis) |
| Penyelenggara rapat | [§4 Untuk penyelenggara](#4-untuk-penyelenggara) |
| HR atau pimpinan | [§5 Untuk HR & pimpinan](#5-untuk-hr--pimpinan) |
| Mengalami masalah | [§7 Mengatasi masalah](#7-mengatasi-masalah) |

## 1. Sekilas

- **Video RuangKerja** adalah tempat rapat bawaan: tanpa tautan Meet/Zoom, langsung dari detail rapat di RuangKerja, berjalan di server rapat perusahaan di Indonesia. Rapat **tidak direkam**; chat tidak disimpan.
- **Notulen Hidup**: selama rapat, notulen terbuka di tengah layar, dengan bagian per agenda, keputusan, dan tindak lanjut yang bisa langsung menjadi tugas. Notulis dan penyelenggara menulis; peserta lain melihat perubahannya dalam hitungan detik. Wajah peserta tetap terlihat di pita atas.
- **Notulen otomatis** (bila dinyalakan penyelenggara): setelah rapat, suara peserta ditulis menjadi transkrip berlabel nama, lalu AI menyiapkan draf ringkasan, keputusan, dan usulan tindak lanjut untuk diperiksa notulis. Setiap orang boleh menolak suaranya ditranskrip.
- **Kehadiran** tercatat otomatis dari ruang video (jam masuk & keluar, terlambat).

## 2. Untuk semua peserta

### 2.1 Sebelum rapat: perangkat

- **Browser**: Chrome, Edge, Firefox, atau Safari versi terbaru, di laptop atau ponsel. Browser lain menampilkan *"Browser ini belum didukung untuk rapat video…"*.
- **Jaringan**: minimal ±3 Mbps unduh dan ±1,5 Mbps unggah. Wi-Fi kantor dan 4G sama-sama bisa; jaringan yang memblokir UDP tetap bisa masuk lewat port 443 (sedikit lebih lambat).
- **Suara**: pakai headset atau earphone agar tidak terjadi gema; matikan mikrofon saat tidak bicara.
- Tutup aplikasi rapat lain (Zoom, Teams) yang memakai kamera/mikrofon.

### 2.2 Gabung rapat

1. Buka rapat dari **Rapat** (agenda), **Kalender**, notifikasi **"Rapat dimulai"** (tombol **Gabung**), notifikasi **"Rapat sudah dimulai — Gabung"** bila Anda dipanggil (§4.3), atau Inbox.
2. Di detail rapat, kartu video menampilkan siapa yang sudah di ruang ("N orang di ruang rapat"). Tekan **Gabung rapat video**.
   - Ruang dibuka **15 menit sebelum** rapat mulai sampai **2 jam sesudah** rapat selesai. Sebelum itu kartu menampilkan *"Ruang dibuka 08.45"* dan hitung mundur (*"Dibuka dalam 12 menit"*). Penyelenggara bisa masuk kapan saja.
   - Hanya orang yang **diundang** (penyelenggara, notulis, peserta) yang bisa masuk. Rapat yang dibatalkan tidak bisa dibuka.
3. **Layar pra-gabung**: izinkan kamera dan mikrofon saat browser bertanya. Periksa pratinjau kamera, nyalakan/matikan mikrofon dan kamera, pilih perangkat (⚙). Pilihan perangkat diingat di browser itu.
4. Bila **notulen otomatis aktif**, ada kartu **"Notulen otomatis aktif"** dengan sakelar **Jangan transkrip suara saya** (§2.5). Kartu ini wajib tampil sebelum Anda masuk.
5. Tekan **Masuk dan buka notulen**.

> **Menunggu (`claude/rapat-ui`):** layar pra-gabung arah C belum ada di `main`; layar saat ini memakai tombol **Gabung sekarang** dan belum menampilkan kartu notulen otomatis. Periksa ulang teks persis setelah UI baru digabung.

### 2.3 Di ruang rapat

Tata letak desktop (rancangan C):

| Bagian | Isi |
|---|---|
| Pita video (atas) | wajah semua peserta; yang sedang bicara diberi bingkai dan ubin lebih lebar |
| Tengah | **notulen rapat** (§3.2). Notulis/penyelenggara mengetik; yang lain melihat isinya diperbarui ±1 detik setelah disimpan, dengan avatar orang yang terakhir menyimpan |
| Kiri | daftar **Bagian** (butir agenda + Keputusan + Tindak lanjut) untuk melompat |
| Kanan | **Waktu bicara** per orang (§3.3) atau panel **Kehadiran** (§4.3) |
| Bawah tengah | bilah kontrol: mikrofon, kamera, bagikan layar, angkat tangan, chat, **Keluar** |

- **Presentasi**: saat seseorang membagikan layar, layar itu tampil besar di kiri dan notulen mengecil ke kolom kanan; notulen **tetap bisa diketik**.
- **Ponsel**: dua tab **Video | Notulen**, bilah kontrol di bawah; subtitle tampil di atas bilah kontrol.
- **Chat** dan **angkat tangan** hanya berlaku selama rapat; chat tidak disimpan.
- **Suara tidak terdengar** saat baru masuk? Tekan **Aktifkan suara rapat** (browser memblokir suara sampai Anda mengklik halaman).
- Koneksi putus sebentar → *"Menyambungkan ulang…"*, lalu kembali sendiri.

Pintasan keyboard di layar saat ini: ⌘/Ctrl+D mikrofon, ⌘/Ctrl+E kamera, ⌘/Ctrl+Alt+C chat, ⌘/Ctrl+Alt+P daftar orang, ⌘/Ctrl+Alt+H angkat tangan.

> **Menunggu (`claude/rapat-ui`):** ruang rapat arah C (pita video, notulen di tengah, Bagian, Waktu bicara, Kehadiran, tab ponsel) dan apakah pintasan, berbagi layar dengan audio tab, dan daftar orang tetap sama. Kursor kolaborator seperti di mockup **belum** didukung (notulen belum dokumen kolaborasi langsung). Gambar layar: §9.

### 2.4 Subtitle

Bila subtitle aktif, kotak di atas bilah kontrol menampilkan ucapan terbaru dengan **nama pembicara**, dan chip **"Notulen otomatis aktif · Subtitle ID"** terlihat di ruang. Tanpa subtitle, kotak itu tidak muncul sama sekali.

> **Menunggu (tahap 2, server GPU):** subtitle langsung belum tersedia. Ruang rapat baru disiapkan untuk menampilkannya begitu server mengirim teks (`docs/deploy/RAPAT-VIDEO.md` §10).

### 2.5 Notulen otomatis dan menolak transkrip

- Notulen otomatis hanya berjalan bila **penyelenggara menyalakannya** untuk rapat itu. Anda selalu diberi tahu sebelum masuk dan melihat chip "Notulen otomatis aktif" di ruang.
- Yang diproses hanya **suara mikrofon** (bukan video, bukan layar). Audio disimpan sementara di server rapat dan **dihapus segera setelah ditulis menjadi teks**. Transkrip hanya untuk penyelenggara, notulis, dan peserta yang diundang, dan **dihapus otomatis 90 hari** setelah rapat.
- **Jangan transkrip suara saya** berlaku untuk rapat itu (seluruh seri bila rapatnya berulang) sampai Anda mematikannya:
  - sebelum masuk: suara Anda tidak pernah dikirim ke mesin transkripsi;
  - **di tengah rapat** (sakelar yang sama di ruang): perekaman suara Anda berhenti dan rekaman yang sudah terkumpul dihapus;
  - **sesudah rapat**: kalimat Anda dihapus dari transkrip rapat itu yang belum dimasukkan ke notulen, dan draf AI dibuat ulang tanpa kalimat Anda.
  
  Peserta lain tetap mendengar Anda seperti biasa.
- Penjelasan lengkap & hak Anda: [rapat-video-privasi](rapat-video-privasi.md).

> **Menunggu (`claude/rapat-ui`):** letak sakelar di ruang rapat (menu/panel) dan di halaman detail rapat untuk menolak sesudah rapat. Backend-nya sudah ada (`PUT /rapat/{id}/notulen-otomatis/persetujuan`).

### 2.6 Keluar

Tekan **Keluar**. Layar *"Anda keluar dari rapat"* menawarkan **Gabung lagi**, kembali ke detail, atau membuka notulen. Jam keluar Anda tercatat otomatis. Bila penyelenggara mengeluarkan Anda, muncul *"Penyelenggara mengeluarkan Anda dari rapat"*.

## 3. Untuk notulis

Yang di bagian ini juga bisa dilakukan **penyelenggara**.

### 3.1 Pilih notulen sebelum masuk

Di layar pra-gabung, notulis (atau penyelenggara) memilih sumber notulen **sekali untuk tiap tanggal rapat**. Pilihan pertama yang berlaku; sesudahnya semua orang melihat "Notulen memakai: …".

| Pilihan | Yang terjadi |
|---|---|
| **Lanjutkan notulen rapat lalu** (disarankan bila masih ada tindak lanjut terbuka) | menambah bagian **"Tindak lanjut rapat lalu"** berisi satu baris per tindak lanjut yang belum selesai dari notulen terakhir rapat ini, mis. *"• Kirim jadwal servis ke vendor — Rizky Aditya · tenggat 3 Okt · OPS-1270"* |
| **Templat Rapat mingguan** | memastikan satu bagian per butir agenda rapat (agenda kosong → satu bagian "Agenda"); isi yang sudah ada tidak dihapus |
| **Dokumen kosong** | mengosongkan bagian bila notulen memang belum berisi apa-apa; isi yang sudah ada tidak diubah |

Kartu kuning **"Tindak lanjut terbuka dari …"** menampilkan hingga 20 tindak lanjut rapat lalu yang belum selesai (nomor tugas, penanggung jawab, tenggat; yang lewat tenggat ditandai), supaya bisa dibahas lebih dulu. Keputusan dan Tindak lanjut selalu menjadi blok tetap di akhir notulen. Peserta biasa tidak melihat pilihan ini.

> **Menunggu (`claude/rapat-backend` + `claude/rapat-ui`):** endpoint `POST …/video/sumber-notulen` dan tampilannya. Saat ini notulen dibuka dari detail rapat › **Notulen** (`docs/fitur/rapat-kalender.md` §3).

### 3.2 Menulis notulen hidup

- Tulis di bagian per agenda (judul bebas, maks. 40 bagian). Notulen **tersimpan otomatis** dan berversi; peserta lain melihat perubahan setelah tersimpan.
- Tandai **keputusan** agar mudah ditemukan.
- Tulis **tindak lanjut** (butir, penanggung jawab, tenggat). **Jadikan tugas** membuat tugas di workspace rapat (nomor mis. `OPS-1284`); rapat tanpa workspace meminta Anda memilih workspace dulu.
- Kehadiran di notulen terisi otomatis dari ruang video (peserta yang pernah masuk ditandai hadir); periksa dan koreksi bila perlu.
- Setelah rapat: **Finalkan & bagikan** (terkunci, dikirim ke peserta); penyelenggara bisa **Buka kembali draf**.
- Yang bisa mengetik hanya notulis dan penyelenggara. Bila keduanya mengetik bersamaan, simpanan terakhir yang berlaku (versi sebelumnya tetap tercatat); sepakati siapa yang mengetik.

> **Menunggu (`claude/rapat-ui`):** editor notulen di dalam ruang rapat. Halaman notulen yang sekarang (`/rapat/{id}/notulen`) sudah mendukung simpan otomatis, keputusan, tindak lanjut, Jadikan tugas, dan finalisasi.

### 3.3 Waktu bicara

Panel kanan menampilkan lama bicara tiap orang (menit dan persen dari total), mis. *"Dimas bicara 40% waktu rapat. Yoga belum bicara."* "Belum bicara" = sudah masuk ruang tetapi belum bicara. Pakai untuk memberi giliran. Angkanya dikirim browser tiap peserta setiap 15 detik (hanya waktu bicara dirinya sendiri), disimpan per tanggal rapat, dan dapat dilihat semua peserta rapat. Ini **bukan** penilaian kinerja.

> **Menunggu (`claude/rapat-backend` + `claude/rapat-ui`):** endpoint `…/video/bicara` dan panelnya.

### 3.4 Setelah rapat: periksa draf notulen otomatis

Bila notulen otomatis aktif, perekaman berhenti ±1,5 menit setelah orang terakhir keluar, lalu transkrip diproses (beberapa menit sampai sekitar satu jam, tergantung lama rapat dan antrean). Status di halaman: **Merekam → Mentranskrip → Meringkas → Siap** (atau **Gagal** dengan alasannya). Halaman **Notulen otomatis** (`/rapat/{id}/notulen-otomatis`):

| Kiri: **Transkrip** | Kanan: **Draf notulen** (diringkas AI, periksa sebelum final) |
|---|---|
| waktu, nama pembicara, kalimat | **Ringkasan** |
| pencarian di transkrip | **Pembahasan per agenda**, **Keputusan**, masing-masing menaut ke kalimat sumbernya (kalimat sumber disorot) |
| catatan bahwa audio sudah dihapus dan transkrip disimpan 90 hari | **Usulan tindak lanjut** (butir, penanggung jawab, tenggat) dengan tombol **Jadikan tugas** (setelah dibuat: nomor tugas) |
| | **Perlu dicek**: hal yang tidak pasti, mis. nama penanggung jawab yang tidak ada di daftar peserta atau tenggat yang tidak jelas |

Langkah:

1. Baca ringkasan dan keputusan; klik sumbernya untuk melihat kalimat aslinya.
2. Selesaikan setiap **Perlu dicek**. Penanggung jawab hanya diisi otomatis bila namanya cocok dengan peserta rapat.
3. **Jadikan tugas** untuk usulan tindak lanjut yang disetujui (rapat tanpa workspace: pilih workspace).
4. **Masukkan ke notulen** (sekali saja): poin pembahasan ditambahkan di bawah tulisan Anda pada bagian agenda yang sama dengan penanda *"[Draf otomatis — periksa sebelum final]"* (agenda yang tidak ada menjadi bagian baru), ringkasan menjadi bagian **"Ringkasan (draf otomatis)"**, keputusan baru diberi akhiran *"(draf otomatis)"*, dan usulan tindak lanjut menjadi tindak lanjut notulen. Tulisan Anda tidak ditimpa. Lalu rapikan dan **Finalkan & bagikan** seperti biasa.
5. Atau **Buang draf** bila tidak dipakai (transkrip tetap ada sampai masa simpannya habis). **Ringkas ulang** membuat draf baru bila draf gagal atau belum dimasukkan.

Bila admin belum mengisi kunci layanan AI, transkrip tetap tersedia tetapi draf tidak dibuat. Ingat: transkrip mesin bisa salah dengar nama, istilah, dan angka. Notulen final adalah tanggung jawab notulis. Setiap kali transkrip dibuka, aksesnya dicatat di log audit.

> **Menunggu (`claude/rapat-ui`):** tampilan arah C halaman ini (saat ini versi minimal dari agen notulen) dan tautannya dari detail rapat/notulen.

## 4. Untuk penyelenggara

### 4.1 Jadwalkan rapat video

**Rapat › Jadwalkan rapat** → isi judul, tanggal, jam, durasi → Tempat rapat **Video RuangKerja** (pilihan bawaan bila server rapat sudah diatur; tanpa tautan) → peserta, agenda, notulis, ulangi, workspace (untuk "Jadikan tugas"), pengingat → **Periksa & kirim undangan**. Rapat berulang mendapat ruang baru setiap tanggal. Isi agenda dengan baik: agenda menjadi bagian notulen, navigator **Bagian**, dan acuan AI. Detail: `docs/fitur/rapat-kalender.md` §3.

### 4.2 Nyalakan notulen otomatis

Hanya penyelenggara, hanya untuk rapat **Video RuangKerja**, dan hanya bila admin sudah menyiapkan server notulen. Pengaturan berlaku untuk **seluruh seri** rapat berulang dan bisa dimatikan kapan saja. Teks penjelas sakelar: *"Notulen otomatis — suara peserta ditranskrip setelah rapat, lalu AI menyusun draf notulen untuk diperiksa notulis. Peserta bisa menolak. Transkrip dihapus otomatis setelah 90 hari."* Perekaman dimulai otomatis saat orang pertama masuk ruang. Perubahan pengaturan dicatat di log audit.

Pertimbangkan sebelum menyalakan:
- Rapat berisi data pribadi sensitif (kesehatan, gaji, sanksi, wawancara kandidat) **sebaiknya tanpa** notulen otomatis.
- Draf AI dibuat oleh penyedia di luar Indonesia dari teks transkrip ([privasi §6](rapat-video-privasi.md#6-pemrosesan-di-luar-indonesia-penyedia-ai)).

> **Menunggu (`claude/rapat-ui`, `claude/rapat-backend`):** letak sakelar (formulir jadwal dan/atau detail rapat). Backend: `PUT /rapat/{id}/notulen-otomatis/pengaturan`.

### 4.3 Kehadiran & panggil peserta

Panel **Kehadiran** (otomatis dari ruang) menampilkan setiap peserta dengan jam masuk dan lencana **Hadir** atau **Terlambat N mnt** (terlambat bila masuk lebih dari 2 menit setelah rapat mulai), serta yang **belum masuk**. Notulis dan penyelenggara bisa menekan **Panggil** pada orang yang belum masuk: dia mendapat notifikasi **"Rapat sudah dimulai — Gabung"** (Inbox, toast bila sedang membuka RuangKerja, email sesuai pengaturannya) dengan tombol **Gabung** ke pra-gabung. Satu orang paling sering dipanggil sekali per menit, hanya selama ruang terbuka; panggilan dicatat di log audit.

> **Menunggu (`claude/rapat-backend` + `claude/rapat-ui`):** panel Kehadiran di ruang dan **Panggil**. Saat ini kehadiran terlihat di detail rapat › **Hadir di rapat video** dan daftar **Orang** di ruang (termasuk yang diundang tetapi belum bergabung).

### 4.4 Bisukan atau keluarkan peserta

Di daftar orang dalam ruang: **Bisukan** mematikan mikrofon peserta; **Keluarkan** mengeluarkannya dari ruang (dicatat di log audit). Hanya penyelenggara yang bisa melakukannya, dan tidak untuk dirinya sendiri. Catatan: orang yang dikeluarkan masih bisa bergabung lagi selama ruang terbuka.

## 5. Untuk HR & pimpinan

### 5.1 Kehadiran rapat

- Detail rapat › **Hadir di rapat video**: jam masuk–keluar, durasi, dan siapa yang masih di ruang. Putus-sambung tercatat sebagai sesi terpisah.
- Anda melihatnya bila Anda bisa membuka rapat itu: sebagai penyelenggara/notulis/peserta, atau untuk **rapat pimpinan** sebagai Direksi/HR (baca saja). Pengamat rapat pimpinan yang tidak diundang **tidak** bisa masuk ruang video dan **tidak** bisa membaca transkrip atau draf AI (hanya statusnya).
- Kehadiran rapat **bukan** data absensi kerja dan tidak mengubah status hadir harian.

### 5.2 Privasi

- Rapat tidak direkam; yang tersimpan hanya kehadiran, waktu bicara, notulen, dan (bila dinyalakan) transkrip + draf AI selama 90 hari.
- **Waktu bicara** dan transkrip tidak boleh dipakai untuk menilai kinerja atau perilaku karyawan.
- Permintaan karyawan untuk melihat atau menghapus data rapat ditangani kontak privasi (bawaan: tim HR). Rincian: [rapat-video-privasi](rapat-video-privasi.md) §8.

## 6. Pertanyaan umum

**Apakah rapat direkam?** Tidak. Video, suara, layar, dan chat tidak disimpan. Bila notulen otomatis aktif, hanya suara mikrofon yang direkam sementara untuk ditranskrip, lalu audionya dihapus.

**Siapa yang bisa membaca transkrip?** Penyelenggara, notulis, dan peserta yang diundang, selama 90 hari. Super Admin, HR, dan Direksi tidak otomatis melihatnya.

**Saya menolak transkrip. Apakah orang lain tahu?** Aplikasi tidak menampilkan siapa yang menolak; yang terlihat hanya bahwa kalimat Anda tidak ada di transkrip. (Secara teknis tanda "menolak" ikut terkirim sebagai atribut ruang ke perangkat peserta lain, tanpa ditampilkan.)

**Bisakah saya menolak setelah rapat selesai?** Bisa, selama draf belum dimasukkan ke notulen: kalimat Anda dihapus dari transkrip dan draf dibuat ulang.

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
| Status transkrip lama di **Mentranskrip** | transkripsi masih antre atau berjalan | tunggu; bila lebih dari ±1 jam, laporkan ke admin (runbook R2) |
| Status **Gagal** atau draf AI tidak ada | transkripsi/ringkasan gagal, atau layanan AI belum diatur | notulis: **Ringkas ulang**; bila tetap gagal laporkan ke admin (runbook R3). Transkrip tetap bisa dipakai menulis notulen |
| *"… baru saja dipanggil. Coba lagi dalam N detik."* | Panggil dibatasi sekali per menit per orang | tunggu sebentar |

## 8. Status & yang menunggu

| Bagian | Status |
|---|---|
| Jadwalkan rapat video, jendela gabung, pra-gabung, ruang, berbagi layar, chat, angkat tangan, bisukan/keluarkan, kehadiran dari webhook | **Nyata** di `main` (tampilan lama, seperti Google Meet) |
| Tampilan arah C: pita video, notulen di tengah, Bagian, Waktu bicara, Kehadiran + Panggil, tab ponsel | **Menunggu** `claude/rapat-ui`; kontrak data sudah ada (`claude/rapat-backend`), endpoint menyusul |
| Pilihan sumber notulen, tindak lanjut terbuka di pra-gabung | **Menunggu** `claude/rapat-backend` + `claude/rapat-ui` (kontrak ada) |
| Notulen otomatis: worker transkripsi, simpan transkrip, persetujuan/menolak, draf AI, masukkan/buang/ringkas ulang/jadikan tugas, retensi 90 hari | **Dibangun** di `claude/notulen-otomatis` (belum digabung, worker belum dipasang di server); tampilan arah C **Menunggu** `claude/rapat-ui` |
| Kursor kolaborator di notulen | **Belum** (notulen belum dokumen kolaborasi langsung) |
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
