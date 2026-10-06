import { ArrowRightLeft, Check, Lock, MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn, focusRing } from '@/lib/utils';
import { duePill, LANE_LABELS, LANES } from './lib';
import type { Lane, PlannerItem } from './types';

/**
 * Round "centang selesai". Review first when the workspace has one ("Kirim
 * ke Review"), else Done. Without edit rights: a locked circle with the
 * reason (tooltip + screen-reader text). 44px hit area on phones.
 */
export function CompleteCheck({
    item,
    onComplete,
    size = 'md',
}: {
    item: PlannerItem;
    onComplete: (item: PlannerItem) => void;
    size?: 'md' | 'lg';
}) {
    const hit = size === 'lg' ? 'size-11' : 'size-9';
    const circle =
        'flex size-[26px] items-center justify-center rounded-full border-2 transition-[background-color,border-color,transform] duration-120 ease-brand';

    if (item.done) {
        return (
            <span
                className={cn('flex shrink-0 items-center justify-center', hit)}
            >
                <span
                    className={cn(
                        circle,
                        'border-0 bg-primary bg-grad-aksi text-on-brand',
                    )}
                >
                    <Check className="size-4" strokeWidth={3} aria-hidden />
                </span>
                <span className="sr-only">Selesai</span>
            </span>
        );
    }

    if (!item.can_complete) {
        const hint =
            item.complete_hint ??
            (item.pending ? 'Menyimpan…' : 'Tidak bisa ditandai selesai.');

        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        tabIndex={item.pending ? -1 : 0}
                        className={cn(
                            'flex shrink-0 items-center justify-center rounded-full',
                            hit,
                            focusRing,
                        )}
                    >
                        <span
                            className={cn(
                                circle,
                                'border-dashed border-border-strong text-text-subtle',
                            )}
                        >
                            {!item.pending && (
                                <Lock className="size-3" aria-hidden />
                            )}
                        </span>
                        <span className="sr-only">
                            {`Tidak bisa ditandai selesai: ${hint}`}
                        </span>
                    </span>
                </TooltipTrigger>
                <TooltipContent>{hint}</TooltipContent>
            </Tooltip>
        );
    }

    const label =
        item.completes_to === 'review'
            ? `Kirim ${item.key} ke Review`
            : `Tandai ${item.key} selesai`;

    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={false}
            aria-label={label}
            title={
                item.completes_to === 'review'
                    ? 'Kirim ke Review'
                    : 'Tandai selesai'
            }
            onClick={() => onComplete(item)}
            className={cn(
                'group flex shrink-0 items-center justify-center rounded-full',
                hit,
                focusRing,
            )}
        >
            <span
                className={cn(
                    circle,
                    'border-border-strong bg-surface group-hover:border-primary group-active:scale-90',
                )}
            >
                <Check
                    className="size-4 text-primary opacity-0 transition-opacity duration-120 ease-brand group-hover:opacity-60"
                    strokeWidth={3}
                    aria-hidden
                />
            </span>
        </button>
    );
}

/** Due pill of a card (none when undated or already done). */
export function DuePill({
    item,
    today,
    className,
}: {
    item: Pick<PlannerItem, 'due_date' | 'done'>;
    today: string;
    className?: string;
}) {
    const pill = item.done ? null : duePill(item.due_date, today);

    if (!pill) {
        return null;
    }

    return (
        <Badge
            variant="status"
            tone={pill.tone}
            className={cn('h-7 px-2.5 text-[14px]', className)}
        >
            {pill.text}
        </Badge>
    );
}

/**
 * "Pindahkan": the keyboard / screen-reader way to move a card (drag & drop
 * on desktop, swipe on phones are shortcuts for the same thing).
 */
export function MoveMenu({
    item,
    onPlan,
    onUnplan,
    triggerClassName,
}: {
    item: PlannerItem;
    onPlan: (id: string, lane: Lane) => void;
    onUnplan: (id: string) => void;
    triggerClassName?: string;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label={`Pindahkan ${item.key}`}
                    disabled={item.pending}
                    className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-[10px] text-text-muted transition-colors duration-120 ease-brand hover:bg-surface-2 hover:text-text disabled:opacity-40',
                        focusRing,
                        triggerClassName,
                    )}
                >
                    <MoreHorizontal className="size-5" aria-hidden />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
                <DropdownMenuLabel>Pindahkan ke</DropdownMenuLabel>
                {LANES.map((lane) => (
                    <DropdownMenuItem
                        key={lane}
                        disabled={!item.auto && item.lane === lane}
                        onSelect={() => onPlan(item.id, lane)}
                    >
                        <ArrowRightLeft aria-hidden />
                        {LANE_LABELS[lane]}
                        {!item.auto && item.lane === lane && (
                            <span className="ml-auto text-meta text-text-muted">
                                sekarang
                            </span>
                        )}
                    </DropdownMenuItem>
                ))}
                {!item.auto && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => onUnplan(item.id)}>
                            Kembalikan otomatis
                            <span className="ml-auto text-meta text-text-muted">
                                per tenggat
                            </span>
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** "OPS-142 · Operasional · Pribadi · terbawa dari kemarin · 2/5". */
export function CardMeta({ item }: { item: PlannerItem }) {
    return (
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-meta text-text-muted">
            <span className="font-mono text-[13px] font-semibold text-text">
                {item.key}
            </span>
            {!item.is_personal && (
                <span className="min-w-0 truncate">
                    · {item.workspace.name}
                </span>
            )}
            {item.is_personal && (
                <Badge
                    variant="label"
                    tone="neutral"
                    className="h-6 rounded-xs px-2 text-[13px]"
                >
                    Pribadi
                </Badge>
            )}
            {item.status.category === 'review' && !item.done && (
                <Badge
                    variant="label"
                    tone="info"
                    className="h-6 rounded-xs px-2 text-[13px]"
                >
                    Review
                </Badge>
            )}
            {item.checklist && (
                <span className="tnum">
                    · {item.checklist.done}/{item.checklist.total}
                </span>
            )}
            {item.carried && (
                <span className="font-semibold text-warning">
                    · terbawa dari kemarin
                </span>
            )}
        </span>
    );
}
