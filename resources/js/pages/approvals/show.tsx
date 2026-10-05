import { Head, Link } from '@inertiajs/react';
import { ChevronLeft } from 'lucide-react';
import { UserAvatar } from '@/components/shell/user-avatar';
import {
    DecisionButtons,
    DecisionNote,
} from '@/features/approvals/decision-controls';
import { useDecision } from '@/features/approvals/use-decision';
import { StatusBadge } from '@/features/requests/badges';
import { ApprovalTimeline } from '@/features/requests/approval-timeline';
import { RequestDetailCard } from '@/features/requests/request-detail-card';
import {
    ColleagueWarning,
    RequestFields,
} from '@/features/requests/request-parts';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatDateTime } from '@/lib/format';
import { index } from '@/routes/approvals';
import { usePage } from '@inertiajs/react';
import type { RequestDetail } from '@/types/requests';

type Props = {
    request: RequestDetail;
    queue: { position: number | null; total: number; next_id: string | null };
};

/** MPersetujuanDetail (also the permalink from notifications on desktop). */
export default function ApprovalShow({ request, queue }: Props) {
    const mobile = useBreakpoint() === 'mobile';
    const decision = useDecision(request.id, 'next');
    const viewerId = usePage().props.auth.user?.id;
    const decide = request.can.decide;

    if (!mobile) {
        return (
            <>
                <Head title={`${request.number ?? ''} · Persetujuan`} />
                <div className="mx-auto max-w-2xl space-y-4">
                    <Link
                        href={index()}
                        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text"
                    >
                        <ChevronLeft className="size-4" aria-hidden />{' '}
                        Persetujuan
                        {queue.position
                            ? ` · ${queue.position} dari ${queue.total}`
                            : ''}
                    </Link>
                    <RequestDetailCard
                        request={request}
                        showRequester
                        statusLabel={decide ? 'Menunggu Anda' : undefined}
                        footer={
                            decide ? (
                                <div className="space-y-4">
                                    <DecisionNote
                                        decision={decision}
                                        requesterName={request.user.name}
                                    />
                                    <DecisionButtons decision={decision} />
                                </div>
                            ) : undefined
                        }
                    />
                </div>
            </>
        );
    }

    return (
        <>
            <Head title={`${request.number ?? ''} · Persetujuan`} />
            <div className={decide ? 'space-y-5 pb-24' : 'space-y-5'}>
                <div className="flex items-center justify-between text-[13px] text-text-muted">
                    <span className="font-mono text-[15px] text-text">
                        {request.number}
                    </span>
                    {queue.position && (
                        <span>
                            {queue.position} dari {queue.total}
                        </span>
                    )}
                </div>
                <div>
                    <UserAvatar
                        name={request.user.name}
                        src={request.user.avatar}
                        className="size-14 text-lg"
                    />
                    <h2 className="mt-3 text-[22px] leading-7 font-semibold text-text">
                        {request.type.name} · {request.user.name}
                    </h2>
                    <p className="text-[13px] text-text-muted">
                        {[
                            request.user.position,
                            request.submitted_at
                                ? `diajukan ${formatDateTime(request.submitted_at)}`
                                : null,
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </p>
                    <StatusBadge
                        status={request.status}
                        label={decide ? 'Menunggu Anda' : request.status_label}
                        className="mt-3"
                    />
                </div>

                <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
                    <RequestFields
                        request={request}
                        className="grid-cols-[100px_1fr] text-[15px]"
                    />
                </div>

                <ColleagueWarning colleagues={request.colleagues} />

                <section>
                    <h3 className="mb-3 text-[15px] font-semibold text-text">
                        Alur persetujuan
                    </h3>
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
