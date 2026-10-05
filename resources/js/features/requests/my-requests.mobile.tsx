import { Link, router } from '@inertiajs/react';
import { FileText, MessageSquare, Plus } from 'lucide-react';
import { Fragment } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { Fab } from '@/components/mobile/fab';
import { formatRelative } from '@/lib/format';
import {
    formatRequestPeriod,
    formatRequestTitle,
    formatShortDate,
} from '@/lib/requests';
import { cn, focusRing } from '@/lib/utils';
import { create, index, show } from '@/routes/requests';
import type { RequestItem } from '@/types/requests';
import { BalanceCardView, highlightIndex } from './balance-cards';
import { StatusBadge } from './badges';
import { FILTERS } from './my-requests-filters';
import type { MyRequestsProps, RequestFilter } from './my-requests-filters';

const chip =
    'inline-flex h-[26px] items-center rounded-full px-2 text-[13px] font-extrabold whitespace-nowrap';

/** "Langkah 1 ✓ — Hana · menunggu — Langkah 3" (MSPengajuanSaya track). */
function StepTrack({ item }: { item: RequestItem }) {
    if (item.status !== 'pending' || item.step_position === null) {
        return null;
    }

    const position = item.step_position;
    const who =
        item.waiting?.approver?.name.split(' ')[0] ?? item.waiting?.label;
    const since = item.waiting?.since
        ? formatRelative(item.waiting.since).replace(/ lalu$/, '')
        : null;

    return (
        <span
            className="flex flex-wrap items-center gap-1.5"
            aria-label={`Langkah ${position} dari ${item.step_count}, menunggu ${who ?? ''}${since && since !== 'baru saja' ? ` sejak ${since}` : ''}`}
        >
            {Array.from({ length: item.step_count }, (_, i) => {
                const step = i + 1;

                return (
                    <Fragment key={step}>
                        {i > 0 && (
                            <span
                                aria-hidden
                                className="h-0.5 w-3.5 bg-border-strong"
                            />
                        )}
                        <span
                            aria-hidden
                            className={cn(
                                chip,
                                step < position &&
                                    'bg-success-soft text-success',
                                step === position &&
                                    'bg-warning-soft text-warning',
                                step > position &&
                                    'bg-surface-2 text-text-muted',
                            )}
                        >
                            {step < position
                                ? `Langkah ${step} ✓`
                                : step === position
                                  ? `${who ?? `Langkah ${step}`} · menunggu`
                                  : `Langkah ${step}`}
                        </span>
                    </Fragment>
                );
            })}
        </span>
    );
}

export function MyRequestsMobile({
    filter,
    counts,
    requests,
    balances,
}: MyRequestsProps) {
    const highlight = highlightIndex(balances);
    const hero = highlight >= 0 ? balances[highlight] : null;
    const others = balances.filter((_, i) => i !== highlight);

    return (
        <div className="flex flex-col gap-3.5">
            {hero && <BalanceCardView card={hero} highlight />}

            {others.length > 0 && (
                <div className="-mx-4 flex snap-x [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-1">
                    {others.map((card) => (
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
                    description="Ketuk Ajukan untuk mengajukan cuti, izin, sakit, atau lembur."
                />
            ) : (
                <ul className="flex flex-col gap-2.5">
                    {requests.map((item) => (
                        <li key={item.id}>
                            <Link
                                href={show({ employeeRequest: item.id })}
                                className={cn(
                                    'flex flex-col gap-2.5 rounded-card border border-border bg-surface px-4 py-3.5 transition-colors duration-120 ease-brand active:bg-surface-2',
                                    focusRing,
                                )}
                            >
                                <span className="flex items-start justify-between gap-2.5">
                                    <span className="flex min-w-0 flex-col gap-0.5">
                                        <span className="text-[17px] leading-6 font-bold text-text">
                                            {formatRequestTitle(item)}
                                        </span>
                                        <span className="text-[15px] leading-[22px] text-text-muted">
                                            {formatRequestPeriod(item)}
                                        </span>
                                    </span>
                                    <StatusBadge
                                        status={item.status}
                                        label={item.status_label}
                                        className="h-7 gap-1.5 px-2.5 text-[13px] font-extrabold"
                                    />
                                </span>
                                <StepTrack item={item} />
                                {item.decision_note?.note &&
                                    item.status !== 'pending' && (
                                        <span
                                            className={cn(
                                                'flex gap-2 rounded-lg px-3 py-2 text-[15px] leading-[22px]',
                                                item.status === 'rejected'
                                                    ? 'bg-danger-soft text-danger'
                                                    : 'bg-info-soft text-info',
                                            )}
                                        >
                                            <MessageSquare
                                                className="mt-1 size-4 shrink-0"
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
                                        </span>
                                    )}
                                <span className="text-meta text-text-muted">
                                    <span className="font-mono font-semibold">
                                        {item.number ?? 'DRAF'}
                                    </span>
                                    {item.status !== 'pending' &&
                                        ` · ${item.submitted_at ? `diajukan ${formatShortDate(item.submitted_at).replace(/ \d{4}$/, '')}` : 'belum dikirim'}`}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}

            <Fab
                label="Ajukan baru"
                onClick={() => router.visit(create.url())}
                className="w-auto gap-2 px-[22px] text-[17px] font-extrabold"
            >
                <Plus className="size-6" strokeWidth={2.4} aria-hidden />
                Ajukan
            </Fab>
        </div>
    );
}
