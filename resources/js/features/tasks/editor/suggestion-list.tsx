import type { Ref } from 'react';
import { useImperativeHandle, useState } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { StatusIcon } from '@/components/status-icon';
import { cn } from '@/lib/utils';
import type { StatusCategory } from '../types';
import type { MentionSuggestion, TaskSuggestion } from './types';

export type SuggestionItem =
    | ({ kind: 'person' } & MentionSuggestion)
    | ({ kind: 'task' } & TaskSuggestion);

export type SuggestionListHandle = {
    onKeyDown: (event: KeyboardEvent) => boolean;
};

type Props = {
    items: SuggestionItem[];
    loading: boolean;
    kind: 'person' | 'task';
    command: (item: SuggestionItem) => void;
    ref?: Ref<SuggestionListHandle>;
};

/**
 * Popup list for "@" (people with access to the workspace) and "#" (tasks).
 * Arrow keys + Enter/Tab, rendered by the Tiptap suggestion plugin.
 */
export function SuggestionList({ items, loading, kind, command, ref }: Props) {
    const [selected, setSelected] = useState(0);
    const [prevItems, setPrevItems] = useState(items);

    if (prevItems !== items) {
        setPrevItems(items);
        setSelected(0);
    }

    useImperativeHandle(ref, () => ({
        onKeyDown: (event: KeyboardEvent) => {
            if (items.length === 0) {
                return false;
            }

            if (event.key === 'ArrowDown') {
                setSelected((index) => (index + 1) % items.length);

                return true;
            }

            if (event.key === 'ArrowUp') {
                setSelected(
                    (index) => (index - 1 + items.length) % items.length,
                );

                return true;
            }

            if (event.key === 'Enter' || event.key === 'Tab') {
                const item = items[selected];

                if (item) {
                    command(item);
                }

                return true;
            }

            return false;
        },
    }));

    return (
        <div
            role="listbox"
            aria-label={kind === 'person' ? 'Sebut rekan' : 'Rujuk tugas'}
            className="glass max-h-72 w-72 overflow-y-auto rounded-lg border border-border p-1 shadow-card"
        >
            {items.length === 0 ? (
                <p className="px-2.5 py-2 text-[13px] text-text-muted">
                    {loading
                        ? 'Mencari…'
                        : kind === 'person'
                          ? 'Tidak ada rekan dengan akses ke workspace ini.'
                          : 'Tugas tidak ditemukan.'}
                </p>
            ) : (
                items.map((item, index) => (
                    <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={index === selected}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => command(item)}
                        onMouseEnter={() => setSelected(index)}
                        className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-text',
                            index === selected && 'bg-surface-2',
                        )}
                    >
                        {item.kind === 'person' ? (
                            <>
                                <UserAvatar
                                    name={item.name}
                                    src={item.avatar}
                                    className="size-5 text-[9px]"
                                />
                                <span className="truncate">{item.name}</span>
                            </>
                        ) : (
                            <>
                                <StatusIcon
                                    category={
                                        item.status_category as StatusCategory
                                    }
                                />
                                <span className="font-mono text-xs text-text-muted">
                                    {item.key}
                                </span>
                                <span className="truncate">{item.title}</span>
                            </>
                        )}
                    </button>
                ))
            )}
        </div>
    );
}
