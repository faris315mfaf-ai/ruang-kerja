# PRD — RuangKerja (nama kode)

> **Status:** Draf v1.0 · 3 Oktober 2026
> **Pemilik produk:** Ris
> **Nama kode:** "RuangKerja" dipakai sementara sampai nama, logo, dan warna resmi (nuansa SPKD) diberikan. Semua branding disimpan di `config/branding.php` dan design token, jadi penggantian tidak menyentuh logika.

---

## 1. Ringkasan

RuangKerja adalah aplikasi kantor internal yang menyatukan empat kebutuhan dalam satu tempat:

1. **Absensi**: check-in/out (GPS, selfie, QR), shift, cuti, izin, sakit, lembur, dan persetujuan.
2. **Workspace**: ruang pribadi, tim, divisi, dan proyek. Masing-masing berisi task, dokumen, dan file.
3. **Ruang kolaborasi**: board Kanban, komentar, mention, dokumen Google, file Google Drive, lalu chat (Fase 2).
4. **Tracking & monitoring kerja berbasis output**: dashboard per peran (karyawan, kepala divisi, HR, direksi).

**Prinsip produk**
- *Output, bukan pengawasan.* Tidak ada screenshot layar, pelacakan aplikasi, atau lokasi kontinu. Lokasi hanya direkam saat check-in/out.
- *Pakai yang sudah ada.* File dan dokumen tinggal di Google Workspace (Shared Drive 2 TB). Kalender dan video call memakai Google Calendar/Meet. Aplikasi ini menjadi lapisan kerja di atasnya.
- *Cepat seperti Linear.* Navigasi keyboard, command palette (⌘K / Ctrl+K), dan transisi tanpa reload.

## 2. Konteks & sasaran

| Item | Keputusan |
|---|---|
| Pengguna | Internal, puluhan karyawan (perkiraan 20–100) |
| Platform | Web dulu (responsif + PWA). Mobile React Native di Fase 3 |
| Bahasa UI | Bahasa Indonesia saja |
| Zona waktu | Disimpan UTC, ditampilkan per zona waktu kantor (default `Asia/Jakarta`) |
| Hosting | VPS Biznet Gio (Docker Compose) |
| Identitas | Email kantor + kata sandi untuk semua karyawan (keputusan pemilik 6 Okt 2026); login Google Workspace **ditahan** |
| Tim pengembang | Ris + tim, dibantu Claude Code dan Z-AI |

**Sasaran terukur 3 bulan setelah Fase 1 rilis**
- ≥ 95% karyawan absen lewat RuangKerja (bukan rekap manual).
- ≥ 80% task tim tercatat di RuangKerja (bukan grup WhatsApp/Excel).
- Rekap absensi bulanan untuk payroll selesai < 30 menit (sebelumnya: manual).
- Pengajuan cuti/izin diputuskan rata-rata < 24 jam.

**Bukan sasaran (non-goals)**
- Payroll/penggajian penuh (hanya ekspor data).
- Pelacakan aktivitas komputer, screenshot, atau GPS terus-menerus.
- Editor dokumen pengganti Google Docs.
- Produk publik/SaaS (arsitektur tetap rapi agar bisa multi-perusahaan nanti, tapi tidak dibangun sekarang).

## 3. Struktur organisasi & peran

Struktur organisasi dan hak akses **dipisah**.

### 3.1 Struktur organisasi (garis pelaporan)

```
Perusahaan
└── Direksi (Direktur Utama, Direktur)
    └── Divisi (dipimpin Kepala Divisi)
        └── Tim (opsional, dipimpin Ketua Tim)
            └── Anggota
```
Setiap karyawan punya satu **atasan langsung** (`manager_id`). Atasan langsung menjadi penyetuju pertama untuk cuti, izin, lembur, dan koreksi absensi.

### 3.2 Peran akses (RBAC)

| Peran | Cakupan |
|---|---|
| **Super Admin** | Semua pengaturan sistem, integrasi Google, master data, audit log |
| **Direksi** | Dashboard Direksi (monitoring kerja), absensi, dan semua workspace non-pribadi (**baca saja** bila bukan anggota). Penyetuju akhir lembur di atas batas |
| **HR** | Kelola karyawan, shift, lokasi, jenis cuti, hari libur. Lihat dan koreksi absensi semua orang. Ekspor payroll. Penyetuju kedua cuti. Lihat semua workspace non-pribadi (**baca saja** bila bukan anggota) |
| **Kepala Divisi** | Lihat absensi dan kinerja divisinya. Penyetuju pertama untuk anggota divisi. Kelola workspace divisi |
| **Anggota** | Absensi diri, pengajuan, workspace tempat ia menjadi anggota |

- Peran **bertumpuk**: Kepala Divisi HR = peran `kepala_divisi` + `hr`.
- Di dalam workspace ada peran tersendiri: `owner`, `admin`, `member`, `viewer`.
- Implementasi memakai `spatie/laravel-permission` (peran global) dan tabel `workspace_members` (peran per workspace).

## 4. Fase rilis

| Fase | Isi | Target |
|---|---|---|
| **Fase 1 — MVP inti** | Auth & organisasi, **Hiring/rekrutmen (M11, keputusan pemilik 6 Okt 2026)**, absensi web, pengajuan + approval, workspace, task Kanban, komentar/mention, integrasi Drive & Google Docs, notifikasi in-app + email, dashboard, **portofolio & tracking proyek (Direksi)**, ekspor rekap | 8–10 minggu |
| **Fase 2 — Kolaborasi realtime** | Chat (channel + DM), catatan internal realtime (Tiptap + Yjs), Google Calendar + Meet, notifikasi WhatsApp, task berulang, ekspor payroll lanjutan | +6–8 minggu |
| **Fase 3 — Mobile & perangkat** | Aplikasi React Native (Expo), anti fake-GPS native, face recognition + liveness, mesin fingerprint (ZKTeco ADMS), KPI/OKR divisi | +8–10 minggu |

Estimasi mengasumsikan 2–3 developer dibantu AI coding tool. Angka ini harus dikalibrasi ulang setelah Sprint 1.

---

## 5. Fase 1 — Spesifikasi fitur

### M1. Autentikasi & Organisasi

**User stories**
- Sebagai karyawan, saya login dengan email kantor dan kata sandi; bila lupa, saya mengajukan reset dan HR menyetujuinya.
- Sebagai HR, saya mengatur kata sandi karyawan (mis. sandi sementara untuk karyawan baru) dan memutus permintaan reset.
- Sebagai HR, saya menambah karyawan, menentukan divisi, tim, jabatan, atasan, shift, dan mode kerja.
- Sebagai Super Admin, saya mengatur peran dan melihat audit log.

**Kebutuhan**
- **Keputusan pemilik 6 Okt 2026:** semua karyawan aktif login dengan **email + kata sandi**. Super Admin tetap wajib 2FA (TOTP); peran lain tanpa 2FA. Login Google (Socialite, domain dibatasi) **ditahan**: kode & rute tetap ada, tombolnya tidak ditampilkan.
- Pesan galat login selalu generik (email salah, sandi salah, sandi belum diatur, akun nonaktif) dan memakai waktu yang sama, sehingga keberadaan akun tidak bocor.
- Aturan kata sandi (keputusan pemilik 7 Okt 2026): karyawan **bebas** memilih (wajib, dikonfirmasi, maks. 255) asal bukan kata sandi bawaan perusahaan; Super Admin tetap minimal 8 karakter, tidak sama dengan alamat email, dan produksi menolak sandi yang pernah bocor. Ganti sandi sendiri di Pengaturan › Keamanan (sandi lama wajib, perangkat lain dikeluarkan).
- **HR mengatur kata sandi** di Admin › Karyawan › profil › "Atur kata sandi": "Sandi bawaan" (kata sandi bawaan perusahaan `EMPLOYEE_DEFAULT_PASSWORD`, bukan untuk Super Admin) atau ketik sendiri, opsi "wajib ganti saat login berikutnya". Karyawan baru (form & impor) otomatis mendapat sandi bawaan + wajib ganti saat login pertama; perintah `ruangkerja:reset-default-passwords` untuk reset massal. Semua sesi karyawan dikeluarkan, karyawan diberi notifikasi in-app + email (tanpa isi sandi). Sandi Super Admin hanya oleh Super Admin.
- **Lupa kata sandi dengan persetujuan HR:** karyawan mengisi email → halaman tunggu (teks sama untuk email tak dikenal) yang memeriksa status tiap 5 detik → HR menyetujui/menolak (alasan wajib) dari Admin › Karyawan → halaman karyawan otomatis pindah ke form sandi baru (berlaku 30 menit, hanya di peramban yang meminta) → sandi tersimpan, perangkat lain keluar, karyawan langsung masuk. Permintaan kedaluwarsa setelah 24 jam; satu permintaan aktif per karyawan. Tidak ada tautan reset lewat email.
- Akun hanya bisa login jika emailnya sudah didaftarkan HR (tidak ada pendaftaran mandiri).
- Halaman struktur organisasi (bagan) otomatis dari data divisi, tim, dan atasan. **Keputusan pemilik 6 Okt 2026:** tidak tersedia untuk **staf** (pengguna yang hanya berperan `anggota`, termasuk Ketua Tim tanpa peran lain): menu disembunyikan dan rute `/organisasi/struktur` 404.
- Impor karyawan via CSV/Excel.
- Audit log untuk semua perubahan data master dan keputusan approval.

### M2. Absensi

**Metode check-in Fase 1**

| Metode | Cara kerja | Kapan dipakai |
|---|---|---|
| **GPS + selfie** | Browser meminta lokasi + kamera depan. Server menghitung jarak ke lokasi kantor (haversine) vs radius geofence | Default kantor & hybrid |
| **QR dinamis** | Layar kiosk (tablet/TV) di kantor menampilkan QR yang berganti tiap 30 detik (token HMAC + timestamp). Karyawan memindai dari aplikasi | Kantor ramai. Mencegah titip absen lewat foto lokasi |
| **WFH / lapangan** | GPS + selfie tanpa syarat geofence, wajib catatan lokasi/aktivitas | Karyawan dengan mode `wfh`/`field` atau jadwal hari itu WFH/dinas |
| **Manual oleh HR** | Koreksi dengan alasan, tercatat di audit | Pengecualian |

Face recognition dan fingerprint ada di Fase 3. Skema data sudah menyiapkan kolom `method`.

**Aturan**
- Shift: jam masuk, jam pulang, istirahat, toleransi terlambat, toleransi pulang cepat, shift lintas tengah malam.
- Penugasan shift per karyawan (pola mingguan) + override per tanggal.
- Kalender libur nasional dan cuti bersama (diisi HR, bisa impor).
- Status harian otomatis (label UI → nilai di database): Hadir `present`, Terlambat `late`, Pulang cepat `early_leave`, Alpha `absent`, Cuti `leave`, Izin `permit`, Sakit `sick`, Dinas `business_trip`, Libur `holiday`, WFH `wfh`, Perlu koreksi `needs_correction`.
- Job terjadwal setiap 00:30 waktu kantor: tandai Alpha (`absent`) untuk yang tidak check-in dan tidak punya pengajuan disetujui. Lupa check-out → status Perlu koreksi (`needs_correction`).
- **Deteksi kecurangan dasar (web):** akurasi GPS > 100 m ditandai, lompatan lokasi tidak masuk akal, check-in dari IP/perangkat baru, selfie kosong/gelap. Semua hanya **ditandai** (`is_suspicious`) untuk ditinjau HR, tidak diblokir otomatis.

**Pengajuan & approval**
- Jenis: cuti (tahunan, besar, melahirkan, dll.), izin, sakit (lampiran surat dokter jika > 1 hari, dapat diatur), lembur, koreksi absensi, dinas luar, **pengajuan barang**.
- Saldo cuti per tahun per jenis, carry-over opsional. **Keputusan pemilik 6 Okt 2026:** saldo cuti tahunan **tidak ditampilkan dan tidak dikirim** ke staf (Beranda, Pengajuan saya, form, ringkasan, detail); penyetuju non-staf tetap melihat dampak saldo pemohon.
- **Jenis terkunci (keputusan pemilik 6 Okt 2026):** semua jenis kategori cuti dan lembur dikunci ("Dikunci sampai SOP cuti/lembur ditetapkan.") untuk semua karyawan. Form menampilkan ubin bergembok berisi alasan; server menolak membuat, menyimpan draf, atau mengirim pengajuan jenis terkunci; draf lama jenis terkunci hanya bisa dibatalkan. Pengajuan yang sudah dikirim/disetujui tidak berubah. HR membuka/mengunci di Admin › Jenis pengajuan.
- **Pengajuan barang (keputusan pemilik 6 Okt 2026):** nama barang, jumlah, satuan, perkiraan harga satuan (Rp), total otomatis, tautan referensi (opsional), alasan/kebutuhan, tingkat kebutuhan (biasa/mendesak). Tanggal = tanggal dikirim; tidak memengaruhi absensi, saldo, rekap, atau daftar rekan absen; tidak bentrok dengan pengajuan lain. Jenis bawaan `BRG` dengan alur bawaan "Pengajuan barang": **atasan langsung → Direksi**.
- **Pembatalan setelah disetujui (backlog 7 Okt 2026):** pemohon hanya bisa membatalkan selama belum diputus. Pengajuan yang **sudah disetujui** dibatalkan oleh **HR / Super Admin** (permission `requests.cancel_approved`, bukan pengajuan sendiri) dari Persetujuan (tab **Disetujui** atau detail) dengan **alasan wajib**: saldo cuti dikembalikan, catatan absensi cuti/izin/sakit/dinas dihapus (tanggal yang sudah lewat langsung ditutup ulang — tanpa check-in menjadi Alpha), lembur dihitung ulang, koreksi absensi dikembalikan ke jam sebelumnya (ditolak bila hari itu sudah berubah lagi). Pemohon, penyetuju, dan pengganti diberi tahu; alasan hanya tampil di aplikasi.
- Alur default: **Atasan langsung → HR**. Lembur di atas X jam/bulan → tambah **Direksi**. Alur dapat dikonfigurasi per jenis pengajuan.
- Penyetuju bisa menyetujui, menolak (wajib alasan), atau meminta revisi. Delegasi saat penyetuju cuti.
- Notifikasi ke penyetuju dan pemohon di setiap langkah.

**Rekap & ekspor**
- Rekap bulanan per karyawan: hari kerja, hadir, terlambat (kali & menit), alpha, cuti, izin, sakit, lembur (jam).
- Ekspor Excel (format siap payroll) dan PDF.

### M3. Workspace

| Tipe | Dibuat oleh | Anggota default | Contoh |
|---|---|---|---|
| **Pribadi** | Otomatis untuk tiap karyawan | Hanya pemilik | Catatan & task pribadi |
| **Tim** | Ketua tim / Kepala Divisi | Anggota tim | "Tim Konten" |
| **Divisi** | Otomatis saat divisi dibuat | Seluruh anggota divisi (sinkron) | "Divisi Keuangan" |
| **Proyek** | Siapa pun (dengan izin) | Dipilih manual, lintas divisi | "Peluncuran Produk X" |

Setiap workspace punya:
- **Task**: tampilan Board (Kanban), List, dan Kalender.
- **Dokumen**: daftar Google Docs/Sheets/Slides milik workspace + catatan singkat internal.
- **File**: folder Google Drive milik workspace (dibuat otomatis di Shared Drive).
- **Aktivitas**: feed perubahan.
- **Pengaturan**: anggota, peran, status kolom, label, prefix nomor task (mis. `KEU-12`).

Visibilitas: `private` (hanya anggota) atau `internal` (semua karyawan bisa melihat, hanya anggota yang mengubah). Direksi bisa melihat semua workspace non-pribadi.

**Pengelompokan (keputusan pemilik 6 Okt 2026):** daftar `/workspace`, grid Menu ponsel, dan stack Workspace di Dock/Rail dikelompokkan **Pribadi** · **Divisi & tim** (workspace divisi/tim tempat ia anggota) · **Proyek yang diikuti**, ditambah **Lainnya (lihat saja)** bagi yang melihat workspace tanpa menjadi anggota. Chip filter Semua · Pribadi · Divisi & tim · Proyek bertitik warna, tersimpan di `?jenis=`; kelompok kosong menampilkan empty state kecil.

### M4. Task & Kolaborasi

- Field task: judul, deskripsi (rich text), status, prioritas (`urgent`, `tinggi`, `sedang`, `rendah`, `tanpa`), penanggung jawab (bisa lebih dari satu), tanggal mulai & tenggat, estimasi (jam), label, sub-task, checklist, lampiran Drive, pengamat (watcher).
- Nomor unik per workspace (`KEU-12`) untuk dirujuk di komentar.
- Kanban drag & drop dengan urutan stabil (fractional indexing / lexorank).
- Kolom status bisa diatur, tiap kolom punya kategori: `backlog`, `todo`, `in_progress`, `review`, `done`, `canceled`. **Metrik dashboard selalu memakai kategori**, bukan nama kolom.
- Komentar rich text, @mention orang, #rujukan task, reaksi emoji, edit/hapus.
- Filter & tampilan tersimpan: "Tugas saya", "Tenggat minggu ini", "Terlambat", dll.
- Update realtime via WebSocket (Laravel Reverb): perubahan di board langsung tampil di layar anggota lain.
- Riwayat perubahan per task.

### M5. Google Workspace

| Kebutuhan | Pendekatan |
|---|---|
| Folder per workspace | Service account dengan *domain-wide delegation* membuat folder di Shared Drive "RuangKerja" |
| Hak akses folder | Saat anggota ditambah/dikeluarkan dari workspace, izin folder Drive ikut disinkronkan (job antrean) |
| Buat dokumen baru | Tombol "Dokumen baru" → pilih Docs/Sheets/Slides → dibuat di folder workspace → dibuka di tab baru atau dipratinjau (embed) |
| Lampirkan file yang sudah ada | Google Picker dengan token OAuth pengguna (scope `drive.file`) |
| Unggah file | Unggah langsung ke folder Drive workspace (resumable upload), metadata disimpan di DB |
| Pencarian | Metadata (nama, tipe, pemilik, tautan) di DB untuk pencarian cepat. Isi file tetap di Drive |

Catatan: selfie absensi **tidak** disimpan di Drive. Data biometrik/sensitif disimpan di object storage privat (lihat §8).

### M6. Notifikasi

- Kanal Fase 1: **in-app** (lonceng + realtime) dan **email**.
- Kanal Fase 2: **WhatsApp** lewat antarmuka `NotificationChannel` yang provider-nya bisa diganti (Meta Cloud API resmi atau gateway). Keputusan provider ditunda.
- Preferensi per pengguna per jenis kejadian.
- Ringkasan harian (email 07:30): task tenggat hari ini, task terlambat, pengajuan menunggu persetujuan.
- Kejadian: ditugaskan, disebut (@mention), komentar di task yang diamati, tenggat H-1 & terlewat, pengajuan baru/diputus, lupa check-in (pengingat 15 menit setelah jam masuk).

### M7. Dashboard Monitoring (berbasis output)

**Definisi metrik** (satu sumber kebenaran, dihitung di `app/Domain/Analytics`):

| Metrik | Rumus |
|---|---|
| Tingkat penyelesaian | task `done` dengan tenggat dalam periode ÷ semua task bertenggat dalam periode |
| Ketepatan waktu | task selesai ≤ tenggat ÷ task selesai yang punya tenggat |
| Task terlambat | task belum selesai dengan tenggat < sekarang |
| Beban kerja | jumlah task terbuka per orang (dan total estimasi jam jika diisi) |
| Lead time | median (selesai − dibuat) untuk task `done` dalam periode |
| Kedisiplinan hadir | hari hadir tepat waktu ÷ hari kerja terjadwal |
| Rata-rata terlambat | total menit terlambat ÷ hari terlambat |

**Tidak ada "skor produktivitas" gabungan.** Metrik ditampilkan berdampingan dengan konteks.

| Dashboard | Isi |
|---|---|
| **Saya** | Tugas hari ini & minggu ini, terlambat, status absensi hari ini, **kartu Laporan hari ini**, saldo cuti (**bukan untuk staf**, keputusan pemilik 6 Okt 2026), pengajuan saya |
| **Kepala Divisi** | Siapa yang hadir/terlambat/cuti hari ini, beban kerja per anggota, task terlambat divisi, tren penyelesaian 8 minggu, antrean persetujuan, **laporan tim hari ini** (sudah/belum lapor + detail) |
| **HR** | Pengajuan menunggu HR, ringkasan **Absensi hari ini** (angka + tautan ke modul Absensi, tanpa daftar orang), kartu **Hiring** (tautan ke modul hiring bila ada), slot pengumuman |
| **Direksi** | Monitoring kerja **harian** (laporan progres harian per divisi: terjadwal, sudah lapor, draf, belum lapor; laporan terbaru dengan tugas, persen, hambatan), **mingguan** (Senin–Minggu: matriks orang × hari, tugas paling banyak dikerjakan, hambatan), **per proyek** (kesehatan, progres aktual vs rencana, milestone berikutnya, laporan & orang minggu ini), **catatan tindakan** pribadi Direksi/manajemen, dan **akses cepat** ke semua workspace tim/divisi/proyek (baca saja). Portofolio lengkap tetap di `/portofolio` (M10) |

**Keputusan pemilik 6 Okt 2026.** (1) Kehadiran per divisi, belum check-in, lupa check-out, perlu ditinjau, rekap & tren kedisiplinan pindah ke **modul Absensi** (tab Hari ini · Rekap · Kedisiplinan). (2) Tingkat penyelesaian, lead time, kedisiplinan hadir, rata-rata terlambat ada di **Absensi › Kedisiplinan** (HR), bukan di dashboard Direksi; tren penyelesaian, kehadiran hari ini, dan tugas terlambat tidak ditampilkan di dashboard Direksi. (3) **Beban kerja** ada di Dashboard Manajemen (`/manajemen`, per divisi → per orang), bersama catatan tindakan. (4) Direksi tidak lagi mendapat tab Kepala Divisi/HR (kecuali juga memegang peran HR/Super Admin atau memimpin divisi operasional); Super Admin boleh memilih semua tampilan. (5) Direksi, HR, dan Super Admin melihat semua workspace tim/divisi/proyek; bila bukan anggota hanya **mode lihat saja** (tanpa ubah tugas, komentar, reaksi, amati, lampiran, pengaturan). Aksi pengarah proyek Direksi (Minta update, Beri arahan, keputusan) tetap ada.

Dashboard Saya, Kepala Divisi, dan Absensi › Kedisiplinan bisa difilter periode, divisi, dan tim; Dashboard Direksi memakai pemilih tanggal & minggu. Semua dapat diekspor (Excel).

**Laporan progres harian (keputusan pemilik 6 Okt 2026).** Setiap karyawan menulis laporan harian (`/laporan/hari-ini`): tugas yang dikerjakan (saran dari Ruang saya "Hari ini" dan tugas yang ditugaskan; cari tugas lain yang terlihat), per tugas catatan progres (wajib), persen dan jam (opsional), dan "pindahkan ke …" (dipindah saat dikirim, tunduk Policy tugas); pekerjaan di luar tugas; ringkasan; hambatan; catatan/notulensi bebas. Draf tersimpan otomatis; Kirim bisa diulang sampai 23.59 hari itu, lalu terkunci. Kartu "Laporan hari ini" ada di Beranda semua karyawan (paling menonjol untuk staf). Pembaca: pemilik, atasan langsung, Kepala Divisi divisinya, Direksi, HR, Super Admin (lainnya 404); judul tugas hanya untuk pembaca yang bisa melihat tugasnya. Pengingat in-app 16.30 WIB hari kerja bagi karyawan terjadwal yang belum mengirim.

**Pengumuman (keputusan pemilik 6 Okt 2026).** Direksi/HR/Super Admin mengumumkan ke semua karyawan, divisi, atau tim tertentu; Kepala Divisi ke divisi yang dipimpin; Ketua Tim ke timnya. Penerima mendapat notifikasi `system.announcement` dan spanduk di atas semua dashboard (Saya, Divisi, HR, Manajemen, Portofolio; maks. 3 terbaru + "Lihat semua"); menutup spanduk hanya menyembunyikannya dari dashboard orang itu (notifikasi tetap di Inbox). Pembuat bisa menghapus miliknya (hilang dari semua dashboard). Halaman `/pengumuman`.

### M10. Proyek & Portofolio (tracking untuk Direksi)

Workspace bertipe **proyek** mendapat atribut proyek sehingga Direksi bisa memantau portofolio tanpa membuka board satu per satu.

**Atribut proyek:** PIC (penanggung jawab), sponsor (anggota Direksi), divisi utama, tanggal mulai, target selesai, status siklus (`planned` · `active` · `on_hold` · `completed` · `canceled`).

**Milestone:** nama, target tanggal, tugas terkait, status (belum mulai / berjalan / selesai / selesai terlambat / terlewat). Milestone terlewat = target lewat dan belum selesai.

**Update proyek (oleh PIC, mingguan):** status kesehatan **Sesuai jalur / Berisiko / Bermasalah**, ringkasan, hambatan, dan *keputusan yang dibutuhkan dari Direksi* (opsional). Pengingat otomatis ke PIC setiap Jumat 15.00 bila belum ada update minggu itu. Direksi bisa **"Minta update"** dan **"Beri arahan"** (komentar pada update, memberi notifikasi ke PIC).

**Risiko:** judul, level (tinggi/sedang/rendah), pemilik, status (terbuka/teratasi).

**Rumus (di `app/Domain/Analytics`):**
| Metrik | Rumus |
|---|---|
| Progres aktual | tugas `done` ÷ total tugas non-`canceled` di workspace proyek (pakai bobot `estimate_hours` bila ≥ 80% tugas punya estimasi) |
| Progres rencana | (hari ini − tanggal mulai) ÷ (target − tanggal mulai), dibatasi 0–100% |
| Selisih | aktual − rencana (poin persentase) |
| Penanda sistem | otomatis bila: selisih ≤ −15 poin, ada milestone terlewat, atau update terakhir > 7 hari ("Update kedaluwarsa") |
| Butuh keputusan | jumlah update terbaru yang berisi "keputusan dibutuhkan" dan belum ditandai selesai oleh Direksi |

Status kesehatan **ditetapkan PIC**, bukan dihitung otomatis. Penanda sistem ditampilkan di sebelahnya sehingga Direksi melihat penilaian PIC dan fakta data sekaligus.

**Layar:** Dashboard Direksi = portofolio (M7). **Detail proyek** (tab Ringkasan di workspace proyek): KPI proyek, grafik burn-up (lingkup vs selesai vs ideal), milestone, update terbaru + riwayat, risiko terbuka, tugas terlambat, tim & beban, kotak arahan Direksi. Tab Tugas/Dokumen/File/Aktivitas tetap seperti workspace biasa.

**Akses:** Direksi melihat semua proyek. Kepala Divisi melihat proyek yang melibatkan divisinya. Anggota melihat proyek tempat ia menjadi anggota. Hanya PIC (dan admin workspace) yang menulis update proyek dan mengubah milestone.

### M11. Hiring (keputusan pemilik 6 Okt 2026)

HR punya ruang khusus **Hiring** untuk proses rekrutmen (rincian: `docs/fitur/hiring.md`):
- Lowongan dengan pertanyaan wawancara, **pewawancara** (karyawan non-HR, "tim luar") dan **penyetuju akhir** (bawaan diatur HR, mis. Faris & Dio; bisa diubah per lowongan).
- Pelamar mengisi **Google Form** dan otomatis masuk lewat Google Apps Script (webhook bertanda tangan HMAC, tanpa kredensial Google di server); HR juga bisa menambah kandidat manual.
- Tahap: Masuk → Seleksi berkas → Wawancara → Penilaian → Keputusan akhir → Diterima/Ditolak. Profil kandidat (data & tautan CV, jawaban formulir), checklist per pemeriksa, jawaban kandidat (diisi HR) dan poin per pewawancara per pertanyaan, notulensi, keputusan akhir (semua penyetuju setuju → diterima; satu menolak → ditolak).
- Akses: HR & Super Admin penuh; pewawancara/penyetuju hanya lowongan yang ditugaskan; lainnya tidak melihat ruang ini. Tidak ada ekspor data pelamar.

### M8. Pengaturan & Admin

Master data (divisi, tim, jabatan, lokasi kantor + peta radius, shift, jenis cuti, hari libur), alur approval, integrasi Google (status koneksi, tes), branding, kebijakan retensi data, audit log.

### M9. Pengalaman pengguna lintas modul

- Command palette ⌘K/Ctrl+K: cari task, orang, workspace, dokumen. Aksi cepat ("Check-in", "Buat pengajuan", "Task baru"); juga "Tulis laporan hari ini", "Laporan harian", "Pengumuman" (keputusan pemilik 6 Okt 2026).
- **Staf** (keputusan pemilik 6 Okt 2026) = pengguna yang hanya punya peran `anggota` (tanpa `kepala_divisi`, `hr`, `direksi`, `super_admin`): tanpa saldo cuti tahunan dan tanpa struktur organisasi. Satu definisi: `User::isStaffOnly()` / `isStaffOnly(roles)`.
- Pintasan keyboard ala Linear (`C` buat task, `G` lalu `I` ke Inbox, dll.).
- **Inbox**: semua notifikasi + item yang perlu tindakan saya.
- Mode terang & gelap (ikut sistem, bisa diganti manual).
- Responsif. Absensi dioptimalkan untuk ponsel (PWA dapat dipasang ke layar utama).

---

## 6. Fase 2 — Ringkasan spesifikasi

- **Chat**: channel per workspace (otomatis) + channel bebas + DM + grup kecil. Thread, mention, reaksi, lampiran Drive, pencarian, status baca. Realtime via Reverb.
- **Catatan internal realtime**: editor Tiptap + Yjs, server Hocuspocus (Node) dengan autentikasi token dari Laravel, multi-cursor, riwayat versi. Untuk wiki/SOP/notulen ringan. Dokumen formal tetap Google Docs.
- **Google Calendar**: tenggat task, cuti yang disetujui, dan rapat masuk ke kalender. Buat rapat dengan tautan **Google Meet** otomatis (inilah "video call" tanpa membangun sendiri). *Ditahan pemilik (Okt 2026).*
- **Rapat, notulen & kalender (F2-3, dibangun Okt 2026)** + **Video RuangKerja** (keputusan pemilik 7 Okt 2026): rapat video bawaan pengganti Google Meet di server LiveKit sendiri (VPS rapat terpisah) — pra-gabung (cek kamera/mikrofon), ruang layar penuh mirip Meet (petak/sorotan, berbagi layar, chat, angkat tangan, moderasi penyelenggara), jendela gabung 15 menit sebelum s.d. 2 jam sesudah rapat, kehadiran otomatis dari webhook untuk notulen. Hanya karyawan internal (tamu eksternal belum). Rincian `docs/fitur/rapat-kalender.md` §6a, deploy `docs/deploy/RAPAT-VIDEO.md`.
- **WhatsApp**: implementasi provider untuk `NotificationChannel`, template notifikasi, opt-in per pengguna.
- **Task berulang**, template task/workspace, otomasi sederhana ("jika pindah ke Done → beri tahu X").

## 7. Fase 3 — Ringkasan spesifikasi

- **Aplikasi React Native (Expo)** untuk Android & iOS memakai API Laravel (Sanctum token). Fokus: absensi, Inbox, task, chat.
- **Anti fake-GPS native**: deteksi mock location (Android), root/jailbreak, integritas aplikasi (Play Integrity).
- **Face recognition** on-device dengan liveness. Template wajah disimpan terenkripsi dan hanya dengan persetujuan eksplisit (UU PDP: data biometrik = data pribadi spesifik).
- **Mesin fingerprint**: endpoint ADMS/iclock untuk ZKTeco (push log) → `attendance_logs` dengan `method = fingerprint`.
- **KPI/OKR divisi**: target per kuartal, progres ditautkan ke task.

---

## 8. Kebutuhan non-fungsional

| Area | Kebutuhan |
|---|---|
| Kinerja | p95 respons halaman < 300 ms (server), board 500 task tetap lancar, check-in < 3 detik di 4G |
| Ketersediaan | Target 99,5%. Deploy tanpa downtime (migrasi aman ke belakang) |
| Cadangan | `pg_dump` harian + WAL archiving ke object storage terpisah, retensi 30 hari, uji pemulihan bulanan |
| Keamanan | HTTPS wajib, CSRF, rate limit login & check-in, otorisasi via Policy di setiap aksi, 2FA untuk Super Admin, rahasia di `.env`/secret store, token Google terenkripsi |
| Privasi (UU PDP No. 27/2022) | Persetujuan eksplisit untuk lokasi & selfie, lokasi hanya saat check-in/out, retensi selfie default 12 bulan (bisa diatur) lalu dihapus otomatis, akses selfie hanya HR & atasan langsung, semua akses data sensitif masuk audit log, ekspor & hapus data atas permintaan karyawan |
| Penyimpanan | Selfie & lampiran pengajuan di object storage privat (Biznet Gio NEO Object Storage, S3-compatible) dengan URL bertanda tangan berumur pendek |
| Aksesibilitas | Kontras WCAG AA di mode terang & gelap, navigasi keyboard penuh |
| Observabilitas | Log terstruktur, Laravel Pulse/Horizon, alert error (Sentry atau setara), uptime monitor |
| Kualitas | Test fitur (Pest) untuk alur kritis: check-in, approval, otorisasi workspace, metrik. CI wajib hijau sebelum merge |

## 9. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Scope membengkak (4 produk dalam 1) | Fase ketat. Fitur baru masuk backlog fase berikutnya, tidak menyisip ke sprint berjalan |
| Fake GPS di web | QR dinamis untuk kantor, penandaan mencurigakan, solusi native di Fase 3 |
| Kuota/izin Google API | Antrean + retry eksponensial, cache metadata, monitor kuota |
| Adopsi rendah (orang tetap di WhatsApp) | Notifikasi WA di Fase 2, ringkasan harian, impor task awal, sponsor dari direksi |
| Resistensi karena merasa diawasi | Prinsip "output, bukan pengawasan" dikomunikasikan, karyawan bisa melihat data dirinya sendiri |
| VPS tunggal = titik gagal tunggal | Backup off-site, runbook pemulihan, opsi replika di fase lanjut |

## 10. Pertanyaan terbuka

1. Nama produk, logo, dan kode warna (hex) resmi SPKD.
2. Provider WhatsApp (resmi Meta vs gateway). Ditunda ke Fase 2.
3. Format ekspor payroll yang dipakai saat ini (kolom apa saja).
4. Daftar jenis cuti, kuota, dan aturan carry-over perusahaan.
5. Batas lembur yang memerlukan persetujuan Direksi.
6. Apakah perlu KPI/OKR divisi lebih awal dari Fase 3.
7. Konsep dashboard dari proyek "monitoring bisnis owner" yang ingin dibawa (disepakati: konsep saja, bukan penggabungan proyek).
