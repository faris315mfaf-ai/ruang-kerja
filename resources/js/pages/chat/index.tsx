import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatDesktop } from '@/features/chat/chat.desktop';
import { ChatListMobile } from '@/features/chat/chat.mobile';
import { usePreviewState } from '@/features/chat/preview-state';
import { useChatState } from '@/features/chat/store';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /obrolan — Obrolan (Fase 2 preview, F2-1): channels per workspace, public
 * and private channels, DMs and small groups. Sample data, client-only.
 */
export default function ChatIndexPage() {
    const breakpoint = useBreakpoint();
    const state = useChatState();
    const preview = usePreviewState();

    return (
        <>
            <Head title="Obrolan" />
            {breakpoint === null ? (
                <div className="flex flex-col gap-4" aria-busy>
                    <Skeleton className="h-9 w-80" />
                    <Skeleton className="h-[560px] w-full" />
                </div>
            ) : breakpoint === 'mobile' ? (
                <ChatListMobile state={state} preview={preview} />
            ) : (
                <ChatDesktop
                    state={state}
                    channelId={null}
                    preview={preview}
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
