import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { WEEKDAYS, formatDuration } from '@/lib/attendance';
import { formatTime } from '@/lib/format';
import { isoWeekday, kindTone } from '@/lib/recap';
import { cn, focusRing } from '@/lib/utils';
import type { RecapDayCell } from '@/types/attendance';

export type MonthNote = {
    date: string;
    kind: string;
    text: string;
    tone: BadgeTone;
};

const FROM_REQUEST = ['leave', 'permit', 'sick', 'business_trip'];

/**
 * Days worth a note in "Catatan bulan ini" (SAbsensi / MSRiwayat): anything
 * but a normal on-time day, plus approved overtime and flagged days.
 */
export function monthNotes(days: RecapDayCell[]): MonthNote[] {
    const notes: MonthNote[] = [];

    for (const cell of days) {
        const extras = [
            cell.overtimeMinutes > 0
                ? `Lembur disetujui ${formatDuration(cell.overtimeMinutes)}.`
                : null,
            cell.isSuspicious ? 'Sinyal tidak biasa, ditinjau HR.' : null,
        ].filter(Boolean);
        const checkIn = cell.checkIn
            ? `Masuk ${formatTime(cell.checkIn.occurredAt)}.`
            : null;
        let note: Omit<MonthNote, 'date'> | null = null;

        switch (cell.kind) {
            case 'late':
                note = {
                    kind: `Terlambat ${cell.lateMinutes} menit`,
                    text: checkIn ?? 'Masuk melewati batas toleransi.',
                    tone: 'warning',
                };
                break;
            case 'early_leave':
                note = {
                    kind: `Pulang cepat ${cell.earlyLeaveMinutes} menit`,
                    text: cell.checkOut
                        ? `Pulang ${formatTime(cell.checkOut.occurredAt)}.`
                        : 'Pulang sebelum jadwal.',
                    tone: 'warning',
                };
                break;
            case 'absent':
                note = {
                    kind: cell.statusLabel ?? 'Alpha',
                    text: 'Tidak ada check-in pada hari kerja ini.',
                    tone: 'danger',
                };
                break;
            case 'needs_correction':
                note = {
                    kind: cell.statusLabel ?? 'Perlu koreksi',
                    text: `${checkIn ?? ''} Check-in/out belum lengkap, ajukan koreksi.`.trim(),
                    tone: 'danger',
                };
                break;
            case 'wfh':
                note = {
                    kind: cell.statusLabel ?? 'WFH',
                    text: checkIn ?? 'Bekerja dari luar kantor.',
                    tone: 'link',
                };
                break;
            default:
                if (FROM_REQUEST.includes(cell.kind)) {
                    note = {
                        kind: cell.statusLabel ?? 'Cuti',
                        text: 'Tercatat dari pengajuan yang disetujui.',
                        tone: 'info',
                    };
                } else if (extras.length > 0) {
                    note = {
                        kind:
                            cell.overtimeMinutes > 0
                                ? `Lembur ${formatDuration(cell.overtimeMinutes)}`
                                : 'Ditinjau',
                        text: checkIn ?? '',
                        tone:
                            kindTone(cell.kind) === 'neutral'
                                ? 'neutral'
                                : 'success',
                    };
                }
        }

        if (note) {
            notes.push({
                date: cell.date,
                ...note,
                text: [note.text, ...extras].filter(Boolean).join(' '),
            });
        }
    }

    return notes;
}

/**
 * "Catatan bulan ini" rows: date tile, status pill and one sentence. A row
 * selects its day in the calendar.
 */
export function MonthNotes({
    days,
    selected,
    onSelect,
    compact = false,
    className,
}: {
    days: RecapDayCell[];
    selected?: string | null;
    onSelect?: (date: string) => void;
    /** Phone (MSRiwayat): day number, sentence, pill on the right. */
    compact?: boolean;
    className?: string;
}) {
    const notes = monthNotes(days);

    if (notes.length === 0) {
        return (
            <p
                className={cn(
                    'px-6 py-3.5 text-[16px] text-text-muted',
                    compact && 'px-4 text-[15px]',
                    className,
                )}
            >
                Belum ada catatan bulan ini. Semua hari tercatat normal.
            </p>
        );
    }

    return (
        <ul className={cn('divide-y divide-divider', className)}>
            {notes.map((note) => {
                const day = Number(note.date.slice(8));
                const weekday = WEEKDAYS[isoWeekday(note.date) - 1].short;
                const active = selected === note.date;
                const pill = (
                    <Badge
                        variant="status"
                        tone={note.tone}
                        className={cn(
                            'h-7 px-2.5 text-[14px]',
                            compact &&
                                'h-[26px] px-2 text-[13px] font-extrabold',
                        )}
                    >
                        {note.kind}
                    </Badge>
                );
                const body = compact ? (
                    <>
                        <span className="w-11 shrink-0 text-center text-[20px] font-extrabold tnum">
                            {day}
                        </span>
                        <span className="min-w-0 flex-1 text-[15px] leading-[21px] text-text">
                            {note.text}
                        </span>
                        {pill}
                    </>
                ) : (
                    <>
                        <span className="flex w-[54px] shrink-0 flex-col items-center rounded-control bg-background py-1.5">
                            <span className="text-[20px] leading-6 font-extrabold text-text tnum">
                                {day}
                            </span>
                            <span className="text-[13px] font-bold text-text-muted">
                                {weekday}
                            </span>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                            {pill}
                            <span className="text-[16px] leading-[23px] text-text">
                                {note.text}
                            </span>
                        </span>
                    </>
                );
                const row = cn(
                    'flex w-full gap-3.5 text-left',
                    compact
                        ? 'items-center px-3.5 py-3'
                        : 'items-start px-6 py-3.5',
                    active && 'bg-link-soft/60',
                );

                return (
                    <li key={note.date}>
                        {onSelect ? (
                            <button
                                type="button"
                                onClick={() => onSelect(note.date)}
                                aria-pressed={active}
                                className={cn(
                                    row,
                                    'transition-colors duration-120 ease-brand hover:bg-background',
                                    focusRing,
                                    'focus-visible:ring-inset',
                                )}
                            >
                                {body}
                            </button>
                        ) : (
                            <div className={row}>{body}</div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
