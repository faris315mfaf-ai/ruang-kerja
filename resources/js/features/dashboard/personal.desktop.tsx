import { Link, usePage } from '@inertiajs/react';
import { CalendarDays, Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTaskComposer } from '@/features/tasks/form/task-composer';
import { formatDate, formatNumber } from '@/lib/format';
import { formatShortDate } from '@/lib/requests';
import type { PersonalProps } from './personal-types';
import { ComparedNote } from './compared-note';
import { compared, formatMetric, periodNoun } from './lib';
import { MyAttendanceCard } from './my-attendance-card';
import { Panel, PanelSkeleton } from './panel';
import { AttendanceStrip, FocusList, WeekStrip } from './personal-parts';
import { RequestRows } from './request-rows';
import { StatCard, StatCardSkeleton } from './stat-card';
import { FilterBar } from './filter-bar';
import { ViewPicker } from './view-picker';

export function greeting(now: Date = new Date()): string {
    const hour = Number(
        new Intl.DateTimeFormat('id-ID', {
            hour: 'numeric',
            hourCycle: 'h23',
            timeZone: 'Asia/Jakarta',
        }).format(now),
    );

    if (hour < 11) {
        return 'Selamat pagi';
    }

    if (hour < 15) {
        return 'Selamat siang';
    }

    return hour < 19 ? 'Selamat sore' : 'Selamat malam';
}

/** Dashboard Saya, desktop & tablet (mockup DashboardSaya). */
export function PersonalDesktop(props: PersonalProps) {
    const { auth } = usePage().props;
    const composer = useTaskComposer();
    const { metrics, live, definitions, filters } = props;
    const previous = props.filters.period.previous_label;
    const firstName = auth.user?.name.split(' ')[0] ?? '';

    return (
        <div className="mx-auto max-w-[1200px] space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl leading-8 font-semibold text-text">
                        {greeting()}, {firstName}
                    </h1>
                    <p className="text-sm text-text-muted">
                        {[
                            formatDate(new Date()),
                            live.profile.position,
                            live.profile.manager
                                ? `atasan langsung ${live.profile.manager}`
                                : null,
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </p>
                </div>
                <div className="flex gap-2">
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
            </header>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <ViewPicker views={props.views} />
                <FilterBar
                    filters={filters}
                    exportUrl={props.exportUrl}
                    withScope={false}
                    className="ml-auto"
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <MyAttendanceCard className="md:col-span-2 xl:col-span-2" />
                {metrics ? (
                    <>
                        <StatCard
                            label="Tugas terbuka"
                            definition="Tugas Anda yang belum Selesai atau Dibatalkan."
                            value={formatNumber(metrics.kpis.open_tasks.value)}
                            caption={
                                metrics.kpis.open_tasks.overdue > 0 ? (
                                    <span className="text-danger">
                                        {metrics.kpis.open_tasks.overdue}{' '}
                                        terlambat
                                    </span>
                                ) : (
                                    'tidak ada yang terlambat'
                                )
                            }
                        />
                        <StatCard
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
                            caption={`sejak ${formatShortDate(metrics.compared.current.from)}`}
                        />
                        <StatCard
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
                            caption={
                                metrics.kpis.on_time_rate.denominator > 0
                                    ? `${metrics.kpis.on_time_rate.numerator} dari ${metrics.kpis.on_time_rate.denominator} tepat tenggat`
                                    : 'belum ada tugas bertenggat yang selesai'
                            }
                        />
                        <StatCard
                            label="Saldo cuti"
                            definition="Sisa cuti tahunan setelah cuti yang disetujui."
                            value={
                                live.leave_balance
                                    ? formatNumber(live.leave_balance.remaining)
                                    : '–'
                            }
                            suffix={live.leave_balance ? 'hari' : undefined}
                            caption={
                                live.leave_balance
                                    ? `${live.leave_balance.type.toLowerCase()} · berlaku s.d. 31 Des`
                                    : 'belum ada saldo'
                            }
                        />
                    </>
                ) : (
                    Array.from({ length: 4 }, (_, index) => (
                        <StatCardSkeleton key={index} />
                    ))
                )}
            </div>

            {metrics && <ComparedNote compared={metrics.compared} />}

            <div className="grid gap-4 xl:grid-cols-12">
                {metrics ? (
                    <>
                        <Panel
                            id="focus"
                            title="Fokus hari ini"
                            aside="terlambat dulu, lalu tenggat terdekat"
                            className="xl:col-span-7"
                            flush
                        >
                            <FocusList
                                items={metrics.focus.items}
                                today={props.today}
                            />
                            {metrics.focus.total > 0 && (
                                <Link
                                    href="/tugas"
                                    className="mx-4 mt-2 inline-flex min-h-9 items-center text-[13px] text-primary hover:underline"
                                >
                                    Lihat {metrics.focus.total} tugas terbuka →
                                </Link>
                            )}
                        </Panel>
                        <Panel
                            id="week"
                            title="Minggu ini"
                            aside={`${metrics.week.total} tugas bertenggat`}
                            className="xl:col-span-5"
                        >
                            <WeekStrip week={metrics.week} />
                        </Panel>
                    </>
                ) : (
                    <>
                        <PanelSkeleton className="xl:col-span-7" />
                        <PanelSkeleton className="xl:col-span-5" />
                    </>
                )}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <Panel
                    id="my-requests"
                    title="Pengajuan saya"
                    aside={
                        <Link
                            href="/pengajuan"
                            className="text-primary hover:underline"
                        >
                            Semua pengajuan →
                        </Link>
                    }
                    flush
                >
                    <RequestRows items={live.requests} />
                </Panel>
                {metrics ? (
                    <Panel
                        id="my-attendance-period"
                        title={<>Kehadiran {metrics.compared.current.label}</>}
                        aside={`${metrics.attendance.days.workdays} hari kerja`}
                    >
                        <AttendanceStrip days={metrics.attendance.days} />
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <StatCard
                                compact
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
                            <StatCard
                                compact
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
                        </div>
                    </Panel>
                ) : (
                    <PanelSkeleton />
                )}
            </div>

            <p className="flex items-center gap-2 text-[13px] text-text-muted">
                <ShieldCheck className="size-4" aria-hidden />
                Data ini hanya terlihat oleh Anda, atasan langsung, dan HR.
            </p>
        </div>
    );
}
