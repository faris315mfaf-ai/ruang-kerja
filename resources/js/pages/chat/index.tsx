import { Head, usePage } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatDesktop } from '@/features/chat/chat.desktop';
import { ChatListMobile } from '@/features/chat/chat.mobile';
import { screenState } from '@/features/chat/preview-state';
import { useChatRealtime } from '@/features/chat/realtime';
import { useChatStore } from '@/features/chat/store';
import type { ChatProps } from '@/features/chat/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /obrolan — Obrolan (Fase 2, F2-1): channels per workspace, public and
 * private channels, DMs and small groups (ChatController@index).
 */
export default function ChatIndexPage({ chat }: { chat: ChatProps }) {
    const breakpoint = useBreakpoint();
    const state = useChatStore(chat);
    const companyId = usePage().props.auth.user?.company?.id ?? null;
    const screen = screenState(state.channels.length);

    useChatRealtime(state.viewerId, companyId, null);

    return (
        <>
            <Head title="Obrolan" />
            {breakpoint === null ? (
                <div className="flex flex-col gap-4" aria-busy>
                    <Skeleton className="h-9 w-80" />
                    <Skeleton className="h-[560px] w-full" />
                </div>
            ) : breakpoint === 'mobile' ? (
                <ChatListMobile state={state} preview={screen} />
            ) : (
                <ChatDesktop
                    state={state}
                    channelId={null}
                    preview={screen}
                    isTablet={breakpoint === 'tablet'}
                />
            )}
        </>
    );
}

ChatIndexPage.layout = {
    breadcrumbs: [{ title: 'Obrolan', href: '/obrolan' }],
    title: 'Obrolan',
    width: 'wide',
};
