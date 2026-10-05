import { Link } from '@inertiajs/react';
import { Clock, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TONE_CLASSES } from '@/lib/attendance';
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
import type { CorrectionTarget } from '../review/correction-dialog';
import type { LiveMode } from './use-live-board';

export function LivePill({ mode }: { mode: LiveMode }) {
    const live = mode === 'realtime';

    return (
        <span
            className={cn(
                'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium',
                live
                    ? 'bg-success-soft text-success'
                    : 'bg-surface-2 text-text-muted',
            )}
            title={
                live
                    ? 'Diperbarui otomatis saat ada check-in'
                    : 'Diperbarui tiap 60 detik'
            }
        >
            <span
                aria-hidden
                className={cn(
                    'size-1.5 rounded-full',
                    live ? 'animate-pulse bg-success' : 'bg-text-subtle',
                )}
            />
            {live ? 'Langsung' : 'Tiap 60 detik'}
        </span>
    );
}

/** The four numbers of the board (Terjadwal, Hadir, Cuti/izin/sakit, Belum). */
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

    const cards = [
        {
            label: 'Terjadwal',
            value: <span className="text-text">{summary.scheduled}</span>,
            hint: shifts || 'Tidak ada jadwal',
        },
        {
            label: 'Hadir',
            value: (
                <>
                    <span className="text-success">{summary.present}</span>
                    <span className="text-base font-normal text-text-muted">
                        {' '}
                        / {summary.scheduled}
                    </span>
                </>
            ),
            hint: (
                <>
                    termasuk{' '}
                    <span className="text-warning">
                        {summary.late} terlambat
                    </span>
                </>
            ),
        },
        {
            label: 'Cuti/izin/sakit',
            value: <span className="text-info">{summary.onLeave}</span>,
            hint: leaves || 'Tidak ada',
        },
        {
            label: 'Belum check-in',
            value: <span className="text-text">{summary.notCheckedIn}</span>,
            hint: 'pengingat otomatis 15 menit setelah jam masuk',
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {cards.map((card) => (
                <div
                    key={card.label}
                    className={cn(
                        'rounded-xl border border-border bg-surface shadow-card',
                        compact ? 'p-3.5' : 'p-4',
                    )}
                >
                    <p className="text-[13px] text-text-muted">{card.label}</p>
                    <p
                        className={cn(
                            'mt-1 font-semibold tnum',
                            compact ? 'text-[26px]' : 'text-[28px]',
                        )}
                    >
                        {card.value}
                    </p>
                    <p className="mt-1 truncate text-[13px] text-text-muted">
                        {card.hint}
                    </p>
                </div>
            ))}
        </div>
    );
}

const SEGMENTS: {
    key: keyof BoardDivision;
    label: string;
    className: string;
}[] = [
    { key: 'onTime', label: 'Hadir tepat waktu', className: 'bg-success' },
    { key: 'late', label: 'Terlambat', className: 'bg-warning' },
    { key: 'onLeave', label: 'Cuti/izin/sakit', className: 'bg-info' },
    {
        key: 'notCheckedIn',
        label: 'Belum check-in',
        className: 'bg-border-strong',
    },
];

export function DistributionBar({ division }: { division: BoardDivision }) {
    const total = SEGMENTS.reduce(
        (sum, segment) => sum + Number(division[segment.key] ?? 0),
        0,
    );

    return (
        <div
            className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
            role="img"
            aria-label={SEGMENTS.map(
                (segment) =>
                    `${segment.label} ${String(division[segment.key])}`,
            ).join(', ')}
        >
            {total > 0 &&
                SEGMENTS.map((segment) => {
                    const value = Number(division[segment.key] ?? 0);

                    return value > 0 ? (
                        <span
                            key={segment.key}
                            className={segment.className}
                            style={{ width: `${(value / total) * 100}%` }}
                        />
                    ) : null;
                })}
        </div>
    );
}

export function SegmentLegend({ className }: { className?: string }) {
    return (
        <ul
            className={cn(
                'flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted',
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
                            'size-2 rounded-[2px]',
                            segment.className,
                        )}
                    />
                    {segment.label}
                </li>
            ))}
        </ul>
    );
}

export function divisionTotals(divisions: BoardDivision[]): BoardDivision {
    return divisions.reduce<BoardDivision>(
        (total, division) => ({
            ...total,
            scheduled: total.scheduled + division.scheduled,
            onTime: total.onTime + division.onTime,
            late: total.late + division.late,
            onLeave: total.onLeave + division.onLeave,
            notCheckedIn: total.notCheckedIn + division.notCheckedIn,
        }),
        {
            id: null,
            name: 'Total',
            scheduled: 0,
            onTime: 0,
            late: 0,
            onLeave: 0,
            notCheckedIn: 0,
        },
    );
}

type StateFilter = BoardPersonState | 'all';

/** Per-person list with filters (division, state, name). */
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
    const [division, setDivision] = useState<string>('all');
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();

        return people.filter(
            (person) =>
                (state === 'all' || person.state === state) &&
                (division === 'all' || person.divisionId === division) &&
                (needle === '' || person.name.toLowerCase().includes(needle)),
        );
    }, [division, people, query, state]);

    const chips: { value: StateFilter; label: string; count: number }[] = [
        { value: 'all', label: 'Semua', count: people.length },
        ...(['on_time', 'late', 'not_checked_in', 'leave'] as const).map(
            (value) => ({
                value,
                label: BOARD_STATES[value].label,
                count: people.filter((person) => person.state === value).length,
            }),
        ),
    ];

    return (
        <section
            id="per-orang"
            aria-labelledby="people-title"
            className="scroll-mt-20 rounded-xl border border-border bg-surface shadow-card"
        >
            <div className="space-y-3 border-b border-border px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2
                        id="people-title"
                        className="text-[15px] font-semibold text-text"
                    >
                        Daftar per orang
                    </h2>
                    <div className="flex flex-wrap items-center gap-2">
                        {variant === 'desktop' && divisions.length > 1 && (
                            <select
                                aria-label="Divisi"
                                value={division}
                                onChange={(event) =>
                                    setDivision(event.target.value)
                                }
                                className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-text"
                            >
                                <option value="all">Semua divisi</option>
                                {divisions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.name}
                                    </option>
                                ))}
                            </select>
                        )}
                        <div className="relative">
                            <Search
                                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-subtle"
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
                                    'h-9 pl-8',
                                    variant === 'mobile'
                                        ? 'w-40 text-base'
                                        : 'w-52',
                                )}
                            />
                        </div>
                    </div>
                </div>
                <div
                    role="radiogroup"
                    aria-label="Status"
                    className="flex [scrollbar-width:none] gap-1.5 overflow-x-auto"
                >
                    {chips.map((chip) => (
                        <button
                            key={chip.value}
                            type="button"
                            role="radio"
                            aria-checked={state === chip.value}
                            onClick={() => setState(chip.value)}
                            className={cn(
                                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                variant === 'mobile' ? 'h-9' : 'h-7',
                                state === chip.value
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border bg-surface text-text-muted hover:text-text',
                            )}
                        >
                            {chip.label}
                            <span className="text-xs tnum opacity-80">
                                {chip.count}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
            {filtered.length === 0 ? (
                <EmptyState
                    icon={Search}
                    title="Tidak ada yang cocok"
                    description="Ubah filter atau kata kunci."
                    className="m-4 border-none py-8"
                />
            ) : (
                <ul className="divide-y divide-border">
                    {filtered.map((person) => {
                        const meta = BOARD_STATES[person.state];
                        const tone = TONE_CLASSES[meta.tone];

                        return (
                            <li
                                key={person.id}
                                className="flex min-h-14 items-center gap-3 px-4 py-2.5"
                            >
                                <span
                                    aria-hidden
                                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-on-brand"
                                >
                                    {person.initials}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[15px] text-text">
                                        {person.name}
                                    </p>
                                    <p className="truncate text-[13px] text-text-muted">
                                        {person.divisionName} ·{' '}
                                        {person.shiftName}
                                        {person.locationName
                                            ? ` · ${person.locationName}`
                                            : ''}
                                    </p>
                                </div>
                                {person.checkInAt && (
                                    <span className="font-mono text-sm text-text tnum">
                                        {formatTime(person.checkInAt)}
                                        {person.checkOutAt
                                            ? `–${formatTime(person.checkOutAt)}`
                                            : ''}
                                    </span>
                                )}
                                <span
                                    className={cn(
                                        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap',
                                        tone.soft,
                                    )}
                                >
                                    <span
                                        aria-hidden
                                        className={cn(
                                            'size-1.5 rounded-full',
                                            tone.solid,
                                        )}
                                    />
                                    {person.state === 'late'
                                        ? `Terlambat ${person.lateMinutes}m`
                                        : person.state === 'leave'
                                          ? (person.statusLabel ?? meta.label)
                                          : meta.label}
                                </span>
                                {canCorrect && variant === 'desktop' && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8"
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
        <section
            aria-labelledby="missing-title"
            className={cn(
                'rounded-xl border border-border bg-surface shadow-card',
                className,
            )}
        >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <h2
                    id="missing-title"
                    className="flex items-center gap-2 text-[15px] font-semibold text-text"
                >
                    Lupa check-out kemarin
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-surface-2 px-2 text-xs font-semibold text-text-muted tnum">
                        {items.length}
                    </span>
                </h2>
                {items[0] && (
                    <span className="text-[13px] text-text-muted">
                        {formatDate(items[0].workDate)}
                    </span>
                )}
            </div>
            {items.length === 0 ? (
                <p className="flex items-center gap-2 px-4 py-6 text-sm text-text-muted">
                    <Clock className="size-4" aria-hidden />
                    Semua yang masuk kemarin sudah check-out.
                </p>
            ) : (
                <ul className="divide-y divide-border">
                    {items.map((item) => (
                        <li
                            key={item.dayId}
                            className="flex min-h-14 items-center gap-3 px-4 py-2.5"
                        >
                            <span
                                aria-hidden
                                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-on-brand"
                            >
                                {item.initials}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[15px] text-text">
                                    {item.name}
                                </p>
                                <p className="truncate text-[13px] text-text-muted">
                                    {[item.shiftName, item.locationName]
                                        .filter(Boolean)
                                        .join(' · ')}{' '}
                                    · masuk{' '}
                                    <span className="font-mono">
                                        {formatTime(item.checkInAt)}
                                    </span>{' '}
                                    · keluar –
                                </p>
                            </div>
                            {canCorrect && item.userId !== selfId && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-9"
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
        </section>
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
