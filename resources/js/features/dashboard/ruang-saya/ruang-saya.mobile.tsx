import { CalendarClock, CalendarPlus, Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { Fab } from '@/components/mobile/fab';
import type { SwipeAction } from '@/components/mobile/swipeable-row';
import { SwipeableRow } from '@/components/mobile/swipeable-row';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { SegmentedTabs } from '@/components/ui/tabs';
import { cn, focusRing } from '@/lib/utils';
import { MobileCard } from '../dashboard-ui';
import { IncomingBox } from './incoming';
import {
    duePill,
    LANE_LABELS,
    LANES,
    LATER_PREVIEW,
    progressLabel,
    progressPercent,
    RUANG_SAYA_SUBTITLE,
    splitLane,
} from './lib';
import { CardMeta, CompleteCheck, MoveMenu } from './parts';
import { QuickAdd } from './quick-add';
import type { Lane, PlannerItem } from './types';
import type { RuangSaya } from './use-ruang-saya';

const DUE_TEXT = {
    danger: 'text-danger',
    warning: 'text-warning',
    success: 'text-success',
    info: 'text-info',
    link: 'text-link',
    neutral: 'text-text-muted',
} as const;

const EMPTY: Record<Lane, string> = {
    today: 'Belum ada rencana hari ini. Terima tugas baru atau tambah catatan.',
    week: 'Kosong. Tugas bertenggat minggu ini muncul di sini.',
    later: 'Tidak ada yang menunggu.',
};

type Open = (item: Pick<PlannerItem, 'id' | 'key' | 'number' | 'url'>) => void;

function Row({
    item,
    today,
    state,
    onOpen,
}: {
    item: PlannerItem;
    today: string;
    state: RuangSaya;
    onOpen: Open;
}) {
    const pill = item.done ? null : duePill(item.due_date, today);
    const content = (
        <div className="flex min-h-[70px] items-center gap-1 py-1.5 pr-1 pl-1">
            <CompleteCheck item={item} onComplete={state.complete} size="lg" />
            <button
                type="button"
                disabled={item.pending && item.url === ''}
                onClick={() => onOpen(item)}
                className={cn(
                    'flex min-w-0 flex-1 flex-col gap-1 rounded-control py-1 text-left',
                    focusRing,
                )}
            >
                <span
                    className={cn(
                        'text-[17px] leading-[22px] font-semibold text-text',
                        item.done && 'text-text-muted line-through',
                    )}
                >
                    {item.title}
                </span>
                <CardMeta item={item} />
            </button>
            {item.done ? (
                <Badge
                    variant="status"
                    tone="success"
                    className="h-7 px-2.5 text-[14px]"
                >
                    Selesai
                </Badge>
            ) : (
                pill && (
                    <span
                        className={cn(
                            'shrink-0 text-[14px] font-bold whitespace-nowrap',
                            DUE_TEXT[pill.tone],
                        )}
                    >
                        {pill.text}
                    </span>
                )
            )}
            {!item.done && (
                <MoveMenu
                    item={item}
                    onPlan={(id, lane) => state.plan(id, lane)}
                    onUnplan={state.unplan}
                    triggerClassName="size-11"
                />
            )}
        </div>
    );

    if (item.done || item.pending) {
        return content;
    }

    const leading: SwipeAction[] = item.can_complete
        ? [
              {
                  label: item.completes_to === 'review' ? 'Review' : 'Selesai',
                  tone: 'primary',
                  icon: Check,
                  onAction: () => state.complete(item),
              },
          ]
        : [];
    const trailing: SwipeAction[] =
        item.lane === 'today'
            ? [
                  {
                      label: 'Besok saja',
                      tone: 'info',
                      icon: CalendarClock,
                      onAction: () => state.plan(item.id, 'week'),
                  },
              ]
            : [
                  {
                      label: 'Hari ini',
                      tone: 'info',
                      icon: CalendarPlus,
                      onAction: () => state.plan(item.id, 'today'),
                  },
              ];

    return (
        <SwipeableRow actions={trailing} leadingActions={leading}>
            {content}
        </SwipeableRow>
    );
}

/**
 * Ruang saya on the phone (MSBeranda): progress, new assignments as cards,
 * lanes as tabs with counts, rows with a check (swipe right = selesai,
 * swipe left = "Besok saja"), and a FAB opening the personal quick add.
 */
export function RuangSayaMobile({
    state,
    onOpen,
}: {
    state: RuangSaya;
    onOpen: Open;
}) {
    const { planner } = state;
    const [lane, setLane] = useState<Lane>('today');
    const [expanded, setExpanded] = useState(false);
    const [adding, setAdding] = useState(false);
    const { open, done } = splitLane(planner.lanes[lane]);
    const shown =
        lane === 'later' && !expanded ? open.slice(0, LATER_PREVIEW) : open;
    const rows = [...shown, ...done];

    return (
        <section
            id="ruang-saya"
            aria-labelledby="ruang-saya-heading"
            className="flex scroll-mt-20 flex-col gap-2.5"
        >
            <div className="flex flex-col gap-1.5 px-1 pt-1">
                <div className="flex items-baseline justify-between gap-3">
                    <h2 id="ruang-saya-heading" className="text-h2">
                        Ruang saya
                    </h2>
                    <span className="text-[14px] font-semibold text-text-muted tnum">
                        {progressLabel(planner.progress)}
                    </span>
                </div>
                <Progress
                    value={progressPercent(planner.progress)}
                    label={progressLabel(planner.progress)}
                    tone="success"
                    size="sm"
                />
                <p className="text-meta text-text-muted">
                    {RUANG_SAYA_SUBTITLE}
                </p>
            </div>

            <IncomingBox
                items={planner.incoming}
                today={planner.today}
                onAccept={(id, target) => state.plan(id, target)}
                onOpen={onOpen}
                variant="mobile"
            />

            <SegmentedTabs
                label="Lajur Ruang saya"
                value={lane}
                onValueChange={(value) => {
                    setLane(value);
                    setExpanded(false);
                }}
                options={LANES.map((value) => ({
                    value,
                    id: `ruang-saya-tab-${value}`,
                    controls: 'ruang-saya-panel',
                    label: (
                        <>
                            {LANE_LABELS[value]}{' '}
                            <span className="tnum opacity-70">
                                {planner.counts[value]}
                            </span>
                        </>
                    ),
                }))}
                className="flex w-full [&>button]:h-11 [&>button]:flex-1 [&>button]:px-2"
            />

            <MobileCard
                id="ruang-saya-panel"
                role="tabpanel"
                aria-labelledby={`ruang-saya-tab-${lane}`}
            >
                {rows.length === 0 ? (
                    <p className="px-5 py-6 text-center text-[15px] text-text-muted">
                        {EMPTY[lane]}
                    </p>
                ) : (
                    <ul className="divide-y divide-divider">
                        {rows.map((item) => (
                            <li key={item.id}>
                                <Row
                                    item={item}
                                    today={planner.today}
                                    state={state}
                                    onOpen={onOpen}
                                />
                            </li>
                        ))}
                    </ul>
                )}
                {lane === 'later' && open.length > LATER_PREVIEW && (
                    <button
                        type="button"
                        onClick={() => setExpanded((value) => !value)}
                        className={cn(
                            'flex min-h-11 w-full items-center justify-center border-t border-divider text-[15px] font-semibold text-link',
                            focusRing,
                            'focus-visible:ring-inset',
                        )}
                    >
                        {expanded
                            ? 'Tampilkan lebih sedikit'
                            : `+${open.length - LATER_PREVIEW} lainnya`}
                    </button>
                )}
            </MobileCard>

            <Fab label="Tambah catatan pribadi" onClick={() => setAdding(true)}>
                <Plus className="size-7" strokeWidth={2.2} aria-hidden />
            </Fab>
            <BottomSheet
                open={adding}
                onOpenChange={setAdding}
                title="Catatan pribadi"
            >
                <QuickAdd
                    onAdd={state.add}
                    lane={lane}
                    autoFocus
                    stacked
                    onDone={() => setAdding(false)}
                />
            </BottomSheet>
        </section>
    );
}
