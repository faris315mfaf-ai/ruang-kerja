import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Arus field (Komponen "Input & formulir"): 44px, radius 12, strong border,
 * focus = teal border + 4px soft ring, error via aria-invalid.
 */
export const fieldClasses = cn(
    'w-full min-w-0 rounded-md border border-border-strong bg-surface px-3.5 text-[16px] text-text transition-[border-color,box-shadow] duration-120 ease-brand outline-none placeholder:text-text-subtle selection:bg-primary selection:text-primary-foreground',
    'focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-ring/55',
    'aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/20',
    'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-subtle',
);

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                fieldClasses,
                'flex h-11 py-1 file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-[15px] file:font-semibold file:text-text',
                className,
            )}
            {...props}
        />
    );
}

export { Input };
