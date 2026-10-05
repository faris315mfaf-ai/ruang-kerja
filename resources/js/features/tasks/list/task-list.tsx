import type { SortingState } from '@tanstack/react-table';
import {
    createColumnHelper,
    createSortedRowModel,
    rowSortingFeature,
    sortFn_alphanumeric,
    sortFn_basic,
    tableFeatures,
    useTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { PRIORITY_LABELS, PriorityIcon } from '@/components/priority-icon';
import { StatusIcon } from '@/components/status-icon';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';
import { AvatarStack } from '../avatar-stack';
import { DueBadge } from '../due-badge';
import { LabelPill } from '../label-pill';
import { prioritySortWeight } from '../lib/priority';
import type { Label, Person, Task, TaskStatus } from '../types';

type Row = Task & {
    labels: Label[];
    assignees: Person[];
};

type Props = {
    statuses: TaskStatus[];
    tasks: Task[];
    labelsById: Record<string, Label>;
    peopleById: Record<string, Person>;
    today: string;
    onOpen: (task: Task) => void;
};

const features = tableFeatures({
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
});

const helper = createColumnHelper<typeof features, Row>();

const NO_DUE = '9999-12-31';

const columns = helper.columns([
    helper.accessor((row) => prioritySortWeight(row.priority), {
        id: 'priority',
        header: 'Prioritas',
        sortFn: 'basic',
    }),
    helper.accessor('number', { header: 'ID', sortFn: 'basic' }),
    helper.accessor('title', { header: 'Judul', sortFn: 'alphanumeric' }),
    helper.display({ id: 'labels', header: 'Label' }),
    helper.display({ id: 'assignees', header: 'Penanggung jawab' }),
    helper.accessor((row) => row.due_date ?? NO_DUE, {
        id: 'due_date',
        header: 'Tenggat',
        sortFn: 'alphanumeric',
    }),
]);

function SortIcon({ direction }: { direction: false | 'asc' | 'desc' }) {
    if (direction === 'asc') {
        return <ArrowUp className="size-3.5" aria-hidden />;
    }

    if (direction === 'desc') {
        return <ArrowDown className="size-3.5" aria-hidden />;
    }

    return <ChevronsUpDown className="size-3.5 opacity-40" aria-hidden />;
}

const GRID =
    'grid grid-cols-[28px_76px_minmax(0,1fr)_minmax(0,200px)_96px_110px] items-center gap-3';

/**
 * List view (TanStack Table v9): rows grouped by status column, sortable by
 * priority, ID, title and due date. Mobile shows 56px rows instead of a table.
 */
export function TaskList({
    statuses,
    tasks,
    labelsById,
    peopleById,
    today,
    onOpen,
}: Props) {
    const breakpoint = useBreakpoint();
    const [sorting, setSorting] = useState<SortingState>([]);
    const data: Row[] = tasks.map((task) => ({
        ...task,
        labels: task.label_ids.flatMap((id) =>
            labelsById[id] ? [labelsById[id]] : [],
        ),
        assignees: task.assignee_ids.flatMap((id) =>
            peopleById[id] ? [peopleById[id]] : [],
        ),
    }));

    const table = useTable({
        features,
        columns,
        data,
        state: { sorting },
        onSortingChange: setSorting,
        getRowId: (row) => row.id,
    });

    const rows = table.getRowModel().rows.map((row) => row.original);
    const mobile = breakpoint === 'mobile';

    if (tasks.length === 0) {
        return (
            <p className="rounded-lg border border-dashed border-border-strong px-4 py-10 text-center text-sm text-text-muted">
                Tidak ada tugas yang cocok.
            </p>
        );
    }

    return (
        <div
            role="table"
            aria-label="Daftar tugas"
            className="overflow-hidden rounded-lg border border-border bg-surface"
        >
            {!mobile && (
                <div
                    role="rowgroup"
                    className="border-b border-border bg-surface-2"
                >
                    <div
                        role="row"
                        className={cn(
                            GRID,
                            'h-9 px-3 text-[11px] font-medium tracking-[.04em] text-text-muted uppercase',
                        )}
                    >
                        {table.getHeaderGroups()[0].headers.map((header) => {
                            const sortable = header.column.getCanSort();
                            const direction = header.column.getIsSorted();
                            const label = String(
                                header.column.columnDef.header ?? '',
                            );

                            return (
                                <div
                                    key={header.id}
                                    role="columnheader"
                                    aria-sort={
                                        direction === 'asc'
                                            ? 'ascending'
                                            : direction === 'desc'
                                              ? 'descending'
                                              : undefined
                                    }
                                >
                                    {sortable ? (
                                        <button
                                            type="button"
                                            onClick={header.column.getToggleSortingHandler()}
                                            className="flex items-center gap-1 uppercase hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                            title={`Urutkan menurut ${label.toLowerCase()}`}
                                        >
                                            <span
                                                className={
                                                    header.id === 'priority'
                                                        ? 'sr-only'
                                                        : undefined
                                                }
                                            >
                                                {label}
                                            </span>
                                            <SortIcon direction={direction} />
                                        </button>
                                    ) : (
                                        label
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {statuses.map((status) => {
                const group = rows.filter((row) => row.status_id === status.id);

                if (group.length === 0) {
                    return null;
                }

                return (
                    <div key={status.id} role="rowgroup">
                        <div
                            role="row"
                            className="flex h-9 items-center gap-2 border-b border-border bg-surface-2/60 px-3 text-[13px] font-medium text-text"
                        >
                            <span
                                role="rowheader"
                                className="flex items-center gap-2"
                            >
                                <StatusIcon
                                    category={status.category}
                                    color={status.color}
                                />
                                {status.name}
                                <span className="font-normal text-text-muted tnum">
                                    {group.length}
                                </span>
                            </span>
                        </div>
                        {group.map((row) =>
                            mobile ? (
                                <button
                                    key={row.id}
                                    type="button"
                                    data-task-id={row.id}
                                    role="row"
                                    onClick={() => onOpen(row)}
                                    className="flex min-h-14 w-full items-center gap-3 border-b border-border px-4 py-2 text-left last:border-b-0 focus-visible:bg-surface-2 focus-visible:outline-none"
                                >
                                    <StatusIcon
                                        category={status.category}
                                        color={status.color}
                                        className="size-5"
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[15px] text-text">
                                            {row.title}
                                        </span>
                                        <span className="flex items-center gap-2 text-[13px] text-text-muted">
                                            <span className="font-mono">
                                                {row.key}
                                            </span>
                                            {row.due_date && (
                                                <DueBadge
                                                    due={row.due_date}
                                                    today={today}
                                                    closed={
                                                        status.category ===
                                                            'done' ||
                                                        status.category ===
                                                            'canceled'
                                                    }
                                                />
                                            )}
                                        </span>
                                    </span>
                                    <PriorityIcon priority={row.priority} />
                                </button>
                            ) : (
                                <div
                                    key={row.id}
                                    role="row"
                                    data-task-id={row.id}
                                    tabIndex={0}
                                    onClick={() => onOpen(row)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            onOpen(row);
                                        }
                                    }}
                                    className={cn(
                                        GRID,
                                        'h-10 cursor-pointer border-b border-border px-3 text-[13px] transition-colors duration-120 ease-brand last:border-b-0 hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none',
                                    )}
                                >
                                    <span
                                        role="cell"
                                        title={`Prioritas: ${PRIORITY_LABELS[row.priority]}`}
                                    >
                                        <PriorityIcon priority={row.priority} />
                                    </span>
                                    <span
                                        role="cell"
                                        className="font-mono text-[11px] text-text-subtle"
                                    >
                                        {row.key}
                                    </span>
                                    <span
                                        role="cell"
                                        className="flex min-w-0 items-center gap-2"
                                    >
                                        <StatusIcon
                                            category={status.category}
                                            color={status.color}
                                        />
                                        <span className="truncate text-text">
                                            {row.title}
                                        </span>
                                        {row.parent_key && (
                                            <span className="shrink-0 text-[11px] text-text-subtle">
                                                ↳ {row.parent_key}
                                            </span>
                                        )}
                                    </span>
                                    <span
                                        role="cell"
                                        className="flex min-w-0 gap-1 overflow-hidden"
                                    >
                                        {row.labels.slice(0, 2).map((label) => (
                                            <LabelPill
                                                key={label.id}
                                                label={label}
                                            />
                                        ))}
                                    </span>
                                    <span role="cell">
                                        {row.assignees.length > 0 ? (
                                            <AvatarStack
                                                people={row.assignees}
                                            />
                                        ) : (
                                            <span className="text-text-subtle">
                                                –
                                            </span>
                                        )}
                                    </span>
                                    <span role="cell">
                                        {row.due_date ? (
                                            <DueBadge
                                                due={row.due_date}
                                                today={today}
                                                closed={
                                                    status.category ===
                                                        'done' ||
                                                    status.category ===
                                                        'canceled'
                                                }
                                            />
                                        ) : (
                                            <span className="text-text-subtle">
                                                –
                                            </span>
                                        )}
                                    </span>
                                </div>
                            ),
                        )}
                    </div>
                );
            })}
        </div>
    );
}
