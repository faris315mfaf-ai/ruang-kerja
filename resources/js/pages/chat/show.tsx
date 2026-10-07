import { Head, usePage } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatDesktop } from '@/features/chat/chat.desktop';
import { ChatConversationMobile } from '@/features/chat/chat.mobile';
import { channelTitle } from '@/features/chat/lib';
import { ConversationAppBarActions } from '@/features/chat/mobile-ui';
import { screenState } from '@/features/chat/preview-state';
import { useChatRealtime } from '@/features/chat/realtime';
import { useChatStore } from '@/features/chat/store';
import type { ChatProps } from '@/features/chat/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

type Props = { chat: ChatProps };

/** /obrolan/{channel} — one conversation (ChatController@show; opening marks it read). */
export default function ChatShowPage({ chat }: Props) {
    const breakpoint = useBreakpoint();
    const state = useChatStore(chat);
    const companyId = usePage().props.auth.user?.company?.id ?? null;
    const channelId = chat.current?.channel_id ?? '';
    const channel = state.channels.find((item) => item.id === channelId);
    const title = channel
        ? channelTitle(channel, state.people, state.viewerId)
        : 'Obrolan';
    const screen = screenState(state.channels.length);

    useChatRealtime(state.viewerId, companyId, channelId || null);

    return (
        <>
            <Head title={`${title} · Obrolan`} />
            {breakpoint === null ? (
                <div className="flex flex-col gap-4" aria-busy>
                    <Skeleton className="h-9 w-80" />
                    <Skeleton className="h-[560px] w-full" />
                </div>
            ) : breakpoint === 'mobile' ? (
                <ChatConversationMobile
                    key={channelId}
                    state={state}
                    channelId={channelId}
                    preview={screen}
                />
            ) : (
                <ChatDesktop
                    state={state}
                    channelId={channelId}
                    preview={screen}
                    isTablet={breakpoint === 'tablet'}
                />
            )}
        </>
    );
}

function titleFor(chat: ChatProps): string {
    const channel = chat.channels.find(
        (item) => item.id === chat.current?.channel_id,
    );

    return channel
        ? channelTitle(channel, chat.people, chat.viewer_id)
        : 'Obrolan';
}

ChatShowPage.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Obrolan', href: '/obrolan' },
        {
            title: titleFor(props.chat),
            href: `/obrolan/${props.chat.current?.channel_id ?? ''}`,
        },
    ],
    title: titleFor(props.chat),
    back: '/obrolan',
    width: 'wide',
    appBarActions: <ConversationAppBarActions />,
});
