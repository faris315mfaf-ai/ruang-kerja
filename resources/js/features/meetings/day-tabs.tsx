import type { KeyboardEvent } from 'react';
import { useRef } from 'react';
import { nextTabIndex } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { dayNumber, dayShort } from './lib';

/**
 * Day picker of the agenda screens (DRapat, MRapat, TfJadwal): one tile per
 * day with weekday, date and optional count; selected = gradient aksi.
 * WAI-ARIA tabs with roving focus (←/→/Home/End).
 */
export function DayTabs({
    dates,
    value,
    onChange,
    counts,
    today,
    size = 'md',
    label = 'Hari',
    className,
}: {
    dates: string[];
    value: string;
    onChange: (date: string) => void;
    /** Number shown under the date ("3 rapat"). */
    counts?: Record<string, number>;
    today?: string;
    size?: 'sm' | 'md';
    label?: string;
    className?: string;
}) {
    const refs = useRef<(HTMLButtonElement | null)[]>([]);

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        const index = dates.indexOf(value);
        const next = nextTabIndex(index, event.key, dates.length);

        if (next === null) {
            return;
        }

        event.preventDefault();
        onChange(dates[next]);
        refs.current[next]?.focus();
    };

    return (
        <div
            role="tablist"
            aria-label={label}
            className={cn('grid gap-1.5 md:gap-2.5', className)}
            style={{
                gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))`,
            }}
        >
            {dates.map((date, index) => {
                const selected = date === value;
                const count = counts?.[date];

                return (
                    <button
                        key={date}
                        ref={(element) => {
                            refs.current[index] = element;
                        }}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        tabIndex={selected ? 0 : -1}
                        aria-label={`${dayShort(date)} ${dayNumber(date)}${date === today ? ', hari ini' : ''}${count !== undefined ? `, ${count} rapat` : ''}`}
                        onClick={() => onChange(date)}
                        onKeyDown={onKeyDown}
                        className={cn(
                            'flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[16px] transition-[background-color,box-shadow,color] duration-120 ease-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:rounded-[18px]',
                            size === 'md' ? 'h-16 md:h-[76px]' : 'h-[60px]',
                            selected
                                ? 'bg-grad-aksi text-on-brand shadow-glow'
                                : 'border border-border bg-surface text-text hover:bg-surface-2',
                        )}
                    >
                        <span className="text-[13px] font-bold md:text-[14px]">
                            {dayShort(date)}
                        </span>
                        <span className="text-[21px] leading-7 font-extrabold md:text-[24px]">
                            {dayNumber(date)}
                        </span>
                        {count !== undefined && size === 'md' && (
                            <span className="hidden text-[13px] font-bold opacity-90 md:block">
                                {count} rapat
                            </span>
                        )}
                        {date === today && !selected && (
                            <span
                                aria-hidden
                                className="size-1.5 rounded-full bg-primary md:hidden"
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
