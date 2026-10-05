import { CalendarClock, NotebookPen } from 'lucide-react';
import { formatTime, OFFICE_TIMEZONE } from '@/lib/format';
import { cn } from '@/lib/utils';
import { share, shortDate } from './lib';
import { EmptyState, FOCUS_RING, Panel } from './panel';
import type { AgendaItem, NoteItem } from './types';

/** Meetings & minutes are PRD Fase 2: the panels explain that instead of inventing data. */
const MODULE_OFF = 'Modul rapat & notulen belum aktif';

const PLACES: Record<
    AgendaItem['place'],
    { label: string; className: string }
> = {
    meet: { label: 'Google Meet', className: 'bg-arus-link-bg text-arus-link' },
    zoom: { label: 'Zoom', className: 'bg-arus-info-bg text-arus-info' },
    room: {
        label: 'Tatap muka',
        className: 'bg-arus-surface-2 text-arus-text-2',
    },
    client: {
        label: 'Kunjungan klien',
        className: 'bg-arus-warning-bg text-arus-warning',
    },
};

function officeDay(iso: string): string {
    // "Y-m-d" of the instant in the office timezone.
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: OFFICE_TIMEZONE,
    }).format(new Date(iso));
}

/** "Jadwal terdekat" (design MgDashboard); empty until the meetings module exists. */
export function AgendaPanel({
    agenda,
    today,
    className,
}: {
    agenda: AgendaItem[];
    today: string;
    className?: string;
}) {
    return (
        <Panel title="Jadwal terdekat" className={className}>
            {agenda.length === 0 ? (
                <EmptyState icon={CalendarClock} title={MODULE_OFF}>
                    Jadwal rapat terdekat akan tampil di sini setelah modul
                    rapat & notulen (Fase 2) diaktifkan.
                </EmptyState>
            ) : (
                <ul className="flex flex-col">
                    {agenda.map((item) => {
                        const day = officeDay(item.starts_at);
                        const place = PLACES[item.place];

                        return (
                            <li
                                key={item.id}
                                className="flex items-center gap-4 border-t border-arus-surface-2 py-3"
                            >
                                <span className="flex w-[70px] shrink-0 flex-col">
                                    <span className="text-[18px] font-extrabold">
                                        {formatTime(item.starts_at)}
                                    </span>
                                    <span className="text-[13px] font-bold text-arus-text-2">
                                        {day === today
                                            ? 'Hari ini'
                                            : shortDate(day)}
                                    </span>
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col gap-1">
                                    <span className="text-[16px] font-bold">
                                        {item.title}
                                    </span>
                                    <span className="flex flex-wrap items-center gap-1.5 text-[14px] text-arus-text-2">
                                        <span
                                            className={cn(
                                                'inline-flex h-[22px] items-center rounded-md px-2 font-extrabold',
                                                place.className,
                                            )}
                                        >
                                            {place.label}
                                        </span>
                                        {item.meta}
                                    </span>
                                </span>
                                {item.join_url && (
                                    <a
                                        href={item.join_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={cn(
                                            'inline-flex h-arus-control items-center rounded-arus-control bg-arus-action px-4 text-[15px] font-bold text-arus-on-gradient',
                                            FOCUS_RING,
                                        )}
                                    >
                                        Gabung
                                    </a>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </Panel>
    );
}

/** "Notulensi terbaru" (design MgDashboard); empty until the meetings module exists. */
export function NotesPanel({
    notes,
    className,
}: {
    notes: NoteItem[];
    className?: string;
}) {
    return (
        <Panel title="Notulensi terbaru" className={className}>
            {notes.length === 0 ? (
                <EmptyState icon={NotebookPen} title={MODULE_OFF}>
                    Notulensi dan tindak lanjut rapat akan tampil di sini
                    setelah modul rapat & notulen (Fase 2) diaktifkan.
                </EmptyState>
            ) : (
                <ul className="flex flex-col">
                    {notes.map((note) => (
                        <li key={note.id}>
                            <a
                                href={note.url}
                                className={cn(
                                    'flex flex-col gap-2 border-t border-arus-surface-2 py-3.5 text-arus-text',
                                    FOCUS_RING,
                                )}
                            >
                                <span className="flex items-center gap-2.5">
                                    <span className="flex-1 text-[16px] font-bold">
                                        {note.title}
                                    </span>
                                    <span
                                        className={cn(
                                            'inline-flex h-[26px] items-center rounded-full px-2.5 text-[13px] font-extrabold',
                                            note.status === 'final'
                                                ? 'bg-arus-success-bg text-arus-success'
                                                : 'bg-arus-warning-bg text-arus-warning',
                                        )}
                                    >
                                        {note.status === 'final'
                                            ? 'Final'
                                            : 'Draf'}
                                    </span>
                                </span>
                                <span className="text-[14px] text-arus-text-2">
                                    {note.meta}
                                </span>
                                <span className="flex items-center gap-2.5">
                                    <span
                                        aria-hidden
                                        className="relative h-2 flex-1 rounded-full bg-arus-surface-2"
                                    >
                                        <span
                                            className="absolute inset-y-0 left-0 rounded-full bg-arus-brand-x"
                                            style={{
                                                width: `${share(note.actions_done, note.actions_total)}%`,
                                            }}
                                        />
                                    </span>
                                    <span className="text-[14px] font-bold whitespace-nowrap text-arus-text-2">
                                        {note.actions_done} dari{' '}
                                        {note.actions_total} tindak lanjut
                                        selesai
                                    </span>
                                </span>
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}
