import { Link } from '@inertiajs/react';
import { CalendarClock, NotebookPen, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Progress } from '@/components/ui/progress';
import { SegmentedTabs } from '@/components/ui/tabs';
import { formatTime } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { DayTabs } from './day-tabs';
import { LEADERSHIP_DEADLINES, MEETINGS, MINUTES, PEOPLE } from './fixtures';
import type { ActionStatus } from './lib';
import {
    actionStatus,
    firstName,
    isoWeekNumber,
    minutesProgress,
    officeDate,
    personById,
    rangeTitle,
    shortDate,
    sortByStart,
    timeRange,
    weekDates,
} from './lib';
import { ErrorState, ListSkeleton, PreviewBar } from './meeting-ui';
import type { Platform } from './types';
import { useDemoClock, usePreviewState } from './use-preview';
import type { TimedItem } from './week-time-grid';
import { WeekTimeGrid } from './week-time-grid';

type Place = Platform | 'deadline';

const PLACE: Record<
    Place,
    { label: string; tone: string; chip: string; edge: string }
> = {
    meet: {
        label: 'Google Meet',
        tone: 'bg-link-soft',
        chip: 'bg-link-soft text-link',
        edge: 'border-l-primary',
    },
    zoom: {
        label: 'Zoom',
        tone: 'bg-info-soft',
        chip: 'bg-info-soft text-info',
        edge: 'border-l-accent-blue-strong',
    },
    room: {
        label: 'Tatap muka',
        tone: 'bg-surface-2',
        chip: 'bg-surface-2 text-text-muted',
        edge: 'border-l-text-subtle',
    },
    client: {
        label: 'Di klien',
        tone: 'bg-warning-soft',
        chip: 'bg-warning-soft text-warning',
        edge: 'border-l-fill-warning',
    },
    deadline: {
        label: 'Tenggat',
        tone: 'bg-danger-soft',
        chip: 'bg-danger-soft text-danger',
        edge: 'border-l-danger',
    },
};

type AgendaItem = TimedItem & { place: Place; note: string };

type NoteFilter = 'all' | 'draft' | 'open';

const STATUS: Record<
    ActionStatus,
    { label: string; tone: 'info' | 'danger' | 'success' }
> = {
    open: { label: 'Berjalan', tone: 'info' },
    late: { label: 'Terlambat', tone: 'danger' },
    done: { label: 'Selesai', tone: 'success' },
};

/** Data of /manajemen/jadwal (MgJadwal, TfJadwal, MgPJadwal). */
export function useSchedule() {
    const { state } = usePreviewState();
    const now = useDemoClock();
    const today = officeDate(now);
    const days = useMemo(() => weekDates(today), [today]);
    const [day, setDay] = useState(today);
    const [filter, setFilter] = useState<NoteFilter>('all');
    const empty = state === 'kosong';

    const agenda = useMemo<AgendaItem[]>(() => {
        if (empty) {
            return [];
        }

        const meetings = sortByStart(
            MEETINGS.filter(
                (m) => m.leadership && days.includes(officeDate(m.starts_at)),
            ),
        ).map((m): AgendaItem => ({
            id: m.id,
            title: m.title,
            starts_at: m.starts_at,
            ends_at: m.ends_at,
            meta: PLACE[m.platform].label,
            tone: PLACE[m.platform].tone,
            edge: PLACE[m.platform].edge,
            href: `/rapat/${m.id}`,
            place: m.platform,
            note:
                m.minutes_status === 'draft'
                    ? 'notulen draf'
                    : m.minute_taker_id
                      ? `notulis ${firstName(personById(PEOPLE, m.minute_taker_id)?.name ?? '')}`
                      : (m.note ?? ''),
        }));
        const deadlines = LEADERSHIP_DEADLINES.map((d): AgendaItem => ({
            id: d.id,
            title: d.title,
            starts_at: d.at,
            ends_at: null,
            meta: 'Tenggat',
            tone: PLACE.deadline.tone,
            edge: PLACE.deadline.edge,
            place: 'deadline',
            note: d.meta,
        }));

        return [...meetings, ...deadlines].sort((a, b) =>
            a.starts_at.localeCompare(b.starts_at),
        );
    }, [days, empty]);

    const notes = useMemo(() => {
        if (empty) {
            return [];
        }

        return sortByStart(
            MEETINGS.filter(
                (m) =>
                    m.leadership &&
                    (m.minutes_status !== 'none' || m.minute_taker_id) &&
                    officeDate(m.starts_at) <= today,
            ),
        )
            .reverse()
            .map((meeting) => {
                const record =
                    MINUTES.find((item) => item.meeting_id === meeting.id) ??
                    null;
                const progress = record
                    ? minutesProgress(record)
                    : { done: 0, total: 0, pct: 0 };
                const taker = personById(PEOPLE, meeting.minute_taker_id);

                return {
                    meeting,
                    status: record ? record.status : ('none' as const),
                    progress,
                    meta: `${shortDate(officeDate(meeting.starts_at))} ${formatTime(meeting.starts_at)} · notulis ${taker ? firstName(taker.name) : '–'} · ${record ? `${record.decisions.length} keputusan` : 'template agenda siap'}`,
                };
            });
    }, [empty, today]);

    const actions = useMemo(() => {
        if (empty) {
            return [];
        }

        const order: Record<ActionStatus, number> = {
            late: 0,
            open: 1,
            done: 2,
        };

        return MINUTES.filter(
            (record) =>
                MEETINGS.find((m) => m.id === record.meeting_id)?.leadership,
        )
            .flatMap((record) => {
                const meeting = MEETINGS.find(
                    (m) => m.id === record.meeting_id,
                )!;

                return record.action_items.map((item) => ({
                    item,
                    meeting,
                    status: actionStatus(item, today),
                }));
            })
            .sort(
                (a, b) =>
                    order[a.status] - order[b.status] ||
                    a.item.due_date.localeCompare(b.item.due_date),
            );
    }, [empty, today]);

    const filteredNotes = notes.filter((note) =>
        filter === 'all'
            ? true
            : filter === 'draft'
              ? note.status !== 'final'
              : note.progress.done < note.progress.total,
    );

    return {
        state,
        now,
        today,
        days,
        day,
        setDay,
        agenda,
        dayAgenda: agenda.filter((item) => officeDate(item.starts_at) === day),
        notes: filteredNotes,
        filter,
        setFilter,
        actions,
        openCount: actions.filter((a) => a.status !== 'done').length,
    };
}

type ScheduleData = ReturnType<typeof useSchedule>;

function NoteRow({
    note,
    compact = false,
}: {
    note: ScheduleData['notes'][number];
    compact?: boolean;
}) {
    const final = note.status === 'final';

    return (
        <li className="border-t border-divider first:border-t-0">
            <Link
                href={`/rapat/${note.meeting.id}/notulen`}
                className={cn(
                    'flex flex-col gap-2 rounded-sm py-3.5 transition-opacity duration-120 ease-brand hover:opacity-85',
                    focusRing,
                )}
            >
                <span className="flex items-center gap-2.5">
                    <span
                        className={cn(
                            'flex-1 font-bold',
                            compact ? 'text-[15px]' : 'text-[16px]',
                        )}
                    >
                        {note.meeting.title}
                    </span>
                    <Badge
                        variant="status"
                        tone={
                            final
                                ? 'success'
                                : note.status === 'draft'
                                  ? 'warning'
                                  : 'neutral'
                        }
                        className="h-[26px] px-2.5 text-[13px] font-extrabold"
                    >
                        {final
                            ? 'Final'
                            : note.status === 'draft'
                              ? 'Draf'
                              : 'Belum mulai'}
                    </Badge>
                </span>
                {!compact && (
                    <span className="text-[14px] text-text-muted">
                        {note.meta}
                    </span>
                )}
                <span className="flex items-center gap-2.5">
                    <Progress
                        value={note.progress.pct}
                        label={`Tindak lanjut ${note.meeting.title}`}
                        size="sm"
                        className="flex-1"
                    />
                    <span className="text-[13px] font-bold whitespace-nowrap text-text-muted md:text-[14px]">
                        {note.progress.total
                            ? compact
                                ? `${note.progress.done}/${note.progress.total} tindak lanjut`
                                : `${note.progress.done} dari ${note.progress.total} tindak lanjut selesai`
                            : 'belum ada tindak lanjut'}
                    </span>
                </span>
            </Link>
        </li>
    );
}

function NotesPanel({
    data,
    compact = false,
    className,
}: {
    data: ScheduleData;
    compact?: boolean;
    className?: string;
}) {
    return (
        <Panel
            title={compact ? 'Notulensi terbaru' : 'Notulensi'}
            className={className}
            action={
                !compact && (
                    <SegmentedTabs<NoteFilter>
                        label="Saring notulen"
                        value={data.filter}
                        onValueChange={data.setFilter}
                        options={[
                            { value: 'all', label: 'Semua' },
                            { value: 'draft', label: 'Draf' },
                            { value: 'open', label: 'Tindak lanjut terbuka' },
                        ]}
                    />
                )
            }
        >
            {data.notes.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={NotebookPen}
                    title="Belum ada notulen"
                >
                    Notulen rapat pimpinan tampil di sini setelah notulis mulai
                    menulis.
                </EmptyState>
            ) : (
                <ul className="flex flex-col">
                    {data.notes.map((note) => (
                        <NoteRow
                            key={note.meeting.id}
                            note={note}
                            compact={compact}
                        />
                    ))}
                </ul>
            )}
        </Panel>
    );
}

function ActionsPanel({
    data,
    compact = false,
    className,
}: {
    data: ScheduleData;
    compact?: boolean;
    className?: string;
}) {
    const [all, setAll] = useState(false);
    const list = compact
        ? data.actions.filter((a) => a.status !== 'done')
        : data.actions;
    const shown = all ? list : list.slice(0, 7);

    return (
        <Panel
            title={
                compact
                    ? 'Tindak lanjut terbuka'
                    : 'Tindak lanjut rapat pimpinan'
            }
            className={className}
            action={
                <span className="text-[15px] text-text-muted">
                    {data.openCount} terbuka
                </span>
            }
        >
            {list.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={CalendarClock}
                    title="Tidak ada tindak lanjut"
                >
                    Butir tindak lanjut dari notulen rapat pimpinan akan
                    dipantau di sini.
                </EmptyState>
            ) : (
                <ul className="flex flex-col">
                    {shown.map(({ item, meeting, status }) => {
                        const who = personById(PEOPLE, item.assignee_id);

                        return (
                            <li
                                key={`${meeting.id}-${item.id}`}
                                className={cn(
                                    'grid items-center gap-3 border-t border-divider py-3 first:border-t-0',
                                    compact
                                        ? 'grid-cols-[minmax(0,1fr)_auto]'
                                        : 'min-h-[66px] grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_96px_120px]',
                                )}
                            >
                                <span className="flex min-w-0 flex-col gap-0.5">
                                    <span
                                        className={cn(
                                            'font-bold',
                                            compact
                                                ? 'text-[15px]'
                                                : 'text-[16px]',
                                        )}
                                    >
                                        {item.text}
                                    </span>
                                    <span className="text-[13px] text-text-muted md:text-[14px]">
                                        {compact
                                            ? `${who ? firstName(who.name) : '–'} · ${shortDate(item.due_date)}`
                                            : `${who?.name ?? '–'} · dari ${meeting.title}`}
                                    </span>
                                </span>
                                {!compact && (
                                    <span
                                        className={cn(
                                            'hidden text-[15px] font-bold sm:block',
                                            status === 'late' && 'text-danger',
                                        )}
                                    >
                                        {shortDate(item.due_date)}
                                    </span>
                                )}
                                <Badge
                                    variant="status"
                                    tone={STATUS[status].tone}
                                    className="h-7 justify-self-start px-2.5 text-[13px] font-extrabold"
                                >
                                    {STATUS[status].label}
                                </Badge>
                            </li>
                        );
                    })}
                </ul>
            )}
            {list.length > 7 && (
                <Button
                    variant="quiet"
                    className="mt-1 self-start"
                    onClick={() => setAll((open) => !open)}
                >
                    {all
                        ? 'Tampilkan lebih sedikit'
                        : `Lihat semua (${list.length})`}
                </Button>
            )}
        </Panel>
    );
}

function AgendaList({ items }: { items: AgendaItem[] }) {
    if (items.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={CalendarClock}
                title="Tidak ada agenda"
                className="bg-surface"
            >
                Tidak ada rapat pimpinan atau tenggat di hari ini.
            </EmptyState>
        );
    }

    return (
        <ul className="overflow-hidden rounded-[22px] border border-border bg-surface">
            {items.map((item) => {
                const place = PLACE[item.place];
                const body = (
                    <>
                        <span
                            aria-hidden
                            className={cn(
                                'w-0 shrink-0 rounded-[2px] border-l-4',
                                place.edge,
                            )}
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="text-[13px] font-extrabold text-text-muted md:text-[14px]">
                                {timeRange(item.starts_at, item.ends_at)}
                            </span>
                            <span className="text-[16px] font-bold text-text">
                                {item.title}
                            </span>
                            <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-text-muted">
                                <span
                                    className={cn(
                                        'inline-flex h-[22px] items-center rounded-[6px] px-2 font-extrabold',
                                        place.chip,
                                    )}
                                >
                                    {place.label}
                                </span>
                                {item.note}
                            </span>
                        </span>
                    </>
                );

                return (
                    <li
                        key={item.id}
                        className="border-t border-divider first:border-t-0"
                    >
                        {item.href ? (
                            <Link
                                href={item.href}
                                className={cn(
                                    'flex gap-3 px-4 py-3.5 transition-colors duration-120 ease-brand hover:bg-surface-2/60',
                                    focusRing,
                                    'focus-visible:ring-inset',
                                )}
                            >
                                {body}
                            </Link>
                        ) : (
                            <div className="flex gap-3 px-4 py-3.5">{body}</div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

function Body({ data, children }: { data: ScheduleData; children: ReactNode }) {
    if (data.state === 'memuat') {
        return <ListSkeleton rows={5} />;
    }

    if (data.state === 'galat') {
        return (
            <ErrorState
                title="Jadwal pimpinan gagal dimuat"
                description="Google Calendar tidak menjawab. Coba lagi sebentar."
            />
        );
    }

    return <>{children}</>;
}

/** /manajemen/jadwal on desktop (MgJadwal) and tablet (TfJadwal). */
export function ScheduleDesktop({
    data,
    isTablet,
}: {
    data: ScheduleData;
    isTablet: boolean;
}) {
    return (
        <div className="flex flex-col gap-6">
            <PreviewBar />
            <section className="flex flex-wrap items-end justify-between gap-5">
                <div className="flex flex-col gap-2">
                    <h1 className="text-display">Jadwal & notulensi</h1>
                    <span className="text-[18px] text-text-muted">
                        Minggu {isoWeekNumber(data.today)} ·{' '}
                        {rangeTitle(data.days)}
                        {isTablet ? '' : ' · agenda pimpinan dan lintas divisi'}
                    </span>
                </div>
                <Button size="lg" asChild>
                    <Link href="/rapat/baru">
                        <Plus aria-hidden />
                        {isTablet ? 'Rapat' : 'Jadwalkan rapat'}
                    </Link>
                </Button>
            </section>
            <Body data={data}>
                {isTablet ? (
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-start gap-4">
                        <div className="flex flex-col gap-3">
                            <DayTabs
                                dates={data.days}
                                value={data.day}
                                onChange={data.setDay}
                                today={data.today}
                                size="sm"
                            />
                            <AgendaList items={data.dayAgenda} />
                        </div>
                        <div className="flex flex-col gap-4">
                            <NotesPanel data={data} compact />
                            <ActionsPanel data={data} compact />
                        </div>
                    </div>
                ) : (
                    <>
                        <section
                            aria-label="Agenda minggu ini"
                            className="rounded-panel border border-border bg-surface px-6 pt-5 pb-6 shadow-card"
                        >
                            {data.agenda.length === 0 ? (
                                <EmptyState
                                    size="sm"
                                    icon={CalendarClock}
                                    title="Belum ada agenda pimpinan minggu ini"
                                >
                                    Rapat direksi dan lintas divisi yang
                                    dijadwalkan akan tampil di grid ini.
                                </EmptyState>
                            ) : (
                                <WeekTimeGrid
                                    days={data.days}
                                    items={data.agenda}
                                    today={data.today}
                                    now={data.now}
                                />
                            )}
                        </section>
                        <section className="flex flex-wrap items-start gap-5">
                            <NotesPanel
                                data={data}
                                className="flex-[1_1_500px]"
                            />
                            <ActionsPanel
                                data={data}
                                className="flex-[1_1_560px]"
                            />
                        </section>
                    </>
                )}
            </Body>
        </div>
    );
}

/** /manajemen/jadwal on phones (MgPJadwal): Agenda | Notulen. */
export function ScheduleMobile({ data }: { data: ScheduleData }) {
    const [view, setView] = useState<'agenda' | 'notes'>('agenda');

    return (
        <div className="flex flex-col gap-3">
            <PreviewBar />
            <SegmentedTabs
                label="Tampilan"
                value={view}
                onValueChange={setView}
                variant="solid"
                className="w-full"
                options={[
                    { value: 'agenda', label: 'Agenda' },
                    { value: 'notes', label: 'Notulen' },
                ]}
            />
            <Body data={data}>
                {view === 'agenda' ? (
                    <>
                        <DayTabs
                            dates={data.days}
                            value={data.day}
                            onChange={data.setDay}
                            today={data.today}
                            size="sm"
                        />
                        <AgendaList items={data.dayAgenda} />
                    </>
                ) : (
                    <>
                        <NotesPanel data={data} compact />
                        <ActionsPanel data={data} compact />
                    </>
                )}
            </Body>
            <Button size="lg" variant="outline" asChild>
                <Link href="/rapat/baru">
                    <Plus aria-hidden />
                    Jadwalkan rapat
                </Link>
            </Button>
        </div>
    );
}
