import { Head, Link, router, usePage } from '@inertiajs/react';
import { CalendarDays, Columns3, List, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Fab } from '@/components/mobile/fab';
import { KanbanBoard } from '@/features/tasks/board/kanban-board';
import { MobileBoard } from '@/features/tasks/board/mobile-board';
import { TaskCalendar } from '@/features/tasks/calendar/task-calendar';
import { FilterMenu } from '@/features/tasks/filters/filter-menu';
import { FilterSheet } from '@/features/tasks/filters/filter-sheet';
import {
    TaskComposerProvider,
    useTaskComposer,
} from '@/features/tasks/form/task-composer';
import { ApiError, requestJson } from '@/features/tasks/lib/api';
import { countActiveFilters, filterTasks } from '@/features/tasks/lib/filters';
import {
    useConnectionMode,
    usePolling,
} from '@/features/tasks/realtime/connection';
import { ConnectionIndicator } from '@/features/tasks/realtime/connection-indicator';
import { useWorkspaceEvents } from '@/features/tasks/realtime/workspace-channel';
import { toggleAssignee } from '@/features/tasks/shortcuts/keys';
import { QuickPropertyDialog } from '@/features/tasks/shortcuts/quick-property-dialog';
import { ShortcutHelpDialog } from '@/features/tasks/shortcuts/shortcut-help-dialog';
import { useTaskShortcuts } from '@/features/tasks/shortcuts/use-task-shortcuts';
import { SavedViewsMenu } from '@/features/tasks/views/saved-views-menu';
import { TaskList } from '@/features/tasks/list/task-list';
import type {
    Label,
    Priority,
    SavedView,
    Task,
    TaskStatus,
    TaskViewMode,
} from '@/features/tasks/types';
import { useTaskBoard } from '@/features/tasks/use-task-board';
import { useTaskFilters } from '@/features/tasks/use-task-filters';
import type { WorkspacePageProps } from '@/features/workspaces/types';
import { WorkspaceShell } from '@/features/workspaces/workspace-shell';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { update as updateTask } from '@/routes/tasks';
import { show } from '@/routes/workspaces';

type Props = WorkspacePageProps & {
    statuses: TaskStatus[];
    labels: Label[];
    tasks: Task[];
    hidden_closed_count: number;
    saved_views: SavedView[];
    view: TaskViewMode;
    month: string;
    today: string;
};

const VIEWS: { view: TaskViewMode; label: string; icon: typeof Columns3 }[] = [
    { view: 'board', label: 'Board', icon: Columns3 },
    { view: 'list', label: 'List', icon: List },
    { view: 'calendar', label: 'Kalender', icon: CalendarDays },
];

/** Same filters, other view (the filters live in the query string). */
function viewHref(workspaceKey: string, view: TaskViewMode): string {
    const params = new URLSearchParams(
        typeof window === 'undefined' ? '' : window.location.search,
    );
    params.delete('month');

    if (view === 'board') {
        params.delete('view');
    } else {
        params.set('view', view);
    }

    const query = params.toString();

    return `${show.url(workspaceKey)}${query ? `?${query}` : ''}`;
}

function ViewSwitch({
    current,
    workspaceKey,
    mobile,
}: {
    current: TaskViewMode;
    workspaceKey: string;
    mobile: boolean;
}) {
    return (
        <nav
            aria-label="Tampilan"
            className={cn(
                'inline-flex rounded-lg border border-border bg-surface p-0.5',
                mobile && 'flex-1',
            )}
        >
            {VIEWS.map(({ view, label, icon: Icon }) => (
                <Link
                    key={view}
                    href={viewHref(workspaceKey, view)}
                    preserveScroll
                    aria-current={view === current ? 'page' : undefined}
                    className={cn(
                        'flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        mobile
                            ? 'h-10 flex-1 text-[15px]'
                            : 'h-7 px-3 text-[13px]',
                        view === current
                            ? 'bg-surface-2 text-text'
                            : 'text-text-muted hover:text-text',
                    )}
                >
                    {mobile && <Icon className="size-4" aria-hidden />}
                    {label}
                </Link>
            ))}
        </nav>
    );
}

function TasksView(props: Props) {
    const {
        workspace,
        members,
        statuses,
        labels,
        tasks,
        view,
        today,
        month,
        can,
        hidden_closed_count,
        saved_views,
    } = props;
    const { auth } = usePage().props;
    const breakpoint = useBreakpoint();
    const mobile = breakpoint === 'mobile';
    const composer = useTaskComposer();
    const { filters, setFilters } = useTaskFilters();
    const [filterOpen, setFilterOpen] = useState(false);
    const [mobileColumn, setMobileColumn] = useState<string | null>(null);
    const board = useTaskBoard(tasks, statuses);

    const labelsById = Object.fromEntries(
        labels.map((label) => [label.id, label]),
    );
    const peopleById = Object.fromEntries(
        members.map((member) => [member.id, member]),
    );
    const allTasks = Object.values(board.byId);
    const visible = filterTasks(allTasks, filters, today);
    const visibleIds = new Set(visible.map((task) => task.id));
    const visibleColumns = Object.fromEntries(
        Object.entries(board.columns).map(([statusId, ids]) => [
            statusId,
            ids.filter((id) => visibleIds.has(id)),
        ]),
    );
    const activeFilters = countActiveFilters(filters);
    const { upsertTask, removeTask, moveTask } = board;
    const container = useRef<HTMLDivElement>(null);
    const connection = useConnectionMode();

    // Realtime: other members' changes appear without a reload.
    useWorkspaceEvents(workspace.id, {
        'task.created': ({ task }) => upsertTask(task),
        'task.updated': ({ task }) => upsertTask(task),
        'task.moved': ({ task }) => upsertTask(task),
        'task.deleted': ({ task }) => removeTask(task.id),
    });

    // WebSocket down: refresh the tasks every 30 s.
    usePolling(connection === 'polling', () =>
        router.reload({ only: ['tasks', 'hidden_closed_count'] }),
    );

    // Display order for the sheet (J/K, "6 dari 18").
    const orderKey = (
        view === 'calendar'
            ? visible.map((task) => task.id)
            : statuses.flatMap((status) => visibleColumns[status.id] ?? [])
    ).join(',');
    const { registerList } = composer;

    useEffect(() => {
        registerList({
            ids: orderKey === '' ? [] : orderKey.split(','),
            onTaskChange: upsertTask,
        });
    }, [registerList, orderKey, upsertTask]);

    const patch = useCallback(
        async (task: Task, changes: Record<string, unknown>) => {
            try {
                const response = await requestJson<{ task: Task }>(
                    updateTask(task.id),
                    changes,
                );
                upsertTask(response.task);

                return response.task;
            } catch (error) {
                toast.error(
                    error instanceof ApiError
                        ? error.message
                        : `Gagal mengubah ${task.key}.`,
                );

                return null;
            }
        },
        [upsertTask],
    );

    const assignMe = useCallback(
        (task: Task, userId: string) => {
            const assigned = !task.assignee_ids.includes(userId);

            void patch(task, {
                assignee_ids: toggleAssignee(task.assignee_ids, userId),
            }).then((result) => {
                if (result) {
                    toast.success(
                        assigned
                            ? `${task.key} ditugaskan ke Anda.`
                            : `Anda dilepas dari ${task.key}.`,
                    );
                }
            });
        },
        [patch],
    );

    const shortcuts = useTaskShortcuts({
        enabled:
            !mobile &&
            (view === 'board' || view === 'list') &&
            composer.openTaskId === null,
        container,
        tasks: board.byId,
        canEdit: can.edit_tasks,
        onAssignMe: assignMe,
    });

    const open = (task: Task) => composer.openEdit(task);
    const create = (statusId?: string) =>
        composer.openCreate(statusId ? { statusId } : undefined);
    const changeMonth = (next: string) =>
        router.get(
            show.url(workspace.key),
            { view: 'calendar', month: next.slice(0, 7) },
            {
                preserveState: true,
                preserveScroll: true,
                only: ['tasks', 'month'],
            },
        );

    return (
        <WorkspaceShell
            workspace={workspace}
            members={members}
            can={can}
            drive_counts={props.drive_counts}
            tab="tasks"
            onCreateTask={composer.canCreate ? () => create() : null}
        >
            <div className="flex flex-wrap items-center gap-2">
                <ViewSwitch
                    current={view}
                    workspaceKey={workspace.key}
                    mobile={mobile}
                />
                {mobile ? (
                    <button
                        type="button"
                        onClick={() => setFilterOpen(true)}
                        aria-label={
                            activeFilters > 0
                                ? `Filter (${activeFilters} aktif)`
                                : 'Filter'
                        }
                        className="relative flex size-11 items-center justify-center rounded-lg text-text hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                        <SlidersHorizontal className="size-5" />
                        {activeFilters > 0 && (
                            <span className="absolute top-2 right-2 size-2 rounded-full bg-primary" />
                        )}
                    </button>
                ) : (
                    <FilterMenu
                        filters={filters}
                        onChange={setFilters}
                        people={members}
                        labels={labels}
                        currentUserId={auth.user?.id}
                    />
                )}
                <SavedViewsMenu
                    workspaceKey={workspace.key}
                    savedViews={saved_views}
                    layout={view}
                    filters={filters}
                    canShare={can.edit_tasks}
                    canManage={can.manage}
                    mobile={mobile}
                />
                {!mobile && (
                    <p className="ml-auto flex items-center gap-1 text-[13px] text-text-muted">
                        <span>
                            {visible.length === allTasks.length
                                ? `${formatNumber(allTasks.length)} tugas`
                                : `${formatNumber(visible.length)} dari ${formatNumber(allTasks.length)} tugas`}
                            {hidden_closed_count > 0 &&
                                ` · ${formatNumber(hidden_closed_count)} tugas selesai lama disembunyikan`}
                            {' · '}
                        </span>
                        <ConnectionIndicator mode={connection} />
                        <button
                            type="button"
                            onClick={() => shortcuts.setHelp(true)}
                            className="ml-2 rounded border border-border px-1.5 font-mono text-[11px] text-text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            aria-label="Pintasan keyboard"
                            title="Pintasan keyboard (?)"
                        >
                            ?
                        </button>
                    </p>
                )}
            </div>

            {mobile && connection === 'polling' && (
                <ConnectionIndicator mode={connection} className="text-xs" />
            )}

            <div ref={container} className="contents">
                {statuses.length === 0 ? null : view === 'list' ? (
                    <TaskList
                        statuses={statuses}
                        tasks={visible}
                        labelsById={labelsById}
                        peopleById={peopleById}
                        today={today}
                        onOpen={open}
                    />
                ) : view === 'calendar' ? (
                    <TaskCalendar
                        statuses={statuses}
                        tasks={visible}
                        labelsById={labelsById}
                        peopleById={peopleById}
                        today={today}
                        month={month}
                        workspaceKey={workspace.key}
                        onMonthChange={changeMonth}
                        onOpen={open}
                        onShowUndated={() => {
                            setFilters({ ...filters, due: 'none' });
                            router.get(
                                show.url(workspace.key),
                                { view: 'list', due: 'none' },
                                { preserveState: true },
                            );
                        }}
                    />
                ) : mobile ? (
                    <MobileBoard
                        statuses={statuses}
                        columns={visibleColumns}
                        byId={board.byId}
                        labelsById={labelsById}
                        peopleById={peopleById}
                        today={today}
                        canEdit={can.edit_tasks}
                        onMove={(id, target, options) =>
                            void board.moveTask(id, target, options)
                        }
                        onOpen={open}
                        onCreate={create}
                        onColumnChange={setMobileColumn}
                    />
                ) : (
                    <KanbanBoard
                        statuses={statuses}
                        columns={visibleColumns}
                        byId={board.byId}
                        labelsById={labelsById}
                        peopleById={peopleById}
                        today={today}
                        canEdit={can.edit_tasks}
                        onMove={(id, target, options) =>
                            void board.moveTask(id, target, options)
                        }
                        onOpen={open}
                        onCreate={create}
                    />
                )}
            </div>

            <ShortcutHelpDialog
                open={shortcuts.help}
                onOpenChange={shortcuts.setHelp}
            />
            <QuickPropertyDialog
                property={shortcuts.quick?.property ?? null}
                task={shortcuts.quickTask}
                statuses={statuses}
                today={today}
                onOpenChange={(value) => !value && shortcuts.closeQuick()}
                onStatus={(statusId) => {
                    const task = shortcuts.quickTask;

                    if (task && task.status_id !== statusId) {
                        void moveTask(
                            task.id,
                            { statusId },
                            { announce: true },
                        );
                    }
                }}
                onPriority={(priority: Priority) => {
                    const task = shortcuts.quickTask;

                    if (task) {
                        void patch(task, { priority });
                    }
                }}
                onDue={(date) => {
                    const task = shortcuts.quickTask;

                    if (task) {
                        void patch(task, { due_date: date });
                    }
                }}
            />

            {mobile && (
                <>
                    {composer.canCreate && (
                        <Fab
                            label="Tugas baru"
                            onClick={() =>
                                create(
                                    view === 'board'
                                        ? (mobileColumn ?? undefined)
                                        : undefined,
                                )
                            }
                        />
                    )}
                    <FilterSheet
                        open={filterOpen}
                        onOpenChange={setFilterOpen}
                        filters={filters}
                        onChange={setFilters}
                        people={members}
                        labels={labels}
                        currentUserId={auth.user?.id}
                    />
                </>
            )}
        </WorkspaceShell>
    );
}

/** Workspace › Tugas: board, list and calendar (mockups Kanban, MBoard, KalenderTugas, MKalender). */
export default function WorkspaceTasks(props: Props) {
    const { workspace, statuses, labels, members, today, can } = props;

    return (
        <>
            <Head
                title={`${workspace.type === 'personal' ? 'Pribadi' : workspace.name} · Tugas`}
            />
            <TaskComposerProvider
                workspace={{ ...workspace, statuses, labels, members }}
                today={today}
                canCreate={can.edit_tasks}
            >
                <TasksView {...props} />
            </TaskComposerProvider>
        </>
    );
}

WorkspaceTasks.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Workspace', href: '/workspace' },
        {
            title:
                props.workspace.type === 'personal'
                    ? 'Pribadi'
                    : props.workspace.name,
            href: show.url(props.workspace.key),
        },
    ],
    title:
        props.workspace.type === 'personal' ? 'Pribadi' : props.workspace.name,
    back: '/menu',
});
