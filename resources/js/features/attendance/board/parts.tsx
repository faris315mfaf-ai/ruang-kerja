import { Link } from '@inertiajs/react';
import { Clock, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KpiBar, KpiCard } from '@/components/ui/kpi-card';
import { Panel } from '@/components/ui/panel';
import { formatDate, formatTime } from '@/lib/format';
import { BOARD_STATES } from '@/lib/recap';
import { cn } from '@/lib/utils';
import type {
    BoardDivision,
    BoardPerson,
    BoardPersonState,
    MissingCheckOut,
    TodayBoardData,
} from '@/types/attendance';
import { FilterSelect } from '../filter-select';
import type { CorrectionTarget } from '../review/correction-dialog';
import type { LiveMode } from './use-live-board';

/** "Langsung" / "Tiap 60 detik" status pill next to the title. */
export function LivePill({ mode }: { mode: LiveMode }) {
    const live = mode === 'realtime';

    return (
        <Badge
            variant="status"
            tone={live ? 'success' : 'neutral'}
            dot
            className="h-[30px] gap-1.5 px-3"
            title={
                live
                    ? 'Diperbarui otomatis saat ada check-in'
                    : 'Diperbarui tiap 60 detik'
            }
        >
            {live ? 'Langsung' : 'Tiap 60 detik'}
        </Badge>
    );
}

function percent(part: number, total: number): number {
    return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * Summary row (DHR "Ringkasan"): highlighted "Hadir sekarang" with a bar,
 * then Terjadwal, Cuti/izin/sakit and Belum check-in.
 */
export function StatCards({
    summary,
    compact = false,
}: {
    summary: TodayBoardData['summary'];
    compact?: boolean;
}) {
    const shifts = summary.shifts
        .map((shift) => `${shift.count} ${shift.name.toLowerCase()}`)
        .join(' · ');
    const leaves = summary.leaveBreakdown
        .map((item) => `${item.count} ${item.label.toLowerCase()}`)
        .join(' · ');
    const share = percent(summary.present, summary.scheduled);
    const tile = compact ? 'gap-0.5 px-3.5 py-3.5' : undefined;

    return (
        <section
            aria-label="Ringkasan"
            className={cn(
                'grid gap-3',
                compact ? 'grid-cols-3' : 'grid-cols-2 gap-5 xl:grid-cols-4',
            )}
        >
            <KpiCard
                tone="highlight"
                label="Hadir sekarang"
                value={summary.present}
                suffix={`/ ${summary.scheduled}`}
                note={`${share}% · termasuk ${summary.late} terlambat`}
                className={cn(compact && 'col-span-3')}
                bar={<KpiBar value={share} label="Hadir dari yang terjadwal" />}
            />
            <KpiCard
                label="Terjadwal"
                value={summary.scheduled}
                note={compact ? null : shifts || 'Tidak ada jadwal'}
                className={tile}
            />
            <KpiCard
                label={compact ? 'Cuti/izin' : 'Cuti/izin/sakit'}
                value={summary.onLeave}
                valueClassName="text-info"
                note={compact ? null : leaves || 'Tidak ada'}
                className={tile}
            />
            <KpiCard
                label={compact ? 'Belum' : 'Belum check-in'}
                value={summary.notCheckedIn}
                valueClassName={summary.notCheckedIn > 0 ? 'text-warning' : ''}
                note={
                    compact
                        ? null
                        : 'Pengingat otomatis 15 menit setelah jam masuk'
                }
                className={tile}
            />
        </section>
    );
}

const SEGMENTS: {
    key: 'onTime' | 'late' | 'onLeave' | 'notCheckedIn';
    label: string;
    className: string;
}[] = [
    { key: 'onTime', label: 'Hadir', className: 'bg-success' },
    { key: 'late', label: 'Terlambat', className: 'bg-fill-warning' },
    { key: 'onLeave', label: 'Cuti/izin', className: 'bg-accent-blue-strong' },
    { key: 'notCheckedIn', label: 'Belum', className: 'bg-border-strong' },
];

/** Stacked 16px bar of one division (DHR "Kehadiran per divisi"). */
export function DistributionBar({
    division,
    size = 'md',
}: {
    division: BoardDivision;
    size?: 'sm' | 'md';
}) {
    const total = SEGMENTS.reduce(
        (sum, segment) => sum + division[segment.key],
        0,
    );

    return (
        <div
            className={cn(
                'flex w-full gap-0.5 overflow-hidden rounded-full bg-surface-2',
                size === 'md' ? 'h-4' : 'h-2.5',
            )}
            role="img"
            aria-label={SEGMENTS.map(
                (segment) => `${segment.label} ${division[segment.key]}`,
            ).join(', ')}
        >
            {total > 0 &&
                SEGMENTS.map((segment) =>
                    division[segment.key] > 0 ? (
                        <span
                            key={segment.key}
                            className={segment.className}
                            style={{ flex: division[segment.key] }}
                        />
                    ) : null,
                )}
        </div>
    );
}

export function SegmentLegend({ className }: { className?: string }) {
    return (
        <ul
            className={cn(
                'flex flex-wrap gap-x-3.5 gap-y-1 text-[14px] text-text-muted',
                className,
            )}
        >
            {SEGMENTS.map((segment) => (
                <li
                    key={segment.key}
                    className="inline-flex items-center gap-1.5"
                >
                    <span
                        aria-hidden
                        className={cn(
                            'size-2.5 rounded-full',
                            segment.className,
                        )}
                    />
                    {segment.label}
                </li>
            ))}
        </ul>
    );
}

/** "2 terlambat · 1 cuti/izin · 3 belum" under a division bar. */
function divisionMeta(division: BoardDivision): string {
    return (
        [
            division.late > 0 ? `${division.late} terlambat` : null,
            division.onLeave > 0 ? `${division.onLeave} cuti/izin/sakit` : null,
            division.notCheckedIn > 0
                ? `${division.notCheckedIn} belum check-in`
                : null,
        ]
            .filter(Boolean)
            .join(' · ') || 'Semua hadir tepat waktu'
    );
}

/** "Kehadiran per divisi": one stacked bar per division (DHR / PHRLive). */
export function DivisionBars({
    divisions,
    compact = false,
}: {
    divisions: BoardDivision[];
    compact?: boolean;
}) {
    return (
        <Panel
            title="Kehadiran per divisi"
            action={!compact && <SegmentLegend />}
            bodyClassName="gap-[18px] pt-2"
        >
            {compact && <SegmentLegend className="-mt-1" />}
            {divisions.length === 0 ? (
                <p className="text-[16px] text-text-muted">
                    Tidak ada karyawan terjadwal hari ini.
                </p>
            ) : (
                <ul className="flex flex-col gap-[18px]">
                    {divisions.map((division) => (
                        <li
                            key={division.id ?? division.name}
                            className={cn(
                                'grid items-center gap-x-4 gap-y-1.5',
                                compact
                                    ? 'grid-cols-[1fr_auto]'
                                    : 'grid-cols-[150px_1fr_70px]',
                            )}
                        >
                            <span className="truncate text-[16px] font-semibold text-text">
                                {division.name}
                            </span>
                            <span
                                className={cn(
                                    'min-w-0',
                                    compact && 'order-last col-span-2',
                                )}
                            >
                                <DistributionBar division={division} />
                                <span className="mt-1 block truncate text-meta text-text-muted">
                                    {divisionMeta(division)}
                                </span>
                            </span>
                            <span className="self-start text-right text-[16px] font-bold text-text tnum">
                                {division.onTime + division.late}/
                                {division.scheduled}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

type StateFilter = BoardPersonState | 'all';

function stateLabel(person: BoardPerson): string {
    const meta = BOARD_STATES[person.state];

    if (person.state === 'late') {
        return `Terlambat ${person.lateMinutes}m`;
    }

    return person.state === 'leave'
        ? (person.statusLabel ?? meta.label)
        : meta.label;
}

/** Per-person list with filters (division, state, name) — PHRLive / DHR. */
export function PeopleList({
    people,
    divisions,
    variant,
    canCorrect,
    today,
    selfId,
    onCorrect,
}: {
    selfId?: string | null;
    people: BoardPerson[];
    divisions: { id: string; name: string }[];
    variant: 'desktop' | 'mobile';
    canCorrect: boolean;
    today: string;
    onCorrect: (target: CorrectionTarget) => void;
}) {
    const [state, setState] = useState<StateFilter>('all');
    const [division, setDivision] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const mobile = variant === 'mobile';

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();

        return people.filter(
            (person) =>
                (state === 'all' || person.state === state) &&
                (division === null || person.divisionId === division) &&
                (needle === '' || person.name.toLowerCase().includes(needle)),
        );
    }, [division, people, query, state]);

    const chips = [
        { value: 'all' as StateFilter, label: 'Semua', count: people.length },
        ...(['on_time', 'late', 'not_checked_in', 'leave'] as const).map(
            (value) => ({
                value: value as StateFilter,
                label: BOARD_STATES[value].label,
                count: people.filter((person) => person.state === value).length,
            }),
        ),
    ];

    return (
        <section
            id="per-orang"
            aria-labelledby="people-title"
            className="flex min-w-0 scroll-mt-20 flex-col rounded-panel border border-border bg-surface pt-6 pb-2 shadow-card"
        >
            <div className="flex flex-col gap-3 px-5 pb-3 md:px-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2
                        id="people-title"
                        className="text-[20px] leading-7 font-bold md:text-[22px]"
                    >
                        Daftar per orang
                    </h2>
                    <div className="flex flex-wrap items-center gap-2">
                        {!mobile && divisions.length > 1 && (
                            <FilterSelect
                                label="Divisi"
                                allLabel="Semua divisi"
                                value={division}
                                onChange={setDivision}
                                options={divisions}
                                size="sm"
                            />
                        )}
                        <div className="relative">
                            <Search
                                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle"
                                aria-hidden
                            />
                            <Input
                                type="search"
                                aria-label="Cari nama"
                                placeholder="Cari nama"
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                                className={cn(
                                    'pl-9',
                                    mobile ? 'w-40' : 'h-9 w-56',
                                )}
                            />
                        </div>
                    </div>
                </div>
                <ChipScroller
                    label="Status"
                    chips={chips}
                    value={state}
                    onChange={setState}
                    className={cn(!mobile && 'mx-0 scroll-px-0 px-0')}
                />
            </div>
            {filtered.length === 0 ? (
                <div className="px-5 pb-4 md:px-7">
                    <EmptyState
                        size="sm"
                        icon={Search}
                        title="Tidak ada yang cocok"
                        description="Ubah filter atau kata kunci."
                    />
                </div>
            ) : (
                <ul className="divide-y divide-divider border-t border-divider">
                    {filtered.map((person) => {
                        const tone = BOARD_STATES[person.state].tone;

                        return (
                            <li
                                key={person.id}
                                className="flex min-h-16 items-center gap-3 px-4 py-2 md:gap-3.5 md:px-7"
                            >
                                <UserAvatar
                                    name={person.name}
                                    className="size-10 text-[14px]"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[16px] leading-6 font-semibold text-text">
                                        {person.name}
                                    </p>
                                    <p className="truncate text-meta text-text-muted">
                                        {person.divisionName} ·{' '}
                                        {person.shiftName}
                                        {person.locationName
                                            ? ` · ${person.locationName}`
                                            : ''}
                                        {mobile && person.checkInAt
                                            ? ` · ${formatTime(person.checkInAt)}`
                                            : ''}
                                    </p>
                                </div>
                                {!mobile && person.checkInAt && (
                                    <span className="text-[16px] font-semibold text-text tnum">
                                        {formatTime(person.checkInAt)}
                                        {person.checkOutAt
                                            ? `–${formatTime(person.checkOutAt)}`
                                            : ''}
                                    </span>
                                )}
                                <Badge
                                    variant="status"
                                    tone={tone}
                                    dot={!mobile}
                                    className={cn(
                                        mobile
                                            ? 'h-[26px] px-2.5 text-[13px] font-extrabold'
                                            : 'h-[30px] gap-1.5 px-3',
                                    )}
                                >
                                    {stateLabel(person)}
                                </Badge>
                                {canCorrect && !mobile && (
                                    <Button
                                        type="button"
                                        variant="quiet"
                                        size="sm"
                                        disabled={
                                            person.state === 'leave' ||
                                            person.id === selfId
                                        }
                                        onClick={() =>
                                            onCorrect({
                                                userId: person.id,
                                                name: person.name,
                                                workDate: today,
                                                checkIn: person.checkInAt
                                                    ? formatTime(
                                                          person.checkInAt,
                                                      ).replace('.', ':')
                                                    : null,
                                                checkOut: person.checkOutAt
                                                    ? formatTime(
                                                          person.checkOutAt,
                                                      ).replace('.', ':')
                                                    : null,
                                            })
                                        }
                                    >
                                        Koreksi
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}

/** "Lupa check-out kemarin". */
export function MissingCheckOutPanel({
    items,
    canCorrect,
    onCorrect,
    selfId,
    className,
}: {
    selfId?: string | null;
    items: MissingCheckOut[];
    canCorrect: boolean;
    onCorrect: (target: CorrectionTarget) => void;
    className?: string;
}) {
    return (
        <Panel
            title={
                <>
                    Lupa check-out kemarin
                    <Badge variant="secondary" className="h-7 tnum">
                        {items.length}
                    </Badge>
                </>
            }
            action={
                items[0] && (
                    <span className="text-meta text-text-muted">
                        {formatDate(items[0].workDate)}
                    </span>
                )
            }
            flush
            className={cn('pb-2', className)}
        >
            {items.length === 0 ? (
                <p className="flex items-center gap-2 px-6 pb-3 text-[16px] text-text-muted md:px-7">
                    <Clock className="size-5 shrink-0" aria-hidden />
                    Semua yang masuk kemarin sudah check-out.
                </p>
            ) : (
                <ul className="divide-y divide-divider border-t border-divider">
                    {items.map((item) => (
                        <li
                            key={item.dayId}
                            className="flex min-h-16 items-center gap-3.5 px-5 py-2 md:px-7"
                        >
                            <UserAvatar
                                name={item.name}
                                className="size-10 text-[14px]"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[16px] leading-6 font-semibold text-text">
                                    {item.name}
                                </p>
                                <p className="truncate text-meta text-text-muted">
                                    {[item.shiftName, item.locationName]
                                        .filter(Boolean)
                                        .join(' · ')}{' '}
                                    · masuk {formatTime(item.checkInAt)} ·
                                    keluar –
                                </p>
                            </div>
                            {canCorrect && item.userId !== selfId && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        onCorrect({
                                            userId: item.userId,
                                            name: item.name,
                                            workDate: item.workDate,
                                        })
                                    }
                                >
                                    Koreksi
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

export function RecapLink({ className }: { className?: string }) {
    return (
        <Button asChild variant="outline" className={className}>
            <Link href="/absensi/rekap" prefetch>
                Rekap &amp; ekspor
            </Link>
        </Button>
    );
}
