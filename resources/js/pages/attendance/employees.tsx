import { Head, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Plus, Search, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import type { Chip } from '@/components/mobile/chip-scroller';
import { Fab } from '@/components/mobile/fab';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AttendanceTabs } from '@/features/attendance/board/attendance-tabs';
import {
    cellStyle,
    defaultDate,
    matchesDayFilter,
    monthDates,
    shortDate,
} from '@/features/attendance/employees/cells';
import type { DayFilter } from '@/features/attendance/employees/cells';
import { DaySheet } from '@/features/attendance/employees/day-sheet';
import { StatusGrid } from '@/features/attendance/employees/status-grid';
import type {
    DayTarget,
    EmployeesPageProps,
    GridCell,
    GridRow,
} from '@/features/attendance/employees/types';
import { WeekStrip } from '@/features/attendance/employees/week-strip';
import { FilterSelect } from '@/features/attendance/filter-select';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatNumber, toIsoDay } from '@/lib/format';
import { monthLabel, officeMonth, recentMonths, shiftMonth } from '@/lib/recap';
import { cn, focusRing } from '@/lib/utils';
import employeeRoutes from '@/routes/attendance/employees';

const RELOAD = ['grid'];
/** Up to this many divisions show as chips; more use a select. */
const DIVISION_CHIPS = 6;

/**
 * Absensi › Absen pegawai (keputusan pemilik 20 Okt 2026; mockups Main,
 * SetHari, MAbsenPegawai, MAturHari): every employee × every day of a month,
 * HR sets or clears a day's status with a reason (audit log).
 */
export default function AttendanceEmployees(props: EmployeesPageProps) {
    const breakpoint = useBreakpoint();
    const [query, setQuery] = useState(props.filters.q ?? '');
    const [target, setTarget] = useState<DayTarget | null>(null);
    const [adding, setAdding] = useState(false);
    const today = toIsoDay(props.generatedAt);
    const inMonth =
        today !== null &&
        today >= props.period.start &&
        today <= props.period.end;
    const [date, setDate] = useState(() => defaultDate(today, props.period));
    const rows = props.grid.rows;
    const dates = useMemo(
        () => monthDates(props.period.start, props.period.end),
        [props.period.start, props.period.end],
    );
    const months = useMemo(
        () => recentMonths(officeMonth(props.generatedAt), 13),
        [props.generatedAt],
    );

    useEffect(() => {
        setDate(defaultDate(today, props.period));
        // A new month resets the strip; `today` only changes with generatedAt.
    }, [props.period.month]); // oxlint-disable-line react-hooks/exhaustive-deps

    const visit = (
        changes: Record<string, string | boolean | null>,
        only?: string[],
    ) => {
        const next: Record<string, string | boolean | null> = {
            bulan: props.filters.bulan,
            divisi: props.filters.divisi,
            q: props.filters.q,
            bermasalah: props.filters.bermasalah,
            ...changes,
        };
        const params = Object.fromEntries(
            Object.entries(next)
                .filter(
                    ([, value]) =>
                        value !== null && value !== '' && value !== false,
                )
                .map(([key, value]) => [key, value === true ? '1' : value]),
        ) as Record<string, string>;

        router.get(
            employeeRoutes.index.url({ query: params }),
            {},
            { preserveState: true, preserveScroll: true, replace: true, only },
        );
    };

    useEffect(() => {
        if ((props.filters.q ?? '') === query) {
            return;
        }

        const timer = window.setTimeout(
            () => visit({ q: query }, ['grid', 'filters']),
            350,
        );

        return () => window.clearTimeout(timer);
        // visit() reads the current props; only the typed text retriggers.
    }, [query]); // oxlint-disable-line react-hooks/exhaustive-deps

    const select = useCallback(
        (row: GridRow, cell: GridCell) =>
            setTarget({ employeeId: row.id, name: row.name, date: cell.date }),
        [],
    );
    const close = () => {
        setTarget(null);
        setAdding(false);
    };

    if (breakpoint === null) {
        return (
            <div className="flex flex-col gap-5" aria-busy>
                <Skeleton className="h-28 rounded-panel" />
                <Skeleton className="h-96 rounded-panel" />
            </div>
        );
    }

    const isMobile = breakpoint === 'mobile';
    const picker = adding ? (
        <AddPicker
            rows={rows}
            target={target}
            defaultDay={defaultDate(today, props.period)}
            min={props.period.start}
            max={props.period.end}
            onChange={setTarget}
        />
    ) : undefined;
    const sheet = (
        <DaySheet
            target={target}
            variant={isMobile ? 'mobile' : 'desktop'}
            reload={RELOAD}
            onClose={close}
            picker={picker}
        />
    );
    const openAdd = () => {
        setTarget(null);
        setAdding(true);
    };
    const monthNav = (
        <MonthNav
            month={props.period.month}
            months={months}
            onChange={(month) => visit({ bulan: month })}
            compact={isMobile}
        />
    );
    const search = (
        <div
            className={cn(
                'relative min-w-0',
                isMobile ? 'w-full' : 'w-[300px] shrink',
            )}
        >
            <Search
                className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-text-subtle"
                aria-hidden
            />
            <Input
                type="search"
                aria-label="Cari pegawai"
                placeholder="Cari nama pegawai"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-11"
            />
        </div>
    );

    if (isMobile) {
        return (
            <>
                <Head title="Absen pegawai" />
                <div className="flex flex-col gap-4">
                    <AttendanceTabs active="employees" mobile />
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-overline text-text-muted">
                            Absensi · HR
                        </p>
                        {monthNav}
                    </div>
                    <WeekStrip
                        selected={date}
                        start={props.period.start}
                        end={props.period.end}
                        today={inMonth ? today : null}
                        onSelect={setDate}
                    />
                    {search}
                    <MobileDayList rows={rows} date={date} onOpen={select} />
                </div>
                <Fab label="Tambah absen" onClick={openAdd} />
                {sheet}
            </>
        );
    }

    const kpis = props.grid.today;

    return (
        <>
            <Head title={`Absen pegawai · ${props.period.label}`} />
            <div className="flex flex-col gap-6">
                <header className="flex flex-wrap items-end justify-between gap-5">
                    <div className="flex min-w-0 flex-col gap-1">
                        <p className="text-overline text-text-muted">
                            Absensi · khusus HR
                        </p>
                        <h1 className="text-h1 text-text">Absen pegawai</h1>
                        <p className="text-body text-text-muted">
                            Semua pegawai, satu bulan. Klik sel untuk menambah,
                            mengubah, atau menghapus absen hari itu.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {monthNav}
                        <Button type="button" onClick={openAdd}>
                            <Plus aria-hidden />
                            Tambah absen
                        </Button>
                    </div>
                </header>

                <AttendanceTabs active="employees" />

                {kpis && today && (
                    <section
                        aria-label="Ringkasan hari ini"
                        className="grid grid-cols-2 gap-4 lg:grid-cols-5"
                    >
                        <KpiCard
                            tone="highlight"
                            label={`Hadir hari ini · ${shortDate(today)}`}
                            value={kpis.present}
                            suffix={`/ ${rows.length}`}
                            className="col-span-2 lg:col-span-1"
                        />
                        <KpiCard
                            label="Belum check-in"
                            value={kpis.not_checked_in}
                        />
                        <KpiCard
                            label="Terlambat hari ini"
                            value={kpis.late}
                            valueClassName={kpis.late > 0 ? 'text-warning' : ''}
                        />
                        <KpiCard
                            label="Alpha bulan ini"
                            value={kpis.absent_month}
                            valueClassName={
                                kpis.absent_month > 0 ? 'text-danger' : ''
                            }
                        />
                        <KpiCard
                            label="Perlu koreksi"
                            value={kpis.needs_correction}
                            valueClassName={
                                kpis.needs_correction > 0 ? 'text-warning' : ''
                            }
                        />
                    </section>
                )}

                <div className="flex flex-wrap items-center gap-3">
                    {search}
                    {props.divisions.length > 1 &&
                        (props.divisions.length <= DIVISION_CHIPS ? (
                            <div
                                role="group"
                                aria-label="Divisi"
                                className="flex flex-wrap gap-2"
                            >
                                {[
                                    { id: null, name: 'Semua divisi' },
                                    ...props.divisions,
                                ].map((division) => {
                                    const on =
                                        props.filters.divisi === division.id;

                                    return (
                                        <button
                                            key={division.id ?? 'all'}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() =>
                                                visit({ divisi: division.id })
                                            }
                                            className={cn(
                                                'h-control-sm rounded-full px-3.5 text-[14px] font-semibold transition-colors duration-120 ease-brand',
                                                on
                                                    ? 'bg-primary bg-grad-aksi text-on-brand'
                                                    : 'border border-border bg-surface text-text-muted hover:bg-surface-2',
                                                focusRing,
                                            )}
                                        >
                                            {division.name}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <FilterSelect
                                label="Divisi"
                                allLabel="Semua divisi"
                                value={props.filters.divisi}
                                onChange={(division) =>
                                    visit({ divisi: division })
                                }
                                options={props.divisions}
                            />
                        ))}
                    <div className="ml-auto flex min-h-11 items-center gap-2.5">
                        <Checkbox
                            id="problems-only"
                            checked={props.filters.bermasalah}
                            onCheckedChange={(checked) =>
                                visit({ bermasalah: checked === true }, [
                                    'grid',
                                    'filters',
                                ])
                            }
                        />
                        <Label
                            htmlFor="problems-only"
                            className="text-[15px] text-text-muted"
                        >
                            Hanya yang bermasalah
                        </Label>
                    </div>
                </div>

                {rows.length === 0 ? (
                    <EmptyState
                        icon={Users}
                        title={
                            props.filters.bermasalah
                                ? 'Tidak ada pegawai bermasalah'
                                : 'Belum ada pegawai'
                        }
                        description={
                            props.filters.bermasalah
                                ? 'Semua pegawai pada filter ini bersih: tanpa Alpha, terlambat, atau hari yang perlu dikoreksi.'
                                : 'Tidak ada pegawai aktif yang cocok dengan bulan dan filter ini.'
                        }
                    />
                ) : (
                    <StatusGrid
                        rows={rows}
                        dates={dates}
                        today={inMonth ? today : null}
                        monthLabel={props.period.label}
                        selected={
                            target
                                ? {
                                      employeeId: target.employeeId,
                                      date: target.date,
                                  }
                                : null
                        }
                        onSelect={select}
                    />
                )}
            </div>
            {sheet}
        </>
    );
}

function MonthNav({
    month,
    months,
    onChange,
    compact,
}: {
    month: string;
    months: string[];
    onChange: (month: string) => void;
    compact: boolean;
}) {
    const options = months.includes(month) ? months : [month, ...months];
    const newest = months[0];

    return (
        <div className="flex h-control items-center rounded-md border border-border-strong bg-surface">
            <button
                type="button"
                aria-label="Bulan sebelumnya"
                onClick={() => onChange(shiftMonth(month, -1))}
                className={cn(
                    'flex h-full w-11 items-center justify-center rounded-l-md text-text-muted hover:bg-surface-2',
                    focusRing,
                )}
            >
                <ChevronLeft className="size-5" aria-hidden />
            </button>
            <Select value={month} onValueChange={onChange}>
                <SelectTrigger
                    aria-label="Bulan"
                    className={cn(
                        'h-full rounded-none border-0 bg-transparent px-2 font-semibold shadow-none',
                        compact ? 'min-w-32' : 'min-w-40',
                    )}
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.map((item) => (
                        <SelectItem key={item} value={item}>
                            {monthLabel(item)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <button
                type="button"
                aria-label="Bulan berikutnya"
                disabled={month >= newest}
                onClick={() => onChange(shiftMonth(month, 1))}
                className={cn(
                    'flex h-full w-11 items-center justify-center rounded-r-md text-text-muted hover:bg-surface-2 disabled:text-text-subtle disabled:hover:bg-transparent',
                    focusRing,
                )}
            >
                <ChevronRight className="size-5" aria-hidden />
            </button>
        </div>
    );
}

/** Mobile: everyone's status on one date (MAbsenPegawai). */
function MobileDayList({
    rows,
    date,
    onOpen,
}: {
    rows: GridRow[];
    date: string;
    onOpen: (row: GridRow, cell: GridCell) => void;
}) {
    const [filter, setFilter] = useState<DayFilter>('all');
    const entries = rows
        .map((row) => ({
            row,
            cell: row.cells.find((item) => item.date === date),
        }))
        .filter(
            (entry): entry is { row: GridRow; cell: GridCell } =>
                entry.cell !== undefined,
        );
    const count = (value: DayFilter) =>
        entries.filter((entry) => matchesDayFilter(entry.cell.code, value))
            .length;
    const chips: Chip<DayFilter>[] = [
        { value: 'all', label: 'Semua', count: entries.length },
        { value: 'missing', label: 'Belum masuk', count: count('missing') },
        { value: 'late', label: 'Terlambat', count: count('late') },
        { value: 'absent', label: 'Alpha', count: count('absent') },
    ];
    const visible = entries.filter((entry) =>
        matchesDayFilter(entry.cell.code, filter),
    );

    return (
        <>
            <ChipScroller
                label={`Saring ${shortDate(date)}`}
                chips={chips}
                value={filter}
                onChange={setFilter}
            />
            {visible.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={Users}
                    title={
                        entries.length === 0
                            ? 'Belum ada pegawai'
                            : 'Tidak ada pegawai di saringan ini'
                    }
                    description={
                        entries.length === 0
                            ? 'Tidak ada pegawai aktif yang cocok dengan bulan dan pencarian ini.'
                            : undefined
                    }
                />
            ) : (
                <ul className="divide-y divide-divider overflow-hidden rounded-panel border border-border bg-surface">
                    {visible.map(({ row, cell }) => {
                        const style = cellStyle(cell.code);
                        const meta = [
                            row.division,
                            cell.check_in
                                ? `${cell.check_in}${cell.check_out ? `–${cell.check_out}` : ''}`
                                : null,
                        ]
                            .filter(Boolean)
                            .join(' · ');

                        return (
                            <li key={row.id}>
                                <button
                                    type="button"
                                    onClick={() => onOpen(row, cell)}
                                    aria-label={`${row.name}, ${shortDate(date)}: ${style.label}. Atur absensi`}
                                    className={cn(
                                        'flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2',
                                        focusRing,
                                    )}
                                >
                                    <UserAvatar
                                        name={row.name}
                                        className="size-11 shrink-0 text-[14px]"
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-semibold text-text">
                                            {row.name}
                                        </span>
                                        <span className="block truncate text-[13px] leading-[18px] text-text-muted">
                                            {meta || '–'}
                                        </span>
                                    </span>
                                    <span
                                        className={cn(
                                            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[14px] font-bold whitespace-nowrap',
                                            style.className,
                                            !style.letter && 'text-text-muted',
                                        )}
                                    >
                                        {style.label}
                                        {cell.manual && (
                                            <span
                                                aria-hidden
                                                className="size-1.5 rounded-full bg-primary"
                                            />
                                        )}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
            <p className="text-meta text-text-muted">
                {formatNumber(rows.length)} pegawai · ketuk untuk mengatur
                absensi. Titik = diatur HR.
            </p>
        </>
    );
}

/** "Tambah absen": choose the employee and the date, then the editor loads. */
function AddPicker({
    rows,
    target,
    defaultDay,
    min,
    max,
    onChange,
}: {
    rows: GridRow[];
    target: DayTarget | null;
    defaultDay: string;
    min: string;
    max: string;
    onChange: (target: DayTarget | null) => void;
}) {
    const [employeeId, setEmployeeId] = useState(target?.employeeId ?? '');
    const [day, setDay] = useState(target?.date ?? defaultDay);
    const pick = (id: string, next: string) => {
        const row = rows.find((item) => item.id === id);

        onChange(
            row && next
                ? { employeeId: row.id, name: row.name, date: next }
                : null,
        );
    };

    return (
        <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
                <Label htmlFor="add-employee">Pegawai</Label>
                <Select
                    value={employeeId}
                    onValueChange={(id) => {
                        setEmployeeId(id);
                        pick(id, day);
                    }}
                >
                    <SelectTrigger id="add-employee">
                        <SelectValue placeholder="Pilih pegawai" />
                    </SelectTrigger>
                    <SelectContent>
                        {rows.map((row) => (
                            <SelectItem key={row.id} value={row.id}>
                                {row.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-1.5">
                <Label htmlFor="add-date">Tanggal</Label>
                <DateInput
                    id="add-date"
                    value={day}
                    min={min}
                    max={max}
                    clearable={false}
                    onChange={(value) => {
                        setDay(value);
                        pick(employeeId, value);
                    }}
                />
            </div>
        </div>
    );
}

AttendanceEmployees.layout = {
    width: 'wide',
    breadcrumbs: [
        { title: 'Absensi', href: '/absensi/hari-ini' },
        { title: 'Absen pegawai', href: '/absensi/pegawai' },
    ],
    title: 'Absen pegawai',
    back: '/menu',
};
