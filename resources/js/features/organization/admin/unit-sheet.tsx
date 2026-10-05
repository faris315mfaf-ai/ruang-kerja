import type { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    /** Shown after the title, e.g. the unit's current name. */
    subject?: string;
    description: string;
    processing: boolean;
    submitLabel: string;
    onSubmit: () => void;
    /** Opens the delete confirmation (edit mode only). */
    onDelete?: () => void;
    children: ReactNode;
};

/** Right-hand edit panel (mockup Karyawan: "Ubah karyawan · Nama"). */
export function UnitSheet({
    open,
    onOpenChange,
    title,
    subject,
    description,
    processing,
    submitLabel,
    onSubmit,
    onDelete,
    children,
}: Props) {
    const submit = (event: FormEvent) => {
        event.preventDefault();
        onSubmit();
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full gap-0 bg-surface p-0 sm:max-w-[420px]">
                <form
                    onSubmit={submit}
                    className="flex h-full flex-col"
                    noValidate
                >
                    <SheetHeader className="border-b border-border px-5 py-4">
                        <SheetTitle className="pr-6 text-base text-text">
                            {title}
                            {subject && (
                                <span className="font-normal text-text-muted">
                                    {' '}
                                    · {subject}
                                </span>
                            )}
                        </SheetTitle>
                        <SheetDescription className="text-[13px] text-text-muted">
                            {description}
                        </SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                        {children}
                    </div>

                    <div className="flex items-center gap-2 border-t border-border px-5 py-4">
                        {onDelete && (
                            <Button
                                type="button"
                                variant="outline"
                                className="border-danger/40 text-danger hover:bg-danger/10 hover:text-danger"
                                onClick={onDelete}
                            >
                                Hapus
                            </Button>
                        )}
                        <div className="ml-auto flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Batal
                            </Button>
                            <Button type="submit" disabled={processing}>
                                {processing && <Spinner />}
                                {submitLabel}
                            </Button>
                        </div>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}
