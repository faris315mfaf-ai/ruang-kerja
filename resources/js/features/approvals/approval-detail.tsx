import { usePage } from '@inertiajs/react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { StatusBadge } from '@/features/requests/badges';
import { ApprovalTimeline } from '@/features/requests/approval-timeline';
import {
    CancelApprovedAction,
    CancellationNotice,
} from '@/features/requests/cancel-approved-action';
import {
    ColleagueWarning,
    RequestFields,
} from '@/features/requests/request-parts';
import {
    formatRequestDuration,
    formatRequestPeriod,
    formatShortDate,
} from '@/lib/requests';
import { cn } from '@/lib/utils';
import type { RequestDetail } from '@/types/requests';
import { DecisionButtons, DecisionNote } from './decision-controls';
import type { useDecision } from './use-decision';

/** "Jenis · Waktu · Durasi" tiles (DPersetujuan detail). */
export function RequestTiles({
    request,
    className,
}: {
    request: RequestDetail;
    className?: string;
}) {
    const duration = formatRequestDuration(request);
    const tiles = [
        { label: 'Jenis', value: request.type.name },
        { label: 'Waktu', value: formatRequestPeriod(request) },
        ...(duration === '—' ? [] : [{ label: 'Durasi', value: duration }]),
    ];

    return (
        <dl
            className={cn(
                'grid grid-cols-2 gap-3',
                tiles.length === 3 && 'sm:grid-cols-3',
                className,
            )}
        >
            {tiles.map((tile, i) => (
                <div
                    key={tile.label}
                    className={cn(
                        'flex min-w-0 flex-col gap-1 rounded-lg bg-background p-4',
                        i === 2 && 'col-span-2 sm:col-span-1',
                    )}
                >
                    <dt className="text-[14px] font-semibold text-text-muted">
                        {tile.label}
                    </dt>
                    <dd className="text-[18px] leading-6 font-bold text-text md:text-[19px]">
                        {tile.value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

/** Requester avatar, name, position and the request number chip. */
export function RequesterHeader({
    request,
    statusLabel,
}: {
    request: RequestDetail;
    statusLabel?: string;
}) {
    return (
        <header className="flex flex-wrap items-center gap-4">
            <UserAvatar
                name={request.user.name}
                src={request.user.avatar}
                className="size-[60px] text-[20px]"
            />
            <div className="flex min-w-[180px] flex-1 flex-col gap-0.5">
                <h2 className="text-[22px] leading-8 font-bold tracking-[-0.01em] text-text md:text-[24px]">
                    {request.user.name}
                </h2>
                <p className="text-[16px] text-text-muted">
                    {[
                        request.user.position,
                        request.user.division,
                        request.submitted_at
                            ? `diajukan ${formatShortDate(request.submitted_at)}`
                            : null,
                    ]
                        .filter(Boolean)
                        .join(' · ')}
                </p>
            </div>
            <div className="flex items-center justify-between gap-2 max-sm:w-full sm:flex-col sm:items-end">
                <span className="rounded-sm bg-surface-2 px-2.5 py-1.5 font-mono text-[14px] font-semibold text-text">
                    {request.number ?? 'DRAF'}
                </span>
                <StatusBadge
                    status={request.status}
                    label={statusLabel ?? request.status_label}
                    className="h-[30px] px-3 text-[14px]"
                />
            </div>
        </header>
    );
}

/**
 * DPersetujuan right panel (also /persetujuan/{id} on desktop): requester,
 * tiles, fields, colleague warning, approval trail, decision footer.
 */
export function ApprovalDetailCard({
    request,
    decision,
    className,
}: {
    request: RequestDetail;
    decision: ReturnType<typeof useDecision>;
    className?: string;
}) {
    const viewerId = usePage().props.auth.user?.id;
    const decide = request.can.decide;

    return (
        <article
            aria-label={`Detail ${request.number ?? 'draf'}`}
            className={cn(
                'min-w-0 overflow-hidden rounded-panel border border-border bg-surface shadow-float',
                className,
            )}
        >
            <div className="flex flex-col gap-[22px] px-5 py-6 md:p-7">
                <RequesterHeader
                    request={request}
                    statusLabel={decide ? 'Menunggu Anda' : undefined}
                />
                <CancellationNotice request={request} />
                <RequestTiles request={request} />
                <RequestFields request={request} withPeriod={false} />
                <ColleagueWarning colleagues={request.colleagues} />
                <section className="flex flex-col gap-3">
                    <h3 className="text-[15px] font-bold text-text-muted">
                        Alur persetujuan
                    </h3>
                    <ApprovalTimeline request={request} viewerId={viewerId} />
                </section>
            </div>
            {decide && (
                <div className="flex flex-col gap-4 border-t border-border bg-background px-5 py-5 md:px-7">
                    <DecisionNote
                        decision={decision}
                        requesterName={request.user.name}
                    />
                    <DecisionButtons decision={decision} />
                </div>
            )}
            {!decide && request.can.cancel_approved && (
                <div className="border-t border-border bg-background px-5 py-5 md:px-7">
                    <CancelApprovedAction request={request} />
                </div>
            )}
        </article>
    );
}
