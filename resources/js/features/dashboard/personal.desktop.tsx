import { Link, usePage } from '@inertiajs/react';
import { CalendarDays, Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { BriefingCard } from '@/features/briefings/briefing-card';
import { LatestBriefingCard } from '@/features/briefings/latest-briefing-card';
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
import { AttendanceStrip } from './personal-parts';
import type { PersonalProps } from './personal-types';
import { TugasHariIniCard } from './tugas-hari-ini/tugas-hari-ini';
import { ViewPicker } from './view-picker';
import { QuickMinutesButton } from '@/features/notes/quick-minutes-button';

/** "Staf Data · atasan Dimas Pratama". */
export function profileLine(profile: PersonalProps['live']['profile']): string {
    return [
        profile.position,
        profile.manager ? `atasan ${profile.manager}` : null,
    ]
        .filter(Boolean)
        .join(' · ');
}

/**
 * Dashboard Saya, desktop & tablet (design SBeranda). Kartu utama: absensi
 * hari ini dan "Tugas hari ini" pribadi · tim · semua (keputusan pemilik
 * 9 Okt 2026 — kartu laporan harian, KPI saldo cuti/tugas terbuka/tepat
 * waktu dan kartu pengajuan digantikan kartu tersebut).
 */
export function PersonalDesktop(props: PersonalProps) {
    const { auth } = usePage().props;
    const composer = useTaskComposer();
    const { metrics, live, definitions, filters } = props;
    const previous = props.filters.period.previous_label;
    const firstName = auth.user?.name.split(' ')[0] ?? '';

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                overline={formatLongDate(props.today)}
                title={`${greeting()}, ${firstName}`}
                subtitle={profileLine(live.profile) || undefined}
            >
                <QuickMinutesButton />
                <ViewPicker views={props.views} />
            </PageHeader>

            <section
                aria-label="Hari ini"
                className="flex flex-wrap items-stretch gap-5"
            >
                <MyAttendanceCard className="flex-[1.4_1_420px]" />
            </section>

            {/* Kartu "Catat briefing" (keputusan pemilik 9 Okt 2026): hanya
                untuk pencatat (HR/Super Admin/delegasi) selama jendela aktif. */}
            <BriefingCard briefing={props.briefing} variant="desktop" />

            <TugasHariIniCard tugas={props.tugasHariIni} variant="desktop" />

            {/* Cuplikan briefing terakhir untuk semua penampil dashboard. */}
            <LatestBriefingCard briefing={props.briefing} variant="desktop" />

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
                        <Link href="/pengajuan/baru">
                            <CalendarDays aria-hidden />
                            Buat pengajuan
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
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
                        Array.from({ length: 3 }, (_, index) => (
                            <KpiSkeleton key={index} />
                        ))
                    )}
                </div>
                {metrics && <ComparedNote compared={metrics.compared} />}
            </section>

            <section className="flex flex-wrap items-start gap-5">
                {metrics ? (
                    <Panel
                        title={`Kehadiran ${metrics.compared.current.label}`}
                        action={
                            <PanelHint>
                                {metrics.attendance.days.workdays} hari kerja
                            </PanelHint>
                        }
                        className="min-w-0 flex-[1_1_420px]"
                    >
                        <AttendanceStrip days={metrics.attendance.days} />
                    </Panel>
                ) : (
                    <PanelSkeleton
                        title="Kehadiran"
                        rows={3}
                        className="min-w-0 flex-[1_1_420px]"
                    />
                )}
            </section>

            <p className="flex items-center gap-2 text-meta text-text-muted">
                <ShieldCheck className="size-4 shrink-0" aria-hidden />
                Data ini hanya terlihat oleh Anda, atasan langsung, dan HR.
            </p>
        </div>
    );
}
