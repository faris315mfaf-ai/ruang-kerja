import { Link, usePage } from '@inertiajs/react';
import { CalendarDays, Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel, PanelLink } from '@/components/ui/panel';
import { useTaskComposer } from '@/features/tasks/form/task-composer';
import { formatLongDate, formatNumber } from '@/lib/format';
import { formatShortDate } from '@/lib/requests';
import { ComparedNote } from './compared-note';
import {
    KpiSkeleton,
    MetricKpi,
    PageHeader,
    PanelHint,
    PanelSkeleton,
} from './dashboard-ui';
import { FilterBar } from './filter-bar';
import { compared, formatMetric, greeting, periodNoun } from './lib';
import { MyAttendanceCard } from './my-attendance-card';
import { AttendanceStrip, FocusList, WeekStrip } from './personal-parts';
import type { PersonalProps } from './personal-types';
import { RequestRows } from './request-rows';
import { ViewPicker } from './view-picker';

/** "Staf Data · atasan Dimas Pratama". */
export function profileLine(profile: PersonalProps['live']['profile']): string {
    return [
        profile.position,
        profile.manager ? `atasan ${profile.manager}` : null,
    ]
        .filter(Boolean)
        .join(' · ');
}

/** Dashboard Saya, desktop & tablet (design SBeranda). */
export function PersonalDesktop(props: PersonalProps) {
    const { auth } = usePage().props;
    const composer = useTaskComposer();
    const { metrics, live, definitions, filters } = props;
    const previous = props.filters.period.previous_label;
    const firstName = auth.user?.name.split(' ')[0] ?? '';
    const open = metrics?.kpis.open_tasks;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                overline={formatLongDate(props.today)}
                title={`${greeting()}, ${firstName}`}
                subtitle={profileLine(live.profile) || undefined}
            >
                <ViewPicker views={props.views} />
            </PageHeader>

            <section
                aria-label="Hari ini"
                className="flex flex-wrap items-stretch gap-5"
            >
                <MyAttendanceCard className="flex-[1.4_1_420px]" />
                <MetricKpi
                    href="/pengajuan"
                    linkLabel={
                        live.leave_balance
                            ? `Saldo cuti ${formatNumber(live.leave_balance.remaining)} hari, buka pengajuan saya`
                            : 'Saldo cuti belum ada, buka pengajuan saya'
                    }
                    label="Saldo cuti tahunan"
                    definition="Sisa cuti tahunan setelah cuti yang disetujui."
                    value={
                        live.leave_balance
                            ? formatNumber(live.leave_balance.remaining)
                            : '–'
                    }
                    suffix={live.leave_balance ? 'hari' : undefined}
                    note={
                        live.leave_balance
                            ? `${live.leave_balance.type.toLowerCase()} · berlaku s.d. 31 Des ${live.leave_balance.year}`
                            : 'belum ada saldo'
                    }
                    className="flex-[1_1_220px]"
                />
                {open ? (
                    <MetricKpi
                        href="/tugas"
                        linkLabel={`${formatNumber(open.value)} tugas terbuka${open.overdue > 0 ? `, ${open.overdue} terlambat` : ''}, buka tugas saya`}
                        label="Tugas terbuka"
                        definition="Tugas Anda yang belum Selesai atau Dibatalkan."
                        value={formatNumber(open.value)}
                        note={
                            open.overdue > 0 ? (
                                <b className="text-danger">
                                    {open.overdue} terlambat
                                </b>
                            ) : (
                                'tidak ada yang terlambat'
                            )
                        }
                        className="flex-[1_1_220px]"
                    />
                ) : (
                    <KpiSkeleton className="flex-[1_1_220px]" />
                )}
            </section>

            <section
                aria-label="Filter periode"
                className="flex flex-wrap items-center justify-between gap-3"
            >
                <FilterBar
                    filters={filters}
                    exportUrl={props.exportUrl}
                    withScope={false}
                />
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                        <Link href="/pengajuan/baru?kategori=leave">
                            <CalendarDays aria-hidden />
                            Ajukan cuti
                        </Link>
                    </Button>
                    <Button onClick={() => composer.openCreate()}>
                        <Plus aria-hidden />
                        Tugas baru
                    </Button>
                </div>
            </section>

            <section
                aria-label="Kinerja periode"
                className="flex flex-col gap-3"
            >
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {metrics ? (
                        <>
                            <MetricKpi
                                label={`Selesai ${periodNoun(filters.period.preset)}`}
                                definition="Tugas Anda yang masuk kategori Selesai dalam periode, termasuk subtugas."
                                value={formatNumber(
                                    metrics.kpis.completed.value ?? 0,
                                )}
                                delta={compared(
                                    metrics.kpis.completed,
                                    'count',
                                    previous,
                                )}
                                note={`sejak ${formatShortDate(metrics.compared.current.from)}`}
                            />
                            <MetricKpi
                                label="Ketepatan waktu saya"
                                definition={definitions.on_time_rate}
                                value={formatMetric(
                                    metrics.kpis.on_time_rate.value,
                                    'percent',
                                )}
                                delta={compared(
                                    metrics.kpis.on_time_rate,
                                    'percent',
                                    previous,
                                )}
                                note={
                                    metrics.kpis.on_time_rate.denominator > 0
                                        ? `${metrics.kpis.on_time_rate.numerator} dari ${metrics.kpis.on_time_rate.denominator} tepat tenggat`
                                        : 'belum ada tugas bertenggat yang selesai'
                                }
                            />
                            <MetricKpi
                                label="Kedisiplinan hadir"
                                definition={definitions.attendance_discipline}
                                value={formatMetric(
                                    metrics.attendance.attendance_discipline
                                        .value,
                                    'percent',
                                )}
                                delta={compared(
                                    metrics.attendance.attendance_discipline,
                                    'percent',
                                    previous,
                                )}
                            />
                            <MetricKpi
                                label="Rata-rata terlambat"
                                definition={definitions.average_lateness}
                                value={formatMetric(
                                    metrics.attendance.average_lateness.value,
                                    'minutes',
                                )}
                                delta={compared(
                                    metrics.attendance.average_lateness,
                                    'minutes',
                                    previous,
                                    'lower',
                                )}
                            />
                        </>
                    ) : (
                        Array.from({ length: 4 }, (_, index) => (
                            <KpiSkeleton key={index} />
                        ))
                    )}
                </div>
                {metrics && <ComparedNote compared={metrics.compared} />}
            </section>

            <section className="flex flex-wrap items-start gap-5">
                <div className="flex min-w-0 flex-[2_1_620px] flex-col gap-5">
                    <Panel
                        title="Fokus hari ini"
                        action={
                            <PanelLink
                                href="/tugas"
                                label={`Semua tugas (${live.focus.total} terbuka)`}
                            >
                                Semua tugas
                            </PanelLink>
                        }
                        flush
                        className="pb-2"
                    >
                        <FocusList
                            items={live.focus.items}
                            today={props.today}
                        />
                    </Panel>
                    <Panel
                        title="Minggu ini"
                        action={
                            <PanelHint>
                                {live.week.total} tugas bertenggat
                            </PanelHint>
                        }
                    >
                        <WeekStrip week={live.week} />
                    </Panel>
                </div>

                <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-5">
                    <Panel
                        title="Pengajuan saya"
                        action={
                            <PanelLink href="/pengajuan/baru">Ajukan</PanelLink>
                        }
                        flush
                        className="pb-3"
                    >
                        <RequestRows items={live.requests} />
                        <div className="border-t border-divider px-6 pt-3 md:px-7">
                            <PanelLink href="/pengajuan">
                                Riwayat pengajuan
                            </PanelLink>
                        </div>
                    </Panel>
                    {metrics ? (
                        <Panel
                            title={`Kehadiran ${metrics.compared.current.label}`}
                            action={
                                <PanelHint>
                                    {metrics.attendance.days.workdays} hari
                                    kerja
                                </PanelHint>
                            }
                        >
                            <AttendanceStrip days={metrics.attendance.days} />
                        </Panel>
                    ) : (
                        <PanelSkeleton title="Kehadiran" rows={3} />
                    )}
                </div>
            </section>

            <p className="flex items-center gap-2 text-meta text-text-muted">
                <ShieldCheck className="size-4 shrink-0" aria-hidden />
                Data ini hanya terlihat oleh Anda, atasan langsung, dan HR.
            </p>
        </div>
    );
}
