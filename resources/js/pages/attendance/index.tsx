import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { AttendanceDesktop } from '@/features/attendance/attendance.desktop';
import { AttendanceMobile } from '@/features/attendance/attendance.mobile';
import type { AttendancePageProps } from '@/features/attendance/use-attendance-page';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/** /absensi — check-in GPS + selfie, today's status and 30-day history (Sprint 2). */
export default function AttendanceIndex(props: AttendancePageProps) {
    const breakpoint = useBreakpoint();

    return (
        <>
            <Head title="Absensi" />
            {breakpoint === null ? (
                <div className="space-y-4" aria-busy>
                    <Skeleton className="h-48 rounded-xl" />
                    <Skeleton className="h-40 rounded-xl" />
                </div>
            ) : breakpoint === 'mobile' ? (
                <AttendanceMobile {...props} />
            ) : (
                <AttendanceDesktop {...props} />
            )}
        </>
    );
}

AttendanceIndex.layout = {
    breadcrumbs: [{ title: 'Absensi', href: '/absensi' }],
    appBar: 'greeting',
};
