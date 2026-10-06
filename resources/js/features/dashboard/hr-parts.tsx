import { KpiBar } from '@/components/ui/kpi-card';
import type { TodayCounts } from '@/types/dashboard';
import { MetricKpi } from './dashboard-ui';
import { awayBreakdown, share } from './lib';

/** Phone KPI tile. */
const TILE = 'gap-0.5 rounded-card px-4 py-3.5 shadow-none';

/**
 * Today KPIs (DHR "Ringkasan"): present now on the highlight card with a
 * white progress bar, then late, not checked in and away.
 */
export function HrTodayKpis({
    attendance,
    compact = false,
}: {
    attendance: { counts: TodayCounts };
    compact?: boolean;
}) {
    const { counts } = attendance;
    const rate = Math.round(share(counts.present, counts.scheduled));
    const card = compact ? TILE : undefined;

    return (
        <>
            <MetricKpi
                tone="highlight"
                label="Hadir sekarang"
                value={String(counts.present)}
                suffix={`/ ${counts.scheduled}`}
                note={`${rate}% dari yang terjadwal · termasuk ${counts.late} terlambat`}
                className={compact ? 'col-span-2' : 'flex-[1.3_1_260px]'}
                cardClassName={card}
                bar={
                    <KpiBar
                        value={rate}
                        label="Hadir dari yang terjadwal"
                        className={compact ? 'my-1' : undefined}
                    />
                }
            />
            <MetricKpi
                label="Terlambat"
                definition="Sudah check-in hari ini setelah batas toleransi shift."
                value={String(counts.late)}
                valueClassName={counts.late > 0 ? 'text-warning' : undefined}
                note={`dari ${counts.present} yang hadir`}
                className={compact ? undefined : 'flex-[1_1_200px]'}
                cardClassName={card}
            />
            <MetricKpi
                label="Belum check-in"
                definition="Terjadwal hari ini tetapi belum check-in. Pengingat otomatis dikirim 15 menit setelah jam masuk."
                value={String(counts.not_checked_in)}
                note={
                    counts.absent > 0
                        ? `${counts.absent} alpha`
                        : compact
                          ? 'pengingat otomatis aktif'
                          : 'pengingat otomatis 15 menit setelah jam masuk'
                }
                className={compact ? undefined : 'flex-[1_1_200px]'}
                cardClassName={card}
            />
            <MetricKpi
                label={compact ? 'Cuti/izin/sakit' : 'Cuti / izin / sakit'}
                definition="Tidak masuk karena pengajuan yang disetujui (cuti, izin, sakit, dinas)."
                value={String(counts.away)}
                valueClassName="text-info"
                note={awayBreakdown(counts)}
                className={compact ? 'col-span-2' : 'flex-[1_1_200px]'}
                cardClassName={card}
            />
        </>
    );
}
