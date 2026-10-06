import { Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    BellOff,
    Info,
    MessagesSquare,
    Plus,
    Search,
    SearchX,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, focusRing } from '@/lib/utils';
import { ChannelAvatar } from './channel-avatar';
import { ChannelDetails } from './channel-details';
import { ChannelList } from './channel-list';
import { ChannelSearchBar } from './channel-search-bar';
import { Composer } from './composer';
import { channelSubtitle, channelTitle } from './lib';
import { MessageList, TypingIndicator } from './message-list';
import { NewChatDialog } from './new-chat-dialog';
import type { PreviewState } from './preview-state';
import { sendMessage } from './store';
import { ThreadPanel } from './thread-panel';
import type { ChatState } from './types';
import { useConversation } from './use-conversation';

type Props = {
    state: ChatState;
    channelId: string | null;
    preview: PreviewState;
    isTablet: boolean;
};

/** ≥ 1280px: thread/detail as a third column; narrower: a right sheet. */
function useWideEnough(): boolean {
    const query = '(min-width: 1280px)';
    const [wide, setWide] = useState(() => window.matchMedia(query).matches);

    useEffect(() => {
        const list = window.matchMedia(query);
        const onChange = () => setWide(list.matches);
        list.addEventListener('change', onChange);

        return () => list.removeEventListener('change', onChange);
    }, []);

    return wide;
}

function ColumnsSkeleton() {
    return (
        <div aria-busy aria-label="Memuat obrolan" className="flex h-full">
            <div className="flex w-[300px] shrink-0 flex-col gap-3 border-r border-divider p-4">
                <Skeleton className="h-11 w-full" />
                {Array.from({ length: 7 }, (_, index) => (
                    <div key={index} className="flex items-center gap-3">
                        <Skeleton className="size-9 rounded-[10px]" />
                        <div className="flex flex-1 flex-col gap-1.5">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3.5 w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex flex-1 flex-col gap-6 p-6">
                <Skeleton className="h-10 w-72" />
                {Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className="flex gap-3">
                        <Skeleton className="size-10 rounded-full" />
                        <div className="flex flex-1 flex-col gap-2">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-4 w-full max-w-xl" />
                            <Skeleton className="h-4 w-2/3 max-w-md" />
                        </div>
                    </div>
                ))}
                <Skeleton className="mt-auto h-14 w-full" />
            </div>
        </div>
    );
}

function Conversation({
    state,
    channelId,
    isTablet,
}: {
    state: ChatState;
    channelId: string;
    isTablet: boolean;
}) {
    const conversation = useConversation(state, channelId);
    const { channel, messages, search, thread } = conversation;
    const wide = useWideEnough();
    const [detailsOpen, setDetailsOpen] = useState(false);
    const scroller = useRef<HTMLDivElement>(null);
    const lastCount = useRef(0);

    // Stick to the newest message on open and when new ones arrive.
    useEffect(() => {
        const element = scroller.current;

        if (!element) {
            return;
        }

        const nearBottom =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            160;

        if (lastCount.current === 0 || nearBottom) {
            element.scrollTo({ top: element.scrollHeight });
        }

        lastCount.current = messages.length;
    }, [messages.length, channelId]);

    if (!channel) {
        return (
            <div className="flex flex-1 items-center justify-center p-8">
                <EmptyState
                    icon={SearchX}
                    title="Obrolan tidak ditemukan"
                    description="Channel ini sudah diarsipkan atau Anda bukan anggotanya."
                    action={
                        <Button variant="outline" asChild>
                            <Link href="/obrolan">Kembali ke obrolan</Link>
                        </Button>
                    }
                />
            </div>
        );
    }

    const title = channelTitle(channel, state.people, state.viewerId);
    const muted =
        channel.members.find((member) => member.user_id === state.viewerId)
            ?.muted ?? false;
    const side: 'thread' | 'details' | null = thread
        ? 'thread'
        : detailsOpen
          ? 'details'
          : null;
    const closeSide = () => {
        conversation.closeThread();
        setDetailsOpen(false);
    };
    const sidePanel =
        side === 'thread' && thread ? (
            <ThreadPanel
                root={thread}
                channel={channel}
                state={state}
                onClose={closeSide}
                className="h-full"
            />
        ) : side === 'details' ? (
            <ChannelDetails
                channel={channel}
                state={state}
                onClose={closeSide}
                className="h-full"
            />
        ) : null;
    const headerButton = cn(
        'flex size-11 items-center justify-center rounded-full text-text-muted transition-colors duration-120 ease-brand hover:bg-surface-2 hover:text-text aria-pressed:bg-link-soft aria-pressed:text-link',
        focusRing,
    );

    return (
        <>
            <section
                aria-label={`Obrolan ${title}`}
                className="flex min-w-0 flex-1 flex-col"
            >
                <header className="flex min-h-[72px] items-center gap-3 border-b border-divider px-5 py-3">
                    <ChannelAvatar
                        channel={channel}
                        people={state.people}
                        viewerId={state.viewerId}
                        size="sm"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                        <h1 className="flex items-center gap-2 truncate text-[19px] leading-7 font-bold text-text">
                            {channel.type === 'public' ||
                            channel.type === 'private'
                                ? `#${title}`
                                : title}
                            {muted && (
                                <BellOff
                                    className="size-4 shrink-0 text-text-subtle"
                                    aria-label="Dibisukan"
                                />
                            )}
                        </h1>
                        <p className="truncate text-[14px] text-text-muted">
                            {channelSubtitle(
                                channel,
                                state.people,
                                state.viewerId,
                            )}
                        </p>
                    </div>
                    <button
                        type="button"
                        className={headerButton}
                        aria-label="Cari di obrolan ini"
                        aria-pressed={search.open}
                        onClick={() => search.setOpen(!search.open)}
                    >
                        <Search className="size-5" aria-hidden />
                    </button>
                    <button
                        type="button"
                        className={headerButton}
                        aria-label="Detail obrolan"
                        aria-pressed={side === 'details'}
                        onClick={() => {
                            conversation.closeThread();
                            setDetailsOpen(!detailsOpen);
                        }}
                    >
                        <Info className="size-5" aria-hidden />
                    </button>
                </header>
                {search.open && (
                    <div className="border-b border-divider px-5 py-2">
                        <ChannelSearchBar search={search} />
                    </div>
                )}
                <div
                    ref={scroller}
                    className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-4"
                >
                    {messages.length === 0 ? (
                        <div className="flex h-full items-center justify-center">
                            <EmptyState
                                icon={MessagesSquare}
                                size="sm"
                                title="Belum ada pesan"
                                description={`Mulai obrolan dengan ${title}. Sebut rekan dengan @ dan rujuk tugas dengan #.`}
                            />
                        </div>
                    ) : (
                        <MessageList
                            messages={messages}
                            channel={channel}
                            state={state}
                            variant="desktop"
                            matches={search.matches}
                            onOpenThread={conversation.openThread}
                        />
                    )}
                </div>
                <div className="px-5 pb-4">
                    <TypingIndicator
                        state={state}
                        typingKey={channel.id}
                        className="px-1 pb-1"
                    />
                    <Composer
                        key={channel.id}
                        state={state}
                        variant="desktop"
                        placeholder={`Tulis pesan ke ${channel.type === 'public' || channel.type === 'private' ? '#' : ''}${title}`}
                        onSend={(text, files) =>
                            sendMessage(channel.id, text, files)
                        }
                    />
                </div>
            </section>

            {wide && !isTablet ? (
                sidePanel && (
                    <div className="w-[380px] shrink-0 border-l border-divider">
                        {sidePanel}
                    </div>
                )
            ) : (
                <Sheet
                    open={side !== null}
                    onOpenChange={(open) => !open && closeSide()}
                >
                    <SheetContent
                        side="right"
                        className="w-full gap-0 p-0 sm:max-w-[420px] [&>button:last-child]:hidden"
                    >
                        <SheetTitle className="sr-only">
                            {side === 'thread' ? 'Thread' : 'Detail obrolan'}
                        </SheetTitle>
                        <SheetDescription className="sr-only">
                            {title}
                        </SheetDescription>
                        {sidePanel}
                    </SheetContent>
                </Sheet>
            )}
        </>
    );
}

/**
 * Obrolan on desktop & tablet: conversation list · conversation · thread or
 * details (third column ≥ 1280px, sheet below). Fills the viewport.
 */
export function ChatDesktop({ state, channelId, preview, isTablet }: Props) {
    const [creating, setCreating] = useState(false);
    const empty = preview === 'kosong';
    const shownState: ChatState = empty
        ? { ...state, channels: [], messages: [] }
        : state;

    return (
        <div className="flex flex-col gap-4">
            <div
                className={cn(
                    'flex min-h-[560px] overflow-hidden rounded-panel border border-border bg-surface shadow-card',
                    isTablet
                        ? 'h-[calc(100svh-120px)]'
                        : 'h-[calc(100svh-var(--menu-bar-height)-var(--page-pad)-var(--dock-space)-56px)]',
                )}
            >
                {preview === 'memuat' ? (
                    <ColumnsSkeleton />
                ) : preview === 'galat' ? (
                    <div className="flex flex-1 items-center justify-center p-8">
                        <EmptyState
                            icon={AlertTriangle}
                            title="Obrolan gagal dimuat"
                            description="Koneksi ke server obrolan terputus. Pesan yang belum terkirim tetap tersimpan di perangkat ini."
                            action={
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        router.visit(
                                            channelId
                                                ? `/obrolan/${channelId}`
                                                : '/obrolan',
                                        )
                                    }
                                >
                                    Coba lagi
                                </Button>
                            }
                        />
                    </div>
                ) : (
                    <>
                        <nav
                            aria-label="Daftar obrolan"
                            className={cn(
                                'flex shrink-0 flex-col border-r border-divider',
                                isTablet ? 'w-[260px]' : 'w-[300px]',
                            )}
                        >
                            <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3">
                                <h2 className="text-[22px] leading-[30px] font-bold text-text">
                                    Obrolan
                                </h2>
                                <Button
                                    size="icon-sm"
                                    aria-label="Obrolan baru"
                                    title="Obrolan baru"
                                    onClick={() => setCreating(true)}
                                >
                                    <Plus aria-hidden />
                                </Button>
                            </div>
                            <div className="min-h-0 flex-1 overflow-y-auto pb-3">
                                {empty ? (
                                    <div className="px-4">
                                        <EmptyState
                                            icon={MessagesSquare}
                                            size="sm"
                                            title="Belum ada obrolan"
                                            description="Channel workspace muncul otomatis saat Anda bergabung."
                                        />
                                    </div>
                                ) : (
                                    <ChannelList
                                        state={shownState}
                                        activeId={channelId}
                                        variant="desktop"
                                    />
                                )}
                            </div>
                        </nav>
                        {channelId && !empty ? (
                            <Conversation
                                key={channelId}
                                state={state}
                                channelId={channelId}
                                isTablet={isTablet}
                            />
                        ) : (
                            <div className="flex flex-1 items-center justify-center p-8">
                                <EmptyState
                                    icon={MessagesSquare}
                                    title={
                                        empty
                                            ? 'Mulai obrolan pertama'
                                            : 'Pilih obrolan'
                                    }
                                    description={
                                        empty
                                            ? 'Kirim pesan langsung ke rekan atau buat channel untuk topik tertentu.'
                                            : 'Pilih channel atau pesan langsung di kiri, atau mulai obrolan baru.'
                                    }
                                    action={
                                        <Button
                                            onClick={() => setCreating(true)}
                                        >
                                            <Plus aria-hidden />
                                            Obrolan baru
                                        </Button>
                                    }
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
            <NewChatDialog
                open={creating}
                onOpenChange={setCreating}
                state={state}
            />
        </div>
    );
}
