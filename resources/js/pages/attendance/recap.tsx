import { Head, router, usePage } from '@inertiajs/react';
import type { SortingState } from '@tanstack/react-table';
import {
    createColumnHelper,
    createSortedRowModel,
    rowSortingFeature,
    sortFn_alphanumeric,
    sortFn_basic,
    tableFeatures,
    useTable,
} from '@tanstack/react-table';
import {
    ArrowDown,
    ArrowUp,
    ChevronLeft,
    ChevronRight,
    ChevronsUpDown,
    Download,
    Search,
    Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DesktopOnlyNotice } from '@/components/desktop-only-notice';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KpiBar, KpiCard } from '@/components/ui/kpi-card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { UserAvatar } from '@/components/shell/user-avatar';
import { FilterSelect } from '@/features/attendance/filter-select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmployeeMonthPanel } from '@/features/attendance/recap/employee-month-panel';
import { CorrectionDialog } from '@/features/attendance/review/correction-dialog';
import type { CorrectionTarget } from '@/features/attendance/review/correction-dialog';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatNumber, formatTime } from '@/lib/format';
import {
    formatHours,
    monthLabel,
    officeMonth,
    recentMonths,
} from '@/lib/recap';
import { cn, focusRing } from '@/lib/utils';
import { recap as recapRoute } from '@/routes/attendance';
import recapRoutes from '@/routes/attendance/recap';
import type {
    Option,
    RecapDayCell,
    RecapDetail,
    RecapPeriodData,
    RecapReportData,
    RecapRow,
} from '@/types/attendance';

type Props = {
    period: RecapPeriodData;
    filters: {
        bulan: string;
        division_id: string | null;
        search: string | null;
        karyawan: string | null;
    };
    divisions: Option[];
    report: RecapReportData;
    detail: RecapDetail | null;
    generatedAt: string;
    can: { export: boolean; correct: boolean };
};

const PAGE_SIZE = 10;
const RELOAD = ['report', 'detail'];

const features = tableFeatures({
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
});
const helper = createColumnHelper<typeof features, RecapRow>();
const columns = helper.columns([
    helper.accessor('name', { header: 'Nama', sortFn: 'alphanumeric' }),
    helper.accessor((row) => row.divisionName ?? '', {
        id: 'division',
        header: 'Divisi',
        sortFn: 'alphanumeric',
    }),
    helper.accessor('workDays', { header: 'Hari kerja', sortFn: 'basic' }),
    helper.accessor('presentDays', { header: 'Hadir', sortFn: 'basic' }),
    helper.accessor('lateMinutes', { header: 'Terlambat', sortFn: 'basic' }),
    helper.accessor('absentDays', { header: 'Alpha', sortFn: 'basic' }),
    helper.accessor('leaveDays', { header: 'Cuti', sortFn: 'basic' }),
    helper.accessor('permitDays', { header: 'Izin', sortFn: 'basic' }),
    helper.accessor('sickDays', { header: 'Sakit', sortFn: 'basic' }),
    helper.accessor('businessTripDays', { header: 'Dinas', sortFn: 'basic' }),
    helper.accessor('overtimeHours', { header: 'Lembur', sortFn: 'basic' }),
]);

function SortIcon({ direction }: { direction: false | 'asc' | 'desc' }) {
    if (direction === 'asc') {
        return <ArrowUp className="size-3" aria-hidden />;
    }

    if (direction === 'desc') {
        return <ArrowDown className="size-3" aria-hidden />;
    }

    return <ChevronsUpDown className="size-3 opacity-40" aria-hidden />;
}

/** Admin › Rekap absensi (mockup RekapAbsensi). Desktop only. */
export default function AttendanceRecap(props: Props) {
    const breakpoint = useBreakpoint();
    const { auth } = usePage().props;
    const [query, setQuery] = useState(props.filters.search ?? '');
    const [sorting, setSorting] = useState<SortingState>([]);
    const [page, setPage] = useState(0);
    const [day, setDay] = useState<string | null>(null);
    const [correction, setCorrection] = useState<CorrectionTarget | null>(null);
    const rows = props.report.rows;

    const visit = (changes: Record<string, string | null>, only?: string[]) => {
        const next = {
            bulan: props.period.month,
            divisi: props.filters.division_id,
            q: props.filters.search,
            karyawan: props.filters.karyawan,
            ...changes,
        };
        const query = Object.fromEntries(
            Object.entries(next).filter(
                ([, value]) => value !== null && value !== '',
            ),
        );

        router.get(
            recapRoute.url({ query }),
            {},
            { preserveState: true, preserveScroll: true, replace: true, only },
        );
    };

    useEffect(() => {
        if ((props.filters.search ?? '') === query) {
            return;
        }

        const timer = window.setTimeout(
            () => visit({ q: query }, ['report', 'filters']),
            350,
        );

        return () => window.clearTimeout(timer);
        // visit() reads the current props; only the typed text should retrigger.
    }, [query]); // oxlint-disable-line react-hooks/exhaustive-deps

    const table = useTable({
        features,
        columns,
        data: rows,
        state: { sorting },
        onSortingChange: setSorting,
        getRowId: (row) => row.userId,
    });
    const sorted = table.getRowModel().rows.map((row) => row.original);
    const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const current = Math.min(page, pages - 1);
    const visible = sorted.slice(
        current * PAGE_SIZE,
        current * PAGE_SIZE + PAGE_SIZE,
    );
    const months = useMemo(
        () => recentMonths(officeMonth(props.generatedAt), 13),
        [props.generatedAt],
    );

    const exportUrl = (format: 'xlsx' | 'pdf') =>
        recapRoutes.export.url(format, {
            query: Object.fromEntries(
                Object.entries({
                    bulan: props.period.month,
                    divisi: props.filters.division_id,
                    q: props.filters.search,
                }).filter(([, value]) => value),
            ),
        });

    if (breakpoint === null) {
        return <Skeleton className="h-96 rounded-panel" />;
    }

    if (breakpoint === 'mobile') {
        return (
            <>
                <Head title="Rekap absensi" />
                <div className="flex flex-col gap-4">
                    <p className="text-overline text-link first-letter:uppercase">
                        {props.period.label}
                        {props.period.isRunning ? ' · berjalan' : ''}
                    </p>
                    <RecapKpis summary={props.report.summary} compact />
                    <DesktopOnlyNotice feature="Rekap & ekspor bulanan" />
                </div>
            </>
        );
    }

    const summary = props.report.summary;
    const select = (cell: RecapDayCell) => setDay(cell.date);
    const end = props.period.countedUntil ?? props.period.end;

    return (
        <>
            <Head title={`Rekap absensi · ${props.period.label}`} />
            <div className="flex flex-col gap-6">
                <header className="flex flex-wrap items-end justify-between gap-5">
                    <div className="flex flex-col gap-2">
                        <p className="text-overline text-link">
                            Diperbarui {formatTime(props.generatedAt)}
                        </p>
                        <h1 className="text-display text-text first-letter:uppercase">
                            Rekap {props.period.label}
                        </h1>
                        <p className="text-body-lg text-text-muted">
                            {Number(props.period.start.slice(8))}–
                            {Number(end.slice(8))}{' '}
                            {props.period.label.split(' ')[0].slice(0, 3)}{' '}
                            {props.period.start.slice(0, 4)}
                            {props.period.isRunning ? ' (berjalan)' : ''} ·{' '}
                            {summary.employees} karyawan
                        </p>
                    </div>
                    {props.can.export && (
                        <div className="flex flex-wrap gap-3">
                            <Button asChild variant="outline">
                                <a href={exportUrl('pdf')} download>
                                    <Download aria-hidden />
                                    Ekspor PDF
                                </a>
                            </Button>
                            <Button asChild>
                                <a href={exportUrl('xlsx')} download>
                                    <Download aria-hidden />
                                    Ekspor Excel
                                </a>
                            </Button>
                        </div>
                    )}
                </header>

                <div className="flex flex-wrap items-center gap-3">
                    <Select
                        value={props.period.month}
                        onValueChange={(month) => visit({ bulan: month })}
                    >
                        <SelectTrigger aria-label="Bulan" className="min-w-44">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {(months.includes(props.period.month)
                                ? months
                                : [props.period.month, ...months]
                            ).map((month) => (
                                <SelectItem key={month} value={month}>
                                    {monthLabel(month)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {props.divisions.length > 1 && (
                        <FilterSelect
                            label="Divisi"
                            allLabel="Semua divisi"
                            value={props.filters.division_id}
                            onChange={(division) => visit({ divisi: division })}
                            options={props.divisions}
                        />
                    )}
                    <div className="relative">
                        <Search
                            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-text-subtle"
                            aria-hidden
                        />
                        <Input
                            type="search"
                            aria-label="Cari nama karyawan"
                            placeholder="Cari nama karyawan"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            className="w-72 pl-11"
                        />
                    </div>
                </div>

                <RecapKpis summary={summary} />

                <div
                    className={cn(
                        'grid items-start gap-5',
                        props.detail && 'xl:grid-cols-[minmax(0,1fr)_420px]',
                    )}
                >
                    <section
                        aria-label="Rekap per karyawan"
                        className="overflow-hidden rounded-panel border border-border bg-surface shadow-card"
                    >
                        {rows.length === 0 ? (
                            <div className="p-6">
                                <EmptyState
                                    size="sm"
                                    icon={Users}
                                    title="Belum ada data absensi"
                                    description="Tidak ada karyawan terjadwal atau tercatat pada bulan dan filter ini."
                                />
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-[16px] tnum">
                                    <thead className="border-b border-border bg-background text-[14px] text-text-muted">
                                        <tr>
                                            {table
                                                .getHeaderGroups()[0]
                                                .headers.map((header) => {
                                                    const direction =
                                                        header.column.getIsSorted();

                                                    return (
                                                        <th
                                                            key={header.id}
                                                            scope="col"
                                                            aria-sort={
                                                                direction ===
                                                                'asc'
                                                                    ? 'ascending'
                                                                    : direction ===
                                                                        'desc'
                                                                      ? 'descending'
                                                                      : undefined
                                                            }
                                                            className={cn(
                                                                'h-12 px-3 font-bold whitespace-nowrap',
                                                                header.index > 1
                                                                    ? 'text-right'
                                                                    : 'text-left',
                                                                header.index ===
                                                                    0 && 'pl-7',
                                                            )}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={header.column.getToggleSortingHandler()}
                                                                className={cn(
                                                                    'inline-flex min-h-11 items-center gap-1 rounded-sm hover:text-text',
                                                                    focusRing,
                                                                    header.index >
                                                                        1 &&
                                                                        'flex-row-reverse',
                                                                )}
                                                            >
                                                                {String(
                                                                    header
                                                                        .column
                                                                        .columnDef
                                                                        .header ??
                                                                        '',
                                                                )}
                                                                <SortIcon
                                                                    direction={
                                                                        direction
                                                                    }
                                                                />
                                                            </button>
                                                        </th>
                                                    );
                                                })}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-divider">
                                        {visible.map((row) => {
                                            const active =
                                                row.userId ===
                                                props.filters.karyawan;

                                            return (
                                                <tr
                                                    key={row.userId}
                                                    aria-selected={active}
                                                    onClick={() =>
                                                        visit(
                                                            {
                                                                karyawan:
                                                                    row.userId,
                                                            },
                                                            [
                                                                'detail',
                                                                'filters',
                                                            ],
                                                        )
                                                    }
                                                    className={cn(
                                                        'h-[60px] cursor-pointer transition-colors duration-120 ease-brand hover:bg-surface-2/60',
                                                        active &&
                                                            'bg-link-soft shadow-[inset_3px_0_0_var(--primary)] hover:bg-link-soft',
                                                    )}
                                                >
                                                    <td className="py-2 pr-3 pl-7">
                                                        <button
                                                            type="button"
                                                            className={cn(
                                                                'flex items-center gap-3 rounded-sm text-left',
                                                                focusRing,
                                                            )}
                                                            onClick={(
                                                                event,
                                                            ) => {
                                                                event.stopPropagation();
                                                                visit(
                                                                    {
                                                                        karyawan:
                                                                            row.userId,
                                                                    },
                                                                    [
                                                                        'detail',
                                                                        'filters',
                                                                    ],
                                                                );
                                                            }}
                                                        >
                                                            <UserAvatar
                                                                name={row.name}
                                                                className="size-9 text-[13px]"
                                                            />
                                                            <span className="font-semibold whitespace-nowrap text-text">
                                                                {row.name}
                                                            </span>
                                                        </button>
                                                    </td>
                                                    <td className="px-3 py-2 text-[15px] whitespace-nowrap text-text-muted">
                                                        {row.divisionName ??
                                                            '–'}
                                                    </td>
                                                    <Num value={row.workDays} />
                                                    <Num
                                                        value={row.presentDays}
                                                        strong
                                                    />
                                                    <td
                                                        className={cn(
                                                            'px-3 py-2 text-right font-semibold whitespace-nowrap',
                                                            row.lateCount > 0
                                                                ? 'text-warning'
                                                                : 'text-text-muted',
                                                        )}
                                                    >
                                                        {row.lateCount === 0
                                                            ? '0'
                                                            : `${row.lateCount} · ${row.lateMinutes}m`}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        {row.absentDays > 0 ? (
                                                            <span className="inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-danger-soft px-2 text-[14px] font-bold text-danger">
                                                                {row.absentDays}
                                                            </span>
                                                        ) : (
                                                            <span className="text-text-muted">
                                                                0
                                                            </span>
                                                        )}
                                                    </td>
                                                    <Num
                                                        value={row.leaveDays}
                                                    />
                                                    <Num
                                                        value={row.permitDays}
                                                    />
                                                    <Num value={row.sickDays} />
                                                    <Num
                                                        value={
                                                            row.businessTripDays
                                                        }
                                                    />
                                                    <td className="px-3 py-2 pr-7 text-right">
                                                        {formatHours(
                                                            row.overtimeHours,
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-7 py-3 text-meta text-text-muted">
                            <span>
                                Menampilkan{' '}
                                {rows.length === 0
                                    ? 0
                                    : current * PAGE_SIZE + 1}
                                –
                                {Math.min(
                                    rows.length,
                                    (current + 1) * PAGE_SIZE,
                                )}{' '}
                                dari {rows.length} karyawan · Terlambat ditulis
                                kali · total menit, sudah termasuk dalam Hadir
                            </span>
                            {pages > 1 && (
                                <span className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon-sm"
                                        disabled={current === 0}
                                        onClick={() => setPage(current - 1)}
                                        aria-label="Halaman sebelumnya"
                                    >
                                        <ChevronLeft aria-hidden />
                                    </Button>
                                    <span className="tnum">
                                        {current + 1} / {pages}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon-sm"
                                        disabled={current >= pages - 1}
                                        onClick={() => setPage(current + 1)}
                                        aria-label="Halaman berikutnya"
                                    >
                                        <ChevronRight aria-hidden />
                                    </Button>
                                </span>
                            )}
                        </div>
                    </section>

                    {props.detail && (
                        <EmployeeMonthPanel
                            key={props.detail.userId}
                            detail={props.detail}
                            monthLabel={props.period.label}
                            reload={RELOAD}
                            selected={day}
                            onSelectDay={
                                props.can.correct &&
                                props.detail.userId !== auth.user?.id
                                    ? select
                                    : undefined
                            }
                            onClose={() =>
                                visit({ karyawan: null }, ['detail', 'filters'])
                            }
                            onCorrect={
                                props.can.correct &&
                                props.detail.userId !== auth.user?.id
                                    ? () => {
                                          const detail = props.detail;
                                          const cell = detail?.days.find(
                                              (item) => item.date === day,
                                          );

                                          if (detail) {
                                              setCorrection({
                                                  userId: detail.userId,
                                                  name: detail.name,
                                                  workDate:
                                                      cell?.date ??
                                                      props.period
                                                          .countedUntil ??
                                                      props.period.end,
                                                  checkIn: cell?.checkIn
                                                      ? formatTime(
                                                            cell.checkIn
                                                                .occurredAt,
                                                        ).replace('.', ':')
                                                      : null,
                                                  checkOut: cell?.checkOut
                                                      ? formatTime(
                                                            cell.checkOut
                                                                .occurredAt,
                                                        ).replace('.', ':')
                                                      : null,
                                              });
                                          }
                                      }
                                    : undefined
                            }
                        />
                    )}
                </div>
            </div>
            <CorrectionDialog
                key={
                    correction
                        ? `${correction.userId}-${correction.workDate}`
                        : 'none'
                }
                target={correction}
                today={props.period.countedUntil ?? props.period.end}
                reload={RELOAD}
                onClose={() => setCorrection(null)}
            />
        </>
    );
}

function Num({ value, strong = false }: { value: number; strong?: boolean }) {
    return (
        <td
            className={cn(
                'px-3 py-2 text-right',
                strong
                    ? 'font-bold text-text'
                    : value === 0
                      ? 'text-text-muted'
                      : 'text-text',
            )}
        >
            {formatNumber(value)}
        </td>
    );
}

/** Month summary (MgAbsensi "Ringkasan"): highlighted attendance rate. */
function RecapKpis({
    summary,
    compact = false,
}: {
    summary: RecapReportData['summary'];
    compact?: boolean;
}) {
    const rate =
        summary.attendanceRate === null
            ? null
            : Math.round(summary.attendanceRate);

    return (
        <section
            aria-label="Ringkasan"
            className={cn(
                'grid grid-cols-2 gap-3',
                !compact && 'gap-5 xl:grid-cols-4',
            )}
        >
            <KpiCard
                tone="highlight"
                label="Rata-rata kehadiran"
                value={rate === null ? '–' : `${rate}%`}
                className={cn(compact && 'col-span-2')}
                bar={<KpiBar value={rate ?? 0} label="Rata-rata kehadiran" />}
            />
            <KpiCard
                label="Hari kerja"
                value={summary.calendarWorkDays}
                note={
                    compact
                        ? null
                        : `${summary.weekendDays} hari akhir pekan · ${summary.holidayDays === 0 ? 'tanpa libur nasional' : `${summary.holidayDays} hari libur`}`
                }
            />
            <KpiCard
                label="Total terlambat"
                value={summary.lateCount}
                suffix="kali"
                valueClassName={summary.lateCount > 0 ? 'text-warning' : ''}
                note={
                    compact
                        ? null
                        : `Lewat toleransi ${summary.lateToleranceMin} menit`
                }
            />
            <KpiCard
                label="Total lembur"
                value={formatHours(summary.overtimeHours)}
                suffix="jam"
                note={compact ? null : 'Hanya lembur yang disetujui'}
                className={cn(compact && 'col-span-2')}
            />
        </section>
    );
}

AttendanceRecap.layout = {
    width: 'wide',
    breadcrumbs: [
        { title: 'Admin', href: '' },
        { title: 'Rekap absensi', href: '/absensi/rekap' },
    ],
    title: 'Rekap absensi',
    back: '/menu',
};
