import { Head } from '@inertiajs/react';
import type { MyRequestsProps } from '@/features/requests/my-requests-filters';
import { MyRequestsDesktop } from '@/features/requests/my-requests.desktop';
import { MyRequestsMobile } from '@/features/requests/my-requests.mobile';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { index } from '@/routes/requests';

export default function MyRequests(props: MyRequestsProps) {
    const breakpoint = useBreakpoint();

    return (
        <>
            <Head title="Pengajuan saya" />
            {breakpoint === 'mobile' ? (
                <MyRequestsMobile {...props} />
            ) : (
                <MyRequestsDesktop {...props} />
            )}
        </>
    );
}

MyRequests.layout = {
    breadcrumbs: [{ title: 'Pengajuan', href: index() }],
    title: 'Pengajuan saya',
    back: '/menu',
};
