import { Head, usePage } from '@inertiajs/react';
import { ChevronRight, MapPin, ShieldCheck } from 'lucide-react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { useKioskCode } from '@/features/kiosk/use-kiosk-code';
import { formatLongDate, formatTime } from '@/lib/format';
import { remainingFraction, secondsLeft } from '@/lib/kiosk';
import { cn } from '@/lib/utils';
import type { KioskState } from '@/types/attendance';

type Props = KioskState & {
    kiosk: { id: string; name: string; code: string };
    location: { id: string; name: string };
    companyName: string;
    windowSeconds: number;
};

const STEPS = [
    <>
        Buka aplikasi <strong className="font-semibold">RuangKerja</strong>
    </>,
    <>
        Ketuk <strong className="font-semibold">Absensi</strong>
    </>,
    <>
        Pilih <strong className="font-semibold">Pindai QR</strong> lalu arahkan
        ke kode ini
    </>,
];

/**
 * /kiosk/{location} (mockup Kiosk): full-screen lobby display. The QR changes
 * every 30 seconds; no navigation, the kiosk account can open nothing else.
 */
export default function KioskShow(props: Props) {
    const { branding } = usePage().props;
    const { state, now, offline } = useKioskCode(props.location.id, props);
    const { code, recent } = state;
    const left = secondsLeft(code.validUntil, now);
    const fraction = remainingFraction(code.validFrom, code.validUntil, now);

    return (
        <div className="dark min-h-dvh overflow-hidden bg-background text-text">
            <Head title={`Kiosk · ${props.location.name}`} />
            <div className="mx-auto grid min-h-dvh max-w-[1440px] gap-8 p-6 md:p-10 lg:grid-cols-[1fr_auto_minmax(260px,320px)] lg:items-center lg:gap-10 xl:p-14">
                {/* Left: brand, clock, place, steps */}
                <section className="flex flex-col gap-8 lg:h-full lg:justify-between">
                    <div className="flex items-center gap-3">
                        <span
                            aria-hidden
                            className="flex size-13 items-center justify-center rounded-[16px] bg-grad-merek text-[17px] font-extrabold text-on-brand"
                        >
                            {branding.shortName}
                        </span>
                        <span className="grid leading-tight">
                            <span className="text-title font-bold">
                                {props.companyName}
                            </span>
                            <span className="text-meta text-text-muted">
                                {branding.name} · Kiosk absensi
                            </span>
                        </span>
                    </div>

                    <div>
                        <p
                            className="text-[96px] leading-none font-extrabold tracking-[-0.04em] tnum md:text-[136px]"
                            aria-label={`Pukul ${formatTime(now)}`}
                        >
                            {formatTime(now)}
                        </p>
                        <p className="mt-4 text-h2 font-semibold text-text first-letter:uppercase">
                            {formatLongDate(now)}
                        </p>
                        <p className="mt-4 flex items-center gap-2 text-body-lg text-text-muted">
                            <MapPin
                                className="size-5 text-link"
                                strokeWidth={1.9}
                                aria-hidden
                            />
                            {props.location.name} · {props.kiosk.name}
                        </p>
                    </div>

                    <ol className="flex flex-col gap-3">
                        {STEPS.map((step, index) => (
                            <li
                                key={index}
                                className="flex items-center gap-4 text-body-lg"
                            >
                                <span
                                    className={cn(
                                        'flex size-10 shrink-0 items-center justify-center rounded-full text-[16px] font-bold',
                                        index === STEPS.length - 1
                                            ? 'bg-grad-aksi text-on-brand'
                                            : 'border border-border-strong text-text',
                                    )}
                                >
                                    {index + 1}
                                </span>
                                <span>{step}</span>
                                {index === STEPS.length - 1 && (
                                    <ChevronRight
                                        className="size-5 text-link"
                                        aria-hidden
                                    />
                                )}
                            </li>
                        ))}
                    </ol>
                </section>

                {/* Center: the QR card */}
                <section
                    aria-labelledby="kiosk-qr-title"
                    className="mx-auto w-full max-w-[420px]"
                >
                    <div className="rounded-sheet bg-qr-paper p-7 text-qr-ink shadow-float">
                        <div className="flex items-center justify-between gap-3">
                            <h1 id="kiosk-qr-title" className="text-h3">
                                Pindai untuk check-in
                            </h1>
                            <Badge
                                role="status"
                                variant="status"
                                className="bg-qr-ink/8 text-qr-ink"
                            >
                                <span
                                    aria-hidden
                                    className={cn(
                                        'size-2 rounded-full',
                                        offline
                                            ? 'bg-fill-warning'
                                            : 'bg-fill-teal',
                                    )}
                                />
                                {offline ? 'Menyambung ulang…' : 'Aktif'}
                            </Badge>
                        </div>

                        <div className="relative mt-6">
                            <div
                                role="img"
                                aria-label="Kode QR absensi"
                                className={cn(
                                    'aspect-square w-full transition-opacity duration-200 [&>svg]:size-full',
                                    offline && 'opacity-30',
                                )}
                                // Server-rendered SVG (bacon/bacon-qr-code), no user input.
                                dangerouslySetInnerHTML={{ __html: code.svg }}
                            />
                            <span
                                aria-hidden
                                className="absolute top-1/2 left-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border-4 border-qr-paper bg-grad-merek text-[16px] font-extrabold text-on-brand"
                            >
                                {branding.shortName}
                            </span>
                        </div>

                        <div
                            className="mt-6 h-2 overflow-hidden rounded-full bg-qr-ink/10"
                            aria-hidden
                        >
                            <div
                                className="h-full rounded-full bg-grad-merek-x transition-[width] duration-200 ease-linear motion-reduce:transition-none"
                                style={{ width: `${fraction * 100}%` }}
                            />
                        </div>
                        <div className="mt-3 flex items-center justify-between text-[16px]">
                            <span>
                                Kode berganti dalam{' '}
                                <strong className="font-semibold tnum">
                                    {left}
                                </strong>{' '}
                                detik
                            </span>
                            <span className="font-mono font-semibold tracking-wide opacity-70">
                                {props.kiosk.code}
                            </span>
                        </div>
                    </div>
                    <p className="mt-4 flex gap-2 text-[15px] text-text-muted">
                        <ShieldCheck
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden
                        />
                        Kode hanya berlaku {props.windowSeconds} detik dan tidak
                        bisa difoto untuk dipakai nanti.
                    </p>
                </section>

                {/* Right: latest check-ins (first name + initial only) */}
                <aside
                    aria-labelledby="kiosk-recent-title"
                    className="w-full rounded-panel border border-border bg-surface shadow-card"
                >
                    <div className="flex items-center justify-between border-b border-divider px-5 py-4">
                        <h2
                            id="kiosk-recent-title"
                            className="text-title font-bold"
                        >
                            Baru saja check-in
                        </h2>
                        <span
                            aria-hidden
                            className="size-2 rounded-full bg-success"
                        />
                    </div>
                    {recent.length === 0 ? (
                        <p className="px-5 py-6 text-[15px] text-text-muted">
                            Belum ada check-in di lokasi ini hari ini.
                        </p>
                    ) : (
                        <ul
                            aria-live="polite"
                            className="divide-y divide-divider"
                        >
                            {recent.map((item, index) => (
                                <li
                                    key={item.id}
                                    className={cn(
                                        'flex min-h-14 items-center gap-3 px-5 py-2.5',
                                        index === 0 && 'bg-link-soft',
                                    )}
                                >
                                    <UserAvatar
                                        name={item.name}
                                        className="size-9 text-[13px]"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">
                                        {item.name}
                                    </span>
                                    <span className="text-[15px] font-semibold text-text-muted tnum">
                                        {formatTime(item.at)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="border-t border-divider px-5 py-3 text-meta text-text-muted">
                        Hanya nama depan dan inisial yang ditampilkan di layar
                        umum.
                    </p>
                </aside>
            </div>
        </div>
    );
}
