import { Head } from '@inertiajs/react';
import { usePersistentUserChoices } from '@livekit/components-react';
import { VideoRoomScreen } from '@/features/meetings/video/room';
import type { VideoRoomProps } from '@/features/meetings/video/types';

/**
 * /rapat/{meeting}/ruang — the Video RuangKerja call (LiveKit), full screen
 * without the app shell (resources/js/app.tsx). Microphone/camera choices
 * come from the pre-join screen (remembered per browser); opening this page
 * directly joins with the last choices. Props from MeetingVideoController@room.
 */
export default function MeetingRoomPage({ room }: { room: VideoRoomProps }) {
    const { userChoices } = usePersistentUserChoices({
        preventSave: true,
        defaults: { audioEnabled: true, videoEnabled: true },
    });

    return (
        <>
            <Head title={`Rapat · ${room.meeting.title}`} />
            <VideoRoomScreen
                props={room}
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
