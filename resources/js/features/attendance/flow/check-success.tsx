import { Link } from '@inertiajs/react';
import { Camera, Check, Info, QrCode } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDuration, statusTone } from '@/lib/attendance';
import { formatTime } from '@/lib/format';
import { formatDistance } from '@/lib/geo';
import { cn, focusRing } from '@/lib/utils';
import type { CheckResult } from '@/types/attendance';

function headline(result: CheckResult): { badge: string; hint: string | null } {
    if (result.type === 'check_out') {
        if (result.earlyLeaveMinutes > 0) {
            return {
                badge: `Pulang cepat ${result.earlyLeaveMinutes} menit`,
                hint: `Durasi kerja ${formatDuration(result.workMinutes)}`,
            };
        }

        return {
            badge: 'Sampai jumpa',
            hint: `Durasi kerja ${formatDuration(result.workMinutes)}`,
        };
    }

    if (result.status === 'late') {
        return {
            badge: `Terlambat ${result.lateMinutes} menit`,
            hint: 'Dihitung dari batas toleransi.',
        };
    }

    if (result.status === 'wfh') {
        return {
            badge: 'WFH',
            hint: result.minutesBeforeStart
                ? `${result.minutesBeforeStart} menit sebelum jam masuk`
                : null,
        };
    }

    return {
        badge: result.shift ? 'Tepat waktu' : 'Tercatat',
        hint: result.minutesBeforeStart
            ? `${result.minutesBeforeStart} menit sebelum jam masuk`
            : null,
    };
}

type Detail = { label: string; value: ReactNode };

/** Lokasi · Jarak · Metode · Shift rows (MSukses glass card). */
function details(result: CheckResult): Detail[] {
    const rows: Detail[] = [
        {
            label: 'Lokasi',
            value:
                !result.location || result.method === 'wfh'
                    ? 'WFH/lapangan'
                    : result.location.name,
        },
    ];

    if (result.location?.distanceM != null && result.method !== 'wfh') {
        rows.push({
            label: 'Jarak',
            value: `${formatDistance(result.location.distanceM)} · ${result.location.inside ? 'dalam radius' : 'di luar radius'}`,
        });
    }

    rows.push({ label: 'Metode', value: result.methodLabel });

    if (result.shift) {
        rows.push({
            label: 'Shift',
            value: (
                <>
                    {result.shift.name}{' '}
                    <span className="whitespace-nowrap tnum">
                        {result.shift.hours}
                    </span>
                </>
            ),
        });
    }

    return rows;
}

function Thumbnail({
    result,
    className,
}: {
    result: CheckResult;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'flex shrink-0 items-center justify-center overflow-hidden',
                className,
            )}
        >
            {result.selfieUrl ? (
                <img
                    src={result.selfieUrl}
                    alt="Selfie Anda"
                    className="size-full object-cover"
                />
            ) : result.method === 'qr' ? (
                <QrCode className="size-6" aria-hidden />
            ) : (
                <Camera className="size-6" aria-hidden />
            )}
        </span>
    );
}

const SUSPICIOUS =
    'Absensi tetap tercatat. Sinyal lokasi atau perangkat tidak biasa, jadi HR mungkin meninjaunya.';

type Props = {
    result: CheckResult;
    onDone: () => void;
    /**
     * `hero`: full-screen gradient confirmation (MSukses, phones);
     * `card`: the same content on surface colours (desktop dialog).
     */
    variant?: 'hero' | 'card';
};

/** Check-in/out confirmation (MSukses). */
export function CheckSuccess({ result, onDone, variant = 'card' }: Props) {
    const { badge, hint } = headline(result);
    const title =
        result.type === 'check_in' ? 'Check-in berhasil' : 'Check-out berhasil';
    const rows = details(result);

    if (variant === 'hero') {
        return (
            <div className="flex min-h-svh flex-col items-center gap-[22px] bg-primary bg-grad-highlight px-5 pt-[calc(env(safe-area-inset-top)+56px)] pb-[calc(env(safe-area-inset-bottom)+28px)] text-on-brand">
                <span
                    aria-hidden
                    className="flex size-[132px] items-center justify-center rounded-full bg-on-brand/16"
                >
                    <span className="flex size-24 items-center justify-center rounded-full bg-on-brand text-primary shadow-float">
                        <Check className="size-12" strokeWidth={2.6} />
                    </span>
                </span>
                <div className="flex flex-col items-center gap-2 text-center">
                    <h2 role="status" className="text-display">
                        {title}
                    </h2>
                    <p className="text-[64px] leading-[70px] font-extrabold tracking-[-0.04em] tnum">
                        {formatTime(result.occurredAt)}
                    </p>
                    <span className="inline-flex min-h-9 items-center rounded-full bg-on-brand/18 px-4 py-1 text-[16px] font-bold">
                        {hint ? `${badge} · ${hint}` : badge}
                    </span>
                </div>

                <div className="flex w-full items-center gap-3 rounded-panel border border-on-brand/26 bg-on-brand/14 px-[18px] py-1.5">
                    <dl className="min-w-0 flex-1 divide-y divide-on-brand/18">
                        {rows.map((row) => (
                            <div
                                key={row.label}
                                className="flex min-h-[54px] items-center justify-between gap-3 text-[16px]"
                            >
                                <dt>{row.label}</dt>
                                <dd className="min-w-0 text-right font-bold">
                                    {row.value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    {result.selfieUrl && (
                        <Thumbnail
                            result={result}
                            className="size-[72px] rounded-lg border border-on-brand/26"
                        />
                    )}
                </div>

                {result.isSuspicious && (
                    <p className="flex w-full gap-2 rounded-lg bg-on-brand/14 p-3 text-[15px]">
                        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                        {SUSPICIOUS}
                    </p>
                )}

                <span className="flex-1" />
                <Button
                    type="button"
                    size="xl"
                    variant="outline"
                    onClick={onDone}
                    className="w-full rounded-[18px] border-0 bg-on-brand font-extrabold text-primary shadow-float hover:bg-on-brand/90"
                >
                    Selesai
                </Button>
                <div className="flex items-center gap-5 text-[17px] font-bold">
                    <Link
                        href="/absensi/riwayat"
                        className={cn(
                            'inline-flex min-h-11 items-center rounded-control px-1',
                            focusRing,
                        )}
                    >
                        Lihat riwayat absensi
                    </Link>
                    <Link
                        href="/tugas"
                        className={cn(
                            'inline-flex min-h-11 items-center rounded-control px-1',
                            focusRing,
                        )}
                    >
                        Tugas saya
                    </Link>
                </div>
            </div>
        );
    }

    const tone =
        result.type === 'check_out' && result.earlyLeaveMinutes === 0
            ? 'success'
            : statusTone(result.status);

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col items-center gap-2 pt-2 text-center">
                <span
                    aria-hidden
                    className="flex size-[88px] items-center justify-center rounded-full bg-success-soft"
                >
                    <span className="flex size-14 items-center justify-center rounded-full bg-primary bg-grad-aksi text-on-brand shadow-glow">
                        <Check className="size-7" strokeWidth={2.6} />
                    </span>
                </span>
                <h2 className="mt-2 text-h3 text-text" role="status">
                    {title}
                </h2>
                <p className="text-[56px] leading-[64px] font-extrabold tracking-[-0.04em] text-text tnum">
                    {formatTime(result.occurredAt)}
                </p>
                <Badge variant="status" tone={tone} dot>
                    {hint ? `${badge} · ${hint}` : badge}
                </Badge>
            </div>

            <div className="flex items-center gap-4 rounded-card border border-border bg-surface px-5 py-2">
                <dl className="min-w-0 flex-1 divide-y divide-divider">
                    {rows.map((row) => (
                        <div
                            key={row.label}
                            className="flex min-h-12 items-center justify-between gap-3 text-[16px]"
                        >
                            <dt className="text-text-muted">{row.label}</dt>
                            <dd className="min-w-0 text-right font-semibold text-text">
                                {row.value}
                            </dd>
                        </div>
                    ))}
                </dl>
                <Thumbnail
                    result={result}
                    className="size-[84px] rounded-lg border border-border bg-surface-2 text-text-muted"
                />
            </div>

            {result.isSuspicious && (
                <p className="flex gap-2 rounded-lg bg-surface-2 p-3 text-[15px] text-text-muted">
                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {SUSPICIOUS}
                </p>
            )}

            <div className="grid gap-2">
                <Button type="button" size="lg" onClick={onDone}>
                    Selesai
                </Button>
                <div className="flex justify-center gap-2">
                    <Button asChild variant="quiet">
                        <Link href="/absensi/riwayat">
                            Lihat riwayat absensi
                        </Link>
                    </Button>
                    <Button asChild variant="quiet">
                        <Link href="/tugas">Tugas saya</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
