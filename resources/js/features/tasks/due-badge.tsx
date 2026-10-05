import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dueTone, formatDue } from './lib/due-date';

type Props = {
    due: string;
    today: string;
    closed?: boolean;
    className?: string;
};

const TONES = {
    danger: 'text-danger',
    warning: 'text-warning',
    muted: 'text-text-muted',
} as const;

/** Calendar icon + "Besok" / "Lewat 2 hari" / "9 Okt" (red when late). */
export function DueBadge({ due, today, closed = false, className }: Props) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1 text-[11px] whitespace-nowrap',
                TONES[dueTone(due, today, closed)],
                className,
            )}
        >
            <CalendarDays className="size-3.5" strokeWidth={1.75} aria-hidden />
            <span>
                <span className="sr-only">Tenggat: </span>
                {formatDue(due, today)}
            </span>
        </span>
    );
}
