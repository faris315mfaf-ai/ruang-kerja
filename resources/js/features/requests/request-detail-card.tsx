import type { ReactNode } from 'react';
import { usePage } from '@inertiajs/react';
import { formatRequestPeriod, stepProgress } from '@/lib/requests';
import { cn } from '@/lib/utils';
import type { RequestDetail } from '@/types/requests';
import { ApprovalTimeline } from './approval-timeline';
import { StatusBadge } from './badges';
import { ColleagueWarning, RequestFields } from './request-parts';

type Props = {
    request: RequestDetail;
    /** Title shows the requester's name (approver views). */
    showRequester?: boolean;
    /** Badge text override, e.g. "Menunggu Anda". */
    statusLabel?: string;
    footer?: ReactNode;
    className?: string;
};

/** Detail panel (desktop side panel, detail pages). */
export function RequestDetailCard({
    request,
    showRequester = false,
    statusLabel,
    footer,
    className,
}: Props) {
    const viewerId = usePage().props.auth.user?.id;
    const progress =
        request.status === 'pending' ? stepProgress(request) : null;

    return (
        <article
            className={cn(
                'rounded-xl border border-border bg-surface p-5 shadow-card',
                className,
            )}
            aria-label={`Detail ${request.number ?? 'draf'}`}
        >
            <header className="mb-4">
                <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs text-text-muted">
                        {request.number ?? 'DRAF'}
                    </p>
                    <StatusBadge
                        status={request.status}
                        label={statusLabel ?? request.status_label}
                        suffix={
                            statusLabel
                                ? null
                                : progress
                                  ? `langkah ${progress.replace(' dari ', '/')}`
                                  : null
                        }
                    />
                </div>
                <h2 className="mt-1 text-[17px] leading-6 font-semibold text-text">
                    {request.type.name} ·{' '}
                    {showRequester
                        ? request.user.name
                        : formatRequestPeriod(request).replace(/ \d{4}$/, '')}
                </h2>
                {showRequester &&
                    (request.user.position || request.user.division) && (
                        <p className="text-[13px] text-text-muted">
                            {[request.user.position, request.user.division]
                                .filter(Boolean)
                                .join(' · ')}
                        </p>
                    )}
            </header>

            <RequestFields request={request} />

            <ColleagueWarning
                colleagues={request.colleagues}
                viewerIsRequester={request.user.id === viewerId}
                className="mt-4"
            />

            <section className="mt-5">
                <h3 className="mb-3 text-sm font-semibold text-text">
                    Alur persetujuan
                </h3>
                <ApprovalTimeline request={request} viewerId={viewerId} />
            </section>

            {footer && (
                <div className="mt-5 border-t border-border pt-4">{footer}</div>
            )}
        </article>
    );
}
