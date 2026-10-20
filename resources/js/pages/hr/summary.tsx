import { AnnouncementBanner } from '@/features/announcements/announcement-banner';
import { useLiveAttendance } from '@/features/dashboard/use-live-attendance';
import { HubSkeleton } from '@/features/hr/page-skeleton';
import { HrSummary } from '@/features/hr/summary';
import type { HrSummaryProps } from '@/features/hr/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * Ruang HR › Ringkasan (keputusan pemilik 20 Okt 2026, docs/fitur/ruang-hr.md):
 * replaces the HR dashboard for HR and Super Admin.
 */
export default function HrSummaryPage(props: HrSummaryProps) {
    const breakpoint = useBreakpoint();
    const live = useLiveAttendance(props.channels, ['summary']);

    if (breakpoint === null) {
        return <HubSkeleton />;
    }

    return (
        <>
            {/* Pengumuman (keputusan pemilik 6 Okt 2026), loaded apart from the page. */}
            <AnnouncementBanner className="mb-5" />
            <HrSummary
                props={props}
                mobile={breakpoint === 'mobile'}
                live={live}
            />
        </>
    );
}

HrSummaryPage.layout = {
    breadcrumbs: [{ title: 'Ruang HR', href: '/hr' }],
    title: 'Ruang HR',
    width: 'wide',
};
