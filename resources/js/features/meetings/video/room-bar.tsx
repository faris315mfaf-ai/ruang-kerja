import { PhoneOff } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { forwardRef } from 'react';
import { cn, focusRing } from '@/lib/utils';

/**
 * Key of the compact dark control bar (mockup cBar: 44 × 44, radius 12, on
 * the room-bar tone). `off` = device off (red), `active` = toggled on.
 */
export const BarKey = forwardRef<
    HTMLButtonElement,
    {
        label: string;
        shortcut?: string;
        active?: boolean;
        off?: boolean;
        badge?: number;
        size?: 'md' | 'lg';
        onClick?: () => void;
        children: ReactNode;
    } & Omit<ComponentProps<'button'>, 'children' | 'onClick'>
>(function BarKey(
    {
        label,
        shortcut,
        active = false,
        off = false,
        badge,
        size = 'md',
        onClick,
        children,
        className,
        ...rest
    },
    ref,
) {
    return (
        <button
            ref={ref}
            type="button"
            onClick={onClick}
            aria-label={label}
            aria-pressed={rest['aria-haspopup'] ? undefined : active || off}
            title={shortcut ? `${label} (${shortcut})` : label}
            className={cn(
                'relative inline-flex shrink-0 items-center justify-center transition-[background-color,color,transform] duration-120 ease-brand active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100',
                size === 'lg'
                    ? 'size-[52px] rounded-lg [&_svg]:size-[22px]'
                    : 'size-11 rounded-control [&_svg]:size-5',
                off
                    ? 'bg-danger text-on-danger hover:opacity-90'
                    : active
                      ? 'bg-on-room-bar text-room-bar'
                      : size === 'lg'
                        ? 'bg-room-bar text-on-room-bar shadow-card hover:bg-room-key'
                        : 'bg-room-key text-on-room-bar hover:bg-room-key/70',
                focusRing,
                className,
            )}
            {...rest}
        >
            {children}
            {badge !== undefined && badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-badge px-1 text-[12px] font-bold text-on-badge">
                    {badge > 9 ? '9+' : badge}
                </span>
            )}
        </button>
    );
});

/** Red "Keluar" (desktop: icon + text; phone: icon only). */
export function LeaveKey({
    onClick,
    size = 'md',
}: {
    onClick: () => void;
    size?: 'md' | 'lg';
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label="Keluar dari rapat"
            className={cn(
                'inline-flex shrink-0 items-center justify-center gap-1.5 bg-danger font-bold text-on-danger transition-[opacity,transform] duration-120 ease-brand hover:opacity-90 active:scale-[0.97] motion-reduce:active:scale-100',
                size === 'lg'
                    ? 'size-[52px] rounded-lg [&_svg]:size-[22px]'
                    : 'h-11 rounded-control px-3.5 text-[14px] [&_svg]:size-5',
                focusRing,
            )}
        >
            <PhoneOff aria-hidden />
            {size === 'md' && <span>Keluar</span>}
        </button>
    );
}

/** The bar itself: dark rounded capsule, bottom centre over the paper. */
export function ControlBar({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            role="toolbar"
            aria-label="Kontrol rapat"
            className={cn(
                'flex items-center gap-2 rounded-[18px] bg-room-bar p-2 text-on-room-bar shadow-float',
                className,
            )}
        >
            {children}
        </div>
    );
}
