import { CalendarDays } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatDuration } from '@/lib/attendance';
import { formatDate, formatTime } from '@/lib/format';
import { formatDistance } from '@/lib/geo';
import type { AttendanceDayData } from '@/types/attendance';
import { StatusBadge, badgeMinutes } from './status-badge';

type Props = { history: AttendanceDayData[] | undefined };

function dateOnly(workDate: string): string {
    // Work dates are office-local calendar dates: format at local noon to stay on the day.
    return formatDate(`${workDate}T05:00:00Z`);
}

function times(day: AttendanceDayData): string {
    if (!day.checkInAt) {
        return '–';
    }

    return `${formatTime(day.checkInAt)} – ${day.checkOutAt ? formatTime(day.checkOutAt) : '…'}`;
}

function place(day: AttendanceDayData): string {
    const log = day.checkIn;

    if (!log) {
        return '';
    }

    if (log.method === 'wfh') {
        return 'WFH/lapangan';
    }

    return log.locationName
        ? `${log.locationName}${log.distanceM !== null ? ` · ${formatDistance(log.distanceM)}` : ''}`
        : log.methodLabel;
}

function Empty() {
    return (
        <EmptyState
            icon={CalendarDays}
            title="Belum ada riwayat absensi"
            description="Riwayat 30 hari terakhir muncul di sini setelah Anda check-in."
        />
    );
}

/** 30-day history as a list of 56px rows (mobile). */
export function HistoryList({ history }: Props) {
    if (history === undefined) {
        return (
            <div className="space-y-2" aria-busy>
                {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-14" />
                ))}
            </div>
        );
    }

    if (history.length === 0) {
        return <Empty />;
    }

    return (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {history.map((day) => (
                <li
                    key={day.id}
                    className="flex min-h-14 items-center gap-3 px-4 py-2.5"
                >
                    <div className="min-w-0 flex-1">
                        <p className="text-[15px] text-text">
                            {dateOnly(day.workDate)}
                        </p>
                        <p className="truncate text-[13px] text-text-muted">
                            <span className="font-mono">{times(day)}</span>
                            {place(day) && ` · ${place(day)}`}
                        </p>
                    </div>
                    <StatusBadge
                        status={day.status}
                        minutes={badgeMinutes(day)}
                    />
                </li>
            ))}
        </ul>
    );
}

/** 30-day history table (desktop). */
export function HistoryTable({ history }: Props) {
    if (history === undefined) {
        return (
            <div className="space-y-2 p-4" aria-busy>
                {Array.from({ length: 5 }, (_, index) => (
                    <Skeleton key={index} className="h-9" />
                ))}
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="p-4">
                <Empty />
            </div>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow className="bg-surface-2 hover:bg-surface-2">
                    <TableHead className="pl-4 text-[13px] text-text-muted">
                        Tanggal
                    </TableHead>
                    <TableHead className="text-[13px] text-text-muted">
                        Status
                    </TableHead>
                    <TableHead className="text-[13px] text-text-muted">
                        Masuk
                    </TableHead>
                    <TableHead className="text-[13px] text-text-muted">
                        Pulang
                    </TableHead>
                    <TableHead className="text-[13px] text-text-muted">
                        Durasi kerja
                    </TableHead>
                    <TableHead className="pr-4 text-[13px] text-text-muted">
                        Lokasi / metode
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {history.map((day) => (
                    <TableRow key={day.id}>
                        <TableCell className="pl-4 text-[13px] text-text">
                            {dateOnly(day.workDate)}
                        </TableCell>
                        <TableCell>
                            <StatusBadge
                                status={day.status}
                                minutes={badgeMinutes(day)}
                            />
                        </TableCell>
                        <TableCell className="font-mono text-[13px] text-text tnum">
                            {formatTime(day.checkInAt)}
                        </TableCell>
                        <TableCell className="font-mono text-[13px] text-text tnum">
                            {formatTime(day.checkOutAt)}
                        </TableCell>
                        <TableCell className="text-[13px] text-text-muted">
                            {day.checkOutAt
                                ? formatDuration(day.workMinutes)
                                : '–'}
                        </TableCell>
                        <TableCell className="pr-4 text-[13px] text-text-muted">
                            {place(day) || '–'}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
