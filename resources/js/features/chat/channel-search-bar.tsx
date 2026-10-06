import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn, focusRing } from '@/lib/utils';
import type { Conversation } from './use-conversation';

/** Search inside the open channel: highlight, count, previous/next. */
export function ChannelSearchBar({
    search,
    mobile = false,
}: {
    search: Conversation['search'];
    mobile?: boolean;
}) {
    const button = cn(
        'flex shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40',
        mobile ? 'size-11' : 'size-9',
        focusRing,
    );
    const hasQuery = search.query.trim() !== '';

    return (
        <div
            role="search"
            className="flex items-center gap-1.5"
            onKeyDown={(event) => {
                if (event.key === 'Escape') {
                    event.stopPropagation();
                    search.setOpen(false);
                }
            }}
        >
            <label className="relative min-w-0 flex-1">
                <span className="sr-only">Cari di obrolan ini</span>
                <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-text-subtle"
                />
                <Input
                    type="search"
                    autoFocus
                    value={search.query}
                    onChange={(event) => search.setQuery(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            search.jump(event.shiftKey ? -1 : 1);
                        }
                    }}
                    placeholder="Cari di obrolan ini"
                    className="pl-10"
                />
            </label>
            <span
                aria-live="polite"
                className="min-w-16 shrink-0 text-center text-[14px] text-text-muted tnum"
            >
                {hasQuery
                    ? search.count === 0
                        ? '0 hasil'
                        : `${search.cursor + 1}/${search.count}`
                    : ''}
            </span>
            <button
                type="button"
                className={button}
                aria-label="Hasil sebelumnya"
                disabled={search.count === 0}
                onClick={() => search.jump(-1)}
            >
                <ChevronUp className="size-5" aria-hidden />
            </button>
            <button
                type="button"
                className={button}
                aria-label="Hasil berikutnya"
                disabled={search.count === 0}
                onClick={() => search.jump(1)}
            >
                <ChevronDown className="size-5" aria-hidden />
            </button>
            <button
                type="button"
                className={button}
                aria-label="Tutup pencarian"
                onClick={() => search.setOpen(false)}
            >
                <X className="size-5" aria-hidden />
            </button>
        </div>
    );
}
