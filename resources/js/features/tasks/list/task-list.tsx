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
import {
    ArrowDown,
    ArrowUp,
    ChevronDown,
    ChevronsUpDown,
    ListChecks,
    SearchX,
} from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PRIORITY_LABELS } from '@/components/priority-icon';
import { StatusIcon } from '@/components/status-icon';
import { Badge } from '@/components/ui/badge';
import { cn, focusRing } from '@/lib/utils';
import { AvatarStack } from '../avatar-stack';
import { CommentBadge } from '../comment-badge';
import { DueBadge } from '../due-badge';
import { LabelPill } from '../label-pill';
import { dueState } from '../lib/due-date';
import { prioritySortWeight } from '../lib/priority';
import { CompletionText } from '../task-card';
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
        return <ArrowUp className="size-4" aria-hidden />;
    }

    if (direction === 'desc') {
        return <ArrowDown className="size-4" aria-hidden />;
    }

    return <ChevronsUpDown className="size-4 opacity-50" aria-hidden />;
}

/** Urgent and Tinggi get a soft badge in the row meta (DTodo). */
function PriorityBadge({ priority }: { priority: Task['priority'] }) {
    if (priority !== 1 && priority !== 2) {
        return null;
    }

    return (
        <Badge
            variant="label"
            tone={priority === 1 ? 'danger' : 'warning'}
            className="h-6 rounded-[7px] px-2"
        >
            <span className="sr-only">Prioritas: </span>
            {PRIORITY_LABELS[priority]}
        </Badge>
    );
}

function TaskRow({
    row,
    status,
    today,
    onOpen,
}: {
    row: Row;
    status: TaskStatus;
    today: string;
    onOpen: (task: Task) => void;
}) {
    const closed = status.category === 'done' || status.category === 'canceled';
    const late =
        !closed &&
        row.due_date !== null &&
        dueState(row.due_date, today) === 'overdue';

    return (
        <div
            role="row"
            data-task-id={row.id}
            tabIndex={0}
            aria-label={`${row.key} ${row.title}`}
            onClick={() => onOpen(row)}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    onOpen(row);
                }
            }}
            className={cn(
                'flex min-h-[68px] cursor-pointer items-center gap-3.5 border-t border-divider px-4 py-3 transition-colors duration-120 ease-brand hover:bg-surface-2/60 focus-visible:bg-surface-2 focus-visible:outline-none md:gap-4 md:px-6',
                late && 'bg-danger-soft/40',
            )}
        >
            <span role="cell" className="flex shrink-0">
                <StatusIcon
                    category={status.category}
                    color={status.color}
                    label={status.name}
                    className="size-6"
                />
            </span>
            <span role="cell" className="flex min-w-0 flex-1 flex-col gap-1">
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
                <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[14px] text-text-muted">
                    <span className="font-mono font-semibold">{row.key}</span>
                    {row.parent_key && (
                        <span className="text-text-subtle">
                            ↳ {row.parent_key}
                        </span>
                    )}
                    {row.checklist && row.checklist.total > 0 && (
                        <span className="inline-flex items-center gap-1 tnum">
                            <ListChecks className="size-4" aria-hidden />
                            <span className="sr-only">Checklist </span>
                            {row.checklist.done}/{row.checklist.total}
                        </span>
                    )}
                    <CommentBadge comments={row.comments} />
                    {row.assignees[0] && (
                        <span className="truncate md:hidden">
                            {row.assignees[0].name.split(' ')[0]}
                        </span>
                    )}
                    <PriorityBadge priority={row.priority} />
                    <span className="hidden md:contents">
                        {row.labels.slice(0, 2).map((label) => (
                            <LabelPill
                                key={label.id}
                                label={label}
                                className="h-6"
                            />
                        ))}
                    </span>
                </span>
            </span>
            {/* Phones: "Selesai 25 Sep · telat 2 hari" wraps instead of
                squeezing the title to a few letters. */}
            <span
                role="cell"
                className="max-w-[8.5rem] shrink-0 text-right md:max-w-none"
            >
                {closed && row.completed_at ? (
                    <CompletionText
                        completedAt={row.completed_at}
                        due={row.due_date}
                    />
                ) : row.due_date ? (
                    <DueBadge
                        due={row.due_date}
                        today={today}
                        closed={closed}
                        className="text-[15px]"
                    />
                ) : (
                    <span className="text-text-subtle">–</span>
                )}
            </span>
            <span role="cell" className="hidden w-[66px] shrink-0 md:flex">
                {row.assignees.length > 0 ? (
                    <AvatarStack people={row.assignees} size="lg" max={2} />
                ) : (
                    <span className="sr-only">Belum ditugaskan</span>
                )}
            </span>
        </div>
    );
}

/**
 * List view (DTodo / MTodo, TanStack Table v9): one panel per status with a
 * collapsible header, 68px rows (status, 17px title, mono ID, priority,
 * checklist, labels, due date, assignees). Sortable by priority, ID, title
 * and due date from the sort bar above the panels.
 */
export function TaskList({
    statuses,
    tasks,
    labelsById,
    peopleById,
    today,
    onOpen,
}: Props) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
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

    if (tasks.length === 0) {
        return (
            <EmptyState
                icon={SearchX}
                title="Tidak ada tugas yang cocok"
                description="Ubah filter atau kata kunci untuk melihat tugas lain."
            />
        );
    }

    return (
        <div
            role="table"
            aria-label="Daftar tugas"
            className="flex flex-col gap-4"
        >
            <div role="rowgroup">
                <div
                    role="row"
                    className="-mx-4 flex [scrollbar-width:none] items-center gap-2 overflow-x-auto px-4 text-[15px] text-text-muted md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden"
                >
                    <span className="mr-1 shrink-0 font-bold">Urutkan</span>
                    {table.getHeaderGroups()[0].headers.map((header) => {
                        const sortable = header.column.getCanSort();
                        const direction = header.column.getIsSorted();
                        const label = String(
                            header.column.columnDef.header ?? '',
                        );

                        if (!sortable) {
                            return null;
                        }

                        return (
                            <span
                                key={header.id}
                                role="columnheader"
                                className="shrink-0"
                                aria-sort={
                                    direction === 'asc'
                                        ? 'ascending'
                                        : direction === 'desc'
                                          ? 'descending'
                                          : undefined
                                }
                            >
                                <button
                                    type="button"
                                    onClick={header.column.getToggleSortingHandler()}
                                    title={`Urutkan menurut ${label.toLowerCase()}`}
                                    className={cn(
                                        'inline-flex h-9 items-center gap-1.5 rounded-[10px] border px-3 text-[15px] font-semibold transition-colors duration-120 ease-brand',
                                        focusRing,
                                        direction
                                            ? 'border-transparent bg-link-soft text-link'
                                            : 'border-border bg-surface text-text-muted hover:text-text',
                                    )}
                                >
                                    {label}
                                    <SortIcon direction={direction} />
                                </button>
                            </span>
                        );
                    })}
                </div>
            </div>

            {statuses.map((status) => {
                const group = rows.filter((row) => row.status_id === status.id);

                if (group.length === 0) {
                    return null;
                }

                const closed = collapsed[status.id] === true;
                const panelId = `daftar-${status.id}`;

                return (
                    <div
                        key={status.id}
                        role="rowgroup"
                        className="overflow-hidden rounded-panel border border-border bg-surface shadow-card"
                    >
                        <div role="row" className="flex">
                            <span
                                role="rowheader"
                                className="flex min-w-0 flex-1"
                            >
                                <button
                                    type="button"
                                    aria-expanded={!closed}
                                    aria-controls={closed ? undefined : panelId}
                                    onClick={() =>
                                        setCollapsed((value) => ({
                                            ...value,
                                            [status.id]: !closed,
                                        }))
                                    }
                                    className={cn(
                                        'flex min-h-[72px] min-w-0 flex-1 items-center gap-3 px-4 text-left md:px-6',
                                        focusRing,
                                    )}
                                >
                                    <ChevronDown
                                        aria-hidden
                                        className={cn(
                                            'size-5 shrink-0 text-text-muted transition-transform duration-180 ease-brand',
                                            closed && '-rotate-90',
                                        )}
                                    />
                                    <StatusIcon
                                        category={status.category}
                                        color={status.color}
                                        className="size-5"
                                    />
                                    <span className="truncate text-[20px] leading-7 font-bold text-text">
                                        {status.name}
                                    </span>
                                    <span className="ml-auto text-[17px] font-bold text-text tnum">
                                        {group.length}
                                        <span className="sr-only"> tugas</span>
                                    </span>
                                </button>
                            </span>
                        </div>
                        {!closed && (
                            <div id={panelId} className="contents">
                                {group.map((row) => (
                                    <TaskRow
                                        key={row.id}
                                        row={row}
                                        status={status}
                                        today={today}
                                        onOpen={onOpen}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
