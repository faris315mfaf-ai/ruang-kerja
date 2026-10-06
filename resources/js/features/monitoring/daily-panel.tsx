import { ChevronLeft, ChevronRight, ClipboardList, Clock } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatTime } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { percentOf, shiftDate } from './lib';
import { BlockerNote } from './report-detail';
import type { DailyMonitoring, MonitoredReport } from './types';

const REPORTS_SHOWN = 6;

/** ← date → (no future dates). */
export function DateStepper({
    date,
    today,
    onChange,
    loading,
}: {
    date: string;
    today: string;
    onChange: (date: string) => void;
    loading: boolean;
}) {
    return (
        <div className="flex items-center gap-1.5" aria-busy={loading}>
            <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => onChange(shiftDate(date, -1))}
                aria-label="Hari sebelumnya"
            >
                <ChevronLeft aria-hidden />
            </Button>
            <label className="sr-only" htmlFor="monitoring-date">
                Tanggal laporan
            </label>
            <Input
                id="monitoring-date"
                type="date"
                value={date}
                max={today}
                onChange={(event) => {
                    if (event.target.value !== '') {
                        onChange(event.target.value);
                    }
                }}
                className="h-control-sm w-40"
            />
            <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={date >= today}
                onClick={() => onChange(shiftDate(date, 1))}
                aria-label="Hari berikutnya"
            >
                <ChevronRight aria-hidden />
            </Button>
        </div>
    );
}

function Stat({
    label,
    value,
    tone,
}: {
    label: string;
    value: number;
    tone?: 'success' | 'warning' | 'danger';
}) {
    return (
        <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-surface-2/70 px-4 py-3">
            <span className="text-meta text-text-muted">{label}</span>
            <span
                className={cn(
                    'text-[28px] leading-9 font-bold tnum',
                    tone === 'success' && 'text-success',
                    tone === 'warning' && 'text-warning',
                    tone === 'danger' && value > 0 && 'text-danger',
                )}
            >
                {value}
            </span>
        </div>
    );
}

/** One sent report as a card (opens the detail). */
export function ReportCard({
    report,
    onOpen,
}: {
    report: MonitoredReport;
    onOpen: () => void;
}) {
    const shown = report.items.slice(0, 3);

    return (
        <li className="border-t border-divider first:border-t-0">
            <button
                type="button"
                onClick={onOpen}
                className={cn(
                    'flex w-full flex-col gap-2 rounded-lg py-3.5 text-left transition-colors duration-120 ease-brand hover:bg-surface-2/50',
                    focusRing,
                )}
                aria-label={`Buka laporan ${report.user.name}`}
            >
                <span className="flex items-center gap-3">
                    <UserAvatar
                        name={report.user.name}
                        src={report.user.avatar}
                        className="size-9 text-[13px]"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[16px] font-semibold">
                            {report.user.name}
                        </span>
                        <span className="truncate text-meta text-text-muted">
                            {report.user.division ?? 'Tanpa divisi'}
                        </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-meta text-text-muted tnum">
                        <Clock className="size-3.5" aria-hidden />
                        {formatTime(report.submitted_at)}
                    </span>
                </span>
                {report.summary && (
                    <span className="line-clamp-2 text-[15px] leading-6 text-text">
                        {report.summary}
                    </span>
                )}
                {shown.length > 0 && (
                    <span className="flex flex-wrap gap-1.5">
                        {shown.map((item) => (
                            <span
                                key={item.id}
                                className="inline-flex max-w-full items-center gap-1.5 rounded-sm bg-surface-2 px-2 py-1 text-[14px]"
                            >
                                {item.key && (
                                    <span className="font-mono font-semibold text-text-muted">
                                        {item.key}
                                    </span>
                                )}
                                <span className="truncate">
                                    {item.title ??
                                        (item.key ? 'Tugas' : 'Di luar tugas')}
                                </span>
                                {item.percent !== null && (
                                    <span className="font-bold text-info tnum">
                                        {item.percent}%
                                    </span>
                                )}
                            </span>
                        ))}
                        {report.items_count > shown.length && (
                            <span className="inline-flex items-center px-1 text-meta text-text-muted">
                                +{report.items_count - shown.length} lagi
                            </span>
                        )}
                    </span>
                )}
                {report.blockers && <BlockerNote text={report.blockers} />}
            </button>
        </li>
    );
}

/**
 * Monitoring kerja harian (keputusan pemilik 6 Okt 2026): who reported on a
 * date per division, who has not, and the latest reports (blockers stand
 * out). Reports open in a detail sheet.
 */
export function DailyPanel({
    daily,
    date,
    today,
    loading,
    onDateChange,
    onOpenReport,
    compact = false,
    className,
}: {
    daily?: DailyMonitoring;
    date: string;
    today: string;
    loading: boolean;
    onDateChange: (date: string) => void;
    onOpenReport: (report: MonitoredReport) => void;
    compact?: boolean;
    className?: string;
}) {
    const [all, setAll] = useState(false);
    const reports = daily
        ? all
            ? daily.reports
            : daily.reports.slice(0, REPORTS_SHOWN)
        : [];

    return (
        <Panel
            title={compact ? 'Laporan harian' : 'Monitoring kerja harian'}
            action={
                compact ? undefined : (
                    <DateStepper
                        date={date}
                        today={today}
                        onChange={onDateChange}
                        loading={loading}
                    />
                )
            }
            className={cn(compact && 'py-5', className)}
            bodyClassName="gap-5"
        >
            {compact && (
                <DateStepper
                    date={date}
                    today={today}
                    onChange={onDateChange}
                    loading={loading}
                />
            )}
            {!daily ? (
                <div className="flex flex-col gap-3" aria-busy>
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            ) : (
                <div
                    className={cn(
                        'flex flex-col gap-5 transition-opacity duration-120 ease-brand',
                        loading && 'opacity-60',
                    )}
                >
                    <p className="text-meta text-text-muted">
                        {daily.is_today ? 'Hari ini · ' : ''}
                        {formatDate(daily.date)} · {daily.totals.people}{' '}
                        karyawan aktif
                    </p>
                    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                        <Stat
                            label="Terjadwal"
                            value={daily.totals.scheduled}
                        />
                        <Stat
                            label="Sudah lapor"
                            value={daily.totals.reported}
                            tone="success"
                        />
                        <Stat
                            label="Draf"
                            value={daily.totals.draft}
                            tone="warning"
                        />
                        <Stat
                            label="Belum lapor"
                            value={daily.totals.missing}
                            tone="danger"
                        />
                    </div>

                    {daily.divisions.length > 0 && (
                        <section
                            aria-label="Per divisi"
                            className="flex flex-col gap-3"
                        >
                            <h3 className="text-label">Per divisi</h3>
                            <ul className="flex flex-col gap-3">
                                {daily.divisions.map((division) => (
                                    <li
                                        key={division.id ?? 'none'}
                                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 md:grid-cols-[minmax(0,180px)_1fr_auto]"
                                    >
                                        <span className="truncate text-[16px] font-medium">
                                            {division.name}
                                        </span>
                                        <Progress
                                            value={percentOf(
                                                division.reported,
                                                Math.max(
                                                    division.scheduled,
                                                    division.reported,
                                                ),
                                            )}
                                            label={`${division.name}: ${division.reported} dari ${division.scheduled} terjadwal sudah lapor`}
                                            className="col-span-2 row-start-2 md:col-span-1 md:col-start-2 md:row-start-1"
                                        />
                                        <span className="text-right text-meta text-text-muted tnum">
                                            <span className="font-bold text-text">
                                                {division.reported}
                                            </span>
                                            /{division.scheduled} lapor
                                            {division.draft > 0 &&
                                                ` · ${division.draft} draf`}
                                            {division.missing > 0 && (
                                                <span className="text-danger">
                                                    {' '}
                                                    · {division.missing} belum
                                                </span>
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {daily.missing.length > 0 && (
                        <section
                            aria-label="Belum lapor"
                            className="flex flex-col gap-2"
                        >
                            <h3 className="text-label">
                                Belum lapor ({daily.missing.length})
                            </h3>
                            <ul className="flex flex-wrap gap-1.5">
                                {daily.missing.map((person) => (
                                    <li
                                        key={person.id}
                                        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 pr-3 pl-1 text-[14px]"
                                        title={person.division ?? undefined}
                                    >
                                        <UserAvatar
                                            name={person.name}
                                            src={person.avatar}
                                            className="size-6 text-[10px]"
                                        />
                                        {person.name}
                                        {person.draft && (
                                            <Badge
                                                variant="status"
                                                tone="warning"
                                                className="h-5 px-1.5 text-[12px]"
                                            >
                                                Draf
                                            </Badge>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <section
                        aria-label="Laporan terbaru"
                        className="flex flex-col gap-1"
                    >
                        <h3 className="text-label">
                            Laporan terbaru ({daily.reports.length})
                        </h3>
                        {daily.reports.length === 0 ? (
                            <EmptyState
                                size="sm"
                                icon={ClipboardList}
                                title="Belum ada laporan"
                            >
                                Laporan progres yang dikirim karyawan pada
                                tanggal ini tampil di sini.
                            </EmptyState>
                        ) : (
                            <>
                                <ul className="flex flex-col">
                                    {reports.map((report) => (
                                        <ReportCard
                                            key={report.id}
                                            report={report}
                                            onOpen={() => onOpenReport(report)}
                                        />
                                    ))}
                                </ul>
                                {daily.reports.length > REPORTS_SHOWN && (
                                    <Button
                                        type="button"
                                        variant="quiet"
                                        className="self-start"
                                        aria-expanded={all}
                                        onClick={() =>
                                            setAll((value) => !value)
                                        }
                                    >
                                        {all
                                            ? 'Tampilkan lebih sedikit'
                                            : `Lihat semua ${daily.reports.length} laporan`}
                                    </Button>
                                )}
                            </>
                        )}
                    </section>
                </div>
            )}
        </Panel>
    );
}
