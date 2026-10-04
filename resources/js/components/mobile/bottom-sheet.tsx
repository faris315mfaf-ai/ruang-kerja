import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    children: ReactNode;
    /** Sticky bottom action bar (rises with the keyboard via safe area). */
    footer?: ReactNode;
    className?: string;
};

/** Glass bottom sheet built on Radix Dialog (docs/PLATFORM.md §5 rule 4). */
export function BottomSheet({
    open,
    onOpenChange,
    title,
    description,
    children,
    footer,
    className,
}: Props) {
    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/60 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
                <DialogPrimitive.Content
                    className={cn(
                        'glass fixed inset-x-0 bottom-0 z-50 flex max-h-[90svh] flex-col rounded-t-xl border-b-0 duration-180 ease-brand data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom',
                        className,
                    )}
                >
                    <div
                        aria-hidden
                        className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-strong"
                    />
                    <div className="px-4 pt-3 pb-2">
                        <DialogPrimitive.Title className="text-[17px] font-semibold text-text">
                            {title}
                        </DialogPrimitive.Title>
                        {description ? (
                            <DialogPrimitive.Description className="mt-0.5 text-sm text-text-muted">
                                {description}
                            </DialogPrimitive.Description>
                        ) : (
                            <DialogPrimitive.Description className="sr-only">
                                {title}
                            </DialogPrimitive.Description>
                        )}
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                        {children}
                    </div>
                    {footer && (
                        <div className="pb-safe border-t border-border px-4 pt-3">
                            <div className="pb-3">{footer}</div>
                        </div>
                    )}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
