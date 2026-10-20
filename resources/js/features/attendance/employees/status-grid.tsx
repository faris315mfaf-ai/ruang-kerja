import { memo } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
    LEGEND,
    cellAriaLabel,
    cellStyle,
    cellTimes,
    dayHeader,
} from './cells';
import type { GridCell, GridRow } from './types';

type Props = {
    rows: GridRow[];
    /** Every date of the month, "YYYY-MM-DD". */
    dates: string[];
    /** Office date of today when it falls in the month. */
    today: string | null;
    monthLabel: string;
    selected: { employeeId: string; date: string } | null;
    onSelect: (row: GridRow, cell: GridCell) => void;
};

const cellFocus =
    'outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

/**
 * Absensi › Pegawai month grid (mockup Main.dc.html): sticky name column,
 * one 30px button per day, month totals on the right, legend below.
 */
export function StatusGrid({
    rows,
    dates,
    today,
    monthLabel,
    selected,
    onSelect,
}: Props) {
    return (
        <section
            aria-label={`Grid absensi pegawai ${monthLabel}`}
            className="overflow-hidden rounded-panel border border-border bg-surface shadow-card"
        >
            <div className="overflow-x-auto">
                <table className="w-full border-collapse tnum">
                    <thead>
                        <tr className="border-b border-divider">
                            <th
                                scope="col"
                                className="sticky left-0 z-10 min-w-[220px] bg-surface px-4 py-2.5 text-left text-[14px] font-bold text-text-muted"
                            >
                                Pegawai
                            </th>
                            {dates.map((date) => {
                                const head = dayHeader(date);
                                const isToday = date === today;

                                return (
                                    <th
                                        key={date}
                                        scope="col"
                                        aria-label={`${head.short} ${head.day}`}
                                        className={cn(
                                            'min-w-9 px-0.5 py-2 text-center text-[12px] leading-tight font-semibold text-text-muted',
                                            isToday &&
                                                'rounded-t-[10px] bg-link-soft',
                                        )}
                                    >
                                        <span aria-hidden className="block">
                                            {head.letter}
                                        </span>
                                        <span
                                            aria-hidden
                                            className={cn(
                                                'block font-mono text-[13px] font-semibold',
                                                isToday
                                                    ? 'text-link'
                                                    : head.weekend
                                                      ? 'text-text-subtle'
                                                      : 'text-text',
                                            )}
                                        >
                                            {head.day}
                                        </span>
                                    </th>
                                );
                            })}
                            <TotalHead first title="Hadir">
                                Hadir
                            </TotalHead>
                            <TotalHead title="Terlambat (kali)">Tlt</TotalHead>
                            <TotalHead title="Alpha">Alpha</TotalHead>
                            <TotalHead title="Izin, sakit, cuti (hari)">
                                I/S/C
                            </TotalHead>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-divider">
                        {rows.map((row) => (
                            <GridRowView
                                key={row.id}
                                row={row}
                                today={today}
                                selectedDate={
                                    selected?.employeeId === row.id
                                        ? selected.date
                                        : null
                                }
                                onSelect={onSelect}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
            <GridLegend />
        </section>
    );
}

function TotalHead({
    children,
    title,
    first = false,
}: {
    children: string;
    title: string;
    first?: boolean;
}) {
    return (
        <th
            scope="col"
            title={title}
            className={cn(
                'px-2.5 text-center text-[13px] font-bold whitespace-nowrap text-text-muted',
                first && 'border-l border-divider',
            )}
        >
            {children}
        </th>
    );
}

const GridRowView = memo(function GridRowView({
    row,
    today,
    selectedDate,
    onSelect,
}: {
    row: GridRow;
    today: string | null;
    selectedDate: string | null;
    onSelect: (row: GridRow, cell: GridCell) => void;
}) {
    return (
        <tr className="group">
            <th
                scope="row"
                className="sticky left-0 z-10 bg-surface px-4 py-2 text-left font-normal group-hover:bg-surface-2"
            >
                <div className="flex items-center gap-3">
                    <UserAvatar
                        name={row.name}
                        className="size-9 shrink-0 text-[13px]"
                    />
                    <span className="min-w-0">
                        <span className="block max-w-48 truncate text-[15px] leading-5 font-semibold text-text">
                            {row.name}
                        </span>
                        <span className="block max-w-48 truncate text-[13px] leading-[18px] text-text-muted">
                            {[row.division, row.position]
                                .filter(Boolean)
                                .join(' · ') || '–'}
                        </span>
                    </span>
                </div>
            </th>
            {row.cells.map((cell) => {
                const style = cellStyle(cell.code);
                const label = cellAriaLabel(row.name, cell);
                const times = cellTimes(cell);

                return (
                    <td
                        key={cell.date}
                        className={cn(
                            'px-[3px] py-[5px] group-hover:bg-surface-2/60',
                            cell.date === today && 'bg-link-soft',
                        )}
                    >
                        <button
                            type="button"
                            aria-label={label}
                            aria-pressed={selectedDate === cell.date}
                            title={
                                times
                                    ? `${style.label} · ${times}`
                                    : style.label
                            }
                            onClick={() => onSelect(row, cell)}
                            className={cn(
                                'relative mx-auto flex size-[30px] items-center justify-center rounded-[8px] font-mono text-[13px] font-semibold transition-transform duration-120 ease-brand active:scale-90',
                                style.className,
                                selectedDate === cell.date &&
                                    'outline-[3px] outline-offset-2 outline-fill-teal outline-solid',
                                cellFocus,
                            )}
                        >
                            {style.letter}
                            {cell.manual && (
                                <span
                                    aria-hidden
                                    className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-primary"
                                />
                            )}
                        </button>
                    </td>
                );
            })}
            <td className="border-l border-divider px-2.5 text-center font-mono text-[15px] font-semibold text-text">
                {formatNumber(row.totals.present)}
            </td>
            <td
                className={cn(
                    'px-2.5 text-center font-mono text-[15px] font-semibold',
                    row.totals.late > 0 ? 'text-warning' : 'text-text-muted',
                )}
            >
                {formatNumber(row.totals.late)}
            </td>
            <td
                className={cn(
                    'px-2.5 text-center font-mono text-[15px] font-semibold',
                    row.totals.absent > 0 ? 'text-danger' : 'text-text-muted',
                )}
            >
                {formatNumber(row.totals.absent)}
            </td>
            <td className="px-2.5 pr-4 text-center font-mono text-[15px] font-semibold text-text">
                {formatNumber(row.totals.permit_sick_leave)}
            </td>
        </tr>
    );
});

export function GridLegend() {
    return (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-divider px-5 py-4 text-[14px] text-text-muted">
            {LEGEND.map((code) => {
                const style = cellStyle(code);

                return (
                    <span key={code} className="flex items-center gap-2">
                        <span
                            aria-hidden
                            className={cn(
                                'flex size-6 items-center justify-center rounded-[7px] font-mono text-[12px] font-semibold',
                                style.className,
                            )}
                        >
                            {style.letter}
                        </span>
                        {style.label}
                    </span>
                );
            })}
            <span className="flex items-center gap-2">
                <span
                    aria-hidden
                    className="relative size-6 rounded-[7px] bg-surface-2"
                >
                    <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-primary" />
                </span>
                Diatur HR
            </span>
            <span className="ml-auto">
                Setiap perubahan HR wajib beralasan dan tercatat di audit log
            </span>
        </div>
    );
}
