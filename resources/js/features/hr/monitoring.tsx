import { router } from '@inertiajs/react';
import { BellRing, ClipboardList, PartyPopper } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { SegmentedTabs } from '@/components/ui/tabs';
import { WorkloadPanel } from '@/features/management/workload-panel';
import { DateStepper, ReportCard } from '@/features/monitoring/daily-panel';
import { percentOf } from '@/features/monitoring/lib';
import {
    ReportDetailSheet,
    useReportDetail,
} from '@/features/monitoring/report-detail';
import type { DailyMonitoring } from '@/features/monitoring/types';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { remind } from '@/routes/hr/monitoring';
import { HubShell } from './hub-shell';
import { Legend, SplitBar } from './parts';
import type { HrMonitoringProps, MonitoringView } from './types';

const ALL = '__all';
const REPORTS_SHOWN = 8;
const MISSING_SHOWN = 8;

/** Daily data narrowed to one division (client-side). */
export function filterDaily(
    daily: DailyMonitoring,
    division: string,
): DailyMonitoring {
    if (division === ALL) {
        return daily;
    }

    const name = (value: string | null) =>
        (value ?? 'Tanpa divisi') === division;

    return {
        ...daily,
        divisions: daily.divisions.filter((item) => item.name === division),
        missing: daily.missing.filter((person) => name(person.division)),
        reports: daily.reports.filter((report) => name(report.user.division)),
    };
}

function useRemind() {
    const [pending, setPending] = useState<string | null>(null);

    const send = (
        target: { all: true } | { user_ids: string[] },
        key: string,
    ) =>
        router.post(remind.url(), target, {
            preserveScroll: true,
            preserveState: true,
            only: ['monitoring'],
            onStart: () => setPending(key),
            onFinish: () => setPending(null),
        });

    return { pending, send };
}

function DivisionsCard({
    daily,
    canRemind,
}: {
    daily: DailyMonitoring;
    canRemind: boolean;
}) {
    const { pending, send } = useRemind();
    const [allMissing, setAllMissing] = useState(false);
    const missing = allMissing
        ? daily.missing
        : daily.missing.slice(0, MISSING_SHOWN);

    return (
        <Panel title="Per divisi" bodyClassName="gap-5">
            <div className="flex flex-wrap gap-4 text-meta text-text-muted">
                <Legend className="bg-fill-teal">Sudah lapor</Legend>
                <Legend className="bg-accent-blue">Draf</Legend>
                <Legend className="border border-border bg-surface-2">
                    Belum
                </Legend>
            </div>
            {daily.divisions.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={ClipboardList}
                    title="Tidak ada yang terjadwal"
                />
            ) : (
                <ul className="flex flex-col gap-3.5">
                    {daily.divisions.map((division) => {
                        const total = Math.max(
                            division.scheduled,
                            division.reported + division.draft,
                        );

                        return (
                            <li key={division.id ?? 'none'}>
                                <div className="flex items-baseline justify-between gap-3 text-[15px]">
                                    <span className="truncate font-semibold">
                                        {division.name}
                                    </span>
                                    <span className="shrink-0 font-mono text-[14px] tnum">
                                        {division.reported} /{' '}
                                        {division.scheduled}
                                    </span>
                                </div>
                                <SplitBar
                                    className="mt-1.5"
                                    total={total}
                                    label={`${division.name}: ${division.reported} sudah lapor (${percentOf(division.reported, total)}%), ${division.draft} draf, ${division.missing} belum`}
                                    parts={[
                                        {
                                            value: division.reported,
                                            className: 'bg-fill-teal',
                                        },
                                        {
                                            value: division.draft,
                                            className: 'bg-accent-blue',
                                        },
                                    ]}
                                />
                            </li>
                        );
                    })}
                </ul>
            )}

            <section aria-label="Belum lapor" className="flex flex-col">
                <div className="flex min-h-control items-center justify-between gap-3 border-t border-divider pt-3">
                    <h3 className="text-label">
                        Belum lapor ({daily.missing.length})
                    </h3>
                    {canRemind && daily.missing.length > 0 && (
                        <Button
                            type="button"
                            variant="quiet"
                            size="sm"
                            disabled={pending !== null}
                            onClick={() => send({ all: true }, ALL)}
                        >
                            {pending === ALL ? (
                                <Spinner />
                            ) : (
                                <BellRing aria-hidden />
                            )}
                            Ingatkan semua
                        </Button>
                    )}
                </div>
                {daily.missing.length === 0 ? (
                    <EmptyState
                        size="sm"
                        icon={PartyPopper}
                        title="Semua yang terjadwal sudah lapor"
                    />
                ) : (
                    <ul className="flex flex-col">
                        {missing.map((person) => (
                            <li
                                key={person.id}
                                className="flex min-h-15 items-center gap-3 border-t border-divider py-2 first:border-t-0"
                            >
                                <UserAvatar
                                    name={person.name}
                                    src={person.avatar}
                                    className="size-9 text-[13px]"
                                />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-[16px] font-semibold">
                                        {person.name}
                                    </span>
                                    <span className="truncate text-meta text-text-muted">
                                        {person.division ?? 'Tanpa divisi'} ·{' '}
                                        {person.draft
                                            ? 'draf belum dikirim'
                                            : 'belum ada draf'}
                                    </span>
                                </span>
                                {person.draft && (
                                    <Badge
                                        variant="status"
                                        tone="warning"
                                        className="h-6 px-2 text-[12px]"
                                    >
                                        Draf
                                    </Badge>
                                )}
                                {canRemind && (
                                    <Button
                                        type="button"
                                        variant="quiet"
                                        size="sm"
                                        className="min-h-control"
                                        disabled={pending !== null}
                                        aria-label={`Ingatkan ${person.name}`}
                                        onClick={() =>
                                            send(
                                                { user_ids: [person.id] },
                                                person.id,
                                            )
                                        }
                                    >
                                        {pending === person.id && <Spinner />}
                                        Ingatkan
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
                {daily.missing.length > MISSING_SHOWN && (
                    <Button
                        type="button"
                        variant="quiet"
                        className="self-start"
                        aria-expanded={allMissing}
                        onClick={() => setAllMissing((value) => !value)}
                    >
                        {allMissing
                            ? 'Tampilkan lebih sedikit'
                            : `Lihat semua ${daily.missing.length} orang`}
                    </Button>
                )}
                {!canRemind && daily.missing.length > 0 && (
                    <p className="mt-2 text-meta text-text-muted">
                        Pengingat hanya bisa dikirim untuk laporan hari ini.
                    </p>
                )}
            </section>
        </Panel>
    );
}

function ReportsCard({
    daily,
    onOpen,
}: {
    daily: DailyMonitoring;
    onOpen: (id: string) => void;
}) {
    const [all, setAll] = useState(false);
    const shown = all ? daily.reports : daily.reports.slice(0, REPORTS_SHOWN);

    return (
        <Panel
            title="Laporan masuk"
            action={
                <span className="text-meta text-text-muted">
                    {daily.reports.length} laporan · terbaru di atas
                </span>
            }
        >
            {daily.reports.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={ClipboardList}
                    title="Belum ada laporan"
                >
                    Laporan progres yang dikirim karyawan pada{' '}
                    {formatDate(daily.date)} tampil di sini.
                </EmptyState>
            ) : (
                <>
                    <ul className="flex flex-col">
                        {shown.map((report) => (
                            <ReportCard
                                key={report.id}
                                report={report}
                                onOpen={() => onOpen(report.id)}
                            />
                        ))}
                    </ul>
                    {daily.reports.length > REPORTS_SHOWN && (
                        <Button
                            type="button"
                            variant="quiet"
                            className="self-start"
                            aria-expanded={all}
                            onClick={() => setAll((value) => !value)}
                        >
                            {all
                                ? 'Tampilkan lebih sedikit'
                                : `Muat ${daily.reports.length - REPORTS_SHOWN} laporan lainnya`}
                        </Button>
                    )}
                </>
            )}
        </Panel>
    );
}

/** Ruang HR › Monitoring: daily reports (with reminders) and workload. */
export function HrMonitoring({
    props,
    mobile,
}: {
    props: HrMonitoringProps;
    mobile: boolean;
}) {
    const { hub, monitoring } = props;
    const [view, setView] = useState<MonitoringView>(monitoring.view);
    const [division, setDivision] = useState(ALL);
    const [loading, setLoading] = useState(false);
    const detail = useReportDetail();

    const query = (changes: { tanggal?: string; tampil?: MonitoringView }) => {
        const next: Record<string, string> = {
            tanggal: changes.tanggal ?? monitoring.date,
            tampil: changes.tampil ?? view,
        };

        if (next.tanggal === monitoring.today) {
            delete next.tanggal;
        }

        if (next.tampil === 'laporan') {
            delete next.tampil;
        }

        return next;
    };

    const changeView = (value: MonitoringView) => {
        setView(value);
        // URL only: both deferred blocks are already on the page.
        router.get(window.location.pathname, query({ tampil: value }), {
            only: ['monitoring'],
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const changeDate = (date: string) =>
        router.get(window.location.pathname, query({ tanggal: date }), {
            only: ['daily', 'monitoring'],
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onStart: () => setLoading(true),
            onFinish: () => setLoading(false),
        });

    const daily = props.daily ? filterDaily(props.daily, division) : undefined;
    const divisions = props.daily?.divisions.map((item) => item.name) ?? [];

    return (
        <HubShell hub={hub} title="Monitoring · Ruang HR" mobile={mobile}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <SegmentedTabs
                    label="Jenis monitoring"
                    value={view}
                    onValueChange={changeView}
                    className={cn(mobile && 'w-full [&>button]:flex-1')}
                    options={[
                        { value: 'laporan', label: 'Laporan harian' },
                        { value: 'beban', label: 'Beban kerja' },
                    ]}
                />
                {view === 'laporan' && (
                    <div className="flex flex-wrap items-center gap-3">
                        <DateStepper
                            date={monitoring.date}
                            today={monitoring.today}
                            onChange={changeDate}
                            loading={loading}
                        />
                        {divisions.length > 1 && (
                            <Select
                                value={division}
                                onValueChange={setDivision}
                            >
                                <SelectTrigger
                                    aria-label="Divisi"
                                    className={cn('w-52', mobile && 'w-full')}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>
                                        Semua divisi
                                    </SelectItem>
                                    {divisions.map((name) => (
                                        <SelectItem key={name} value={name}>
                                            {name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                )}
            </div>

            {view === 'beban' ? (
                <WorkloadPanel workload={props.workload} />
            ) : !daily ? (
                <div className="grid gap-5 lg:grid-cols-2" aria-busy>
                    <Skeleton className="h-96 rounded-panel" />
                    <Skeleton className="h-96 rounded-panel" />
                </div>
            ) : (
                <div
                    className={cn(
                        'grid items-start gap-4 transition-opacity duration-120 ease-brand md:gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]',
                        loading && 'opacity-60',
                    )}
                >
                    <DivisionsCard
                        daily={daily}
                        canRemind={monitoring.can_remind}
                    />
                    <ReportsCard
                        daily={daily}
                        onOpen={(id) =>
                            detail.open(
                                id,
                                daily.reports.find(
                                    (report) => report.id === id,
                                ),
                            )
                        }
                    />
                </div>
            )}

            <ReportDetailSheet
                state={detail.state}
                onClose={detail.close}
                mobile={mobile}
            />
        </HubShell>
    );
}
