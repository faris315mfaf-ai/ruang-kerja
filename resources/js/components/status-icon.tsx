import type { StatusCategory } from '@/features/tasks/types';
import type { PaletteColor } from '@/lib/palette';
import { palette } from '@/lib/palette';
import { cn } from '@/lib/utils';

export const STATUS_CATEGORY_LABELS: Record<StatusCategory, string> = {
    backlog: 'Backlog',
    todo: 'Todo',
    in_progress: 'Sedang dikerjakan',
    review: 'Review',
    done: 'Selesai',
    canceled: 'Dibatalkan',
};

type Props = {
    category: StatusCategory;
    color?: PaletteColor | null;
    /** Accessible name, e.g. the column name. Decorative when omitted. */
    label?: string;
    className?: string;
};

/**
 * Linear-style status circle (docs/DESIGN.md §2): dashed = backlog, empty =
 * todo, half = in progress, three quarters = review, check = done, cross =
 * canceled. Shape follows the category, color follows the column.
 */
export function StatusIcon({ category, color, label, className }: Props) {
    const tone = palette(color ?? defaultStatusColor(category)).text;

    return (
        <svg
            viewBox="0 0 16 16"
            fill="none"
            className={cn('size-4 shrink-0', tone, className)}
            role={label ? 'img' : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : true}
        >
            {category === 'done' || category === 'canceled' ? (
                <>
                    <circle cx="8" cy="8" r="7" fill="currentColor" />
                    {category === 'done' ? (
                        <path
                            d="M5 8.2 7.1 10.2 11 6"
                            stroke="var(--surface)"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    ) : (
                        <path
                            d="M5.6 5.6 10.4 10.4M10.4 5.6 5.6 10.4"
                            stroke="var(--surface)"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                        />
                    )}
                </>
            ) : (
                <>
                    <circle
                        cx="8"
                        cy="8"
                        r="6.25"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray={
                            category === 'backlog' ? '2.2 2.2' : undefined
                        }
                    />
                    {category === 'in_progress' && (
                        <path
                            d="M8 4.25a3.75 3.75 0 0 1 0 7.5Z"
                            fill="currentColor"
                        />
                    )}
                    {category === 'review' && (
                        <path
                            d="M8 4.25a3.75 3.75 0 1 1-3.75 3.75H8Z"
                            fill="currentColor"
                        />
                    )}
                </>
            )}
        </svg>
    );
}

export function defaultStatusColor(category: StatusCategory): PaletteColor {
    switch (category) {
        case 'in_progress':
            return 'amber';
        case 'review':
            return 'blue';
        case 'done':
            return 'teal';
        case 'todo':
            return 'slate';
        default:
            return 'gray';
    }
}
