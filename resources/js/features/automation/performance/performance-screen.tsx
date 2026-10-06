import { Link } from '@inertiajs/react';
import { BarChart3, Info, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { KpiCard } from '@/components/ui/kpi-card';
import { Panel, PanelLink } from '@/components/ui/panel';
import { Progress } from '@/components/ui/progress';
import { SegmentedTabs } from '@/components/ui/tabs';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    computeMetrics,
    isEmptyPerformance,
} from '@/features/automation/performance';
import type { Metric } from '@/features/automation/performance';
import {
    WeekChart,
    WeekLegend,
} from '@/features/automation/performance/week-chart';
import {
    PreviewBar,
    PreviewError,
    PreviewSkeleton,
} from '@/features/automation/preview-state';
import type { PreviewState } from '@/features/automation/preview-state';
import type { PerformanceProps, PeriodKey } from '@/features/automation/types';
import { cn, focusRing } from '@/lib/utils';

const PERIODS: { value: PeriodKey; label: string }[] = [
    { value: '8w', label: '8 minggu' },
    { value: 'month', label: 'Bulan ini' },
    { value: 'quarter', label: 'Kuartal' },
];

const SHORT_LABELS: Record<Metric['key'], string> = {
    completion: 'Penyelesaian',
    on_time: 'Tepat waktu',
    lead_time: 'Lead time',
    attendance: 'Hadir tepat waktu',
};

const OVERDUE_DEFINITION =
    'Tugas Anda yang belum selesai dengan tenggat sebelum hari ini.';

function MetricLabel({
    label,
    definition,
}: {
    label: string;
    definition: string;
}) {
    return (
        <span className="inline-flex items-center gap-1">
            {label}
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        aria-label={`Cara menghitung ${label}`}
                        className={cn(
                            '-my-1 inline-flex size-7 items-center justify-center rounded-full text-text-subtle hover:text-text',
                            focusRing,
                        )}
                    >
                        <Info aria-hidden className="size-4" />
                    </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[280px] font-medium">
                    {definition}
                </TooltipContent>
            </Tooltip>
        </span>
    );
}

function PrivacyNote({ compact }: { compact: boolean }) {
    return (
        <section
            aria-label="Privasi"
            className={cn(
                'flex flex-wrap items-center gap-3 border border-border bg-surface md:gap-4',
                compact
                    ? 'rounded-[20px] px-4 py-3.5'
                    : 'rounded-[22px] px-6 py-5',
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'flex shrink-0 items-center justify-center bg-link-soft text-link',
                    compact
                        ? 'size-10 rounded-[12px]'
                        : 'size-12 rounded-[14px]',
                )}
            >
                <ShieldCheck className="size-6" strokeWidth={1.9} />
            </span>
            <p className="min-w-0 flex-[1_1_240px] text-[14px] leading-5 text-text md:text-body">
                {compact
                    ? 'Hanya Anda, atasan, dan HR yang melihat data ini.'
                    : 'Hanya Anda, atasan langsung, dan HR yang bisa melihat halaman ini. Tidak ada pelacakan layar atau aplikasi; lokasi hanya direkam saat check-in dan check-out.'}
            </p>
            {!compact && (
                <PanelLink href="/privasi">Data saya &amp; privasi</PanelLink>
            )}
        </section>
    );
}

function Definitions({ metrics }: { metrics: Metric[] }) {
    const items: [string, string][] = [
        ...metrics.map((m): [string, string] => [m.label, m.definition]),
        ['Terlambat sekarang', OVERDUE_DEFINITION],
    ];

    return (
        <details className="group rounded-[22px] border border-border bg-surface">
            <summary
                className={cn(
                    'flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 rounded-[22px] px-5 text-body font-semibold text-text md:px-6',
                    focusRing,
                )}
            >
                Cara menghitung metrik
                <span
                    aria-hidden
                    className="text-text-subtle transition-transform duration-180 ease-brand group-open:rotate-90"
                >
                    ›
                </span>
            </summary>
            <dl className="flex flex-col gap-3 px-5 pb-5 md:px-6">
                {items.map(([term, definition]) => (
                    <div key={term}>
                        <dt className="text-label text-text">{term}</dt>
                        <dd className="text-[15px] leading-[22px] text-text-muted">
                            {definition}
                        </dd>
                    </div>
                ))}
                <div className="rounded-lg bg-surface-2 px-4 py-3 text-[15px] leading-[22px] text-text-muted">
                    Metrik ditampilkan berdampingan dengan konteksnya. Tidak ada
                    skor produktivitas gabungan.
                </div>
            </dl>
        </details>
    );
}

export function PerformanceScreen({
    props,
    state,
    mobile,
}: {
    props: PerformanceProps;
    state: PreviewState;
    mobile: boolean;
}) {
    const [period, setPeriod] = useState<PeriodKey>('8w');
    const counts = props.periods[period];
    const metrics = computeMetrics(counts);
    const empty = state === 'empty' || isEmptyPerformance(counts, props.weeks);
    const overdue = state === 'empty' ? [] : props.overdue;
    const mobileNote = (key: Metric['key']): string => {
        switch (key) {
            case 'completion':
                return `${counts.done_of_due} dari ${counts.due}`;
            case 'on_time':
                return `${counts.on_time} dari ${counts.done_with_due}`;
            case 'lead_time':
                return metrics.find((m) => m.key === 'lead_time')?.note ?? '';
            case 'attendance':
                return counts.attendance_label;
        }
    };

    const periodTabs = (
        <SegmentedTabs
            label="Periode"
            variant={mobile ? 'soft' : 'glass'}
            value={period}
            onValueChange={setPeriod}
            options={PERIODS}
            className={cn(mobile && 'w-full [&>button]:flex-1')}
        />
    );

    const overdueCard = (
        <KpiCard
            label={
                mobile ? (
                    'Terlambat sekarang'
                ) : (
                    <MetricLabel
                        label="Terlambat sekarang"
                        definition={OVERDUE_DEFINITION}
                    />
                )
            }
            value={overdue.length}
            valueClassName={overdue.length > 0 ? 'text-danger' : 'text-success'}
            note={
                overdue.length === 0 ? (
                    'Tidak ada'
                ) : (
                    <span className="font-mono text-[14px] font-semibold">
                        {overdue.map((t) => t.key).join(' dan ')}
                    </span>
                )
            }
        />
    );

    let body: ReactNode;

    if (state === 'loading') {
        body = <PreviewSkeleton kpis={mobile ? 4 : 4} />;
    } else if (state === 'error') {
        body = <PreviewError what="Data kinerja" />;
    } else if (empty) {
        body = (
            <EmptyState
                icon={BarChart3}
                title="Belum ada data kinerja"
                description="Metrik muncul setelah Anda punya tugas bertenggat atau jadwal kerja di periode ini."
            />
        );
    } else if (mobile) {
        body = (
            <div className="flex flex-col gap-3.5">
                <div className="grid grid-cols-2 gap-2.5">
                    {metrics.map((metric, index) => (
                        <KpiCard
                            key={metric.key}
                            tone={index === 0 ? 'highlight' : 'plain'}
                            label={SHORT_LABELS[metric.key]}
                            value={metric.value}
                            note={mobileNote(metric.key)}
                            valueClassName={
                                metric.key === 'attendance'
                                    ? 'text-success'
                                    : undefined
                            }
                            className="rounded-[20px] px-4 py-4"
                        />
                    ))}
                </div>
                {overdue.length > 0 && (
                    <Link
                        href="/tugas"
                        className={cn(
                            'flex min-h-[56px] items-center justify-between gap-3 rounded-[20px] bg-danger-soft px-4 text-danger',
                            focusRing,
                        )}
                    >
                        <span className="text-body font-bold">
                            {overdue.length} tugas terlambat
                        </span>
                        <span className="font-mono text-[14px] font-semibold">
                            {overdue.map((t) => t.key).join(', ')}
                        </span>
                    </Link>
                )}
                <section className="flex flex-col gap-3 rounded-[22px] border border-border bg-surface p-4">
                    <h2 className="text-[17px] font-bold text-text">
                        Selesai per minggu
                    </h2>
                    <WeekChart weeks={props.weeks} compact />
                    <p className="text-[13px] text-text-muted">
                        Oranye = selesai lewat tenggat
                    </p>
                </section>
                <Definitions metrics={metrics} />
                <PrivacyNote compact />
            </div>
        );
    } else {
        const maxDone = Math.max(1, ...props.by_workspace.map((w) => w.done));

        body = (
            <div className="flex flex-col gap-5 lg:gap-6">
                <section
                    aria-label="Metrik"
                    className="grid grid-cols-2 gap-4 lg:grid-cols-5"
                >
                    {metrics.map((metric) => (
                        <KpiCard
                            key={metric.key}
                            label={
                                <MetricLabel
                                    label={metric.label}
                                    definition={metric.definition}
                                />
                            }
                            value={metric.value}
                            note={metric.note}
                            valueClassName={
                                metric.key === 'attendance'
                                    ? 'text-success'
                                    : undefined
                            }
                            className="rounded-[22px]"
                        />
                    ))}
                    <div className="col-span-2 lg:col-span-1 [&>section]:h-full [&>section]:rounded-[22px]">
                        {overdueCard}
                    </div>
                </section>

                <div className="flex flex-wrap items-start gap-5">
                    <Panel
                        title="Tugas selesai per minggu"
                        action={<WeekLegend />}
                        className="min-w-0 flex-[1.5_1_560px]"
                        bodyClassName="pt-2"
                    >
                        <WeekChart weeks={props.weeks} />
                    </Panel>
                    <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-5">
                        <Panel
                            title="Selesai per workspace"
                            bodyClassName="gap-3.5"
                        >
                            {props.by_workspace.map(({ workspace, done }) => (
                                <div
                                    key={workspace.id}
                                    className="grid grid-cols-[1fr_110px_32px] items-center gap-3 text-body"
                                >
                                    <span className="truncate font-semibold text-text">
                                        {workspace.name}
                                    </span>
                                    <Progress
                                        value={(done / maxDone) * 100}
                                        label={`${workspace.name}: ${done} selesai`}
                                    />
                                    <b className="text-right tnum">{done}</b>
                                </div>
                            ))}
                        </Panel>
                        <Panel
                            title={`Kehadiran · ${props.attendance.month_label}`}
                            bodyClassName="gap-3"
                        >
                            <div className="grid grid-cols-2 gap-2.5">
                                <div className="rounded-lg bg-success-soft p-3.5 text-success">
                                    <span className="block text-meta font-bold">
                                        Tepat waktu
                                    </span>
                                    <span className="text-[28px] leading-9 font-extrabold tnum">
                                        {props.attendance.on_time_rate}%
                                    </span>
                                </div>
                                <div className="rounded-lg bg-background p-3.5">
                                    <span className="block text-meta font-bold text-text-muted">
                                        Rata-rata masuk
                                    </span>
                                    <span className="text-[28px] leading-9 font-extrabold text-text tnum">
                                        {props.attendance.average_check_in}
                                    </span>
                                </div>
                            </div>
                            <PanelLink href="/absensi/riwayat">
                                Lihat riwayat absensi
                            </PanelLink>
                        </Panel>
                    </div>
                </div>
                <Definitions metrics={metrics} />
                <PrivacyNote compact={false} />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5 md:gap-6">
            <PreviewBar />
            <section className="flex flex-wrap items-end justify-between gap-5">
                <div className="flex min-w-0 flex-col gap-1 md:gap-2">
                    <h1 className="hidden text-display tracking-[-0.03em] text-text md:block">
                        Kinerja saya
                    </h1>
                    <p className="text-[15px] text-text-muted md:text-body-lg">
                        {mobile
                            ? `${counts.label} · tanpa skor gabungan`
                            : 'Berdasarkan output tugas dan kehadiran. Tidak ada skor gabungan.'}
                    </p>
                </div>
                {!mobile && (
                    <div className="flex flex-wrap items-center gap-3">
                        <nav
                            aria-label="Beranda"
                            className="inline-flex gap-1 rounded-[14px] border border-border bg-surface/70 p-1"
                        >
                            <Link
                                href="/dashboard"
                                className={cn(
                                    'inline-flex h-[38px] items-center rounded-[10px] px-[18px] text-[15px] font-semibold text-text-muted hover:text-text',
                                    focusRing,
                                )}
                            >
                                Ringkasan
                            </Link>
                            <span
                                aria-current="page"
                                className="inline-flex h-[38px] items-center rounded-[10px] bg-surface px-[18px] text-[15px] font-bold text-text shadow-segment"
                            >
                                Kinerja saya
                            </span>
                        </nav>
                        {periodTabs}
                    </div>
                )}
            </section>
            {mobile && periodTabs}
            {body}
        </div>
    );
}
