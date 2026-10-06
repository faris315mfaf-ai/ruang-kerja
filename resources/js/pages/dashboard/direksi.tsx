import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { DireksiDesktop } from '@/features/monitoring/direksi.desktop';
import { DireksiMobile } from '@/features/monitoring/direksi.mobile';
import {
    ReportDetailSheet,
    useReportDetail,
} from '@/features/monitoring/report-detail';
import type {
    DireksiProps,
    MonitoredReport,
} from '@/features/monitoring/types';
import { useMonitoringQuery } from '@/features/monitoring/use-monitoring-query';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * Dashboard Direksi (keputusan pemilik 6 Okt 2026): monitoring kerja harian,
 * mingguan dan per proyek dari laporan progres harian, catatan tindakan,
 * dan akses cepat (baca saja) ke semua workspace.
 */
export default function DireksiDashboard(props: DireksiProps) {
    const breakpoint = useBreakpoint();
    const query = useMonitoringQuery(props.monitoring);
    const detail = useReportDetail();
    const mobile = breakpoint === 'mobile';
    const view = {
        props,
        query,
        openReport: (report: MonitoredReport) => detail.open(report.id, report),
        openReportId: (id: string) => detail.open(id),
    };

    return (
        <>
            <Head title="Dashboard Direksi" />
            {breakpoint === null ? (
                <div className="flex flex-col gap-5" aria-busy>
                    <Skeleton className="h-28 rounded-panel" />
                    <Skeleton className="h-96 rounded-panel" />
                </div>
            ) : mobile ? (
                <DireksiMobile {...view} />
            ) : (
                <DireksiDesktop {...view} />
            )}
            <ReportDetailSheet
                state={detail.state}
                onClose={detail.close}
                mobile={mobile}
            />
        </>
    );
}

DireksiDashboard.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Direksi', href: '/dashboard/direksi' },
    ],
    title: 'Dashboard',
};
