import {
    usePersistentUserChoices,
    usePreviewTracks,
} from '@livekit/components-react';
import type { LocalAudioTrack, LocalVideoTrack } from 'livekit-client';
import { isBrowserSupported, Track } from 'livekit-client';
import {
    AlertTriangle,
    Mic,
    MicOff,
    Settings2,
    Video,
    VideoOff,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
    DeviceKey,
    DevicePicker,
    ERROR_TEXT,
    MicLevel,
    previewError,
} from '../video/prejoin';
import type { PreviewError } from '../video/prejoin';
import type { MediaChoices } from '../video/use-video-room';
import { GuestShell, meetingWhen } from './guest-screens';
import type { GuestInfo } from './types';

/**
 * Admitted guest: check camera and microphone, then enter the room. Same
 * preview as the employees' pre-join (choices remembered per browser) but
 * nothing about minutes.
 */
export function GuestPreJoin({
    info,
    name,
    mobile,
    onJoin,
}: {
    info: GuestInfo;
    name: string;
    mobile: boolean;
    onJoin: (choices: MediaChoices) => void;
}) {
    const {
        userChoices,
        saveAudioInputEnabled,
        saveVideoInputEnabled,
        saveAudioInputDeviceId,
        saveVideoInputDeviceId,
    } = usePersistentUserChoices({
        defaults: { audioEnabled: true, videoEnabled: true },
    });
    const [error, setError] = useState<PreviewError>(null);
    const [devicesOpen, setDevicesOpen] = useState(false);
    const supported = useMemo(() => isBrowserSupported(), []);
    const options = useMemo(
        () => ({
            audio: userChoices.audioEnabled
                ? { deviceId: userChoices.audioDeviceId || undefined }
                : false,
            video: userChoices.videoEnabled
                ? { deviceId: userChoices.videoDeviceId || undefined }
                : false,
        }),
        [
            userChoices.audioEnabled,
            userChoices.videoEnabled,
            userChoices.audioDeviceId,
            userChoices.videoDeviceId,
        ],
    );
    const tracks = usePreviewTracks(options, (e) => setError(previewError(e)));
    const videoTrack = tracks?.find(
        (track): track is LocalVideoTrack => track.kind === Track.Kind.Video,
    );
    const audioTrack = tracks?.find(
        (track): track is LocalAudioTrack => track.kind === Track.Kind.Audio,
    );
    const videoEl = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const element = videoEl.current;

        if (!element || !videoTrack) {
            return;
        }

        videoTrack.attach(element);

        return () => {
            videoTrack.detach(element);
        };
    }, [videoTrack]);

    useEffect(() => {
        if (tracks && tracks.length > 0) {
            setError(null);
        }
    }, [tracks]);

    const join = () => {
        // Stop the preview so the room can open the devices itself.
        tracks?.forEach((track) => track.stop());
        onJoin({
            audioEnabled: userChoices.audioEnabled,
            videoEnabled: userChoices.videoEnabled,
            audioDeviceId: userChoices.audioDeviceId,
            videoDeviceId: userChoices.videoDeviceId,
        });
    };

    const display = name.trim() || info.guest?.name || 'Tamu';

    return (
        <GuestShell>
            <header className="flex flex-col gap-1.5">
                <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-success-soft px-2.5 py-1 text-[13px] font-bold text-success">
                    Anda sudah diizinkan masuk
                </span>
                <h1 className="text-[26px] leading-[32px] font-extrabold tracking-[-0.02em] break-words md:text-[30px] md:leading-[38px]">
                    {info.meeting?.title ?? 'Rapat'}
                </h1>
                {info.meeting && (
                    <p className="text-[16px] text-text-muted">
                        {meetingWhen(info.meeting)}
                    </p>
                )}
                <p className="text-[15px] text-text-muted">
                    Periksa kamera dan mikrofon, lalu masuk.
                </p>
            </header>
            <div
                className={cn(
                    'relative isolate w-full overflow-hidden rounded-card bg-preview-dark',
                    mobile ? 'aspect-[4/3]' : 'aspect-[520/330]',
                )}
            >
                {videoTrack && userChoices.videoEnabled ? (
                    <video
                        ref={videoEl}
                        muted
                        playsInline
                        autoPlay
                        aria-label="Pratinjau kamera Anda"
                        className="size-full -scale-x-100 object-cover"
                    />
                ) : (
                    <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-on-caption">
                        <UserAvatar
                            name={display}
                            className="size-24 text-[32px]"
                        />
                        <span className="text-[16px] font-semibold opacity-80">
                            {!userChoices.videoEnabled
                                ? 'Kamera mati'
                                : error
                                  ? 'Kamera tidak tersedia'
                                  : 'Menyalakan kamera…'}
                        </span>
                    </span>
                )}
                {audioTrack && userChoices.audioEnabled && (
                    <span className="absolute bottom-3 left-3">
                        <MicLevel track={audioTrack} />
                    </span>
                )}
            </div>
            <div className="flex gap-2.5">
                <DeviceKey
                    label={
                        userChoices.audioEnabled
                            ? 'Matikan mikrofon'
                            : 'Nyalakan mikrofon'
                    }
                    off={!userChoices.audioEnabled}
                    onClick={() =>
                        saveAudioInputEnabled(!userChoices.audioEnabled)
                    }
                >
                    {userChoices.audioEnabled ? (
                        <Mic aria-hidden />
                    ) : (
                        <MicOff aria-hidden />
                    )}
                </DeviceKey>
                <DeviceKey
                    label={
                        userChoices.videoEnabled
                            ? 'Matikan kamera'
                            : 'Nyalakan kamera'
                    }
                    off={!userChoices.videoEnabled}
                    onClick={() =>
                        saveVideoInputEnabled(!userChoices.videoEnabled)
                    }
                >
                    {userChoices.videoEnabled ? (
                        <Video aria-hidden />
                    ) : (
                        <VideoOff aria-hidden />
                    )}
                </DeviceKey>
                <DeviceKey
                    label="Pilih mikrofon & kamera"
                    onClick={() => setDevicesOpen(true)}
                >
                    <Settings2 aria-hidden />
                </DeviceKey>
            </div>
            {error && (
                <p
                    role="alert"
                    className="flex items-start gap-2.5 rounded-control bg-warning-soft px-4 py-3 text-[15px] leading-[22px] text-warning"
                >
                    <AlertTriangle
                        aria-hidden
                        className="mt-0.5 size-5 shrink-0"
                    />
                    {ERROR_TEXT[error]}
                </p>
            )}
            {!supported && (
                <p
                    role="status"
                    className="rounded-control bg-surface-2 px-4 py-3 text-[15px] leading-[22px] text-text-muted"
                >
                    Browser ini belum didukung untuk rapat video. Pakai Chrome,
                    Edge, Firefox, atau Safari versi terbaru.
                </p>
            )}
            <Button
                size="xl"
                className="h-14 w-full rounded-lg text-[17px] font-bold"
                disabled={!supported}
                onClick={join}
                data-testid="guest-join-now"
            >
                Masuk ke rapat
            </Button>
            <Dialog open={devicesOpen} onOpenChange={setDevicesOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Mikrofon & kamera</DialogTitle>
                        <DialogDescription>
                            Pilihan diingat di browser ini.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <DevicePicker
                            kind="audioinput"
                            label="Mikrofon"
                            value={userChoices.audioDeviceId}
                            onChange={saveAudioInputDeviceId}
                        />
                        <DevicePicker
                            kind="videoinput"
                            label="Kamera"
                            value={userChoices.videoDeviceId}
                            onChange={saveVideoInputDeviceId}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </GuestShell>
    );
}
