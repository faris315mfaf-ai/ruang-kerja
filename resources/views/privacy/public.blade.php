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
            <li><a href="#whatsapp">Pengiriman absensi ke grup WhatsApp</a></li>
            <li><a href="#peta">Peta, lokasi, dan OpenStreetMap</a></li>
            <li><a href="#offline">Aplikasi Android dan data di ponsel (offline)</a></li>
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
        <p>Tiga hal yang perlu Anda ketahui sejak awal:</p>
        <ul>
            <li>
                <strong>Foto selfie absen dikirim ke grup WhatsApp perusahaan</strong>, diberi cap
                jam, tanggal, dan lokasi (termasuk peta kecil), bersama rencana atau laporan kerja
                Anda. Setelah terkirim, salinannya berada di luar kendali aplikasi (bagian 5).
            </li>
            <li>
                <strong>Lokasi Anda ditampilkan di peta OpenStreetMap</strong>, dan pada foto bercap
                koordinat Anda dapat dikirim ke layanan pencarian nama tempat OpenStreetMap
                (bagian 6).
            </li>
            <li>
                <strong>Aplikasi Android menyimpan sebagian data</strong>, termasuk selfie dan lokasi
                yang belum terkirim, di ponsel Anda agar dapat dipakai tanpa internet (bagian 7).
            </li>
        </ul>
    </section>

    <section id="pengendali-data">
        <h2>2. Pengendali data</h2>
        <p>
            Pengendali data pribadi adalah <strong>{{ $companyName }}</strong> selaku pemberi kerja
            yang mengoperasikan {{ $appName }} untuk keperluan internal perusahaan. Permintaan dan
            pertanyaan seputar data pribadi ditujukan ke kontak pada bagian 11.
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
                di penyimpanan privat dan dihapus otomatis sesuai jadwal (bagian 9); metode absen,
                waktu, alamat IP, jenis peramban, serta penanda acak perangkat yang dibuat aplikasi.
                Di aplikasi Android juga tercatat sinyal lokasi palsu (mock location) bila
                terdeteksi, untuk ditinjau HR.
            </li>
            <li>
                <strong>Rencana dan laporan kerja harian:</strong> poin rencana kerja yang Anda
                kirim saat check-in dan poin laporan kerja saat check-out, beserta status dan
                laporannya.
            </li>
            <li>
                <strong>Pesan absensi di grup WhatsApp:</strong> foto selfie bercap (jam, tanggal,
                nama tempat, peta kecil) dan keterangan berisi nama, tanggal, jam, lokasi, rencana
                atau laporan kerja, serta lama kerja (bagian 5).
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
                dalam-aplikasi, email, dan WhatsApp. Pesan absensi ke grup WhatsApp perusahaan
                dijelaskan pada bagian 5.
            </li>
            <li>
                <strong>Data di ponsel (aplikasi Android):</strong> salinan data terakhir yang Anda
                buka dan antrean perubahan yang belum terkirim, termasuk selfie, titik GPS, dan
                lampiran (bagian 7).
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
            <li>
                menyampaikan kehadiran dan laporan kerja harian kepada anggota grup WhatsApp
                perusahaan untuk memantau kehadiran dan laporan kerja (bagian 5);
            </li>
            <li>menampilkan peta dan nama tempat pada layar Absen dan foto bercap (bagian 6);</li>
            <li>
                menyimpan data sementara di ponsel agar aplikasi Android tetap dapat dipakai tanpa
                internet dan perubahan Anda tidak hilang (bagian 7);
            </li>
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
                berubah. Pengiriman foto selfie bercap dan lokasi ke grup WhatsApp termasuk dalam
                persetujuan ini dan dijelaskan pada layar persetujuan sebelum Anda menyetujuinya.
                Untuk data biometrik diminta <strong>persetujuan opt-in terpisah</strong>
                (check-in wajah). Persetujuan dapat Anda cabut kapan saja; setelah dicabut,
                check-in GPS + selfie atau check-in wajah tidak dapat dilakukan dan HR akan mengatur
                cara absensi lain.
            </li>
        </ul>
    </section>

    <section id="whatsapp">
        <h2>5. Pengiriman absensi ke grup WhatsApp</h2>
        <p>
            Setiap kali Anda check-in atau check-out, aplikasi mengirim pesan otomatis ke grup
            WhatsApp perusahaan untuk laporan harian (grup "DAILY REPORT") lewat gerbang WhatsApp
            (Evolution API) yang dijalankan di server perusahaan sendiri. Kegagalan pengiriman
            tidak memengaruhi absensi Anda.
        </p>
        <ul>
            <li>
                <strong>Check-in/check-out dengan GPS + selfie (web dan Android):</strong> foto
                selfie Anda yang diberi cap berisi jam, hari dan tanggal, nama tempat, serta
                <strong>peta kecil dengan penanda posisi Anda</strong> (cakupan sekitar 600 meter).
                Keterangan foto berisi nama Anda, tanggal, jam, lokasi (nama kantor, "WFH", atau
                jarak dari kantor terdekat bila Anda di luar kantor), <strong>rencana kerja</strong>
                (saat masuk) atau <strong>laporan kerja</strong> dan lama kerja (saat pulang), serta
                tanda "absen offline" bila Anda absen tanpa internet. Angka koordinat tidak ditulis
                di pesan, tetapi peta pada foto menunjukkan sekitar tempat Anda berada,
                <strong>termasuk saat WFH atau bertugas di luar kantor</strong> (misalnya sekitar
                rumah Anda).
            </li>
            <li>
                <strong>Check-in lewat kiosk QR atau tanpa selfie:</strong> hanya pesan teks berisi
                nama, tanggal, jam, dan lokasi.
            </li>
        </ul>
        <p>
            Foto bercap dibuat sementara di memori server untuk dikirim; salinan bercap itu tidak
            disimpan di server. Selfie asli tetap disimpan di penyimpanan privat aplikasi dan
            dihapus otomatis setelah {{ $selfieRetentionMonths }} bulan (bagian 9).
        </p>
        <p>
            <strong>Siapa yang menerima.</strong> Seluruh anggota grup tersebut. Daftar anggota
            grup ditetapkan perusahaan di WhatsApp, bukan di aplikasi ini, dan tidak dapat Anda
            ubah. Perusahaan bertanggung jawab agar anggota grup hanya pihak yang berkepentingan
            memantau kehadiran dan laporan kerja. Tujuannya adalah monitoring kehadiran dan
            laporan kerja harian.
        </p>
        <p>
            <strong>Setelah terkirim, di luar kendali aplikasi.</strong> Pesan dan foto yang sudah
            terkirim tersimpan pada layanan WhatsApp (Meta Platforms) dan pada perangkat setiap
            anggota grup. Aplikasi tidak dapat menarik kembali, membatasi penyimpanan, atau
            mencegah anggota grup menyimpan, meneruskan, atau menangkap layar pesan itu. Batas
            penyimpanan selfie {{ $selfieRetentionMonths }} bulan <strong>tidak berlaku</strong>
            untuk salinan di WhatsApp. WhatsApp memproses data menurut ketentuannya sendiri dan
            dapat memprosesnya di luar Indonesia. Permintaan penghapusan pesan dari grup dapat
            disampaikan ke kontak pada bagian 11; penghapusan itu tidak dapat menjangkau salinan
            yang sudah disimpan anggota grup.
        </p>
        <p>
            <strong>Bila Anda keberatan,</strong> Anda dapat mencabut persetujuan lokasi &amp;
            selfie (bagian 10); check-in GPS + selfie lalu tidak dapat dilakukan dan HR akan
            mengatur cara absensi lain. Absensi lewat kiosk QR tetap mengirim pesan teks (nama,
            jam, lokasi) ke grup yang sama.
        </p>
    </section>

    <section id="peta">
        <h2>6. Peta, lokasi, dan layanan OpenStreetMap</h2>
        <p>
            Koordinat GPS Anda dipakai untuk menghitung jarak ke lokasi kantor dan menampilkan peta.
            Peta dan nama tempat berasal dari <strong>OpenStreetMap</strong>, layanan yang dikelola
            OpenStreetMap Foundation di luar Indonesia (data berlisensi ODbL, &copy; OpenStreetMap
            contributors).
        </p>
        <ul>
            <li>
                <strong>Peta di layar Absen aplikasi Android:</strong> ponsel Anda tidak menghubungi
                OpenStreetMap. Ponsel meminta potongan peta (ubin) ke server RuangKerja, lalu server
                meneruskan permintaan ke OpenStreetMap hanya dengan <strong>nomor ubin</strong>
                (tingkat zoom, kolom, baris), memakai identitas aplikasi (User-Agent
                "RuangKerja/1.0") dan alamat IP server kami. Koordinat, nama, dan alamat IP ponsel
                Anda tidak dikirim. Server menyimpan salinan ubin selama 7 hari.
            </li>
            <li>
                <strong>Peta di web:</strong> peramban Anda mengambil ubin peta langsung dari
                OpenStreetMap, sehingga OpenStreetMap menerima alamat IP peramban Anda dan nomor
                ubin untuk daerah yang Anda lihat.
            </li>
            <li>
                <strong>Foto selfie bercap untuk grup WhatsApp:</strong> server mengambil ubin peta
                di sekitar posisi Anda dari OpenStreetMap (hanya nomor ubin). Bila Anda berada di
                luar lokasi kantor dan bukan WFH, server juga <strong>mengirim koordinat GPS
                Anda</strong> ke layanan pencarian nama tempat OpenStreetMap (Nominatim) untuk
                mendapat nama kelurahan atau kecamatan yang dicantumkan pada foto. Permintaan
                berasal dari server (dengan identitas aplikasi dan alamat IP server), tanpa nama
                atau identitas Anda; nama tempat disimpan di server 24 jam. Bila pencarian atau
                peta gagal, foto tetap dikirim tanpa peta atau dengan teks lokasi saja. Perusahaan
                dapat mematikan peta dan pencarian nama tempat pada foto bercap.
            </li>
        </ul>
    </section>

    <section id="offline">
        <h2>7. Aplikasi Android dan penyimpanan data di ponsel (mode offline)</h2>
        <p>Aplikasi Android dapat dipakai tanpa internet. Untuk itu aplikasi menyimpan data di ponsel Anda:</p>
        <ul>
            <li>
                <strong>Salinan data baca:</strong> halaman yang terakhir Anda buka (misalnya
                beranda, tugas dan workspace, catatan, rapat, kalender, pengajuan, inbox, obrolan,
                pengumuman, laporan harian, absensi hari ini dan riwayat, serta daftar nama rekan
                kerja), dibatasi 25 MB dan paling lama 14 hari. Data berikut <strong>tidak</strong>
                disimpan: rekrutmen (hiring), administrasi dan data HR, persetujuan, pengaturan
                privasi, foto selfie yang sudah tersimpan di server, serta transkrip atau video
                rapat.
            </li>
            <li>
                <strong>Antrean perubahan:</strong> yang Anda tulis saat offline (absen masuk/pulang,
                tugas, komentar, catatan, laporan harian, pengajuan) disimpan di ponsel sampai
                terkirim. Untuk absen, antrean berisi <strong>foto selfie dan titik GPS</strong>;
                pengajuan dapat berisi lampiran (maks. 5 MB per berkas). Setelah terkirim, item
                dihapus dari ponsel.
            </li>
            <li>
                <strong>Enkripsi:</strong> semua data di atas disimpan dalam basis data terenkripsi
                (SQLCipher); kuncinya acak dan disimpan di penyimpanan aman perangkat Android. Bila
                perangkat tidak mendukung, data disimpan di folder privat aplikasi tanpa enkripsi
                tambahan, dan status ini ditampilkan di Pengaturan &rsaquo; Penyimpanan offline.
                Kami menyarankan Anda memakai kunci layar pada ponsel.
            </li>
            <li>
                <strong>Absen offline:</strong> waktu absen memakai <strong>jam ponsel saat tombol
                absen ditekan</strong>, ditandai "absen offline", dan masuk daftar peninjauan HR
                (jam ponsel dapat diubah, sehingga sistem memeriksanya). Batasnya
                <strong>72 jam</strong>; lewat itu absen tidak dapat disinkronkan dan Anda perlu
                mengajukan koreksi absensi.
            </li>
            <li>
                <strong>Pengiriman otomatis:</strong> antrean dikirim sendiri begitu sambungan
                internet tersedia, termasuk oleh tugas latar belakang sistem Android bila diizinkan
                perangkat Anda.
            </li>
            <li>
                <strong>Penghapusan:</strong> keluar dari akun, atau akun dinonaktifkan, menghapus
                seluruh data aplikasi di ponsel, termasuk antrean yang belum terkirim (aplikasi
                memperingatkan lebih dulu). Bila sesi berakhir sendiri, hanya salinan data baca yang
                dihapus dan antrean dipertahankan sampai Anda masuk lagi. Anda juga dapat menghapus
                salinan data baca kapan saja di Pengaturan &rsaquo; Penyimpanan offline &rsaquo;
                Hapus data offline (antrean yang belum terkirim tidak ikut terhapus). Mencopot
                aplikasi menghapus semuanya.
            </li>
        </ul>
    </section>

    <section id="pihak-ketiga">
        <h2>8. Pemrosesan oleh pihak ketiga</h2>
        <ul>
            <li>
                <strong>Google Workspace kantor</strong> — masuk akun, Drive, Dokumen, dan Kalender/Meet
                untuk rapat yang dijadwalkan lewat Google.
            </li>
            <li>
                <strong>WhatsApp (Meta Platforms)</strong> — menerima dan menyimpan pesan absensi
                yang dikirim ke grup WhatsApp perusahaan (bagian 5), dapat memprosesnya di luar
                Indonesia dan di luar kendali perusahaan. Pesan dikirim lewat
                <strong>Evolution API</strong>, gerbang WhatsApp self-host yang dijalankan di server
                perusahaan sendiri.
            </li>
            <li>
                <strong>OpenStreetMap (OpenStreetMap Foundation)</strong> — menerima nomor ubin peta
                dan, untuk foto bercap di luar kantor, koordinat GPS untuk pencarian nama tempat
                (bagian 6); berada di luar Indonesia.
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
                <strong>Penyedia hosting</strong> — aplikasi, basis data, selfie, lampiran, cadangan,
                dan server rapat video berjalan pada VPS di Indonesia.
            </li>
        </ul>
    </section>

    <section id="retensi">
        <h2>9. Penyimpanan dan retensi</h2>
        <ul>
            <li>
                <strong>Selfie absensi</strong> dihapus otomatis setelah {{ $selfieRetentionMonths }} bulan.
                Ini tidak berlaku untuk salinan yang sudah terkirim ke grup WhatsApp (bagian 5) maupun
                yang tersimpan sementara di ponsel sebelum terkirim (bagian 7).
            </li>
            <li>
                <strong>Pesan di grup WhatsApp</strong> (foto bercap dan keterangannya) tidak dikelola
                aplikasi; lama penyimpanannya mengikuti WhatsApp dan perangkat anggota grup.
            </li>
            <li>
                <strong>Nama tempat dan ubin peta untuk foto bercap</strong> disimpan sementara di
                server (24 jam; ubin peta layar Absen Android 7 hari). Foto bercap sendiri tidak
                disimpan.
            </li>
            <li>
                <strong>Data di ponsel (aplikasi Android):</strong> salinan data baca paling lama 14
                hari; antrean sampai terkirim, dibuang, atau Anda keluar dari akun (bagian 7).
            </li>
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
        <h2>10. Hak Anda</h2>
        <ul>
            <li>
                <strong>Mengetahui dan mengakses</strong> — melihat dan mengunduh data diri Anda
                (Excel/PDF) di dalam aplikasi melalui Menu &rarr; Privasi &amp; data saya, atau dengan
                permintaan ke kontak di bagian 11.
            </li>
            <li><strong>Memperbaiki</strong> data yang keliru melalui koreksi absensi atau permintaan ke kontak.</li>
            <li>
                <strong>Menghapus atau membatasi</strong> pemrosesan, sepanjang tidak bertentangan
                dengan kewajiban hukum yang mewajibkan data disimpan.
            </li>
            <li>
                <strong>Mencabut persetujuan</strong> lokasi &amp; selfie di halaman Data Saya atau
                Absensi, dan persetujuan biometrik (termasuk menghapus templat wajah) kapan saja.
                Pencabutan menghentikan pengiriman foto selfie Anda ke grup WhatsApp tetapi tidak
                menarik kembali pesan yang sudah terkirim.
            </li>
            <li>
                <strong>Menghapus data offline di ponsel</strong> kapan saja di Pengaturan &rsaquo;
                Penyimpanan offline, atau dengan keluar dari akun.
            </li>
            <li>
                <strong>Mengajukan keberatan atau pengaduan</strong> kepada kontak di bagian 11, atau
                kepada lembaga pelindungan data pribadi sesuai UU PDP.
            </li>
        </ul>
        <p>Permintaan ditanggapi sesuai jangka waktu yang ditetapkan UU PDP.</p>
    </section>

    <section id="kontak">
        <h2>11. Kontak</h2>
        <p>
            Pertanyaan, permintaan, dan pengaduan terkait data pribadi ditujukan kepada:
            <strong>{{ $contact }}</strong> —
            {{-- Placeholder; ganti dengan email resmi sebelum kebijakan ini dipakai untuk Play Console. --}}
            <a href="mailto:admin@perusahaan.co.id">admin@perusahaan.co.id</a>.
        </p>
    </section>

    <section id="perubahan">
        <h2>12. Perubahan kebijakan</h2>
        <p>
            Bila isi kebijakan ini berubah secara substansi, nomor versinya dinaikkan dan tanggal
            berlaku diperbarui. Karyawan akan diminta menyetujui ulang sebelum check-in GPS + selfie
            berikutnya. Kebijakan ini juga berlaku sebagai kebijakan privasi aplikasi Android
            {{ $appName }}.
        </p>
        <p>
            <strong>Versi 2.0 (14 Oktober 2026)</strong> menambahkan penjelasan tentang pengiriman
            foto selfie bercap dan keterangan absensi ke grup WhatsApp perusahaan (bagian 5),
            penggunaan peta dan layanan OpenStreetMap (bagian 6), serta penyimpanan data terenkripsi
            di ponsel untuk mode offline aplikasi Android (bagian 7).
        </p>
    </section>

    <footer>
        {{ $appName }} · aplikasi kerja internal {{ $companyName }} ·
        <a href="/login">Masuk ke aplikasi</a>
    </footer>
</main>
</body>
</html>
