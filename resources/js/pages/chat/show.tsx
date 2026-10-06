import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatDesktop } from '@/features/chat/chat.desktop';
import { ChatConversationMobile } from '@/features/chat/chat.mobile';
import {
    CHAT_CHANNELS,
    CHAT_PEOPLE,
    VIEWER_ID,
} from '@/features/chat/fixtures';
import { channelTitle } from '@/features/chat/lib';
import { ConversationAppBarActions } from '@/features/chat/mobile-ui';
import { usePreviewState } from '@/features/chat/preview-state';
import { getChatState, useChatState } from '@/features/chat/store';
import { useBreakpoint } from '@/hooks/use-breakpoint';

type Props = { channelId: string };

/** /obrolan/{channel} — one conversation (Fase 2 preview, F2-1). */
export default function ChatShowPage({ channelId }: Props) {
    const breakpoint = useBreakpoint();
    const state = useChatState();
    const preview = usePreviewState();
    const channel = state.channels.find((item) => item.id === channelId);
    const title = channel
        ? channelTitle(channel, state.people, state.viewerId)
        : 'Obrolan';

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
                    preview={preview}
                />
            ) : (
                <ChatDesktop
                    state={state}
                    channelId={channelId}
                    preview={preview}
                    isTablet={breakpoint === 'tablet'}
                />
            )}
        </>
    );
}

function titleFor(channelId: string): string {
    // The store also knows channels created in this session.
    const state = getChatState();
    const channel =
        state.channels.find((item) => item.id === channelId) ??
        CHAT_CHANNELS.find((item) => item.id === channelId);

    return channel ? channelTitle(channel, CHAT_PEOPLE, VIEWER_ID) : 'Obrolan';
}

ChatShowPage.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Obrolan', href: '/obrolan' },
        {
            title: titleFor(props.channelId),
            href: `/obrolan/${props.channelId}`,
        },
    ],
    title: titleFor(props.channelId),
    back: '/obrolan',
    width: 'wide',
    appBarActions: <ConversationAppBarActions />,
});
