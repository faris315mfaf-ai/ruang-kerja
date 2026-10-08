import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { PreJoinScreen } from '@/features/meetings/video/prejoin';
import type { RoomPageProps } from '@/features/meetings/video/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /rapat/{meeting}/gabung — pre-join of Video RuangKerja "Notulen Hidup":
 * camera & microphone check, which minutes to open (continue last
 * meeting's · template · blank), open follow-ups of the last meeting and the
 * auto-minutes consent. Full screen without the app shell. Props:
 * docs/fitur/rapat-video-kontrak.md (same as the room).
 */
export default function MeetingJoinPage(props: RoomPageProps) {
    const breakpoint = useBreakpoint();

    return (
        <>
            <Head title={`Gabung · ${props.room.meeting.title}`} />
            {breakpoint === null ? (
                <div
                    aria-busy
                    className="flex min-h-dvh flex-col gap-6 bg-room-desk p-6"
                >
                    <Skeleton className="h-10 w-80" />
                    <Skeleton className="aspect-video w-full max-w-[520px] rounded-card" />
                </div>
            ) : (
                <PreJoinScreen page={props} mobile={breakpoint === 'mobile'} />
            )}
        </>
    );
}
