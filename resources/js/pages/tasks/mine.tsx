import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    CalendarDays,
    CircleCheck,
    Clock,
    MoreHorizontal,
    Plus,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { Fab } from '@/components/mobile/fab';
import { SwipeableRow } from '@/components/mobile/swipeable-row';
import { PriorityIcon } from '@/components/priority-icon';
import { StatusIcon } from '@/components/status-icon';
import { Button } from '@/components/ui/button';
import { AvatarStack } from '@/features/tasks/avatar-stack';
import { DueBadge } from '@/features/tasks/due-badge';
import { FilterMenu } from '@/features/tasks/filters/filter-menu';
import { FilterSheet } from '@/features/tasks/filters/filter-sheet';
import {
    isTypingTarget,
    TaskComposerProvider,
    useTaskComposer,
} from '@/features/tasks/form/task-composer';
import { LabelPill } from '@/features/tasks/label-pill';
import { filterTasks } from '@/features/tasks/lib/filters';
import type { GroupMode, RowGroup } from '@/features/tasks/mine/grouping';
import {
    GROUP_MODES,
    groupRows,
    postponedDue,
    summarize,
} from '@/features/tasks/mine/grouping';
import type { Label, MyTaskRow, Person } from '@/features/tasks/types';
import { useTaskFilters } from '@/features/tasks/use-task-filters';
import { WorkspaceAvatar } from '@/features/workspaces/workspace-avatar';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';
import { mine, move, update } from '@/routes/tasks';

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

const GROUP_ICONS: Record<string, typeof Clock> = {
    overdue: AlertCircle,
    today: Clock,
    week: CalendarDays,
    later: CalendarDays,
    none: MoreHorizontal,
};

function unique<T extends { id: string }>(items: T[]): T[] {
    return [...new Map(items.map((item) => [item.id, item])).values()];
}

function GroupHeader({ group }: { group: RowGroup }) {
    const Icon = group.dueGroup ? GROUP_ICONS[group.dueGroup] : null;

    return (
        <div className="flex h-10 items-center gap-2 border-y border-border bg-surface-2 px-3 text-[13px] first:border-t-0 md:h-9">
            {Icon && (
                <Icon
                    className={cn(
                        'size-4',
                        group.tone === 'danger'
                            ? 'text-danger'
                            : group.tone === 'warning'
                              ? 'text-warning'
                              : 'text-text-muted',
                    )}
                    aria-hidden
                />
            )}
            <span
                className={cn(
                    'font-medium',
                    group.tone === 'danger' ? 'text-danger' : 'text-text',
                )}
            >
                {group.label}
            </span>
            <span className="text-text-muted tnum">{group.items.length}</span>
            {group.hint && (
                <span className="text-text-muted">· {group.hint}</span>
            )}
        </div>
    );
}

function DesktopRow({
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
    const closed =
        row.status_category === 'done' || row.status_category === 'canceled';

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
            onClick={onOpen}
            onFocus={onSelect}
            onKeyDown={(event) => event.key === 'Enter' && onOpen()}
            className={cn(
                'grid h-10 cursor-pointer grid-cols-[20px_72px_20px_minmax(0,1fr)_auto_120px_auto] items-center gap-3 border-b border-border px-3 text-[13px] last:border-b-0 hover:bg-surface-2 focus-visible:outline-none',
                selected && 'bg-surface-2 ring-1 ring-primary/50 ring-inset',
            )}
        >
            <PriorityIcon priority={row.priority} />
            <span className="font-mono text-[11px] text-text-subtle">
                {row.key}
            </span>
            <StatusIcon
                category={row.status.category}
                color={row.status.color}
                label={row.status.name}
            />
            <span
                className={cn(
                    'truncate text-text',
                    closed && 'text-text-muted line-through',
                )}
            >
                {row.title}
            </span>
            <span className="flex items-center gap-2">
                <span title={row.workspace.name}>
                    <WorkspaceAvatar
                        name={row.workspace.name}
                        type={row.workspace.type}
                        color={row.workspace.color}
                        className="size-4.5 text-[10px]"
                    />
                </span>
                {row.labels[0] && <LabelPill label={row.labels[0]} />}
            </span>
            <span className="flex justify-end">
                {row.due_date ? (
                    <DueBadge
                        due={row.due_date}
                        today={today}
                        closed={closed}
                    />
                ) : (
                    <span className="text-text-subtle">–</span>
                )}
            </span>
            <AvatarStack people={row.assignees} max={2} />
        </div>
    );
}

function MobileRow({
    row,
    today,
    onOpen,
}: {
    row: MyTaskRow;
    today: string;
    onOpen: () => void;
}) {
    const closed =
        row.status_category === 'done' || row.status_category === 'canceled';
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
        <SwipeableRow actions={actions} className="border-b border-border">
            <button
                type="button"
                onClick={onOpen}
                className="flex min-h-16 w-full items-start gap-3 px-4 py-3 text-left"
            >
                <StatusIcon
                    category={row.status.category}
                    color={row.status.color}
                    className="mt-0.5 size-5"
                    label={row.status.name}
                />
                <span className="min-w-0 flex-1">
                    <span
                        className={cn(
                            'block truncate text-[15px] text-text',
                            closed && 'text-text-muted line-through',
                        )}
                    >
                        {row.title}
                    </span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[13px] text-text-muted">
                        <span className="font-mono">{row.key}</span>
                        <WorkspaceAvatar
                            name={row.workspace.name}
                            type={row.workspace.type}
                            color={row.workspace.color}
                            className="size-4 text-[9px]"
                        />
                        <span className="truncate">
                            {row.workspace.type === 'personal'
                                ? 'Pribadi'
                                : row.workspace.name.replace(
                                      /^(Divisi|Tim|Proyek) /,
                                      '',
                                  )}
                        </span>
                        {row.due_date && (
                            <DueBadge
                                due={row.due_date}
                                today={today}
                                closed={closed}
                                className="text-[13px]"
                            />
                        )}
                    </span>
                </span>
                <PriorityIcon priority={row.priority} className="mt-1" />
            </button>
        </SwipeableRow>
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

    const summary = summarize(tasks, today);
    const filtered = filterTasks(tasks, filters, today).filter(
        (row) =>
            showClosed ||
            (row.status_category !== 'done' &&
                row.status_category !== 'canceled'),
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
                <span className="text-danger">
                    {' '}
                    · {summary.overdue} terlambat
                </span>
            )}
            {summary.today > 0 &&
                ` · ${summary.today} ${mobile ? 'hari ini' : 'jatuh tempo hari ini'}`}
        </>
    );

    const groupSelect = (
        <label
            className={cn(
                'flex items-center gap-1.5 text-text-muted',
                mobile ? 'text-[15px]' : 'text-[13px]',
            )}
        >
            {mobile ? (
                <CalendarDays className="size-4" aria-hidden />
            ) : (
                'Kelompokkan:'
            )}
            <select
                aria-label="Kelompokkan"
                value={mode}
                onChange={(event) => setMode(event.target.value as GroupMode)}
                className={cn(
                    'rounded-md border border-border bg-surface text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    mobile ? 'h-10 px-2' : 'h-8 px-2',
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

    const empty = (
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <CircleCheck
                className="size-8 text-text-subtle"
                strokeWidth={1.75}
                aria-hidden
            />
            <p className="text-sm font-semibold text-text">
                {tasks.length === 0
                    ? 'Tidak ada tugas di sini'
                    : 'Tidak ada tugas yang cocok'}
            </p>
            <p className="max-w-sm text-[13px] text-text-muted">
                {tasks.length === 0
                    ? 'Tugas yang ditugaskan, Anda amati, atau Anda buat akan muncul di sini.'
                    : 'Ubah filter untuk melihat tugas lain.'}
            </p>
        </div>
    );

    if (mobile) {
        return (
            <div className="-mx-4 space-y-3">
                <div className="px-4">
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
                </div>
                <div className="flex items-center justify-between gap-2 px-4">
                    <p className="text-[15px] text-text-muted">{summaryLine}</p>
                    <div className="flex items-center gap-1">
                        {groupSelect}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-10"
                            aria-label="Filter"
                            onClick={() => setFilterOpen(true)}
                        >
                            <MoreHorizontal />
                        </Button>
                    </div>
                </div>
                <div className="border-t border-border bg-surface">
                    {groups.length === 0
                        ? empty
                        : groups.map((group) => (
                              <section key={group.id} aria-label={group.label}>
                                  <GroupHeader group={group} />
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
                </div>
                {summary.closed > 0 && (
                    <p className="px-4 text-[13px] text-text-muted">
                        <button
                            type="button"
                            className="text-primary underline underline-offset-2"
                            onClick={() => setShowClosed((value) => !value)}
                        >
                            {showClosed
                                ? 'Sembunyikan tugas selesai'
                                : `Tampilkan ${summary.closed} tugas selesai minggu ini`}
                        </button>
                    </p>
                )}
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
        <div className="space-y-4">
            <header className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl leading-7 font-semibold text-text">
                        Tugas saya
                    </h1>
                    <p className="text-[13px] text-text-muted">{summaryLine}</p>
                </div>
                <Button
                    size="sm"
                    className="h-8"
                    onClick={() => composer.openCreate()}
                >
                    <Plus />
                    Tugas baru
                    <kbd className="rounded border border-primary-foreground/30 px-1 font-mono text-[10px]">
                        C
                    </kbd>
                </Button>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border">
                <nav aria-label="Jenis tugas" className="flex gap-1">
                    {TABS.map((item) => (
                        <Link
                            key={item.value}
                            href={mine.url({
                                query:
                                    item.value === 'assigned'
                                        ? {}
                                        : { tab: item.value },
                            })}
                            preserveScroll
                            aria-current={
                                item.value === tab ? 'page' : undefined
                            }
                            className={cn(
                                '-mb-px flex h-9 items-center gap-1.5 border-b-2 px-2.5 text-[13px] font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                item.value === tab
                                    ? 'border-primary text-text'
                                    : 'border-transparent text-text-muted hover:text-text',
                            )}
                        >
                            {item.label}
                            <span className="rounded bg-surface-2 px-1 text-[11px] text-text-muted tnum">
                                {counts[item.value]}
                            </span>
                        </Link>
                    ))}
                </nav>
                <div className="flex items-center gap-2 pb-1.5">
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

            <div
                role="grid"
                aria-label="Tugas saya"
                className="overflow-hidden rounded-lg border border-border bg-surface"
            >
                {groups.length === 0
                    ? empty
                    : groups.map((group) => (
                          <div key={group.id} role="rowgroup">
                              <GroupHeader group={group} />
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
                          </div>
                      ))}
            </div>

            {summary.closed > 0 && (
                <p className="text-[13px] text-text-muted">
                    {showClosed
                        ? 'Tugas selesai minggu ini ditampilkan. '
                        : 'Tugas selesai disembunyikan. '}
                    <button
                        type="button"
                        className="text-primary underline underline-offset-2"
                        onClick={() => setShowClosed((value) => !value)}
                    >
                        {showClosed
                            ? 'Sembunyikan'
                            : `Tampilkan ${summary.closed} tugas selesai minggu ini`}
                    </button>
                </p>
            )}

            <footer className="glass sticky bottom-0 z-20 -mx-4 flex h-11 items-center gap-4 border-x-0 border-b-0 px-4 text-[12px] text-text-muted lg:-mx-6 lg:px-6">
                <span>
                    <kbd className="rounded border border-border px-1.5 font-mono">
                        J
                    </kbd>{' '}
                    /{' '}
                    <kbd className="rounded border border-border px-1.5 font-mono">
                        K
                    </kbd>{' '}
                    pindah
                </span>
                <span>
                    <kbd className="rounded border border-border px-1.5 font-mono">
                        Enter
                    </kbd>{' '}
                    buka
                </span>
                <span>
                    <kbd className="rounded border border-border px-1.5 font-mono">
                        C
                    </kbd>{' '}
                    tugas baru
                </span>
                {selected && (
                    <span className="ml-auto">
                        Terpilih:{' '}
                        <span className="font-mono text-text">
                            {selected.key}
                        </span>
                    </span>
                )}
            </footer>
        </div>
    );
}

/** "Tugas saya" across workspaces (mockups TugasSaya / MTugasSaya). */
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
    breadcrumbs: [
        { title: 'Kerja', href: '/tugas' },
        { title: 'Tugas saya', href: '/tugas' },
    ],
    title: 'Tugas saya',
};
