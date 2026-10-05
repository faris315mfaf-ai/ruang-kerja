import { router } from '@inertiajs/react';
import { AlertTriangle } from 'lucide-react';
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

type Props = {
    /** What is being deleted, e.g. "divisi Keuangan". Null closes the dialog. */
    target: { label: string; url: string } | null;
    onClose: () => void;
    /** Validation key the Delete* action reports its refusal under. */
    errorKey: 'division' | 'team' | 'position';
};

/**
 * Confirms a soft delete. When the server refuses (members still assigned),
 * its message is shown in the dialog instead of closing it.
 */
export function DeleteDialog({ target, onClose, errorKey }: Props) {
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const close = () => {
        setError(null);
        onClose();
    };

    const confirm = () => {
        if (!target) {
            return;
        }

        router.delete(target.url, {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onSuccess: close,
            onError: (errors) =>
                setError(
                    errors[errorKey] ??
                        Object.values(errors)[0] ??
                        'Gagal menghapus. Coba lagi.',
                ),
        });
    };

    return (
        <Dialog
            open={target !== null}
            onOpenChange={(open) => !open && close()}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Hapus {target?.label}?</DialogTitle>
                    <DialogDescription>
                        Data lama tetap tersimpan dan bisa dipulihkan dari
                        daftar &ldquo;Tampilkan yang dihapus&rdquo;. Kode tidak
                        dapat dipakai ulang.
                    </DialogDescription>
                </DialogHeader>
                {error && (
                    <p
                        role="alert"
                        className="flex gap-2 rounded-md bg-danger-soft px-3 py-2.5 text-[15px] text-danger"
                    >
                        <AlertTriangle
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden
                        />
                        {error}
                    </p>
                )}
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={close}>
                        Batal
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        disabled={processing}
                        onClick={confirm}
                    >
                        {processing && <Spinner />}
                        Hapus
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
