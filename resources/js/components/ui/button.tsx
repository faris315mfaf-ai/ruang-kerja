import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/** Komponen "Nonaktif": gray fill, subtle text, no gradient or glow. */
const FILLED_DISABLED =
    'disabled:bg-surface-2 disabled:bg-none disabled:text-text-subtle disabled:shadow-none';

/**
 * Arus buttons (docs/ruangkerja-design/screens/Komponen.dc.html "Tombol").
 * One gradient (`default`) button per area. Heights: sm 36 · default 44 ·
 * lg 52 · xl 56; radius 10/12/14; focus = 3px teal ring outside the button.
 */
const buttonVariants = cva(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition-[color,background-color,box-shadow,opacity,transform] duration-120 ease-brand outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring active:scale-[0.98] disabled:pointer-events-none aria-invalid:ring-[3px] aria-invalid:ring-danger/30 motion-reduce:active:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
    {
        variants: {
            variant: {
                /** Gradient aksi, white text, glow (Komponen "Tugas baru"). */
                default: cn(
                    'bg-primary bg-grad-aksi text-on-brand shadow-button hover:opacity-92',
                    FILLED_DISABLED,
                ),
                /** Solid danger ("Tolak"). */
                destructive: cn(
                    'bg-danger text-on-danger hover:opacity-90',
                    FILLED_DISABLED,
                ),
                /** Surface + strong border ("Ekspor", icon "Lainnya"). */
                outline:
                    'border border-border-strong bg-surface text-text hover:bg-surface-2 disabled:text-text-subtle',
                /** Neutral filled. */
                secondary: cn(
                    'bg-surface-2 text-text hover:bg-border',
                    FILLED_DISABLED,
                ),
                /** Tonal teal ("Minta update"). */
                tonal: cn(
                    'bg-link-soft text-link hover:bg-brand-100 dark:hover:bg-brand-900',
                    FILLED_DISABLED,
                ),
                /** Transparent neutral (icon buttons, toolbars). */
                ghost: 'text-text hover:bg-surface-2 disabled:opacity-50',
                /** Transparent teal text ("Batal"). */
                quiet: 'text-link hover:bg-link-soft disabled:opacity-50',
                link: 'text-link underline-offset-4 hover:underline active:scale-100 disabled:opacity-50',
            },
            size: {
                default: 'h-11 px-5 text-[16px] has-[>svg]:px-4',
                sm: 'h-9 rounded-[10px] px-3.5 text-[15px] has-[>svg]:px-3 [&_svg:not([class*=\'size-\'])]:size-4',
                lg: 'h-13 rounded-[14px] px-7 text-[17px] font-bold has-[>svg]:px-6',
                xl: 'h-14 rounded-[16px] px-7 text-[18px] font-bold has-[>svg]:px-6',
                icon: 'size-11',
                'icon-sm': 'size-9 rounded-[10px] [&_svg:not([class*=\'size-\'])]:size-4',
                'icon-lg': 'size-13 rounded-[14px]',
            },
        },
        compoundVariants: [
            {
                variant: 'default',
                size: ['lg', 'xl'],
                className: 'shadow-button-lg',
            },
            { variant: 'link', className: 'h-auto px-0 has-[>svg]:px-0' },
        ],
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

function Button({
    className,
    variant,
    size,
    asChild = false,
    ...props
}: React.ComponentProps<'button'> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    }) {
    const Comp = asChild ? Slot : 'button';

    return (
        <Comp
            data-slot="button"
            data-variant={variant ?? 'default'}
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    );
}

export { Button, buttonVariants };
