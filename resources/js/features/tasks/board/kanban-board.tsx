import type {
    DragEndEvent,
    DragOverEvent,
    DragStartEvent,
    KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import {
    closestCorners,
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    useDroppable,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { memo, useState } from 'react';
import { StatusIcon } from '@/components/status-icon';
import { cn, focusRing } from '@/lib/utils';
import { adjacentStatusId } from '../lib/board';
import type { TaskPresence, TaskPresenceMap } from '../realtime/board-presence';
import { presenceDescription } from '../realtime/card-presence';
import { TaskCardContent, taskCardClass } from '../task-card';
import type { Label, Person, Task, TaskStatus } from '../types';
import type { MoveTarget } from '../use-task-board';

/** Cards rendered per column before "Tampilkan lainnya" (500-task boards). */
const PAGE = 100;

const COLUMN_PREFIX = 'column:';

type Props = {
    statuses: TaskStatus[];
    /** Visible (filtered) task ids per status, in board order. */
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
    /** Who else has which task open (presence-workspace). */
    presence?: TaskPresenceMap;
};

function resolve<T>(ids: string[], map: Record<string, T>): T[] {
    return ids.flatMap((id) => (map[id] ? [map[id]] : []));
}

type CardProps = {
    task: Task;
    labelsById: Record<string, Label>;
    peopleById: Record<string, Person>;
    today: string;
    disabled: boolean;
    presence: TaskPresence | undefined;
    onOpen: (task: Task) => void;
    onShift: (task: Task, direction: -1 | 1) => void;
};

const SortableCard = memo(function SortableCard({
    task,
    labelsById,
    peopleById,
    today,
    disabled,
    presence,
    onOpen,
    onShift,
}: CardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: task.id,
        disabled,
    });

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (
            event.shiftKey &&
            (event.key === 'ArrowRight' || event.key === 'ArrowLeft')
        ) {
            event.preventDefault();
            onShift(task, event.key === 'ArrowRight' ? 1 : -1);

            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            onOpen(task);

            return;
        }

        listeners?.onKeyDown?.(event);
    };

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: transform
                    ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
                    : undefined,
                transition,
            }}
            {...attributes}
            {...listeners}
            onKeyDown={onKeyDown}
            onClick={() => onOpen(task)}
            data-task-id={task.id}
            aria-roledescription="Kartu tugas"
            aria-label={`${task.key} ${task.title}${presenceDescription(presence)}`}
            className={cn(
                taskCardClass(task, today),
                'cursor-pointer transition-colors duration-120 ease-brand [contain-intrinsic-size:auto_132px] [content-visibility:auto] hover:border-border-strong focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none',
                isDragging &&
                    'border-dashed border-primary/60 bg-primary/5 opacity-60 shadow-none [&>*]:invisible',
                disabled && 'cursor-default',
            )}
        >
            <TaskCardContent
                task={task}
                labels={resolve(task.label_ids, labelsById)}
                assignees={resolve(task.assignee_ids, peopleById)}
                today={today}
                presence={presence}
            />
        </div>
    );
});

type ColumnProps = {
    status: TaskStatus;
    ids: string[];
    total: number;
    highlighted: boolean;
    showDropSlot: boolean;
    canEdit: boolean;
    onCreate: (statusId: string) => void;
    renderCard: (id: string) => ReactNode;
};

function Column({
    status,
    ids,
    total,
    highlighted,
    showDropSlot,
    canEdit,
    onCreate,
    renderCard,
}: ColumnProps) {
    const { setNodeRef } = useDroppable({ id: `${COLUMN_PREFIX}${status.id}` });
    const [limit, setLimit] = useState(PAGE);
    const shown = ids.slice(0, limit);

    return (
        <section
            aria-label={`Kolom ${status.name}, ${ids.length} tugas`}
            className={cn(
                'flex w-[272px] shrink-0 flex-col gap-2.5 rounded-panel border border-border bg-surface-2/60 px-3 pt-4 pb-3 transition-colors duration-120 ease-brand dark:bg-surface/80',
                highlighted && 'border-primary/40 bg-primary/5',
            )}
        >
            <header className="flex items-center gap-2.5 px-1.5 pb-1">
                <StatusIcon
                    category={status.category}
                    color={status.color}
                    className="size-5"
                />
                <h2
                    className="truncate text-[17px] font-bold text-text"
                    title={status.name}
                >
                    {status.name}
                </h2>
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-surface px-2 text-[14px] font-bold text-text-muted tnum dark:bg-surface-2">
                    {ids.length === total ? total : `${ids.length}/${total}`}
                </span>
                {canEdit && (
                    <button
                        type="button"
                        onClick={() => onCreate(status.id)}
                        aria-label={`Tambah tugas di ${status.name}`}
                        className={cn(
                            'ml-auto flex size-9 items-center justify-center rounded-[10px] text-text-muted transition-colors duration-120 ease-brand hover:bg-surface hover:text-text dark:hover:bg-surface-2',
                            focusRing,
                        )}
                    >
                        <Plus className="size-5" strokeWidth={2.2} />
                    </button>
                )}
            </header>
            <div
                ref={setNodeRef}
                className="flex min-h-24 flex-1 flex-col gap-2.5"
            >
                <SortableContext
                    items={shown}
                    strategy={verticalListSortingStrategy}
                >
                    {shown.map(renderCard)}
                </SortableContext>
                {showDropSlot && (
                    <div
                        aria-hidden
                        className="h-20 rounded-[18px] border-2 border-dashed border-primary/50 bg-primary/5"
                    />
                )}
                {ids.length > limit && (
                    <button
                        type="button"
                        onClick={() => setLimit((value) => value + PAGE)}
                        className={cn(
                            'h-10 rounded-control text-[15px] font-semibold text-link transition-opacity duration-120 ease-brand hover:opacity-80',
                            focusRing,
                        )}
                    >
                        Tampilkan {Math.min(PAGE, ids.length - limit)} lainnya
                    </button>
                )}
                {ids.length === 0 && !showDropSlot && (
                    <p className="px-2 py-6 text-center text-meta text-text-muted">
                        {total === 0
                            ? 'Belum ada tugas'
                            : 'Tidak ada yang cocok dengan filter'}
                    </p>
                )}
            </div>
        </section>
    );
}

/** Space picks a card up and drops it; arrows move it (Enter stays "open"). */
const keyboardCodes = {
    start: ['Space'],
    cancel: ['Escape'],
    end: ['Space'],
};

const coordinates: KeyboardCoordinateGetter = (event, args) =>
    sortableKeyboardCoordinates(event, args);

/**
 * Desktop Kanban board (mockup Kanban, docs/DESIGN.md §6–§7): columns side by
 * side, drag & drop with dnd-kit (pointer + keyboard), lifted card overlay,
 * dashed drop slot, `Shift+←/→` moves the focused card to the next column.
 * Moves are optimistic (useTaskBoard) and roll back on failure.
 */
export function KanbanBoard({
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
    presence,
}: Props) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [overColumn, setOverColumn] = useState<string | null>(null);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: coordinates,
            keyboardCodes,
        }),
    );

    const columnOf = (id: string): string | null => {
        if (id.startsWith(COLUMN_PREFIX)) {
            return id.slice(COLUMN_PREFIX.length);
        }

        return byId[id]?.status_id ?? null;
    };

    const onShift = (task: Task, direction: -1 | 1) => {
        if (!canEdit) {
            return;
        }

        const target = adjacentStatusId(statuses, task.status_id, direction);

        if (target) {
            onMove(task.id, { statusId: target }, { announce: true });
            // The card remounts in the other column: keep keyboard focus on it.
            window.requestAnimationFrame(() => {
                document
                    .querySelector<HTMLElement>(`[data-task-id="${task.id}"]`)
                    ?.focus();
            });
        }
    };

    const onDragStart = (event: DragStartEvent) => {
        setActiveId(String(event.active.id));
    };

    const onDragOver = (event: DragOverEvent) => {
        setOverColumn(event.over ? columnOf(String(event.over.id)) : null);
    };

    const onDragEnd = (event: DragEndEvent) => {
        const taskId = String(event.active.id);
        const over = event.over;

        setActiveId(null);
        setOverColumn(null);

        if (!over) {
            return;
        }

        const overId = String(over.id);
        const statusId = columnOf(overId);

        if (!statusId) {
            return;
        }

        const ids = (columns[statusId] ?? []).filter((id) => id !== taskId);

        if (overId.startsWith(COLUMN_PREFIX) || overId === taskId) {
            // Dropped on the column itself: below the last visible card.
            if (overId !== taskId) {
                onMove(taskId, { statusId, afterId: ids.at(-1) ?? null });
            }

            return;
        }

        const overIndex = ids.indexOf(overId);
        const sameColumn = byId[taskId]?.status_id === statusId;
        const fullIndex = (columns[statusId] ?? []).indexOf(overId);
        const activeIndex = (columns[statusId] ?? []).indexOf(taskId);
        const translated = event.active.rect.current.translated;
        const below = sameColumn
            ? activeIndex !== -1 && activeIndex < fullIndex
            : translated !== null &&
              translated.top + translated.height / 2 >
                  over.rect.top + over.rect.height / 2;

        onMove(taskId, {
            statusId,
            afterId: below ? overId : (ids[overIndex - 1] ?? null),
            beforeId: below ? (ids[overIndex + 1] ?? null) : overId,
        });
    };

    const active = activeId ? byId[activeId] : null;
    const totals: Record<string, number> = {};

    for (const task of Object.values(byId)) {
        totals[task.status_id] = (totals[task.status_id] ?? 0) + 1;
    }

    const renderCard = (id: string) => {
        const task = byId[id];

        return task ? (
            <SortableCard
                key={id}
                task={task}
                labelsById={labelsById}
                peopleById={peopleById}
                today={today}
                disabled={!canEdit}
                presence={presence?.get(task.id)}
                onOpen={onOpen}
                onShift={onShift}
            />
        ) : null;
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={() => {
                setActiveId(null);
                setOverColumn(null);
            }}
            accessibility={{
                screenReaderInstructions: {
                    draggable:
                        'Tekan Spasi untuk mengangkat kartu, panah untuk memindahkan, Spasi lagi untuk meletakkan, Escape untuk batal. Shift+panah kiri/kanan memindahkan ke kolom sebelah. Enter membuka tugas.',
                },
                announcements: {
                    onDragStart: ({ active: item }) =>
                        `Mengangkat ${byId[String(item.id)]?.key ?? 'kartu'}.`,
                    onDragOver: ({ over }) =>
                        over ? 'Di atas posisi baru.' : 'Di luar area kolom.',
                    onDragEnd: ({ over }) =>
                        over ? 'Kartu dipindahkan.' : 'Kartu dikembalikan.',
                    onDragCancel: () => 'Pemindahan dibatalkan.',
                },
            }}
        >
            <div className="-mx-4 overflow-x-auto px-4 pb-4 lg:-mx-6 lg:px-6">
                <div className="flex min-w-max items-start gap-4">
                    {statuses.map((status) => (
                        <Column
                            key={status.id}
                            status={status}
                            ids={columns[status.id] ?? []}
                            total={totals[status.id] ?? 0}
                            highlighted={overColumn === status.id}
                            showDropSlot={
                                active !== null &&
                                overColumn === status.id &&
                                active.status_id !== status.id
                            }
                            canEdit={canEdit}
                            onCreate={onCreate}
                            renderCard={renderCard}
                        />
                    ))}
                </div>
            </div>
            <DragOverlay
                dropAnimation={{
                    duration: 180,
                    easing: 'cubic-bezier(.2,.8,.2,1)',
                }}
            >
                {active ? (
                    <div
                        className={cn(
                            taskCardClass(active, today),
                            'w-[246px] scale-[1.02] cursor-grabbing border-border-strong shadow-float',
                        )}
                    >
                        <TaskCardContent
                            task={active}
                            labels={resolve(active.label_ids, labelsById)}
                            assignees={resolve(active.assignee_ids, peopleById)}
                            today={today}
                        />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
