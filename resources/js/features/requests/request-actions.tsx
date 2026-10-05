import { Link, router } from '@inertiajs/react';
import { Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { cancel, edit } from '@/routes/requests';
import type { RequestDetail } from '@/types/requests';
import { ConfirmDialog } from './confirm-dialog';

/** Requester actions: edit (draft / revision) and cancel (before the decision). */
export function RequestActions({
    request,
    mobile = false,
}: {
    request: RequestDetail;
    mobile?: boolean;
}) {
    const [confirming, setConfirming] = useState(false);
    const [processing, setProcessing] = useState(false);

    if (!request.can.cancel && !request.can.edit) {
        return null;
    }

    const doCancel = () => {
        router.post(
            cancel.url({ employeeRequest: request.id }),
            {},
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => {
                    setProcessing(false);
                    setConfirming(false);
                },
            },
        );
    };

    return (
        <div className={cn('space-y-2', mobile && 'flex gap-3 space-y-0')}>
            <div className={cn('flex flex-wrap gap-2', mobile && 'contents')}>
                {request.can.edit && (
                    <Button
                        asChild
                        className={cn(mobile && 'h-12 flex-1 text-base')}
                    >
                        <Link href={edit({ employeeRequest: request.id })}>
                            <Pencil aria-hidden />
                            {request.status === 'revision_requested'
                                ? 'Revisi & kirim ulang'
                                : 'Lanjutkan draf'}
                        </Link>
                    </Button>
                )}
                {request.can.cancel && (
                    <Button
                        type="button"
                        variant="outline"
                        className={cn(
                            'text-danger hover:text-danger',
                            mobile && 'h-12 flex-1 text-base',
                        )}
                        onClick={() => setConfirming(true)}
                    >
                        <X aria-hidden />
                        Batalkan pengajuan
                    </Button>
                )}
            </div>
            {!mobile && request.can.cancel && (
                <p className="text-[13px] text-text-muted">
                    Bisa dibatalkan selama belum diputus.
                </p>
            )}
            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                title="Batalkan pengajuan?"
                description={`${request.number ?? 'Draf'} akan dibatalkan dan saldo yang tertahan dikembalikan. Tindakan ini tidak bisa diurungkan.`}
                confirmLabel="Ya, batalkan"
                destructive
                processing={processing}
                onConfirm={doCancel}
            />
        </div>
    );
}
