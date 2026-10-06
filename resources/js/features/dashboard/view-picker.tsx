import { Link } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import type { PickerItem } from '@/types/dashboard';

/**
 * Dashboard view picker (SBeranda header nav: glass segmented track of links)
 * for people with several roles (PRD M7): Saya · Kepala Divisi · HR ·
 * Direksi. Hidden when the user has a single view.
 */
export function ViewPicker({
    views,
    className,
}: {
    views: PickerItem[];
    className?: string;
}) {
    if (views.length <= 1) {
        return null;
    }

    return (
        <nav
            aria-label="Tampilan dashboard"
            className={cn(
                'flex max-w-full [scrollbar-width:none] gap-1 overflow-x-auto rounded-[14px] border border-border bg-surface/70 p-1 md:w-fit md:self-start [&::-webkit-scrollbar]:hidden',
                className,
            )}
        >
            {views.map((view) => (
                <Link
                    key={view.key}
                    href={view.href}
                    aria-current={view.active ? 'page' : undefined}
                    className={cn(
                        'inline-flex h-[38px] shrink-0 items-center gap-1 rounded-[10px] px-[18px] text-[15px] whitespace-nowrap transition-[color,background-color,box-shadow] duration-120 ease-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring max-md:h-11 max-md:flex-1 max-md:justify-center',
                        view.active
                            ? 'bg-surface font-bold text-text shadow-segment'
                            : 'font-semibold text-text-muted hover:text-text',
                    )}
                >
                    {view.label}
                </Link>
            ))}
        </nav>
    );
}
