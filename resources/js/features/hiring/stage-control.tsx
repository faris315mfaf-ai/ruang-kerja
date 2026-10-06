import { router } from '@inertiajs/react';
import { ArrowRightLeft, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { hiringUrls, manualTargets, STAGE_LABELS } from './lib';
import type { CandidateStage } from './types';

/** First validation message of an Inertia error bag. */
export function firstError(errors: Record<string, string>): string {
    return Object.values(errors)[0] ?? 'Terjadi kesalahan. Coba lagi.';
}

/**
 * PUT /hiring/kandidat/{id}/tahap. Errors (checklist not done, no approver)
 * come back as validation errors and are shown as a toast.
 */
export function moveCandidate(
    candidateId: string,
    stage: CandidateStage,
    reason: string | null,
    options: { onSuccess?: () => void; onFinish?: () => void } = {},
): void {
    router.put(
        hiringUrls.stage(candidateId),
        { stage, reason },
        {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => options.onSuccess?.(),
            onError: (errors) => {
                toast.error(firstError(errors));
            },
            onFinish: () => options.onFinish?.(),
        },
    );
}

/**
 * "Pindahkan ke…" menu (HR) on a board card or the profile header. Picking
 * "Ditolak" asks for a reason first; Diterima is never offered (approvers).
 */
export function StageMenu({
    candidateId,
    candidateName,
    stage,
    size = 'sm',
    className,
}: {
    candidateId: string;
    candidateName: string;
    stage: CandidateStage;
    size?: 'sm' | 'default' | 'lg';
    className?: string;
}) {
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    const move = (target: CandidateStage) => {
        if (target === 'rejected') {
            setRejecting(true);

            return;
        }

        setBusy(true);
        moveCandidate(candidateId, target, null, {
            onFinish: () => setBusy(false),
        });
    };

    const reject = (event: React.FormEvent) => {
        event.preventDefault();

        if (reason.trim() === '') {
            toast.error('Tulis alasan penolakan.');

            return;
        }

        setBusy(true);
        moveCandidate(candidateId, 'rejected', reason.trim(), {
            onSuccess: () => {
                setRejecting(false);
                setReason('');
            },
            onFinish: () => setBusy(false),
        });
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        size={size}
                        disabled={busy}
                        className={cn(className)}
                        aria-label={`Pindahkan tahap ${candidateName}`}
                    >
                        <ArrowRightLeft aria-hidden />
                        Pindahkan
                        <ChevronDown aria-hidden />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-56">
                    <DropdownMenuLabel>Pindahkan ke</DropdownMenuLabel>
                    {manualTargets(stage).map((target) => (
                        <DropdownMenuItem
                            key={target}
                            onSelect={() => move(target)}
                            className={cn(
                                target === 'rejected' && 'text-danger',
                            )}
                        >
                            {STAGE_LABELS[target]}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={rejecting} onOpenChange={setRejecting}>
                <DialogContent className="sm:max-w-lg">
                    <form onSubmit={reject} className="flex flex-col gap-5">
                        <DialogHeader>
                            <DialogTitle>Tolak {candidateName}?</DialogTitle>
                            <DialogDescription>
                                Alasan disimpan di profil kandidat dan hanya
                                terlihat oleh tim hiring.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor={`reject-${candidateId}`}>
                                Alasan penolakan
                            </Label>
                            <Textarea
                                id={`reject-${candidateId}`}
                                value={reason}
                                onChange={(event) =>
                                    setReason(event.target.value)
                                }
                                maxLength={2000}
                                required
                            />
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="quiet"
                                onClick={() => setRejecting(false)}
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                variant="destructive"
                                disabled={busy}
                            >
                                Tolak kandidat
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
