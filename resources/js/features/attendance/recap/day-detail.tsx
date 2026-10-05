import { LogIn, LogOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TONE_CLASSES, formatDuration, statusTone } from '@/lib/attendance';
import { formatDate, formatTime } from '@/lib/format';
import { cellLabel } from '@/lib/recap';
import { cn } from '@/lib/utils';
import type {
    AttendanceLogData,
    AttendanceStatus,
    RecapDayCell,
} from '@/types/attendance';

function place(log: AttendanceLogData): string {
    const where =
        log.locationName ??
        (log.method === 'wfh'
            ? 'WFH/lapangan'
            : log.method === 'manual'
              ? 'Koreksi HR'
              : '–');

    return `${where} · ${log.methodLabel}`;
}

/** Selected day of the calendar: status and the check-in/out rows (mockup MRiwayatAbsensi). */
export function DayDetail({
    cell,
    className,
}: {
    cell: RecapDayCell;
    className?: string;
}) {
    const status = ['off', 'upcoming', 'none', 'holiday'].includes(cell.kind)
        ? null
        : (cell.kind as AttendanceStatus);
    const tone = status ? statusTone(status) : 'neutral';
    const badge =
        status === 'late'
            ? `Terlambat ${cell.lateMinutes} m`
            : (cell.statusLabel ??
              (cell.kind === 'holiday'
                  ? (cell.holidayName ?? 'Libur')
                  : cell.kind === 'off'
                    ? 'Tidak terjadwal'
                    : cell.kind === 'upcoming'
                      ? 'Terjadwal'
                      : (cellLabel(cell) ?? 'Belum ada catatan')));

    return (
        <section
            aria-label={`Detail ${formatDate(cell.date)}`}
            className={cn(
                'overflow-hidden rounded-panel border border-border bg-surface shadow-card',
                className,
            )}
        >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider px-5 py-4 md:px-6">
                <h3 className="text-title font-bold text-text">
                    {formatDate(cell.date)}
                </h3>
                <Badge variant="status" tone={tone} dot>
                    {badge}
                </Badge>
            </div>
            {cell.checkIn || cell.checkOut ? (
                <ul className="divide-y divide-divider">
                    {cell.checkIn && (
                        <li className="flex min-h-[72px] items-center gap-3.5 px-5 py-3 md:px-6">
                            <span
                                aria-hidden
                                className={cn(
                                    'flex size-11 shrink-0 items-center justify-center rounded-control',
                                    cell.lateMinutes > 0
                                        ? TONE_CLASSES.warning.soft
                                        : 'bg-link-soft text-link',
                                )}
                            >
                                <LogIn className="size-5" strokeWidth={1.75} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[17px] leading-6 font-semibold text-text">
                                    Masuk
                                    {cell.lateMinutes > 0 && (
                                        <span className="font-normal text-warning">
                                            {' '}
                                            · terlambat {cell.lateMinutes} m
                                        </span>
                                    )}
                                </p>
                                <p className="truncate text-[15px] leading-[22px] text-text-muted">
                                    {place(cell.checkIn)}
                                </p>
                            </div>
                            <span className="text-[20px] font-bold text-text tnum">
                                {formatTime(cell.checkIn.occurredAt)}
                            </span>
                        </li>
                    )}
                    {cell.checkOut && (
                        <li className="flex min-h-[72px] items-center gap-3.5 px-5 py-3 md:px-6">
                            <span
                                aria-hidden
                                className="flex size-11 shrink-0 items-center justify-center rounded-control bg-surface-2 text-text-muted"
                            >
                                <LogOut className="size-5" strokeWidth={1.75} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[17px] leading-6 font-semibold text-text">
                                    Pulang
                                    {cell.workMinutes > 0 && (
                                        <span className="font-normal text-text-muted">
                                            {' '}
                                            · durasi{' '}
                                            {formatDuration(cell.workMinutes)}
                                        </span>
                                    )}
                                </p>
                                <p className="truncate text-[15px] leading-[22px] text-text-muted">
                                    {place(cell.checkOut)}
                                </p>
                            </div>
                            <span className="text-[20px] font-bold text-text tnum">
                                {formatTime(cell.checkOut.occurredAt)}
                            </span>
                        </li>
                    )}
                    {cell.overtimeMinutes > 0 && (
                        <li className="px-5 py-3 text-meta text-text-muted md:px-6">
                            Lembur disetujui{' '}
                            {formatDuration(cell.overtimeMinutes)}
                        </li>
                    )}
                </ul>
            ) : (
                <p className="px-5 py-5 text-[16px] text-text-muted md:px-6">
                    {cell.kind === 'off' || cell.kind === 'holiday'
                        ? 'Tidak ada jadwal kerja pada tanggal ini.'
                        : cell.kind === 'upcoming'
                          ? 'Belum berlangsung.'
                          : status &&
                              [
                                  'leave',
                                  'permit',
                                  'sick',
                                  'business_trip',
                              ].includes(status)
                            ? 'Tercatat dari pengajuan yang disetujui.'
                            : 'Tidak ada check-in pada tanggal ini.'}
                </p>
            )}
        </section>
    );
}
