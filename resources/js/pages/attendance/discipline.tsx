import { Head } from '@inertiajs/react';
import { Search, Users } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { AttendanceTabs } from '@/features/attendance/board/attendance-tabs';
import {
    filterPeople,
    personStatus,
} from '@/features/attendance/discipline/lib';
import type { PersonFilter } from '@/features/attendance/discipline/lib';
import type {
    DisciplinePageProps,
    DisciplinePerson,
    DisciplineReport,
} from '@/features/attendance/discipline/types';
import { ComparedNote } from '@/features/dashboard/compared-note';
import {
    KpiSkeleton,
    MetricKpi,
    PanelHint,
    PanelSkeleton,
} from '@/features/dashboard/dashboard-ui';
import { FilterBar } from '@/features/dashboard/filter-bar';
import { compared, formatMetric } from '@/features/dashboard/lib';
import { MetricInfo } from '@/features/dashboard/metric-info';
import { TrendChart } from '@/features/dashboard/trend-chart';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';

const MOBILE_LIMIT = 12;

/** The six KPIs of the period (discipline recap + completion & lead time). */
function Kpis({
    report,
    props,
    compact = false,
}: {
    report: DisciplineReport;
    props: DisciplinePageProps;
    compact?: boolean;
}) {
    const { kpis } = report;
    const { definitions } = props;
    const previous = props.filters.period.previous_label;
    const card = compact ? 'px-4 py-4' : undefined;

    return (
        <>
            <MetricKpi
                cardClassName={card}
                label="Kedisiplinan hadir"
                definition={definitions.attendance_discipline}
                value={formatMetric(
                    kpis.attendance_discipline.value,
                    'percent',
                )}
                delta={compared(
                    kpis.attendance_discipline,
                    'percent',
                    previous,
                )}
                note={`${kpis.attendance_discipline.numerator} dari ${kpis.attendance_discipline.denominator} hari kerja`}
            />
            <MetricKpi
                cardClassName={card}
                label="Rata-rata terlambat"
                definition={definitions.average_lateness}
                value={formatMetric(kpis.average_lateness.value, 'minutes')}
                delta={compared(
                    kpis.average_lateness,
                    'minutes',
                    previous,
                    'lower',
                )}
                note={`${kpis.average_lateness.denominator} hari terlambat`}
            />
            <MetricKpi
                cardClassName={card}
                label="Hari alpha"
                definition="Hari berstatus Alpha (tidak check-in tanpa pengajuan) dalam periode."
                value={formatMetric(kpis.absent_days.value, 'count')}
                valueClassName={
                    (kpis.absent_days.value ?? 0) > 0
                        ? 'text-danger'
                        : undefined
                }
                delta={compared(kpis.absent_days, 'count', previous, 'lower')}
            />
            <MetricKpi
                cardClassName={card}
                label="Hari terlambat"
                definition="Hari berstatus Terlambat dalam periode."
                value={formatMetric(kpis.late_days.value, 'count')}
                delta={compared(kpis.late_days, 'count', previous, 'lower')}
            />
            <MetricKpi
                cardClassName={card}
                label="Tingkat penyelesaian"
                definition={definitions.completion_rate}
                value={formatMetric(kpis.completion_rate.value, 'percent')}
                delta={compared(kpis.completion_rate, 'percent', previous)}
                note={`${kpis.completion_rate.numerator} dari ${kpis.completion_rate.denominator} tugas bertenggat`}
            />
            <MetricKpi
                cardClassName={card}
                label="Lead time"
                definition={definitions.lead_time}
                value={formatMetric(kpis.lead_time.value, 'days')}
                delta={compared(kpis.lead_time, 'days', previous, 'lower')}
                note={`median dari ${kpis.lead_time.denominator} tugas selesai`}
            />
        </>
    );
}

function StatusBadge({ person }: { person: DisciplinePerson }) {
    const status = personStatus(person);

    return (
        <Badge variant="status" tone={status.tone} dot className="h-7">
            {status.label}
        </Badge>
    );
}

function PeopleTable({ people }: { people: DisciplinePerson[] }) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead className="text-right">Hari kerja</TableHead>
                    <TableHead className="text-right">Kedisiplinan</TableHead>
                    <TableHead className="text-right">Terlambat</TableHead>
                    <TableHead className="text-right">Rata-rata</TableHead>
                    <TableHead className="text-right">Alpha</TableHead>
                    <TableHead>Keadaan</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {people.map((person) => (
                    <TableRow key={person.user.id}>
                        <TableCell>
                            <span className="flex min-w-0 items-center gap-3">
                                <UserAvatar
                                    name={person.user.name}
                                    src={person.user.avatar}
                                    className="size-9 text-[13px]"
                                />
                                <span className="flex min-w-0 flex-col">
                                    <span className="truncate font-semibold">
                                        {person.user.name}
                                    </span>
                                    <span className="truncate text-meta text-text-muted">
                                        {person.user.division ?? 'Tanpa divisi'}
                                    </span>
                                </span>
                            </span>
                        </TableCell>
                        <TableCell className="text-right tnum">
                            {person.scheduled}
                        </TableCell>
                        <TableCell className="text-right tnum">
                            {formatMetric(person.discipline, 'percent')}
                        </TableCell>
                        <TableCell className="text-right tnum">
                            {person.late_days > 0
                                ? `${person.late_days}×`
                                : '–'}
                        </TableCell>
                        <TableCell className="text-right tnum">
                            {formatMetric(person.average_late, 'minutes')}
                        </TableCell>
                        <TableCell
                            className={cn(
                                'text-right tnum',
                                person.absent_days > 0 &&
                                    'font-bold text-danger',
                            )}
                        >
                            {person.absent_days}
                        </TableCell>
                        <TableCell>
                            <StatusBadge person={person} />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

function PeopleList({ people }: { people: DisciplinePerson[] }) {
    return (
        <ul className="flex flex-col divide-y divide-divider">
            {people.map((person) => (
                <li
                    key={person.user.id}
                    className="flex min-h-[72px] items-center gap-3 py-3"
                >
                    <UserAvatar
                        name={person.user.name}
                        src={person.user.avatar}
                        className="size-10 text-[14px]"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate text-[17px] font-semibold">
                            {person.user.name}
                        </span>
                        <span className="truncate text-meta text-text-muted">
                            {formatMetric(person.discipline, 'percent')} tepat
                            waktu · {person.scheduled} hari kerja
                        </span>
                    </span>
                    <StatusBadge person={person} />
                </li>
            ))}
        </ul>
    );
}

const FILTERS: { value: PersonFilter; label: string }[] = [
    { value: 'issues', label: 'Perlu perhatian' },
    { value: 'absent', label: 'Alpha' },
    { value: 'late', label: 'Terlambat' },
    { value: 'all', label: 'Semua' },
];

/**
 * Absensi › Kedisiplinan (keputusan pemilik 6 Okt 2026): the discipline
 * recap that left the HR dashboard (kedisiplinan hadir, rata-rata terlambat,
 * alpha, terlambat, 8-week trend) plus tingkat penyelesaian and lead time
 * (no longer on the Direksi dashboard), and a per-person table. Desktop:
 * filter bar + export; phone: KPI tiles 2×2, chips and a compact list.
 */
export default function AttendanceDiscipline(props: DisciplinePageProps) {
    const breakpoint = useBreakpoint();
    const [filter, setFilter] = useState<PersonFilter>('issues');
    const [query, setQuery] = useState('');
    const [expanded, setExpanded] = useState(false);
    const report = props.report;
    const people = report ? filterPeople(report.people, filter, query) : [];
    const mobile = breakpoint === 'mobile';

    if (breakpoint === null) {
        return <Skeleton className="h-96 rounded-panel" />;
    }

    const count = (value: PersonFilter) =>
        report ? filterPeople(report.people, value, '').length : undefined;

    const peoplePanel = report ? (
        <Panel
            title={
                <>
                    Per orang
                    <Badge variant="status" tone="neutral" className="h-7">
                        {report.people.length}
                    </Badge>
                </>
            }
            action={
                !mobile && (
                    <label className="relative block w-64">
                        <span className="sr-only">Cari nama atau divisi</span>
                        <Search
                            aria-hidden
                            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle"
                        />
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Cari nama atau divisi"
                            className="h-control-sm pl-9"
                        />
                    </label>
                )
            }
            flush={!mobile}
            className={mobile ? 'py-5' : 'pb-3'}
            bodyClassName="gap-3"
        >
            <div className={cn(!mobile && 'px-6 md:px-7')}>
                <ChipScroller<PersonFilter>
                    label="Tampilkan"
                    value={filter}
                    onChange={(value) => {
                        setFilter(value);
                        setExpanded(false);
                    }}
                    chips={FILTERS.map((item) => ({
                        ...item,
                        count: count(item.value),
                    }))}
                />
            </div>
            {people.length === 0 ? (
                <div className={cn(!mobile && 'px-6 md:px-7')}>
                    <EmptyState
                        size="sm"
                        icon={Users}
                        title={
                            filter === 'issues' && query === ''
                                ? 'Semua tepat waktu'
                                : 'Tidak ada yang cocok'
                        }
                    >
                        {filter === 'issues' && query === ''
                            ? 'Tidak ada alpha atau keterlambatan dalam periode ini.'
                            : 'Ubah filter atau kata pencarian.'}
                    </EmptyState>
                </div>
            ) : mobile ? (
                <>
                    <PeopleList
                        people={
                            expanded ? people : people.slice(0, MOBILE_LIMIT)
                        }
                    />
                    {people.length > MOBILE_LIMIT && (
                        <button
                            type="button"
                            onClick={() => setExpanded((value) => !value)}
                            aria-expanded={expanded}
                            className="min-h-11 self-start rounded-control px-1 text-[16px] font-semibold text-link"
                        >
                            {expanded
                                ? 'Tampilkan lebih sedikit'
                                : `Lihat semua ${people.length}`}
                        </button>
                    )}
                </>
            ) : (
                <PeopleTable people={people} />
            )}
        </Panel>
    ) : (
        <PanelSkeleton title="Per orang" rows={6} />
    );

    const trend = report ? (
        <Panel
            title={
                <>
                    Tren kedisiplinan hadir
                    <MetricInfo
                        definition={props.definitions.attendance_discipline}
                    />
                </>
            }
            action={<PanelHint>% hari kerja tepat waktu · 8 minggu</PanelHint>}
            className={mobile ? 'py-5' : undefined}
        >
            <TrendChart
                points={report.trend}
                description="Kedisiplinan hadir per minggu"
                numeratorLabel="hari tepat waktu"
                denominatorLabel="hari kerja"
                compact={mobile}
                height={mobile ? 180 : 220}
            />
        </Panel>
    ) : (
        <PanelSkeleton title="Tren kedisiplinan hadir" rows={5} />
    );

    return (
        <>
            <Head title="Kedisiplinan" />
            <div className={cn('flex flex-col', mobile ? 'gap-4' : 'gap-6')}>
                {mobile ? (
                    <>
                        <AttendanceTabs active="discipline" mobile />
                        <div className="flex flex-col gap-1 px-1">
                            <p className="text-overline text-link">
                                {props.filters.period.label}
                            </p>
                            <p className="text-meta text-text-muted">
                                {props.scope.label} · {props.scope.member_count}{' '}
                                orang
                            </p>
                        </div>
                        <FilterBar
                            filters={props.filters}
                            exportUrl={props.exportUrl}
                            presets={['minggu', 'bulan']}
                            withScope={false}
                            className="[&>a]:hidden [&>div]:w-full"
                        />
                    </>
                ) : (
                    <>
                        <header className="flex flex-col gap-2">
                            <p className="text-overline text-link">
                                {props.filters.period.label}
                            </p>
                            <h1 className="text-display text-text">
                                Kedisiplinan
                            </h1>
                            <p className="text-body-lg text-text-muted">
                                {props.scope.label} · {props.scope.member_count}{' '}
                                karyawan aktif
                            </p>
                        </header>
                        <AttendanceTabs active="discipline" />
                        <FilterBar
                            filters={props.filters}
                            exportUrl={props.exportUrl}
                        />
                    </>
                )}

                <section
                    aria-label="Ringkasan periode"
                    className={cn(
                        'grid gap-5',
                        mobile
                            ? 'grid-cols-2 gap-2.5'
                            : 'md:grid-cols-2 xl:grid-cols-3',
                    )}
                >
                    {report ? (
                        <Kpis report={report} props={props} compact={mobile} />
                    ) : (
                        Array.from({ length: 6 }, (_, index) => (
                            <KpiSkeleton key={index} />
                        ))
                    )}
                </section>
                {report && <ComparedNote compared={report.compared} />}
                {trend}
                {peoplePanel}
            </div>
        </>
    );
}

AttendanceDiscipline.layout = {
    breadcrumbs: [
        { title: 'Absensi', href: '/absensi/hari-ini' },
        { title: 'Kedisiplinan', href: '/absensi/kedisiplinan' },
    ],
    title: 'Kedisiplinan',
    back: '/menu',
};
