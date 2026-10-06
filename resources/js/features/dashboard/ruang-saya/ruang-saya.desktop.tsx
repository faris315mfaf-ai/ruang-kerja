import type {
    DragEndEvent,
    DragOverEvent,
    DragStartEvent,
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
import { CalendarCheck, CalendarDays, GripVertical, Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { memo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import { Progress } from '@/components/ui/progress';
import { cn, focusRing } from '@/lib/utils';
import { IncomingBox } from './incoming';
import {
    LANE_LABELS,
    LANES,
    LATER_PREVIEW,
    progressLabel,
    progressPercent,
    RUANG_SAYA_SUBTITLE,
    splitLane,
} from './lib';
import { CardMeta, CompleteCheck, DuePill, MoveMenu } from './parts';
import { QuickAdd } from './quick-add';
import type { IncomingItem, Lane, PlannerItem } from './types';
import type { RuangSaya } from './use-ruang-saya';

const LANE_PREFIX = 'lane:';

const EMPTY: Record<Lane, { icon: LucideIcon; text: string }> = {
    today: {
        icon: CalendarCheck,
        text: 'Belum ada rencana hari ini. Seret tugas ke sini atau tambah catatan.',
    },
    week: {
        icon: CalendarDays,
        text: 'Kosong. Tugas bertenggat minggu ini muncul di sini.',
    },
    later: {
        icon: Inbox,
        text: 'Tidak ada yang menunggu. Tugas tanpa tenggat masuk ke sini.',
    },
};

type CardActions = {
    today: string;
    onComplete: (item: PlannerItem) => void;
    onOpen: (item: Pick<PlannerItem, 'id' | 'key' | 'number' | 'url'>) => void;
    onPlan: (id: string, lane: Lane) => void;
    onUnplan: (id: string) => void;
};

function CardBody({
    item,
    actions,
    handle,
}: {
    item: PlannerItem;
    actions: CardActions;
    handle?: ReactNode;
}) {
    return (
        <>
            <CompleteCheck item={item} onComplete={actions.onComplete} />
            <span className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
                <button
                    type="button"
                    disabled={item.pending && item.url === ''}
                    onClick={() => actions.onOpen(item)}
                    className={cn(
                        'w-fit max-w-full rounded-xs text-left text-[16px] leading-[22px] font-semibold text-text hover:text-link',
                        item.done && 'text-text-muted line-through',
                        focusRing,
                    )}
                >
                    {item.title}
                </button>
                <CardMeta item={item} />
                {(item.done || item.due_date) && (
                    <span className="flex flex-wrap gap-1.5">
                        {item.done ? (
                            <Badge
                                variant="status"
                                tone="success"
                                dot
                                className="h-7 px-2.5 text-[14px]"
                            >
                                Selesai
                            </Badge>
                        ) : (
                            <DuePill item={item} today={actions.today} />
                        )}
                    </span>
                )}
            </span>
            {!item.done && (
                <span className="-mr-1 flex flex-col items-center">
                    <MoveMenu
                        item={item}
                        onPlan={actions.onPlan}
                        onUnplan={actions.onUnplan}
                    />
                    {handle}
                </span>
            )}
        </>
    );
}

const CARD =
    'flex items-start gap-1.5 rounded-lg border border-border bg-surface py-2 pr-2 pl-1 shadow-card transition-[border-color,opacity] duration-120 ease-brand';

const SortableCard = memo(function SortableCard({
    item,
    actions,
}: {
    item: PlannerItem;
    actions: CardActions;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id, disabled: item.pending });

    return (
        <li
            ref={setNodeRef}
            data-plan-id={item.id}
            style={{
                transform: transform
                    ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
                    : undefined,
                transition,
            }}
            onPointerDown={(event) => listeners?.onPointerDown?.(event)}
            className={cn(
                CARD,
                'cursor-grab hover:border-border-strong',
                item.pending && 'opacity-70',
                isDragging &&
                    'border-dashed border-primary/60 bg-primary/5 opacity-60 shadow-none [&>*]:invisible',
            )}
        >
            <CardBody
                item={item}
                actions={actions}
                handle={
                    <button
                        type="button"
                        ref={setActivatorNodeRef}
                        {...attributes}
                        onKeyDown={(event) => listeners?.onKeyDown?.(event)}
                        aria-roledescription="Kartu yang bisa diseret"
                        aria-label={`Seret ${item.key}`}
                        className={cn(
                            'flex size-9 items-center justify-center rounded-[10px] text-text-subtle hover:bg-surface-2 hover:text-text',
                            focusRing,
                        )}
                    >
                        <GripVertical className="size-4" aria-hidden />
                    </button>
                }
            />
        </li>
    );
});

function LaneColumn({
    lane,
    items,
    count,
    highlighted,
    actions,
}: {
    lane: Lane;
    items: PlannerItem[];
    count: number;
    highlighted: boolean;
    actions: CardActions;
}) {
    const { setNodeRef } = useDroppable({ id: `${LANE_PREFIX}${lane}` });
    const [expanded, setExpanded] = useState(false);
    const { open, done } = splitLane(items);
    const limit = lane === 'later' && !expanded ? LATER_PREVIEW : open.length;
    const shown = open.slice(0, limit);
    const hidden = open.length - shown.length;
    const Empty = EMPTY[lane];

    return (
        <section
            aria-label={`${LANE_LABELS[lane]}, ${count} tugas`}
            className={cn(
                'flex min-w-0 flex-col gap-2.5 rounded-[20px] border border-border bg-surface-2/60 p-3 transition-colors duration-120 ease-brand dark:bg-background/60',
                highlighted && 'border-primary/40 bg-primary/5',
            )}
        >
            <header className="flex items-center gap-2 px-1.5 pt-0.5">
                <h3 className="text-[17px] font-bold text-text">
                    {LANE_LABELS[lane]}
                </h3>
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-surface px-2 text-[14px] font-bold text-text-muted tnum dark:bg-surface-2">
                    {count}
                </span>
            </header>
            <ul ref={setNodeRef} className="flex min-h-24 flex-col gap-2">
                <SortableContext
                    items={shown.map((item) => item.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {shown.map((item) => (
                        <SortableCard
                            key={item.id}
                            item={item}
                            actions={actions}
                        />
                    ))}
                </SortableContext>
                {open.length === 0 && (
                    <li className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong px-3 py-5 text-center text-meta text-text-muted">
                        <Empty.icon
                            className="size-5 text-text-subtle"
                            aria-hidden
                        />
                        {Empty.text}
                    </li>
                )}
                {done.map((item) => (
                    <li
                        key={item.id}
                        className={cn(CARD, 'bg-surface/70 shadow-none')}
                    >
                        <CardBody item={item} actions={actions} />
                    </li>
                ))}
            </ul>
            {lane === 'later' && open.length > LATER_PREVIEW && (
                <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    className={cn(
                        'h-10 rounded-control text-[15px] font-semibold text-link transition-opacity duration-120 ease-brand hover:opacity-80',
                        focusRing,
                    )}
                >
                    {hidden > 0
                        ? `+${hidden} lainnya`
                        : 'Tampilkan lebih sedikit'}
                </button>
            )}
        </section>
    );
}

/**
 * Ruang saya, desktop & tablet (Beranda): progress, new assignments, three
 * lanes with drag & drop (pointer, or the grip + Space/arrows; the "⋯"
 * menu is the plain keyboard path), and the personal quick add.
 */
export function RuangSayaDesktop({
    state,
    onOpen,
}: {
    state: RuangSaya;
    onOpen: (item: Pick<PlannerItem, 'id' | 'key' | 'number' | 'url'>) => void;
}) {
    const { planner } = state;
    const [activeId, setActiveId] = useState<string | null>(null);
    const [overLane, setOverLane] = useState<Lane | null>(null);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const laneOf = (id: string): Lane | null => {
        if (id.startsWith(LANE_PREFIX)) {
            return id.slice(LANE_PREFIX.length) as Lane;
        }

        return (
            LANES.find((lane) =>
                planner.lanes[lane].some((item) => item.id === id),
            ) ?? null
        );
    };

    const all = LANES.flatMap((lane) => planner.lanes[lane]);
    const active = activeId ? all.find((item) => item.id === activeId) : null;

    const onDragStart = (event: DragStartEvent) => {
        setActiveId(String(event.active.id));
    };

    const onDragOver = (event: DragOverEvent) => {
        setOverLane(event.over ? laneOf(String(event.over.id)) : null);
    };

    const onDragEnd = (event: DragEndEvent) => {
        const id = String(event.active.id);
        const over = event.over;
        setActiveId(null);
        setOverLane(null);

        if (!over) {
            return;
        }

        const overId = String(over.id);
        const lane = laneOf(overId);
        const from = laneOf(id);

        if (!lane || overId === id) {
            return;
        }

        const lanes = splitLane(planner.lanes[lane]).open;
        const others = lanes.filter((item) => item.id !== id);

        if (overId.startsWith(LANE_PREFIX)) {
            // Dropped on the lane itself: at the end of the planned part.
            if (from !== lane) {
                state.plan(id, lane);
            }

            return;
        }

        const overIndex = others.findIndex((item) => item.id === overId);

        if (overIndex === -1) {
            return;
        }

        const sameLane = from === lane;
        const activeIndex = lanes.findIndex((item) => item.id === id);
        const fullIndex = lanes.findIndex((item) => item.id === overId);
        const translated = event.active.rect.current.translated;
        const below = sameLane
            ? activeIndex !== -1 && activeIndex < fullIndex
            : translated !== null &&
              translated.top + translated.height / 2 >
                  over.rect.top + over.rect.height / 2;

        state.plan(id, lane, below ? overIndex + 1 : overIndex);
    };

    const actions: CardActions = {
        today: planner.today,
        onComplete: state.complete,
        onOpen,
        onPlan: (id, lane) => state.plan(id, lane),
        onUnplan: state.unplan,
    };

    return (
        <Panel
            id="ruang-saya"
            title="Ruang saya"
            className="scroll-mt-24"
            action={
                <div className="flex min-w-56 flex-col gap-1.5 pt-1 md:items-end">
                    <span className="text-[15px] font-semibold text-text-muted tnum">
                        {progressLabel(planner.progress)}
                    </span>
                    <Progress
                        value={progressPercent(planner.progress)}
                        label={progressLabel(planner.progress)}
                        tone="success"
                        size="sm"
                        className="w-full md:w-56"
                    />
                </div>
            }
            bodyClassName="gap-4"
        >
            <p className="-mt-2 text-[15px] text-text-muted">
                {RUANG_SAYA_SUBTITLE}
            </p>

            <IncomingBox
                items={planner.incoming}
                today={planner.today}
                onAccept={(id, lane) => state.plan(id, lane)}
                onOpen={(item: IncomingItem) => onOpen(item)}
            />

            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
                onDragCancel={() => {
                    setActiveId(null);
                    setOverLane(null);
                }}
                accessibility={{
                    screenReaderInstructions: {
                        draggable:
                            'Tekan Spasi untuk mengangkat kartu, panah untuk memindahkan, Spasi lagi untuk meletakkan, Escape untuk batal. Menu Pindahkan juga memindahkan kartu.',
                    },
                    announcements: {
                        onDragStart: () => 'Kartu diangkat.',
                        onDragOver: ({ over }) =>
                            over
                                ? `Di atas ${LANE_LABELS[laneOf(String(over.id)) ?? 'today']}.`
                                : 'Di luar lajur.',
                        onDragEnd: ({ over }) =>
                            over ? 'Kartu dipindahkan.' : 'Kartu dikembalikan.',
                        onDragCancel: () => 'Pemindahan dibatalkan.',
                    },
                }}
            >
                <div className="grid gap-3 md:grid-cols-3">
                    {LANES.map((lane) => (
                        <LaneColumn
                            key={lane}
                            lane={lane}
                            items={planner.lanes[lane]}
                            count={planner.counts[lane]}
                            highlighted={
                                active !== null &&
                                active !== undefined &&
                                overLane === lane &&
                                active.lane !== lane
                            }
                            actions={actions}
                        />
                    ))}
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
                                CARD,
                                'scale-[1.02] cursor-grabbing border-border-strong shadow-float',
                            )}
                        >
                            <CardBody item={active} actions={actions} />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            <div className="border-t border-divider pt-4">
                <QuickAdd onAdd={state.add} />
            </div>
        </Panel>
    );
}
