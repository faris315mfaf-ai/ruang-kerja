import { Head, router, usePage } from '@inertiajs/react';
import { CircleCheck, ListFilter, Plus, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { Fab } from '@/components/mobile/fab';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { Panel } from '@/components/ui/panel';
import { TabNav } from '@/components/ui/tabs';
import { FilterMenu } from '@/features/tasks/filters/filter-menu';
import { FilterSheet } from '@/features/tasks/filters/filter-sheet';
import {
    isTypingTarget,
    TaskComposerProvider,
    useTaskComposer,
} from '@/features/tasks/form/task-composer';
import { filterTasks } from '@/features/tasks/lib/filters';
import { toolbarControl } from '@/features/tasks/lib/toolbar';
import type { GroupMode } from '@/features/tasks/mine/grouping';
import {
    GROUP_MODES,
    groupRows,
    summarize,
} from '@/features/tasks/mine/grouping';
import {
    DesktopRow,
    GroupPanel,
    MobileRow,
    workspaceLabel,
} from '@/features/tasks/mine/parts';
import type { Label, MyTaskRow, Person } from '@/features/tasks/types';
import { useTaskFilters } from '@/features/tasks/use-task-filters';
import { WorkspaceAvatar } from '@/features/workspaces/workspace-avatar';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatNumber } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { mine } from '@/routes/tasks';

type Tab = 'assigned' | 'watching' | 'created';

type Props = {
    tab: Tab;
    counts: Record<Tab, number>;
    tasks: MyTaskRow[];
    today: string;
};

const TABS: { value: Tab; label: string }[] = [
    { value: 'assigned', label: 'Ditugaskan ke saya' },
    { value: 'watching', label: 'Saya amati' },
    { value: 'created', label: 'Saya buat' },
];

const ALL = 'all';

function unique<T extends { id: string }>(items: T[]): T[] {
    return [...new Map(items.map((item) => [item.id, item])).values()];
}

/** Open tasks per workspace, busiest first (STugasSaya chips + "Menurut workspace"). */
function workspaceCounts(rows: MyTaskRow[]) {
    const map = new Map<string, { row: MyTaskRow; count: number }>();

    for (const row of rows) {
        const entry = map.get(row.workspace.id);
        map.set(row.workspace.id, { row, count: (entry?.count ?? 0) + 1 });
    }

    return [...map.values()].sort(
        (a, b) =>
            b.count - a.count ||
            workspaceLabel(a.row).localeCompare(workspaceLabel(b.row), 'id'),
    );
}

function MyTasksView({ tab, counts, tasks, today }: Props) {
    const breakpoint = useBreakpoint();
    const mobile = breakpoint === 'mobile';
    const { auth } = usePage().props;
    const composer = useTaskComposer();
    const { filters, setFilters } = useTaskFilters();
    const [mode, setMode] = useState<GroupMode>('due');
    const [showClosed, setShowClosed] = useState(false);
    const [filterOpen, setFilterOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [workspaceId, setWorkspaceId] = useState<string>(ALL);

    const summary = summarize(tasks, today);
    const openRows = tasks.filter(
        (row) =>
            row.status_category !== 'done' &&
            row.status_category !== 'canceled',
    );
    const perWorkspace = workspaceCounts(openRows);
    const filtered = filterTasks(tasks, filters, today).filter(
        (row) =>
            (showClosed ||
                (row.status_category !== 'done' &&
                    row.status_category !== 'canceled')) &&
            (workspaceId === ALL || row.workspace.id === workspaceId),
    );
    const groups = groupRows(filtered, mode, today);
    const ordered = groups.flatMap((group) => group.items);
    const people: Person[] = unique(tasks.flatMap((row) => row.assignees));
    const labels: Label[] = unique(tasks.flatMap((row) => row.labels));
    const open = (row: MyTaskRow) => composer.openEdit(row, row.workspace.key);
    const orderKey = ordered.map((row) => row.id).join(',');
    const { registerList } = composer;

    // Sheet J/K walk these rows; edits in the sheet refresh the list.
    useEffect(() => {
        registerList({
            ids: orderKey === '' ? [] : orderKey.split(','),
            onTaskChange: () => router.reload({ only: ['tasks'] }),
        });
    }, [registerList, orderKey]);

    // J/K moves the selection, Enter opens (desktop only, docs/DESIGN.md §1).
    useEffect(() => {
        if (mobile) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (
                event.metaKey ||
                event.ctrlKey ||
                event.altKey ||
                isTypingTarget(event.target)
            ) {
                return;
            }

            const key = event.key.toLowerCase();

            if (key !== 'j' && key !== 'k') {
                return;
            }

            event.preventDefault();
            const index = ordered.findIndex((row) => row.id === selectedId);
            const next =
                key === 'j'
                    ? Math.min(ordered.length - 1, index + 1)
                    : Math.max(0, index - 1);
            setSelectedId(ordered[next]?.id ?? null);
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [mobile, ordered, selectedId]);

    const selected = ordered.find((row) => row.id === selectedId);

    const summaryLine = (
        <>
            {summary.open}{' '}
            {mobile
                ? 'aktif'
                : `tugas aktif di ${summary.workspaces} workspace`}
            {summary.overdue > 0 && (
                <span className="font-semibold text-danger">
                    {' '}
                    · {summary.overdue} terlambat
                </span>
            )}
            {summary.today > 0 &&
                ` · ${summary.today} ${mobile ? 'hari ini' : 'jatuh tempo hari ini'}`}
        </>
    );

    const groupSelect = (
        <label className="flex items-center gap-2 text-[15px] font-bold text-text-muted">
            <span className={cn(mobile && 'sr-only')}>Kelompokkan</span>
            <select
                aria-label="Kelompokkan"
                value={mode}
                onChange={(event) => setMode(event.target.value as GroupMode)}
                className={cn(
                    toolbarControl,
                    'pr-2',
                    mobile ? 'h-11 text-[17px]' : '',
                )}
            >
                {GROUP_MODES.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );

    const workspaceChips = perWorkspace.length > 1 && (
        <ChipScroller
            label="Workspace"
            value={workspaceId}
            onChange={setWorkspaceId}
            className={cn(!mobile && 'mx-0 scroll-px-0 flex-wrap px-0')}
            chips={[
                { value: ALL, label: 'Semua', count: summary.open },
                ...perWorkspace.map(({ row, count }) => ({
                    value: row.workspace.id,
                    label: row.workspace.key,
                    count,
                })),
            ]}
        />
    );

    const empty =
        tasks.length === 0 ? (
            <EmptyState
                icon={CircleCheck}
                title="Tidak ada tugas di sini"
                description="Tugas yang ditugaskan, Anda amati, atau Anda buat akan muncul di sini."
            />
        ) : (
            <EmptyState
                icon={SearchX}
                title="Tidak ada tugas yang cocok"
                description="Ubah filter atau pilihan workspace untuk melihat tugas lain."
            />
        );

    const closedToggle = summary.closed > 0 && (
        <p className="text-[15px] text-text-muted">
            {!mobile &&
                (showClosed
                    ? 'Tugas selesai minggu ini ditampilkan. '
                    : 'Tugas selesai disembunyikan. ')}
            <button
                type="button"
                className={cn(
                    'font-semibold text-link underline underline-offset-2',
                    focusRing,
                )}
                onClick={() => setShowClosed((value) => !value)}
            >
                {showClosed
                    ? 'Sembunyikan tugas selesai'
                    : `Tampilkan ${summary.closed} tugas selesai minggu ini`}
            </button>
        </p>
    );

    if (mobile) {
        return (
            <div className="flex flex-col gap-4">
                <ChipScroller
                    label="Jenis tugas"
                    value={tab}
                    chips={TABS.map((item) => ({
                        ...item,
                        count: counts[item.value],
                    }))}
                    onChange={(value) =>
                        router.get(
                            mine.url(),
                            value === 'assigned' ? {} : { tab: value },
                            { preserveScroll: true },
                        )
                    }
                />
                <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 text-[15px] text-text-muted">
                        {summaryLine}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                        {groupSelect}
                        <button
                            type="button"
                            className={cn(
                                toolbarControl,
                                'size-11 justify-center px-0',
                            )}
                            aria-label="Filter"
                            onClick={() => setFilterOpen(true)}
                        >
                            <ListFilter />
                        </button>
                    </div>
                </div>
                {workspaceChips}
                {groups.length === 0
                    ? empty
                    : groups.map((group) => (
                          <section
                              key={group.id}
                              aria-label={group.label}
                              className="flex flex-col gap-2.5"
                          >
                              {(groups.length > 1 || mode !== 'due') && (
                                  <h2
                                      className={cn(
                                          'flex items-center gap-2 text-overline',
                                          group.tone === 'danger'
                                              ? 'text-danger'
                                              : group.tone === 'warning'
                                                ? 'text-warning'
                                                : 'text-text-muted',
                                      )}
                                  >
                                      {group.label}
                                      <span className="tnum">
                                          {group.items.length}
                                      </span>
                                  </h2>
                              )}
                              {group.items.map((row) => (
                                  <MobileRow
                                      key={row.id}
                                      row={row}
                                      today={today}
                                      onOpen={() => open(row)}
                                  />
                              ))}
                          </section>
                      ))}
                {closedToggle}
                {composer.canCreate && (
                    <Fab
                        label="Tugas baru"
                        onClick={() => composer.openCreate()}
                    />
                )}
                <FilterSheet
                    open={filterOpen}
                    onOpenChange={setFilterOpen}
                    filters={filters}
                    onChange={setFilters}
                    people={people}
                    labels={labels}
                    currentUserId={auth.user?.id}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-[22px]">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-display text-text">Tugas saya</h1>
                    <p className="text-body-lg text-text-muted">
                        {summaryLine}
                    </p>
                </div>
                <Button size="lg" onClick={() => composer.openCreate()}>
                    <Plus />
                    Tugas baru
                    <kbd className="rounded-xs bg-on-brand/18 px-1.5 font-mono text-[13px]">
                        C
                    </kbd>
                </Button>
            </header>

            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-border">
                <TabNav
                    preserveScroll
                    label="Jenis tugas"
                    className="border-b-0"
                    items={TABS.map((item) => ({
                        href: mine.url({
                            query:
                                item.value === 'assigned'
                                    ? {}
                                    : { tab: item.value },
                        }),
                        label: item.label,
                        count: counts[item.value],
                        active: item.value === tab,
                    }))}
                />
                <div className="flex flex-wrap items-center gap-2.5 pb-2.5">
                    <FilterMenu
                        filters={filters}
                        onChange={setFilters}
                        people={people}
                        labels={labels}
                        currentUserId={auth.user?.id}
                    />
                    {groupSelect}
                </div>
            </div>

            {workspaceChips}

            <section className="flex flex-wrap items-start gap-5">
                <div
                    role="grid"
                    aria-label="Tugas saya"
                    className="flex min-w-0 flex-[999_1_640px] flex-col gap-4"
                >
                    {groups.length === 0
                        ? empty
                        : groups.map((group) => (
                              <GroupPanel key={group.id} group={group}>
                                  {group.items.map((row) => (
                                      <DesktopRow
                                          key={row.id}
                                          row={row}
                                          today={today}
                                          selected={row.id === selectedId}
                                          onOpen={() => open(row)}
                                          onSelect={() => setSelectedId(row.id)}
                                      />
                                  ))}
                              </GroupPanel>
                          ))}
                    {closedToggle}
                </div>

                <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
                    <KpiCard
                        tone="highlight"
                        label="Selesai minggu ini"
                        value={formatNumber(summary.closed)}
                        note={`${formatNumber(summary.open)} tugas masih terbuka`}
                    />
                    {perWorkspace.length > 0 && (
                        <Panel title="Menurut workspace" flush>
                            <ul className="flex flex-col px-6 md:px-7">
                                {perWorkspace.map(({ row, count }) => (
                                    <li
                                        key={row.workspace.id}
                                        className="flex min-h-12 items-center gap-3 border-t border-divider"
                                    >
                                        <WorkspaceAvatar
                                            name={row.workspace.name}
                                            type={row.workspace.type}
                                            color={row.workspace.color}
                                            className="size-8 rounded-[10px] text-[14px] font-extrabold"
                                        />
                                        <span className="min-w-0 flex-1 truncate text-[16px] font-medium">
                                            {workspaceLabel(row)}
                                        </span>
                                        <b className="text-[16px] tnum">
                                            {count}
                                        </b>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                    )}
                </aside>
            </section>

            <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 text-meta text-text-muted">
                <span>
                    <kbd className="rounded-xs border border-border px-1.5 font-mono">
                        J
                    </kbd>{' '}
                    /{' '}
                    <kbd className="rounded-xs border border-border px-1.5 font-mono">
                        K
                    </kbd>{' '}
                    pindah
                </span>
                <span>
                    <kbd className="rounded-xs border border-border px-1.5 font-mono">
                        Enter
                    </kbd>{' '}
                    buka
                </span>
                <span>
                    <kbd className="rounded-xs border border-border px-1.5 font-mono">
                        C
                    </kbd>{' '}
                    tugas baru
                </span>
                {selected && (
                    <span className="ml-auto">
                        Terpilih:{' '}
                        <span className="font-mono font-semibold text-text">
                            {selected.key}
                        </span>
                    </span>
                )}
            </footer>
        </div>
    );
}

/** "Tugas saya" across workspaces (STugasSaya / MTugas). */
export default function MyTasks(props: Props) {
    return (
        <>
            <Head title="Tugas saya" />
            <TaskComposerProvider today={props.today} canCreate>
                <MyTasksView {...props} />
            </TaskComposerProvider>
        </>
    );
}

MyTasks.layout = {
    breadcrumbs: [{ title: 'Tugas saya', href: '/tugas' }],
    title: 'Tugas saya',
};
