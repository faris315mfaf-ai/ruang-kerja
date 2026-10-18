import { CalendarClock, NotebookPen } from 'lucide-react';
import { formatTime, officeDateFormat } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { share, shortDate } from './lib';
import { Panel } from '@/components/ui/panel';
import { EmptyState } from '@/components/empty-state';
import type { AgendaItem, NoteItem } from './types';

/** Meetings & minutes are PRD Fase 2: the panels explain that instead of inventing data. */
const MODULE_OFF = 'Modul rapat & notulen belum aktif';

const PLACES: Record<
    AgendaItem['place'],
    { label: string; className: string }
> = {
    meet: { label: 'Google Meet', className: 'bg-link-soft text-link' },
    zoom: { label: 'Zoom', className: 'bg-info-soft text-info' },
    room: {
        label: 'Tatap muka',
        className: 'bg-surface-2 text-text-muted',
    },
    client: {
        label: 'Kunjungan klien',
        className: 'bg-warning-soft text-warning',
    },
};

function officeDay(iso: string): string {
    // "Y-m-d" of the instant in the office timezone.
    return officeDateFormat('en-CA', {}).format(new Date(iso));
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
                <EmptyState size="sm" icon={CalendarClock} title={MODULE_OFF}>
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
                                className="flex items-center gap-4 border-t border-divider py-3"
                            >
                                <span className="flex w-[70px] shrink-0 flex-col">
                                    <span className="text-[18px] font-extrabold">
                                        {formatTime(item.starts_at)}
                                    </span>
                                    <span className="text-[13px] font-bold text-text-muted">
                                        {day === today
                                            ? 'Hari ini'
                                            : shortDate(day)}
                                    </span>
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col gap-1">
                                    <span className="text-[16px] font-bold">
                                        {item.title}
                                    </span>
                                    <span className="flex flex-wrap items-center gap-1.5 text-[14px] text-text-muted">
                                        <span
                                            className={cn(
                                                'inline-flex h-[22px] items-center rounded-sm px-2 font-extrabold',
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
                                            'inline-flex h-control items-center rounded-control bg-grad-aksi px-4 text-[15px] font-bold text-on-brand',
                                            focusRing,
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
                <EmptyState size="sm" icon={NotebookPen} title={MODULE_OFF}>
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
                                    'flex flex-col gap-2 border-t border-divider py-3.5 text-text',
                                    focusRing,
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
                                                ? 'bg-success-soft text-success'
                                                : 'bg-warning-soft text-warning',
                                        )}
                                    >
                                        {note.status === 'final'
                                            ? 'Final'
                                            : 'Draf'}
                                    </span>
                                </span>
                                <span className="text-[14px] text-text-muted">
                                    {note.meta}
                                </span>
                                <span className="flex items-center gap-2.5">
                                    <span
                                        aria-hidden
                                        className="relative h-2 flex-1 rounded-full bg-surface-2"
                                    >
                                        <span
                                            className="absolute inset-y-0 left-0 rounded-full bg-grad-merek-x"
                                            style={{
                                                width: `${share(note.actions_done, note.actions_total)}%`,
                                            }}
                                        />
                                    </span>
                                    <span className="text-[14px] font-bold whitespace-nowrap text-text-muted">
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
