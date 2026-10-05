import { LogIn, LogOut } from 'lucide-react';
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
    const tone = status
        ? TONE_CLASSES[statusTone(status)]
        : TONE_CLASSES.neutral;
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
                'overflow-hidden rounded-xl border border-border bg-surface shadow-card',
                className,
            )}
        >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <h3 className="text-[17px] font-semibold text-text">
                    {formatDate(cell.date)}
                </h3>
                <span
                    className={cn(
                        'inline-flex h-7 items-center rounded-full px-3 text-[13px] font-medium',
                        tone.soft,
                    )}
                >
                    {badge}
                </span>
            </div>
            {cell.checkIn || cell.checkOut ? (
                <ul className="divide-y divide-border">
                    {cell.checkIn && (
                        <li className="flex items-center gap-3 px-4 py-3">
                            <span
                                aria-hidden
                                className={cn(
                                    'flex size-11 shrink-0 items-center justify-center rounded-full',
                                    cell.lateMinutes > 0
                                        ? TONE_CLASSES.warning.soft
                                        : 'bg-surface-2 text-text-muted',
                                )}
                            >
                                <LogIn className="size-5" strokeWidth={1.75} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[15px] text-text">
                                    Masuk
                                    {cell.lateMinutes > 0 && (
                                        <span className="text-warning">
                                            {' '}
                                            · terlambat {cell.lateMinutes} m
                                        </span>
                                    )}
                                </p>
                                <p className="truncate text-[13px] text-text-muted">
                                    {place(cell.checkIn)}
                                </p>
                            </div>
                            <span className="font-mono text-[17px] text-text tnum">
                                {formatTime(cell.checkIn.occurredAt)}
                            </span>
                        </li>
                    )}
                    {cell.checkOut && (
                        <li className="flex items-center gap-3 px-4 py-3">
                            <span
                                aria-hidden
                                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-muted"
                            >
                                <LogOut className="size-5" strokeWidth={1.75} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-[15px] text-text">
                                    Pulang
                                    {cell.workMinutes > 0 && (
                                        <span className="text-text-muted">
                                            {' '}
                                            · durasi{' '}
                                            {formatDuration(cell.workMinutes)}
                                        </span>
                                    )}
                                </p>
                                <p className="truncate text-[13px] text-text-muted">
                                    {place(cell.checkOut)}
                                </p>
                            </div>
                            <span className="font-mono text-[17px] text-text tnum">
                                {formatTime(cell.checkOut.occurredAt)}
                            </span>
                        </li>
                    )}
                    {cell.overtimeMinutes > 0 && (
                        <li className="px-4 py-3 text-[13px] text-text-muted">
                            Lembur disetujui{' '}
                            {formatDuration(cell.overtimeMinutes)}
                        </li>
                    )}
                </ul>
            ) : (
                <p className="px-4 py-5 text-[15px] text-text-muted">
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
