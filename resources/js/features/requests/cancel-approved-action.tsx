import { useForm } from '@inertiajs/react';
import { AlertTriangle, Ban, CircleCheck } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/lib/format';
import { formatRequestPeriod } from '@/lib/requests';
import { cn } from '@/lib/utils';
import { cancelApproved } from '@/routes/approvals';
import type { CancelPreview, RequestDetail } from '@/types/requests';
import { cancelEffects } from './cancel-approved';

/**
 * "Dibatalkan oleh HR setelah disetujui" banner on a voided request (requester
 * and approvers), with the reason when the viewer may read it.
 */
export function CancellationNotice({
    request,
    className,
}: {
    request: Pick<RequestDetail, 'status' | 'cancellation'>;
    className?: string;
}) {
    const canceled = request.cancellation;

    if (request.status !== 'canceled' || !canceled?.after_approval) {
        return null;
    }

    return (
        <Alert variant="destructive" className={className}>
            <Ban aria-hidden />
            <AlertTitle className="line-clamp-none">
                Dibatalkan setelah disetujui
            </AlertTitle>
            <AlertDescription className="flex flex-col gap-1">
                <span>
                    {canceled.by ? `Oleh ${canceled.by.name}` : 'Oleh HR'}
                    {canceled.at ? ` · ${formatDateTime(canceled.at)}` : ''}.
                    Saldo dan absensi terkait sudah disesuaikan.
                </span>
                {canceled.reason && <span>Alasan: “{canceled.reason}”</span>}
            </AlertDescription>
        </Alert>
    );
}

function CancelBody({
    request,
    preview,
    form,
    mobile,
}: {
    request: RequestDetail;
    preview: CancelPreview;
    form: ReturnType<typeof useForm<{ reason: string }>>;
    mobile: boolean;
}) {
    const { effects, pastWarning, blocker } = cancelEffects(request, preview);
    const length = form.data.reason.trim().length;

    return (
        <div className="flex flex-col gap-4">
            {blocker ? (
                <Alert variant="destructive">
                    <AlertTriangle aria-hidden />
                    <AlertDescription>{blocker}</AlertDescription>
                </Alert>
            ) : (
                <>
                    <ul
                        className="flex flex-col gap-2"
                        aria-label="Akibat pembatalan"
                    >
                        {effects.map((effect) => (
                            <li
                                key={effect}
                                className="flex gap-2.5 text-[15px] leading-[22px] text-text"
                            >
                                <CircleCheck
                                    className="mt-0.5 size-[18px] shrink-0 text-text-muted"
                                    aria-hidden
                                />
                                {effect}
                            </li>
                        ))}
                    </ul>
                    {pastWarning && (
                        <Alert variant="warning">
                            <AlertTriangle aria-hidden />
                            <AlertDescription>{pastWarning}</AlertDescription>
                        </Alert>
                    )}
                    <div className="grid gap-2">
                        <Label htmlFor={`cancel-reason-${request.id}`}>
                            Alasan pembatalan
                        </Label>
                        <Textarea
                            id={`cancel-reason-${request.id}`}
                            rows={3}
                            maxLength={preview.reason_max}
                            required
                            aria-invalid={form.errors.reason ? true : undefined}
                            aria-describedby={`cancel-reason-hint-${request.id}`}
                            className={cn(
                                'min-h-24',
                                mobile && 'min-h-28 text-[17px]',
                            )}
                            placeholder="Mis. proyek darurat, cuti dijadwalkan ulang bersama karyawan."
                            value={form.data.reason}
                            onChange={(event) => {
                                form.setData('reason', event.target.value);
                                form.clearErrors('reason');
                            }}
                        />
                        <p
                            id={`cancel-reason-hint-${request.id}`}
                            className="flex justify-between gap-3 text-meta text-text-muted"
                        >
                            <span>
                                Wajib, minimal {preview.reason_min} karakter.
                                Terlihat oleh {request.user.name.split(' ')[0]}.
                            </span>
                            <span className="shrink-0 tnum">
                                {length}/{preview.reason_max}
                            </span>
                        </p>
                        <InputError message={form.errors.reason} />
                    </div>
                </>
            )}
        </div>
    );
}

/**
 * HR / Super Admin: "Batalkan pengajuan" on an approved request, with a
 * confirm dialog (desktop) or bottom sheet (mobile) that lists what changes
 * and asks for the reason (CancelApprovedRequest).
 */
export function CancelApprovedAction({
    request,
    mobile = false,
    className,
}: {
    request: RequestDetail;
    mobile?: boolean;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const form = useForm<{ reason: string }>({ reason: '' });
    const preview = request.cancel_preview;

    if (!request.can.cancel_approved || !preview) {
        return null;
    }

    const blocked = preview.blocker !== null;
    const tooShort = form.data.reason.trim().length < preview.reason_min;
    const title = 'Batalkan pengajuan yang sudah disetujui?';
    const description = `${request.number ?? ''} · ${request.user.name} · ${request.type.name}, ${formatRequestPeriod(request)}`;

    const submit = () => {
        if (tooShort) {
            form.setError(
                'reason',
                `Tulis alasan pembatalan minimal ${preview.reason_min} karakter.`,
            );

            return;
        }

        form.post(cancelApproved.url({ employeeRequest: request.id }), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setOpen(false);
            },
        });
    };

    const confirm = (
        <Button
            type="button"
            variant="destructive"
            size={mobile ? 'lg' : 'default'}
            className={cn(mobile && 'w-full')}
            disabled={blocked || form.processing}
            onClick={submit}
        >
            Ya, batalkan pengajuan
        </Button>
    );

    const body = (
        <CancelBody
            request={request}
            preview={preview}
            form={form}
            mobile={mobile}
        />
    );

    return (
        <div className={cn('flex flex-col gap-2', className)}>
            <Button
                type="button"
                variant="outline"
                size={mobile ? 'lg' : 'default'}
                className={cn(
                    'font-bold text-danger hover:text-danger',
                    mobile ? 'w-full' : 'self-start',
                )}
                onClick={() => setOpen(true)}
            >
                <Ban aria-hidden />
                Batalkan pengajuan
            </Button>
            {!mobile && (
                <p className="text-meta text-text-muted">
                    Sudah disetujui. Membatalkan mengembalikan saldo dan catatan
                    absensinya.
                </p>
            )}

            {mobile ? (
                <BottomSheet
                    open={open}
                    onOpenChange={setOpen}
                    title={title}
                    description={description}
                    footer={confirm}
                >
                    {body}
                </BottomSheet>
            ) : (
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{title}</DialogTitle>
                            <DialogDescription>{description}</DialogDescription>
                        </DialogHeader>
                        {body}
                        <DialogFooter className="gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                            >
                                Kembali
                            </Button>
                            {confirm}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
