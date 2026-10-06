import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';

/** "Batalkan rapat ini?" confirmation (organizer). */
export function CancelMeetingDialog({
    open,
    onOpenChange,
    recurring,
    onConfirm,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    recurring: boolean;
    onConfirm: () => void;
}) {
    const [busy, setBusy] = useState(false);

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    setBusy(false);
                }

                onOpenChange(next);
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Batalkan rapat ini?</DialogTitle>
                    <DialogDescription>
                        {recurring
                            ? 'Seluruh seri rapat berulang ini dibatalkan dan peserta diberi tahu. Notulen yang sudah ada tetap bisa dibaca.'
                            : 'Peserta diberi tahu bahwa rapat dibatalkan. Notulen yang sudah ada tetap bisa dibaca.'}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        variant="quiet"
                        onClick={() => onOpenChange(false)}
                        disabled={busy}
                    >
                        Kembali
                    </Button>
                    <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={() => {
                            setBusy(true);
                            onConfirm();
                        }}
                    >
                        {busy && <Spinner aria-hidden />}
                        Batalkan rapat
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
