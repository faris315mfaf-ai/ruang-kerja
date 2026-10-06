import { Link } from '@inertiajs/react';
import {
    CalendarOff,
    CalendarRange,
    ChevronLeft,
    ChevronRight,
    Link2,
    Plus,
    RefreshCw,
} from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Spinner } from '@/components/ui/spinner';
import { SegmentedTabs } from '@/components/ui/tabs';
import { cn, focusRing } from '@/lib/utils';
import { DayTabs } from './day-tabs';
import {
    ALL_LAYERS,
    dayNumber,
    isoWeekday,
    isoWeekNumber,
    LAYER_LABEL,
    longDate,
    monthTitle,
    rangeTitle,
} from './lib';
import { ErrorState, ListSkeleton, PreviewBar, SyncChip } from './meeting-ui';
import type { CalendarEntry, CalendarLayer } from './types';
import type { CalendarData, CalendarView } from './use-calendar';
import { WeekTimeGrid } from './week-time-grid';

const PREVIEWS = [{ label: 'Belum terhubung', query: 'keadaan=terputus' }];
const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/** Colours per layer (dot/edge = fills, chip = soft background + text). */
export const LAYER_STYLE: Record<
    CalendarLayer | 'overdue',
    { chip: string; edge: string; dot: string }
> = {
    meetings: {
        chip: 'bg-link-soft text-link',
        edge: 'border-l-primary',
        dot: 'bg-primary',
    },
    tasks: {
        chip: 'bg-warning-soft text-warning',
        edge: 'border-l-fill-warning',
        dot: 'bg-fill-warning',
    },
    overdue: {
        chip: 'bg-danger-soft text-danger',
        edge: 'border-l-danger',
        dot: 'bg-danger',
    },
    leave: {
        chip: 'bg-info-soft text-info',
        edge: 'border-l-accent-blue',
        dot: 'bg-accent-blue',
    },
    holidays: {
        chip: 'bg-surface-2 text-text-muted',
        edge: 'border-l-text-subtle',
        dot: 'bg-text-subtle',
    },
};

function styleOf(entry: CalendarEntry) {
    return LAYER_STYLE[entry.overdue ? 'overdue' : entry.layer];
}

/** Toggle buttons for the four layers (multi-select, never all off). */
function LayerFilters({
    data,
    className,
}: {
    data: CalendarData;
    className?: string;
}) {
    return (
        <div
            role="group"
            aria-label="Lapisan kalender"
            className={cn('flex gap-2', className)}
        >
            {ALL_LAYERS.map((layer) => {
                const on = data.layers.includes(layer);

                return (
                    <button
                        key={layer}
                        type="button"
                        aria-pressed={on}
                        onClick={() => data.toggle(layer)}
                        className={cn(
                            'inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[15px] font-semibold transition-colors duration-120 ease-brand md:h-10',
                            on
                                ? 'border-border-strong bg-surface text-text'
                                : 'border-dashed border-border bg-transparent text-text-subtle',
                            focusRing,
                        )}
                    >
                        <span
                            aria-hidden
                            className={cn(
                                'size-2.5 rounded-full',
                                on
                                    ? LAYER_STYLE[layer].dot
                                    : 'bg-border-strong',
                            )}
                        />
                        {LAYER_LABEL[layer]}
                        <span className="text-[13px] font-bold tnum opacity-70">
                            {data.countFor(layer)}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

function DisconnectedCard({ data }: { data: CalendarData }) {
    return (
        <section
            aria-label="Google Calendar"
            className="flex flex-wrap items-center gap-4 rounded-[22px] border border-border bg-warning-soft px-5 py-4"
        >
            <CalendarOff aria-hidden className="size-7 shrink-0 text-warning" />
            <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
                <span className="text-[17px] font-bold text-text">
                    Google Calendar belum terhubung
                </span>
                <span className="text-[15px] text-text-muted">
                    Rapat, tenggat dan cuti hanya tampil di RuangKerja.
                    Hubungkan agar ikut masuk ke kalender Google Anda.
                </span>
            </span>
            <Button onClick={data.connect} disabled={data.processing}>
                {data.processing ? <Spinner /> : <Link2 aria-hidden />}
                Hubungkan Google Calendar
            </Button>
        </section>
    );
}

/** One entry row of the day agenda (side panel / phone list). */
function EntryRow({ entry }: { entry: CalendarEntry }) {
    const style = styleOf(entry);
    const body = (
        <>
            <span
                aria-hidden
                className={cn('w-1 self-stretch rounded-[2px]', style.dot)}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[16px] leading-[22px] font-bold text-text">
                    {entry.title}
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-text-muted">
                    <span
                        className={cn(
                            'inline-flex h-[22px] items-center rounded-[6px] px-2 font-extrabold',
                            style.chip,
                        )}
                    >
                        {entry.overdue ? 'Terlambat' : LAYER_LABEL[entry.layer]}
                    </span>
                    {entry.meta}
                </span>
            </span>
            {entry.href && (
                <ChevronRight
                    aria-hidden
                    className="size-[18px] shrink-0 text-text-subtle"
                    strokeWidth={2.4}
                />
            )}
        </>
    );

    return (
        <li className="border-t border-divider first:border-t-0">
            {entry.href ? (
                <Link
                    href={entry.href}
                    className={cn(
                        'flex min-h-16 items-center gap-3 px-4 py-3 transition-colors duration-120 ease-brand hover:bg-surface-2/60',
                        focusRing,
                        'focus-visible:ring-inset',
                    )}
                >
                    {body}
                </Link>
            ) : (
                <div className="flex min-h-16 items-center gap-3 px-4 py-3">
                    {body}
                </div>
            )}
        </li>
    );
}

function DayAgenda({
    data,
    date,
    className,
}: {
    data: CalendarData;
    date: string;
    className?: string;
}) {
    const entries = data.on(date);

    return entries.length === 0 ? (
        <EmptyState
            size="sm"
            icon={CalendarRange}
            title="Tidak ada jadwal"
            className={cn('bg-surface', className)}
        >
            {date === data.today
                ? 'Hari ini kosong di lapisan yang aktif.'
                : 'Tidak ada jadwal di lapisan yang aktif.'}
        </EmptyState>
    ) : (
        <ul
            className={cn(
                'overflow-hidden rounded-[22px] border border-border bg-surface',
                className,
            )}
        >
            {entries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
            ))}
        </ul>
    );
}

/** Month grid: 7 columns, up to 3 chips per day, "+N lainnya". */
function MonthGrid({ data }: { data: CalendarData }) {
    const current = `${data.month.year}-${String(data.month.month).padStart(2, '0')}`;

    return (
        <div className="overflow-hidden rounded-panel border border-border bg-surface shadow-card">
            <div className="grid grid-cols-7 border-b border-border bg-background">
                {WEEKDAYS.map((day) => (
                    <span
                        key={day}
                        className="px-2.5 py-2.5 text-[14px] font-bold text-text-muted"
                    >
                        {day}
                    </span>
                ))}
            </div>
            <div
                role="grid"
                aria-label={monthTitle(data.month.year, data.month.month)}
                className="flex flex-col"
            >
                {data.weeks.map((week) => (
                    <div
                        role="row"
                        key={week[0]}
                        className="grid grid-cols-7 border-b border-divider last:border-b-0"
                    >
                        {week.map((date) => {
                            const entries = data.on(date);
                            const outside = !date.startsWith(current);
                            const selected = date === data.selected;
                            const weekend = isoWeekday(date) >= 6;

                            return (
                                <div
                                    role="gridcell"
                                    key={date}
                                    aria-selected={selected}
                                    className={cn(
                                        'flex min-h-[118px] min-w-0 flex-col gap-1 border-l border-divider p-1.5 first:border-l-0',
                                        weekend && 'bg-background/60',
                                        selected && 'bg-link-soft/60',
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() => data.select(date)}
                                        aria-label={`${longDate(date)}, ${entries.length} jadwal`}
                                        className={cn(
                                            'flex size-8 items-center justify-center self-start rounded-full text-[15px] font-bold transition-colors duration-120 ease-brand',
                                            date === data.today
                                                ? 'bg-grad-aksi text-on-brand'
                                                : outside
                                                  ? 'text-text-subtle hover:bg-surface-2'
                                                  : 'text-text hover:bg-surface-2',
                                            focusRing,
                                        )}
                                    >
                                        {dayNumber(date)}
                                    </button>
                                    {entries.slice(0, 3).map((entry) => {
                                        const style = styleOf(entry);
                                        const chip = cn(
                                            'truncate rounded-[6px] border-l-[3px] px-1.5 py-0.5 text-[13px] leading-[18px] font-semibold',
                                            style.chip,
                                            style.edge,
                                        );

                                        return entry.href ? (
                                            <Link
                                                key={entry.id}
                                                href={entry.href}
                                                className={cn(
                                                    chip,
                                                    'hover:opacity-85',
                                                    focusRing,
                                                )}
                                                title={entry.title}
                                            >
                                                {entry.title}
                                            </Link>
                                        ) : (
                                            <span
                                                key={entry.id}
                                                className={chip}
                                                title={entry.title}
                                            >
                                                {entry.title}
                                            </span>
                                        );
                                    })}
                                    {entries.length > 3 && (
                                        <button
                                            type="button"
                                            onClick={() => data.select(date)}
                                            className={cn(
                                                'self-start rounded-sm px-1.5 text-[13px] font-bold text-link hover:underline',
                                                focusRing,
                                            )}
                                        >
                                            +{entries.length - 3} lainnya
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}

function WeekView({ data }: { data: CalendarData }) {
    const meetings = data.entries.filter(
        (entry) =>
            entry.layer === 'meetings' &&
            data.layers.includes('meetings') &&
            entry.starts_at &&
            data.week.includes(entry.date),
    );

    return (
        <div className="rounded-panel border border-border bg-surface p-4 shadow-card md:p-5">
            <WeekTimeGrid
                days={data.week}
                today={data.today}
                now={data.now}
                endHour={18}
                items={meetings.map((entry) => ({
                    id: entry.id,
                    title: entry.title,
                    starts_at: entry.starts_at!,
                    ends_at: entry.ends_at ?? null,
                    meta: entry.meta.split(' · ').slice(1).join(' · '),
                    tone: 'bg-link-soft',
                    edge: 'border-l-primary',
                    href: entry.href,
                }))}
                allDay={(date) =>
                    data
                        .on(date)
                        .filter((entry) => entry.layer !== 'meetings')
                        .map((entry) => {
                            const style = styleOf(entry);

                            return (
                                <span
                                    key={entry.id}
                                    title={entry.title}
                                    className={cn(
                                        'truncate rounded-[6px] border-l-[3px] px-1.5 py-0.5 text-[12px] leading-4 font-semibold',
                                        style.chip,
                                        style.edge,
                                    )}
                                >
                                    {entry.title}
                                </span>
                            );
                        })
                }
            />
        </div>
    );
}

/** /kalender on desktop & tablet: month or week grid + day agenda. */
export function CalendarDesktop({
    data,
    isTablet,
}: {
    data: CalendarData;
    isTablet: boolean;
}) {
    const title =
        data.view === 'month'
            ? monthTitle(data.month.year, data.month.month)
            : rangeTitle(data.week);

    return (
        <div className="flex flex-col gap-5">
            <PreviewBar extra={PREVIEWS} />
            <section className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <span className="text-overline text-link">
                        Minggu {isoWeekNumber(data.selected)} · rapat, tenggat,
                        cuti & libur
                    </span>
                    <h1 className="text-display">Kalender</h1>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <SyncChip sync={data.sync} now={data.now} />
                    {data.sync.connected && (
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={data.syncNow}
                            disabled={data.processing}
                        >
                            {data.processing ? (
                                <Spinner />
                            ) : (
                                <RefreshCw aria-hidden />
                            )}
                            Sinkronkan
                        </Button>
                    )}
                    <Button size="lg" asChild>
                        <Link href="/rapat/baru">
                            <Plus aria-hidden />
                            Jadwalkan rapat
                        </Link>
                    </Button>
                </div>
            </section>

            {!data.sync.connected && <DisconnectedCard data={data} />}

            <section className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        aria-label={
                            data.view === 'month'
                                ? 'Bulan sebelumnya'
                                : 'Minggu sebelumnya'
                        }
                        onClick={() => data.shift(-1)}
                    >
                        <ChevronLeft aria-hidden />
                    </Button>
                    <Button variant="outline" onClick={data.goToday}>
                        Hari ini
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        aria-label={
                            data.view === 'month'
                                ? 'Bulan berikutnya'
                                : 'Minggu berikutnya'
                        }
                        onClick={() => data.shift(1)}
                    >
                        <ChevronRight aria-hidden />
                    </Button>
                    <h2 aria-live="polite" className="ml-2 text-h3">
                        {title}
                    </h2>
                </div>
                <SegmentedTabs<CalendarView>
                    label="Tampilan kalender"
                    value={data.view}
                    onValueChange={data.setView}
                    options={[
                        { value: 'month', label: 'Bulan' },
                        { value: 'week', label: 'Minggu' },
                    ]}
                />
            </section>
            <LayerFilters data={data} className="flex-wrap" />

            {data.state === 'memuat' ? (
                <ListSkeleton rows={5} className="[&>div]:h-28" />
            ) : data.state === 'galat' ? (
                <ErrorState
                    title="Kalender gagal dimuat"
                    description="Google Calendar tidak menjawab. Jadwal di RuangKerja tetap aman; coba lagi sebentar."
                />
            ) : (
                <section className="flex flex-wrap items-start gap-5">
                    <div className="min-w-0 flex-[3_1_640px]">
                        {data.view === 'month' ? (
                            <MonthGrid data={data} />
                        ) : (
                            <WeekView data={data} />
                        )}
                    </div>
                    <Panel
                        title={
                            data.selected === data.today
                                ? 'Hari ini'
                                : longDate(data.selected)
                        }
                        className={cn(
                            'min-w-0',
                            isTablet ? 'flex-[1_1_100%]' : 'flex-[1_1_300px]',
                        )}
                        flush
                    >
                        {data.entries.length === 0 ? (
                            <div className="px-6">
                                <EmptyState
                                    size="sm"
                                    icon={CalendarRange}
                                    title="Kalender masih kosong"
                                >
                                    Rapat, tenggat tugas, cuti yang disetujui
                                    dan hari libur akan tampil di sini.
                                </EmptyState>
                            </div>
                        ) : (
                            <div className="px-4 md:px-5">
                                <DayAgenda
                                    data={data}
                                    date={data.selected}
                                    className="border-0"
                                />
                            </div>
                        )}
                    </Panel>
                </section>
            )}
        </div>
    );
}

/** /kalender on phones: week strip + agenda of the selected day. */
export function CalendarMobile({ data }: { data: CalendarData }) {
    return (
        <div className="flex flex-col gap-3.5">
            <PreviewBar extra={PREVIEWS} />
            {data.sync.connected ? (
                <div className="flex items-center justify-between gap-2">
                    <SyncChip
                        sync={data.sync}
                        now={data.now}
                        className="h-auto min-h-11 flex-1 justify-start py-2 whitespace-normal"
                    />
                    <Button
                        variant="outline"
                        size="icon"
                        aria-label="Sinkronkan sekarang"
                        onClick={data.syncNow}
                        disabled={data.processing}
                    >
                        {data.processing ? (
                            <Spinner />
                        ) : (
                            <RefreshCw aria-hidden />
                        )}
                    </Button>
                </div>
            ) : (
                <DisconnectedCard data={data} />
            )}
            <LayerFilters
                data={data}
                className="-mx-4 [scrollbar-width:none] overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden"
            />
            <div className="flex items-center justify-between gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    aria-label="Minggu sebelumnya"
                    onClick={() => data.shift(-1, 'week')}
                >
                    <ChevronLeft aria-hidden />
                </Button>
                <button
                    type="button"
                    onClick={data.goToday}
                    className={cn(
                        'min-h-11 rounded-control px-2 text-[17px] font-bold',
                        focusRing,
                    )}
                >
                    {rangeTitle(data.week)}
                </button>
                <Button
                    variant="outline"
                    size="icon"
                    aria-label="Minggu berikutnya"
                    onClick={() => data.shift(1, 'week')}
                >
                    <ChevronRight aria-hidden />
                </Button>
            </div>
            <DayTabs
                dates={data.week}
                value={data.selected}
                onChange={data.select}
                today={data.today}
                size="sm"
            />
            <h2 className="pt-1 text-[19px] font-extrabold">
                {data.selected === data.today
                    ? `Hari ini · ${longDate(data.selected)}`
                    : longDate(data.selected)}
            </h2>
            {data.state === 'memuat' ? (
                <ListSkeleton rows={4} />
            ) : data.state === 'galat' ? (
                <ErrorState
                    title="Kalender gagal dimuat"
                    description="Periksa koneksi lalu coba lagi."
                />
            ) : data.entries.length === 0 ? (
                <EmptyState
                    icon={CalendarRange}
                    title="Kalender masih kosong"
                    description="Rapat, tenggat, cuti dan libur akan tampil di sini."
                />
            ) : (
                <DayAgenda data={data} date={data.selected} />
            )}
        </div>
    );
}
