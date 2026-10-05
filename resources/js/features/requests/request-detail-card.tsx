import type { ReactNode } from 'react';
import { usePage } from '@inertiajs/react';
import {
    formatRequestPeriod,
    formatRequestTitle,
    formatShortDate,
    stepProgress,
} from '@/lib/requests';
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

/**
 * Detail panel (SPengajuan right card; detail pages): number, big title,
 * period · submitted, status pill, fields, approval trail, grey action footer.
 */
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
    const meta = [
        formatRequestPeriod(request),
        request.submitted_at
            ? `diajukan ${formatShortDate(request.submitted_at)}`
            : 'belum dikirim',
    ].join(' · ');

    return (
        <article
            className={cn(
                'min-w-0 overflow-hidden rounded-panel border border-border bg-surface shadow-float',
                className,
            )}
            aria-label={`Detail ${request.number ?? 'draf'}`}
        >
            <div className="flex flex-col gap-5 px-5 py-6 md:px-7 md:py-[26px]">
                <header className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <p className="font-mono text-[14px] font-semibold text-text-muted">
                            {request.number ?? 'DRAF'}
                        </p>
                        <h2 className="text-[24px] leading-8 font-extrabold tracking-[-0.015em] text-text md:text-[28px] md:leading-[34px]">
                            {showRequester
                                ? `${request.type.name} · ${request.user.name}`
                                : formatRequestTitle(request)}
                        </h2>
                        {showRequester &&
                            (request.user.position ||
                                request.user.division) && (
                                <p className="text-[16px] text-text-muted md:text-[17px]">
                                    {[
                                        request.user.position,
                                        request.user.division,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </p>
                            )}
                        <p className="text-[16px] text-text-muted md:text-[17px]">
                            {meta}
                        </p>
                    </div>
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
                        className="h-[34px] px-3.5"
                    />
                </header>

                <RequestFields request={request} />

                <ColleagueWarning
                    colleagues={request.colleagues}
                    viewerIsRequester={request.user.id === viewerId}
                />

                <section className="flex flex-col gap-2">
                    <h3 className="text-[15px] font-bold text-text-muted">
                        Jejak persetujuan
                    </h3>
                    <ApprovalTimeline request={request} viewerId={viewerId} />
                </section>
            </div>

            {footer && (
                <div className="border-t border-border bg-background px-5 py-[18px] md:px-7">
                    {footer}
                </div>
            )}
        </article>
    );
}
