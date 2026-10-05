import { Head, Link } from '@inertiajs/react';
import { ChevronLeft } from 'lucide-react';
import { RequestActions } from '@/features/requests/request-actions';
import { RequestDetailCard } from '@/features/requests/request-detail-card';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { index } from '@/routes/requests';
import type { RequestDetail } from '@/types/requests';

export default function RequestShow({ request }: { request: RequestDetail }) {
    const mobile = useBreakpoint() === 'mobile';
    const actionable = request.can.cancel || request.can.edit;

    return (
        <>
            <Head title={request.number ?? 'Draf pengajuan'} />
            {mobile ? (
                <div className={actionable ? 'pb-24' : undefined}>
                    <RequestDetailCard
                        request={request}
                        className="-mx-1 rounded-xl"
                    />
                    {actionable && (
                        <div className="glass fixed inset-x-0 bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom))] z-30 border-x-0 border-b-0 px-4 py-3">
                            <RequestActions request={request} mobile />
                        </div>
                    )}
                </div>
            ) : (
                <div className="mx-auto max-w-2xl space-y-4">
                    <Link
                        href={index()}
                        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text"
                    >
                        <ChevronLeft className="size-4" aria-hidden /> Pengajuan
                        saya
                    </Link>
                    <RequestDetailCard
                        request={request}
                        footer={
                            actionable ? (
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
