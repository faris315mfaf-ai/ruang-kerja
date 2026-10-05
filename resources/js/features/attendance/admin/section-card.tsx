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

/** Titled card section of the attendance settings (Arus panel, DHR table style). */
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
                'scroll-mt-20 overflow-hidden rounded-panel border border-border bg-surface shadow-card',
                className,
            )}
        >
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-divider px-6 py-5">
                <div>
                    <h2
                        id={`${id}-title`}
                        className="text-[20px] leading-7 font-bold text-text md:text-[22px]"
                    >
                        {title}
                    </h2>
                    <p className="mt-0.5 text-[15px] leading-[22px] text-text-muted">
                        {description}
                    </p>
                </div>
                {actions && (
                    <div className="flex flex-wrap items-center gap-2">
                        {actions}
                    </div>
                )}
            </header>
            {children}
        </section>
    );
}
