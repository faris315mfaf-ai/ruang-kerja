import { router } from '@inertiajs/react';
import { CheckCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TabNav } from '@/components/ui/tabs';
import { CategoryBadge, TonePill } from '@/features/requests/badges';
import { EmptyDetail } from '@/features/requests/request-parts';
import { formatRelative } from '@/lib/format';
import {
    approvalTone,
    formatRequestDuration,
    formatRequestPeriod,
    stepProgress,
} from '@/lib/requests';
import { cn, focusRing } from '@/lib/utils';
import { bulk, index } from '@/routes/approvals';
import type {
    RequestCategory,
    RequestDetail,
    RequestItem,
} from '@/types/requests';
import { ApprovalDetailCard } from './approval-detail';
import {
    APPROVAL_TAB_LABELS,
    approvalTabs,
    type ApprovalsProps,
} from './approvals-types';
import { DelegationDialog } from './delegation-dialog';
import { useDecision } from './use-decision';

function DecisionPanel({ request }: { request: RequestDetail }) {
    const decision = useDecision(request.id);

    return <ApprovalDetailCard request={request} decision={decision} />;
}

/** "Semua · 5", "Cuti · 2" … from the categories present on the page. */
function categoryFilters(items: RequestItem[]) {
    const seen = new Map<RequestCategory, { label: string; count: number }>();

    for (const item of items) {
        const current = seen.get(item.type.category);
        seen.set(item.type.category, {
            label: item.type.category_label,
            count: (current?.count ?? 0) + 1,
        });
    }

    return [...seen.entries()].map(([value, info]) => ({ value, ...info }));
}

function QueueCard({
    item,
    waiting,
    active,
    checked,
    onCheck,
    onSelect,
}: {
    item: RequestItem;
    waiting: boolean;
    active: boolean;
    checked: boolean;
    onCheck: (value: boolean) => void;
    onSelect: () => void;
}) {
    const progress = stepProgress(item);

    return (
        <div
            className={cn(
                'flex items-center rounded-card border bg-surface transition-[border-color,box-shadow] duration-120 ease-brand',
                active
                    ? 'border-primary shadow-card ring-4 ring-ring/40'
                    : 'border-border shadow-card hover:border-border-strong',
            )}
        >
            {waiting && (
                <span className="flex w-12 shrink-0 justify-center self-stretch pl-2">
                    <span className="flex items-center">
                        <Checkbox
                            aria-label={`Pilih pengajuan ${item.user.name}`}
                            checked={checked}
                            onCheckedChange={(value) => onCheck(value === true)}
                        />
                    </span>
                </span>
            )}
            <button
                type="button"
                onClick={onSelect}
                aria-pressed={active}
                className={cn(
                    'flex min-w-0 flex-1 items-center gap-3.5 rounded-card p-[18px] text-left',
                    waiting && 'pl-2',
                    focusRing,
                )}
            >
                <UserAvatar
                    name={item.user.name}
                    src={item.user.avatar}
                    className="size-12 text-[16px]"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[17px] leading-6 font-bold text-text">
                        {item.user.name}
                    </span>
                    <span className="text-[15px] leading-[22px] text-text-muted">
                        {formatRequestPeriod(item)}
                        {formatRequestDuration(item) !== '—' &&
                            ` · ${formatRequestDuration(item)}`}
                    </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <CategoryBadge type={item.type} className="h-7 px-2.5" />
                    {waiting ? (
                        <span className="text-[14px] font-semibold text-text-muted">
                            {progress ? `Langkah ${progress} · ` : ''}
                            {formatRelative(item.submitted_at)}
                        </span>
                    ) : !item.my_decision ? (
                        <span className="flex items-center gap-2">
                            <span className="text-[14px] font-semibold text-text-muted">
                                {formatRelative(item.decided_at)}
                            </span>
                            <TonePill
                                tone="success"
                                className="h-7 px-2.5 text-[14px]"
                            >
                                {item.status_label}
                            </TonePill>
                        </span>
                    ) : item.my_decision ? (
                        <span className="flex items-center gap-2">
                            <span className="text-[14px] font-semibold text-text-muted">
                                {formatRelative(
                                    item.my_decision.decided_at ?? null,
                                )}
                            </span>
                            <TonePill
                                tone={approvalTone[item.my_decision.status]}
                                className="h-7 px-2.5 text-[14px]"
                            >
                                {item.my_decision.status_label}
                            </TonePill>
                        </span>
                    ) : null}
                </span>
            </button>
        </div>
    );
}

export function ApprovalsDesktop({
    tab,
    counts,
    items,
    selected,
    scope,
    delegations,
    can_cancel_approved: canCancelApproved,
}: ApprovalsProps) {
    const [checked, setChecked] = useState<string[]>([]);
    const [processing, setProcessing] = useState(false);
    const [category, setCategory] = useState<RequestCategory | 'semua'>(
        'semua',
    );
    const waiting = tab === 'menunggu';
    const filters = useMemo(() => categoryFilters(items), [items]);
    const visible =
        category === 'semua'
            ? items
            : items.filter((item) => item.type.category === category);
    const allChecked =
        visible.length > 0 &&
        visible.every((item) => checked.includes(item.id));

    const select = (id: string) =>
        router.get(
            index.url({
                query: { tab: waiting ? undefined : tab, pilih: id },
            }),
            {},
            {
                only: ['selected'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );

    const approveChecked = () =>
        router.post(
            bulk.url(),
            { ids: checked },
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onSuccess: () => setChecked([]),
            },
        );

    const toggle = (id: string, value: boolean) =>
        setChecked((current) =>
            value ? [...current, id] : current.filter((item) => item !== id),
        );

    const pickCategory = (value: RequestCategory | 'semua') => {
        setCategory(value);
        setChecked((current) =>
            current.filter((id) =>
                items.some(
                    (item) =>
                        item.id === id &&
                        (value === 'semua' || item.type.category === value),
                ),
            ),
        );
    };

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-display text-text">Persetujuan</h1>
                    <p className="text-body-lg text-text-muted">
                        {counts.menunggu} menunggu Anda · {scope}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <DelegationDialog delegations={delegations} />
                    {waiting && checked.length > 0 && (
                        <Button
                            type="button"
                            disabled={processing}
                            onClick={approveChecked}
                        >
                            Setujui {checked.length} pengajuan
                        </Button>
                    )}
                </div>
            </header>

            <TabNav
                preserveScroll
                label="Tab persetujuan"
                items={approvalTabs(canCancelApproved).map((value) => ({
                    href: index.url({
                        query: value === 'menunggu' ? {} : { tab: value },
                    }),
                    label: APPROVAL_TAB_LABELS[value],
                    active: tab === value,
                    count:
                        value === 'menunggu' && counts.menunggu > 0
                            ? counts.menunggu
                            : undefined,
                }))}
            />

            {filters.length > 1 && (
                <div
                    role="group"
                    aria-label="Filter jenis"
                    className="flex flex-wrap gap-2.5"
                >
                    {[
                        {
                            value: 'semua' as const,
                            label: 'Semua',
                            count: items.length,
                        },
                        ...filters,
                    ].map((filter) => {
                        const on = category === filter.value;

                        return (
                            <button
                                key={filter.value}
                                type="button"
                                aria-pressed={on}
                                onClick={() => pickCategory(filter.value)}
                                className={cn(
                                    'inline-flex h-10 items-center rounded-full border px-4 text-[15px] font-semibold transition-colors duration-120 ease-brand',
                                    on
                                        ? 'border-inverse bg-inverse text-on-inverse'
                                        : 'border-border-strong bg-surface text-text hover:bg-surface-2',
                                    focusRing,
                                )}
                            >
                                {filter.label} · {filter.count}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="flex flex-wrap items-start gap-5">
                <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3">
                    {visible.length === 0 ? (
                        <EmptyState
                            icon={CheckCheck}
                            title={
                                waiting
                                    ? 'Tidak ada yang menunggu keputusan Anda'
                                    : tab === 'disetujui'
                                      ? 'Belum ada pengajuan yang disetujui'
                                      : 'Belum ada keputusan'
                            }
                            description={
                                waiting
                                    ? 'Pengajuan baru dari tim Anda akan muncul di sini.'
                                    : tab === 'disetujui'
                                      ? 'Pengajuan karyawan yang sudah disetujui tampil di sini dan bisa dibatalkan bila perlu.'
                                      : 'Pengajuan yang Anda setujui atau tolak tampil di sini.'
                            }
                        />
                    ) : (
                        <>
                            {waiting && (
                                <div className="flex min-h-11 items-center justify-between gap-3 px-1">
                                    <label className="flex items-center gap-3 text-[15px] font-semibold text-text">
                                        <Checkbox
                                            aria-label="Pilih semua"
                                            checked={allChecked}
                                            onCheckedChange={(value) =>
                                                setChecked(
                                                    value === true
                                                        ? visible.map(
                                                              (item) => item.id,
                                                          )
                                                        : [],
                                                )
                                            }
                                        />
                                        {checked.length > 0
                                            ? `${checked.length} dipilih`
                                            : 'Pilih semua'}
                                    </label>
                                    {checked.length > 0 && (
                                        <Button
                                            type="button"
                                            variant="quiet"
                                            size="sm"
                                            onClick={() => setChecked([])}
                                        >
                                            Batal pilih
                                        </Button>
                                    )}
                                </div>
                            )}
                            <ul className="flex flex-col gap-3">
                                {visible.map((item) => (
                                    <li key={item.id}>
                                        <QueueCard
                                            item={item}
                                            waiting={waiting}
                                            active={selected?.id === item.id}
                                            checked={checked.includes(item.id)}
                                            onCheck={(value) =>
                                                toggle(item.id, value)
                                            }
                                            onSelect={() => select(item.id)}
                                        />
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>

                <div className="min-w-0 flex-[1.3_1_520px] lg:sticky lg:top-[calc(var(--menu-bar-height)+20px)]">
                    {selected ? (
                        <DecisionPanel key={selected.id} request={selected} />
                    ) : (
                        <EmptyDetail description="Pilih pengajuan untuk melihat detail dan memutuskan." />
                    )}
                </div>
            </div>
        </div>
    );
}
