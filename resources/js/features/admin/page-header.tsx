import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Page header of the admin screens, in the DHR / RoleDesk style: teal
 * overline, display title (44 desktop, 32 phone), 18px muted subtitle and
 * the actions on the right (outline first, one gradient button at most).
 */
export function AdminPageHeader({
    overline = 'Admin',
    title,
    description,
    actions,
    className,
}: {
    overline?: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <header
            className={cn(
                'flex flex-wrap items-end justify-between gap-5',
                className,
            )}
        >
            <div className="flex min-w-0 flex-col gap-2">
                <span className="text-overline text-link">{overline}</span>
                <h1 className="text-display">{title}</h1>
                {description && (
                    <p className="max-w-[760px] text-body-lg text-text-muted">
                        {description}
                    </p>
                )}
            </div>
            {actions && (
                <div className="flex flex-wrap items-center gap-3">
                    {actions}
                </div>
            )}
        </header>
    );
}

/** Toolbar above a table: search + filters left, count/actions right. */
export function AdminToolbar({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-wrap items-end gap-3', className)}>
            {children}
        </div>
    );
}
