import type { ReactNode } from 'react';
import { Link } from '@inertiajs/react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import {
    ACTION_KINDS,
    ASSIGNMENT_STATUSES,
    EVENT_KINDS,
    assigneeText,
    assignmentStatusText,
    dueLabel,
    waitingLabel,
} from './lib';
import type { ActionItem, AssignmentRow, HrEvent } from './types';

/** Teal text button with a 44px hit area (mockup `.btn-q`). */
export function QuietLink({
    href,
    children,
    label,
}: {
    href: string;
    children: ReactNode;
    label?: string;
}) {
    return (
        <Link
            href={href}
            prefetch
            aria-label={label}
            className={cn(
                'inline-flex min-h-control shrink-0 items-center rounded-control px-2 text-[15px] font-semibold text-link transition-opacity duration-120 ease-brand hover:opacity-80',
                focusRing,
            )}
        >
            {children}
        </Link>
    );
}

/** "Perlu tindakan" row: kind pill, title, meta, action. */
export function ActionRow({
    item,
    now,
    compact = false,
}: {
    item: ActionItem;
    now: Date;
    compact?: boolean;
}) {
    const kind = ACTION_KINDS[item.kind];
    const meta = [item.subtitle, waitingLabel(item.waiting_since, now)]
        .filter(Boolean)
        .join(' · ');

    return (
        <li className="flex min-h-15 items-center gap-3 border-t border-divider py-2 first:border-t-0">
            <Badge
                variant="status"
                tone={kind.tone}
                className={cn(
                    'justify-center',
                    compact
                        ? 'h-[26px] px-2.5 text-[13px]'
                        : 'w-24 text-[14px]',
                )}
            >
                {kind.label}
            </Badge>
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="line-clamp-2 text-[16px] leading-6 font-semibold">
                    {item.title}
                </span>
                {meta && (
                    <span className="truncate text-meta text-text-muted">
                        {meta}
                    </span>
                )}
            </span>
            <QuietLink href={item.href} label={`${kind.cta}: ${item.title}`}>
                {kind.cta}
            </QuietLink>
        </li>
    );
}

/** Agenda row: time (or "Sehari"), colour bar per kind, title, link. */
export function AgendaRow({
    event,
    showDate,
}: {
    event: HrEvent;
    /** Prefix (e.g. "Sel 20") for week lists. */
    showDate?: string;
}) {
    const kind = EVENT_KINDS[event.kind];

    return (
        <li className="flex min-h-15 items-center gap-3 border-t border-divider py-2 first:border-t-0">
            <span className="flex w-14 shrink-0 flex-col font-mono text-[14px] font-semibold tnum">
                {showDate && (
                    <span className="text-[13px] text-text-muted">
                        {showDate}
                    </span>
                )}
                <span className={cn(event.time === null && 'text-text-muted')}>
                    {event.time ?? 'Sehari'}
                </span>
            </span>
            <span
                aria-hidden
                className={cn('h-9 w-1 shrink-0 rounded-full', kind.bar)}
            />
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="line-clamp-2 text-[16px] leading-6 font-semibold">
                    <span className="sr-only">{kind.label}: </span>
                    {event.title}
                </span>
                {event.subtitle && (
                    <span className="truncate text-meta text-text-muted">
                        {event.subtitle}
                    </span>
                )}
            </span>
            {event.href && (
                <QuietLink href={event.href} label={`Buka ${event.title}`}>
                    Buka
                </QuietLink>
            )}
        </li>
    );
}

export function AssignmentStatusBadge({
    row,
    className,
}: {
    row: AssignmentRow;
    className?: string;
}) {
    return (
        <Badge
            variant="status"
            tone={ASSIGNMENT_STATUSES[row.status].tone}
            dot
            className={cn('h-7 px-2.5 text-[13px]', className)}
        >
            {assignmentStatusText(row)}
        </Badge>
    );
}

/** Overlapping avatars of a task (max 4 + "+n"). */
export function AvatarStack({ row }: { row: AssignmentRow }) {
    const shown = row.assignees.slice(0, row.assignee_count > 4 ? 3 : 4);
    const rest = row.assignee_count - shown.length;

    return (
        <span className="flex shrink-0 items-center -space-x-2">
            {shown.map((person) => (
                <UserAvatar
                    key={person.id}
                    name={person.name}
                    src={person.avatar}
                    className="size-8 text-[12px] ring-2 ring-surface"
                />
            ))}
            {rest > 0 && (
                <span className="flex size-8 items-center justify-center rounded-full bg-surface-2 text-[12px] font-bold text-text-muted tnum ring-2 ring-surface">
                    +{rest}
                </span>
            )}
        </span>
    );
}

/** "Bayu Saputra · tenggat Kam, 22 Okt". */
export function assignmentMeta(row: AssignmentRow): string {
    return [
        assigneeText(row),
        row.due_date ? `tenggat ${dueLabel(row.due_date)}` : 'tanpa tenggat',
    ].join(' · ');
}

/**
 * Stacked 8px bar: on time (teal) + late (amber) out of `total`; the rest
 * is the track. Label for screen readers.
 */
export function SplitBar({
    parts,
    total,
    label,
    className,
}: {
    parts: { value: number; className: string }[];
    total: number;
    label: string;
    className?: string;
}) {
    return (
        <div
            role="img"
            aria-label={label}
            className={cn(
                'flex h-2 overflow-hidden rounded-full bg-surface-2',
                className,
            )}
        >
            {parts.map((part, index) => (
                <span
                    key={index}
                    className={cn('h-full', part.className)}
                    style={{
                        width: `${total > 0 ? Math.min(100, (part.value / total) * 100) : 0}%`,
                    }}
                />
            ))}
        </div>
    );
}

/** Attendance per division: name, "present / scheduled", split bar. */
export function DivisionAttendance({
    divisions,
}: {
    divisions: {
        id: string | null;
        name: string;
        present: number;
        late: number;
        scheduled: number;
    }[];
}) {
    return (
        <div className="flex flex-col gap-3.5">
            <ul className="flex flex-col gap-3.5">
                {divisions.map((division) => {
                    const onTime = Math.max(
                        0,
                        division.present - division.late,
                    );

                    return (
                        <li key={division.id ?? 'none'}>
                            <div className="flex items-baseline justify-between gap-3 text-[15px]">
                                <span className="truncate font-semibold">
                                    {division.name}
                                </span>
                                <span className="shrink-0 font-mono text-[14px] tnum">
                                    {formatNumber(division.present)} /{' '}
                                    {formatNumber(division.scheduled)}
                                </span>
                            </div>
                            <SplitBar
                                className="mt-1.5"
                                total={division.scheduled}
                                label={`${division.name}: ${onTime} tepat waktu, ${division.late} terlambat dari ${division.scheduled} terjadwal`}
                                parts={[
                                    {
                                        value: onTime,
                                        className: 'bg-fill-teal',
                                    },
                                    {
                                        value: division.late,
                                        className: 'bg-fill-warning',
                                    },
                                ]}
                            />
                        </li>
                    );
                })}
            </ul>
            <div className="flex flex-wrap gap-4 text-meta text-text-muted">
                <Legend className="bg-fill-teal">Tepat waktu</Legend>
                <Legend className="bg-fill-warning">Terlambat</Legend>
                <Legend className="border border-border bg-surface-2">
                    Belum hadir
                </Legend>
            </div>
        </div>
    );
}

export function Legend({
    className,
    children,
}: {
    className: string;
    children: ReactNode;
}) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span
                aria-hidden
                className={cn('size-2.5 rounded-[3px]', className)}
            />
            {children}
        </span>
    );
}
