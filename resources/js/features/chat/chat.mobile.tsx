import { Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    Copy,
    MessageSquareText,
    MessagesSquare,
    Pencil,
    SearchX,
    Trash2,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { Fab } from '@/components/mobile/fab';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useKeyboardInset, useKeyboardOpen } from '@/hooks/use-keyboard-open';
import { cn, focusRing } from '@/lib/utils';
import { ChannelDetails } from './channel-details';
import { ChannelList } from './channel-list';
import { ChannelSearchBar } from './channel-search-bar';
import { Composer } from './composer';
import { channelSubtitle, channelTitle, REACTION_EMOJI } from './lib';
import { MessageList, TypingIndicator } from './message-list';
import { DeleteMessageDialog, EditBox } from './message-run';
import { setMobileUi, useMobileUi } from './mobile-ui';
import { NewChatDialog } from './new-chat-dialog';
import type { PreviewState } from './preview-state';
import { reactToMessage, sendMessage } from './store';
import { ThreadSheet } from './thread-panel';
import type { ChatState, Message } from './types';
import { useConversation } from './use-conversation';

function ListSkeleton() {
    return (
        <div
            aria-busy
            aria-label="Memuat obrolan"
            className="flex flex-col gap-3"
        >
            <Skeleton className="h-12 w-full" />
            {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="flex items-center gap-3 py-2">
                    <Skeleton className="size-11 rounded-[13px]" />
                    <div className="flex flex-1 flex-col gap-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3.5 w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function ErrorState({ href }: { href: string }) {
    return (
        <EmptyState
            icon={AlertTriangle}
            title="Obrolan gagal dimuat"
            description="Periksa koneksi internet Anda, lalu coba lagi."
            action={
                <Button
                    variant="outline"
                    size="lg"
                    onClick={() => router.visit(href)}
                >
                    Coba lagi
                </Button>
            }
        />
    );
}

/** /obrolan on phones: full-screen conversation list + FAB. */
export function ChatListMobile({
    state,
    preview,
}: {
    state: ChatState;
    preview: PreviewState;
}) {
    const [creating, setCreating] = useState(false);

    return (
        <div className="flex flex-col gap-4">
            {preview === 'memuat' ? (
                <ListSkeleton />
            ) : preview === 'galat' ? (
                <ErrorState href="/obrolan" />
            ) : preview === 'kosong' ? (
                <EmptyState
                    icon={MessagesSquare}
                    title="Belum ada obrolan"
                    description="Channel workspace muncul otomatis saat Anda bergabung. Mulai pesan langsung dengan tombol +."
                />
            ) : (
                <ChannelList state={state} activeId={null} variant="mobile" />
            )}
            <Fab label="Obrolan baru" onClick={() => setCreating(true)} />
            <NewChatDialog
                open={creating}
                onOpenChange={setCreating}
                state={state}
                mobile
            />
        </div>
    );
}

/** Tap a message on phones: reactions + reply, copy, edit, delete. */
function MessageActionsSheet({
    message,
    state,
    onOpenChange,
    onReply,
    onEdit,
    onDelete,
}: {
    message: Message | null;
    state: ChatState;
    onOpenChange: (open: boolean) => void;
    onReply: (message: Message) => void;
    onEdit: (message: Message) => void;
    onDelete: (message: Message) => void;
}) {
    const mine = message?.user_id === state.viewerId;
    const row = cn(
        'flex min-h-14 w-full items-center gap-3 rounded-lg px-3 text-left text-[17px] font-semibold text-text active:bg-surface-2',
        focusRing,
    );
    const act = (action: (message: Message) => void) => () => {
        if (message) {
            onOpenChange(false);
            action(message);
        }
    };

    return (
        <BottomSheet
            open={message !== null}
            onOpenChange={onOpenChange}
            title="Pesan"
            description={message?.body_text.slice(0, 80) || undefined}
        >
            <div className="flex flex-col gap-3">
                <div
                    role="group"
                    aria-label="Reaksi"
                    className="grid grid-cols-8 gap-1"
                >
                    {REACTION_EMOJI.map((emoji) => (
                        <button
                            key={emoji}
                            type="button"
                            aria-label={`Reaksi ${emoji}`}
                            onClick={() => {
                                if (message) {
                                    reactToMessage(message.id, emoji);
                                    onOpenChange(false);
                                }
                            }}
                            className={cn(
                                'flex h-12 items-center justify-center rounded-lg bg-surface-2 text-[22px] active:scale-95',
                                focusRing,
                            )}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
                <div className="flex flex-col">
                    {message?.parent_id === null && (
                        <button
                            type="button"
                            className={row}
                            onClick={act(onReply)}
                        >
                            <MessageSquareText
                                className="size-5 text-text-muted"
                                aria-hidden
                            />
                            Balas di thread
                        </button>
                    )}
                    <button
                        type="button"
                        className={row}
                        onClick={act((item) => {
                            void navigator.clipboard
                                ?.writeText(item.body_text)
                                .then(() =>
                                    toast.success('Teks pesan disalin.'),
                                );
                        })}
                    >
                        <Copy className="size-5 text-text-muted" aria-hidden />
                        Salin teks
                    </button>
                    {mine && (
                        <>
                            <button
                                type="button"
                                className={row}
                                onClick={act(onEdit)}
                            >
                                <Pencil
                                    className="size-5 text-text-muted"
                                    aria-hidden
                                />
                                Sunting
                            </button>
                            <button
                                type="button"
                                className={cn(row, 'text-danger')}
                                onClick={act(onDelete)}
                            >
                                <Trash2 className="size-5" aria-hidden />
                                Hapus
                            </button>
                        </>
                    )}
                </div>
            </div>
        </BottomSheet>
    );
}

/**
 * /obrolan/{channel} on phones: messages in the page, the message box
 * pinned above the tab bar (or right above the keyboard), thread and
 * details in bottom sheets.
 */
export function ChatConversationMobile({
    state,
    channelId,
    preview,
}: {
    state: ChatState;
    channelId: string;
    preview: PreviewState;
}) {
    const conversation = useConversation(state, channelId);
    const { channel, messages, search } = conversation;
    const ui = useMobileUi();
    const keyboardOpen = useKeyboardOpen();
    const keyboardInset = useKeyboardInset();
    const composerBox = useRef<HTMLDivElement>(null);
    const [composerHeight, setComposerHeight] = useState(96);
    const [actionsFor, setActionsFor] = useState<Message | null>(null);
    const [editing, setEditing] = useState<Message | null>(null);
    const [deleting, setDeleting] = useState<Message | null>(null);
    const lastCount = useRef(0);

    // App bar search toggle → conversation search.
    useEffect(() => {
        search.setOpen(ui.search);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ui.search]);

    useEffect(() => () => setMobileUi({ search: false, details: false }), []);

    useLayoutEffect(() => {
        const element = composerBox.current;

        if (!element) {
            return;
        }

        const observer = new ResizeObserver(() =>
            setComposerHeight(element.offsetHeight),
        );
        observer.observe(element);

        return () => observer.disconnect();
    }, [preview]);

    useEffect(() => {
        const nearBottom =
            document.documentElement.scrollHeight -
                window.scrollY -
                window.innerHeight <
            200;

        if (lastCount.current === 0 || nearBottom) {
            window.scrollTo({ top: document.documentElement.scrollHeight });
        }

        lastCount.current = messages.length;
    }, [messages.length]);

    if (preview === 'memuat') {
        return (
            <div className="flex flex-col gap-5">
                {Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className="flex gap-3">
                        <Skeleton className="size-9 rounded-full" />
                        <div className="flex flex-1 flex-col gap-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-full" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (preview === 'galat') {
        return (
            <div className="flex flex-col gap-5">
                <ErrorState href={`/obrolan/${channelId}`} />
            </div>
        );
    }

    if (!channel) {
        return (
            <div className="flex flex-col gap-5">
                <EmptyState
                    icon={SearchX}
                    title="Obrolan tidak ditemukan"
                    description="Channel ini sudah diarsipkan atau Anda bukan anggotanya."
                    action={
                        <Button variant="outline" size="lg" asChild>
                            <Link href="/obrolan">Kembali ke obrolan</Link>
                        </Button>
                    }
                />
            </div>
        );
    }

    const title = channelTitle(channel, state.people, state.viewerId);
    const shown = preview === 'kosong' ? [] : messages;
    const searchForBar = {
        ...search,
        setOpen: (open: boolean) => setMobileUi({ search: open }),
    };

    return (
        <div className="flex flex-col">
            <p className="pb-2 text-[15px] leading-[22px] text-text-muted">
                {channelSubtitle(channel, state.people, state.viewerId)}
            </p>
            {search.open && (
                <div className="sticky top-[calc(var(--app-bar-height)+env(safe-area-inset-top))] z-10 -mx-4 bg-background px-4 py-2">
                    <ChannelSearchBar search={searchForBar} mobile />
                </div>
            )}
            {shown.length === 0 ? (
                <div className="py-6">
                    <EmptyState
                        icon={MessagesSquare}
                        title="Belum ada pesan"
                        description={`Mulai obrolan dengan ${title}. Sebut rekan dengan @ dan rujuk tugas dengan #.`}
                    />
                </div>
            ) : (
                <MessageList
                    messages={shown}
                    channel={channel}
                    state={state}
                    variant="mobile"
                    matches={search.matches}
                    onOpenThread={conversation.openThread}
                    onOpenActions={setActionsFor}
                />
            )}
            <div aria-hidden style={{ height: composerHeight }} />

            <div
                ref={composerBox}
                className={cn(
                    'glass fixed inset-x-0 z-30 border-x-0 border-b-0 px-3 pt-1.5 pb-2',
                    !keyboardOpen &&
                        'bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom))]',
                )}
                style={keyboardOpen ? { bottom: keyboardInset } : undefined}
            >
                <TypingIndicator
                    state={state}
                    typingKey={preview === 'kosong' ? '' : channel.id}
                    className="min-h-5 px-1 pb-1 text-[13px]"
                />
                <Composer
                    key={channel.id}
                    state={state}
                    variant="mobile"
                    placeholder="Tulis pesan…"
                    onSend={(text, files) =>
                        sendMessage(channel.id, text, files)
                    }
                />
            </div>

            <MessageActionsSheet
                message={actionsFor}
                state={state}
                onOpenChange={(open) => !open && setActionsFor(null)}
                onReply={conversation.openThread}
                onEdit={setEditing}
                onDelete={setDeleting}
            />
            <BottomSheet
                open={editing !== null}
                onOpenChange={(open) => !open && setEditing(null)}
                title="Sunting pesan"
            >
                {editing && (
                    <EditBox
                        message={editing}
                        onDone={() => setEditing(null)}
                    />
                )}
            </BottomSheet>
            <DeleteMessageDialog
                message={deleting}
                onOpenChange={(open) => !open && setDeleting(null)}
            />
            <ThreadSheet
                root={conversation.thread}
                channel={channel}
                state={state}
                onOpenChange={(open) => !open && conversation.closeThread()}
            />
            <BottomSheet
                open={ui.details}
                onOpenChange={(open) => setMobileUi({ details: open })}
                title="Detail obrolan"
                className="h-[88svh]"
            >
                <ChannelDetails
                    channel={channel}
                    state={state}
                    className="-mx-5 -my-5"
                />
            </BottomSheet>
        </div>
    );
}
