import { Link, router } from '@inertiajs/react';
import { FileText, Plus } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { TabNav } from '@/components/ui/tabs';
import {
    formatMonthYear,
    formatRequestPeriod,
    formatRequestTitle,
    officeDay,
    stepProgress,
} from '@/lib/requests';
import { cn, focusRing } from '@/lib/utils';
import { create, index } from '@/routes/requests';
import type { RequestItem } from '@/types/requests';
import { BalanceCardView, highlightIndex } from './balance-cards';
import { CategoryTile, StatusBadge } from './badges';
import { FILTERS } from './my-requests-filters';
import type { MyRequestsProps } from './my-requests-filters';
import { RequestActions } from './request-actions';
import { RequestDetailCard } from './request-detail-card';
import { EmptyDetail } from './request-parts';

/** "langkah 1/2 · menunggu Hana" for pending rows. */
export function waitingText(item: RequestItem): string | null {
    const progress = item.status === 'pending' ? stepProgress(item) : null;

    if (!progress) {
        return null;
    }

    const who =
        item.waiting?.approver?.name.split(' ')[0] ?? item.waiting?.label;

    return `langkah ${progress.replace(' dari ', '/')}${who ? ` · menunggu ${who}` : ''}`;
}

function RequestCardButton({
    item,
    active,
    onSelect,
}: {
    item: RequestItem;
    active: boolean;
    onSelect: () => void;
}) {
    const waiting = waitingText(item);
    const note =
        item.decision_note?.note && item.status !== 'pending'
            ? item.decision_note.note
            : null;

    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={active}
            className={cn(
                'flex w-full items-center gap-3.5 rounded-card border bg-surface p-[18px] text-left transition-[border-color,box-shadow] duration-120 ease-brand',
                active
                    ? 'border-2 border-primary p-[17px] shadow-card ring-4 ring-ring/40'
                    : 'border-border shadow-card hover:border-border-strong',
                focusRing,
            )}
        >
            <CategoryTile category={item.type.category} />
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="text-[17px] leading-6 font-bold text-text">
                    {formatRequestTitle(item)}
                </span>
                <span className="text-[15px] leading-[22px] text-text-muted">
                    {formatRequestPeriod(item)}
                    <span className="font-mono text-[14px]">
                        {' · '}
                        {item.number ?? 'DRAF'}
                    </span>
                </span>
                {(waiting || note) && (
                    <span className="truncate text-[15px] leading-[22px] text-text-muted">
                        {waiting ?? `“${note}”`}
                    </span>
                )}
            </span>
            <StatusBadge
                status={item.status}
                label={item.status_label}
                className="h-[30px] px-3 text-[14px]"
            />
        </button>
    );
}

export function MyRequestsDesktop({
    filter,
    counts,
    requests,
    selected,
    balances,
    since,
}: MyRequestsProps) {
    const select = (id: string) =>
        router.get(
            index.url({
                query: {
                    status: filter === 'semua' ? undefined : filter,
                    pilih: id,
                },
            }),
            {},
            {
                only: ['selected'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );

    const sinceParts = since ? officeDay(since) : null;
    const highlight = highlightIndex(balances);
    const cards = balances.slice(0, 4);

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-display text-text">Pengajuan saya</h1>
                    <p className="text-body-lg text-text-muted">
                        Cuti, izin, sakit, lembur, koreksi absensi, dan dinas
                        luar
                    </p>
                </div>
                <Button asChild size="lg">
                    <Link href={create()}>
                        <Plus aria-hidden strokeWidth={2.4} /> Ajukan baru
                    </Link>
                </Button>
            </header>

            {cards.length > 0 && (
                <section aria-label="Saldo" className="flex flex-wrap gap-4">
                    {cards.map((card, i) => (
                        <BalanceCardView
                            key={card.type.id}
                            card={card}
                            highlight={i === highlight}
                            className={
                                i === highlight
                                    ? 'flex-[1.4_1_300px]'
                                    : 'flex-[1_1_200px]'
                            }
                        />
                    ))}
                </section>
            )}

            <TabNav
                preserveScroll
                label="Filter status"
                items={FILTERS.map((item) => ({
                    href: index.url({
                        query:
                            item.value === 'semua'
                                ? {}
                                : { status: item.value },
                    }),
                    label: item.label,
                    active: filter === item.value,
                    count:
                        (item.value === 'semua' || item.value === 'menunggu') &&
                        counts[item.value] > 0
                            ? counts[item.value]
                            : undefined,
                }))}
            />

            <div className="flex flex-wrap items-start gap-5">
                <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-3">
                    {requests.length === 0 ? (
                        <EmptyState
                            icon={FileText}
                            title={
                                filter === 'semua'
                                    ? 'Belum ada pengajuan'
                                    : 'Tidak ada pengajuan dengan status ini'
                            }
                            description="Ajukan cuti, izin, sakit, lembur, koreksi absensi, atau dinas luar."
                            action={
                                <Button asChild>
                                    <Link href={create()}>Ajukan baru</Link>
                                </Button>
                            }
                        />
                    ) : (
                        <>
                            <ul className="flex flex-col gap-3">
                                {requests.map((item) => (
                                    <li key={item.id}>
                                        <RequestCardButton
                                            item={item}
                                            active={selected?.id === item.id}
                                            onSelect={() => select(item.id)}
                                        />
                                    </li>
                                ))}
                            </ul>
                            <p className="px-1 text-meta text-text-muted">
                                {counts.semua} pengajuan
                                {sinceParts
                                    ? ` sejak ${formatMonthYear(sinceParts.year, sinceParts.month)}`
                                    : ''}
                            </p>
                        </>
                    )}
                </div>

                <div className="min-w-0 flex-[1.25_1_520px] lg:sticky lg:top-[calc(var(--menu-bar-height)+20px)]">
                    {selected ? (
                        <RequestDetailCard
                            request={selected}
                            footer={
                                selected.can.cancel || selected.can.edit ? (
                                    <RequestActions request={selected} />
                                ) : undefined
                            }
                        />
                    ) : (
                        <EmptyDetail />
                    )}
                </div>
            </div>
        </div>
    );
}
