import { Head, Link } from '@inertiajs/react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CancelApprovedAction } from '@/features/requests/cancel-approved-action';
import { RequestActions } from '@/features/requests/request-actions';
import { RequestDetailCard } from '@/features/requests/request-detail-card';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { index } from '@/routes/requests';
import type { RequestDetail } from '@/types/requests';

export default function RequestShow({ request }: { request: RequestDetail }) {
    const mobile = useBreakpoint() === 'mobile';
    const own = request.can.cancel || request.can.edit;
    // HR opening someone else's approved request (notification, search).
    const voidable = !own && request.can.cancel_approved === true;
    const actionable = own || voidable;

    return (
        <>
            <Head title={request.number ?? 'Draf pengajuan'} />
            {mobile ? (
                <div className={actionable ? 'pb-24' : undefined}>
                    <RequestDetailCard request={request} />
                    {actionable && (
                        <div className="glass fixed inset-x-0 bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom))] z-30 border-x-0 border-b-0 px-4 py-3">
                            {voidable ? (
                                <CancelApprovedAction
                                    request={request}
                                    mobile
                                />
                            ) : (
                                <RequestActions request={request} mobile />
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="mx-auto flex max-w-3xl flex-col gap-4">
                    <Button
                        asChild
                        variant="quiet"
                        className="-ml-3 self-start"
                    >
                        <Link href={index()}>
                            <ChevronLeft aria-hidden /> Pengajuan saya
                        </Link>
                    </Button>
                    <RequestDetailCard
                        request={request}
                        footer={
                            voidable ? (
                                <CancelApprovedAction request={request} />
                            ) : own ? (
                                <RequestActions request={request} />
                            ) : undefined
                        }
                    />
                </div>
            )}
        </>
    );
}

RequestShow.layout = {
    breadcrumbs: [
        { title: 'Pengajuan', href: index() },
        { title: 'Detail', href: index() },
    ],
    title: 'Detail pengajuan',
    back: '/pengajuan',
};
