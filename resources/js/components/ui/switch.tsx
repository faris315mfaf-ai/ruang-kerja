import * as React from 'react';
import { cn } from '@/lib/utils';

type Props = Omit<React.ComponentProps<'button'>, 'onChange' | 'value'> & {
    checked: boolean;
    onCheckedChange?: (checked: boolean) => void;
    size?: 'sm' | 'md';
};

/**
 * Accessible toggle (role="switch"), Arus style (Komponen "Mode gelap"):
 * `md` 52×32 with a 26px knob (default touch size), `sm` 40×24 for dense
 * rows; on = gradient aksi, off = strong border colour.
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
                'group hit-area inline-flex shrink-0 items-center rounded-full p-[3px] transition-colors duration-180 ease-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                size === 'md' ? 'h-8 w-13' : 'h-6 w-10',
                checked ? 'bg-primary bg-grad-aksi' : 'bg-border-strong',
                className,
            )}
            {...props}
        >
            <span
                aria-hidden
                className={cn(
                    'pointer-events-none block rounded-full bg-on-brand shadow-knob transition-transform duration-180 ease-brand',
                    size === 'md' ? 'size-[26px]' : 'size-[18px]',
                    checked
                        ? size === 'md'
                            ? 'translate-x-5'
                            : 'translate-x-4'
                        : 'translate-x-0',
                )}
            />
        </button>
    );
}

export { Switch };
