import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dueTone, formatDue } from './lib/due-date';

type Props = {
    due: string;
    today: string;
    closed?: boolean;
    /** Leading calendar icon (dense tables); the Arus cards show text only. */
    icon?: boolean;
    className?: string;
};

const TONES = {
    danger: 'font-bold text-danger',
    warning: 'font-bold text-warning',
    muted: 'font-medium text-text-muted',
} as const;

/** "Besok" / "Lewat 2 hari" / "Kam, 8 Okt": bold red when late, amber when near. */
export function DueBadge({
    due,
    today,
    closed = false,
    icon = false,
    className,
}: Props) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1 text-[14px] whitespace-nowrap',
                TONES[dueTone(due, today, closed)],
                className,
            )}
        >
            {icon && (
                <CalendarDays
                    className="size-4"
                    strokeWidth={1.9}
                    aria-hidden
                />
            )}
            <span>
                <span className="sr-only">Tenggat: </span>
                {formatDue(due, today)}
            </span>
        </span>
    );
}
