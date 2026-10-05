import { ArrowLeftRight, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { PointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { StatusIcon } from '@/components/status-icon';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { prioritySortWeight } from '../lib/priority';
import { compareTasks } from '../lib/board';
import { TaskCardContent } from '../task-card';
import type { Label, Person, Task, TaskStatus } from '../types';
import type { MoveTarget } from '../use-task-board';

type Props = {
    statuses: TaskStatus[];
    columns: Record<string, string[]>;
    byId: Record<string, Task>;
    labelsById: Record<string, Label>;
    peopleById: Record<string, Person>;
    today: string;
    canEdit: boolean;
    onMove: (
        taskId: string,
        target: MoveTarget,
        options?: { announce?: boolean },
    ) => void;
    onOpen: (task: Task) => void;
    onCreate: (statusId: string) => void;
    /** Reports the visible column (FAB creates there). */
    onColumnChange?: (statusId: string) => void;
};

function resolve<T>(ids: string[], map: Record<string, T>): T[] {
    return ids.flatMap((id) => (map[id] ? [map[id]] : []));
}

/** First column with open work, as in the mockup (in progress). */
function initialColumn(
    statuses: TaskStatus[],
    columns: Record<string, string[]>,
): string | undefined {
    return (
        statuses.find(
            (status) =>
                status.category === 'in_progress' &&
                (columns[status.id]?.length ?? 0) > 0,
        )?.id ??
        statuses.find((status) => (columns[status.id]?.length ?? 0) > 0)?.id ??
        statuses[0]?.id
    );
}

/**
 * Mobile board (mockup MBoard): one column per screen with scrollable column
 * tabs, swipe left/right between columns, cards sorted by priority and a
 * "Pindahkan" menu per card instead of drag & drop (docs/PLATFORM.md §2).
 */
export function MobileBoard({
    statuses,
    columns,
    byId,
    labelsById,
    peopleById,
    today,
    canEdit,
    onMove,
    onOpen,
    onCreate,
    onColumnChange,
}: Props) {
    const [activeId, setActiveId] = useState(() =>
        initialColumn(statuses, columns),
    );
    const current =
        statuses.find((status) => status.id === activeId) ?? statuses[0];
    const index = current ? statuses.indexOf(current) : 0;
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const swipe = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        if (current) {
            onColumnChange?.(current.id);
            tabRefs.current[current.id]?.scrollIntoView({
                block: 'nearest',
                inline: 'center',
            });
        }
    }, [current, onColumnChange]);

    if (!current) {
        return null;
    }

    const go = (offset: number) => {
        const next = statuses[index + offset];

        if (next) {
            setActiveId(next.id);
        }
    };

    const tasks = resolve(columns[current.id] ?? [], byId).sort(
        (a, b) =>
            prioritySortWeight(a.priority) - prioritySortWeight(b.priority) ||
            compareTasks(a, b),
    );

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        swipe.current = { x: event.clientX, y: event.clientY };
    };

    const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
        const start = swipe.current;
        swipe.current = null;

        if (!start) {
            return;
        }

        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;

        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            go(dx < 0 ? 1 : -1);
        }
    };

    return (
        <div className="space-y-3">
            <div
                role="tablist"
                aria-label="Kolom status"
                className="-mx-4 flex [scrollbar-width:none] gap-1 overflow-x-auto border-b border-border px-4 [&::-webkit-scrollbar]:hidden"
            >
                {statuses.map((status) => {
                    const selected = status.id === current.id;

                    return (
                        <button
                            key={status.id}
                            ref={(node) => {
                                tabRefs.current[status.id] = node;
                            }}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => setActiveId(status.id)}
                            className={cn(
                                '-mb-px flex h-11 shrink-0 items-center gap-2 border-b-2 px-2.5 text-[15px] transition-colors duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                selected
                                    ? 'border-primary font-medium text-text'
                                    : 'border-transparent text-text-muted',
                            )}
                        >
                            <StatusIcon
                                category={status.category}
                                color={status.color}
                            />
                            {status.name}
                            <span className="text-text-muted tnum">
                                {columns[status.id]?.length ?? 0}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[15px] text-text-muted">
                    <span className="font-medium text-text">
                        {current.name}
                    </span>{' '}
                    · {tasks.length} tugas · urut prioritas
                </p>
                {canEdit && (
                    <button
                        type="button"
                        onClick={() => onCreate(current.id)}
                        aria-label={`Tambah tugas di ${current.name}`}
                        className="flex size-11 items-center justify-center rounded-full text-text hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                        <Plus className="size-5" />
                    </button>
                )}
            </div>

            <div
                role="tabpanel"
                aria-label={current.name}
                className="min-h-48 touch-pan-y space-y-3"
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerCancel={() => {
                    swipe.current = null;
                }}
            >
                {tasks.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border-strong px-4 py-10 text-center text-sm text-text-muted">
                        Belum ada tugas di kolom ini.
                    </p>
                )}
                {tasks.map((task) => (
                    <article
                        key={task.id}
                        className="rounded-xl border border-border bg-surface p-4 [contain-intrinsic-size:auto_140px] [content-visibility:auto]"
                    >
                        <button
                            type="button"
                            onClick={() => onOpen(task)}
                            className="block w-full text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            aria-label={`Buka ${task.key} ${task.title}`}
                        >
                            <TaskCardContent
                                task={task}
                                labels={resolve(task.label_ids, labelsById)}
                                assignees={resolve(
                                    task.assignee_ids,
                                    peopleById,
                                )}
                                today={today}
                                size="comfortable"
                            />
                        </button>
                        {canEdit && (
                            <div className="mt-3 flex justify-end">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            className="flex h-11 items-center gap-2 rounded-lg border border-border px-4 text-[15px] text-text hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                        >
                                            <ArrowLeftRight
                                                className="size-4"
                                                aria-hidden
                                            />
                                            Pindahkan
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="w-64"
                                    >
                                        <DropdownMenuLabel>
                                            Pindahkan {task.key} ke
                                        </DropdownMenuLabel>
                                        <DropdownMenuRadioGroup
                                            value={task.status_id}
                                            onValueChange={(statusId) => {
                                                if (
                                                    statusId !== task.status_id
                                                ) {
                                                    onMove(
                                                        task.id,
                                                        { statusId },
                                                        { announce: true },
                                                    );
                                                }
                                            }}
                                        >
                                            {statuses.map((status) => (
                                                <DropdownMenuRadioItem
                                                    key={status.id}
                                                    value={status.id}
                                                    className="min-h-11"
                                                >
                                                    <StatusIcon
                                                        category={
                                                            status.category
                                                        }
                                                        color={status.color}
                                                    />
                                                    {status.name}
                                                </DropdownMenuRadioItem>
                                            ))}
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
                    </article>
                ))}
            </div>

            <div className="flex flex-col items-center gap-2 pt-2">
                <div className="flex gap-1.5" aria-hidden>
                    {statuses.map((status) => (
                        <span
                            key={status.id}
                            className={cn(
                                'h-1.5 rounded-full transition-all duration-180 ease-brand',
                                status.id === current.id
                                    ? 'w-5 bg-primary'
                                    : 'w-1.5 bg-border-strong',
                            )}
                        />
                    ))}
                </div>
                <div className="flex items-center gap-1 text-sm text-text-muted">
                    <button
                        type="button"
                        onClick={() => go(-1)}
                        disabled={index === 0}
                        aria-label="Kolom sebelumnya"
                        className="flex size-11 items-center justify-center rounded-full disabled:opacity-30"
                    >
                        <ChevronLeft className="size-4" />
                    </button>
                    Geser untuk kolom lain
                    <button
                        type="button"
                        onClick={() => go(1)}
                        disabled={index === statuses.length - 1}
                        aria-label="Kolom berikutnya"
                        className="flex size-11 items-center justify-center rounded-full disabled:opacity-30"
                    >
                        <ChevronRight className="size-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
