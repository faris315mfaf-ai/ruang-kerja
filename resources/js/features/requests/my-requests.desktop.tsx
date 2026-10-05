import { Link, router } from '@inertiajs/react';
import { FileText, Plus } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import {
    formatMonthYear,
    formatRequestDuration,
    formatRequestPeriod,
    formatShortDate,
    officeDay,
    stepProgress,
} from '@/lib/requests';
import { cn } from '@/lib/utils';
import { create, index } from '@/routes/requests';
import { BalanceCardView } from './balance-cards';
import { CategoryBadge, StatusBadge } from './badges';
import { RequestActions } from './request-actions';
import { RequestDetailCard } from './request-detail-card';
import { EmptyDetail } from './request-parts';
import { FILTERS } from './my-requests-filters';
import type { MyRequestsProps } from './my-requests-filters';

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

    return (
        <div className="mx-auto max-w-[1200px] space-y-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl leading-7 font-semibold text-text">
                        Pengajuan saya
                    </h1>
                    <p className="text-sm text-text-muted">
                        Cuti, izin, sakit, lembur, koreksi absensi, dan dinas
                        luar yang pernah Anda ajukan.
                    </p>
                </div>
                <Button asChild>
                    <Link href={create()}>
                        <Plus aria-hidden /> Ajukan baru
                    </Link>
                </Button>
            </header>

            {balances.length > 0 && (
                <div className="grid gap-4 md:grid-cols-3">
                    {balances.slice(0, 3).map((card) => (
                        <BalanceCardView key={card.type.id} card={card} />
                    ))}
                </div>
            )}

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
                <div className="min-w-0 space-y-3">
                    <nav
                        aria-label="Filter status"
                        className="inline-flex rounded-lg bg-surface-2 p-1"
                    >
                        {FILTERS.map((item) => (
                            <Link
                                key={item.value}
                                href={index({
                                    query:
                                        item.value === 'semua'
                                            ? {}
                                            : { status: item.value },
                                })}
                                preserveScroll
                                aria-current={
                                    filter === item.value ? 'page' : undefined
                                }
                                className={cn(
                                    'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm',
                                    filter === item.value
                                        ? 'bg-surface font-medium text-text shadow-card'
                                        : 'text-text-muted hover:text-text',
                                )}
                            >
                                {item.label}
                                {counts[item.value] > 0 &&
                                    (item.value === 'semua' ||
                                        item.value === 'menunggu') && (
                                        <span
                                            className={cn(
                                                'text-xs tnum',
                                                item.value === 'menunggu' &&
                                                    'rounded-full bg-warning-soft px-1.5 text-warning',
                                            )}
                                        >
                                            {counts[item.value]}
                                        </span>
                                    )}
                            </Link>
                        ))}
                    </nav>

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
                                <Button asChild size="sm">
                                    <Link href={create()}>Ajukan baru</Link>
                                </Button>
                            }
                        />
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
                            <table className="w-full text-sm">
                                <thead className="bg-surface-2/60 text-left text-[13px] text-text-muted">
                                    <tr>
                                        <th
                                            scope="col"
                                            className="px-4 py-2.5 font-normal"
                                        >
                                            Nomor
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-3 py-2.5 font-normal"
                                        >
                                            Jenis
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-3 py-2.5 font-normal"
                                        >
                                            Waktu
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-3 py-2.5 text-right font-normal"
                                        >
                                            Durasi
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-3 py-2.5 font-normal"
                                        >
                                            Status
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-2.5 text-right font-normal"
                                        >
                                            Diajukan
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {requests.map((item) => {
                                        const active = selected?.id === item.id;
                                        const progress =
                                            item.status === 'pending'
                                                ? stepProgress(item)
                                                : null;

                                        return (
                                            <tr
                                                key={item.id}
                                                onClick={() => select(item.id)}
                                                className={cn(
                                                    'cursor-pointer border-t border-border align-top transition-colors hover:bg-surface-2/60',
                                                    active &&
                                                        'bg-brand-50/60 shadow-[inset_3px_0_0_var(--primary)] dark:bg-brand-500/10',
                                                )}
                                            >
                                                <td className="px-4 py-3">
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            select(item.id);
                                                        }}
                                                        aria-pressed={active}
                                                        className="font-mono text-[13px] whitespace-nowrap text-text focus-visible:underline focus-visible:outline-none"
                                                    >
                                                        {item.number ?? 'DRAF'}
                                                    </button>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <CategoryBadge
                                                        type={item.type}
                                                    />
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap text-text">
                                                    {formatRequestPeriod(item)}
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap text-text tnum">
                                                    {formatRequestDuration(
                                                        item,
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <StatusBadge
                                                        status={item.status}
                                                        label={
                                                            item.status_label
                                                        }
                                                        suffix={
                                                            progress
                                                                ? `langkah ${progress.replace(' dari ', '/')}`
                                                                : null
                                                        }
                                                    />
                                                    {item.decision_note?.note &&
                                                        item.status !==
                                                            'pending' && (
                                                            <p className="mt-1 max-w-56 text-[13px] text-text-muted">
                                                                “
                                                                {
                                                                    item
                                                                        .decision_note
                                                                        .note
                                                                }
                                                                ”
                                                            </p>
                                                        )}
                                                </td>
                                                <td className="px-4 py-3 text-right whitespace-nowrap text-text-muted">
                                                    {formatShortDate(
                                                        item.submitted_at ??
                                                            item.created_at,
                                                    ).replace(/ \d{4}$/, '')}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <p className="border-t border-border px-4 py-3 text-[13px] text-text-muted">
                                {counts.semua} pengajuan
                                {sinceParts
                                    ? ` sejak ${formatMonthYear(sinceParts.year, sinceParts.month)}`
                                    : ''}
                            </p>
                        </div>
                    )}
                </div>

                <div className="lg:sticky lg:top-20">
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
