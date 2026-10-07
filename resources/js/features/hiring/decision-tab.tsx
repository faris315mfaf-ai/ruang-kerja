import { useForm } from '@inertiajs/react';
import { Check, CircleCheck, CircleX, Clock, X } from 'lucide-react';
import { toast } from 'sonner';
import InputError from '@/components/input-error';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/ui/panel';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { hiringUrls, STAGE_LABELS } from './lib';
import type { CandidateProfileProps } from './types';

function DecisionForm({
    candidateId,
    blockedItems,
    mobile,
}: {
    candidateId: string;
    blockedItems: number;
    mobile: boolean;
}) {
    const form = useForm<{ decision: 'approve' | 'reject'; note: string }>({
        decision: 'approve',
        note: '',
    });

    const submit = (decision: 'approve' | 'reject') => {
        if (decision === 'reject' && form.data.note.trim() === '') {
            form.setError('note', 'Tulis alasan penolakan.');

            return;
        }

        form.transform((data) => ({ ...data, decision }));
        form.post(hiringUrls.decision(candidateId), {
            preserveScroll: true,
            onSuccess: () => form.reset(),
            onError: (errors) => {
                if (errors.decision) {
                    toast.error(errors.decision);
                }
            },
        });
    };

    return (
        <Panel title="Keputusan Anda">
            <div className="flex flex-col gap-3">
                <Label htmlFor="decision-note">
                    Catatan (wajib bila menolak)
                </Label>
                <Textarea
                    id="decision-note"
                    value={form.data.note}
                    maxLength={2000}
                    onChange={(event) =>
                        form.setData('note', event.target.value)
                    }
                    placeholder="Alasan atau pertimbangan Anda"
                />
                <InputError
                    message={form.errors.note ?? form.errors.decision}
                />
                {blockedItems > 0 && (
                    <p className="text-meta text-warning">
                        Centang dulu {blockedItems} butir checklist wajib Anda
                        (tab Checklist) sebelum menyetujui.
                    </p>
                )}
                <div className={cn('flex gap-3', mobile && 'flex-col-reverse')}>
                    <Button
                        type="button"
                        variant="outline"
                        size={mobile ? 'lg' : 'default'}
                        className="text-danger"
                        disabled={form.processing}
                        onClick={() => submit('reject')}
                    >
                        <X aria-hidden />
                        Tolak
                    </Button>
                    <Button
                        type="button"
                        size={mobile ? 'lg' : 'default'}
                        disabled={form.processing || blockedItems > 0}
                        onClick={() => submit('approve')}
                    >
                        <Check aria-hidden />
                        Setujui
                    </Button>
                </div>
            </div>
        </Panel>
    );
}

/**
 * Tab Keputusan: each final approver's decision; the approver's own form
 * while the candidate is in "Keputusan akhir". All approve → Diterima, one
 * rejects → Ditolak (automatic).
 */
export function DecisionTab({
    candidate,
    decisions,
    can,
    blockers,
    mobile,
}: Pick<
    CandidateProfileProps,
    'candidate' | 'decisions' | 'can' | 'blockers'
> & {
    mobile: boolean;
}) {
    return (
        <div className="flex flex-col gap-5">
            <p className="rounded-lg border border-border bg-surface px-5 py-4 text-[15px] text-text-muted">
                {candidate.stage === 'final_review'
                    ? 'Kandidat menunggu keputusan akhir. Diterima bila semua penyetuju menyetujui; ditolak bila salah satu menolak.'
                    : candidate.stage === 'hired' ||
                        candidate.stage === 'rejected'
                      ? `Hasil akhir: ${STAGE_LABELS[candidate.stage]}${candidate.decided_at ? ` · ${formatDateTime(candidate.decided_at)}` : ''}.`
                      : 'Penyetuju akhir memutus setelah HR memindahkan kandidat ke tahap Keputusan akhir.'}
            </p>
            {can.decide && (
                <DecisionForm
                    candidateId={candidate.id}
                    blockedItems={blockers.my_approval}
                    mobile={mobile}
                />
            )}
            <Panel title="Penyetuju akhir" flush>
                {decisions.length === 0 ? (
                    <p className="px-6 text-[15px] text-text-muted md:px-7">
                        Lowongan ini belum punya penyetuju akhir.
                    </p>
                ) : (
                    <ul className="flex flex-col divide-y divide-divider">
                        {decisions.map((row, index) => (
                            <li
                                key={row.approver?.id ?? index}
                                className="flex items-start gap-3.5 px-6 py-4 md:px-7"
                            >
                                <UserAvatar
                                    name={row.approver?.name ?? 'Penyetuju'}
                                    src={row.approver?.avatar}
                                    className="size-10"
                                />
                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                    <span className="text-[16px] font-semibold text-text">
                                        {row.approver?.name ?? 'Penyetuju'}
                                    </span>
                                    {row.decided_at && (
                                        <span className="text-meta text-text-muted">
                                            {formatDateTime(row.decided_at)}
                                        </span>
                                    )}
                                    {row.note && (
                                        <span className="text-[15px] break-words whitespace-pre-wrap text-text">
                                            {row.note}
                                        </span>
                                    )}
                                </div>
                                {row.decision === 'approve' ? (
                                    <Badge
                                        variant="status"
                                        tone="success"
                                        className="h-7 text-[14px]"
                                    >
                                        <CircleCheck aria-hidden />
                                        Setuju
                                    </Badge>
                                ) : row.decision === 'reject' ? (
                                    <Badge
                                        variant="status"
                                        tone="danger"
                                        className="h-7 text-[14px]"
                                    >
                                        <CircleX aria-hidden />
                                        Menolak
                                    </Badge>
                                ) : (
                                    <Badge
                                        variant="status"
                                        tone="neutral"
                                        className="h-7 text-[14px]"
                                    >
                                        <Clock aria-hidden />
                                        Belum
                                    </Badge>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>
        </div>
    );
}
