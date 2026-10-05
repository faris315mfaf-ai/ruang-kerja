import {
    CALENDAR_TONES,
    calendarWeeks,
    cellLabel,
    kindTone,
    legend,
} from '@/lib/recap';
import { WEEKDAYS } from '@/lib/attendance';
import { cn } from '@/lib/utils';
import type { RecapDayCell, RecapRow } from '@/types/attendance';

type Props = {
    days: RecapDayCell[];
    selected?: string | null;
    onSelect?: (cell: RecapDayCell) => void;
    /** `cells`: labelled rectangles (desktop panel); `dots`: round days (mobile). */
    variant?: 'cells' | 'dots';
    today?: string;
    className?: string;
};

function describe(cell: RecapDayCell): string {
    const label =
        cell.statusLabel ??
        cellLabel(cell) ??
        (cell.kind === 'off'
            ? 'Libur/akhir pekan'
            : cell.kind === 'upcoming'
              ? 'Terjadwal'
              : cell.kind === 'none'
                ? 'Belum ada catatan'
                : '');

    return `${Number(cell.date.slice(8))} · ${label}${cell.lateMinutes > 0 ? ` ${cell.lateMinutes} menit` : ''}`;
}

/** Month grid (mockups RekapAbsensi detail panel, MRiwayatAbsensi). */
export function MonthCalendar({
    days,
    selected,
    onSelect,
    variant = 'cells',
    today,
    className,
}: Props) {
    const weeks = calendarWeeks(days);
    const dots = variant === 'dots';

    return (
        <div className={className}>
            <div
                className="grid grid-cols-7 gap-1.5 pb-1.5 text-center text-xs text-text-muted"
                aria-hidden
            >
                {WEEKDAYS.map((day) => (
                    <span key={day.value}>{day.short}</span>
                ))}
            </div>
            <div
                role="grid"
                aria-label="Kalender absensi"
                className="grid gap-1.5"
            >
                {weeks.map((week, index) => (
                    <div
                        key={index}
                        role="row"
                        className="grid grid-cols-7 gap-1.5"
                    >
                        {week.map((cell, slot) => {
                            if (!cell) {
                                return (
                                    <span
                                        key={`blank-${slot}`}
                                        role="gridcell"
                                        aria-hidden
                                    />
                                );
                            }

                            const tone = kindTone(cell.kind);
                            const muted = tone === 'neutral';
                            const classes = CALENDAR_TONES[tone];
                            const label = cellLabel(cell);
                            const isSelected = selected === cell.date;
                            const content = dots ? (
                                <span
                                    className={cn(
                                        'mx-auto flex size-11 items-center justify-center rounded-full text-[17px] font-medium tnum',
                                        muted
                                            ? 'text-text-subtle'
                                            : classes.soft,
                                        isSelected &&
                                            'ring-2 ring-text ring-offset-2 ring-offset-surface',
                                        today === cell.date &&
                                            !isSelected &&
                                            'ring-1 ring-border-strong',
                                    )}
                                >
                                    {Number(cell.date.slice(8))}
                                </span>
                            ) : (
                                <span
                                    className={cn(
                                        'flex h-11 flex-col items-start justify-between rounded-md px-1.5 py-1 text-left',
                                        muted
                                            ? 'bg-surface-2 text-text-subtle'
                                            : classes.soft,
                                        isSelected && 'ring-2 ring-primary',
                                    )}
                                >
                                    <span className="text-[13px] leading-none font-semibold tnum">
                                        {Number(cell.date.slice(8))}
                                    </span>
                                    {label && cell.kind !== 'holiday' && (
                                        <span className="truncate text-[10px] leading-none">
                                            {label}
                                        </span>
                                    )}
                                </span>
                            );

                            return (
                                <span
                                    key={cell.date}
                                    role="gridcell"
                                    aria-selected={isSelected || undefined}
                                >
                                    {onSelect ? (
                                        <button
                                            type="button"
                                            onClick={() => onSelect(cell)}
                                            aria-label={describe(cell)}
                                            className="block w-full rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                        >
                                            {content}
                                        </button>
                                    ) : (
                                        <span
                                            aria-label={describe(cell)}
                                            title={
                                                cell.holidayName ?? undefined
                                            }
                                            className="block"
                                        >
                                            {content}
                                        </span>
                                    )}
                                </span>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function CalendarLegend({
    row,
    className,
}: {
    row: RecapRow;
    className?: string;
}) {
    return (
        <ul
            className={cn(
                'flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-text',
                className,
            )}
        >
            {legend(row).map((item) => (
                <li
                    key={item.label}
                    className="inline-flex items-center gap-1.5"
                >
                    <span
                        aria-hidden
                        className={cn(
                            'size-2.5 rounded-full',
                            CALENDAR_TONES[item.tone].solid,
                        )}
                    />
                    {item.label} <span className="tnum">{item.count}</span>
                </li>
            ))}
        </ul>
    );
}
