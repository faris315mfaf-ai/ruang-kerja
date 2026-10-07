# Rapat video & notulen otomatis: privasi dan kepatuhan (UU PDP)

> **Status 7 Okt 2026.** Rapat video (Video RuangKerja) dan kehadiran dari ruang video **nyata**. Notulen otomatis (transkrip + draf AI) **sedang dibangun**: perilaku worker transkripsi di bawah sudah diperiksa terhadap kodenya (`transcriber/`, branch `claude/notulen-otomatis`); bagian aplikasi (simpan transkrip, siapa yang melihat, retensi 90 hari, penyedia AI) mengikuti rancangan dan diberi tanda **Menunggu** sampai kodenya ada. Subtitle langsung = rencana tahap 2. Untuk karyawan, HR, pimpinan, dan pengelola data. Panduan pemakaian: [rapat-video](rapat-video.md) · operasional: `docs/deploy/RAPAT-VIDEO.md` · kebijakan privasi aplikasi: `/kebijakan-privasi` (sumber `resources/markdown/privacy-policy.md`).

## 1. Ringkasan

- **Rapat video tidak direkam.** Gambar dan suara hanya lewat (tidak disimpan) di server rapat milik perusahaan di Indonesia. Chat di dalam rapat tidak disimpan.
- **Kehadiran dicatat**: jam masuk dan keluar ruang video setiap peserta, untuk notulen dan daftar hadir rapat.
- **Notulen otomatis hanya berjalan bila dinyalakan untuk rapat itu**, dan setiap peserta diberi tahu sebelum masuk. Suara peserta direkam sementara untuk ditulis menjadi teks setelah rapat; **audio dihapus segera setelah ditranskrip**. Transkrip hanya untuk peserta rapat dan disimpan **90 hari** (bisa diatur).
- **Anda boleh menolak**: sakelar **"Jangan transkrip suara saya"**. Suara Anda tidak pernah sampai ke mesin transkripsi, dan bila Anda menolak di tengah rapat, rekaman suara Anda yang sudah ada dihapus.
- **Ringkasan AI** dibuat dari **teks** transkrip oleh penyedia AI (bawaan DeepSeek, di luar Indonesia; bisa diganti). Audio tidak pernah dikirim ke penyedia AI. Draf AI selalu diperiksa notulis sebelum menjadi notulen.

## 2. Data yang diproses

| Fitur | Data | Disimpan di | Keterangan |
|---|---|---|---|
| Rapat video (semua rapat "Video RuangKerja") | video, suara, layar yang dibagikan | **tidak disimpan**; diteruskan server rapat (LiveKit) di VPS Biznet Indonesia | media WebRTC terenkripsi di jalur (DTLS-SRTP) antara browser dan server rapat; server rapat meneruskannya ke peserta lain (bukan enkripsi ujung-ke-ujung) |
| | chat, angkat tangan | tidak disimpan | lewat data channel LiveKit selama rapat |
| | identitas di ruang: id karyawan, nama, URL foto profil, penanda penyelenggara | token akses sementara (10 menit) | dibuat aplikasi, tidak disimpan di server rapat |
| | kehadiran: id karyawan, jam masuk, jam keluar, durasi, id sesi | basis data aplikasi, tabel `meeting_attendances` | dari webhook LiveKit; satu baris per sesi (putus-sambung = baris baru) |
| | log teknis: identitas peserta, alamat IP, kualitas koneksi | log Docker di VPS rapat | untuk penanganan gangguan; atur rotasi log (`docs/deploy/RAPAT-VIDEO.md` §9) |
| Notulen (dokumen) | isi notulen, keputusan, tindak lanjut, versi, penulis | basis data aplikasi | sama dengan notulen biasa (`docs/fitur/rapat-kalender.md`) |
| Waktu bicara (panel di ruang rapat) | lama bicara per orang | **Menunggu**: dihitung di browser atau disimpan? | bila disimpan, wajib masuk tabel ini dan tidak boleh dipakai untuk penilaian kinerja (§3) |
| Notulen otomatis (bila dinyalakan) | **audio mikrofon** peserta yang tidak menolak | spool sementara di VPS rapat (Indonesia), folder izin 700 | WAV per pembicara, nama berkas tanpa identitas; **dihapus setelah transkripsi**; sisa karena gangguan dihapus otomatis ≤ 24 jam |
| | **transkrip**: teks, nama & id pembicara, waktu (ms dari awal), bahasa, model | basis data aplikasi (**Menunggu**: tabel) | dikirim worker ke aplikasi dengan tanda tangan HMAC; bila belum terkirim, tertahan di VPS rapat ≤ 24 jam |
| | **draf notulen AI**: ringkasan, keputusan, usulan tindak lanjut, "Perlu dicek" | basis data aplikasi (**Menunggu**) | dibuat penyedia AI dari teks transkrip |
| Subtitle langsung (tahap 2, rencana) | teks sementara dari suara | dikirim ke peserta di ruang (LiveKit text stream `lk.transcription`) | aturan menolak sama dengan notulen otomatis |

Yang **tidak** diproses: rekaman video, rekaman layar, audio berbagi layar (tidak ditranskrip), sidik suara/biometrik (pembicara dikenali dari akun di ruang, bukan dari suara), dan aktivitas di luar ruang rapat.

## 3. Tujuan dan dasar pemrosesan

| Pemrosesan | Tujuan | Dasar (UU PDP Pasal 20) |
|---|---|---|
| Rapat video & chat | menjalankan rapat kerja | pelaksanaan perjanjian kerja (rapat adalah bagian pekerjaan) |
| Kehadiran ruang video | daftar hadir notulen, mengetahui siapa yang sudah/belum masuk | kepentingan yang sah perusahaan; tidak dipakai untuk sanksi otomatis |
| Notulen otomatis (audio sementara → transkrip → draf) | mempercepat dan melengkapi notulen | kepentingan yang sah, dengan pemberitahuan sebelum masuk dan **hak menolak per orang** ("Jangan transkrip suara saya") |
| Pengiriman teks transkrip ke penyedia AI di luar negeri | membuat draf ringkasan | lihat §6 (transfer ke luar wilayah hukum Indonesia) |

Prinsip yang sama dengan kebijakan privasi aplikasi: data rapat **tidak** dipakai untuk menilai produktivitas atau perilaku di luar hasil kerja. **Waktu bicara** adalah bantuan agar rapat adil, bukan ukuran kinerja: tidak boleh muncul di dashboard HR/pimpinan atau penilaian.

> Pilihan dasar hukum di atas adalah usulan dokumentasi. Pemilik/penanggung jawab data perlu mengonfirmasinya (bila perlu dengan penasihat hukum) sebelum notulen otomatis dinyalakan di produksi (§10).

## 4. Siapa yang dapat melihat

| Data | Siapa |
|---|---|
| Kehadiran ruang video ("Hadir di rapat video", jumlah di ruang) | semua yang bisa membuka detail rapat: penyelenggara, notulis, peserta internal; untuk **rapat pimpinan** juga Direksi, HR, Super Admin (baca saja). Lainnya tidak melihat rapat itu sama sekali (404). |
| Ruang video | penyelenggara, notulis, dan peserta internal yang diundang. Pengamat rapat pimpinan yang tidak diundang **tidak** bisa masuk ruang. |
| Transkrip | rancangan: **hanya peserta rapat** (**Menunggu**: aturan akses persis dari `docs/fitur/notulen-otomatis-kontrak.md`, termasuk pengamat rapat pimpinan dan peserta yang menolak transkrip) |
| Draf notulen AI (sebelum dimasukkan) | rancangan: notulis dan penyelenggara (**Menunggu**) |
| Notulen final | seperti notulen biasa: semua yang bisa membuka rapat |
| Audio sementara | tidak seorang pun lewat aplikasi; hanya proses worker di VPS rapat. Admin server secara teknis bisa mengakses spool selama audio belum dihapus: akses SSH dibatasi ke admin |
| Penyedia AI | teks transkrip yang dikirim untuk diringkas (§6) |

Super Admin **tidak** otomatis melihat rapat biasa, transkrip, atau notulennya.

## 5. Retensi

| Data | Lama simpan |
|---|---|
| Video, suara, layar, chat | tidak disimpan |
| Audio untuk transkrip | dihapus segera setelah transkripsi (berhasil atau gagal); sisa karena gangguan dihapus otomatis setelah 24 jam (`TRANSCRIBER_SPOOL_MAX_AGE_HOURS`) |
| Transkrip yang belum terkirim ke aplikasi | di VPS rapat, maks. 24 jam |
| Transkrip di aplikasi | **90 hari**, bisa diatur (**Menunggu**: kunci konfigurasi & job penghapusan) |
| Draf AI yang dibuang ("Buang draf") | **Menunggu**: dihapus langsung atau ikut retensi transkrip |
| Notulen final (termasuk isi yang berasal dari draf AI) | seperti notulen biasa: selama dibutuhkan pekerjaan (belum ada penghapusan otomatis) |
| Kehadiran ruang video | belum ada penghapusan otomatis (**perlu keputusan**, mis. mengikuti retensi data kehadiran kerja) |
| Log teknis server rapat | sesuai rotasi log Docker di VPS rapat |
| Data di penyedia AI | menurut ketentuan penyedia (**perlu diperiksa**, §6) |

## 6. Pemrosesan di luar Indonesia (penyedia AI)

- Penyedia bawaan ringkasan: **DeepSeek**, layanan API yang servernya di luar Indonesia. Yang dikirim: **teks transkrip** dengan nama pembicara dan waktu, plus judul/agenda rapat. Audio tidak pernah dikirim. (**Menunggu**: isi persis permintaan dan apakah nama disamarkan dulu, dari kontrak notulen otomatis.)
- UU PDP **Pasal 56**: transfer data pribadi ke luar wilayah hukum Indonesia hanya boleh bila negara tujuan memiliki pelindungan setara atau lebih tinggi, atau ada pelindungan yang memadai dan mengikat, atau dengan persetujuan subjek data. Sebelum menyalakan fitur ini di produksi pemilik perlu memilih dasarnya dan mencatatnya.
- Langkah yang disarankan:
  1. Sebut penyedia AI dan negaranya di kebijakan privasi (§9) dan di kartu "Notulen otomatis aktif" bila memungkinkan.
  2. Minimalkan: kirim teks saja, tanpa email/nomor karyawan; pertimbangkan nama samaran (mis. "Pembicara 1") yang dipetakan kembali di aplikasi.
  3. Periksa ketentuan API penyedia: lama penyimpanan masukan, dan apakah masukan dipakai untuk melatih model; pilih pengaturan yang tidak memakai data untuk pelatihan bila ada.
  4. **Penyedia bisa diganti** (runbook R4 di `docs/deploy/RAPAT-VIDEO.md`): penyedia dengan server di Indonesia atau model yang dijalankan di server sendiri menghilangkan transfer ke luar negeri. Rapat yang sangat rahasia sebaiknya tanpa notulen otomatis.
- Transkripsi suara (Whisper) **berjalan di server sendiri di Indonesia**; tahap 2 (GPU) juga direncanakan di Indonesia.

## 7. Pemberitahuan, persetujuan, dan menolak

1. **Sebelum masuk** (layar pra-gabung), bila notulen otomatis aktif: kartu **"Notulen otomatis aktif"** dengan teks rancangan *"Suara Anda ditranskrip setelah rapat, audio langsung dihapus. Transkrip hanya untuk peserta, 90 hari."* dan sakelar **"Jangan transkrip suara saya"**.
2. **Selama rapat**: chip "Notulen otomatis aktif" terlihat di ruang. Menyalakan "Jangan transkrip suara saya" di tengah rapat langsung menghentikan perekaman suara Anda dan **menghapus rekaman suara Anda yang sudah ada** (diperiksa di kode worker). Ucapan Anda **sebelum** menyalakan tidak bisa ditarik dari ingatan peserta lain, tetapi tidak akan ada di transkrip.
3. **Cara kerjanya**: pilihan Anda dikirim sebagai atribut ruang (`rk_notulen_optout`); worker tidak pernah berlangganan mikrofon orang yang menolak, jadi suaranya tidak pernah sampai ke mesin transkripsi. Aplikasi juga bisa mengecualikan orang tertentu saat memanggil worker.
4. **Setelah rapat** (rancangan): halaman draf menyebut jumlahnya, mis. *"1 orang memilih tidak ditranskrip"*, tanpa nama.

> **Menunggu (`claude/rapat-ui`, `claude/rapat-backend`):** apakah pilihan menolak diingat per orang/per rapat, apakah bisa diubah dari ruang rapat (bukan hanya pra-gabung), apa yang terjadi pada peserta yang masuk dari ponsel, dan apakah penyelenggara bisa mematikan notulen otomatis di tengah rapat.

## 8. Hak Anda dan cara meminta penghapusan

| Hak | Cara |
|---|---|
| Mengetahui | dokumen ini, kartu pemberitahuan pra-gabung, dan kebijakan privasi (`/kebijakan-privasi`) |
| Menolak transkrip | sakelar "Jangan transkrip suara saya" (sebelum atau selama rapat) |
| Melihat | transkrip rapat yang Anda ikuti (**Menunggu**: halaman). Catatan: **Menu → Privasi & data saya** (ekspor Excel/PDF) **belum** memuat data rapat (kehadiran video, transkrip); permintaan salinan disampaikan ke kontak privasi |
| Memperbaiki | minta notulis memperbaiki notulen; transkrip mesin bisa salah dengar dan tidak dipakai sebagai bukti tunggal |
| Menghapus / membatasi | sampaikan ke kontak privasi perusahaan (`PRIVACY_CONTACT`, bawaan "tim HR") dengan menyebut rapat dan tanggalnya. Notulis/penyelenggara bisa **Buang draf** AI. (**Menunggu**: cara admin menghapus satu transkrip atau kalimat seseorang dari transkrip) |
| Keberatan / pengaduan | ke kontak privasi perusahaan, atau ke lembaga pelindungan data pribadi sesuai UU PDP |

Permintaan ditanggapi sesuai jangka waktu UU PDP. Penghapusan tidak berlaku untuk data yang wajib disimpan karena kewajiban hukum.

## 9. Kebijakan privasi aplikasi

`resources/markdown/privacy-policy.md` kini menyebut **rapat video** (kehadiran dicatat, rapat & chat tidak direkam). Bagian **notulen otomatis** dan **penyedia AI di luar negeri** ditambahkan saat fiturnya selesai dan dinyalakan; usulan teksnya:

> **Notulen otomatis (bila dinyalakan untuk sebuah rapat):** suara mikrofon peserta yang tidak menolak direkam sementara di server rapat perusahaan di Indonesia, ditranskrip setelah rapat, lalu audionya dihapus. Transkrip (teks, nama pembicara, waktu) hanya untuk peserta rapat dan disimpan 90 hari. Teks transkrip dikirim ke penyedia AI {{penyedia}} di {{negara}} untuk membuat draf ringkasan yang diperiksa notulis. Anda dapat menolak dengan sakelar "Jangan transkrip suara saya" sebelum atau selama rapat.

Setiap perubahan isi kebijakan: naikkan `PRIVACY_POLICY_VERSION` dan `PRIVACY_POLICY_DATE`. Perhatikan bahwa versi ini juga dipakai persetujuan lokasi & selfie absensi (`config/attendance.php`), sehingga semua karyawan diminta menyetujui ulang sebelum check-in GPS + selfie berikutnya.

## 10. Daftar periksa sebelum notulen otomatis dinyalakan di produksi

- [ ] Dasar pemrosesan dan dasar transfer ke luar negeri (§3, §6) diputuskan pemilik dan dicatat.
- [ ] Penilaian dampak pelindungan data (UU PDP Pasal 34; teknologi baru + suara karyawan) dibuat singkat: risiko, mitigasi (§6), keputusan.
- [ ] Perjanjian/ketentuan dengan penyedia AI diperiksa (retensi, pelatihan model, lokasi).
- [ ] Kebijakan privasi diperbarui (§9) + versi dinaikkan; karyawan diberi tahu lewat Pengumuman.
- [ ] Retensi 90 hari benar-benar berjalan (job penghapusan diuji) dan nilainya sama dengan teks kartu persetujuan.
- [ ] Hak akses transkrip & draf diuji (Policy + test Pest), termasuk peserta yang menolak dan pengamat rapat pimpinan.
- [ ] Rotasi log Docker di VPS rapat aktif; akses SSH VPS rapat dibatasi.
- [ ] Retensi kehadiran ruang video diputuskan.
- [ ] Data rapat masuk ekspor **Data Saya**, atau prosedur manualnya ditulis.
