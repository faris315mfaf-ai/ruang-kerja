import { Link, router } from '@inertiajs/react';
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Plus,
    UserRoundSearch,
} from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Panel } from '@/components/ui/panel';
import { cn, focusRing } from '@/lib/utils';
import { HubShell } from './hub-shell';
import {
    EVENT_KINDS,
    EVENT_KIND_ORDER,
    WEEKDAYS_SHORT,
    addDays,
    monthGrid,
    monthLabel,
    shiftMonth,
    shortDay,
    weekOf,
} from './lib';
import { AgendaRow } from './parts';
import type { EventKind, HrEvent, HrScheduleProps } from './types';

const CELL_EVENTS = 3;

type Filters = Record<EventKind, boolean>;

export function visibleEvents(
    events: HrEvent[] | undefined,
    filters: Filters,
): HrEvent[] {
    return (events ?? []).filter((event) => filters[event.kind]);
}

function MonthNav({
    month,
    onChange,
    loading,
}: {
    month: string;
    onChange: (month: string) => void;
    loading: boolean;
}) {
    return (
        <div className="flex items-center gap-2" aria-busy={loading}>
            <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Bulan sebelumnya"
                onClick={() => onChange(shiftMonth(month, -1))}
            >
                <ChevronLeft aria-hidden />
            </Button>
            <h2 className="min-w-44 text-center text-h3" aria-live="polite">
                {monthLabel(month)}
            </h2>
            <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Bulan berikutnya"
                onClick={() => onChange(shiftMonth(month, 1))}
            >
                <ChevronRight aria-hidden />
            </Button>
        </div>
    );
}

function EventChip({ event }: { event: HrEvent }) {
    const kind = EVENT_KINDS[event.kind];
    const text = `${event.time ? `${event.time} ` : ''}${event.title}`;
    const className = cn(
        'block truncate rounded-[6px] px-1.5 py-0.5 text-[12px] leading-[18px] font-semibold',
        kind.chip,
    );

    return event.href ? (
        <Link
            href={event.href}
            title={text}
            className={cn(className, 'hover:opacity-80', focusRing)}
        >
            <span className="sr-only">{kind.label}: </span>
            {text}
        </Link>
    ) : (
        <span title={text} className={className}>
            <span className="sr-only">{kind.label}: </span>
            {text}
        </span>
    );
}

function MonthGrid({
    month,
    today,
    days,
    filters,
}: {
    month: string;
    today: string;
    days: Record<string, HrEvent[]>;
    filters: Filters;
}) {
    const weeks = monthGrid(month);

    return (
        <div
            role="table"
            aria-label={`Kalender ${monthLabel(month)}`}
            className="flex flex-col"
        >
            <div role="row" className="grid grid-cols-7 border-b border-border">
                {WEEKDAYS_SHORT.map((day) => (
                    <div
                        key={day}
                        role="columnheader"
                        className="px-2 pb-2 text-[13px] font-bold tracking-[0.04em] text-text-muted uppercase"
                    >
                        {day}
                    </div>
                ))}
            </div>
            {weeks.map((week) => (
                <div
                    role="row"
                    key={week[0]}
                    className="grid grid-cols-7 border-b border-divider last:border-b-0"
                >
                    {week.map((day) => {
                        const events = visibleEvents(days[day], filters);
                        const outside = !day.startsWith(month);
                        const isToday = day === today;

                        return (
                            <div
                                role="cell"
                                key={day}
                                aria-label={`${shortDay(day)}: ${events.length} agenda`}
                                className={cn(
                                    'flex min-h-28 min-w-0 flex-col gap-1 border-l border-divider p-1.5 first:border-l-0',
                                    outside && 'bg-background/60',
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex size-7 items-center justify-center self-start rounded-full text-[14px] font-semibold tnum',
                                        outside && 'text-text-subtle',
                                        isToday &&
                                            'bg-primary bg-grad-aksi text-on-brand',
                                    )}
                                    aria-current={isToday ? 'date' : undefined}
                                >
                                    {Number(day.slice(8, 10))}
                                </span>
                                {events.slice(0, CELL_EVENTS).map((event) => (
                                    <EventChip
                                        key={`${day}-${event.id}`}
                                        event={event}
                                    />
                                ))}
                                {events.length > CELL_EVENTS && (
                                    <span className="px-1.5 text-[12px] font-semibold text-text-muted">
                                        +{events.length - CELL_EVENTS} lagi
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

function FilterList({
    kinds,
    filters,
    onChange,
}: {
    kinds: EventKind[];
    filters: Filters;
    onChange: (kind: EventKind, on: boolean) => void;
}) {
    return (
        <ul className="flex flex-col gap-1">
            {kinds.map((kind) => (
                <li key={kind}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3">
                        <Checkbox
                            checked={filters[kind]}
                            onCheckedChange={(value) =>
                                onChange(kind, value === true)
                            }
                        />
                        <span
                            aria-hidden
                            className={cn(
                                'h-4 w-1.5 rounded-full',
                                EVENT_KINDS[kind].bar,
                            )}
                        />
                        <span className="text-[16px]">
                            {EVENT_KINDS[kind].legend}
                        </span>
                    </label>
                </li>
            ))}
        </ul>
    );
}

/** Ruang HR › Jadwal (Jadwal.dc.html): month grid / week strip + agenda. */
export function HrSchedule({
    props,
    mobile,
}: {
    props: HrScheduleProps;
    mobile: boolean;
}) {
    const { hub, calendar } = props;
    const kinds = EVENT_KIND_ORDER.filter(
        (kind) => kind !== 'meeting' || hub.features.meetings,
    );
    const [filters, setFilters] = useState<Filters>({
        meeting: true,
        interview: true,
        leave: true,
        holiday: true,
    });
    const [loading, setLoading] = useState(false);
    const inMonth = (day: string) => day.startsWith(calendar.month);
    const [selected, setSelected] = useState(
        inMonth(calendar.today) ? calendar.today : `${calendar.month}-01`,
    );
    const [shownMonth, setShownMonth] = useState(calendar.month);

    // A new month arrived: select its first day (or today).
    if (shownMonth !== calendar.month) {
        setShownMonth(calendar.month);
        setSelected(
            inMonth(calendar.today) ? calendar.today : `${calendar.month}-01`,
        );
    }

    const goMonth = (month: string) =>
        router.get(
            window.location.pathname,
            { bulan: month },
            {
                only: ['calendar'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onStart: () => setLoading(true),
                onFinish: () => setLoading(false),
            },
        );

    const toggle = (kind: EventKind, on: boolean) =>
        setFilters((current) => ({ ...current, [kind]: on }));

    const week = visibleEvents(calendar.week, filters);
    const actions = (
        <>
            <Button asChild variant="outline">
                <Link href="/hiring">
                    <UserRoundSearch aria-hidden />
                    Jadwalkan wawancara
                </Link>
            </Button>
            {hub.features.meetings && (
                <Button asChild>
                    <Link href="/rapat/baru">
                        <Plus aria-hidden />
                        Rapat baru
                    </Link>
                </Button>
            )}
        </>
    );

    if (mobile) {
        const days = weekOf(selected);
        const agenda = visibleEvents(calendar.days[selected], filters);
        const stepWeek = (delta: number) => {
            const next = addDays(selected, delta * 7);

            if (next < calendar.from || next > calendar.to) {
                goMonth(next.slice(0, 7));
            } else {
                setSelected(next);
            }
        };

        return (
            <HubShell hub={hub} title="Jadwal · Ruang HR" mobile>
                <div className="flex items-center justify-between gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Minggu sebelumnya"
                        onClick={() => stepWeek(-1)}
                    >
                        <ChevronLeft aria-hidden />
                    </Button>
                    <h2 className="text-title" aria-live="polite">
                        {monthLabel(selected.slice(0, 7))}
                    </h2>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Minggu berikutnya"
                        onClick={() => stepWeek(1)}
                    >
                        <ChevronRight aria-hidden />
                    </Button>
                </div>
                <div
                    role="radiogroup"
                    aria-label="Pilih hari"
                    className={cn(
                        'grid grid-cols-7 gap-1',
                        loading && 'opacity-60',
                    )}
                >
                    {days.map((day, index) => {
                        const active = day === selected;
                        const count = visibleEvents(
                            calendar.days[day],
                            filters,
                        ).length;

                        return (
                            <button
                                key={day}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                aria-label={`${shortDay(day)}, ${count} agenda`}
                                onClick={() => setSelected(day)}
                                className={cn(
                                    'flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-lg text-[13px] font-semibold',
                                    active
                                        ? 'bg-primary bg-grad-aksi text-on-brand'
                                        : 'border border-border bg-surface text-text',
                                    day === calendar.today &&
                                        !active &&
                                        'border-primary',
                                    focusRing,
                                )}
                            >
                                <span
                                    className={cn(!active && 'text-text-muted')}
                                >
                                    {WEEKDAYS_SHORT[index]}
                                </span>
                                <span className="text-[17px] font-bold tnum">
                                    {Number(day.slice(8, 10))}
                                </span>
                                <span
                                    aria-hidden
                                    className={cn(
                                        'size-1.5 rounded-full',
                                        count > 0
                                            ? active
                                                ? 'bg-on-brand'
                                                : 'bg-primary'
                                            : 'bg-transparent',
                                    )}
                                />
                            </button>
                        );
                    })}
                </div>
                <div
                    className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1"
                    role="group"
                    aria-label="Tampilkan"
                >
                    {kinds.map((kind) => (
                        <button
                            key={kind}
                            type="button"
                            aria-pressed={filters[kind]}
                            onClick={() => toggle(kind, !filters[kind])}
                            className={cn(
                                'flex h-[42px] shrink-0 items-center gap-2 rounded-full border px-4 text-[15px] font-semibold',
                                filters[kind]
                                    ? 'border-border-strong bg-surface text-text'
                                    : 'border-border bg-surface-2 text-text-subtle line-through',
                                focusRing,
                            )}
                        >
                            <span
                                aria-hidden
                                className={cn(
                                    'size-2.5 rounded-full',
                                    EVENT_KINDS[kind].bar,
                                )}
                            />
                            {EVENT_KINDS[kind].label}
                        </button>
                    ))}
                </div>
                <Panel title={shortDay(selected)}>
                    {agenda.length === 0 ? (
                        <EmptyState
                            size="sm"
                            icon={CalendarDays}
                            title="Tidak ada agenda"
                        />
                    ) : (
                        <ol className="flex flex-col">
                            {agenda.map((event) => (
                                <AgendaRow key={event.id} event={event} />
                            ))}
                        </ol>
                    )}
                </Panel>
                <div className="grid grid-cols-2 gap-3">
                    <Button asChild variant="outline" size="lg">
                        <Link href="/hiring">Wawancara</Link>
                    </Button>
                    {hub.features.meetings && (
                        <Button asChild size="lg">
                            <Link href="/rapat/baru">Rapat baru</Link>
                        </Button>
                    )}
                </div>
            </HubShell>
        );
    }

    return (
        <HubShell hub={hub} title="Jadwal · Ruang HR" mobile={false}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <MonthNav
                    month={calendar.month}
                    onChange={goMonth}
                    loading={loading}
                />
                <div className="flex flex-wrap gap-3">{actions}</div>
            </div>
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                <section
                    aria-label={`Kalender ${monthLabel(calendar.month)}`}
                    className={cn(
                        'min-w-0 overflow-x-auto rounded-panel border border-border bg-surface p-4 shadow-card transition-opacity duration-120 ease-brand',
                        loading && 'opacity-60',
                    )}
                >
                    <div className="min-w-[640px]">
                        <MonthGrid
                            month={calendar.month}
                            today={calendar.today}
                            days={calendar.days}
                            filters={filters}
                        />
                    </div>
                </section>
                <aside className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
                    <Panel title="Tampilkan">
                        <FilterList
                            kinds={kinds}
                            filters={filters}
                            onChange={toggle}
                        />
                    </Panel>
                    <Panel title="Minggu ini">
                        {week.length === 0 ? (
                            <EmptyState
                                size="sm"
                                icon={CalendarDays}
                                title="Tidak ada agenda minggu ini"
                            />
                        ) : (
                            <ol className="flex flex-col">
                                {week.map((event) => (
                                    <AgendaRow
                                        key={event.id}
                                        event={event}
                                        showDate={shortDay(event.date)}
                                    />
                                ))}
                            </ol>
                        )}
                    </Panel>
                </aside>
            </div>
        </HubShell>
    );
}
