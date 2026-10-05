import { FileText, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
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
                    <span className="text-sm font-normal text-text-muted">
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
            value: (
                <span className="font-mono">
                    {detail.averageCheckIn ?? '–'}
                </span>
            ),
        },
        {
            label: 'Lembur',
            value: (
                <>
                    {formatHours(detail.overtimeHours)}{' '}
                    <span className="text-sm font-normal text-text-muted">
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
                'space-y-4 rounded-xl border border-border bg-surface p-4 shadow-card',
                className,
            )}
        >
            <header className="flex items-start gap-3">
                <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-on-brand"
                >
                    {detail.initials}
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[17px] font-semibold text-text">
                        {detail.name} · {monthLabel.split(' ')[0]}
                    </h2>
                    <p className="truncate text-[13px] text-text-muted">
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

            <dl className="grid grid-cols-4 gap-2">
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className="rounded-lg bg-surface-2 px-2.5 py-2"
                    >
                        <dt className="text-xs text-text-muted">
                            {stat.label}
                        </dt>
                        <dd className="mt-0.5 text-[17px] font-semibold text-text tnum">
                            {stat.value}
                        </dd>
                    </div>
                ))}
            </dl>

            <MonthCalendar
                days={detail.days}
                selected={selected}
                onSelect={onSelectDay}
            />
            <CalendarLegend row={detail} />

            <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-[15px] font-semibold text-text">
                        Log mencurigakan
                    </h3>
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-surface-2 px-2 text-xs font-semibold text-text-muted tnum">
                        {flagged.length}
                    </span>
                </div>
                {flagged.length === 0 ? (
                    <p className="flex gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
                        <ShieldCheck
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden
                        />
                        Tidak ada temuan. Diperiksa: akurasi GPS, perangkat & IP
                        baru, jam perangkat, lompatan lokasi, selfie gelap.
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {flagged.slice(0, 4).map((log) => (
                            <li
                                key={log.id}
                                className="space-y-1.5 rounded-lg border border-border p-2.5 text-sm"
                            >
                                <p className="text-text">
                                    {formatDate(log.occurredAt)} ·{' '}
                                    <span className="font-mono">
                                        {formatTime(log.occurredAt)}
                                    </span>{' '}
                                    <span className="text-text-muted">
                                        {log.typeLabel.toLowerCase()}
                                    </span>
                                </p>
                                <p className="flex flex-wrap gap-1.5">
                                    {log.flags.map((flag) => (
                                        <span
                                            key={flag.value}
                                            className="inline-flex h-5 items-center rounded-full bg-warning/12 px-2 text-xs text-warning"
                                        >
                                            {flag.label}
                                        </span>
                                    ))}
                                    {log.reviewedAt && (
                                        <span className="text-xs text-success">
                                            Sudah ditinjau
                                        </span>
                                    )}
                                </p>
                                {(log.canViewSelfie || log.canReview) && (
                                    <div className="flex gap-2">
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

            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <button
                    type="button"
                    onClick={() => setLogsOpen(true)}
                    className="text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                    Lihat {detail.logs.length} log absensi
                </button>
                {onCorrect && (
                    <Button
                        type="button"
                        variant="outline"
                        className="h-9"
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
