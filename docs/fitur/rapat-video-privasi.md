# Rapat video & notulen otomatis: privasi dan kepatuhan (UU PDP)

> **Status 7 Okt 2026.** Rapat video (Video RuangKerja) dan kehadiran dari ruang video **nyata** di `main`. Notulen otomatis (worker transkripsi, transkrip, persetujuan, draf AI, retensi) **sudah dibangun** di branch `claude/notulen-otomatis` dan diperiksa terhadap kodenya serta `docs/fitur/notulen-otomatis-kontrak.md`; waktu bicara & kehadiran di ruang mengikuti `docs/fitur/rapat-video-kontrak.md` (branch `claude/rapat-backend`). Yang belum ada kodenya diberi tanda **Menunggu**. Subtitle langsung = rencana tahap 2. Untuk karyawan, HR, pimpinan, dan pengelola data. Panduan pemakaian: [rapat-video](rapat-video.md) · operasional: `docs/deploy/RAPAT-VIDEO.md` · kebijakan privasi aplikasi: `/kebijakan-privasi` (sumber `resources/markdown/privacy-policy.md`).

## 1. Ringkasan

- **Rapat video tidak direkam.** Gambar dan suara hanya diteruskan (tidak disimpan) oleh server rapat milik perusahaan di Indonesia. Chat di dalam rapat tidak disimpan.
- **Kehadiran dan waktu bicara dicatat**: jam masuk dan keluar ruang video, serta lama bicara tiap peserta, untuk notulen dan agar rapat adil. Bukan untuk penilaian kinerja.
- **Notulen otomatis hanya berjalan bila penyelenggara menyalakannya** untuk rapat itu, dan setiap peserta diberi tahu sebelum masuk. Suara mikrofon direkam sementara untuk ditulis menjadi teks setelah rapat; **audio dihapus segera setelah ditranskrip**. Transkrip hanya untuk penyelenggara, notulis, dan peserta yang diundang, dan **dihapus otomatis 90 hari** setelah rapat.
- **Anda boleh menolak** dengan sakelar **"Jangan transkrip suara saya"**, sebelum, selama, atau sesudah rapat (§7).
- **Ringkasan AI** dibuat dari **teks** transkrip oleh penyedia AI (bawaan **DeepSeek**, di luar Indonesia; bisa diganti). Audio tidak pernah dikirim ke penyedia AI. Draf AI selalu diperiksa notulis sebelum menjadi notulen.

## 2. Data yang diproses

| Fitur | Data | Disimpan di | Keterangan |
|---|---|---|---|
| Rapat video (semua rapat "Video RuangKerja") | video, suara, layar yang dibagikan | **tidak disimpan**; diteruskan server rapat (LiveKit) di VPS Biznet Indonesia | media WebRTC terenkripsi di jalur (DTLS-SRTP) antara browser dan server rapat; server rapat meneruskannya ke peserta lain (bukan enkripsi ujung-ke-ujung) |
| | chat, angkat tangan | tidak disimpan | lewat data channel LiveKit selama rapat |
| | identitas di ruang: id karyawan, nama, URL foto profil, penanda penyelenggara, tanda "menolak transkrip" | token akses (10 menit) & atribut ruang | terlihat oleh perangkat peserta lain di ruang yang sama (tanda menolak tidak ditampilkan di layar) |
| | **kehadiran**: id karyawan, jam masuk, jam keluar, durasi, id sesi | basis data aplikasi, `meeting_attendances` | dari webhook LiveKit; satu baris per sesi (putus-sambung = baris baru); keterlambatan dihitung saat ditampilkan |
| | **Panggil**: siapa memanggil siapa, kapan | log audit (`meeting.video_participant_called`) + notifikasi | rancangan kontrak rapat (**Menunggu** kode) |
| | log teknis: identitas peserta, alamat IP, kualitas koneksi | log Docker di VPS rapat | untuk penanganan gangguan; atur rotasi log (`docs/deploy/RAPAT-VIDEO.md` §9) |
| Notulen (dokumen) | isi notulen, keputusan, tindak lanjut, versi, penulis, sumber notulen yang dipilih | basis data aplikasi | sama dengan notulen biasa (`docs/fitur/rapat-kalender.md`) |
| Waktu bicara | lama bicara (milidetik) per orang per tanggal rapat | basis data aplikasi, `meeting_speaking_times` (**Menunggu** kode, kontrak rapat §3) | dihitung browser tiap peserta untuk dirinya sendiri dari deteksi bicara, dikirim tiap 15 detik |
| Notulen otomatis (bila dinyalakan) | pengaturan `auto_minutes` per rapat (seri) | `meetings.auto_minutes` | perubahan diaudit (`meeting.auto_minutes_changed`) |
| | **pilihan menolak** per orang per rapat (seri) | `meeting_transcript_consents` | perubahan diaudit (`meeting.transcript_consent_changed`) |
| | **audio mikrofon** peserta yang tidak menolak | spool sementara di VPS rapat (Indonesia), folder izin 700 | WAV per pembicara, nama berkas tanpa identitas; **dihapus setelah transkripsi**; sisa karena gangguan dihapus otomatis ≤ 24 jam |
| | **transkrip**: teks, id & nama pembicara, waktu (ms dari awal), bahasa, model | `meeting_transcripts.segments` | dikirim worker ke aplikasi dengan tanda tangan HMAC; kalimat orang yang menolak dibuang saat diterima |
| | **draf AI**: ringkasan, pembahasan per agenda, keputusan, usulan tindak lanjut, "perlu dicek" | `meeting_transcripts.draft` | dibuat penyedia AI dari teks transkrip (§6) |
| | akses ke transkrip | log audit `meeting.transcript_viewed` (maks. sekali per orang per transkrip per 10 menit), juga `…_draft_inserted`, `…_draft_discarded` | |
| Subtitle langsung (tahap 2, rencana) | teks sementara dari suara | dikirim ke peserta di ruang (LiveKit text stream `lk.transcription`) | aturan menolak sama dengan notulen otomatis |

Yang **tidak** diproses: rekaman video, rekaman layar, audio berbagi layar (tidak ditranskrip), sidik suara/biometrik (pembicara dikenali dari akun di ruang, bukan dari suara), dan aktivitas di luar ruang rapat.

## 3. Tujuan dan dasar pemrosesan

| Pemrosesan | Tujuan | Dasar (UU PDP Pasal 20) |
|---|---|---|
| Rapat video & chat | menjalankan rapat kerja | pelaksanaan perjanjian kerja (rapat adalah bagian pekerjaan) |
| Kehadiran ruang video, Panggil | daftar hadir notulen, mengetahui siapa yang sudah/belum masuk | kepentingan yang sah perusahaan; tidak dipakai untuk sanksi otomatis |
| Waktu bicara | membantu rapat yang adil (giliran bicara) | kepentingan yang sah; **bukan** ukuran kinerja |
| Notulen otomatis (audio sementara → transkrip → draf) | mempercepat dan melengkapi notulen | kepentingan yang sah, dengan pemberitahuan sebelum masuk dan **hak menolak per orang** |
| Pengiriman teks transkrip ke penyedia AI di luar negeri | membuat draf ringkasan | lihat §6 (transfer ke luar wilayah hukum Indonesia) |

Prinsip yang sama dengan kebijakan privasi aplikasi: data rapat **tidak** dipakai untuk menilai produktivitas atau perilaku di luar hasil kerja. Waktu bicara dan transkrip tidak boleh muncul di dashboard HR/pimpinan atau penilaian.

> Pilihan dasar hukum di atas adalah usulan dokumentasi. Pemilik/penanggung jawab data perlu mengonfirmasinya (bila perlu dengan penasihat hukum) sebelum notulen otomatis dinyalakan di produksi (§10).

## 4. Siapa yang dapat melihat

| Data | Penyelenggara | Notulis | Peserta internal (diundang) | Pengamat rapat pimpinan (Direksi/HR/Super Admin, tidak diundang) | Lainnya |
|---|---|---|---|---|---|
| Kehadiran ruang video (detail rapat) | ✓ | ✓ | ✓ | ✓ baca saja | tidak melihat rapat (404) |
| Masuk ruang video, waktu bicara, panel Kehadiran | ✓ | ✓ | ✓ | ✗ | 404 |
| Status notulen otomatis (aktif, Merekam/…/Siap) | ✓ | ✓ | ✓ | ✓ (tanpa isi draf) | 404 |
| **Transkrip** dan halaman notulen otomatis | ✓ | ✓ | ✓ | ✗ | 404 |
| Draf AI (lihat) | ✓ | ✓ | ✓ | ✗ | 404 |
| Kelola draf (masukkan, buang, ringkas ulang, jadikan tugas) | ✓ | ✓ | ✗ | ✗ | 404 |
| Nyalakan/matikan notulen otomatis | ✓ | ✗ | ✗ | ✗ | 404 |
| Notulen final | seperti notulen biasa | | | ✓ baca saja | 404 |
| Audio sementara | tidak seorang pun lewat aplikasi; hanya proses worker di VPS rapat (akses SSH dibatasi ke admin) | | | | |
| Penyedia AI | teks yang dikirim untuk diringkas (§6) | | | | |

Sumber: `MeetingPolicy` (main), `MeetingTranscriptPolicy` (branch notulen). Super Admin **tidak** otomatis melihat rapat biasa, transkrip, atau notulennya.

## 5. Retensi

| Data | Lama simpan |
|---|---|
| Video, suara, layar, chat | tidak disimpan |
| Audio untuk transkrip | dihapus segera setelah transkripsi (berhasil atau gagal); sisa karena gangguan dihapus otomatis setelah 24 jam (`TRANSCRIBER_SPOOL_MAX_AGE_HOURS`) |
| Transkrip yang belum terkirim ke aplikasi | di VPS rapat, maks. 24 jam |
| Transkrip + draf AI di aplikasi | **90 hari** setelah rapat (`MINUTES_TRANSCRIPT_RETENTION_DAYS`, kolom `purge_after`); job harian `PurgeExpiredMeetingTranscripts` pukul 02.45 WIB menghapus barisnya. "Buang draf" tidak menghapus transkrip lebih cepat |
| Teks yang sudah "Masukkan ke notulen" | menjadi bagian notulen dan **tidak** ikut terhapus setelah 90 hari |
| Notulen | seperti notulen biasa: belum ada penghapusan otomatis |
| Kehadiran ruang video, waktu bicara, pilihan menolak | belum ada penghapusan otomatis (**perlu keputusan**, mis. mengikuti retensi data kerja) |
| Log audit (akses transkrip, perubahan pengaturan) | seperti log audit lain |
| Log teknis server rapat | sesuai rotasi log Docker di VPS rapat |
| Data di penyedia AI | menurut ketentuan penyedia (**perlu diperiksa**, §6) |

## 6. Pemrosesan di luar Indonesia (penyedia AI)

- Penyedia ringkasan diatur admin (`MINUTES_LLM_*`, API kompatibel OpenAI). Bawaan: **DeepSeek** (`https://api.deepseek.com`, model `deepseek-chat`), servernya **di luar Indonesia**. Nama penyedia dan tanda "di luar Indonesia" ikut dikirim ke tampilan (`llm.provider`, `llm.outside_indonesia`) agar bisa disebut di layar. Tanpa kunci API, transkrip tetap disimpan tetapi **tidak ada** yang dikirim ke penyedia.
- Yang dikirim per rapat (diperiksa di `MinutesSummarizer`): judul rapat, tanggal, daftar agenda, **nama semua peserta yang diundang**, dan **teks transkrip bernomor dengan waktu dan nama pembicara** (rapat panjang dikirim per potongan ±40.000 karakter lalu digabung). **Tidak** dikirim: audio, email, nomor karyawan, id. Nama **tidak disamarkan**. Kalimat orang yang menolak sudah dibuang sebelumnya, tetapi namanya tetap ada di daftar peserta.
- UU PDP **Pasal 56**: transfer data pribadi ke luar wilayah hukum Indonesia hanya boleh bila negara tujuan memiliki pelindungan setara atau lebih tinggi, atau ada pelindungan yang memadai dan mengikat, atau dengan persetujuan subjek data. Sebelum menyalakan fitur ini di produksi pemilik perlu memilih dasarnya dan mencatatnya.
- Langkah yang disarankan:
  1. Sebut penyedia AI dan negaranya di kebijakan privasi (§9) dan di kartu "Notulen otomatis aktif".
  2. Minimalkan: pertimbangkan nama samaran ("Pembicara 1") yang dipetakan kembali di aplikasi, dan hanya mengirim nama peserta yang tidak menolak.
  3. Periksa ketentuan API penyedia: lama penyimpanan masukan, dan apakah masukan dipakai untuk melatih model; pilih pengaturan yang tidak memakai data untuk pelatihan bila ada.
  4. **Penyedia bisa diganti** (runbook R4 di `docs/deploy/RAPAT-VIDEO.md`): penyedia dengan server di Indonesia atau model di server sendiri menghilangkan transfer ke luar negeri. Rapat yang sangat rahasia sebaiknya tanpa notulen otomatis.
- Transkripsi suara (faster-whisper) **berjalan di server sendiri di Indonesia**; tahap 2 (GPU) juga direncanakan di Indonesia.

## 7. Pemberitahuan, persetujuan, dan menolak

1. **Sebelum masuk** (layar pra-gabung), bila notulen otomatis aktif: kartu **"Notulen otomatis aktif"** (wajib tampil; teks dari server: *"Notulen otomatis aktif — suara Anda ditranskrip setelah rapat"*, rancangan menambah *"audio langsung dihapus. Transkrip hanya untuk peserta, 90 hari."*) dengan sakelar **"Jangan transkrip suara saya"**. Pilihan disimpan **sebelum** token ruang diminta.
2. **Selama rapat**: chip "Notulen otomatis aktif" terlihat di ruang, dengan sakelar yang sama. Menolak di tengah rapat: aplikasi langsung meminta worker berhenti berlangganan mikrofon Anda dan **menghapus rekaman suara Anda yang sudah ada**; atribut ruang `rk_notulen_optout` menjadi lapisan kedua.
3. **Sesudah rapat**: menolak tetap bisa. Kalimat Anda dihapus dari semua transkrip rapat itu (seri) yang **belum** dimasukkan ke notulen, dan draf AI dibuat ulang tanpa kalimat Anda. Teks yang sudah dimasukkan ke notulen harus diperbaiki notulis atas permintaan (§8).
4. **Cakupan**: pilihan berlaku per orang **per rapat (seluruh seri)** sampai diubah, dan dicatat di log audit. Mematikan notulen otomatis oleh penyelenggara selalu bisa.
5. **Cara kerjanya**: worker tidak pernah berlangganan mikrofon orang yang menolak (daftar dari aplikasi + atribut ruang), jadi suaranya tidak sampai ke mesin transkripsi. Kalimat orang yang menolak juga dibuang lagi saat transkrip diterima aplikasi.

> **Menunggu (`claude/rapat-ui`):** letak sakelar di ruang rapat dan di detail rapat (untuk menolak sesudah rapat), serta tampilan di ponsel.

## 8. Hak Anda dan cara meminta penghapusan

| Hak | Cara |
|---|---|
| Mengetahui | dokumen ini, kartu pemberitahuan pra-gabung, dan kebijakan privasi (`/kebijakan-privasi`) |
| Menolak transkrip | sakelar "Jangan transkrip suara saya" (sebelum, selama, atau sesudah rapat; §7) |
| Melihat | transkrip rapat yang Anda ikuti di halaman **Notulen otomatis** rapat itu. Catatan: **Menu → Privasi & data saya** (ekspor Excel/PDF) **belum** memuat data rapat (kehadiran video, waktu bicara, transkrip); permintaan salinan disampaikan ke kontak privasi |
| Memperbaiki | minta notulis memperbaiki notulen; transkrip mesin bisa salah dengar dan tidak dipakai sebagai bukti tunggal |
| Menghapus / membatasi | kalimat Anda di transkrip: nyalakan "Jangan transkrip suara saya" (selama draf belum dimasukkan). Selain itu sampaikan ke kontak privasi perusahaan (`PRIVACY_CONTACT`, bawaan "tim HR") dengan menyebut rapat dan tanggalnya. Belum ada tombol admin untuk menghapus satu transkrip lebih awal; transkrip terhapus otomatis setelah 90 hari |
| Keberatan / pengaduan | ke kontak privasi perusahaan, atau ke lembaga pelindungan data pribadi sesuai UU PDP |

Permintaan ditanggapi sesuai jangka waktu UU PDP. Penghapusan tidak berlaku untuk data yang wajib disimpan karena kewajiban hukum.

## 9. Kebijakan privasi aplikasi

`resources/markdown/privacy-policy.md` sudah menyebut **rapat video** (kehadiran dicatat, rapat & chat tidak direkam). Bagian **notulen otomatis** dan **penyedia AI di luar negeri** ditambahkan saat fitur itu dirilis ke produksi; usulan teksnya:

> **Notulen otomatis (bila dinyalakan penyelenggara untuk sebuah rapat):** suara mikrofon peserta yang tidak menolak direkam sementara di server rapat perusahaan di Indonesia, ditranskrip setelah rapat, lalu audionya dihapus. Transkrip (teks, nama pembicara, waktu) hanya untuk penyelenggara, notulis, dan peserta rapat, dan dihapus otomatis 90 hari setelah rapat. Teks transkrip beserta nama peserta dan agenda dikirim ke penyedia AI {{penyedia}} di {{negara}} untuk membuat draf ringkasan yang diperiksa notulis. Anda dapat menolak dengan sakelar "Jangan transkrip suara saya" sebelum, selama, atau sesudah rapat. Lama bicara tiap peserta dicatat untuk membantu rapat yang adil, bukan untuk penilaian kinerja.

Setiap perubahan isi kebijakan: naikkan `PRIVACY_POLICY_VERSION` dan `PRIVACY_POLICY_DATE`. Versi ini juga dipakai persetujuan lokasi & selfie absensi (`config/attendance.php`), sehingga semua karyawan diminta menyetujui ulang sebelum check-in GPS + selfie berikutnya.

## 10. Daftar periksa sebelum notulen otomatis dinyalakan di produksi

- [ ] Dasar pemrosesan dan dasar transfer ke luar negeri (§3, §6) diputuskan pemilik dan dicatat.
- [ ] Penilaian dampak pelindungan data (UU PDP Pasal 34; teknologi baru + suara karyawan) dibuat singkat: risiko, mitigasi (§6), keputusan.
- [ ] Ketentuan penyedia AI diperiksa (retensi, pelatihan model, lokasi); `MINUTES_LLM_PROVIDER` dan `MINUTES_LLM_OUTSIDE_INDONESIA` sesuai penyedia yang dipakai.
- [ ] Kebijakan privasi diperbarui (§9) + versi dinaikkan; karyawan diberi tahu lewat Pengumuman.
- [ ] Kartu pemberitahuan pra-gabung menyebut audio dihapus, 90 hari, dan penyedia AI di luar negeri.
- [ ] Job `PurgeExpiredMeetingTranscripts` berjalan di scheduler produksi; `MINUTES_TRANSCRIPT_RETENTION_DAYS` sama dengan teks di layar.
- [ ] Hak akses transkrip & draf diuji (Policy + test Pest), termasuk peserta yang menolak dan pengamat rapat pimpinan.
- [ ] Rotasi log Docker di VPS rapat aktif; akses SSH VPS rapat dibatasi; port worker (8090) tidak terbuka ke internet.
- [ ] Retensi kehadiran ruang video dan waktu bicara diputuskan.
- [ ] Data rapat masuk ekspor **Data Saya**, atau prosedur manualnya ditulis.
