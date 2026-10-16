import {
    AudioPresets,
    DisconnectReason,
    isBrowserSupported,
    Room,
    RoomEvent,
    ScreenSharePresets,
    VideoPresets,
} from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/features/tasks/lib/api';
import { videoApi } from './api';
import { emitRoomNotice } from './room-notices';

export type RoomStatus =
    | { kind: 'connecting' }
    | { kind: 'connected' }
    | { kind: 'reconnecting' }
    | { kind: 'error'; message: string; canRetry: boolean }
    | { kind: 'left' }
    | { kind: 'removed' }
    /** Room deleted by the server: the meeting was canceled (contract). */
    | { kind: 'canceled' }
    | { kind: 'unsupported' };

export type MediaChoices = {
    audioEnabled: boolean;
    videoEnabled: boolean;
    audioDeviceId: string;
    videoDeviceId: string;
};

/**
 * Room options tuned for realtime meetings (docs/fitur/rapat-kalender.md §6a):
 * adaptive stream (subscribers only receive the size they render), dynacast
 * (publishers pause layers nobody watches), VP8 simulcast 180/360/720p,
 * Opus with DTX + RED (silence costs nothing, lost packets are recovered),
 * screen share at 1080p/15 fps with a 720p/5 fps fallback layer.
 */
export function createVideoRoom(choices: MediaChoices): Room {
    return new Room({
        adaptiveStream: true,
        dynacast: true,
        disconnectOnPageLeave: true,
        videoCaptureDefaults: {
            resolution: VideoPresets.h720.resolution,
            deviceId: choices.videoDeviceId || undefined,
        },
        audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            deviceId: choices.audioDeviceId || undefined,
        },
        publishDefaults: {
            simulcast: true,
            videoCodec: 'vp8',
            videoEncoding: VideoPresets.h720.encoding,
            videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
            screenShareEncoding: ScreenSharePresets.h1080fps15.encoding,
            screenShareSimulcastLayers: [ScreenSharePresets.h720fps5],
            audioPreset: AudioPresets.speech,
            dtx: true,
            red: true,
        },
    });
}

function mediaErrorMessage(
    error: unknown,
    what: 'mikrofon' | 'kamera',
): string {
    const name = error instanceof Error ? error.name : '';

    if (name === 'NotAllowedError' || name === 'SecurityError') {
        return `Izin ${what} ditolak. Izinkan di pengaturan situs browser, lalu nyalakan lagi.`;
    }

    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        return `Tidak ada ${what} yang terdeteksi di perangkat ini.`;
    }

    if (name === 'NotReadableError') {
        return `${what === 'kamera' ? 'Kamera' : 'Mikrofon'} sedang dipakai aplikasi lain.`;
    }

    return `${what === 'kamera' ? 'Kamera' : 'Mikrofon'} tidak bisa dinyalakan.`;
}

/**
 * Where the room gets its token. Employees use the default (POST
 * /rapat/{id}/video/token); external guests pass their own source
 * (POST /api/tamu/{token}/token) and map its failures to final screens.
 */
export type RoomTokenSource = {
    fetch: () => Promise<{ url: string; token: string }>;
    /** A token failure that has its own screen (removed, ended …). */
    classify?: (error: unknown) => RoomStatus | null;
};

/**
 * Connects to the LiveKit room of one occurrence: fetches a short-lived token
 * (POST /rapat/{id}/video/token), publishes mic/camera per the pre-join
 * choices, maps disconnect reasons to screens (left · removed by the
 * organizer · meeting ended · error) and reconnects with a fresh token after
 * a network drop the SDK could not resume.
 */
export function useVideoRoom(
    meetingId: string,
    date: string,
    choices: MediaChoices,
    source?: RoomTokenSource,
) {
    // The room lives as long as the page; choices only seed capture defaults.
    const [room] = useState(() => createVideoRoom(choices));
    const [status, setStatus] = useState<RoomStatus>(() =>
        isBrowserSupported() ? { kind: 'connecting' } : { kind: 'unsupported' },
    );
    const leaving = useRef(false);
    const autoRetried = useRef(false);
    const retryTimer = useRef<number | null>(null);
    const choicesRef = useRef(choices);
    choicesRef.current = choices;
    const sourceRef = useRef(source);
    sourceRef.current = source;

    const connect = useCallback(async () => {
        if (!isBrowserSupported()) {
            setStatus({ kind: 'unsupported' });

            return;
        }

        leaving.current = false;
        setStatus({ kind: 'connecting' });

        let token;

        try {
            token = await (sourceRef.current
                ? sourceRef.current.fetch()
                : videoApi.token(meetingId, date));
        } catch (error) {
            const mapped = sourceRef.current?.classify?.(error) ?? null;

            if (mapped) {
                setStatus(mapped);

                return;
            }

            setStatus({
                kind: 'error',
                message:
                    error instanceof ApiError
                        ? error.message
                        : 'Tidak bisa meminta akses ruang rapat.',
                canRetry: !(error instanceof ApiError) || error.status >= 429,
            });

            return;
        }

        try {
            await room.connect(token.url, token.token, { autoSubscribe: true });
        } catch {
            setStatus({
                kind: 'error',
                message:
                    'Tidak bisa tersambung ke server rapat. Periksa jaringan Anda (UDP atau port 443 mungkin diblokir).',
                canRetry: true,
            });

            return;
        }

        setStatus({ kind: 'connected' });
        autoRetried.current = false;

        const { audioEnabled, videoEnabled } = choicesRef.current;
        const local = room.localParticipant;
        const [mic, camera] = await Promise.allSettled([
            local.setMicrophoneEnabled(audioEnabled),
            local.setCameraEnabled(videoEnabled),
        ]);

        if (mic.status === 'rejected') {
            emitRoomNotice(mediaErrorMessage(mic.reason, 'mikrofon'), 'error');
        }

        if (camera.status === 'rejected') {
            emitRoomNotice(mediaErrorMessage(camera.reason, 'kamera'), 'error');
        }
    }, [room, meetingId, date]);

    useEffect(() => {
        const onReconnecting = () => setStatus({ kind: 'reconnecting' });
        const onReconnected = () => setStatus({ kind: 'connected' });
        const onDisconnected = (reason?: DisconnectReason) => {
            if (
                leaving.current ||
                reason === DisconnectReason.CLIENT_INITIATED
            ) {
                setStatus({ kind: 'left' });

                return;
            }

            if (reason === DisconnectReason.PARTICIPANT_REMOVED) {
                setStatus({ kind: 'removed' });

                return;
            }

            if (reason === DisconnectReason.ROOM_DELETED) {
                setStatus({ kind: 'canceled' });

                return;
            }

            if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
                setStatus({
                    kind: 'error',
                    message:
                        'Anda bergabung ke rapat ini dari tab atau perangkat lain.',
                    canRetry: true,
                });

                return;
            }

            // Network drop the SDK could not resume: one automatic retry with a
            // fresh token (the old one may have expired), then a button.
            if (!autoRetried.current) {
                autoRetried.current = true;
                setStatus({ kind: 'reconnecting' });
                // The timer must never outlive the page: a reconnect after
                // the user left would turn the mic/camera back on with no UI.
                retryTimer.current = window.setTimeout(() => {
                    if (!leaving.current) {
                        void connect();
                    }
                }, 1500);

                return;
            }

            setStatus({
                kind: 'error',
                message: 'Sambungan ke ruang rapat terputus.',
                canRetry: true,
            });
        };
        const onMediaError = (error: Error) =>
            emitRoomNotice(
                mediaErrorMessage(
                    error,
                    /video|camera/i.test(error.message) ? 'kamera' : 'mikrofon',
                ),
                'error',
            );

        room.on(RoomEvent.Reconnecting, onReconnecting)
            .on(RoomEvent.SignalReconnecting, onReconnecting)
            .on(RoomEvent.Reconnected, onReconnected)
            .on(RoomEvent.Disconnected, onDisconnected)
            .on(RoomEvent.MediaDevicesError, onMediaError);

        return () => {
            room.off(RoomEvent.Reconnecting, onReconnecting)
                .off(RoomEvent.SignalReconnecting, onReconnecting)
                .off(RoomEvent.Reconnected, onReconnected)
                .off(RoomEvent.Disconnected, onDisconnected)
                .off(RoomEvent.MediaDevicesError, onMediaError);
        };
    }, [room, connect]);

    useEffect(() => {
        if (isBrowserSupported()) {
            void connect();
        }

        return () => {
            leaving.current = true;

            if (retryTimer.current !== null) {
                window.clearTimeout(retryTimer.current);
            }

            void room.disconnect();
        };
    }, [room, connect]);

    const leave = useCallback(() => {
        leaving.current = true;
        void room.disconnect();
        setStatus({ kind: 'left' });
    }, [room]);

    return { room, status, connect, leave };
}

export { mediaErrorMessage };
