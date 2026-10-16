# Draf listing Google Play & formulir Keamanan data

Draf untuk Play Console aplikasi **RuangKerja** (`store.spkd.ruangkerja`, versi 1.1.0 / versionCode 2). Sumber: spec `docs/mockups/android/spec/12-android-native.md` §7, mockup `12-android-native/28–31`, izin di `apps/mobile/app.json`. Bagian bertanda **[pemilik]** perlu diisi/diputuskan pemilik sebelum diajukan. Cara membangun & mengunggah: [`ANDROID-RILIS.md`](ANDROID-RILIS.md).

## 1. Detail aplikasi

| Kolom Play | Isi |
|---|---|
| Nama aplikasi (≤ 30) | RuangKerja |
| Deskripsi singkat (≤ 80) | Absen, tugas, rapat, dan notulensi karyawan SPKD dalam satu aplikasi. |
| Bahasa bawaan | Indonesia (id-ID) |
| Kategori | Bisnis |
| Tag | Produktivitas, Manajemen tugas, Kolaborasi tim |
| Jenis | Aplikasi · Gratis · tanpa iklan · tanpa pembelian dalam aplikasi |
| Nama pengembang | **[pemilik]** usulan: SPKD (harus sama dengan profil akun Play Console) |
| Email kontak (wajib, publik) | **[pemilik]** mis. `android@spkd.store` |
| Situs | https://spkd.store **[pemilik: konfirmasi]** |
| Telepon (opsional) | **[pemilik]** |
| Kebijakan privasi | https://spkd.store/kebijakan-privasi (rute web publik `/kebijakan-privasi`; `ANDROID-AKUN.md` masih menulis `/privasi` — yang benar `/kebijakan-privasi`) |

### Deskripsi lengkap (≤ 4.000)

> RuangKerja adalah aplikasi kerja internal untuk karyawan SPKD.
>
> • **Absen masuk dan pulang** dengan GPS dan selfie, atau pindai QR kiosk kantor. Lokasi dan selfie hanya dibaca saat Anda absen.
> • **Tugas hari ini** jelas dan terurut: rencanakan, tandai selesai, komentari, dan lampirkan berkas.
> • **Pengajuan dan persetujuan**: ajukan izin, sakit, koreksi absen, atau pengajuan barang; atasan menyetujui langsung dari ponsel.
> • **Rapat video dan notulen**: gabung rapat, catat notulensi bersama, dan ubah tindak lanjut menjadi tugas.
> • **Obrolan tim** per workspace, pesan langsung, dan thread.
> • **Laporan harian** dan pengumuman kantor.
> • Tablet dan ponsel lipat didukung dengan tampilan dua panel.
>
> Masuk dengan akun yang didaftarkan HR perusahaan; tidak ada pendaftaran mandiri. RuangKerja mengukur hasil kerja, bukan mengawasi: tidak ada pelacakan lokasi terus-menerus, tidak ada tangkapan layar, dan tidak ada skor produktivitas.

### Catatan rilis 1.1.0 (≤ 500)

> Tampilan tablet dan ponsel lipat (navigasi samping, Tugas dua panel, Obrolan tiga kolom, bisa diputar), ikon baru dengan dukungan ikon bertema Android 13, layar pembuka mode gelap, dan perbaikan kecil.

## 2. Aset grafis (draf, `apps/mobile/store/play/`)

Dibuat dari mockup oleh `node apps/mobile/scripts/aset.mjs`. Screenshot masih **render mockup** (data contoh persona); sebelum produksi sebaiknya diganti tangkapan aplikasi sungguhan dengan akun demo — Play menolak gambar yang tidak mencerminkan aplikasi.

| Aset | Berkas | Ukuran |
|---|---|---|
| Ikon aplikasi | `icon-512.png` | 512 × 512, PNG tanpa alfa |
| Feature graphic | `feature-graphic-a.png` (gradien + ponsel miring) · `feature-graphic-b.png` (terang, widget) | 1024 × 500, PNG 24-bit — **[pemilik] pilih A atau B** (usulan: A; B menampilkan widget yang belum ada di aplikasi) |
| Screenshot ponsel | `ponsel-1.jpg` … `ponsel-8.jpg` | 1080 × 1920 (9:16) |
| Screenshot tablet 7" & 10" | `tablet-1.jpg` … `tablet-4.jpg` | 2224 × 1888 |
| Video promo | — | tidak dibuat |

Teks bantu screenshot ponsel (urut): Mulai kerja dengan satu ketukan · Absen dengan GPS dan selfie · Tugas hari ini, jelas dan terurut · Setujui pengajuan sambil jalan · Rapat video dan notulen · Obrolan tim di ponsel · Catat notulensi dengan cepat · Pantau proyek dan tim.

## 3. Konten aplikasi

| Formulir | Jawaban |
|---|---|
| Akses aplikasi | **Semua fungsi dibatasi login.** Berikan akun peninjau khusus di **produksi** (akun `*@demo.test` hanya lokal): **[pemilik]** buat karyawan "Peninjau Google Play" (peran Anggota, tanpa data sungguhan, sandi kuat yang hanya ditulis di Play Console) + petunjuk: "Masuk dengan email dan kata sandi di bawah. Absen membutuhkan izin lokasi; di luar lokasi kantor pilih WFH bila tersedia." |
| Iklan | Tidak berisi iklan |
| Rating konten (IARC) | Kategori *Utilitas, Produktivitas, Komunikasi, atau Lainnya*; tidak ada kekerasan/seksual/narkoba/judi; **pengguna dapat berinteraksi** (obrolan, rapat video — internal karyawan); berbagi lokasi pengguna dengan pengguna lain: **Tidak** (lokasi absen hanya terlihat HR/atasan, bukan dibagikan ke sesama pengguna sebagai fitur) |
| Target audiens | 18 tahun ke atas; tidak menarik bagi anak-anak |
| Aplikasi berita / pemerintah / keuangan / kesehatan | Bukan |
| Deklarasi izin | **Layanan latar depan `mediaProjection`**: berbagi layar saat rapat video, selalu dimulai pengguna, notifikasi berjalan selama berbagi. Lokasi: hanya saat aplikasi dipakai (tanpa `ACCESS_BACKGROUND_LOCATION`). Tanpa izin SMS/panggilan/semua berkas |
| Kebijakan Keluarga | Tidak ikut |

## 4. Keamanan data (Data safety)

**Ringkasan praktik:** data dienkripsi saat dikirim (HTTPS/TLS, WSS untuk rapat) — **Ya**. Pengguna dapat meminta data dihapus — **Ya** (lewat HR; ekspor data sendiri di Privasi › Data Saya; jelaskan di kebijakan privasi). Tinjauan keamanan independen — Tidak. Tidak ada data yang **dijual** atau **dibagikan** ke pihak ketiga; server milik perusahaan (VPS + object storage) dan LiveKit milik sendiri dihitung sebagai pemrosesan oleh pengembang, bukan berbagi.

| Kategori Play | Jenis data | Dikumpulkan | Dibagikan | Diproses efemeral | Wajib/opsional | Tujuan |
|---|---|---|---|---|---|---|
| Lokasi | Lokasi tepat | Ya — hanya saat check-in/out | **Ya — lokasi deskriptif + peta kecil pada foto ke grup WhatsApp; server meneruskan koordinat ke Nominatim/OpenStreetMap untuk nama lokasi** | Tidak (bukti absensi) | Wajib untuk absen GPS | Fungsi aplikasi; pencegahan penipuan (penanda akurasi/lompatan lokasi) |
| Lokasi | Lokasi perkiraan | Ya (Android memberi pilihan "Perkiraan"; check-in lalu ditandai akurasi rendah) | Tidak | Tidak | Wajib untuk absen GPS | Fungsi aplikasi |
| Info pribadi | Nama, email, ID pengguna | Ya | Tidak | Tidak | Wajib | Fungsi aplikasi, manajemen akun |
| Info pribadi | Nomor telepon, alamat | Tidak dikumpulkan **oleh aplikasi** (diisi HR di web) | — | — | — | — |
| Foto dan video | Foto (selfie absen, lampiran pengajuan/tugas) | Ya | **Ya — selfie bercap (jam, tanggal, lokasi, peta kecil) dikirim ke grup WhatsApp perusahaan** (Meta/WhatsApp; anggota grup ditetapkan perusahaan) | Tidak (selfie disimpan 12 bulan lalu dihapus otomatis) | Selfie wajib untuk absen GPS; lampiran opsional | Fungsi aplikasi; pencegahan penipuan |
| Foto dan video | Video (kamera di rapat video) | Ya — dialirkan ke peserta rapat, **tidak direkam** | Tidak | **Ya** | Opsional | Fungsi aplikasi |
| Audio | Rekaman suara (mikrofon di rapat video) | Ya — dialirkan ke peserta; bila penyelenggara menyalakan *notulen otomatis*, suara ditranskrip di server rapat lalu **audio dihapus**, transkrip teks disimpan ≤ 90 hari | Tidak | Tidak (ada pemrosesan transkrip) | Opsional (bisa "Jangan transkrip suara saya") | Fungsi aplikasi |
| File dan dokumen | Berkas lampiran | Ya | Tidak | Tidak | Opsional | Fungsi aplikasi |
| Pesan | Pesan dalam aplikasi lainnya (obrolan, komentar) | Ya | Tidak | Tidak | Opsional | Fungsi aplikasi |
| Aktivitas aplikasi | Interaksi dalam aplikasi; konten buatan pengguna lainnya (tugas, laporan harian, pengajuan, notulen) | Ya | Tidak | Tidak | Wajib (tugas/laporan bagian dari pekerjaan) | Fungsi aplikasi |
| Kesehatan & kebugaran | Info kesehatan (surat dokter pada pengajuan sakit) | Ya | Tidak | Tidak | Opsional (wajib lampiran bila sakit > 1 hari) | Fungsi aplikasi |
| Info & performa aplikasi | Log kerusakan, diagnostik | Tidak (belum ada Sentry/Crashlytics) — **[pemilik]** ubah bila dipasang | — | — | — | — |
| ID perangkat atau lainnya | ID perangkat (SHA-256 dari Android ID, nama model, versi aplikasi) | Ya | Tidak | Tidak | Wajib | Fungsi aplikasi; keamanan/pencegahan penipuan (penanda perangkat baru saat absen, daftar perangkat masuk) |
| Biometrik | Sidik jari/wajah untuk membuka kunci aplikasi | Tidak — diproses sistem Android, aplikasi hanya menerima hasil berhasil/gagal | — | — | — | — |
| Keuangan, kontak, kalender, SMS, riwayat penelusuran, aplikasi terpasang | — | Tidak | — | — | — | — |

**Sudah berlaku di 1.2.x:** token push FCM → tambahkan "ID perangkat atau lainnya" (dikumpulkan, dibagikan ke Google/Firebase sebagai pemroses pengiriman). Catatan: , template wajah Fase 3 (opt-in → "Biometrik"), widget layar utama (tidak menambah jenis data).

## 5. Jalur rilis

Uji internal (≤ 100 penguji, tanpa tinjauan panjang) → uji tertutup (**[pemilik]** daftar penguji; akun pengembang **personal** baru wajib memenuhi syarat penguji minimum selama periode tertentu sebelum produksi — periksa aturan terbaru di Play Console) → produksi bertahap 10 → 50 → 100%. Untuk aplikasi khusus karyawan, alternatifnya **Managed Google Play / aplikasi pribadi** lewat Google Workspace (tanpa listing publik) — **[pemilik]** pertimbangkan bila tidak ingin aplikasi tampil di toko umum.
