import { Eye, MapPin, PencilLine } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import {
    CorrectionDialog,
    type CorrectionTarget,
} from '@/features/attendance/review/correction-dialog';
import { ReviewButton } from '@/features/attendance/review/review-button';
import { formatRelative, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    DivisionAttendanceRow,
    HrToday,
    MissingCheckOut,
    ReviewItem,
} from '@/types/dashboard';
import { STATE_META } from './attendance-today';
import { awayBreakdown, share } from './lib';
import { PanelEmpty } from './panel';
import { StatCard } from './stat-card';

/** Today KPIs (mockups DashboardHR / MDashboardHR). */
export function HrTodayKpis({
    attendance,
    compact = false,
}: {
    attendance: HrToday;
    compact?: boolean;
}) {
    const { counts } = attendance;

    return (
        <>
            <StatCard
                compact={compact}
                label="Terjadwal"
                definition="Karyawan aktif dengan jadwal kerja hari ini (atau yang sudah check-in)."
                value={String(counts.scheduled)}
                caption={
                    attendance.shifts
                        .map((shift) => `${shift.count} ${shift.name}`)
                        .join(' · ') || 'tidak ada jadwal'
                }
            />
            <StatCard
                compact={compact}
                label="Hadir"
                definition="Sudah check-in hari ini, termasuk yang terlambat."
                value={String(counts.present)}
                suffix={`/ ${counts.scheduled}`}
                valueTone="success"
                caption={
                    <>
                        termasuk{' '}
                        <span className="text-warning">
                            {counts.late} terlambat
                        </span>
                    </>
                }
            />
            <StatCard
                compact={compact}
                label="Cuti/izin/sakit"
                definition="Tidak masuk karena pengajuan yang disetujui (cuti, izin, sakit, dinas)."
                value={String(counts.away)}
                valueTone="info"
                caption={awayBreakdown(counts)}
            />
            <StatCard
                compact={compact}
                label="Belum check-in"
                definition="Terjadwal hari ini tetapi belum check-in. Pengingat otomatis dikirim 15 menit setelah jam masuk."
                value={String(counts.not_checked_in)}
                caption={
                    counts.absent > 0
                        ? `${counts.absent} alpha`
                        : 'pengingat otomatis 15 menit setelah jam masuk'
                }
            />
        </>
    );
}

const SEGMENTS = [
    { key: 'on_time', state: 'present' },
    { key: 'late', state: 'late' },
    { key: 'away', state: 'away' },
    { key: 'not_checked_in', state: 'not_checked_in' },
    { key: 'absent', state: 'absent' },
] as const;

function segmentValues(row: DivisionAttendanceRow) {
    return {
        on_time: row.present - row.late,
        late: row.late,
        away: row.away,
        not_checked_in: row.not_checked_in,
        absent: row.absent,
    };
}

/** Stacked distribution bar with 2px surface gaps between segments. */
export function DistributionBar({
    row,
    className,
}: {
    row: DivisionAttendanceRow;
    className?: string;
}) {
    const values = segmentValues(row);

    return (
        <span
            className={cn(
                'flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-2',
                className,
            )}
            aria-hidden
        >
            {SEGMENTS.filter(({ key }) => values[key] > 0).map(
                ({ key, state }) => (
                    <span
                        key={key}
                        className={cn('h-full', STATE_META[state].dot)}
                        style={{
                            width: `${share(values[key], row.scheduled)}%`,
                        }}
                    />
                ),
            )}
        </span>
    );
}

export function totalRow(rows: DivisionAttendanceRow[]): DivisionAttendanceRow {
    return rows.reduce<DivisionAttendanceRow>(
        (total, row) => ({
            ...total,
            scheduled: total.scheduled + row.scheduled,
            present: total.present + row.present,
            late: total.late + row.late,
            away: total.away + row.away,
            not_checked_in: total.not_checked_in + row.not_checked_in,
            absent: total.absent + row.absent,
        }),
        {
            id: null,
            name: 'Total',
            scheduled: 0,
            present: 0,
            late: 0,
            away: 0,
            not_checked_in: 0,
            absent: 0,
        },
    );
}

export function DistributionLegend({ className }: { className?: string }) {
    return (
        <ul
            className={cn(
                'flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted',
                className,
            )}
        >
            {[
                ['bg-success', 'Hadir tepat waktu'],
                ['bg-warning', 'Terlambat'],
                ['bg-info', 'Cuti/izin/sakit'],
                ['bg-border-strong', 'Belum check-in'],
            ].map(([dot, label]) => (
                <li key={label} className="inline-flex items-center gap-1.5">
                    <span
                        className={cn('size-2 rounded-sm', dot)}
                        aria-hidden
                    />
                    {label}
                </li>
            ))}
        </ul>
    );
}

/** "Perlu ditinjau": unreviewed suspicious check-ins with their flags. */
export function ReviewList({ items }: { items: ReviewItem[] }) {
    if (items.length === 0) {
        return <PanelEmpty>Tidak ada absensi tidak biasa.</PanelEmpty>;
    }

    return (
        <ul className="divide-y divide-border">
            {items.map((item) => (
                <li key={item.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                        <UserAvatar
                            name={item.user.name}
                            src={item.user.avatar}
                            className="size-8"
                        />
                        <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                                <span className="font-medium text-text">
                                    {item.user.name}
                                </span>
                                <span className="font-mono text-[13px] text-text-muted tnum">
                                    {formatTime(item.occurred_at)}
                                </span>
                            </p>
                            <p className="mt-0.5 flex items-center gap-1 text-[13px] text-text-muted">
                                <MapPin className="size-3.5" aria-hidden />
                                {[
                                    item.location ?? item.method_label,
                                    item.type === 'check_in'
                                        ? 'check-in'
                                        : 'check-out',
                                    formatRelative(item.occurred_at),
                                ].join(' · ')}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {item.flags.map((flag) => (
                                    <span
                                        key={flag.key}
                                        className="inline-flex h-6 items-center rounded-full bg-warning/12 px-2 text-xs font-medium text-warning"
                                    >
                                        {flag.label}
                                        {flag.key === 'low_accuracy' &&
                                            item.accuracy_m !== null &&
                                            ` ${Math.round(item.accuracy_m)} m`}
                                    </span>
                                ))}
                                <span className="ml-auto flex flex-wrap items-center gap-1.5">
                                    {item.selfie_url && (
                                        <a
                                            href={item.selfie_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-[13px] text-text hover:bg-surface-2 max-md:h-11"
                                        >
                                            <Eye
                                                className="size-4"
                                                aria-hidden
                                            />
                                            Lihat selfie
                                        </a>
                                    )}
                                    {item.can_review && (
                                        <ReviewButton
                                            logId={item.id}
                                            only={['review', 'attendance']}
                                            className="h-9 max-md:h-11"
                                        />
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    );
}

/** "Lupa check-out kemarin". */
/** Office time "HH:MM" of an ISO instant (prefills the correction form). */
function officeHourMinute(iso: string | null): string | null {
    return iso === null ? null : formatTime(iso).replace('.', ':');
}

export function MissingCheckOutList({ data }: { data: MissingCheckOut }) {
    const [target, setTarget] = useState<CorrectionTarget | null>(null);

    if (data.items.length === 0) {
        return <PanelEmpty>Semua sudah check-out kemarin.</PanelEmpty>;
    }

    return (
        <>
            <ul className="divide-y divide-border">
                {data.items.map((item) => (
                    <li
                        key={item.id}
                        className="flex min-h-14 items-center gap-3 px-4 py-2"
                    >
                        <UserAvatar
                            name={item.user.name}
                            src={item.user.avatar}
                            className="size-8"
                        />
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-text">
                                {item.user.name}
                            </span>
                            <span className="block text-[13px] text-text-muted">
                                {item.shift ?? 'Tanpa shift'} · masuk{' '}
                                <span className="font-mono tnum">
                                    {formatTime(item.check_in_at)}
                                </span>{' '}
                                · keluar –
                            </span>
                        </span>
                        {item.can_correct && (
                            <Button
                                type="button"
                                variant="outline"
                                className="h-9 max-md:h-11"
                                aria-label={`Koreksi absensi ${item.user.name}`}
                                onClick={() =>
                                    setTarget({
                                        userId: item.user.id,
                                        name: item.user.name,
                                        workDate: data.date,
                                        checkIn: officeHourMinute(
                                            item.check_in_at,
                                        ),
                                    })
                                }
                            >
                                <PencilLine aria-hidden />
                                Koreksi
                            </Button>
                        )}
                    </li>
                ))}
            </ul>
            {target !== null && (
                <CorrectionDialog
                    key={target.userId}
                    target={target}
                    today={data.date}
                    reload={['missingCheckOut', 'attendance']}
                    onClose={() => setTarget(null)}
                />
            )}
        </>
    );
}
