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
                'scroll-mt-24 overflow-hidden rounded-panel border border-border bg-surface shadow-card',
                className,
            )}
        >
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-divider px-6 pt-6 pb-5 md:px-7">
                <div className="flex flex-col gap-1">
                    <h2 id={`${id}-title`} className="text-h3">
                        {title}
                    </h2>
                    <p className="text-[15px] text-text-muted">{description}</p>
                </div>
                {actions && (
                    <div className="flex flex-wrap items-center gap-3">
                        {actions}
                    </div>
                )}
            </header>
            {children}
        </section>
    );
}
