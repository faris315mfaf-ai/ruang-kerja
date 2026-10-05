import { Head, Link, router } from '@inertiajs/react';
import { Download, FileText } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { DayDetail } from '@/features/attendance/recap/day-detail';
import { LogsDialog } from '@/features/attendance/recap/logs-dialog';
import {
    CalendarLegend,
    MonthCalendar,
    MonthNav,
} from '@/features/attendance/recap/month-calendar';
import { MonthNotes } from '@/features/attendance/recap/month-notes';
import { TodayBar } from '@/features/attendance/recap/today-bar';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatHours } from '@/lib/recap';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { history as historyRoute } from '@/routes/attendance';
import historyRoutes from '@/routes/attendance/history';
import type {
    RecapDayCell,
    RecapDetail,
    RecapPeriodData,
} from '@/types/attendance';

type Props = {
    period: RecapPeriodData;
    today: string;
    recap: RecapDetail;
};

const CORRECTION_HREF = '/pengajuan/baru?kategori=koreksi';
const PRIVACY_NOTE = 'Data ini hanya terlihat oleh Anda, atasan, dan HR.';

/** Default selected day: today in the running month, else the last day with a record. */
function initialDay(recap: RecapDetail, today: string): string | null {
    if (recap.days.some((cell) => cell.date === today)) {
        return today;
    }

    const recorded = [...recap.days]
        .reverse()
        .find((cell) => cell.dayId !== null);

    return recorded?.date ?? recap.days[0]?.date ?? null;
}

type Stat = { label: string; value: string; dot: string; text?: string };

/** Month counters (SAbsensi "Tepat waktu · Terlambat · WFH · Izin / cuti · Lembur"). */
function monthStats(recap: RecapDetail): Stat[] {
    return [
        {
            label: 'Tepat waktu',
            value: formatNumber(
                Math.max(0, recap.presentDays - recap.lateCount),
            ),
            dot: 'bg-success',
            text: 'text-success',
        },
        {
            label: 'Terlambat',
            value: formatNumber(recap.lateCount),
            dot: 'bg-fill-warning',
            text: 'text-warning',
        },
        {
            label: 'WFH',
            value: formatNumber(recap.wfhDays),
            dot: 'bg-fill-teal',
            text: 'text-link',
        },
        {
            label: 'Izin / cuti',
            value: formatNumber(
                recap.leaveDays +
                    recap.permitDays +
                    recap.sickDays +
                    recap.businessTripDays,
            ),
            dot: 'bg-accent-blue-strong',
            text: 'text-info',
        },
        {
            label: 'Lembur',
            value: `${formatHours(recap.overtimeHours)} jam`,
            dot: 'bg-text-muted',
        },
    ];
}

/**
 * Absensi saya (SAbsensi, MSRiwayat): today's status, the month's counters,
 * calendar with notes, the selected day's check-in/out and a personal PDF.
 */
export default function AttendanceHistory({ period, today, recap }: Props) {
    const breakpoint = useBreakpoint();
    const [selected, setSelected] = useState<string | null>(() =>
        initialDay(recap, today),
    );
    const [logsOpen, setLogsOpen] = useState(false);
    const cell = recap.days.find((item) => item.date === selected) ?? null;
    const go = (month: string) =>
        router.get(
            historyRoute.url({ query: { bulan: month } }),
            {},
            { preserveScroll: true },
        );
    const pdfUrl = historyRoutes.pdf.url({ query: { bulan: period.month } });
    const nextDisabled = period.countedUntil === null || period.isRunning;
    const subtitle = `${recap.workDays} hari kerja${recap.shiftName ? ` · Shift ${recap.shiftName}` : ''}`;
    const select = (next: RecapDayCell) => setSelected(next.date);
    const stats = monthStats(recap);
    const nav = (fill: boolean) => (
        <MonthNav
            label={period.label}
            onPrevious={() => go(period.previous)}
            onNext={() => go(period.next)}
            nextDisabled={nextDisabled}
            fill={fill}
        />
    );
    const logsButton = (
        <Button
            type="button"
            variant="quiet"
            size="sm"
            onClick={() => setLogsOpen(true)}
        >
            Lihat {recap.logs.length} log
        </Button>
    );
    const logsDialog = (
        <LogsDialog
            open={logsOpen}
            onOpenChange={setLogsOpen}
            name={recap.name}
            logs={recap.logs}
            reload={['recap']}
        />
    );

    if (breakpoint === null) {
        return (
            <div className="flex flex-col gap-5" aria-busy>
                <Skeleton className="h-24 rounded-panel" />
                <Skeleton className="h-96 rounded-panel" />
            </div>
        );
    }

    if (breakpoint === 'mobile') {
        return (
            <>
                <Head title="Riwayat absensi" />
                <div className="flex flex-col gap-3.5">
                    {nav(true)}
                    <dl className="grid grid-cols-4 gap-2">
                        {stats.slice(0, 4).map((stat) => (
                            <div
                                key={stat.label}
                                className="flex min-w-0 flex-col items-center gap-0.5 rounded-lg border border-border bg-surface px-2 py-2.5 text-center"
                            >
                                <dt className="order-2 truncate text-[12px] font-bold text-text-muted">
                                    {stat.label}
                                </dt>
                                <dd
                                    className={cn(
                                        'order-1 text-[24px] leading-8 font-extrabold tnum',
                                        stat.text ?? 'text-text',
                                    )}
                                >
                                    {stat.value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    <section
                        aria-label={`Kalender ${period.label}`}
                        className="rounded-[22px] border border-border bg-surface p-3.5"
                    >
                        <MonthCalendar
                            days={recap.days}
                            variant="dots"
                            selected={selected}
                            today={today}
                            onSelect={select}
                        />
                        <CalendarLegend
                            row={recap}
                            className="mt-3 border-t border-divider pt-3"
                        />
                    </section>
                    {cell && <DayDetail cell={cell} />}
                    <section
                        aria-label="Catatan bulan ini"
                        className="overflow-hidden rounded-[22px] border border-border bg-surface"
                    >
                        <MonthNotes
                            compact
                            days={recap.days}
                            selected={selected}
                            onSelect={setSelected}
                        />
                    </section>
                    <div className="grid grid-cols-2 gap-3">
                        <Button asChild variant="outline" size="lg">
                            <Link href={CORRECTION_HREF}>
                                <FileText aria-hidden />
                                Koreksi
                            </Link>
                        </Button>
                        <Button asChild variant="tonal" size="lg">
                            <a href={pdfUrl} download>
                                <Download aria-hidden />
                                PDF
                            </a>
                        </Button>
                    </div>
                    <p className="text-center text-meta text-text-muted">
                        {subtitle} · {PRIVACY_NOTE}{' '}
                        <button
                            type="button"
                            onClick={() => setLogsOpen(true)}
                            className="inline-flex min-h-11 items-center font-semibold text-link"
                        >
                            Lihat {recap.logs.length} log
                        </button>
                    </p>
                    {logsDialog}
                </div>
            </>
        );
    }

    return (
        <>
            <Head title="Absensi saya" />
            <div className="flex flex-col gap-6">
                <header className="flex flex-wrap items-end justify-between gap-4">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-display text-text">Absensi saya</h1>
                        <p className="text-body-lg text-text-muted">
                            {period.label} · {subtitle}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Button asChild variant="outline">
                            <Link href={CORRECTION_HREF}>Ajukan koreksi</Link>
                        </Button>
                        <Button asChild variant="outline">
                            <a href={pdfUrl} download>
                                <Download aria-hidden />
                                Unduh rekap saya (PDF)
                            </a>
                        </Button>
                    </div>
                </header>

                <TodayBar />

                <div className="flex flex-wrap items-center justify-between gap-3">
                    {nav(false)}
                    <p className="text-[15px] text-text-muted">
                        {PRIVACY_NOTE}
                    </p>
                </div>

                <dl className="flex flex-wrap gap-4">
                    {stats.map((stat) => (
                        <div
                            key={stat.label}
                            className="flex min-w-0 flex-[1_1_170px] flex-col gap-1 rounded-card border border-border bg-surface p-5 shadow-card"
                        >
                            <dt className="flex items-center gap-2 text-[15px] font-semibold text-text-muted">
                                <span
                                    aria-hidden
                                    className={cn(
                                        'size-2.5 rounded-full',
                                        stat.dot,
                                    )}
                                />
                                {stat.label}
                            </dt>
                            <dd className="text-[36px] leading-[44px] font-bold text-text tnum">
                                {stat.value}
                            </dd>
                        </div>
                    ))}
                </dl>

                <div className="flex flex-wrap items-start gap-5">
                    <Panel
                        title={
                            <span className="first-letter:uppercase">
                                {period.label}
                            </span>
                        }
                        className="flex-[1.6_1_600px]"
                        bodyClassName="gap-4"
                    >
                        <MonthCalendar
                            days={recap.days}
                            selected={selected}
                            today={today}
                            onSelect={select}
                        />
                        <CalendarLegend row={recap} />
                    </Panel>
                    <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-5">
                        {cell && <DayDetail cell={cell} />}
                        <Panel
                            title="Catatan bulan ini"
                            action={logsButton}
                            flush
                            className="pb-2"
                        >
                            <MonthNotes
                                days={recap.days}
                                selected={selected}
                                onSelect={setSelected}
                                className="border-t border-divider"
                            />
                        </Panel>
                    </div>
                </div>
                {logsDialog}
            </div>
        </>
    );
}

AttendanceHistory.layout = {
    breadcrumbs: [
        { title: 'Absensi', href: '/absensi' },
        { title: 'Riwayat absensi', href: '/absensi/riwayat' },
    ],
    title: 'Riwayat absensi',
    back: '/absensi',
};
