# Rapat video & notulen otomatis: privasi dan kepatuhan (UU PDP)

> **Status 8 Okt 2026.** Diperiksa terhadap kode akhir (gabungan `claude/rapat-ui`, `claude/rapat-backend`, `claude/notulen-otomatis`, perbaikan audit `docs/security/AUDIT-RAPAT-2026-10.md`) dan kontrak `docs/fitur/rapat-video-kontrak.md`, `docs/fitur/notulen-otomatis-kontrak.md`. Rapat video **berjalan** di server; notulen otomatis **siap secara kode**, belum dinyalakan di produksi (worker belum dipasang, keputusan pemilik §10). Subtitle langsung = rencana tahap 2. Untuk karyawan, HR, pimpinan, dan pengelola data. Panduan pemakaian: [rapat-video](rapat-video.md) · operasional: `docs/deploy/RAPAT-VIDEO.md` · kebijakan privasi aplikasi: `/kebijakan-privasi` (sumber `resources/markdown/privacy-policy.md`).

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
| | identitas di ruang: id karyawan, nama, URL foto profil, penanda penyelenggara, tangan terangkat, bagian notulen yang sedang dilihat | token akses (10 menit) & atribut ruang yang diatur server | terlihat oleh perangkat peserta lain di ruang yang sama. Pilihan "menolak transkrip" **tidak pernah** menjadi atribut ruang (privat, server → worker) |
| | **kehadiran**: id karyawan, jam masuk, jam keluar, durasi, id sesi | basis data aplikasi, `meeting_attendances` | dari webhook LiveKit; satu baris per sesi (putus-sambung = baris baru); keterlambatan dihitung saat ditampilkan |
| | **Panggil**, **bisukan**, **keluarkan / izinkan masuk lagi** | log audit (`meeting.video_participant_called`, `…_muted`, `…_removed`, `…_readmitted`), `meeting_video_removals` + notifikasi | |
| | log teknis: identitas peserta, alamat IP, kualitas koneksi | log Docker di VPS rapat | untuk penanganan gangguan; atur rotasi log (`docs/deploy/RAPAT-VIDEO.md` §9) |
| Notulen (dokumen) | isi notulen, keputusan, tindak lanjut, versi, penulis, sumber notulen yang dipilih | basis data aplikasi | sama dengan notulen biasa (`docs/fitur/rapat-kalender.md`) |
| Waktu bicara | lama bicara (milidetik) per orang per tanggal rapat | basis data aplikasi, `meeting_speaking_times` | dihitung browser tiap peserta untuk dirinya sendiri dari deteksi bicara, dikirim tiap 15 detik |
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
| Status notulen otomatis (aktif, Merekam/…/Siap) | ✓ | ✓ | ✓ | ✓ hanya status (tanpa nama pembicara, jumlah penolak, isi transkrip/draf) | 404 |
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
| Waktu bicara | sama dengan transkrip: 90 hari (`PruneSpeakingTimes`, harian 03.20 WIB) |
| Kehadiran ruang video, pilihan menolak, larangan masuk | belum ada penghapusan otomatis (**keputusan pemilik**, mis. mengikuti retensi data kerja) |
| Log audit (akses transkrip, perubahan pengaturan) | seperti log audit lain |
| Log teknis server rapat | sesuai rotasi log Docker di VPS rapat |
| Data di penyedia AI | menurut ketentuan penyedia (**perlu diperiksa**, §6) |

## 6. Pemrosesan di luar Indonesia (penyedia AI)

- Penyedia ringkasan diatur admin (`MINUTES_LLM_*`, API kompatibel OpenAI). Bawaan: **DeepSeek** (`https://api.deepseek.com`, model `deepseek-chat`), servernya **di luar Indonesia**. Nama penyedia dan tanda "di luar Indonesia" ikut dikirim ke tampilan (`llm.provider`, `llm.outside_indonesia`) agar bisa disebut di layar. Tanpa kunci API, transkrip tetap disimpan tetapi **tidak ada** yang dikirim ke penyedia.
- Yang dikirim per rapat (diperiksa di `MinutesSummarizer`): judul rapat, tanggal, judul agenda, **teks transkrip bernomor dengan waktu dan nama tampilan pembicara**, dan daftar nama peserta yang **berbicara dan tidak menolak** (rapat panjang dikirim per potongan ±40.000 karakter lalu digabung). **Tidak** dikirim: audio, email, id, jabatan, nama yang menolak. Nama **tidak disamarkan**. Setiap **Ringkas ulang** mengirim lagi dan dicatat di log audit (`meeting.transcript_resummarized`).
- UU PDP **Pasal 56**: transfer data pribadi ke luar wilayah hukum Indonesia hanya boleh bila negara tujuan memiliki pelindungan setara atau lebih tinggi, atau ada pelindungan yang memadai dan mengikat, atau dengan persetujuan subjek data. Sebelum menyalakan fitur ini di produksi pemilik perlu memilih dasarnya dan mencatatnya.
- Langkah yang disarankan:
  1. Sebut penyedia AI dan negaranya di kebijakan privasi (§9) dan di kartu "Notulen otomatis aktif".
  2. Minimalkan lebih jauh (opsional): nama samaran ("Pembicara 1") yang dipetakan kembali di aplikasi.
  3. Periksa ketentuan API penyedia: lama penyimpanan masukan, dan apakah masukan dipakai untuk melatih model; pilih pengaturan yang tidak memakai data untuk pelatihan bila ada.
  4. **Penyedia bisa diganti** (runbook R4 di `docs/deploy/RAPAT-VIDEO.md`): penyedia dengan server di Indonesia atau model di server sendiri menghilangkan transfer ke luar negeri. Rapat yang sangat rahasia sebaiknya tanpa notulen otomatis.
- Transkripsi suara (faster-whisper) **berjalan di server sendiri di Indonesia**; tahap 2 (GPU) juga direncanakan di Indonesia.

## 7. Pemberitahuan, persetujuan, dan menolak

1. **Sebelum masuk** (layar pra-gabung), bila notulen otomatis aktif: kartu **"Notulen otomatis aktif"** (wajib tampil) berisi: *"Audio dihapus segera setelah transkripsi."*, *"Transkrip disimpan 90 hari dan hanya bisa dibuka peserta rapat."*, *"Ringkasan diproses oleh DeepSeek di luar Indonesia."* (bila ringkasan AI aktif; nama penyedia dari konfigurasi), dan *"Anda bisa memilih \"Jangan transkrip suara saya\"."*, dengan sakelar **"Jangan transkrip suara saya"**. Kartu yang sama ada di detail rapat.
2. **Selama rapat**: chip "Notulen otomatis aktif" terlihat di ruang, dengan sakelar yang sama. Sakelar di ruang: ⋯ › **Setelan perangkat & transkrip**. Menolak di tengah rapat: aplikasi langsung meminta worker berhenti berlangganan mikrofon Anda dan **menghapus rekaman suara Anda yang sudah ada**.
3. **Sesudah rapat**: menolak tetap bisa. Kalimat Anda dihapus dari semua transkrip rapat itu (seri) yang **belum** dimasukkan ke notulen, dan draf AI dibuat ulang tanpa kalimat Anda (bila tidak bisa dibuat ulang, draf dibuang). Teks yang sudah dimasukkan ke notulen harus diperbaiki notulis atas permintaan (§8).
4. **Cakupan**: pilihan berlaku per orang **per rapat (seluruh seri)** sampai diubah, dan dicatat di log audit. Mematikan notulen otomatis oleh penyelenggara selalu bisa.
5. **Cara kerjanya**: pilihan Anda **privat**, hanya dikirim server ke worker dalam permintaan bertanda tangan (bukan atribut LiveKit yang diterima semua klien). Worker tidak pernah berlangganan mikrofon orang yang menolak, jadi suaranya tidak sampai ke mesin transkripsi; kalimatnya juga dibuang lagi saat transkrip diterima. Halaman draf hanya menampilkan **jumlah** yang menolak, tanpa nama; pengamat rapat pimpinan bahkan tidak melihat jumlahnya.


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

`resources/markdown/privacy-policy.md` (halaman `/kebijakan-privasi`) kini menyebut: rapat & rapat video (kehadiran dan lama bicara dicatat; gambar, suara, layar, obrolan tidak direkam; server rapat di Indonesia), notulen otomatis (audio sementara dihapus setelah transkripsi; menolak sebelum, selama, atau sesudah rapat), penyedia AI ringkasan yang memproses **di luar Indonesia** (bawaan DeepSeek; yang dikirim: teks transkrip, nama tampilan pembicara, judul, agenda), dan retensi transkrip 90 hari.

**Versi kebijakan belum dinaikkan.** Saat rilis, naikkan `PRIVACY_POLICY_VERSION` dan `PRIVACY_POLICY_DATE` (keputusan pemilik). Versi ini juga dipakai persetujuan lokasi & selfie absensi (`config/attendance.php`), sehingga semua karyawan diminta menyetujui ulang sebelum check-in GPS + selfie berikutnya. Bila penyedia AI diganti, perbarui nama penyedia di kebijakan dan `MINUTES_LLM_PROVIDER`/`MINUTES_LLM_OUTSIDE_INDONESIA`.

## 10. Daftar periksa sebelum notulen otomatis dinyalakan di produksi

- [ ] Dasar pemrosesan dan dasar transfer ke luar negeri (§3, §6) diputuskan pemilik dan dicatat.
- [ ] Penilaian dampak pelindungan data (UU PDP Pasal 34; teknologi baru + suara karyawan) dibuat singkat: risiko, mitigasi (§6), keputusan.
- [ ] Ketentuan penyedia AI diperiksa (retensi, pelatihan model, lokasi); `MINUTES_LLM_PROVIDER` dan `MINUTES_LLM_OUTSIDE_INDONESIA` sesuai penyedia yang dipakai.
- [ ] **Opt-out atau opt-in** diputuskan pemilik. Sekarang opt-out: semua peserta ditranskrip kecuali menolak. Opt-in (hanya yang menyetujui) butuh perubahan kode.
- [x] Teks kebijakan privasi diperbarui (§9). [ ] Versi dinaikkan saat rilis + karyawan diberi tahu lewat Pengumuman.
- [x] Kartu pemberitahuan pra-gabung & detail rapat menyebut audio dihapus, 90 hari, penyedia AI di luar negeri, dan pilihan menolak.
- [ ] Job `PurgeExpiredMeetingTranscripts` dan `PruneSpeakingTimes` berjalan di scheduler produksi; `MINUTES_TRANSCRIPT_RETENTION_DAYS` sama dengan teks di layar.
- [x] Hak akses transkrip & draf diuji (Policy + test Pest, termasuk peserta yang menolak dan pengamat rapat pimpinan; `tests/Feature/Meetings/NotulenOtomatisTest.php`, `tests/Feature/Audit/NotulenAuditTest.php`).
- [ ] Rotasi log Docker di VPS rapat aktif; akses SSH VPS rapat dibatasi; port worker (8090) tidak terbuka ke internet.
- [ ] Retensi kehadiran ruang video, pilihan menolak, dan larangan masuk diputuskan (waktu bicara sudah 90 hari).
- [ ] Data rapat masuk ekspor **Data Saya**, atau prosedur manualnya ditulis.
