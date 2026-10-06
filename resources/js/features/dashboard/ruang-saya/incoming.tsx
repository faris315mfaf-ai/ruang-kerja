import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn, focusRing } from '@/lib/utils';
import { incomingMeta } from './lib';
import type { IncomingItem, Lane } from './types';

/** Rows shown before "Tampilkan N lainnya". */
const PREVIEW = 4;

/**
 * "N tugas baru diberikan kepada Anda" (info tint): tasks someone else
 * assigned that are not planned yet; "Hari ini" / "Minggu ini" accept them
 * into a lane. The title opens the task.
 */
export function IncomingBox({
    items,
    today,
    onAccept,
    onOpen,
    variant = 'desktop',
}: {
    items: IncomingItem[];
    today: string;
    onAccept: (id: string, lane: Lane) => void;
    onOpen: (item: IncomingItem) => void;
    variant?: 'desktop' | 'mobile';
}) {
    const [expanded, setExpanded] = useState(false);

    if (items.length === 0) {
        return null;
    }

    const mobile = variant === 'mobile';
    const shown = expanded ? items : items.slice(0, PREVIEW);

    return (
        <section
            aria-labelledby="ruang-saya-incoming"
            className={cn(
                'flex flex-col gap-1 rounded-lg border border-info/20 bg-info-soft',
                mobile ? 'p-3' : 'px-4 py-3',
            )}
        >
            <h3
                id="ruang-saya-incoming"
                className="flex items-center gap-2 px-1 py-1 text-[16px] font-bold text-info"
            >
                <Inbox className="size-5 shrink-0" aria-hidden />
                {items.length} tugas baru diberikan kepada Anda
            </h3>
            <ul className={cn('flex flex-col', mobile ? 'gap-2' : 'gap-0.5')}>
                {shown.map((item) => (
                    <li
                        key={item.id}
                        className={cn(
                            'flex gap-x-3 gap-y-2',
                            mobile
                                ? 'flex-col rounded-[18px] border border-border bg-surface p-3.5'
                                : 'flex-wrap items-center rounded-control px-1 py-1.5',
                        )}
                    >
                        <button
                            type="button"
                            onClick={() => onOpen(item)}
                            className={cn(
                                'flex min-w-0 flex-col items-start gap-0.5 rounded-control text-left',
                                !mobile && 'flex-1 basis-72',
                                focusRing,
                            )}
                        >
                            <span className="flex w-full min-w-0 items-baseline gap-2">
                                <span className="shrink-0 font-mono text-[14px] font-semibold text-text">
                                    {item.key}
                                </span>
                                <span
                                    className={cn(
                                        'min-w-0 font-semibold text-text',
                                        mobile
                                            ? 'text-[17px] leading-[22px]'
                                            : 'truncate text-[16px]',
                                    )}
                                >
                                    {item.title}
                                </span>
                            </span>
                            <span className="text-meta text-text-muted">
                                {item.workspace.name} ·{' '}
                                {incomingMeta(item, today)}
                            </span>
                        </button>
                        <span
                            className={cn(
                                'flex shrink-0 gap-2',
                                mobile && '[&>*]:flex-1',
                            )}
                        >
                            <Button
                                size={mobile ? 'default' : 'sm'}
                                variant="tonal"
                                onClick={() => onAccept(item.id, 'today')}
                                aria-label={`Rencanakan ${item.key} hari ini`}
                            >
                                Hari ini
                            </Button>
                            <Button
                                size={mobile ? 'default' : 'sm'}
                                variant="outline"
                                onClick={() => onAccept(item.id, 'week')}
                                aria-label={`Rencanakan ${item.key} minggu ini`}
                            >
                                Minggu ini
                            </Button>
                        </span>
                    </li>
                ))}
            </ul>
            {items.length > PREVIEW && (
                <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    className={cn(
                        'self-start rounded-control px-1 py-2 text-[15px] font-semibold text-link',
                        focusRing,
                    )}
                >
                    {expanded
                        ? 'Tampilkan lebih sedikit'
                        : `Tampilkan ${items.length - PREVIEW} lainnya`}
                </button>
            )}
        </section>
    );
}
