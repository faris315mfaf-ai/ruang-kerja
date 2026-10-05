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
import { formatDurationShort, shortDay } from '@/lib/attendance';
import { formatTime } from '@/lib/format';
import { formatDistance } from '@/lib/geo';
import type { AttendanceDayData } from '@/types/attendance';
import { StatusBadge, badgeMinutes } from './status-badge';

type Props = {
    history: AttendanceDayData[] | undefined;
    /** Rows shown (DAbsensi "Riwayat 7 hari kerja"). */
    limit?: number;
    /** Office work date of today: an open day there reads "berjalan". */
    today?: string;
};

/** "Sen, 5 Okt" (DAbsensi table). */
export function dayLabel(workDate: string): string {
    const [year, month, day] = workDate.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const weekday = shortDay(workDate).split(' ')[0];
    const monthName = new Intl.DateTimeFormat('id-ID', {
        month: 'short',
        timeZone: 'UTC',
    }).format(date);

    return `${weekday}, ${day} ${monthName.replace('.', '')}`;
}

function duration(day: AttendanceDayData, workDate: string): string {
    if (day.checkOutAt) {
        return formatDurationShort(day.workMinutes);
    }

    return day.checkInAt && day.workDate === workDate ? 'berjalan' : '–';
}

/** "GPS + selfie", "QR kiosk", "Pengajuan" (DAbsensi "Metode"). */
export function methodText(day: AttendanceDayData): string {
    if (day.checkIn) {
        return day.checkIn.methodLabel;
    }

    return day.requestPortion ? 'Pengajuan' : '–';
}

/** "Kantor Pusat · 38 m" or "WFH/lapangan". */
export function placeText(day: AttendanceDayData): string {
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
            size="sm"
            icon={CalendarDays}
            title="Belum ada riwayat absensi"
            description="Riwayat muncul di sini setelah Anda check-in."
        />
    );
}

function shown(history: AttendanceDayData[], limit?: number) {
    const days = history.filter((day) => day.status !== 'holiday');

    return limit ? days.slice(0, limit) : days;
}

/** Recent days as list rows (MSRiwayat style, phone). */
export function HistoryList({ history, limit, today = '' }: Props) {
    if (history === undefined) {
        return (
            <div className="space-y-2 px-5 py-2" aria-busy>
                {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-14" />
                ))}
            </div>
        );
    }

    const days = shown(history, limit);

    if (days.length === 0) {
        return (
            <div className="px-5 pb-2">
                <Empty />
            </div>
        );
    }

    return (
        <ul className="divide-y divide-divider">
            {days.map((day) => (
                <li
                    key={day.id}
                    className="flex min-h-[64px] items-center gap-3 px-5 py-2.5"
                >
                    <div className="min-w-0 flex-1">
                        <p className="text-[17px] leading-6 font-semibold text-text">
                            {dayLabel(day.workDate)}
                        </p>
                        <p className="truncate text-meta text-text-muted">
                            <span className="tnum">
                                {day.checkInAt
                                    ? `${formatTime(day.checkInAt)}–${day.checkOutAt ? formatTime(day.checkOutAt) : '…'}`
                                    : '–'}
                            </span>
                            {[duration(day, today), methodText(day)]
                                .filter((part) => part !== '–')
                                .map((part) => ` · ${part}`)
                                .join('')}
                        </p>
                    </div>
                    <StatusBadge
                        status={day.status}
                        minutes={badgeMinutes(day)}
                        compact
                    />
                </li>
            ))}
        </ul>
    );
}

/** History table (DAbsensi "Riwayat 7 hari kerja"). */
export function HistoryTable({ history, limit, today = '' }: Props) {
    if (history === undefined) {
        return (
            <div className="space-y-2 px-7 py-3" aria-busy>
                {Array.from({ length: 5 }, (_, index) => (
                    <Skeleton key={index} className="h-11" />
                ))}
            </div>
        );
    }

    const days = shown(history, limit);

    if (days.length === 0) {
        return (
            <div className="px-7 pb-4">
                <Empty />
            </div>
        );
    }

    return (
        <Table className="min-w-[760px] text-[16px]">
            <TableHeader>
                <TableRow>
                    <TableHead className="pl-7">Tanggal</TableHead>
                    <TableHead>Masuk</TableHead>
                    <TableHead>Pulang</TableHead>
                    <TableHead>Durasi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-7">Metode</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {days.map((day) => (
                    <TableRow key={day.id} className="h-[60px]">
                        <TableCell className="pl-7 font-semibold text-text">
                            {dayLabel(day.workDate)}
                        </TableCell>
                        <TableCell className="text-text">
                            {day.checkInAt ? formatTime(day.checkInAt) : '–'}
                        </TableCell>
                        <TableCell className="text-text">
                            {day.checkOutAt ? formatTime(day.checkOutAt) : '–'}
                        </TableCell>
                        <TableCell className="text-text-muted">
                            {duration(day, today)}
                        </TableCell>
                        <TableCell>
                            <StatusBadge
                                status={day.status}
                                minutes={badgeMinutes(day)}
                            />
                        </TableCell>
                        <TableCell
                            className="pr-7 text-text-muted"
                            title={placeText(day) || undefined}
                        >
                            {methodText(day)}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
