import { Link } from '@inertiajs/react';
import {
    ChevronRight,
    Clock,
    Download,
    Eye,
    ExternalLink,
    Loader2,
    MapPin,
    ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { policy } from '@/routes/attendance';

type Props = {
    version: string;
    retentionMonths: number;
    processing: boolean;
    onAccept: () => void;
    /** Mobile: the footer sticks to the bottom of the screen. */
    stickyFooter?: boolean;
};

function Item({
    icon: Icon,
    title,
    children,
    accent = false,
}: {
    icon: LucideIcon;
    title: string;
    children: ReactNode;
    accent?: boolean;
}) {
    return (
        <li className="flex gap-3.5 p-4">
            <span
                aria-hidden
                className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-control',
                    accent
                        ? 'bg-link-soft text-link'
                        : 'bg-surface-2 text-text-muted',
                )}
            >
                <Icon className="size-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 space-y-1">
                <p className="text-[16px] font-bold text-text">{title}</p>
                <div className="text-[15px] leading-[22px] text-text-muted">
                    {children}
                </div>
            </div>
        </li>
    );
}

/** UU PDP consent before the first check-in (mockup CheckinConsent). */
export function ConsentContent({
    version,
    retentionMonths,
    processing,
    onAccept,
    stickyFooter = false,
}: Props) {
    const [agreed, setAgreed] = useState(false);

    return (
        <div className="flex min-h-full flex-col">
            <div className="flex-1 space-y-5 px-4 pb-6 md:px-0">
                <span
                    aria-hidden
                    className="flex size-16 items-center justify-center rounded-xl bg-grad-soft text-link"
                >
                    <ShieldCheck className="size-[30px]" strokeWidth={1.9} />
                </span>
                <div className="space-y-2">
                    <h2 className="text-h2 text-text">
                        Sebelum check-in pertama
                    </h2>
                    <p className="text-body text-text-muted">
                        Absensi memakai data pribadi Anda. Berikut yang kami
                        kumpulkan dan alasannya, sesuai UU Pelindungan Data
                        Pribadi.
                    </p>
                </div>
                <ul className="divide-y divide-divider overflow-hidden rounded-panel border border-border bg-surface shadow-card">
                    <Item icon={MapPin} title="Yang direkam">
                        <ul className="list-disc space-y-0.5 pl-4">
                            <li>
                                Lokasi,{' '}
                                <strong className="font-semibold text-text">
                                    hanya saat check-in &amp; check-out
                                </strong>
                            </li>
                            <li>Foto selfie saat absen</li>
                            <li>Info perangkat (jenis browser, alamat IP)</li>
                        </ul>
                    </Item>
                    <Item icon={Clock} title="Disimpan berapa lama">
                        Selfie disimpan {retentionMonths} bulan, lalu dihapus
                        otomatis.
                    </Item>
                    <Item icon={Eye} title="Siapa yang bisa melihat">
                        HR dan atasan langsung Anda. Setiap akses tercatat di
                        log audit.
                    </Item>
                    <Item icon={Download} title="Hak Anda" accent>
                        Lihat dan ekspor data absensi sendiri kapan saja. Cabut
                        persetujuan lewat Menu → Privasi.
                    </Item>
                </ul>
            </div>
            <div
                className={cn(
                    'space-y-4 border-t border-border px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)] md:px-0 md:pb-0',
                    stickyFooter &&
                        'glass sticky bottom-0 border-x-0 border-b-0',
                )}
            >
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[16px] font-semibold text-text">
                    <Checkbox
                        checked={agreed}
                        onCheckedChange={(value) => setAgreed(value === true)}
                        aria-describedby="consent-version"
                    />
                    Saya sudah membaca dan menyetujui
                </label>
                <Button
                    type="button"
                    onClick={onAccept}
                    disabled={!agreed || processing}
                    size="lg"
                    className="w-full"
                >
                    {processing ? (
                        <Loader2 className="animate-spin" aria-hidden />
                    ) : null}
                    Setujui &amp; lanjutkan
                    {!processing && <ChevronRight aria-hidden />}
                </Button>
                <p id="consent-version" className="text-center">
                    <Link
                        href={policy()}
                        className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-link hover:underline"
                    >
                        Baca kebijakan lengkap (versi {version})
                        <ExternalLink className="size-4" aria-hidden />
                    </Link>
                </p>
            </div>
        </div>
    );
}
