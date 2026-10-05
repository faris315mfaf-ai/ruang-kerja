import { router } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { SwipeableRow } from '@/components/mobile/swipeable-row';
import { StatusIcon } from '@/components/status-icon';
import { Badge } from '@/components/ui/badge';
import { WorkspaceAvatar } from '@/features/workspaces/workspace-avatar';
import { cn, focusRing } from '@/lib/utils';
import { move, update } from '@/routes/tasks';
import { DueBadge } from '../due-badge';
import { LabelPill } from '../label-pill';
import { dueState } from '../lib/due-date';
import { StatusPill } from '../status-pill';
import { CompletionText } from '../task-card';
import type { MyTaskRow } from '../types';
import type { RowGroup } from './grouping';
import { postponedDue } from './grouping';

const HEAD_TONES: Record<string, { head: string; dot: string }> = {
    overdue: { head: 'bg-danger-soft text-danger', dot: 'bg-danger' },
    today: { head: 'bg-warning-soft/70 text-warning', dot: 'bg-fill-warning' },
    week: { head: 'bg-background text-text', dot: 'bg-accent-blue-strong' },
};

const DEFAULT_TONE = {
    head: 'bg-background text-text',
    dot: 'bg-text-subtle',
};

export function isClosed(row: MyTaskRow): boolean {
    return row.status_category === 'done' || row.status_category === 'canceled';
}

/** "Proyek Peluncuran Q4", or "Pribadi" for the personal workspace. */
export function workspaceLabel(row: MyTaskRow): string {
    return row.workspace.type === 'personal' ? 'Pribadi' : row.workspace.name;
}

/** Due text of a row: completion for closed work, else the due badge. */
function RowDue({
    row,
    today,
    className,
}: {
    row: MyTaskRow;
    today: string;
    className?: string;
}) {
    const closed = isClosed(row);

    if (closed && row.completed_at) {
        return <CompletionText completedAt={row.completed_at} due={null} />;
    }

    return row.due_date ? (
        <DueBadge
            due={row.due_date}
            today={today}
            closed={closed}
            className={cn('text-[15px]', className)}
        />
    ) : (
        <span className="text-[15px] text-text-subtle">Tanpa tenggat</span>
    );
}

/**
 * Group card of "Tugas saya" (STugasSaya): radius 24, tinted header with a
 * dot ("Terlambat" red, "Hari ini" amber, "Minggu ini" blue), then rows.
 */
export function GroupPanel({
    group,
    children,
}: {
    group: RowGroup;
    children: ReactNode;
}) {
    const tone = HEAD_TONES[group.dueGroup ?? ''] ?? DEFAULT_TONE;

    return (
        <div
            role="rowgroup"
            aria-label={group.label}
            className="overflow-hidden rounded-panel border border-border bg-surface shadow-card"
        >
            <div
                role="row"
                className={cn(
                    'flex items-center gap-3 px-[22px] py-4',
                    tone.head,
                )}
            >
                <span
                    aria-hidden
                    className={cn('size-2.5 shrink-0 rounded-full', tone.dot)}
                />
                <span
                    role="rowheader"
                    className="flex min-w-0 flex-1 items-baseline gap-2"
                >
                    <span className="truncate text-[18px] font-bold">
                        {group.label}
                    </span>
                    {group.hint && (
                        <span className="truncate text-[15px] font-medium text-text-muted">
                            {group.hint}
                        </span>
                    )}
                </span>
                <span className="text-[16px] font-bold tnum">
                    {group.items.length}
                    <span className="sr-only"> tugas</span>
                </span>
            </div>
            {children}
        </div>
    );
}

/** 70px row: mono ID chip, title + workspace, status pill, due date. */
export function DesktopRow({
    row,
    today,
    selected,
    onOpen,
    onSelect,
}: {
    row: MyTaskRow;
    today: string;
    selected: boolean;
    onOpen: () => void;
    onSelect: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const closed = isClosed(row);

    useEffect(() => {
        if (selected) {
            ref.current?.focus();
        }
    }, [selected]);

    return (
        <div
            ref={ref}
            role="row"
            tabIndex={selected ? 0 : -1}
            aria-selected={selected}
            aria-label={`${row.key} ${row.title}`}
            onClick={onOpen}
            onFocus={onSelect}
            onKeyDown={(event) => event.key === 'Enter' && onOpen()}
            className={cn(
                'flex min-h-[70px] cursor-pointer items-center gap-4 border-t border-divider px-[22px] py-3 transition-colors duration-120 ease-brand hover:bg-surface-2/60 focus-visible:outline-none',
                selected && 'bg-surface-2/60 ring-2 ring-primary/50 ring-inset',
            )}
        >
            <span
                role="gridcell"
                className="min-w-[88px] shrink-0 rounded-sm bg-surface-2 px-2 py-1 text-center font-mono text-[14px] font-semibold text-text"
            >
                {row.key}
            </span>
            <span
                role="gridcell"
                className="flex min-w-0 flex-1 flex-col gap-0.5"
            >
                <span
                    className={cn(
                        'truncate text-[17px] font-semibold',
                        closed
                            ? 'text-text-muted line-through decoration-1'
                            : 'text-text',
                    )}
                >
                    {row.title}
                </span>
                <span className="flex min-w-0 items-center gap-2 text-[15px] text-text-muted">
                    <WorkspaceAvatar
                        name={row.workspace.name}
                        type={row.workspace.type}
                        color={row.workspace.color}
                        className="size-5 rounded-[6px] text-[11px]"
                    />
                    <span className="truncate">
                        {workspaceLabel(row)}
                        {row.checklist &&
                            row.checklist.total > 0 &&
                            ` · checklist ${row.checklist.done}/${row.checklist.total}`}
                    </span>
                    {row.labels[0] && (
                        <LabelPill label={row.labels[0]} className="h-6" />
                    )}
                </span>
            </span>
            <span role="gridcell" className="shrink-0">
                <StatusPill
                    name={row.status.name}
                    category={row.status.category}
                />
            </span>
            <span role="gridcell" className="w-[118px] shrink-0 text-right">
                <RowDue row={row} today={today} />
            </span>
        </div>
    );
}

/**
 * Phone card (MTugas): status ring, 17px title, mono ID + label chip, due
 * date on the right; late cards get a red outline. Swipe for "Tunda" and
 * "Selesai".
 */
export function MobileRow({
    row,
    today,
    onOpen,
}: {
    row: MyTaskRow;
    today: string;
    onOpen: () => void;
}) {
    const closed = isClosed(row);
    const late =
        !closed &&
        row.due_date !== null &&
        dueState(row.due_date, today) === 'overdue';
    const actions = [
        {
            label: 'Tunda',
            tone: 'neutral' as const,
            onAction: () =>
                router.patch(
                    update.url(row.id),
                    { due_date: postponedDue(row.due_date, today) },
                    { preserveScroll: true },
                ),
        },
        ...(row.done_status_id && !closed
            ? [
                  {
                      label: 'Selesai',
                      tone: 'primary' as const,
                      onAction: () =>
                          router.patch(
                              move.url(row.id),
                              { status_id: row.done_status_id },
                              { preserveScroll: true },
                          ),
                  },
              ]
            : []),
    ];

    return (
        <SwipeableRow
            actions={actions}
            className={cn(
                'rounded-card border bg-surface',
                late ? 'border-danger/45' : 'border-border',
            )}
        >
            <button
                type="button"
                onClick={onOpen}
                className={cn(
                    'flex min-h-[72px] w-full items-center gap-3.5 rounded-card px-4 py-3.5 text-left',
                    focusRing,
                )}
            >
                <StatusIcon
                    category={row.status.category}
                    color={row.status.color}
                    className="size-[26px]"
                    label={row.status.name}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span
                        className={cn(
                            'line-clamp-2 text-[17px] leading-[23px] font-semibold',
                            closed
                                ? 'text-text-muted line-through decoration-1'
                                : 'text-text',
                        )}
                    >
                        {row.title}
                    </span>
                    <span className="flex min-w-0 items-center gap-2 text-[15px] text-text-muted">
                        <span className="shrink-0 font-mono text-[14px] font-semibold">
                            {row.key}
                        </span>
                        {row.labels[0] ? (
                            <Badge
                                variant="label"
                                className="h-6 min-w-0 rounded-[7px] px-2"
                            >
                                <span className="truncate">
                                    {row.labels[0].name}
                                </span>
                            </Badge>
                        ) : (
                            <span className="truncate">
                                {workspaceLabel(row)}
                            </span>
                        )}
                    </span>
                </span>
                <span className="shrink-0">
                    <RowDue row={row} today={today} />
                </span>
            </button>
        </SwipeableRow>
    );
}
