import { Head, Link, usePage } from '@inertiajs/react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    ApprovalDetailCard,
    RequestTiles,
    RequesterHeader,
} from '@/features/approvals/approval-detail';
import {
    DecisionButtons,
    DecisionNote,
} from '@/features/approvals/decision-controls';
import { useDecision } from '@/features/approvals/use-decision';
import { ApprovalTimeline } from '@/features/requests/approval-timeline';
import {
    ColleagueWarning,
    RequestFields,
} from '@/features/requests/request-parts';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { index } from '@/routes/approvals';
import type { RequestDetail } from '@/types/requests';

type Props = {
    request: RequestDetail;
    queue: { position: number | null; total: number; next_id: string | null };
};

/** MPersetujuan detail (also the permalink from notifications on desktop). */
export default function ApprovalShow({ request, queue }: Props) {
    const mobile = useBreakpoint() === 'mobile';
    const decision = useDecision(request.id, 'next');
    const viewerId = usePage().props.auth.user?.id;
    const decide = request.can.decide;
    const position = queue.position
        ? `${queue.position} dari ${queue.total}`
        : null;

    if (!mobile) {
        return (
            <>
                <Head title={`${request.number ?? ''} · Persetujuan`} />
                <div className="mx-auto flex max-w-3xl flex-col gap-4">
                    <div className="flex items-center justify-between gap-3">
                        <Button
                            asChild
                            variant="quiet"
                            className="-ml-3 self-start"
                        >
                            <Link href={index()}>
                                <ChevronLeft aria-hidden /> Persetujuan
                            </Link>
                        </Button>
                        {position && (
                            <span className="text-meta text-text-muted tnum">
                                {position}
                            </span>
                        )}
                    </div>
                    <ApprovalDetailCard request={request} decision={decision} />
                </div>
            </>
        );
    }

    return (
        <>
            <Head title={`${request.number ?? ''} · Persetujuan`} />
            <div
                className={
                    decide ? 'flex flex-col gap-5 pb-24' : 'flex flex-col gap-5'
                }
            >
                {position && (
                    <p className="text-meta text-text-muted tnum">
                        Antrean {position}
                    </p>
                )}
                <section className="flex flex-col gap-5 rounded-[22px] border border-border bg-surface p-4 shadow-card">
                    <RequesterHeader
                        request={request}
                        statusLabel={decide ? 'Menunggu Anda' : undefined}
                    />
                    <RequestTiles request={request} />
                    <RequestFields request={request} withPeriod={false} />
                </section>

                <ColleagueWarning colleagues={request.colleagues} />

                <section className="flex flex-col gap-3">
                    <h2 className="text-[15px] font-bold text-text-muted">
                        Alur persetujuan
                    </h2>
                    <ApprovalTimeline request={request} viewerId={viewerId} />
                </section>

                {decide && (
                    <DecisionNote
                        decision={decision}
                        requesterName={request.user.name}
                        mobile
                    />
                )}
            </div>

            {decide && (
                <div className="glass fixed inset-x-0 bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom))] z-30 border-x-0 border-b-0 px-4 py-3">
                    <DecisionButtons decision={decision} mobile />
                </div>
            )}
        </>
    );
}

ApprovalShow.layout = {
    breadcrumbs: [
        { title: 'Persetujuan', href: index() },
        { title: 'Detail', href: index() },
    ],
    title: 'Detail persetujuan',
    back: '/persetujuan',
};
