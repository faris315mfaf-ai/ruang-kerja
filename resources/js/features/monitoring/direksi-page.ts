import type { MonitoredReport } from './types';
import type { DireksiProps } from './types';
import type { useMonitoringQuery } from './use-monitoring-query';

/** What the page hands to the desktop and phone layouts. */
export type DireksiViewProps = {
    props: DireksiProps;
    query: ReturnType<typeof useMonitoringQuery>;
    /** Report already on the page (shown at once, refreshed from the server). */
    openReport: (report: MonitoredReport) => void;
    /** Report known by id only (weekly matrix, blockers). */
    openReportId: (id: string) => void;
};

export type MobileTab = 'harian' | 'mingguan' | 'proyek' | 'catatan';

export const MOBILE_TABS: { value: MobileTab; label: string }[] = [
    { value: 'harian', label: 'Harian' },
    { value: 'mingguan', label: 'Mingguan' },
    { value: 'proyek', label: 'Proyek' },
    { value: 'catatan', label: 'Catatan' },
];
