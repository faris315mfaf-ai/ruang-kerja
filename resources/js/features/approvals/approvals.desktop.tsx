import { Link, router } from '@inertiajs/react';
import { CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CategoryBadge, TonePill } from '@/features/requests/badges';
import { RequestDetailCard } from '@/features/requests/request-detail-card';
import { EmptyDetail } from '@/features/requests/request-parts';
import { formatRelative } from '@/lib/format';
import {
    approvalTone,
    formatRequestDuration,
    formatRequestPeriod,
    stepProgress,
} from '@/lib/requests';
import { cn } from '@/lib/utils';
import { bulk, index } from '@/routes/approvals';
import type { RequestDetail } from '@/types/requests';
import type { ApprovalTab, ApprovalsProps } from './approvals-types';
import { DecisionButtons, DecisionNote } from './decision-controls';
import { DelegationDialog } from './delegation-dialog';
import { useDecision } from './use-decision';

function DecisionPanel({ request }: { request: RequestDetail }) {
    const decision = useDecision(request.id);

    return (
        <RequestDetailCard
            request={request}
            showRequester
            statusLabel={request.can.decide ? 'Menunggu Anda' : undefined}
            footer={
                request.can.decide ? (
                    <div className="space-y-4">
                        <DecisionNote
                            decision={decision}
                            requesterName={request.user.name}
                        />
                        <DecisionButtons decision={decision} />
                    </div>
                ) : undefined
            }
        />
    );
}

export function ApprovalsDesktop({
    tab,
    counts,
    items,
    selected,
    scope,
    delegations,
}: ApprovalsProps) {
    const [checked, setChecked] = useState<string[]>([]);
    const [processing, setProcessing] = useState(false);
    const waiting = tab === 'menunggu';
    const allChecked = items.length > 0 && checked.length === items.length;

    const select = (id: string) =>
        router.get(
            index.url({
                query: { tab: waiting ? undefined : 'diputus', pilih: id },
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

    return (
        <div className="mx-auto max-w-[1280px] space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl leading-7 font-semibold text-text">
                        Persetujuan
                    </h1>
                    <p className="text-sm text-text-muted">{scope}</p>
                </div>
                <div className="flex items-center gap-2">
                    <DelegationDialog delegations={delegations} />
                    <nav
                        aria-label="Tab persetujuan"
                        className="inline-flex rounded-lg bg-surface-2 p-1"
                    >
                        {(['menunggu', 'diputus'] as ApprovalTab[]).map(
                            (value) => (
                                <Link
                                    key={value}
                                    href={index({
                                        query:
                                            value === 'menunggu'
                                                ? {}
                                                : { tab: value },
                                    })}
                                    aria-current={
                                        tab === value ? 'page' : undefined
                                    }
                                    className={cn(
                                        'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm',
                                        tab === value
                                            ? 'bg-surface font-medium text-text shadow-card'
                                            : 'text-text-muted hover:text-text',
                                    )}
                                >
                                    {value === 'menunggu'
                                        ? 'Menunggu'
                                        : 'Sudah diputus'}
                                    {value === 'menunggu' &&
                                        counts.menunggu > 0 && (
                                            <span className="text-xs tnum">
                                                {counts.menunggu}
                                            </span>
                                        )}
                                </Link>
                            ),
                        )}
                    </nav>
                </div>
            </header>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
                {items.length === 0 ? (
                    <EmptyState
                        icon={CheckCheck}
                        title={
                            waiting
                                ? 'Tidak ada yang menunggu keputusan Anda'
                                : 'Belum ada keputusan'
                        }
                        description={
                            waiting
                                ? 'Pengajuan baru dari tim Anda akan muncul di sini.'
                                : 'Pengajuan yang Anda setujui atau tolak tampil di sini.'
                        }
                    />
                ) : (
                    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-card">
                        {waiting && checked.length > 0 && (
                            <div className="flex items-center justify-between gap-3 border-b border-border bg-brand-50/70 px-4 py-2.5 dark:bg-brand-500/10">
                                <p className="text-sm font-medium text-text">
                                    {checked.length} dipilih
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setChecked([])}
                                    >
                                        Batal pilih
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        disabled={processing}
                                        onClick={approveChecked}
                                    >
                                        Setujui {checked.length} pengajuan
                                    </Button>
                                </div>
                            </div>
                        )}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-[13px] text-text-muted">
                                    <tr className="border-b border-border">
                                        {waiting && (
                                            <th
                                                scope="col"
                                                className="w-10 px-4 py-2.5"
                                            >
                                                <Checkbox
                                                    aria-label="Pilih semua"
                                                    checked={allChecked}
                                                    onCheckedChange={(value) =>
                                                        setChecked(
                                                            value === true
                                                                ? items.map(
                                                                      (item) =>
                                                                          item.id,
                                                                  )
                                                                : [],
                                                        )
                                                    }
                                                />
                                            </th>
                                        )}
                                        <th
                                            scope="col"
                                            className="px-3 py-2.5 font-normal"
                                        >
                                            Pemohon
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
                                            className="px-3 py-2.5 font-normal"
                                        >
                                            Durasi
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-3 py-2.5 font-normal"
                                        >
                                            {waiting ? 'Langkah' : 'Keputusan'}
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-2.5 text-right font-normal"
                                        >
                                            {waiting ? 'Diajukan' : 'Diputus'}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item) => {
                                        const active = selected?.id === item.id;

                                        return (
                                            <tr
                                                key={item.id}
                                                onClick={() => select(item.id)}
                                                className={cn(
                                                    'cursor-pointer border-b border-border last:border-0 hover:bg-surface-2/60',
                                                    active &&
                                                        'bg-brand-50/60 shadow-[inset_3px_0_0_var(--primary)] dark:bg-brand-500/10',
                                                )}
                                            >
                                                {waiting && (
                                                    <td
                                                        className="px-4 py-3"
                                                        onClick={(event) =>
                                                            event.stopPropagation()
                                                        }
                                                    >
                                                        <Checkbox
                                                            aria-label={`Pilih pengajuan ${item.user.name}`}
                                                            checked={checked.includes(
                                                                item.id,
                                                            )}
                                                            onCheckedChange={(
                                                                value,
                                                            ) =>
                                                                toggle(
                                                                    item.id,
                                                                    value ===
                                                                        true,
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                )}
                                                <td className="px-3 py-3">
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            select(item.id);
                                                        }}
                                                        className="flex items-center gap-2 text-left focus-visible:underline focus-visible:outline-none"
                                                    >
                                                        <UserAvatar
                                                            name={
                                                                item.user.name
                                                            }
                                                            src={
                                                                item.user.avatar
                                                            }
                                                            className="size-7"
                                                        />
                                                        <span className="font-medium whitespace-nowrap text-text">
                                                            {item.user.name}
                                                        </span>
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
                                                <td className="px-3 py-3 whitespace-nowrap text-text tnum">
                                                    {formatRequestDuration(
                                                        item,
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap text-text-muted">
                                                    {waiting ? (
                                                        stepProgress(item)
                                                    ) : item.my_decision ? (
                                                        <TonePill
                                                            tone={
                                                                approvalTone[
                                                                    item
                                                                        .my_decision
                                                                        .status
                                                                ]
                                                            }
                                                        >
                                                            {
                                                                item.my_decision
                                                                    .status_label
                                                            }
                                                        </TonePill>
                                                    ) : null}
                                                </td>
                                                <td className="px-4 py-3 text-right whitespace-nowrap text-text-muted">
                                                    {formatRelative(
                                                        waiting
                                                            ? item.submitted_at
                                                            : (item.my_decision
                                                                  ?.decided_at ??
                                                                  null),
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="xl:sticky xl:top-20">
                    {selected ? (
                        <DecisionPanel key={selected.id} request={selected} />
                    ) : (
                        <EmptyDetail />
                    )}
                </div>
            </div>
        </div>
    );
}
