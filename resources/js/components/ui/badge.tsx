import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Arus badges (Komponen "Badge, status & label"):
 * - `status`: 32px pill, soft background + strong text (+ `dot`), tone =
 *   success · warning · danger · info · link · neutral ("Hadir", "Berisiko").
 * - `label`: 30px chip, radius 8 ("Keuangan", "Web").
 * - `count`: red counter ("5"). `new`/`default`: gradient pill ("Baru").
 * Status is never colour alone: always text, optionally a dot.
 */
const badgeVariants = cva(
    'inline-flex w-fit shrink-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring [&>svg]:pointer-events-none [&>svg]:size-4',
    {
        variants: {
            variant: {
                default:
                    'h-[26px] rounded-full bg-primary bg-grad-aksi px-2.5 text-[14px] font-bold text-on-brand',
                status: 'h-8 rounded-full px-3 text-[15px] font-bold',
                label: 'h-[30px] rounded-sm px-3 text-[14px] font-semibold',
                count: 'h-[26px] min-w-[26px] rounded-full bg-badge px-2 text-[14px] font-bold text-on-badge tnum',
                secondary:
                    'h-[30px] rounded-sm bg-surface-2 px-3 text-[14px] font-semibold text-text',
                destructive:
                    'h-[30px] rounded-sm bg-danger-soft px-3 text-[14px] font-semibold text-danger',
                outline:
                    'h-[30px] rounded-sm border border-border-strong px-3 text-[14px] font-semibold text-text',
            },
            tone: {
                success: 'bg-success-soft text-success',
                warning: 'bg-warning-soft text-warning',
                danger: 'bg-danger-soft text-danger',
                info: 'bg-info-soft text-info',
                link: 'bg-link-soft text-link',
                neutral: 'bg-surface-2 text-text-muted',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

function Badge({
    className,
    variant,
    tone,
    dot = false,
    asChild = false,
    children,
    ...props
}: React.ComponentProps<'span'> &
    VariantProps<typeof badgeVariants> & {
        asChild?: boolean;
        /** Leading 8px dot in the text colour (status pills). */
        dot?: boolean;
    }) {
    const Comp = asChild ? Slot : 'span';
    const resolvedTone =
        tone ?? (variant === 'status' || variant === 'label' ? 'neutral' : null);

    return (
        <Comp
            data-slot="badge"
            className={cn(
                badgeVariants({ variant, tone: resolvedTone }),
                variant === 'label' && resolvedTone === 'neutral' && 'text-text',
                className,
            )}
            {...props}
        >
            {dot && !asChild && (
                <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full bg-current"
                />
            )}
            {children}
        </Comp>
    );
}

export { Badge, badgeVariants };
