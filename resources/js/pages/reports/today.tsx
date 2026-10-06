import { Head } from '@inertiajs/react';
import { ReportForm } from '@/features/reports/report-form';
import type {
    DailyReportData,
    ReportTaskOption,
} from '@/features/reports/types';
import { useReportForm } from '@/features/reports/use-report-form';
import { useBreakpoint } from '@/hooks/use-breakpoint';

type Props = {
    report: DailyReportData;
    suggestions: ReportTaskOption[];
    chosen: ReportTaskOption[];
    locks_at: string;
    limits: { items: number; note: number; text: number };
};

/** /laporan/hari-ini: write today's progress report (desktop & phone). */
export default function ReportToday({
    report,
    suggestions,
    chosen,
    limits,
}: Props) {
    const mobile = useBreakpoint() === 'mobile';
    const state = useReportForm({ report, suggestions, chosen });

    return (
        <>
            <Head title="Laporan hari ini" />
            <ReportForm
                state={state}
                suggestions={suggestions}
                limits={limits}
                mobile={mobile}
            />
        </>
    );
}

ReportToday.layout = {
    breadcrumbs: [
        { title: 'Laporan', href: '/laporan' },
        { title: 'Hari ini', href: '/laporan/hari-ini' },
    ],
    title: 'Laporan hari ini',
    back: '/laporan',
};
