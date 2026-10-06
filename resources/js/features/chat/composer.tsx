import { AtSign, Paperclip, SendHorizontal } from 'lucide-react';
import type { KeyboardEvent, Ref } from 'react';
import { useId, useImperativeHandle, useRef, useState } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { StatusIcon } from '@/components/status-icon';
import type { StatusCategory } from '@/features/tasks/types';
import { cn, focusRing } from '@/lib/utils';
import { AttachmentCard } from './attachment-card';
import { DrivePicker } from './drive-picker';
import { applySuggestion, findTrigger, matchPeople, matchTasks } from './lib';
import type { Trigger } from './lib';
import type { ChatState, MessageAttachment } from './types';

export type ComposerHandle = { focus: () => void };

type Props = {
    state: ChatState;
    placeholder: string;
    onSend: (text: string, attachments: MessageAttachment[]) => void;
    variant: 'desktop' | 'mobile';
    /** Shorter box (thread panel). */
    compact?: boolean;
    autoFocus?: boolean;
    ref?: Ref<ComposerHandle>;
};

type Suggestion =
    | {
          kind: 'person';
          id: string;
          label: string;
          insert: string;
          name: string;
      }
    | {
          kind: 'task';
          id: string;
          label: string;
          insert: string;
          title: string;
          category: string;
      };

function suggestionsFor(
    trigger: Trigger | null,
    state: ChatState,
): Suggestion[] {
    if (!trigger) {
        return [];
    }

    if (trigger.char === '@') {
        return matchPeople(state.people, trigger.query, state.viewerId).map(
            (person) => ({
                kind: 'person',
                id: person.id,
                label: person.name,
                insert: `@${person.name}`,
                name: person.name,
            }),
        );
    }

    return matchTasks(state.tasks, trigger.query).map((task) => ({
        kind: 'task',
        id: task.id,
        label: task.key,
        insert: task.key,
        title: task.title,
        category: task.status_category,
    }));
}

/**
 * Message box: Enter sends, Shift+Enter adds a line; "@" suggests people,
 * "#" suggests tasks (arrow keys + Enter/Tab, Esc closes); Drive files can be
 * attached. Text becomes Tiptap JSON on send (lib.parseMessage).
 */
export function Composer({
    state,
    placeholder,
    onSend,
    variant,
    compact = false,
    autoFocus = false,
    ref,
}: Props) {
    const mobile = variant === 'mobile';
    const listId = useId();
    const textarea = useRef<HTMLTextAreaElement>(null);
    const [text, setText] = useState('');
    const [caret, setCaret] = useState(0);
    const [files, setFiles] = useState<MessageAttachment[]>([]);
    const [highlight, setHighlight] = useState(0);
    const [dismissedAt, setDismissedAt] = useState<number | null>(null);
    const [picking, setPicking] = useState(false);

    useImperativeHandle(ref, () => ({
        focus: () => textarea.current?.focus(),
    }));

    const trigger = findTrigger(text, caret);
    const suggestions = suggestionsFor(trigger, state);
    const open =
        trigger !== null &&
        dismissedAt !== trigger.start &&
        suggestions.length > 0;
    const active = Math.min(highlight, Math.max(0, suggestions.length - 1));

    const sync = (value: string, position: number) => {
        setText(value);
        setCaret(position);
        setHighlight(0);
    };

    const choose = (suggestion: Suggestion) => {
        if (!trigger) {
            return;
        }

        const next = applySuggestion(text, trigger, caret, suggestion.insert);
        sync(next.text, next.caret);
        requestAnimationFrame(() => {
            textarea.current?.focus();
            textarea.current?.setSelectionRange(next.caret, next.caret);
        });
    };

    const send = () => {
        if (text.trim() === '' && files.length === 0) {
            return;
        }

        onSend(text, files);
        setText('');
        setCaret(0);
        setFiles([]);
        setDismissedAt(null);
    };

    const startMention = () => {
        const element = textarea.current;
        const position = element?.selectionStart ?? text.length;
        const before = text.slice(0, position);
        const insert = before === '' || /\s$/.test(before) ? '@' : ' @';
        const next = `${before}${insert}${text.slice(position)}`;
        const nextCaret = position + insert.length;
        sync(next, nextCaret);
        setDismissedAt(null);
        requestAnimationFrame(() => {
            element?.focus();
            element?.setSelectionRange(nextCaret, nextCaret);
        });
    };

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.nativeEvent.isComposing) {
            return;
        }

        if (open) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const step = event.key === 'ArrowDown' ? 1 : -1;
                setHighlight(
                    (active + step + suggestions.length) % suggestions.length,
                );

                return;
            }

            if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                choose(suggestions[active]);

                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setDismissedAt(trigger?.start ?? null);

                return;
            }
        }

        // Phones: Enter adds a line (the send button is right there).
        if (event.key === 'Enter' && !event.shiftKey && !mobile) {
            event.preventDefault();
            send();
        }
    };

    const canSend = text.trim() !== '' || files.length > 0;
    const iconButton = cn(
        'flex shrink-0 items-center justify-center rounded-full text-text-muted transition-colors duration-120 ease-brand hover:bg-surface-2 hover:text-text',
        mobile ? 'size-11' : 'size-9',
        focusRing,
    );

    return (
        <div className="relative">
            {open && (
                <ul
                    id={listId}
                    role="listbox"
                    aria-label={
                        trigger?.char === '@' ? 'Sebut rekan' : 'Rujuk tugas'
                    }
                    className="glass-strong absolute bottom-full left-0 z-20 mb-2 max-h-72 w-full max-w-80 overflow-y-auto rounded-lg border border-border p-1 shadow-float"
                >
                    {suggestions.map((suggestion, index) => (
                        <li
                            key={suggestion.id}
                            id={`${listId}-${index}`}
                            role="option"
                            aria-selected={index === active}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => choose(suggestion)}
                            onMouseEnter={() => setHighlight(index)}
                            className={cn(
                                'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-control px-2.5 text-[15px] text-text',
                                index === active && 'bg-surface-2',
                            )}
                        >
                            {suggestion.kind === 'person' ? (
                                <>
                                    <UserAvatar
                                        name={suggestion.name}
                                        className="size-7 text-[11px]"
                                    />
                                    <span className="truncate">
                                        {suggestion.name}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <StatusIcon
                                        category={
                                            suggestion.category as StatusCategory
                                        }
                                    />
                                    <span className="font-mono text-meta text-text-muted">
                                        {suggestion.label}
                                    </span>
                                    <span className="truncate">
                                        {suggestion.title}
                                    </span>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            <div
                className={cn(
                    'flex flex-col gap-2 rounded-lg border border-border-strong bg-surface p-2 transition-[border-color,box-shadow] duration-120 ease-brand focus-within:border-primary focus-within:ring-4 focus-within:ring-ring/55',
                )}
            >
                {files.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-1 pt-1">
                        {files.map((file) => (
                            <AttachmentCard
                                key={file.id}
                                file={file}
                                className="max-w-[280px]"
                                onRemove={() =>
                                    setFiles((current) =>
                                        current.filter(
                                            (item) => item.id !== file.id,
                                        ),
                                    )
                                }
                            />
                        ))}
                    </div>
                )}
                <div className="flex items-end gap-1">
                    <button
                        type="button"
                        className={iconButton}
                        aria-label="Lampirkan dari Drive"
                        onClick={() => setPicking(true)}
                    >
                        <Paperclip className="size-5" aria-hidden />
                    </button>
                    {!mobile && (
                        <button
                            type="button"
                            className={iconButton}
                            aria-label="Sebut rekan"
                            onClick={startMention}
                        >
                            <AtSign className="size-5" aria-hidden />
                        </button>
                    )}
                    <textarea
                        ref={textarea}
                        value={text}
                        rows={1}
                        autoFocus={autoFocus}
                        aria-label={placeholder}
                        placeholder={placeholder}
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={open}
                        aria-controls={open ? listId : undefined}
                        aria-activedescendant={
                            open ? `${listId}-${active}` : undefined
                        }
                        onChange={(event) =>
                            sync(
                                event.target.value,
                                event.target.selectionStart,
                            )
                        }
                        onSelect={(event) =>
                            setCaret(event.currentTarget.selectionStart)
                        }
                        onKeyDown={onKeyDown}
                        className={cn(
                            'field-sizing-content min-h-11 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2.5 text-[16px] leading-6 text-text outline-none placeholder:text-text-subtle',
                            compact ? 'max-h-32' : 'max-h-44',
                        )}
                    />
                    <button
                        type="button"
                        onClick={send}
                        disabled={!canSend}
                        aria-label="Kirim"
                        className={cn(
                            'flex shrink-0 items-center justify-center rounded-full bg-primary bg-grad-aksi text-on-brand shadow-button transition-[opacity,transform] duration-120 ease-brand active:scale-95 disabled:bg-surface-2 disabled:bg-none disabled:text-text-subtle disabled:shadow-none',
                            mobile ? 'size-11' : 'size-9',
                            focusRing,
                        )}
                    >
                        <SendHorizontal className="size-[18px]" aria-hidden />
                    </button>
                </div>
            </div>
            {!mobile && !compact && (
                <p className="mt-1.5 px-1 text-[13px] text-text-muted">
                    <kbd className="font-sans font-semibold">Enter</kbd> kirim ·{' '}
                    <kbd className="font-sans font-semibold">Shift+Enter</kbd>{' '}
                    baris baru ·{' '}
                    <kbd className="font-sans font-semibold">@</kbd> sebut ·{' '}
                    <kbd className="font-sans font-semibold">#</kbd> rujuk tugas
                </p>
            )}
            <DrivePicker
                open={picking}
                onOpenChange={setPicking}
                files={state.driveFiles.filter(
                    (file) => !files.some((item) => item.id === file.id),
                )}
                onPick={(picked) =>
                    setFiles((current) => [...current, ...picked])
                }
                mobile={mobile}
            />
        </div>
    );
}
