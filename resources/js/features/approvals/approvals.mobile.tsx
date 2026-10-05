import { Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    Check,
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
import type { ApprovalSelection } from './use-approval-selection';
import { useApprovalSelection } from './use-approval-selection';
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

/** Avatar + summary of one request, shared by the link card and the selectable card. */
function QueueCardContent({
    item,
    waiting,
}: {
    item: RequestItem;
    waiting: boolean;
}) {
    const warning = item.colleagues
        ? colleagueSummary(item.colleagues.people)
        : null;
    const detail =
        item.type.category === 'correction'
            ? formatRequestPeriod(item).split(' · ').slice(1).join(' · ')
            : formatRequestDuration(item);
    const progress = stepProgress(item);

    return (
        <>
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
        </>
    );
}

function QueueCard({ item, waiting }: { item: RequestItem; waiting: boolean }) {
    return (
        <Link
            href={show({ employeeRequest: item.id })}
            className="flex gap-3 p-4"
        >
            <QueueCardContent item={item} waiting={waiting} />
            <ChevronRight
                className="mt-6 size-5 shrink-0 text-text-subtle"
                aria-hidden
            />
        </Link>
    );
}

/**
 * Card in "Pilih" mode: the whole card is one checkbox (no swipe, no link), so
 * the touch target is the full card and the round check sits in a 44px column.
 */
function SelectableCard({
    item,
    checked,
    onToggle,
}: {
    item: RequestItem;
    checked: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={`${item.user.name}, ${item.type.name}, ${formatRequestPeriod(item)}`}
            onClick={onToggle}
            className={cn(
                'flex w-full items-start gap-1 rounded-xl border bg-surface py-4 pr-4 pl-1 text-left shadow-card transition-[border-color,box-shadow] duration-120 ease-brand select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                checked
                    ? 'border-primary ring-1 ring-primary'
                    : 'border-border',
            )}
        >
            <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center"
            >
                <span
                    className={cn(
                        'flex size-6 items-center justify-center rounded-full border-2 transition-colors duration-120 ease-brand',
                        checked
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border-strong bg-surface',
                    )}
                >
                    <Check
                        className={cn(
                            'size-4 transition-[transform,opacity] duration-120 ease-brand',
                            checked
                                ? 'scale-100 opacity-100'
                                : 'scale-50 opacity-0',
                        )}
                        strokeWidth={2.5}
                    />
                </span>
            </span>
            <span className="flex min-w-0 flex-1 gap-3">
                <QueueCardContent item={item} waiting />
            </span>
        </button>
    );
}

/** Sticky bar above the tab bar while selecting: Batal · Setujui (n). */
function SelectionBar({ selection }: { selection: ApprovalSelection }) {
    return (
        <div
            role="toolbar"
            aria-label="Aksi pengajuan terpilih"
            className="glass fixed inset-x-0 bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom))] z-30 flex animate-in gap-3 border-x-0 border-b-0 px-4 py-3 duration-180 ease-brand fade-in-0 slide-in-from-bottom-2"
        >
            <Button
                type="button"
                variant="outline"
                className="h-12 flex-1 text-base"
                onClick={selection.cancel}
            >
                Batal
            </Button>
            <Button
                type="button"
                className="h-12 flex-[2] text-base"
                disabled={selection.count === 0 || selection.processing}
                onClick={selection.approve}
            >
                Setujui ({selection.count})
            </Button>
        </div>
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

/**
 * MPersetujuan: tabs, swipe left for Tolak / Setujui, tap for the detail.
 * "Pilih" switches the waiting tab to selection mode for a bulk approve.
 */
export function ApprovalsMobile({
    tab,
    counts,
    items,
    delegations,
}: ApprovalsProps) {
    const [rejecting, setRejecting] = useState<RequestItem | null>(null);
    const waiting = tab === 'menunggu';
    const oldest = waiting ? items[0]?.waiting?.since : null;
    const selection = useApprovalSelection(items.map((item) => item.id));
    const selecting = waiting && selection.active && items.length > 0;

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
                        onClick={() => {
                            selection.cancel();
                            router.get(
                                index.url({
                                    query:
                                        value === 'menunggu'
                                            ? {}
                                            : { tab: value },
                                }),
                                {},
                                { replace: true },
                            );
                        }}
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
                <div className="flex min-h-11 items-center justify-between gap-3">
                    {selecting ? (
                        <p
                            aria-live="polite"
                            className="text-[15px] font-medium text-text tnum"
                        >
                            {selection.count > 0
                                ? `${selection.count} dipilih`
                                : 'Pilih pengajuan'}
                        </p>
                    ) : (
                        <p className="flex items-center gap-1.5 text-[13px] text-text-muted">
                            <ArrowLeft className="size-4" aria-hidden /> Geser
                            kartu untuk memutuskan cepat
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={
                            selecting ? selection.toggleAll : selection.start
                        }
                        className="-mr-2 flex h-11 shrink-0 items-center rounded-full px-3 text-[15px] font-medium text-primary transition-[transform,opacity] duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-95 active:opacity-70"
                    >
                        {!selecting
                            ? 'Pilih'
                            : selection.allSelected
                              ? 'Batal pilih semua'
                              : 'Pilih semua'}
                    </button>
                </div>
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
                            {selecting ? (
                                <SelectableCard
                                    item={item}
                                    checked={selection.isSelected(item.id)}
                                    onToggle={() => selection.toggle(item.id)}
                                />
                            ) : waiting ? (
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

            {selecting && (
                <>
                    {/* Keeps the last card clear of the selection bar. */}
                    <div aria-hidden className="h-16" />
                    <SelectionBar selection={selection} />
                </>
            )}

            {rejecting && (
                <RejectSheet
                    item={rejecting}
                    onClose={() => setRejecting(null)}
                />
            )}
        </div>
    );
}
