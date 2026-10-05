import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WEEKDAYS } from '@/lib/attendance';
import { formatTime } from '@/lib/format';
import {
    CALENDAR_TONES,
    calendarWeeks,
    cellLabel,
    kindTone,
    legend,
} from '@/lib/recap';
import { cn, focusRing } from '@/lib/utils';
import type { RecapDayCell, RecapRow } from '@/types/attendance';

type Props = {
    days: RecapDayCell[];
    selected?: string | null;
    onSelect?: (cell: RecapDayCell) => void;
    /** `cells`: 74px labelled tiles (SAbsensi); `dots`: 40px day tiles (MSRiwayat). */
    variant?: 'cells' | 'dots';
    today?: string;
    /** Shorter 56px tiles for narrow side panels (recap detail). */
    dense?: boolean;
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

/** Text under the day number: check-in time for a normal day, else the short status. */
function tileLabel(cell: RecapDayCell): string | null {
    if (cell.kind === 'present' && cell.checkIn) {
        return formatTime(cell.checkIn.occurredAt);
    }

    if (cell.kind === 'holiday') {
        return cell.holidayName ?? 'Libur';
    }

    return cellLabel(cell);
}

/** Colours of one day tile. */
function tileClasses(
    cell: RecapDayCell,
    isToday: boolean,
    dots: boolean,
): string {
    if (isToday) {
        return 'bg-primary bg-grad-aksi text-on-brand';
    }

    const tone = kindTone(cell.kind);

    if (tone !== 'neutral') {
        return CALENDAR_TONES[tone].soft;
    }

    if (dots) {
        return 'text-text-subtle';
    }

    return cell.isWorkday && cell.kind !== 'holiday'
        ? 'border border-divider bg-surface text-text-subtle'
        : 'bg-background text-text-subtle';
}

/** Month grid (SAbsensi "Oktober 2026", MSRiwayat, recap detail panel). */
export function MonthCalendar({
    days,
    selected,
    onSelect,
    variant = 'cells',
    today,
    dense = false,
    className,
}: Props) {
    const weeks = calendarWeeks(days);
    const dots = variant === 'dots';

    return (
        <div className={className}>
            <div
                className={cn(
                    'grid grid-cols-7 pb-1.5 text-center font-bold text-text-muted',
                    dots ? 'gap-1 text-[13px]' : 'gap-2 text-[14px]',
                )}
                aria-hidden
            >
                {WEEKDAYS.map((day) => (
                    <span key={day.value}>{day.short}</span>
                ))}
            </div>
            <div
                role="grid"
                aria-label="Kalender absensi"
                className={cn('grid', dots ? 'gap-1' : 'gap-2')}
            >
                {weeks.map((week, index) => (
                    <div
                        key={index}
                        role="row"
                        className={cn(
                            'grid grid-cols-7',
                            dots ? 'gap-1' : 'gap-2',
                        )}
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

                            const isSelected = selected === cell.date;
                            const colours = tileClasses(
                                cell,
                                today === cell.date,
                                dots,
                            );
                            const label = tileLabel(cell);
                            const ring =
                                isSelected &&
                                'ring-2 ring-primary ring-offset-2 ring-offset-surface';
                            const content = dots ? (
                                <span
                                    className={cn(
                                        'flex h-10 items-center justify-center rounded-[11px] text-[15px] font-bold tnum',
                                        colours,
                                        ring,
                                    )}
                                >
                                    {Number(cell.date.slice(8))}
                                </span>
                            ) : (
                                <span
                                    className={cn(
                                        'flex flex-col justify-between rounded-[14px] py-2 text-left',
                                        dense
                                            ? 'h-14 rounded-control px-1.5 py-1.5'
                                            : 'h-[74px] px-2.5',
                                        colours,
                                        ring,
                                    )}
                                >
                                    <span className="text-[16px] leading-5 font-bold tnum">
                                        {Number(cell.date.slice(8))}
                                    </span>
                                    {label && (
                                        <span
                                            className={cn(
                                                'truncate leading-4 font-bold tnum',
                                                dense
                                                    ? 'text-[12px]'
                                                    : 'text-[13px]',
                                            )}
                                        >
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
                                    className="min-w-0"
                                >
                                    {onSelect ? (
                                        <button
                                            type="button"
                                            onClick={() => onSelect(cell)}
                                            aria-label={describe(cell)}
                                            className={cn(
                                                'block w-full rounded-[14px]',
                                                focusRing,
                                            )}
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
                'flex flex-wrap gap-x-4 gap-y-1.5 text-[14px] text-text-muted',
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
                            'size-2 rounded-full',
                            CALENDAR_TONES[item.tone].solid,
                        )}
                    />
                    {item.label}{' '}
                    <span className="font-semibold text-text tnum">
                        {item.count}
                    </span>
                </li>
            ))}
        </ul>
    );
}

/**
 * Month switch (SAbsensi / MSRiwayat "Bulan"): previous · label · next in a
 * light track. `fill` stretches it over the width (phone).
 */
export function MonthNav({
    label,
    onPrevious,
    onNext,
    nextDisabled = false,
    fill = false,
    className,
}: {
    label: string;
    onPrevious: () => void;
    onNext: () => void;
    nextDisabled?: boolean;
    fill?: boolean;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'items-center gap-1 rounded-[14px] p-1',
                fill
                    ? 'flex w-full rounded-lg bg-surface-2'
                    : 'inline-flex border border-border bg-surface/75',
                className,
            )}
        >
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn('rounded-[10px]', !fill && 'size-10')}
                onClick={onPrevious}
                aria-label="Bulan sebelumnya"
            >
                <ChevronLeft aria-hidden />
            </Button>
            <h2
                aria-live="polite"
                className={cn(
                    'min-w-0 px-3 text-center text-[16px] font-bold text-text first-letter:uppercase',
                    fill && 'flex-1 truncate',
                )}
            >
                {label}
            </h2>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn('rounded-[10px]', !fill && 'size-10')}
                onClick={onNext}
                disabled={nextDisabled}
                aria-label="Bulan berikutnya"
            >
                <ChevronRight aria-hidden />
            </Button>
        </div>
    );
}
