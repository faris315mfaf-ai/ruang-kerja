import type { ReactNode } from 'react';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';

export type FlowProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Phone: bottom sheet; desktop/tablet: side panel. */
    mobile: boolean;
};

/**
 * Container of a role task flow (P* screens): a 560px side panel on
 * desktop/tablet (docs/PLATFORM.md "Panel detail"), a glass bottom sheet with
 * a sticky action bar on phones.
 */
export function FlowSurface({
    open,
    onOpenChange,
    mobile,
    title,
    description,
    footer,
    children,
}: FlowProps & {
    title: string;
    description?: string;
    footer?: ReactNode;
    children: ReactNode;
}) {
    if (mobile) {
        return (
            <BottomSheet
                open={open}
                onOpenChange={onOpenChange}
                title={title}
                description={description}
                footer={footer}
            >
                <div className="flex flex-col gap-4 pt-1">{children}</div>
            </BottomSheet>
        );
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full gap-0 sm:max-w-[560px]">
                <SheetHeader className="border-b border-border">
                    <SheetTitle>{title}</SheetTitle>
                    <SheetDescription
                        className={description ? undefined : 'sr-only'}
                    >
                        {description ?? title}
                    </SheetDescription>
                </SheetHeader>
                <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
                    {children}
                </div>
                {footer && (
                    <div className="border-t border-border p-6">{footer}</div>
                )}
            </SheetContent>
        </Sheet>
    );
}

/** Small overline label above a group of choices ("Pilih keputusan"). */
export function FlowLabel({
    children,
    id,
}: {
    children: ReactNode;
    id?: string;
}) {
    return (
        <span id={id} className="text-overline text-text-muted">
            {children}
        </span>
    );
}
