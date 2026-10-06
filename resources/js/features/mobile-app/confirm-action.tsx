import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

/**
 * Destructive confirmation: a bottom sheet on phones, a dialog elsewhere
 * (docs/PLATFORM.md §2). The confirm button shows progress while `busy`.
 */
export function ConfirmAction({
    open,
    onOpenChange,
    mobile,
    title,
    description,
    confirmLabel,
    busy,
    onConfirm,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mobile: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    busy: boolean;
    onConfirm: () => void;
}) {
    const buttons = (
        <>
            <Button
                variant="destructive"
                size={mobile ? 'lg' : 'default'}
                className={mobile ? 'w-full' : undefined}
                disabled={busy}
                onClick={onConfirm}
            >
                {busy ? 'Memproses…' : confirmLabel}
            </Button>
            <Button
                variant={mobile ? 'quiet' : 'outline'}
                className={mobile ? 'w-full' : undefined}
                disabled={busy}
                onClick={() => onOpenChange(false)}
            >
                Batal
            </Button>
        </>
    );

    if (mobile) {
        return (
            <BottomSheet
                open={open}
                onOpenChange={onOpenChange}
                title={title}
                description={description}
                footer={<div className="flex flex-col gap-2">{buttons}</div>}
            >
                <span className="sr-only">{description}</span>
            </BottomSheet>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-row-reverse gap-2 sm:justify-start">
                    {buttons}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
