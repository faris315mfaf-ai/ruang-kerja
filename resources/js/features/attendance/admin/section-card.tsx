import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    id: string;
    title: string;
    description: string;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
};

/** Card section of the settings page (mockup LokasiShift). */
export function SectionCard({
    id,
    title,
    description,
    actions,
    children,
    className,
}: Props) {
    return (
        <section
            id={id}
            aria-labelledby={`${id}-title`}
            className={cn(
                'scroll-mt-20 overflow-hidden rounded-xl border border-border bg-surface shadow-card',
                className,
            )}
        >
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5">
                <div>
                    <h2
                        id={`${id}-title`}
                        className="text-base font-semibold text-text"
                    >
                        {title}
                    </h2>
                    <p className="text-[13px] text-text-muted">{description}</p>
                </div>
                {actions && (
                    <div className="flex items-center gap-2">{actions}</div>
                )}
            </header>
            {children}
        </section>
    );
}
