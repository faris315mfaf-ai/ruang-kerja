import type { ReactNode } from 'react';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * Form container per platform (docs/PLATFORM.md §2): a centered glass
 * dialog on desktop/tablet, a bottom sheet with a sticky action bar on
 * phones.
 */
export function FormSurface({
    open,
    onOpenChange,
    title,
    description,
    footer,
    children,
    mobile,
    wide = false,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    footer: ReactNode;
    children: ReactNode;
    mobile: boolean;
    wide?: boolean;
}) {
    if (mobile) {
        return (
            <BottomSheet
                open={open}
                onOpenChange={onOpenChange}
                title={title}
                description={description}
                footer={<div className="flex gap-3 [&>*]:flex-1">{footer}</div>}
            >
                <div className="flex flex-col gap-4 pt-2">{children}</div>
            </BottomSheet>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={cn(wide ? 'sm:max-w-[680px]' : 'sm:max-w-[560px]')}
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description ? (
                        <DialogDescription>{description}</DialogDescription>
                    ) : (
                        <DialogDescription className="sr-only">
                            {title}
                        </DialogDescription>
                    )}
                </DialogHeader>
                <div className="flex flex-col gap-4">{children}</div>
                <DialogFooter>{footer}</DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
