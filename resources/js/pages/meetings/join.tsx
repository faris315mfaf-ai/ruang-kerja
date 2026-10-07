import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { PreJoinScreen } from '@/features/meetings/video/prejoin';
import type { VideoRoomProps } from '@/features/meetings/video/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /rapat/{meeting}/gabung — pre-join screen of Video RuangKerja (camera &
 * microphone check, then "Gabung sekarang"). Full screen without the app
 * shell (resources/js/app.tsx). Props from MeetingVideoController@join.
 */
export default function MeetingJoinPage({ room }: { room: VideoRoomProps }) {
    const breakpoint = useBreakpoint();

    return (
        <>
            <Head title={`Gabung · ${room.meeting.title}`} />
            {breakpoint === null ? (
                <div
                    aria-busy
                    className="flex min-h-dvh flex-col gap-6 bg-background p-6"
                >
                    <Skeleton className="h-10 w-40" />
                    <Skeleton className="aspect-video w-full max-w-3xl rounded-panel" />
                </div>
            ) : (
                <PreJoinScreen props={room} mobile={breakpoint === 'mobile'} />
            )}
        </>
    );
}
