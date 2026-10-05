import { Link } from '@inertiajs/react';
import { Camera, Check, ChevronRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TONE_CLASSES, formatDuration, statusTone } from '@/lib/attendance';
import { formatTime } from '@/lib/format';
import { formatDistance } from '@/lib/geo';
import { cn } from '@/lib/utils';
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

function Row({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="grid grid-cols-[72px_1fr] items-baseline gap-3 text-[15px]">
            <dt className="text-text-muted">{label}</dt>
            <dd className="min-w-0 text-text">{children}</dd>
        </div>
    );
}

type Props = { result: CheckResult; onDone: () => void };

/** Mockup CheckinSukses. */
export function CheckSuccess({ result, onDone }: Props) {
    const { badge, hint } = headline(result);
    const tone =
        result.type === 'check_out' && result.earlyLeaveMinutes === 0
            ? 'success'
            : statusTone(result.status);
    const title =
        result.type === 'check_in' ? 'Check-in berhasil' : 'Check-out berhasil';

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col items-center pt-2 text-center">
                <span
                    aria-hidden
                    className="flex size-[88px] items-center justify-center rounded-full bg-success/10"
                >
                    <span className="flex size-12 items-center justify-center rounded-full bg-success text-on-brand">
                        <Check className="size-7" strokeWidth={2.5} />
                    </span>
                </span>
                <h2
                    className="mt-4 text-[22px] font-semibold text-text"
                    role="status"
                >
                    {title}
                </h2>
                <p className="font-mono text-[56px] leading-tight font-medium text-text tnum">
                    {formatTime(result.occurredAt)}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                    <span
                        className={cn(
                            'inline-flex h-7 items-center rounded-full px-3 text-sm font-medium',
                            TONE_CLASSES[tone].soft,
                        )}
                    >
                        {badge}
                    </span>
                    {hint && (
                        <span
                            className={cn(
                                'text-[15px]',
                                TONE_CLASSES[tone].text,
                            )}
                        >
                            {hint}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex gap-4 rounded-xl border border-border bg-surface p-4 shadow-card">
                <dl className="min-w-0 flex-1 space-y-2.5">
                    <Row label="Lokasi">
                        {result.location ? (
                            <>
                                {result.method === 'wfh'
                                    ? 'WFH/lapangan'
                                    : result.location.name}
                                <span
                                    className={cn(
                                        'ml-1',
                                        result.location.inside
                                            ? 'text-success'
                                            : 'text-text-muted',
                                    )}
                                >
                                    ·{' '}
                                    {formatDistance(result.location.distanceM)}
                                </span>
                            </>
                        ) : (
                            'WFH/lapangan'
                        )}
                    </Row>
                    <Row label="Metode">{result.methodLabel}</Row>
                    {result.shift && (
                        <Row label="Shift">
                            {result.shift.name}{' '}
                            <span className="font-mono text-sm whitespace-nowrap">
                                {result.shift.hours}
                            </span>
                        </Row>
                    )}
                </dl>
                <div className="flex size-[84px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-2">
                    {result.selfieUrl ? (
                        <img
                            src={result.selfieUrl}
                            alt="Selfie Anda"
                            className="size-full object-cover"
                        />
                    ) : (
                        <Camera
                            className="size-6 text-text-muted"
                            aria-hidden
                        />
                    )}
                </div>
            </div>

            {result.isSuspicious && (
                <p className="flex gap-2 rounded-lg bg-surface-2 p-3 text-sm text-text-muted">
                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                    Absensi tetap tercatat. Sinyal lokasi atau perangkat tidak
                    biasa, jadi HR mungkin meninjaunya.
                </p>
            )}

            <div className="grid gap-2">
                <Button
                    type="button"
                    onClick={onDone}
                    className="h-12 text-base"
                >
                    Selesai
                </Button>
                <Button
                    asChild
                    variant="ghost"
                    className="h-11 text-[15px] text-primary"
                >
                    <Link href="/tugas">
                        Lihat tugas saya
                        <ChevronRight aria-hidden />
                    </Link>
                </Button>
            </div>
        </div>
    );
}
