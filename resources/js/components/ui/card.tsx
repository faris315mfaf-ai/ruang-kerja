import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Arus card (Komponen sections, Ruang "e-1"): surface, 1px border, radius 24
 * (`rounded-panel`), soft elevation, 24px padding. Use `rounded-card` (20)
 * for small tiles such as KPI cards.
 */
function Card({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card"
            className={cn(
                'flex flex-col gap-5 rounded-panel border border-border bg-card py-6 text-card-foreground shadow-card',
                className,
            )}
            {...props}
        />
    );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-header"
            className={cn(
                'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-6',
                className,
            )}
            {...props}
        />
    );
}

/** Card heading: 22/30 bold on desktop, 20/26 on phones (`text-h3`). */
function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-title"
            className={cn('text-h3 text-text', className)}
            {...props}
        />
    );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-description"
            className={cn(
                'basis-full text-[15px] leading-[22px] text-text-muted',
                className,
            )}
            {...props}
        />
    );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-content"
            className={cn('px-6', className)}
            {...props}
        />
    );
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-footer"
            className={cn('flex items-center gap-3 px-6', className)}
            {...props}
        />
    );
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
