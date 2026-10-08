import { BriefingCard } from '@/features/briefings/briefing-card';
import { LatestBriefingCard } from '@/features/briefings/latest-briefing-card';
import { formatNumber } from '@/lib/format';
import { formatShortDate } from '@/lib/requests';
import { KpiSkeleton, MetricKpi } from './dashboard-ui';
import { formatMetric, periodNoun } from './lib';
import { MyAttendanceCard } from './my-attendance-card';
import type { PersonalProps } from './personal-types';
import { TugasHariIniCard } from './tugas-hari-ini/tugas-hari-ini';
import { ViewPicker } from './view-picker';
import { QuickMinutesButton } from '@/features/notes/quick-minutes-button';

/** Small phone KPI tile (MSBeranda). */
const TILE = 'gap-0.5 rounded-card px-4 py-3.5 shadow-none';

/**
 * Beranda (design MSBeranda): the shell app bar holds the greeting; then the
 * attendance hero, "Tugas hari ini" (pribadi · tim · semua, keputusan pemilik
 * 9 Okt 2026) and the KPI tiles 2×2 — the daily report card, the saldo
 * cuti/tepat waktu/tugas terbuka tiles and "Pengajuan saya" were replaced by
 * the task card.
 */
export function PersonalMobile(props: PersonalProps) {
    const { metrics, definitions } = props;

    return (
        <div className="flex flex-col gap-3.5 pb-24">
            <ViewPicker views={props.views} />
            <MyAttendanceCard compact />
            <QuickMinutesButton mobile />

            {/* Kartu "Catat briefing" (keputusan pemilik 9 Okt 2026): hanya
                untuk pencatat (HR/Super Admin/delegasi) selama jendela aktif. */}
            <BriefingCard briefing={props.briefing} variant="mobile" />

            <TugasHariIniCard tugas={props.tugasHariIni} variant="mobile" />

            {/* Cuplikan briefing terakhir untuk semua penampil dashboard. */}
            <LatestBriefingCard briefing={props.briefing} variant="mobile" />

            <section
                aria-label="Ringkasan"
                className="grid grid-cols-2 gap-2.5"
            >
                {metrics ? (
                    <>
                        <MetricKpi
                            label="Disiplin hadir"
                            definition={definitions.attendance_discipline}
                            value={formatMetric(
                                metrics.attendance.attendance_discipline.value,
                                'percent',
                            )}
                            note={periodNoun(props.filters.period.preset)}
                            cardClassName={TILE}
                        />
                        <MetricKpi
                            label={`Selesai ${periodNoun(props.filters.period.preset)}`}
                            value={formatNumber(
                                metrics.kpis.completed.value ?? 0,
                            )}
                            note={`sejak ${formatShortDate(metrics.compared.current.from)}`}
                            cardClassName={TILE}
                        />
                    </>
                ) : (
                    Array.from({ length: 2 }, (_, index) => (
                        <KpiSkeleton key={index} className={TILE} />
                    ))
                )}
            </section>
        </div>
    );
}
