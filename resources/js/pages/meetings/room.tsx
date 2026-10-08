import { Head } from '@inertiajs/react';
import { usePersistentUserChoices } from '@livekit/components-react';
import { VideoRoomScreen } from '@/features/meetings/video/room';
import type { RoomPageProps } from '@/features/meetings/video/types';

/**
 * /rapat/{meeting}/ruang — Video RuangKerja "Notulen Hidup" (arah C): the
 * live minutes in the centre, faces on top. Full screen without the app
 * shell (resources/js/app.tsx). Microphone/camera choices come from the
 * pre-join screen (remembered per browser); opening this page directly
 * joins with the last choices. Props: docs/fitur/rapat-video-kontrak.md.
 */
export default function MeetingRoomPage(props: RoomPageProps) {
    const { userChoices } = usePersistentUserChoices({
        preventSave: true,
        defaults: { audioEnabled: true, videoEnabled: true },
    });

    return (
        <>
            <Head title={`Rapat · ${props.room.meeting.title}`} />
            <VideoRoomScreen
                page={props}
                choices={{
                    audioEnabled: userChoices.audioEnabled,
                    videoEnabled: userChoices.videoEnabled,
                    audioDeviceId: userChoices.audioDeviceId,
                    videoDeviceId: userChoices.videoDeviceId,
                }}
            />
        </>
    );
}
