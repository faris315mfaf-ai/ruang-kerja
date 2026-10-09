{{--
  Kebijakan Privasi publik (web, tanpa login) — syarat Play Store + transparansi UU PDP.
  Draf: isi final menunggu persetujuan pemilik pengendali data (SPKD) — jangan tampilkan
  status draf di halaman. Versi/tanggal mengikuti PRIVACY_POLICY_VERSION/DATE (config/privacy.php)
  agar seirama dengan persetujuan lokasi & selfie absensi. Placeholder yang dipakai pemilik:
  BRANDING_COMPANY_NAME (pengendali data) dan PRIVACY_CONTACT; email kontak di §8 masih
  placeholder dan harus diganti email resmi sebelum submit ke Play Console.
  Styling: hanya token CSS hasil kompilasi resources/css/app.css (var(--…)); tanpa hex.
--}}

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="description" content="Kebijakan Privasi {{ $appName }}: data pribadi yang diproses, dasar dan tujuan pemrosesan, pihak ketiga, retensi, serta hak Anda menurut UU No. 27 Tahun 2022 (UU PDP).">
    <title>Kebijakan Privasi · {{ $appName }}</title>

    {{-- Ikuti preferensi Malam sistem sebelum cat pertama (pola layout app; nonce untuk CSP). --}}
    <script nonce="{{ Vite::cspNonce() }}">
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
        }
    </script>

    @vite('resources/css/app.css')

    <style>
        body {
            margin: 0;
            background: var(--bg);
            color: var(--text);
            font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
            line-height: 1.7;
            -webkit-font-smoothing: antialiased;
        }

        main {
            max-width: 46rem;
            margin: 0 auto;
            padding: 2.5rem 1.25rem 4rem;
        }

        .brand {
            margin: 0;
            color: var(--text-subtle);
            font-size: 0.8125rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        h1 {
            margin: 0.25rem 0 0.375rem;
            font-size: 1.75rem;
            line-height: 1.25;
        }

        .meta {
            margin: 0 0 1.5rem;
            color: var(--text-subtle);
            font-size: 0.8125rem;
        }

        h2 {
            margin: 2.25rem 0 0.75rem;
            font-size: 1.125rem;
            line-height: 1.4;
            color: var(--text);
        }

        p, li {
            margin: 0.5rem 0;
            color: var(--text-muted);
            font-size: 0.9375rem;
        }

        strong { color: var(--text); }

        a { color: var(--link); }

        ul { padding-left: 1.25rem; margin: 0.5rem 0; }

        li + li { margin-top: 0.45rem; }

        .toc {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 0.75rem;
            padding: 1rem 1.25rem;
        }

        .toc p {
            margin: 0 0 0.375rem;
            color: var(--text);
            font-size: 0.8125rem;
            font-weight: 600;
        }

        .toc ol { margin: 0; padding-left: 1.25rem; }

        .toc li { margin: 0; font-size: 0.875rem; }

        .toc a { text-decoration: none; }

        footer {
            margin-top: 3rem;
            border-top: 1px solid var(--border);
            padding-top: 1.25rem;
            color: var(--text-subtle);
            font-size: 0.8125rem;
        }
    </style>
</head>
<body>
<main>
    <header>
        <p class="brand">{{ $appName }}</p>
        <h1>Kebijakan Privasi</h1>
        <p class="meta">Versi {{ $version }} · Berlaku {{ $effectiveDate }} · Aplikasi web dan aplikasi Android RuangKerja</p>
    </header>

    <nav class="toc" aria-label="Daftar isi">
        <p>Daftar isi</p>
        <ol>
            <li><a href="#ringkasan">Ringkasan</a></li>
            <li><a href="#pengendali-data">Pengendali data</a></li>
            <li><a href="#data-diproses">Data yang kami proses</a></li>
            <li><a href="#dasar-tujuan">Dasar dan tujuan pemrosesan</a></li>
            <li><a href="#pihak-ketiga">Pemrosesan oleh pihak ketiga</a></li>
            <li><a href="#retensi">Penyimpanan dan retensi</a></li>
            <li><a href="#hak-anda">Hak Anda</a></li>
            <li><a href="#kontak">Kontak</a></li>
            <li><a href="#perubahan">Perubahan kebijakan</a></li>
        </ol>
    </nav>

    <section id="ringkasan">
        <h2>1. Ringkasan</h2>
        <p>
            {{ $appName }} adalah aplikasi kerja internal {{ $companyName }} untuk absensi,
            rencana kerja harian, tugas dan pengajuan, catatan bersama, serta rapat. Kebijakan ini
            menjelaskan data pribadi apa yang kami proses, untuk apa, siapa yang ikut memproses,
            berapa lama disimpan, dan hak Anda menurut Undang-Undang No. 27 Tahun 2022 tentang
            Pelindungan Data Pribadi (UU PDP).
        </p>
        <p>
            Prinsip kami: data diproses sebatas keperluan pekerjaan dan kewajiban kepegawaian,
            <strong>bukan</strong> untuk memantau aktivitas Anda di luar hasil kerja. Data pribadi
            tidak dijual dan tidak dipakai untuk iklan.
        </p>
    </section>

    <section id="pengendali-data">
        <h2>2. Pengendali data</h2>
        <p>
            Pengendali data pribadi adalah <strong>{{ $companyName }}</strong> selaku pemberi kerja
            yang mengoperasikan {{ $appName }} untuk keperluan internal perusahaan. Permintaan dan
            pertanyaan seputar data pribadi ditujukan ke kontak pada bagian 8.
        </p>
    </section>

    <section id="data-diproses">
        <h2>3. Data yang kami proses</h2>
        <ul>
            <li>
                <strong>Akun karyawan:</strong> nama, email kantor, nomor telepon, foto profil,
                divisi/tim, jabatan, atasan, dan peran akses.
            </li>
            <li>
                <strong>Absensi:</strong> jam check-in/check-out dan status harian;
                <strong>lokasi GPS beserta tingkat akurasinya hanya pada saat Anda menekan
                check-in/check-out</strong>; <strong>foto selfie</strong> saat check-in yang disimpan
                di penyimpanan privat dan dihapus otomatis sesuai jadwal (bagian 6); metode absen,
                waktu, alamat IP, jenis peramban, serta penanda acak perangkat yang dibuat aplikasi.
            </li>
            <li>
                <strong>Rencana kerja harian:</strong> poin rencana kerja yang Anda kirim saat
                check-in beserta status dan laporannya.
            </li>
            <li>
                <strong>Tugas &amp; pengajuan:</strong> tugas, komentar, dan berkas yang Anda buat
                atau lampirkan; pengajuan cuti, izin, sakit, lembur, koreksi absensi, dan dinas beserta
                alasan, lampiran, serta keputusan persetujuan Anda sebagai penyetuju.
            </li>
            <li>
                <strong>Catatan &amp; notulen:</strong> catatan bersama dan notulen rapat yang Anda
                buat atau dapat Anda buka, termasuk riwayat versi penyuntingannya.
            </li>
            <li>
                <strong>Rapat &amp; rapat video:</strong> undangan, jawaban kehadiran, jam masuk dan
                keluar ruang video, serta lama bicara (untuk pembagian giliran bicara yang adil,
                bukan penilaian kinerja). Gambar, suara, layar yang dibagikan, dan obrolan di dalam
                rapat video <strong>tidak direkam</strong>. Bila penyelenggara rapat menyalakan
                notulen otomatis, suara direkam sementara untuk dibuat transkrip lalu audionya
                dihapus; transkrip dan draf ringkasan AI disimpan paling lama {{ $transcriptRetentionDays }} hari (dapat diatur administrator) dan hanya bisa
                dibuka peserta rapat. Anda dapat menolak transkripsi suara Anda sebelum, selama, atau
                sesudah rapat sebagaimana dijelaskan pada persetujuan di dalam aplikasi.
            </li>
            <li>
                <strong>Notifikasi:</strong> preferensi dan kiriman notifikasi melalui
                dalam-aplikasi, email, dan WhatsApp. Salinan ke grup WhatsApp manajemen hanya berisi
                nama, status kehadiran, dan rencana kerja harian.
            </li>
            <li>
                <strong>Perangkat (untuk aplikasi Android yang menyusul):</strong> token notifikasi
                push, penanda perangkat, dan sinyal integritas perangkat (misalnya indikasi
                lokasi palsu atau perangkat tidak resmi). Fitur check-in wajah, bila diaktifkan,
                memerlukan <strong>persetujuan biometrik terpisah</strong> dan memproses templat
                wajah — bukan foto — yang dapat Anda hapus kapan saja.
            </li>
            <li>
                <strong>Log audit:</strong> catatan perubahan data penting dan akses ke data
                sensitif (misalnya siapa yang membuka selfie).
            </li>
        </ul>
    </section>

    <section id="dasar-tujuan">
        <h2>4. Dasar dan tujuan pemrosesan</h2>
        <p>Data diproses untuk:</p>
        <ul>
            <li>mencatat kehadiran sesuai jadwal kerja dan menyusun rekap untuk penggajian;</li>
            <li>menjalankan pekerjaan tim: tugas, pengajuan dan persetujuan, catatan, rapat, dan notulen;</li>
            <li>mengirim notifikasi pekerjaan yang Anda atur;</li>
            <li>menjaga keamanan sistem dan menelusuri penyalahgunaan.</li>
        </ul>
        <p>Dasar pemrosesannya (UU PDP Pasal 20):</p>
        <ul>
            <li>
                <strong>pelaksanaan perjanjian kerja</strong> dan pemenuhan
                <strong>kewajiban hukum ketenagakerjaan</strong> (absensi, penggajian, administrasi kepegawaian);
            </li>
            <li>
                <strong>kepentingan yang sah</strong> pengendali data untuk keamanan sistem dan audit;
            </li>
            <li>
                <strong>persetujuan eksplisit</strong> Anda untuk pemrosesan lokasi GPS dan selfie
                absensi, yang diminta sebelum check-in pertama dan setiap kali versi kebijakan
                berubah, serta <strong>persetujuan opt-in terpisah</strong> untuk data biometrik
                (check-in wajah). Persetujuan dapat Anda cabut kapan saja; setelah dicabut,
                check-in GPS + selfie atau check-in wajah tidak dapat dilakukan dan HR akan mengatur
                cara absensi lain.
            </li>
        </ul>
    </section>

    <section id="pihak-ketiga">
        <h2>5. Pemrosesan oleh pihak ketiga</h2>
        <ul>
            <li>
                <strong>Google Workspace kantor</strong> — masuk akun, Drive, Dokumen, dan Kalender/Meet
                untuk rapat yang dijadwalkan lewat Google.
            </li>
            <li>
                <strong>DeepSeek (API, server di luar Indonesia)</strong> — penyedia ringkasan notulen
                otomatis. Yang dikirim hanya teks transkrip beserta nama tampilan pembicara, judul, dan
                agenda rapat; audio tidak pernah dikirim. Dasar hukum transfer data ke luar wilayah
                hukum Indonesia (UU PDP Pasal 56) sedang dalam proses penetapan oleh pengendali data,
                dan fitur ini hanya aktif bila ditetapkan admin serta dapat dimatikan atau diganti
                penyedia lain.
            </li>
            <li>
                <strong>Evolution API (gerbang WhatsApp) self-host</strong> — dijalankan di server
                perusahaan sendiri; hanya meneruskan nama, status absen, dan rencana kerja harian ke
                grup WhatsApp manajemen internal.
            </li>
            <li>
                <strong>Penyedia hosting</strong> — aplikasi, basis data, selfie, lampiran, cadangan,
                dan server rapat video berjalan pada VPS di Indonesia.
            </li>
        </ul>
    </section>

    <section id="retensi">
        <h2>6. Penyimpanan dan retensi</h2>
        <ul>
            <li><strong>Selfie absensi</strong> dihapus otomatis setelah {{ $selfieRetentionMonths }} bulan.</li>
            <li>
                <strong>Audio rapat untuk transkrip</strong> dihapus segera setelah transkripsi;
                <strong>transkrip dan draf ringkasan AI</strong> dihapus otomatis setelah {{ $transcriptRetentionDays }} hari (dapat diatur administrator)
                (teks yang sudah dimasukkan ke notulen tetap menjadi bagian notulen).
            </li>
            <li>
                <strong>Templat wajah</strong> (bila fitur check-in wajah diaktifkan) disimpan selama
                pendaftaran wajah aktif dan dihapus paling lambat 30 hari setelah fitur tidak lagi
                aktif atau persetujuan dicabut.
            </li>
            <li>
                <strong>Data kepegawaian, absensi, rencana kerja, tugas, dan pengajuan</strong>
                disimpan selama hubungan kerja berlangsung dan sesudahnya sepanjang diwajibkan
                peraturan ketenagakerjaan dan perpajakan.
            </li>
            <li><strong>Cadangan basis data</strong> disimpan terenkripsi selama 30 hari.</li>
            <li><strong>Log audit</strong> disimpan untuk keperluan keamanan dan pemeriksaan.</li>
        </ul>
    </section>

    <section id="hak-anda">
        <h2>7. Hak Anda</h2>
        <ul>
            <li>
                <strong>Mengetahui dan mengakses</strong> — melihat dan mengunduh data diri Anda
                (Excel/PDF) di dalam aplikasi melalui Menu → Privasi &amp; data saya, atau dengan
                permintaan ke kontak di bagian 8.
            </li>
            <li><strong>Memperbaiki</strong> data yang keliru melalui koreksi absensi atau permintaan ke kontak.</li>
            <li>
                <strong>Menghapus atau membatasi</strong> pemrosesan, sepanjang tidak bertentangan
                dengan kewajiban hukum yang mewajibkan data disimpan.
            </li>
            <li>
                <strong>Mencabut persetujuan</strong> lokasi &amp; selfie di halaman Data Saya atau
                Absensi, dan persetujuan biometrik (termasuk menghapus templat wajah) kapan saja.
            </li>
            <li>
                <strong>Mengajukan keberatan atau pengaduan</strong> kepada kontak di bagian 8, atau
                kepada lembaga pelindungan data pribadi sesuai UU PDP.
            </li>
        </ul>
        <p>Permintaan ditanggapi sesuai jangka waktu yang ditetapkan UU PDP.</p>
    </section>

    <section id="kontak">
        <h2>8. Kontak</h2>
        <p>
            Pertanyaan, permintaan, dan pengaduan terkait data pribadi ditujukan kepada:
            <strong>{{ $contact }}</strong> —
            {{-- Placeholder; ganti dengan email resmi sebelum kebijakan ini dipakai untuk Play Console. --}}
            <a href="mailto:admin@perusahaan.co.id">admin@perusahaan.co.id</a>.
        </p>
    </section>

    <section id="perubahan">
        <h2>9. Perubahan kebijakan</h2>
        <p>
            Bila isi kebijakan ini berubah secara substansi, nomor versinya dinaikkan dan tanggal
            berlaku diperbarui. Karyawan akan diminta menyetujui ulang sebelum check-in GPS + selfie
            berikutnya. Kebijakan ini juga berlaku sebagai kebijakan privasi aplikasi Android
            {{ $appName }}.
        </p>
    </section>

    <footer>
        {{ $appName }} · aplikasi kerja internal {{ $companyName }} ·
        <a href="/login">Masuk ke aplikasi</a>
    </footer>
</main>
</body>
</html>
