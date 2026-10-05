import { Link, router } from '@inertiajs/react';
import { FileText, MessageSquare } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { Fab } from '@/components/mobile/fab';
import { formatRelative } from '@/lib/format';
import {
    formatRequestDuration,
    formatRequestPeriod,
    formatShortDate,
} from '@/lib/requests';
import { cn } from '@/lib/utils';
import { create, index, show } from '@/routes/requests';
import type { RequestItem } from '@/types/requests';
import { BalanceCardView } from './balance-cards';
import { CategoryBadge, StatusBadge } from './badges';
import { FILTERS } from './my-requests-filters';
import type { MyRequestsProps, RequestFilter } from './my-requests-filters';

function Progress({ item }: { item: RequestItem }) {
    if (item.status !== 'pending' || item.step_position === null) {
        return null;
    }

    const who =
        item.waiting?.approver?.name.split(' ')[0] ?? item.waiting?.label;
    const since = item.waiting?.since
        ? formatRelative(item.waiting.since).replace(/ lalu$/, '')
        : null;

    return (
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-[13px] text-text-muted">
            <span className="flex gap-1" aria-hidden>
                {Array.from({ length: item.step_count }, (_, i) => (
                    <span
                        key={i}
                        className={cn(
                            'h-1 w-4 rounded-full',
                            i < item.step_position!
                                ? 'bg-warning'
                                : 'bg-surface-2',
                        )}
                    />
                ))}
            </span>
            <span className="min-w-0 flex-1 truncate">
                {item.step_position}/{item.step_count} · menunggu {who}
                {since && since !== 'baru saja' ? ` sejak ${since}` : ''}
            </span>
        </div>
    );
}

export function MyRequestsMobile({
    filter,
    counts,
    requests,
    balances,
}: MyRequestsProps) {
    return (
        <div className="space-y-4">
            {balances.length > 0 && (
                <div className="-mx-4 flex snap-x [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-1">
                    {balances.map((card) => (
                        <BalanceCardView
                            key={card.type.id}
                            card={card}
                            className="w-[78%] shrink-0 snap-start"
                        />
                    ))}
                </div>
            )}

            <ChipScroller<RequestFilter>
                label="Filter status"
                value={filter}
                onChange={(value) =>
                    router.get(
                        index.url({
                            query: value === 'semua' ? {} : { status: value },
                        }),
                        {},
                        { preserveScroll: true, replace: true },
                    )
                }
                chips={FILTERS.map((item) => ({
                    value: item.value,
                    label: item.label,
                    count:
                        (item.value === 'semua' || item.value === 'menunggu') &&
                        counts[item.value] > 0
                            ? counts[item.value]
                            : undefined,
                }))}
                className="[&>button]:h-11"
            />

            {requests.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    title="Belum ada pengajuan"
                    description="Ketuk + untuk mengajukan cuti, izin, sakit, atau lembur."
                />
            ) : (
                <ul className="space-y-3">
                    {requests.map((item) => (
                        <li key={item.id}>
                            <Link
                                href={show({ employeeRequest: item.id })}
                                className="block rounded-xl border border-border bg-surface p-4 shadow-card active:bg-surface-2"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-[13px] text-text-muted">
                                        {item.number ?? 'DRAF'}
                                    </span>
                                    <StatusBadge
                                        status={item.status}
                                        label={item.status_label}
                                    />
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <CategoryBadge type={item.type} />
                                    <span className="text-[15px] text-text">
                                        {formatRequestPeriod(item)}
                                    </span>
                                    <span className="text-[13px] text-text-muted">
                                        · {formatRequestDuration(item)}
                                    </span>
                                </div>
                                {item.decision_note?.note &&
                                    item.status !== 'pending' && (
                                        <p
                                            className={cn(
                                                'mt-3 flex gap-2 rounded-lg px-3 py-2 text-[13px]',
                                                item.status === 'rejected'
                                                    ? 'bg-danger-soft text-danger'
                                                    : 'bg-info-soft text-info',
                                            )}
                                        >
                                            <MessageSquare
                                                className="mt-0.5 size-3.5 shrink-0"
                                                aria-hidden
                                            />
                                            <span>
                                                “{item.decision_note.note}”
                                                {item.decision_note.by
                                                    ? ` · ${item.decision_note.by.split(' ')[0]}`
                                                    : ''}
                                                {item.decision_note.at
                                                    ? `, ${formatShortDate(item.decision_note.at).replace(/ \d{4}$/, '')}`
                                                    : ''}
                                            </span>
                                        </p>
                                    )}
                                <Progress item={item} />
                                {item.status !== 'pending' && (
                                    <p className="mt-2 text-[13px] text-text-muted">
                                        {item.submitted_at
                                            ? `Diajukan ${formatShortDate(item.submitted_at).replace(/ \d{4}$/, '')}`
                                            : 'Belum dikirim'}
                                    </p>
                                )}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}

            <Fab
                label="Ajukan baru"
                onClick={() => router.visit(create.url())}
            />
        </div>
    );
}
