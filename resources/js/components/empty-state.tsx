import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    icon: LucideIcon;
    title: string;
    /** One sentence: why it is empty / what to do next. */
    description?: ReactNode;
    /** Same as `description` (handy for longer content). */
    children?: ReactNode;
    /** One action at most (docs/DESIGN.md §6). */
    action?: ReactNode;
    /**
     * `md` (default): Komponen "Semua tugas beres" — dashed card, 64px
     * gradient icon tile, 20px title. `sm`: compact block inside a panel.
     */
    size?: 'sm' | 'md';
    className?: string;
};

/** Empty state (Komponen / MFondasi "Kosong"): icon, one line, one action. */
export function EmptyState({
    icon: Icon,
    title,
    description,
    children,
    action,
    size = 'md',
    className,
}: Props) {
    const text = description ?? children;

    if (size === 'sm') {
        return (
            <div
                className={cn(
                    'flex flex-1 flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed border-border-strong bg-surface-2/60 px-5 py-8 text-center',
                    className,
                )}
            >
                <Icon
                    aria-hidden
                    className="size-8 text-text-subtle"
                    strokeWidth={1.75}
                />
                <p className="text-[16px] font-bold">{title}</p>
                {text && (
                    <p className="max-w-sm text-[15px] leading-[22px] text-text-muted">
                        {text}
                    </p>
                )}
                {action && <div className="mt-2">{action}</div>}
            </div>
        );
    }

    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-panel border border-dashed border-border-strong bg-surface px-7 py-9 text-center',
                className,
            )}
        >
            <span
                aria-hidden
                className="flex size-16 items-center justify-center rounded-xl bg-grad-soft text-link"
            >
                <Icon className="size-[30px]" strokeWidth={1.9} />
            </span>
            <p className="text-[20px] leading-7 font-bold text-text">{title}</p>
            {text && (
                <p className="max-w-[340px] text-[16px] leading-6 text-text-muted">
                    {text}
                </p>
            )}
            {action && <div className="mt-1">{action}</div>}
        </div>
    );
}
