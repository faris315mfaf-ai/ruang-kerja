import { Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    CheckCheck,
    ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { SwipeableRow } from '@/components/mobile/swipeable-row';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { CategoryBadge, TonePill } from '@/features/requests/badges';
import { formatRelative } from '@/lib/format';
import {
    approvalTone,
    colleagueSummary,
    formatRequestDuration,
    formatRequestPeriod,
    stepProgress,
} from '@/lib/requests';
import { cn } from '@/lib/utils';
import { index, show } from '@/routes/approvals';
import type { RequestItem } from '@/types/requests';
import type { ApprovalTab, ApprovalsProps } from './approvals-types';
import { DecisionNote } from './decision-controls';
import { DelegationDialog } from './delegation-dialog';
import { useDecision } from './use-decision';

function RejectSheet({
    item,
    onClose,
}: {
    item: RequestItem;
    onClose: () => void;
}) {
    const decision = useDecision(item.id);

    return (
        <BottomSheet
            open
            onOpenChange={(open) => !open && onClose()}
            title={`Tolak pengajuan ${item.user.name.split(' ')[0]}?`}
            description={`${item.type.name} · ${formatRequestPeriod(item)}`}
            footer={
                <Button
                    type="button"
                    variant="destructive"
                    className="h-12 w-full text-base"
                    disabled={decision.form.processing}
                    onClick={() => decision.decide('reject', onClose)}
                >
                    Tolak pengajuan
                </Button>
            }
        >
            <DecisionNote
                decision={decision}
                requesterName={item.user.name}
                mobile
            />
        </BottomSheet>
    );
}

function QueueCard({ item, waiting }: { item: RequestItem; waiting: boolean }) {
    const warning = item.colleagues
        ? colleagueSummary(item.colleagues.people)
        : null;
    const detail =
        item.type.category === 'correction'
            ? formatRequestPeriod(item).split(' · ').slice(1).join(' · ')
            : formatRequestDuration(item);
    const progress = stepProgress(item);

    return (
        <Link
            href={show({ employeeRequest: item.id })}
            className="flex gap-3 p-4"
        >
            <UserAvatar
                name={item.user.name}
                src={item.user.avatar}
                className="size-11 text-sm"
            />
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[16px] font-semibold text-text">
                        {item.user.name}
                    </p>
                    <span className="shrink-0 text-[13px] text-text-muted">
                        {formatRelative(item.submitted_at)}
                    </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <CategoryBadge type={item.type} />
                    <span className="text-[15px] text-text">
                        {item.type.category === 'correction'
                            ? formatRequestPeriod(item).split(' · ')[0]
                            : formatRequestPeriod(item)}
                    </span>
                </div>
                <p className="mt-1 text-[13px] text-text-muted">
                    {detail}
                    {waiting && progress ? ` · langkah ${progress}` : ''}
                </p>
                {!waiting && item.my_decision && (
                    <TonePill
                        tone={approvalTone[item.my_decision.status]}
                        className="mt-2"
                    >
                        {item.my_decision.status_label}
                    </TonePill>
                )}
                {waiting && warning && (
                    <p className="mt-1 flex items-center gap-1.5 text-[13px] text-warning">
                        <AlertTriangle
                            className="size-3.5 shrink-0"
                            aria-hidden
                        />
                        <span className="truncate">{warning}</span>
                    </p>
                )}
            </div>
            <ChevronRight
                className="mt-6 size-5 shrink-0 text-text-subtle"
                aria-hidden
            />
        </Link>
    );
}

function SwipeCard({
    item,
    onReject,
}: {
    item: RequestItem;
    onReject: (item: RequestItem) => void;
}) {
    const decision = useDecision(item.id);

    return (
        <SwipeableRow
            className="rounded-xl border border-border shadow-card"
            actions={[
                {
                    label: 'Tolak',
                    tone: 'danger',
                    onAction: () => onReject(item),
                },
                {
                    label: 'Setujui',
                    tone: 'primary',
                    onAction: () => decision.decide('approve'),
                },
            ]}
        >
            <QueueCard item={item} waiting />
        </SwipeableRow>
    );
}

/** MPersetujuan: tabs, swipe left for Tolak / Setujui, tap for the detail. */
export function ApprovalsMobile({
    tab,
    counts,
    items,
    delegations,
}: ApprovalsProps) {
    const [rejecting, setRejecting] = useState<RequestItem | null>(null);
    const waiting = tab === 'menunggu';
    const oldest = waiting ? items[0]?.waiting?.since : null;

    return (
        <div className="space-y-4">
            <div
                role="tablist"
                aria-label="Tab persetujuan"
                className="grid grid-cols-2 rounded-xl bg-surface-2 p-1"
            >
                {(['menunggu', 'diputus'] as ApprovalTab[]).map((value) => (
                    <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={tab === value}
                        onClick={() =>
                            router.get(
                                index.url({
                                    query:
                                        value === 'menunggu'
                                            ? {}
                                            : { tab: value },
                                }),
                                {},
                                { replace: true },
                            )
                        }
                        className={cn(
                            'flex h-11 items-center justify-center gap-2 rounded-lg text-[15px]',
                            tab === value
                                ? 'bg-surface font-semibold text-text shadow-card'
                                : 'text-text-muted',
                        )}
                    >
                        {value === 'menunggu' ? 'Menunggu' : 'Sudah diputus'}
                        {value === 'menunggu' && counts.menunggu > 0 && (
                            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground tnum">
                                {counts.menunggu}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {waiting && items.length > 0 && (
                <p className="flex items-center gap-1.5 text-[13px] text-text-muted">
                    <ArrowLeft className="size-4" aria-hidden /> Geser kartu
                    untuk memutuskan cepat
                </p>
            )}

            {items.length === 0 ? (
                <EmptyState
                    icon={CheckCheck}
                    title={waiting ? 'Semua beres' : 'Belum ada keputusan'}
                    description={
                        waiting
                            ? 'Tidak ada pengajuan yang menunggu Anda.'
                            : undefined
                    }
                />
            ) : (
                <ul className="space-y-3">
                    {items.map((item) => (
                        <li key={item.id}>
                            {waiting ? (
                                <SwipeCard
                                    item={item}
                                    onReject={setRejecting}
                                />
                            ) : (
                                <div className="rounded-xl border border-border bg-surface shadow-card">
                                    <QueueCard item={item} waiting={false} />
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {waiting && items.length > 0 && (
                <p className="text-center text-[13px] text-text-muted">
                    {items.length} pengajuan
                    {oldest
                        ? ` · terlama menunggu ${formatRelative(oldest).replace(/ lalu$/, '')}`
                        : ''}
                </p>
            )}

            <DelegationDialog delegations={delegations} mobile />

            {rejecting && (
                <RejectSheet
                    item={rejecting}
                    onClose={() => setRejecting(null)}
                />
            )}
        </div>
    );
}
