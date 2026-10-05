import { FileText, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatHours, lateSummary } from '@/lib/recap';
import { cn } from '@/lib/utils';
import type { RecapDayCell, RecapDetail } from '@/types/attendance';
import { ReviewButton } from '../review/review-button';
import { SelfieButton } from '../review/selfie-dialog';
import { formatDate, formatNumber, formatTime } from '@/lib/format';
import { LogsDialog } from './logs-dialog';
import { CalendarLegend, MonthCalendar } from './month-calendar';

type Props = {
    detail: RecapDetail;
    monthLabel: string;
    reload: string[];
    selected?: string | null;
    onSelectDay?: (cell: RecapDayCell) => void;
    onClose?: () => void;
    /** Shown for HR (not for the own attendance). */
    onCorrect?: () => void;
    className?: string;
};

/** Detail panel of one employee's month (mockup RekapAbsensi, right side). */
export function EmployeeMonthPanel({
    detail,
    monthLabel,
    reload,
    selected,
    onSelectDay,
    onClose,
    onCorrect,
    className,
}: Props) {
    const [logsOpen, setLogsOpen] = useState(false);
    const flagged = detail.logs.filter(
        (log) => log.flags.length > 0 && log.isSuspicious,
    );
    const stats = [
        {
            label: 'Hadir',
            value: (
                <>
                    {formatNumber(detail.presentDays)}
                    <span className="text-[15px] font-normal text-text-muted">
                        /{detail.workDays}
                    </span>
                </>
            ),
        },
        {
            label: 'Terlambat',
            value: (
                <span className={cn(detail.lateCount > 0 && 'text-warning')}>
                    {lateSummary(detail.lateCount, detail.lateMinutes)}
                </span>
            ),
        },
        {
            label: 'Rata masuk',
            value: <span>{detail.averageCheckIn ?? '–'}</span>,
        },
        {
            label: 'Lembur',
            value: (
                <>
                    {formatHours(detail.overtimeHours)}{' '}
                    <span className="text-[15px] font-normal text-text-muted">
                        jam
                    </span>
                </>
            ),
        },
    ];

    return (
        <section
            aria-label={`Rekap ${detail.name}`}
            className={cn(
                'flex flex-col gap-5 rounded-panel border border-border bg-surface p-5 shadow-card md:p-6',
                className,
            )}
        >
            <header className="flex items-start gap-3">
                <UserAvatar
                    name={detail.name}
                    className="size-12 text-[16px]"
                />
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-title font-bold text-text">
                        {detail.name} · {monthLabel.split(' ')[0]}
                    </h2>
                    <p className="truncate text-[15px] text-text-muted">
                        {[
                            detail.positionName,
                            detail.shiftName
                                ? `Shift ${detail.shiftName}`
                                : null,
                        ]
                            .filter(Boolean)
                            .join(' · ') || detail.divisionName}
                    </p>
                </div>
                {onClose && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        aria-label="Tutup detail"
                    >
                        <X aria-hidden />
                    </Button>
                )}
            </header>

            <dl className="grid grid-cols-2 gap-2">
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className="rounded-lg bg-background px-3 py-2.5"
                    >
                        <dt className="text-meta text-text-muted">
                            {stat.label}
                        </dt>
                        <dd className="mt-0.5 text-[20px] leading-7 font-bold text-text tnum">
                            {stat.value}
                        </dd>
                    </div>
                ))}
            </dl>

            <MonthCalendar
                dense
                days={detail.days}
                selected={selected}
                onSelect={onSelectDay}
            />
            <CalendarLegend row={detail} />

            <div className="flex flex-col gap-2.5 border-t border-divider pt-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-title font-bold text-text">
                        Log mencurigakan
                    </h3>
                    <Badge variant="secondary" className="h-7 tnum">
                        {flagged.length}
                    </Badge>
                </div>
                {flagged.length === 0 ? (
                    <p className="flex gap-2 rounded-lg bg-success-soft p-3.5 text-[15px] leading-[22px] text-success">
                        <ShieldCheck
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden
                        />
                        Tidak ada temuan. Diperiksa: akurasi GPS, perangkat & IP
                        baru, jam perangkat, lompatan lokasi, selfie gelap.
                    </p>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {flagged.slice(0, 4).map((log) => (
                            <li
                                key={log.id}
                                className="flex flex-col gap-2 rounded-lg bg-background p-3.5 text-[15px]"
                            >
                                <p className="text-text">
                                    {formatDate(log.occurredAt)} ·{' '}
                                    <span className="font-semibold">
                                        {formatTime(log.occurredAt)}
                                    </span>{' '}
                                    <span className="text-text-muted">
                                        {log.typeLabel.toLowerCase()}
                                    </span>
                                </p>
                                <p className="flex flex-wrap gap-1.5">
                                    {log.flags.map((flag) => (
                                        <Badge
                                            key={flag.value}
                                            variant="status"
                                            tone="warning"
                                            className="h-7 px-2.5 text-[14px]"
                                        >
                                            {flag.label}
                                        </Badge>
                                    ))}
                                    {log.reviewedAt && (
                                        <span className="text-meta font-semibold text-success">
                                            Sudah ditinjau
                                        </span>
                                    )}
                                </p>
                                {(log.canViewSelfie || log.canReview) && (
                                    <div className="flex flex-wrap gap-2">
                                        {log.canViewSelfie && (
                                            <SelfieButton
                                                logId={log.id}
                                                name={detail.name}
                                                occurredAt={log.occurredAt}
                                            />
                                        )}
                                        {log.canReview && (
                                            <ReviewButton
                                                logId={log.id}
                                                only={reload}
                                            />
                                        )}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-divider pt-4">
                <Button
                    type="button"
                    variant="quiet"
                    size="sm"
                    onClick={() => setLogsOpen(true)}
                >
                    Lihat {detail.logs.length} log absensi
                </Button>
                {onCorrect && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onCorrect}
                    >
                        <FileText aria-hidden />
                        Koreksi absensi
                    </Button>
                )}
            </div>
            <LogsDialog
                open={logsOpen}
                onOpenChange={setLogsOpen}
                name={detail.name}
                logs={detail.logs}
                reload={reload}
            />
        </section>
    );
}
