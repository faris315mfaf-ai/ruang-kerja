import {
    formatMonthYear,
    formatShortDate,
    officeDay,
    weekdayShort,
} from '@/lib/requests';
import { cn } from '@/lib/utils';

const HEADERS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

type Props = {
    /** "YYYY-MM-DD" of the month to show (any day in it). */
    month: string;
    today: string;
    /** Working dates of the request ("YYYY-MM-DD"). */
    selected: string[];
    /** Dates where colleagues are absent (dot). */
    marked?: string[];
    className?: string;
};

/** Small month grid (FormPengajuan): selected range highlighted, weekends muted. */
export function MonthCalendar({
    month,
    today,
    selected,
    marked = [],
    className,
}: Props) {
    const parts = officeDay(month);

    if (!parts) {
        return null;
    }

    const { year, month: m } = parts;
    const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();
    const firstWeekday =
        (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7; // Monday = 0
    const iso = (day: number) =>
        `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const selectedSet = new Set(selected);
    const markedSet = new Set(marked);
    const cells: (number | null)[] = [
        ...Array(firstWeekday).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];

    return (
        <div className={cn('rounded-lg border border-border p-3', className)}>
            <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-text">
                    {formatMonthYear(year, m)}
                </p>
                <p className="text-xs text-text-muted">
                    Hari ini {weekdayShort(today)},{' '}
                    {formatShortDate(today).replace(/ \d{4}$/, '')}
                </p>
            </div>
            <div
                className="grid grid-cols-7 text-center text-[11px] text-text-muted"
                aria-hidden
            >
                {HEADERS.map((header) => (
                    <span key={header} className="py-1">
                        {header}
                    </span>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1 text-center text-[13px] tnum">
                {cells.map((day, index) => {
                    if (day === null) {
                        return <span key={`empty-${index}`} />;
                    }

                    const date = iso(day);
                    const weekend = index % 7 >= 5;
                    const isSelected = selectedSet.has(date);
                    const prevSelected =
                        selectedSet.has(iso(day - 1)) && index % 7 !== 0;
                    const nextSelected =
                        selectedSet.has(iso(day + 1)) && index % 7 !== 6;

                    return (
                        <span
                            key={date}
                            aria-label={
                                isSelected ? `${day}, dipilih` : undefined
                            }
                            className={cn(
                                'relative flex h-7 items-center justify-center',
                                weekend && !isSelected && 'text-text-subtle',
                                isSelected &&
                                    'bg-primary font-semibold text-primary-foreground',
                                isSelected && !prevSelected && 'rounded-l-md',
                                isSelected && !nextSelected && 'rounded-r-md',
                                date === today &&
                                    !isSelected &&
                                    'rounded-md ring-1 ring-text',
                            )}
                        >
                            {day}
                            {markedSet.has(date) && (
                                <span
                                    aria-hidden
                                    className="absolute bottom-0.5 size-1 rounded-full bg-warning"
                                />
                            )}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}
