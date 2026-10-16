import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn, focusRing } from '@/lib/utils';

type Props = {
    version: string;
    retentionMonths: number;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-2">
            <h2 className="text-title font-bold text-text">{title}</h2>
            <div className="flex flex-col gap-2 text-body text-text-muted">
                {children}
            </div>
        </section>
    );
}

/**
 * Full attendance data policy (UU PDP No. 27/2022; SPengaturan card style),
 * linked from the consent screen. The version comes from config/attendance.php.
 */
export default function AttendancePrivacyPolicy({
    version,
    retentionMonths,
}: Props) {
    return (
        <>
            <Head title="Kebijakan data absensi" />
            <article className="mx-auto flex max-w-3xl flex-col gap-6 rounded-panel border border-border bg-surface p-6 shadow-card md:p-8">
                <header className="flex flex-col gap-1.5 border-b border-divider pb-5">
                    <Link
                        href="/absensi"
                        className={cn(
                            '-mt-2 hidden min-h-control items-center gap-2 self-start rounded-control text-label font-semibold text-link hover:opacity-80 md:inline-flex',
                            focusRing,
                        )}
                    >
                        <ArrowLeft className="size-5" aria-hidden />
                        Kembali ke absensi
                    </Link>
                    <h1 className="text-h2">
                        Kebijakan data lokasi &amp; selfie absensi
                    </h1>
                    <Badge variant="label" tone="neutral">
                        Versi {version}
                    </Badge>
                </header>

                <Section title="1. Data yang dikumpulkan">
                    <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-text-subtle">
                        <li>
                            Lokasi GPS (koordinat dan akurasi) hanya pada saat
                            Anda menekan check-in atau check-out. Aplikasi tidak
                            melacak lokasi di luar momen itu.
                        </li>
                        <li>Foto selfie pada saat check-in dan check-out.</li>
                        <li>
                            Rencana kerja saat check-in dan laporan kerja saat
                            check-out.
                        </li>
                        <li>
                            Informasi teknis: alamat IP, jenis browser, dan
                            penanda acak perangkat yang dibuat aplikasi (bukan
                            data perangkat keras).
                        </li>
                        <li>
                            Catatan lokasi/aktivitas yang Anda tulis saat WFH
                            atau bertugas di lapangan.
                        </li>
                    </ul>
                </Section>

                <Section title="2. Tujuan">
                    <p>
                        Mencatat kehadiran sesuai jadwal kerja, memastikan
                        check-in dilakukan sendiri di lokasi yang benar, dan
                        menyusun rekap kehadiran untuk penggajian, serta
                        menyampaikan kehadiran dan laporan kerja harian kepada
                        anggota grup WhatsApp perusahaan (bagian 4). Data tidak
                        dipakai untuk menilai produktivitas atau memantau
                        aktivitas Anda.
                    </p>
                </Section>

                <Section title="3. Peta dan layanan OpenStreetMap">
                    <p>
                        Lokasi Anda ditampilkan di peta OpenStreetMap. Di
                        aplikasi Android, peta diambil lewat server RuangKerja:
                        OpenStreetMap hanya menerima nomor ubin peta, bukan
                        koordinat atau alamat IP ponsel Anda. Di web, peramban
                        Anda mengambil ubin langsung dari OpenStreetMap (alamat
                        IP peramban dan nomor ubin diterima OpenStreetMap).
                    </p>
                    <p>
                        Untuk foto bercap yang dikirim ke grup WhatsApp, server
                        mengambil ubin peta di sekitar posisi Anda dan, bila
                        Anda di luar lokasi kantor dan bukan WFH, mengirim
                        koordinat GPS Anda (tanpa nama atau identitas) ke
                        layanan pencarian nama tempat OpenStreetMap (Nominatim)
                        untuk mendapatkan nama kelurahan atau kecamatan pada
                        foto.
                    </p>
                </Section>

                <Section title="4. Pengiriman ke grup WhatsApp">
                    <p>
                        Setiap check-in dan check-out dikirim otomatis ke grup
                        WhatsApp perusahaan (grup &ldquo;DAILY REPORT&rdquo;).
                        Untuk check-in GPS + selfie, yang dikirim adalah{' '}
                        <strong>foto selfie Anda yang diberi cap</strong> jam,
                        tanggal, nama tempat, dan peta kecil dengan penanda
                        posisi Anda (termasuk saat WFH), dengan keterangan
                        berisi nama, tanggal, jam, lokasi, rencana atau laporan
                        kerja, dan lama kerja. Lewat kiosk QR, hanya pesan teks
                        (nama, jam, lokasi) yang dikirim.
                    </p>
                    <p>
                        Anggota grup ditetapkan perusahaan di WhatsApp. Setelah
                        terkirim, pesan tersimpan di WhatsApp dan di perangkat
                        anggota grup, di luar kendali aplikasi: tidak dapat
                        ditarik kembali, dan batas penyimpanan selfie{' '}
                        {retentionMonths} bulan tidak berlaku untuk salinan itu.
                    </p>
                </Section>

                <Section title="5. Penyimpanan dan retensi">
                    <p>
                        Selfie disimpan di penyimpanan privat terenkripsi dan
                        dihapus otomatis setelah {retentionMonths} bulan.
                        Catatan kehadiran (jam masuk/pulang, status) disimpan
                        selama hubungan kerja dan sesuai kewajiban hukum
                        ketenagakerjaan. Foto bercap tidak disimpan di server.
                        Pada aplikasi Android, selfie dan titik GPS dari absen
                        offline disimpan terenkripsi di ponsel sampai terkirim
                        (maks. 72 jam; absen ditandai &ldquo;offline&rdquo;
                        untuk ditinjau HR).
                    </p>
                </Section>

                <Section title="6. Siapa yang dapat mengakses">
                    <p>
                        Di dalam aplikasi: Anda sendiri, atasan langsung Anda,
                        dan HR. Selfie hanya dibuka lewat tautan sementara
                        (berlaku 5 menit) dan setiap akses oleh orang lain
                        tercatat di log audit. Super Admin sistem tidak dapat
                        melihat selfie. Selain itu, seluruh anggota grup
                        WhatsApp laporan harian menerima foto bercap dan
                        keterangan absensi Anda (bagian 4).
                    </p>
                </Section>

                <Section title="7. Penandaan otomatis">
                    <p>
                        Sistem menandai absensi yang tidak biasa (akurasi GPS
                        rendah, jam perangkat berbeda, perangkat baru,
                        perpindahan tidak wajar, selfie gelap) agar ditinjau HR.
                        Penandaan tidak membatalkan absensi Anda.
                    </p>
                </Section>

                <Section title="8. Hak Anda">
                    <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-text-subtle">
                        <li>
                            Melihat riwayat absensi Anda kapan saja di halaman
                            Absensi, dan mengunduh seluruh data Anda (Excel atau
                            PDF) di{' '}
                            <Link
                                href="/privasi"
                                className="font-semibold text-link hover:opacity-80"
                            >
                                Privasi &amp; data saya
                            </Link>
                            .
                        </li>
                        <li>Meminta koreksi data kepada HR.</li>
                        <li>
                            Mencabut persetujuan lewat halaman Absensi atau
                            Privasi &amp; data saya. Setelah dicabut, check-in
                            GPS + selfie tidak bisa dilakukan sampai Anda
                            menyetujui lagi; HR diberi tahu untuk mengatur cara
                            absensi lain. Pencabutan tidak menarik kembali pesan
                            yang sudah terkirim ke grup WhatsApp.
                        </li>
                    </ul>
                </Section>

                <p className="border-t border-divider pt-5 text-label font-normal text-text-muted">
                    Kebijakan ini mengikuti UU No. 27 Tahun 2022 tentang
                    Pelindungan Data Pribadi dan merupakan bagian dari{' '}
                    <Link
                        href="/kebijakan-privasi"
                        className="font-semibold text-link hover:opacity-80"
                    >
                        kebijakan privasi
                    </Link>
                    . Bila teks berubah, versinya dinaikkan dan Anda diminta
                    menyetujui ulang sebelum check-in berikutnya.
                </p>
            </article>
        </>
    );
}

AttendancePrivacyPolicy.layout = {
    breadcrumbs: [
        { title: 'Absensi', href: '/absensi' },
        { title: 'Kebijakan data', href: '/absensi/kebijakan-data' },
    ],
    title: 'Kebijakan data',
    back: '/absensi',
};
