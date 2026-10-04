import * as React from 'react';
import { cn } from '@/lib/utils';

type Props = Omit<React.ComponentProps<'button'>, 'onChange' | 'value'> & {
    checked: boolean;
    onCheckedChange?: (checked: boolean) => void;
    size?: 'sm' | 'md';
};

/**
 * Accessible toggle (role="switch") styled like shadcn's Switch, without an
 * extra Radix dependency. `size="md"` gives a 44px touch target on mobile.
 */
function Switch({
    checked,
    onCheckedChange,
    size = 'sm',
    className,
    disabled,
    ...props
}: Props) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            data-state={checked ? 'checked' : 'unchecked'}
            disabled={disabled}
            onClick={() => onCheckedChange?.(!checked)}
            className={cn(
                'group relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-colors duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                size === 'md' ? 'h-8 w-14' : 'h-5 w-9',
                checked ? 'bg-primary' : 'bg-border-strong',
                className,
            )}
            {...props}
        >
            <span
                aria-hidden
                className={cn(
                    'pointer-events-none block rounded-full bg-on-brand shadow-card transition-transform duration-120 ease-brand',
                    size === 'md' ? 'size-7' : 'size-4',
                    checked
                        ? size === 'md'
                            ? 'translate-x-6'
                            : 'translate-x-4'
                        : 'translate-x-0.5',
                )}
            />
        </button>
    );
}

export { Switch };
