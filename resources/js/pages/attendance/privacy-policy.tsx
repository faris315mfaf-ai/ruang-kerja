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
                            absensi lain.
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
