import type { Priority } from '@/features/tasks/types';
import { cn } from '@/lib/utils';

export const PRIORITY_LABELS: Record<Priority, string> = {
    0: 'Tanpa',
    1: 'Urgent',
    2: 'Tinggi',
    3: 'Sedang',
    4: 'Rendah',
};

/** Order used in menus: urgent first, none last. */
export const PRIORITY_ORDER: Priority[] = [1, 2, 3, 4, 0];

const ACTIVE_BARS: Record<Priority, number> = { 0: 0, 1: 3, 2: 3, 3: 2, 4: 1 };

type Props = {
    priority: Priority;
    /** Show "Prioritas: …" to assistive tech (default true). */
    labelled?: boolean;
    className?: string;
};

/**
 * Linear-style priority (docs/DESIGN.md §2): Urgent = red square with "!",
 * Tinggi 3 bars, Sedang 2, Rendah 1, Tanpa three dots.
 */
export function PriorityIcon({ priority, labelled = true, className }: Props) {
    const a11y = labelled
        ? { role: 'img', 'aria-label': `Prioritas: ${PRIORITY_LABELS[priority]}` }
        : { 'aria-hidden': true };

    if (priority === 1) {
        return (
            <svg
                viewBox="0 0 16 16"
                className={cn('size-4 shrink-0 text-danger', className)}
                {...a11y}
            >
                <rect
                    x="1.5"
                    y="1.5"
                    width="13"
                    height="13"
                    rx="3"
                    fill="currentColor"
                />
                <rect
                    x="7.2"
                    y="4"
                    width="1.6"
                    height="5.2"
                    rx="0.8"
                    fill="var(--on-danger)"
                />
                <circle cx="8" cy="11.3" r="0.95" fill="var(--on-danger)" />
            </svg>
        );
    }

    if (priority === 0) {
        return (
            <svg
                viewBox="0 0 16 16"
                className={cn('size-4 shrink-0 text-text-subtle', className)}
                {...a11y}
            >
                <circle cx="3" cy="8" r="1.25" fill="currentColor" />
                <circle cx="8" cy="8" r="1.25" fill="currentColor" />
                <circle cx="13" cy="8" r="1.25" fill="currentColor" />
            </svg>
        );
    }

    const active = ACTIVE_BARS[priority];

    return (
        <svg
            viewBox="0 0 16 16"
            className={cn('size-4 shrink-0 text-text-muted', className)}
            {...a11y}
        >
            {[0, 1, 2].map((bar) => (
                <rect
                    key={bar}
                    x={2 + bar * 4.5}
                    y={10 - bar * 3}
                    width="3"
                    height={4 + bar * 3}
                    rx="1"
                    fill="currentColor"
                    opacity={bar < active ? 1 : 0.28}
                />
            ))}
        </svg>
    );
}
