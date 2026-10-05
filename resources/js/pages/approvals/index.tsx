import { Head } from '@inertiajs/react';
import { ApprovalsDesktop } from '@/features/approvals/approvals.desktop';
import { ApprovalsMobile } from '@/features/approvals/approvals.mobile';
import type { ApprovalsProps } from '@/features/approvals/approvals-types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { index } from '@/routes/approvals';

export default function Approvals(props: ApprovalsProps) {
    const breakpoint = useBreakpoint();

    return (
        <>
            <Head title="Persetujuan" />
            {breakpoint === 'mobile' ? (
                <ApprovalsMobile {...props} />
            ) : (
                <ApprovalsDesktop {...props} />
            )}
        </>
    );
}

Approvals.layout = {
    width: 'wide',
    breadcrumbs: [
        { title: 'Absensi', href: '/absensi' },
        { title: 'Persetujuan', href: index() },
    ],
    title: 'Persetujuan',
    back: '/menu',
};
