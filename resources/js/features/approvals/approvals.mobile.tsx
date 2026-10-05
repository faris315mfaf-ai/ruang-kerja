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
import { SegmentedTabs } from '@/components/ui/tabs';
import { CategoryBadge, TonePill } from '@/features/requests/badges';
import { formatRelative } from '@/lib/format';
import {
    approvalTone,
    colleagueSummary,
    formatRequestDuration,
    formatRequestPeriod,
    stepProgress,
} from '@/lib/requests';
import { cn, focusRing } from '@/lib/utils';
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
                    size="lg"
                    className="w-full"
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

/** Avatar, name, period · duration, category (MPersetujuan card header). */
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
    const duration = formatRequestDuration(item);
    const progress = stepProgress(item);

    return (
        <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="flex items-center gap-3">
                <UserAvatar
                    name={item.user.name}
                    src={item.user.avatar}
                    className="size-[46px] text-[16px]"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[17px] leading-6 font-bold text-text">
                        {item.user.name}
                    </span>
                    <span className="text-[15px] leading-[22px] text-text-muted">
                        {formatRequestPeriod(item)}
                        {duration !== '—' ? ` · ${duration}` : ''}
                    </span>
                </span>
            </span>
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <CategoryBadge type={item.type} className="h-7 px-2.5" />
                <span className="text-meta text-text-muted">
                    {waiting
                        ? `Diajukan ${formatRelative(item.submitted_at)}${progress ? ` · langkah ${progress}` : ''}`
                        : `Diputus ${formatRelative(item.my_decision?.decided_at ?? null)}`}
                </span>
            </span>
            {waiting && warning && (
                <span className="flex items-center gap-1.5 text-meta font-semibold text-warning">
                    <AlertTriangle className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{warning}</span>
                </span>
            )}
        </span>
    );
}

function QueueCard({ item, waiting }: { item: RequestItem; waiting: boolean }) {
    return (
        <Link
            href={show({ employeeRequest: item.id })}
            className={cn('flex items-start gap-1 rounded-[22px]', focusRing)}
        >
            <QueueCardContent item={item} waiting={waiting} />
            <ChevronRight
                className="mt-3.5 size-5 shrink-0 text-text-subtle"
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
                'flex w-full items-start gap-1 rounded-[22px] border bg-surface py-4 pr-4 pl-1 text-left shadow-card transition-[border-color,box-shadow] duration-120 ease-brand select-none',
                focusRing,
                checked
                    ? 'border-primary ring-4 ring-ring/40'
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
                            ? 'border-0 bg-primary bg-grad-aksi text-on-brand'
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
            <QueueCardContent item={item} waiting />
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
                size="lg"
                className="flex-1"
                onClick={selection.cancel}
            >
                Batal
            </Button>
            <Button
                type="button"
                size="lg"
                className="flex-[2]"
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
            className="rounded-[22px] border border-border shadow-card"
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
            <div className="flex flex-col gap-3 p-4">
                <QueueCard item={item} waiting />
                <div className="flex gap-2.5">
                    <Button
                        type="button"
                        variant="outline"
                        className="h-12 flex-1 font-bold text-danger hover:text-danger"
                        aria-label={`Tolak pengajuan ${item.user.name}`}
                        onClick={() => onReject(item)}
                    >
                        Tolak
                    </Button>
                    <Button
                        type="button"
                        className="h-12 flex-[1.4]"
                        aria-label={`Setujui pengajuan ${item.user.name}`}
                        disabled={decision.form.processing}
                        onClick={() => decision.decide('approve')}
                    >
                        Setujui
                    </Button>
                </div>
            </div>
        </SwipeableRow>
    );
}

/**
 * MPersetujuan: tabs, swipe left (or the card buttons) for Tolak / Setujui,
 * tap for the detail. "Pilih" switches the waiting tab to selection mode for
 * a bulk approve.
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
        <div className="flex flex-col gap-4">
            <SegmentedTabs<ApprovalTab>
                label="Tab persetujuan"
                value={tab}
                onValueChange={(value) => {
                    selection.cancel();
                    router.get(
                        index.url({
                            query: value === 'menunggu' ? {} : { tab: value },
                        }),
                        {},
                        { replace: true },
                    );
                }}
                options={[
                    {
                        value: 'menunggu',
                        label:
                            counts.menunggu > 0
                                ? `Menunggu · ${counts.menunggu}`
                                : 'Menunggu',
                    },
                    { value: 'diputus', label: 'Sudah diputus' },
                ]}
                className="flex w-full [&>button]:h-11 [&>button]:flex-1 [&>button]:text-[16px] [&>button]:font-bold"
            />

            {waiting && items.length > 0 && (
                <div className="flex min-h-11 items-center justify-between gap-3">
                    {selecting ? (
                        <p
                            aria-live="polite"
                            className="px-1 text-[16px] font-semibold text-text tnum"
                        >
                            {selection.count > 0
                                ? `${selection.count} dipilih`
                                : 'Pilih pengajuan'}
                        </p>
                    ) : (
                        <p className="flex items-center gap-1.5 px-1 text-[15px] leading-[22px] text-text-muted">
                            <ArrowLeft
                                className="size-4 shrink-0"
                                aria-hidden
                            />
                            Geser kartu untuk memutuskan cepat
                        </p>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        className="shrink-0 rounded-full px-4 font-bold"
                        onClick={
                            selecting ? selection.toggleAll : selection.start
                        }
                    >
                        {!selecting
                            ? 'Pilih'
                            : selection.allSelected
                              ? 'Batal pilih semua'
                              : 'Pilih semua'}
                    </Button>
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
                <ul className="flex flex-col gap-3">
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
                                <div className="flex flex-col gap-3 rounded-[22px] border border-border bg-surface p-4 shadow-card">
                                    <QueueCard item={item} waiting={false} />
                                    {item.my_decision && (
                                        <TonePill
                                            tone={
                                                approvalTone[
                                                    item.my_decision.status
                                                ]
                                            }
                                            className="h-11 w-full rounded-[14px]"
                                        >
                                            {item.my_decision.status_label}
                                        </TonePill>
                                    )}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {waiting && items.length > 0 && (
                <p className="text-center text-meta text-text-muted">
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
