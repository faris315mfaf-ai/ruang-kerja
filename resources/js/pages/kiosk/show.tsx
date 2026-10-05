import { Head, usePage } from '@inertiajs/react';
import { ChevronRight, MapPin, ShieldCheck } from 'lucide-react';
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
                            className="flex size-10 items-center justify-center rounded-lg bg-(image:--brand-gradient) text-sm font-semibold text-on-brand"
                        >
                            {branding.shortName}
                        </span>
                        <span className="grid leading-tight">
                            <span className="text-base font-semibold">
                                {props.companyName}
                            </span>
                            <span className="text-xs text-text-muted">
                                {branding.name} · Kiosk absensi
                            </span>
                        </span>
                    </div>

                    <div>
                        <p
                            className="font-mono text-[96px] leading-none font-medium tracking-tight tnum md:text-[128px]"
                            aria-label={`Pukul ${formatTime(now)}`}
                        >
                            {formatTime(now)}
                        </p>
                        <p className="mt-4 text-2xl text-text">
                            {formatLongDate(now)}
                        </p>
                        <p className="mt-4 flex items-center gap-2 text-base text-text-muted">
                            <MapPin
                                className="size-5 text-primary"
                                strokeWidth={1.75}
                                aria-hidden
                            />
                            {props.location.name} · {props.kiosk.name}
                        </p>
                    </div>

                    <ol className="space-y-3">
                        {STEPS.map((step, index) => (
                            <li
                                key={index}
                                className="flex items-center gap-4 text-base"
                            >
                                <span
                                    className={cn(
                                        'flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                                        index === STEPS.length - 1
                                            ? 'border-primary/40 bg-link-soft text-primary'
                                            : 'border-border-strong text-text',
                                    )}
                                >
                                    {index + 1}
                                </span>
                                <span>{step}</span>
                                {index === STEPS.length - 1 && (
                                    <ChevronRight
                                        className="size-5 text-primary"
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
                    <div className="rounded-3xl bg-qr-paper p-7 text-qr-ink shadow-card">
                        <div className="flex items-center justify-between gap-3">
                            <h1
                                id="kiosk-qr-title"
                                className="text-lg font-semibold"
                            >
                                Pindai untuk check-in
                            </h1>
                            <span
                                role="status"
                                className={cn(
                                    'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-sm font-medium',
                                    offline
                                        ? 'bg-warning-soft text-warning'
                                        : 'bg-success/15 text-success',
                                )}
                            >
                                <span
                                    aria-hidden
                                    className={cn(
                                        'size-1.5 rounded-full',
                                        offline ? 'bg-warning' : 'bg-success',
                                    )}
                                />
                                {offline ? 'Menyambung ulang…' : 'Aktif'}
                            </span>
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
                                className="absolute top-1/2 left-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border-4 border-qr-paper bg-(image:--brand-gradient) text-base font-semibold text-on-brand"
                            >
                                {branding.shortName}
                            </span>
                        </div>

                        <div
                            className="mt-6 h-1.5 overflow-hidden rounded-full bg-qr-ink/10"
                            aria-hidden
                        >
                            <div
                                className="h-full rounded-full bg-primary transition-[width] duration-200 ease-linear"
                                style={{ width: `${fraction * 100}%` }}
                            />
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                            <span>
                                Kode berganti dalam{' '}
                                <strong className="font-semibold tnum">
                                    {left}
                                </strong>{' '}
                                detik
                            </span>
                            <span className="font-mono tracking-wide opacity-70">
                                {props.kiosk.code}
                            </span>
                        </div>
                    </div>
                    <p className="mt-4 flex gap-2 text-sm text-text-muted">
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
                    className="w-full rounded-2xl border border-border bg-surface/80"
                >
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <h2
                            id="kiosk-recent-title"
                            className="text-sm font-semibold"
                        >
                            Baru saja check-in
                        </h2>
                        <span
                            aria-hidden
                            className="size-2 rounded-full bg-success"
                        />
                    </div>
                    {recent.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-text-muted">
                            Belum ada check-in di lokasi ini hari ini.
                        </p>
                    ) : (
                        <ul
                            aria-live="polite"
                            className="divide-y divide-border"
                        >
                            {recent.map((item, index) => (
                                <li
                                    key={item.id}
                                    className={cn(
                                        'flex items-center gap-3 px-4 py-3',
                                        index === 0 && 'bg-surface-2',
                                    )}
                                >
                                    <span
                                        aria-hidden
                                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-on-brand"
                                    >
                                        {item.initials}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-sm">
                                        {item.name}
                                    </span>
                                    <span className="font-mono text-sm text-text-muted tnum">
                                        {formatTime(item.at)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="border-t border-border px-4 py-3 text-xs text-text-muted">
                        Hanya nama depan dan inisial yang ditampilkan di layar
                        umum.
                    </p>
                </aside>
            </div>
        </div>
    );
}
