import { Plus } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type Props = ComponentProps<'button'> & {
    label: string;
};

/** 56px floating action button above the tab bar (docs/PLATFORM.md §2). */
export function Fab({ label, className, children, ...props }: Props) {
    return (
        <button
            type="button"
            aria-label={label}
            className={cn(
                'fixed right-4 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card transition-transform duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none active:scale-95',
                'bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom)+16px)]',
                className,
            )}
            {...props}
        >
            {children ?? <Plus className="size-6" aria-hidden />}
        </button>
    );
}
