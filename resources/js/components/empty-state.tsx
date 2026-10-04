import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    icon: LucideIcon;
    title: string;
    description?: string;
    /** One action at most (docs/DESIGN.md §6). */
    action?: ReactNode;
    className?: string;
};

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: Props) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center rounded-lg border border-dashed border-border-strong px-6 py-14 text-center',
                className,
            )}
        >
            <Icon
                aria-hidden
                className="mb-3 size-8 text-text-subtle"
                strokeWidth={1.75}
            />
            <p className="text-sm font-semibold text-text">{title}</p>
            {description && (
                <p className="mt-1 max-w-sm text-[13px] text-text-muted">
                    {description}
                </p>
            )}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
