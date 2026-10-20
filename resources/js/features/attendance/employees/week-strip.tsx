import { cn, focusRing } from '@/lib/utils';
import { dayHeader, weekStripDates } from './cells';

type Props = {
    selected: string;
    /** Month bounds "YYYY-MM-DD". */
    start: string;
    end: string;
    today: string | null;
    onSelect: (date: string) => void;
};

/**
 * Seven-day strip around the chosen date (mockup MAbsenPegawai): weekday
 * letter + day number, weekends muted, the chosen day in gradient aksi.
 */
export function WeekStrip({ selected, start, end, today, onSelect }: Props) {
    const dates = weekStripDates(selected, start, end);

    return (
        <div role="group" aria-label="Pilih tanggal" className="flex gap-1.5">
            {dates.map((date) => {
                const head = dayHeader(date);
                const active = date === selected;

                return (
                    <button
                        key={date}
                        type="button"
                        aria-pressed={active}
                        aria-current={date === today ? 'date' : undefined}
                        aria-label={`${head.short} ${head.day}${date === today ? ', hari ini' : ''}`}
                        onClick={() => onSelect(date)}
                        className={cn(
                            'flex h-[60px] min-w-0 flex-1 flex-col items-center justify-center rounded-lg text-[12px] font-semibold transition-colors duration-120 ease-brand',
                            active
                                ? 'bg-primary bg-grad-aksi text-on-brand shadow-button'
                                : head.weekend
                                  ? 'bg-surface-2 text-text-subtle'
                                  : 'bg-surface text-text-muted',
                            focusRing,
                        )}
                    >
                        <span aria-hidden>{head.letter}</span>
                        <b
                            aria-hidden
                            className={cn(
                                'font-mono text-[16px] font-semibold',
                                !active && !head.weekend && 'text-text',
                                !active && date === today && 'text-link',
                            )}
                        >
                            {head.day}
                        </b>
                    </button>
                );
            })}
        </div>
    );
}
