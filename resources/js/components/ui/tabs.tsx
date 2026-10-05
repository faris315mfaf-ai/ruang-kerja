import { Link } from '@inertiajs/react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

/** Next tab for a roving-focus key (WAI-ARIA tabs), or null for other keys. */
export function nextTabIndex(
    current: number,
    key: string,
    count: number,
): number | null {
    switch (key) {
        case 'ArrowRight':
            return (current + 1) % count;
        case 'ArrowLeft':
            return (current - 1 + count) % count;
        case 'Home':
            return 0;
        case 'End':
            return count - 1;
        default:
            return null;
    }
}

export type SegmentedOption<T extends string> = {
    value: T;
    label: ReactNode;
    /** id for aria-labelledby on the panel. */
    id?: string;
    /** id of the tabpanel this tab controls. */
    controls?: string;
};

const TRACKS = {
    /** Komponen "Pilihan & tab": gray track, selected = white with shadow. */
    soft: 'rounded-[14px] bg-surface-2 p-1',
    /** DBeranda header: translucent surface track with a border. */
    glass: 'rounded-[14px] border border-border bg-surface/70 p-1',
    /** MgDashboard: surface track with a border, selected = gradient aksi. */
    solid: 'rounded-lg border border-border bg-surface p-1',
} as const;

const ITEMS = {
    soft: {
        base: 'h-[38px] rounded-[10px] px-[18px] text-[15px] font-semibold',
        on: 'bg-surface text-text shadow-segment',
        off: 'text-text-muted hover:text-text',
    },
    glass: {
        base: 'h-[38px] rounded-[10px] px-[18px] text-[15px] font-semibold',
        on: 'bg-surface text-text shadow-segment',
        off: 'text-text-muted hover:text-text',
    },
    solid: {
        base: 'h-control flex-1 rounded-control px-5 text-[16px] font-bold',
        on: 'bg-grad-aksi text-on-brand',
        off: 'text-text-muted hover:bg-surface-2 hover:text-text',
    },
} as const;

/**
 * Segmented control as WAI-ARIA tabs with automatic activation (←/→/Home/End
 * move selection and focus). Use for period switches and view toggles whose
 * data is already on the page; use {@link TabNav} for links.
 */
export function SegmentedTabs<T extends string>({
    label,
    value,
    onValueChange,
    options,
    variant = 'soft',
    semantics = 'tabs',
    className,
}: {
    /** Accessible name of the tablist ("Periode"). */
    label: string;
    /**
     * `radio` for a single choice that does not switch a panel (check-in
     * method): radiogroup/radio with aria-checked instead of tablist/tab.
     */
    semantics?: 'tabs' | 'radio';
    value: T;
    onValueChange: (value: T) => void;
    options: SegmentedOption<T>[];
    variant?: keyof typeof TRACKS;
    className?: string;
}) {
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    const style = ITEMS[variant];

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        const index = options.findIndex((option) => option.value === value);
        const next = nextTabIndex(index, event.key, options.length);

        if (next === null) {
            return;
        }

        event.preventDefault();
        onValueChange(options[next].value);
        refs.current[next]?.focus();
    };

    return (
        <div
            role={semantics === 'radio' ? 'radiogroup' : 'tablist'}
            aria-label={label}
            className={cn('inline-flex gap-1', TRACKS[variant], className)}
        >
            {options.map((option, index) => {
                const selected = option.value === value;

                return (
                    <button
                        key={option.value}
                        ref={(element) => {
                            refs.current[index] = element;
                        }}
                        id={option.id}
                        type="button"
                        role={semantics === 'radio' ? 'radio' : 'tab'}
                        aria-selected={
                            semantics === 'radio' ? undefined : selected
                        }
                        aria-checked={
                            semantics === 'radio' ? selected : undefined
                        }
                        aria-controls={
                            semantics === 'radio' ? undefined : option.controls
                        }
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onValueChange(option.value)}
                        onKeyDown={onKeyDown}
                        className={cn(
                            'whitespace-nowrap transition-[color,background-color,box-shadow] duration-120 ease-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                            style.base,
                            selected ? style.on : style.off,
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

export type TabNavItem = {
    href: string;
    label: ReactNode;
    /** Small count after the label ("Dokumen 6"). */
    count?: number;
    active: boolean;
};

/**
 * Underlined section navigation (Komponen "Tugas · Dokumen 6 · File 24"):
 * links, 16px, active = bold text + 3px teal underline.
 */
export function TabNav({
    label,
    items,
    className,
    prefetch = true,
    preserveScroll = false,
}: {
    label: string;
    items: TabNavItem[];
    className?: string;
    /** Inertia link prefetch (on hover) — on by default. */
    prefetch?: boolean;
    /** Keep the scroll position when switching tabs (workspace tabs). */
    preserveScroll?: boolean;
}) {
    return (
        <nav
            aria-label={label}
            className={cn(
                'flex gap-7 overflow-x-auto border-b border-border [scrollbar-width:none]',
                className,
            )}
        >
            {items.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    prefetch={prefetch}
                    preserveScroll={preserveScroll}
                    aria-current={item.active ? 'page' : undefined}
                    className={cn(
                        '-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-[3px] px-0.5 pt-1 pb-3 text-[16px] whitespace-nowrap transition-colors duration-120 ease-brand outline-none focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring',
                        item.active
                            ? 'border-primary font-bold text-text'
                            : 'border-transparent font-medium text-text-muted hover:text-text',
                    )}
                >
                    {item.label}
                    {item.count !== undefined && (
                        <span className="text-[14px] font-medium text-text-muted tnum">
                            {item.count}
                        </span>
                    )}
                </Link>
            ))}
        </nav>
    );
}
