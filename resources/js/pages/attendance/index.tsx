import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { AttendanceDesktop } from '@/features/attendance/attendance.desktop';
import { AttendanceMobile } from '@/features/attendance/attendance.mobile';
import type { AttendancePageProps } from '@/features/attendance/use-attendance-page';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/** /absensi — check-in GPS + selfie / QR, today and recent days (DAbsensi, MAbsen → MSukses). */
export default function AttendanceIndex(props: AttendancePageProps) {
    const breakpoint = useBreakpoint();

    return (
        <>
            <Head title="Absensi" />
            {breakpoint === null ? (
                <div className="flex flex-col gap-5" aria-busy>
                    <Skeleton className="h-[420px] rounded-[28px]" />
                    <Skeleton className="h-64 rounded-panel" />
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
