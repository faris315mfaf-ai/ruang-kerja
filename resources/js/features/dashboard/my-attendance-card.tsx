import { Link, usePage } from '@inertiajs/react';
import { LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { START_PARAM } from '@/features/attendance/use-attendance-page';
import { shellStatus } from '@/lib/check-in-status';
import { formatTime, toDate } from '@/lib/format';
import { formatDistance } from '@/lib/geo';
import { cn } from '@/lib/utils';
import type { AttendanceStatusSummary } from '@/types/attendance';
import { MetricInfo } from './metric-info';

/** "8 jam 12 menit" between check-in and check-out. */
export function workedText(
    from: string | null,
    to: string | null,
): string | null {
    const start = toDate(from);
    const end = toDate(to);

    if (!start || !end || end <= start) {
        return null;
    }

    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    return hours > 0 ? `${hours} jam ${rest} menit` : `${rest} menit`;
}

function join(...parts: (string | null | false | undefined)[]): string {
    return parts.filter(Boolean).join(' · ');
}

/** Chip, big line and caption of the hero (SBeranda / MSBeranda). */
export function heroText(status: AttendanceStatusSummary): {
    chip: string;
    big: string;
    sub: string;
} {
    const place = status.isRemote
        ? 'WFH/lapangan'
        : join(
              status.locationName,
              status.distanceM !== null &&
                  `${formatDistance(status.distanceM)} dari titik lokasi`,
          );

    switch (status.action) {
        case 'check_out':
            return {
                chip:
                    status.status === 'late' && status.lateMinutes > 0
                        ? `Sudah check-in · terlambat ${status.lateMinutes} menit`
                        : 'Sudah check-in · tepat waktu',
                big: `Masuk ${formatTime(status.checkInAt)}`,
                sub: join(
                    place,
                    status.endLabel && `pulang terjadwal ${status.endLabel}`,
                ),
            };
        case 'done':
            return {
                chip: 'Selesai hari ini',
                big: `${formatTime(status.checkInAt)} – ${formatTime(status.checkOutAt)}`,
                sub: join(
                    workedText(status.checkInAt, status.checkOutAt),
                    place,
                ),
            };
        case 'unavailable':
            return {
                chip: 'Tercatat dari pengajuan',
                big: status.statusLabel ?? 'Tidak masuk',
                sub: 'Tidak perlu check-in hari ini',
            };
        case 'check_in':
            return {
                chip: status.isHoliday ? 'Hari libur' : 'Belum check-in',
                big: status.startLabel
                    ? `Jadwal ${status.startLabel}${status.endLabel ? `–${status.endLabel}` : ''}`
                    : 'Tidak ada jadwal',
                sub:
                    join(
                        status.shiftName && `Shift ${status.shiftName}`,
                        status.locationName,
                    ) ||
                    (status.isHoliday
                        ? 'Check-in tetap bisa dicatat'
                        : 'Buka halaman absensi untuk check-in'),
            };
    }
}

/**
 * "Absensi hari ini" hero (SBeranda / MSBeranda): gradient aksi card with a
 * status chip, the big check-in line and the next action as a white button.
 * Data: the shared `attendanceStatus` prop (Sprint 2).
 */
export function MyAttendanceCard({
    className,
    compact = false,
}: {
    className?: string;
    /** Phone layout (MSBeranda): smaller type, button beside the text. */
    compact?: boolean;
}) {
    const { attendanceStatus: status } = usePage().props;

    if (!status) {
        return null;
    }

    const shell = shellStatus(status);
    const text = heroText(status);
    const late = status.status === 'late' && status.lateMinutes > 0;
    const buttonClass = cn(
        'border-0 bg-on-brand font-extrabold text-brand-700 hover:bg-on-brand/90',
        compact && 'h-12 rounded-[14px] px-4 font-extrabold',
    );

    return (
        <section
            aria-labelledby="my-attendance"
            className={cn(
                'flex items-center justify-between rounded-panel bg-primary bg-grad-highlight text-on-brand shadow-glow',
                compact ? 'gap-3.5 p-[18px]' : 'flex-wrap gap-5 p-[26px]',
                className,
            )}
        >
            <div
                className={cn(
                    'flex min-w-0 flex-col',
                    compact ? 'gap-0.5' : 'gap-2',
                )}
            >
                <h2 id="my-attendance" className="sr-only">
                    Absensi hari ini
                </h2>
                <span
                    className={cn(
                        'inline-flex items-center gap-2 self-start font-bold',
                        compact
                            ? 'text-[14px] uppercase'
                            : 'min-h-8 rounded-full bg-on-brand/18 px-3 text-[15px]',
                    )}
                >
                    {!compact && (
                        <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full bg-on-brand"
                        />
                    )}
                    {text.chip}
                    {late && (
                        <MetricInfo
                            definition="Terlambat dihitung dari batas toleransi shift, bukan dari jam masuk."
                            className="text-on-brand/80 hover:text-on-brand"
                        />
                    )}
                </span>
                <span
                    className={cn(
                        'font-extrabold tracking-[-0.03em] tnum',
                        compact
                            ? 'text-[30px] leading-9'
                            : 'text-[44px] leading-[50px]',
                    )}
                >
                    {text.big}
                </span>
                <span className={compact ? 'text-[15px]' : 'text-[16px]'}>
                    {text.sub}
                </span>
            </div>
            <Button
                asChild
                variant="outline"
                size={compact ? 'default' : 'lg'}
                className={buttonClass}
            >
                {shell.button ? (
                    <Link href={`/absensi?${START_PARAM}=1`}>
                        {shell.button.label === 'Check-in' ? (
                            <LogIn aria-hidden />
                        ) : (
                            <LogOut aria-hidden />
                        )}
                        {shell.button.label}
                    </Link>
                ) : (
                    <Link href="/pengajuan/baru?kategori=correction">
                        Ajukan koreksi
                    </Link>
                )}
            </Button>
        </section>
    );
}
