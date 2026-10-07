import { formatDayDate, formatNumber } from '@/lib/format';
import { OrgChartCanvas } from './org-chart-desktop';
import type { OrgChart } from './types';

export type ChartExportSheetProps = {
    /** The chart as filtered on screen (search), already made printable. */
    chart: OrgChart;
    /** Active search, printed under the date so readers know it is partial. */
    query: string;
    now: Date;
};

/**
 * What the PNG shows: a header (company, title, date) above the whole chart,
 * every team opened. Rendered off-screen by `exportChartPng`, always in the
 * light theme at desktop type sizes.
 */
export function ChartExportSheet({ chart, query, now }: ChartExportSheetProps) {
    const stats = [
        `${formatNumber(chart.stats.divisions)} divisi`,
        `${formatNumber(chart.stats.teams)} tim`,
        `${formatNumber(chart.stats.people)} orang`,
    ].join(' · ');
    const search = query.trim();

    return (
        // Paper has no hover: long names wrap instead of being truncated.
        <div className="flex w-max min-w-[720px] flex-col gap-10 bg-surface p-12 font-sans text-body text-text [&_.truncate]:overflow-visible [&_.truncate]:text-clip [&_.truncate]:whitespace-normal">
            <header className="flex items-end justify-between gap-16 border-b border-border pb-6">
                <div className="flex flex-col gap-1.5">
                    <p className="text-label font-semibold text-link">
                        {chart.companyName}
                    </p>
                    <h1 className="text-display">Struktur organisasi</h1>
                    <p className="text-body-lg text-text-muted">{stats}</p>
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                    <p className="text-label font-semibold text-text">
                        {formatDayDate(now)}
                    </p>
                    {search !== '' && (
                        <p className="text-meta text-text-muted">
                            Hasil pencarian “{search}”
                        </p>
                    )}
                </div>
            </header>

            <div className="mx-auto">
                <OrgChartCanvas
                    chart={chart}
                    viewerId={null}
                    viewerDivisionId={null}
                    expandAll
                    printable
                />
            </div>

            <footer className="text-meta text-text-muted">
                Dibuat otomatis dari data divisi, tim, dan atasan langsung di
                RuangKerja.
            </footer>
        </div>
    );
}
