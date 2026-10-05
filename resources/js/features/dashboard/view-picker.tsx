import { Link } from '@inertiajs/react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PickerItem } from '@/types/dashboard';

/**
 * Dashboard view picker for people with several roles (PRD M7): Saya ·
 * Kepala Divisi · HR, plus Direksi → the portfolio page. Hidden when the
 * user has a single view.
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
                '-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden',
                className,
            )}
        >
            {views.map((view) => (
                <Link
                    key={view.key}
                    href={view.href}
                    aria-current={view.active ? 'page' : undefined}
                    className={cn(
                        'inline-flex h-9 shrink-0 items-center gap-1 rounded-full border px-3.5 text-sm transition-colors duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none max-md:h-11',
                        view.active
                            ? 'border-primary bg-primary/10 font-medium text-primary'
                            : 'border-border bg-surface text-text-muted hover:text-text',
                    )}
                >
                    {view.label}
                    {view.key === 'direksi' && (
                        <ArrowUpRight className="size-3.5" aria-hidden />
                    )}
                </Link>
            ))}
        </nav>
    );
}
