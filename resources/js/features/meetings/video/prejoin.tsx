import { Link, router } from '@inertiajs/react';
import {
    useMediaDevices,
    usePersistentUserChoices,
    usePreviewTracks,
    useTrackVolume,
} from '@livekit/components-react';
import type { LocalAudioTrack, LocalVideoTrack } from 'livekit-client';
import { isBrowserSupported, MediaDeviceFailure, Track } from 'livekit-client';
import {
    AlertTriangle,
    ArrowLeft,
    Clock,
    Mic,
    MicOff,
    Video,
    VideoOff,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn, focusRing } from '@/lib/utils';
import { shortDate, timeRange, officeDate } from '../lib';
import { useNow } from '../meetings-context';
import type { Person } from '../types';
import {
    countdownLabel,
    isMacPlatform,
    joinWindow,
    namesSummary,
    shortcutAction,
    shortcutLabel,
} from './lib';
import type { VideoRoomProps } from './types';

type PreviewError = 'denied' | 'missing' | 'busy' | 'other' | null;

function previewError(error: Error): PreviewError {
    if (error.name === 'SecurityError') {
        return 'denied';
    }

    switch (MediaDeviceFailure.getFailure(error)) {
        case MediaDeviceFailure.PermissionDenied:
            return 'denied';
        case MediaDeviceFailure.NotFound:
            return 'missing';
        case MediaDeviceFailure.DeviceInUse:
            return 'busy';
        default:
            return 'other';
    }
}

const ERROR_TEXT: Record<Exclude<PreviewError, null>, string> = {
    denied: 'Izin kamera atau mikrofon ditolak. Klik ikon gembok di bilah alamat browser, izinkan Kamera dan Mikrofon, lalu muat ulang halaman. Anda tetap bisa bergabung tanpa keduanya.',
    missing:
        'Kamera atau mikrofon tidak terdeteksi. Anda tetap bisa bergabung dan mendengarkan.',
    busy: 'Kamera atau mikrofon sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.',
    other: 'Kamera atau mikrofon tidak bisa dinyalakan. Periksa perangkat dan izin browser; Anda tetap bisa bergabung.',
};

/** Microphone level as three bars (Meet's green dots). */
function MicLevel({ track }: { track: LocalAudioTrack }) {
    const volume = useTrackVolume(track);

    return (
        <span
            aria-hidden
            className="inline-flex size-9 items-center justify-center gap-[3px] rounded-full bg-primary"
        >
            {[0.6, 1, 0.6].map((weight, index) => (
                <span
                    key={index}
                    className="w-1 rounded-full bg-on-brand transition-[height] duration-120 ease-brand motion-reduce:transition-none"
                    style={{
                        height: `${Math.round(4 + Math.min(1, volume * 4 * weight) * 14)}px`,
                    }}
                />
            ))}
        </span>
    );
}

function DevicePicker({
    kind,
    label,
    value,
    onChange,
}: {
    kind: MediaDeviceKind;
    label: string;
    value: string;
    onChange: (id: string) => void;
}) {
    const id = `prejoin-${kind}`;
    const devices = useMediaDevices({ kind }).filter((d) => d.deviceId !== '');
    const selected = devices.some((d) => d.deviceId === value)
        ? value
        : (devices[0]?.deviceId ?? '');

    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={id} className="text-[14px] text-text-muted">
                {label}
            </Label>
            <Select
                value={selected}
                onValueChange={onChange}
                disabled={devices.length === 0}
            >
                <SelectTrigger id={id} className="w-full min-w-0">
                    <SelectValue placeholder="Tidak ada perangkat" />
                </SelectTrigger>
                <SelectContent>
                    {devices.map((device, index) => (
                        <SelectItem
                            key={device.deviceId}
                            value={device.deviceId}
                        >
                            {device.label || `${label} ${index + 1}`}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function PreviewToggle({
    on,
    labelOn,
    labelOff,
    shortcut,
    onClick,
    iconOn,
    iconOff,
}: {
    on: boolean;
    labelOn: string;
    labelOff: string;
    shortcut: string;
    onClick: () => void;
    iconOn: React.ReactNode;
    iconOff: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={!on}
            aria-label={on ? labelOn : labelOff}
            title={`${on ? labelOn : labelOff} (${shortcut})`}
            className={cn(
                'inline-flex size-14 items-center justify-center rounded-full border transition-[background-color,color] duration-120 ease-brand motion-reduce:transition-none [&_svg]:size-6',
                on
                    ? 'border-on-brand/50 bg-preview-dark/40 text-on-brand hover:bg-preview-dark/60'
                    : 'border-transparent bg-danger text-on-danger hover:opacity-90',
                focusRing,
            )}
        >
            {on ? iconOn : iconOff}
        </button>
    );
}

/**
 * /rapat/{id}/gabung — Google Meet-like pre-join: camera/mic preview with
 * toggles and device pickers, who is already in the room, the join window
 * (countdown) and "Gabung sekarang". Choices are remembered per browser
 * (LiveKit `usePersistentUserChoices`) and read by the room page.
 */
export function PreJoinScreen({
    props,
    mobile,
}: {
    props: VideoRoomProps;
    mobile: boolean;
}) {
    const { meeting, video, viewer } = props;
    // Every second: the countdown and the button follow the join window live.
    const now = useNow(1000);
    const isMac = useMemo(
        () =>
            typeof navigator !== 'undefined' &&
            isMacPlatform(navigator.platform || navigator.userAgent),
        [],
    );
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

    const toggleMic = () => saveAudioInputEnabled(!userChoices.audioEnabled);
    const toggleCamera = () => saveVideoInputEnabled(!userChoices.videoEnabled);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const action = shortcutAction(event, isMac);

            if (action === 'toggle-mic' || action === 'toggle-camera') {
                event.preventDefault();
                (action === 'toggle-mic' ? toggleMic : toggleCamera)();
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    });

    const windowState = joinWindow(video, now);
    const inRoom = video.attendance.filter((person) => person.in_room);
    const inRoomNames = inRoom
        .map(
            (person) =>
                props.people.find((p: Person) => p.id === person.user_id)
                    ?.name ?? 'Peserta',
        )
        .filter(Boolean);
    const canJoin =
        video.configured &&
        video.can_join &&
        windowState.state === 'open' &&
        supported;

    const join = () => {
        // Stop the preview so the room can open the devices itself.
        tracks?.forEach((track) => track.stop());
        router.visit(video.room_href);
    };

    const notice = !supported
        ? 'Browser ini belum didukung untuk rapat video. Pakai Chrome, Edge, Firefox, atau Safari versi terbaru.'
        : !video.configured
          ? 'Video RuangKerja belum disiapkan di server ini. Hubungi admin, atau minta penyelenggara memakai Google Meet/Zoom.'
          : !video.can_join
            ? (video.denied_reason ?? 'Anda tidak bisa bergabung ke rapat ini.')
            : windowState.state === 'closed'
              ? 'Rapat sudah selesai. Ruang rapat sudah ditutup.'
              : null;

    const preview = (
        <div className="relative isolate aspect-video w-full overflow-hidden rounded-panel border border-border bg-preview-dark shadow-card max-md:aspect-auto max-md:h-[min(50dvh,440px)]">
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
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-on-brand">
                    <UserAvatar
                        name={viewer.name}
                        src={viewer.avatar_url}
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
            <span className="absolute top-3 left-3 inline-flex max-w-[70%] items-center rounded-sm bg-preview-dark/70 px-2.5 py-1 text-[14px] font-semibold text-on-brand">
                <span className="truncate">{viewer.name}</span>
            </span>
            {audioTrack && userChoices.audioEnabled && (
                <span className="absolute bottom-4 left-4">
                    <MicLevel track={audioTrack} />
                </span>
            )}
            <span className="absolute inset-x-0 bottom-4 flex justify-center gap-4">
                <PreviewToggle
                    on={userChoices.audioEnabled}
                    labelOn="Matikan mikrofon"
                    labelOff="Nyalakan mikrofon"
                    shortcut={shortcutLabel('toggle-mic', isMac)}
                    onClick={toggleMic}
                    iconOn={<Mic aria-hidden />}
                    iconOff={<MicOff aria-hidden />}
                />
                <PreviewToggle
                    on={userChoices.videoEnabled}
                    labelOn="Matikan kamera"
                    labelOff="Nyalakan kamera"
                    shortcut={shortcutLabel('toggle-camera', isMac)}
                    onClick={toggleCamera}
                    iconOn={<Video aria-hidden />}
                    iconOff={<VideoOff aria-hidden />}
                />
            </span>
        </div>
    );

    const joinButton = (
        <Button
            size="xl"
            className="w-full font-extrabold md:w-auto md:min-w-60"
            disabled={!canJoin}
            onClick={join}
            data-testid="join-now"
        >
            {windowState.state === 'early' && video.can_join && video.configured
                ? countdownLabel(windowState.msUntilOpen)
                : 'Gabung sekarang'}
        </Button>
    );

    return (
        <div className="flex min-h-dvh flex-col bg-background text-text">
            <header className="flex h-16 shrink-0 items-center px-2 md:px-6">
                <Button variant="ghost" size="lg" className="px-3" asChild>
                    <Link href={meeting.href}>
                        <ArrowLeft aria-hidden />
                        Detail rapat
                    </Link>
                </Button>
            </header>
            <main
                className={cn(
                    'mx-auto grid w-full max-w-[1240px] flex-1 content-center gap-6 px-4 pb-8 md:px-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)] lg:items-center lg:gap-14',
                    mobile && 'content-start pb-36',
                )}
            >
                <section
                    aria-label="Pratinjau"
                    className="flex min-w-0 flex-col gap-4"
                >
                    {preview}
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
                    <div className="grid gap-3 md:grid-cols-2">
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
                </section>

                <section
                    aria-label="Gabung rapat"
                    className={cn(
                        'flex min-w-0 flex-col gap-4 lg:items-start lg:text-left',
                        mobile
                            ? 'order-first items-start gap-2.5'
                            : 'items-center text-center',
                    )}
                >
                    {!mobile && (
                        <Badge variant="label" tone="info">
                            Video RuangKerja
                        </Badge>
                    )}
                    <h1 className="text-[24px] leading-[30px] font-extrabold tracking-[-0.02em] md:text-[34px] md:leading-[42px]">
                        {meeting.title}
                    </h1>
                    <p className="flex items-center gap-2 text-[16px] text-text-muted md:text-[17px]">
                        <Clock aria-hidden className="size-5" />
                        {shortDate(officeDate(meeting.starts_at))} ·{' '}
                        {timeRange(meeting.starts_at, meeting.ends_at)}
                    </p>
                    <p
                        className="flex items-center gap-3 text-[16px]"
                        data-testid="in-room"
                    >
                        {inRoom.length > 0 ? (
                            <>
                                <span className="flex -space-x-2">
                                    {inRoom.slice(0, 3).map((person) => {
                                        const known = props.people.find(
                                            (p) => p.id === person.user_id,
                                        );

                                        return (
                                            <UserAvatar
                                                key={person.user_id}
                                                name={known?.name ?? 'Peserta'}
                                                src={known?.avatar_url}
                                                className="size-8 ring-2 ring-background"
                                            />
                                        );
                                    })}
                                </span>
                                <span>
                                    {namesSummary(inRoomNames)} sudah di ruang
                                </span>
                            </>
                        ) : (
                            <span className="text-text-muted">
                                Belum ada yang bergabung
                            </span>
                        )}
                    </p>
                    {notice ? (
                        <p
                            role="status"
                            className="rounded-control bg-surface-2 px-4 py-3 text-[15px] leading-[22px] text-text-muted"
                        >
                            {notice}
                        </p>
                    ) : windowState.state === 'early' ? (
                        <p className="text-[15px] text-text-muted">
                            Ruang rapat dibuka 15 menit sebelum mulai.
                        </p>
                    ) : null}
                    {!mobile && (
                        <>
                            {joinButton}
                            <p className="text-[14px] text-text-subtle">
                                {shortcutLabel('toggle-mic', isMac)} mikrofon ·{' '}
                                {shortcutLabel('toggle-camera', isMac)} kamera
                            </p>
                        </>
                    )}
                </section>
            </main>
            {mobile && (
                <div className="glass fixed inset-x-0 bottom-0 z-30 flex flex-col gap-1.5 border-x-0 border-b-0 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
                    {joinButton}
                </div>
            )}
        </div>
    );
}
