import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Styled native <select>: keyboard & screen-reader friendly, supports an empty
 * value ("Semua …"), and opens the OS picker on phones.
 */
export function NativeSelect({
    className,
    children,
    ...props
}: ComponentProps<'select'>) {
    return (
        <div className={cn('relative', className)}>
            <select
                className="h-9 w-full appearance-none rounded-md border border-input bg-background pr-8 pl-3 text-base text-text shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm"
                {...props}
            >
                {children}
            </select>
            <ChevronDown
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-text-muted"
            />
        </div>
    );
}
