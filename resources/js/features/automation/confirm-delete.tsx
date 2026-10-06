import { Button } from '@/components/ui/button';
import { FormSurface } from '@/features/automation/form-surface';

/**
 * "Hapus …?" confirmation (dialog on desktop/tablet, bottom sheet on
 * phones). Deleting a rule, recurring task or template cannot be undone.
 */
export function ConfirmDelete({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = 'Hapus',
    processing = false,
    mobile,
    onConfirm,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel?: string;
    processing?: boolean;
    mobile: boolean;
    onConfirm: () => void;
}) {
    return (
        <FormSurface
            open={open}
            onOpenChange={onOpenChange}
            mobile={mobile}
            title={title}
            description={description}
            footer={
                <>
                    <Button
                        variant="quiet"
                        onClick={() => onOpenChange(false)}
                        className="h-12 md:h-11"
                    >
                        Batal
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={processing}
                        className="h-12 md:h-11"
                    >
                        {processing ? 'Menghapus…' : confirmLabel}
                    </Button>
                </>
            }
        >
            <p className="text-body text-text-muted">
                Tindakan ini tidak bisa dibatalkan.
            </p>
        </FormSurface>
    );
}
