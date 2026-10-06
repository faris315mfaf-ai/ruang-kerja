import {
    CheckCheck,
    Copy,
    MessageSquareText,
    MoreHorizontal,
    Pencil,
    SmilePlus,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Reactions } from '@/features/tasks/detail/reactions';
import { RichTextView } from '@/features/tasks/editor/rich-text-view';
import { formatDateTime } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { AttachmentCard } from './attachment-card';
import {
    clockTime,
    personById,
    REACTION_EMOJI,
    referenceMap,
    threadSummary,
} from './lib';
import type { MessageRun } from './lib';
import { deleteMessage, editMessage, reactToMessage } from './store';
import type { ChatState, Message } from './types';

export type RunHandlers = {
    /** Open the thread of a top-level message. */
    onOpenThread?: (message: Message) => void;
    /** Phones: tap a message to open its action sheet. */
    onOpenActions?: (message: Message) => void;
};

type Props = RunHandlers & {
    run: MessageRun;
    state: ChatState;
    variant: 'desktop' | 'mobile';
    /** Message ids matching the in-channel search. */
    matches?: Set<string>;
    /** message id → "Dibaca Sari, Maya" (viewer's latest message only). */
    receipts?: Record<string, string>;
    /** Inside a thread: no "N balasan" row. */
    inThread?: boolean;
};

/** Confirm before deleting (Hapus pesan). */
export function DeleteMessageDialog({
    message,
    onOpenChange,
}: {
    message: Message | null;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Dialog open={message !== null} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Hapus pesan?</DialogTitle>
                    <DialogDescription>
                        Pesan diganti dengan “Pesan ini dihapus” untuk semua
                        anggota. Balasan di thread tetap ada.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="quiet" onClick={() => onOpenChange(false)}>
                        Batal
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => {
                            if (message) {
                                deleteMessage(message.id);
                                toast.success('Pesan dihapus.');
                            }

                            onOpenChange(false);
                        }}
                    >
                        Hapus
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function EditBox({
    message,
    onDone,
}: {
    message: Message;
    onDone: () => void;
}) {
    const [draft, setDraft] = useState(message.body_text);
    const save = () => {
        if (draft.trim() !== '' && draft.trim() !== message.body_text) {
            editMessage(message.id, draft);
        }

        onDone();
    };

    return (
        <div className="mt-1 flex flex-col gap-2">
            <textarea
                value={draft}
                autoFocus
                aria-label="Sunting pesan"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        save();
                    }

                    if (event.key === 'Escape') {
                        event.preventDefault();
                        event.stopPropagation();
                        onDone();
                    }
                }}
                className="field-sizing-content min-h-11 w-full resize-none rounded-control border border-border-strong bg-surface px-3 py-2 text-[16px] leading-6 text-text outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-ring/55"
            />
            <div className="flex items-center gap-2">
                <Button size="sm" onClick={save}>
                    Simpan
                </Button>
                <Button size="sm" variant="quiet" onClick={onDone}>
                    Batal
                </Button>
                <span className="text-[13px] text-text-muted">
                    Enter simpan · Esc batal
                </span>
            </div>
        </div>
    );
}

/** Body, attachments, reactions and thread row of one message. */
export function MessageBody({
    message,
    state,
    variant,
    match = false,
    receipt,
    inThread = false,
    editing = false,
    onDoneEditing,
    onOpenThread,
}: {
    message: Message;
    state: ChatState;
    variant: 'desktop' | 'mobile';
    match?: boolean;
    receipt?: string;
    inThread?: boolean;
    editing?: boolean;
    onDoneEditing?: () => void;
    onOpenThread?: (message: Message) => void;
}) {
    const mobile = variant === 'mobile';

    if (message.deleted_at) {
        return (
            <p className="flex items-center gap-2 text-[15px] text-text-muted italic">
                <Trash2 className="size-4 shrink-0" aria-hidden />
                Pesan ini dihapus.
            </p>
        );
    }

    const thread = inThread ? null : threadSummary(message.id, state.messages);
    const references = referenceMap(state.tasks);

    return (
        <div className="flex min-w-0 flex-col gap-2">
            {editing && onDoneEditing ? (
                <EditBox message={message} onDone={onDoneEditing} />
            ) : (
                message.body && (
                    <div
                        className={cn(
                            match &&
                                '-mx-1.5 rounded-control bg-warning-soft/70 px-1.5',
                        )}
                    >
                        <RichTextView
                            doc={message.body}
                            references={references}
                            className={cn(
                                mobile
                                    ? 'text-[17px] leading-[26px]'
                                    : 'text-[16px] leading-6',
                            )}
                        />
                        {message.edited_at && (
                            <span
                                className="text-[13px] text-text-muted"
                                title={`Disunting ${formatDateTime(message.edited_at)}`}
                            >
                                (disunting)
                            </span>
                        )}
                    </div>
                )
            )}

            {message.attachments.length > 0 && (
                <div className="flex flex-col gap-2">
                    {message.attachments.map((file) => (
                        <AttachmentCard key={file.id} file={file} />
                    ))}
                </div>
            )}

            {message.reactions.length > 0 && (
                <Reactions
                    groups={message.reactions.map((reaction) => ({
                        emoji: reaction.emoji,
                        count: reaction.user_ids.length,
                        user_ids: reaction.user_ids,
                        names: reaction.user_ids.map((id) =>
                            id === state.viewerId
                                ? 'Anda'
                                : (personById(state.people, id)?.name ?? ''),
                        ),
                    }))}
                    available={REACTION_EMOJI}
                    viewerId={state.viewerId}
                    canReact
                    mobile={mobile}
                    onToggle={(emoji) => reactToMessage(message.id, emoji)}
                />
            )}

            {thread && thread.count > 0 && onOpenThread && (
                <button
                    type="button"
                    onClick={() => onOpenThread(message)}
                    className={cn(
                        '-ml-1.5 flex w-fit items-center gap-2 rounded-control px-1.5 text-[14px] font-semibold text-link transition-colors duration-120 ease-brand hover:bg-link-soft',
                        mobile ? 'min-h-11' : 'min-h-9',
                        focusRing,
                    )}
                >
                    <span className="flex -space-x-1.5" aria-hidden>
                        {thread.participantIds.slice(0, 3).map((id) => (
                            <UserAvatar
                                key={id}
                                name={personById(state.people, id)?.name ?? ''}
                                className="size-6 text-[10px] ring-2 ring-surface"
                            />
                        ))}
                    </span>
                    {thread.count} balasan
                    {thread.lastAt && (
                        <span className="font-medium text-text-muted">
                            · terakhir {clockTime(thread.lastAt)}
                        </span>
                    )}
                </button>
            )}

            {receipt && (
                <p className="flex items-center gap-1.5 text-[13px] text-text-muted">
                    <CheckCheck
                        aria-hidden
                        className={cn(
                            'size-4',
                            receipt === 'Terkirim'
                                ? 'text-text-subtle'
                                : 'text-link',
                        )}
                    />
                    {receipt}
                </p>
            )}
        </div>
    );
}

/** Hover/focus toolbar of a message on desktop (never the only way: menu). */
function MessageToolbar({
    message,
    mine,
    inThread,
    onReply,
    onEdit,
    onDelete,
}: {
    message: Message;
    mine: boolean;
    inThread: boolean;
    onReply?: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const button = cn(
        'flex size-8 items-center justify-center rounded-[9px] text-text-muted transition-colors duration-120 ease-brand hover:bg-surface-2 hover:text-text',
        focusRing,
    );

    return (
        <div className="absolute -top-4 right-3 z-10 flex items-center gap-0.5 rounded-control border border-border bg-surface p-0.5 opacity-0 shadow-card transition-opacity duration-120 ease-brand group-focus-within/message:opacity-100 group-hover/message:opacity-100 has-[[data-state=open]]:opacity-100">
            {['👍', '✅', '👀'].map((emoji) => (
                <button
                    key={emoji}
                    type="button"
                    className={cn(button, 'text-[16px]')}
                    aria-label={`Reaksi ${emoji}`}
                    onClick={() => reactToMessage(message.id, emoji)}
                >
                    {emoji}
                </button>
            ))}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className={button}
                        aria-label="Reaksi lain"
                    >
                        <SmilePlus className="size-4" aria-hidden />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="end"
                    className="grid w-auto grid-cols-4 gap-0.5 p-1"
                >
                    {REACTION_EMOJI.map((emoji) => (
                        <DropdownMenuItem
                            key={emoji}
                            onSelect={() => reactToMessage(message.id, emoji)}
                            className="justify-center text-lg"
                            aria-label={`Reaksi ${emoji}`}
                        >
                            {emoji}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            {!inThread && onReply && (
                <button
                    type="button"
                    className={button}
                    aria-label="Balas di thread"
                    title="Balas di thread"
                    onClick={onReply}
                >
                    <MessageSquareText className="size-4" aria-hidden />
                </button>
            )}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className={button}
                        aria-label="Menu pesan"
                    >
                        <MoreHorizontal className="size-4" aria-hidden />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                        onSelect={() => {
                            void navigator.clipboard
                                ?.writeText(message.body_text)
                                .then(() =>
                                    toast.success('Teks pesan disalin.'),
                                );
                        }}
                    >
                        <Copy aria-hidden />
                        Salin teks
                    </DropdownMenuItem>
                    {mine && (
                        <>
                            <DropdownMenuItem onSelect={onEdit}>
                                <Pencil aria-hidden />
                                Sunting
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                onSelect={onDelete}
                            >
                                <Trash2 aria-hidden />
                                Hapus
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

/**
 * Consecutive messages from one person: avatar + name + time once, then
 * each message (Slack-style rows, own messages included).
 */
export function MessageRunView({
    run,
    state,
    variant,
    matches,
    receipts = {},
    inThread = false,
    onOpenThread,
    onOpenActions,
}: Props) {
    const mobile = variant === 'mobile';
    const author = personById(state.people, run.userId);
    const name =
        run.userId === state.viewerId
            ? `${author?.name ?? 'Anda'} (Anda)`
            : (author?.name ?? 'Pengguna');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<Message | null>(null);
    const first = run.messages[0];

    return (
        <div className="flex gap-3 px-1">
            <UserAvatar
                name={author?.name ?? 'Pengguna'}
                src={author?.avatar}
                className={cn(
                    'mt-1 shrink-0',
                    mobile ? 'size-9 text-[13px]' : 'size-10 text-[14px]',
                )}
            />
            <div className="flex min-w-0 flex-1 flex-col">
                <p className="flex items-baseline gap-2">
                    <span className="truncate text-[16px] font-bold text-text">
                        {name}
                    </span>
                    <time
                        dateTime={first.created_at}
                        title={formatDateTime(first.created_at)}
                        className="shrink-0 text-[13px] text-text-muted tnum"
                    >
                        {clockTime(first.created_at)}
                    </time>
                </p>
                <ul className="flex flex-col">
                    {run.messages.map((message) => {
                        const mine = message.user_id === state.viewerId;
                        const content = (
                            <MessageBody
                                message={message}
                                state={state}
                                variant={variant}
                                match={matches?.has(message.id) ?? false}
                                receipt={receipts[message.id]}
                                inThread={inThread}
                                editing={editingId === message.id}
                                onDoneEditing={() => setEditingId(null)}
                                onOpenThread={onOpenThread}
                            />
                        );

                        return (
                            <li
                                key={message.id}
                                id={`pesan-${message.id}`}
                                className={cn(
                                    'group/message relative -mx-3 rounded-control px-3 py-1 transition-colors duration-120 ease-brand',
                                    !mobile && 'hover:bg-surface-2/60',
                                )}
                            >
                                {mobile &&
                                onOpenActions &&
                                !message.deleted_at ? (
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`Aksi untuk pesan ${author?.name ?? ''}`}
                                        aria-haspopup="dialog"
                                        onClick={(event) => {
                                            // Links, chips and reactions keep their own taps.
                                            if (
                                                (
                                                    event.target as HTMLElement
                                                ).closest('a, button')
                                            ) {
                                                return;
                                            }

                                            onOpenActions(message);
                                        }}
                                        onKeyDown={(event) => {
                                            if (
                                                event.target ===
                                                    event.currentTarget &&
                                                (event.key === 'Enter' ||
                                                    event.key === ' ')
                                            ) {
                                                event.preventDefault();
                                                onOpenActions(message);
                                            }
                                        }}
                                        className={cn(
                                            'rounded-control outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                                        )}
                                    >
                                        {content}
                                    </div>
                                ) : (
                                    content
                                )}
                                {!mobile &&
                                    !message.deleted_at &&
                                    editingId !== message.id && (
                                        <MessageToolbar
                                            message={message}
                                            mine={mine}
                                            inThread={inThread}
                                            onReply={
                                                onOpenThread
                                                    ? () =>
                                                          onOpenThread(message)
                                                    : undefined
                                            }
                                            onEdit={() =>
                                                setEditingId(message.id)
                                            }
                                            onDelete={() =>
                                                setDeleting(message)
                                            }
                                        />
                                    )}
                            </li>
                        );
                    })}
                </ul>
            </div>
            <DeleteMessageDialog
                message={deleting}
                onOpenChange={(open) => !open && setDeleting(null)}
            />
        </div>
    );
}

/** Mobile edit mode is driven from the action sheet. */
export { EditBox };
