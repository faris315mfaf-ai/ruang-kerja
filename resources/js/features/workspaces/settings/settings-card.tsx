import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    id: string;
    title: string;
    description?: ReactNode;
    action?: ReactNode;
    tone?: 'danger';
    children: ReactNode;
};

/** One section of Pengaturan (heading + bordered card). */
export function SettingsCard({
    id,
    title,
    description,
    action,
    tone,
    children,
}: Props) {
    return (
        <section
            id={id}
            aria-labelledby={`${id}-title`}
            className="scroll-mt-20 space-y-3"
        >
            <div className="flex items-end justify-between gap-3">
                <div>
                    <h2
                        id={`${id}-title`}
                        className={cn(
                            'text-base font-semibold',
                            tone === 'danger' ? 'text-danger' : 'text-text',
                        )}
                    >
                        {title}
                    </h2>
                    {description && (
                        <p className="text-[13px] text-text-muted">
                            {description}
                        </p>
                    )}
                </div>
                {action}
            </div>
            <div
                className={cn(
                    'overflow-hidden rounded-lg border bg-surface',
                    tone === 'danger' ? 'border-danger/40' : 'border-border',
                )}
            >
                {children}
            </div>
        </section>
    );
}

export const selectClass =
    'h-8 rounded-md border border-border bg-surface px-2 text-[13px] text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60';
