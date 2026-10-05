import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
    version: string;
    retentionMonths: number;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-2">
            <h2 className="text-base font-semibold text-text">{title}</h2>
            <div className="space-y-2 text-[15px] leading-7 text-text-muted md:text-sm md:leading-6">
                {children}
            </div>
        </section>
    );
}

/**
 * Full attendance data policy (UU PDP No. 27/2022), linked from the consent
 * screen. The version comes from config/attendance.php.
 */
export default function AttendancePrivacyPolicy({
    version,
    retentionMonths,
}: Props) {
    return (
        <>
            <Head title="Kebijakan data absensi" />
            <article className="mx-auto max-w-2xl space-y-6 rounded-xl border border-border bg-surface p-5 shadow-card md:p-8">
                <header className="space-y-1">
                    <Link
                        href="/absensi"
                        className="hidden items-center gap-1.5 text-sm text-text-muted hover:text-text md:inline-flex"
                    >
                        <ArrowLeft className="size-4" aria-hidden />
                        Kembali ke absensi
                    </Link>
                    <h1 className="text-xl leading-7 font-semibold text-text">
                        Kebijakan data lokasi &amp; selfie absensi
                    </h1>
                    <p className="text-sm text-text-muted">Versi {version}</p>
                </header>

                <Section title="1. Data yang dikumpulkan">
                    <ul className="list-disc space-y-1 pl-5">
                        <li>
                            Lokasi GPS (koordinat dan akurasi) hanya pada saat
                            Anda menekan check-in atau check-out. Aplikasi tidak
                            melacak lokasi di luar momen itu.
                        </li>
                        <li>Foto selfie pada saat check-in dan check-out.</li>
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
                        menyusun rekap kehadiran untuk penggajian. Data tidak
                        dipakai untuk menilai produktivitas atau memantau
                        aktivitas Anda.
                    </p>
                </Section>

                <Section title="3. Penyimpanan dan retensi">
                    <p>
                        Selfie disimpan di penyimpanan privat terenkripsi dan
                        dihapus otomatis setelah {retentionMonths} bulan.
                        Catatan kehadiran (jam masuk/pulang, status) disimpan
                        selama hubungan kerja dan sesuai kewajiban hukum
                        ketenagakerjaan.
                    </p>
                </Section>

                <Section title="4. Siapa yang dapat mengakses">
                    <p>
                        Anda sendiri, atasan langsung Anda, dan HR. Selfie hanya
                        dibuka lewat tautan sementara (berlaku 5 menit) dan
                        setiap akses oleh orang lain tercatat di log audit.
                        Super Admin sistem tidak dapat melihat selfie.
                    </p>
                </Section>

                <Section title="5. Penandaan otomatis">
                    <p>
                        Sistem menandai absensi yang tidak biasa (akurasi GPS
                        rendah, jam perangkat berbeda, perangkat baru,
                        perpindahan tidak wajar, selfie gelap) agar ditinjau HR.
                        Penandaan tidak membatalkan absensi Anda.
                    </p>
                </Section>

                <Section title="6. Hak Anda">
                    <ul className="list-disc space-y-1 pl-5">
                        <li>
                            Melihat riwayat absensi Anda kapan saja di halaman
                            Absensi, dan mengunduh seluruh data Anda (Excel atau
                            PDF) di{' '}
                            <Link
                                href="/privasi"
                                className="font-medium text-primary hover:underline"
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
                            absensi lain.
                        </li>
                    </ul>
                </Section>

                <p className="border-t border-border pt-4 text-[13px] text-text-subtle">
                    Kebijakan ini mengikuti UU No. 27 Tahun 2022 tentang
                    Pelindungan Data Pribadi dan merupakan bagian dari{' '}
                    <Link
                        href="/kebijakan-privasi"
                        className="font-medium text-primary hover:underline"
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
