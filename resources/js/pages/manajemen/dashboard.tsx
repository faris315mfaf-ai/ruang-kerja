import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { ManagementDesktop } from '@/features/management/management.desktop';
import { ManagementMobile } from '@/features/management/management.mobile';
import { Skeleton } from '@/components/ui/skeleton';
import type { ManagementProps, PeriodKey } from '@/features/management/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';

/**
 * /manajemen — Dashboard Manajemen (design MgDashboard / MgDashboardMalam /
 * MgPDashboard) for Direksi, HR and Super Admin, in the regular app shell.
 * The page lays out its own 1280px column (layout width "full").
 */
export default function ManagementDashboard(props: ManagementProps) {
    const breakpoint = useBreakpoint();
    // All three periods are on the page: switching tabs is local state.
    const [period, setPeriod] = useState<PeriodKey>('harian');

    return (
        <>
            <Head title="Dashboard manajemen" />
            <div
                className={cn(
                    'text-base',
                    breakpoint === 'mobile' && '-mx-4 -mt-2',
                )}
            >
                {breakpoint === null ? (
                    <div className="flex flex-col gap-4 p-8" aria-busy>
                        <Skeleton className="h-10 w-72" />
                        <Skeleton className="h-36 w-full" />
                        <Skeleton className="h-80 w-full" />
                    </div>
                ) : breakpoint === 'mobile' ? (
                    <ManagementMobile
                        props={props}
                        period={period}
                        onPeriodChange={setPeriod}
                    />
                ) : (
                    <ManagementDesktop
                        props={props}
                        period={period}
                        onPeriodChange={setPeriod}
                    />
                )}
            </div>
        </>
    );
}

ManagementDashboard.layout = {
    breadcrumbs: [
        { title: 'Manajemen', href: '/manajemen' },
        { title: 'Dashboard', href: '/manajemen' },
    ],
    title: 'Manajemen',
    width: 'full',
};
