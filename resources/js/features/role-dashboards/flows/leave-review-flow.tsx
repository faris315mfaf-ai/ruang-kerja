import { CheckCircle2 } from 'lucide-react';
import { useId, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { RequestDetailCard } from '@/features/requests/request-detail-card';
import { cn, focusRing } from '@/lib/utils';
import { approve, reject, revise } from '@/routes/roles/approvals';
import type { LeaveReviewFlowData, RoleKey } from '../types';
import { submitFlowAction } from './submit';
import type { FlowProps } from './surface';
import { FlowSurface } from './surface';

type Kind = 'approve' | 'reject' | 'revise';

const ROUTES = { approve, reject, revise } as const;

const FAILURE: Record<Kind, string> = {
    approve: 'Pengajuan gagal disetujui.',
    reject: 'Pengajuan gagal ditolak.',
    revise: 'Permintaan revisi gagal dikirim.',
};

/**
 * HR "Tinjau cuti" (PHRCuti): the full request (period, balance impact,
 * colleagues absent, approval trail — RequestDetailCard) and the decision,
 * with the Fase 1 actions. Absences come first in the queue; another request
 * is loaded on demand (`?pilih=`, partial reload of `flow`).
 */
export function LeaveReviewFlowSheet({
    role,
    data,
    loading,
    onSelect,
    ...props
}: FlowProps & {
    role: RoleKey;
    data: LeaveReviewFlowData;
    loading: boolean;
    onSelect: (id: string) => void;
}) {
    const noteId = useId();
    const [note, setNote] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<Kind | null>(null);
    const selected = data.selected;
    const waitingOnOther = loading;
    const canDecide = selected?.can.decide ?? false;

    const decide = (kind: Kind) => {
        if (!selected) {
            return;
        }

        if (kind !== 'approve' && note.trim() === '') {
            setError(
                kind === 'reject'
                    ? 'Alasan wajib diisi saat menolak.'
                    : 'Catatan wajib diisi saat meminta revisi.',
            );

            return;
        }

        submitFlowAction(
            ROUTES[kind].url({ role, employeeRequest: selected.id }),
            { note: note.trim() === '' ? null : note.trim() },
            {
                failure: FAILURE[kind],
                onStart: () => setBusy(kind),
                onSuccess: () => {
                    setNote('');
                    setError(null);
                },
                onFinish: () => setBusy(null),
            },
        );
    };

    return (
        <FlowSurface
            {...props}
            title="Tinjau pengajuan"
            description={
                data.total > 0
                    ? `${data.total} menunggu keputusan Anda · cuti & izin lebih dulu`
                    : 'Tidak ada yang menunggu keputusan Anda.'
            }
            footer={
                selected && canDecide && !waitingOnOther ? (
                    <div className="grid grid-cols-[auto_1fr_2fr] gap-2">
                        <Button
                            variant="quiet"
                            size="lg"
                            className="px-3"
                            disabled={busy !== null}
                            onClick={() => decide('revise')}
                        >
                            {busy === 'revise' && <Spinner />}
                            Revisi
                        </Button>
                        <Button
                            variant="outline"
                            size="lg"
                            className="font-bold text-danger"
                            disabled={busy !== null}
                            onClick={() => decide('reject')}
                        >
                            {busy === 'reject' && <Spinner />}
                            Tolak
                        </Button>
                        <Button
                            size="lg"
                            disabled={busy !== null}
                            onClick={() => decide('approve')}
                        >
                            {busy === 'approve' && <Spinner />}
                            Setujui
                        </Button>
                    </div>
                ) : undefined
            }
        >
            {data.items.length > 1 && (
                <div
                    role="radiogroup"
                    aria-label="Pilih pengajuan"
                    className="-mx-1 flex [scrollbar-width:none] gap-2 overflow-x-auto px-1 py-1 [&::-webkit-scrollbar]:hidden"
                >
                    {data.items.map((item) => {
                        const active = selected?.id === item.id;

                        return (
                            <button
                                key={item.id}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => onSelect(item.id)}
                                className={cn(
                                    'inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-[15px] font-bold whitespace-nowrap transition-colors duration-120 ease-brand',
                                    active
                                        ? 'border-transparent bg-grad-aksi text-on-brand'
                                        : 'border-border bg-surface text-text hover:bg-surface-2',
                                    focusRing,
                                )}
                            >
                                {item.user.name.split(' ')[0]} ·{' '}
                                {item.type.code}
                            </button>
                        );
                    })}
                </div>
            )}

            {waitingOnOther ? (
                <div
                    className="flex flex-col gap-3"
                    aria-busy
                    aria-label="Memuat"
                >
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-64 w-full rounded-panel" />
                </div>
            ) : !selected ? (
                <EmptyState
                    size="sm"
                    icon={CheckCircle2}
                    title="Tidak ada yang menunggu"
                >
                    Pengajuan baru yang perlu keputusan Anda muncul di sini.
                </EmptyState>
            ) : (
                <>
                    <RequestDetailCard
                        request={selected}
                        className="shadow-none"
                    />
                    {canDecide ? (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor={noteId}>
                                Catatan untuk pemohon{' '}
                                <span className="font-normal text-text-muted">
                                    (opsional bila menyetujui)
                                </span>
                            </Label>
                            <Textarea
                                id={noteId}
                                value={note}
                                rows={3}
                                maxLength={1000}
                                className="min-h-24 text-[17px] md:text-[16px]"
                                placeholder="Wajib diisi bila menolak atau meminta revisi"
                                aria-invalid={error ? true : undefined}
                                aria-describedby={`${noteId}-hint`}
                                onChange={(event) => {
                                    setNote(event.target.value);
                                    setError(null);
                                }}
                            />
                            <p
                                id={`${noteId}-hint`}
                                className={cn(
                                    'text-[14px]',
                                    error ? 'text-danger' : 'text-text-muted',
                                )}
                            >
                                {error ??
                                    `Terlihat oleh ${selected.user.name.split(' ')[0]} dan penyetuju lain.`}
                            </p>
                        </div>
                    ) : (
                        <p className="text-[15px] text-text-muted">
                            Pengajuan ini bukan giliran Anda untuk diputus.
                        </p>
                    )}
                </>
            )}
        </FlowSurface>
    );
}
