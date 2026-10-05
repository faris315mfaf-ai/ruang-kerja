import { Head, Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DayDetail } from '@/features/attendance/recap/day-detail';
import { EmployeeMonthPanel } from '@/features/attendance/recap/employee-month-panel';
import {
    CalendarLegend,
    MonthCalendar,
} from '@/features/attendance/recap/month-calendar';
import { useBreakpoint } from '@/hooks/use-breakpoint';
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

/**
 * Absensi Saya (mockups MRiwayatAbsensi, RekapAbsensi detail): the own monthly
 * recap with a calendar, the selected day's check-in/out and a personal PDF.
 */
export default function AttendanceHistory({ period, today, recap }: Props) {
    const breakpoint = useBreakpoint();
    const [selected, setSelected] = useState<string | null>(() =>
        initialDay(recap, today),
    );
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

    const monthNav = (
        <div className="flex items-center justify-between gap-3">
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 rounded-full"
                onClick={() => go(period.previous)}
                aria-label="Bulan sebelumnya"
            >
                <ChevronLeft aria-hidden />
            </Button>
            <div className="min-w-0 text-center">
                <h1 className="text-[19px] font-semibold text-text md:text-xl">
                    {period.label}
                </h1>
                <p className="truncate text-[13px] text-text-muted">
                    {subtitle}
                </p>
            </div>
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 rounded-full"
                onClick={() => go(period.next)}
                disabled={nextDisabled}
                aria-label="Bulan berikutnya"
            >
                <ChevronRight aria-hidden />
            </Button>
        </div>
    );

    const actions = (
        <div className="grid grid-cols-2 items-center gap-3">
            <Button asChild variant="outline" className="h-12 text-[15px]">
                <Link href={CORRECTION_HREF}>
                    <FileText aria-hidden />
                    Ajukan koreksi
                </Link>
            </Button>
            <a
                href={pdfUrl}
                download
                className="inline-flex h-12 items-center justify-center gap-2 text-[15px] font-medium text-primary hover:underline"
            >
                <Download className="size-5" aria-hidden />
                Unduh rekap (PDF)
            </a>
        </div>
    );

    if (breakpoint === null) {
        return (
            <div className="space-y-4" aria-busy>
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-80 rounded-xl" />
            </div>
        );
    }

    if (breakpoint === 'mobile') {
        const cards = [
            {
                label: 'Hadir',
                value: <>{Math.max(0, recap.presentDays - recap.lateCount)}</>,
                dot: 'bg-success',
            },
            {
                label: 'Terlambat',
                value:
                    recap.lateCount === 0 ? (
                        <>0</>
                    ) : (
                        <span className="text-warning">
                            {recap.lateCount}
                            <span className="text-[13px] font-medium">
                                {' '}
                                · {recap.lateMinutes}m
                            </span>
                        </span>
                    ),
                dot: null,
            },
            {
                label: 'Cuti',
                value: (
                    <>
                        {recap.leaveDays +
                            recap.permitDays +
                            recap.businessTripDays}
                    </>
                ),
                dot: 'bg-info',
            },
            { label: 'Sakit', value: <>{recap.sickDays}</>, dot: 'bg-primary' },
        ];

        return (
            <>
                <Head title="Riwayat absensi" />
                <div className="space-y-4">
                    {monthNav}
                    <div className="grid grid-cols-4 gap-2">
                        {cards.map((card) => (
                            <div
                                key={card.label}
                                className="min-w-0 rounded-xl border border-border bg-surface px-2 py-2.5 shadow-card"
                            >
                                <p className="flex items-center gap-1 truncate text-[13px] text-text-muted">
                                    {card.dot && (
                                        <span
                                            aria-hidden
                                            className={cn(
                                                'size-1.5 rounded-full',
                                                card.dot,
                                            )}
                                        />
                                    )}
                                    {card.label}
                                </p>
                                <p className="mt-0.5 text-[19px] font-semibold whitespace-nowrap text-text tnum">
                                    {card.value}
                                </p>
                            </div>
                        ))}
                    </div>
                    <section className="space-y-3 rounded-xl border border-border bg-surface p-3 shadow-card">
                        <MonthCalendar
                            days={recap.days}
                            variant="dots"
                            selected={selected}
                            today={today}
                            onSelect={select}
                        />
                        <CalendarLegend
                            row={recap}
                            className="border-t border-border pt-3"
                        />
                    </section>
                    {cell && <DayDetail cell={cell} />}
                    {actions}
                </div>
            </>
        );
    }

    return (
        <>
            <Head title="Absensi saya" />
            <div className="space-y-5">
                <header className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-xl leading-7 font-semibold text-text">
                            Absensi saya · {period.label}
                        </h1>
                        <p className="text-sm text-text-muted">{subtitle}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-9"
                            onClick={() => go(period.previous)}
                            aria-label="Bulan sebelumnya"
                        >
                            <ChevronLeft aria-hidden />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-9"
                            onClick={() => go(period.next)}
                            disabled={nextDisabled}
                            aria-label="Bulan berikutnya"
                        >
                            <ChevronRight aria-hidden />
                        </Button>
                        <Button asChild variant="outline" className="h-9">
                            <a href={pdfUrl} download>
                                <Download aria-hidden />
                                Unduh rekap (PDF)
                            </a>
                        </Button>
                    </div>
                </header>
                <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
                    <EmployeeMonthPanel
                        detail={recap}
                        monthLabel={period.label}
                        reload={['recap']}
                        selected={selected}
                        onSelectDay={select}
                    />
                    <div className="space-y-4">
                        {cell && <DayDetail cell={cell} />}
                        <div className="flex flex-wrap gap-2">
                            <Button asChild variant="outline" className="h-10">
                                <Link href={CORRECTION_HREF}>
                                    <FileText aria-hidden />
                                    Ajukan koreksi
                                </Link>
                            </Button>
                        </div>
                        <p className="text-[13px] text-text-muted">
                            Data ini hanya terlihat oleh Anda, atasan langsung,
                            dan HR.
                        </p>
                    </div>
                </div>
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
