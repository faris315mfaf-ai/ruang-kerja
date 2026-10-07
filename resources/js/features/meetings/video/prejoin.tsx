import { Link, router } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
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
    FileText,
    Mic,
    MicOff,
    Settings2,
    Video,
    VideoOff,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Radio } from '@/components/ui/radio';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/features/tasks/lib/api';
import { cn, focusRing } from '@/lib/utils';
import { dueLabel, officeDate, shortDate, timeRange } from '../lib';
import { useNow } from '../meetings-context';
import { autoMinutesOn, ConsentCard, useConsent } from '../notulen/consent';
import { videoApi } from './api';
import type { Room } from './contract';
import { normalizeRoom } from './contract';
import {
    countdownLabel,
    isMacPlatform,
    joinWindow,
    namesSummary,
    shortcutAction,
    shortcutLabel,
} from './lib';
import type { NotesSourceKind, RoomPageProps } from './types';

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

/** Microphone level as three bars over the preview. */
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
            <Label htmlFor={id}>{label}</Label>
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

/** White 46px key under the preview (mockup: mic · cam · settings). */
function DeviceKey({
    label,
    off = false,
    onClick,
    children,
}: {
    label: string;
    off?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            aria-pressed={off || undefined}
            className={cn(
                'inline-flex size-[46px] items-center justify-center rounded-control border transition-colors duration-120 ease-brand [&_svg]:size-5',
                off
                    ? 'border-transparent bg-danger text-on-danger'
                    : 'border-border bg-surface text-text hover:bg-surface-2',
                focusRing,
            )}
        >
            {children}
        </button>
    );
}

/** One "Pilih notulen" card (radio). */
function SourceCard({
    value,
    title,
    detail,
    checked,
    disabled,
    onSelect,
}: {
    value: NotesSourceKind;
    title: string;
    detail?: string;
    checked: boolean;
    disabled?: boolean;
    onSelect: (value: NotesSourceKind) => void;
}) {
    return (
        <label
            className={cn(
                'flex cursor-pointer items-center gap-3.5 rounded-lg bg-surface p-4 transition-shadow duration-120 ease-brand has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring',
                checked
                    ? 'shadow-[inset_0_0_0_2px_var(--primary)]'
                    : 'border border-border',
                disabled && 'cursor-not-allowed opacity-60',
            )}
            data-testid={`source-${value}`}
        >
            <span
                aria-hidden
                className={cn(
                    'flex h-14 w-11 shrink-0 items-center justify-center rounded-[6px]',
                    checked
                        ? 'bg-link-soft text-link'
                        : 'bg-surface-2 text-text-subtle',
                )}
            >
                <FileText className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[16px] font-bold">{title}</span>
                {detail && (
                    <span className="text-[14px] text-text-muted">
                        {detail}
                    </span>
                )}
            </span>
            <Radio
                name="notes-source"
                value={value}
                checked={checked}
                disabled={disabled}
                onChange={() => onSelect(value)}
                className="size-5 checked:border-[6px]"
            />
        </label>
    );
}

const SOURCE_LABEL: Record<NotesSourceKind, string> = {
    continue: 'Lanjutkan notulen rapat lalu',
    template: 'Templat',
    blank: 'Dokumen kosong',
};

/** Which minutes to open + follow-ups of the last meeting (contract §2). */
function NotesChoice({
    room,
    source,
    onSource,
}: {
    room: Room;
    source: NotesSourceKind;
    onSource: (value: NotesSourceKind) => void;
}) {
    const notes = room.notesSource;
    const people = new Map(room.participants.map((p) => [p.id, p]));
    const today = room.meeting.occurrence_date;

    if (!notes) {
        return null;
    }

    const previous = notes.previous;
    const templateName = notes.template
        ? notes.template.label
        : 'Templat agenda rapat';
    const followUps = notes.open_follow_ups;

    return (
        <>
            {notes.chosen ? (
                <p
                    className="rounded-lg border border-border bg-surface px-4 py-3.5 text-[15px] text-text-muted"
                    data-testid="source-chosen"
                >
                    Notulen memakai{' '}
                    <b className="text-text">
                        {notes.chosen === 'template'
                            ? templateName
                            : SOURCE_LABEL[notes.chosen]}
                    </b>
                    {notes.chosen_by &&
                        ` · dipilih ${people.get(notes.chosen_by)?.first_name ?? 'notulis'}`}
                    .
                </p>
            ) : notes.can_choose ? (
                <fieldset className="flex flex-col gap-3">
                    <legend className="sr-only">Notulen yang dipakai</legend>
                    <SourceCard
                        value="continue"
                        title={SOURCE_LABEL.continue}
                        detail={
                            previous
                                ? `${shortDate(previous.occurrence_date)} · ${
                                      previous.open_count > 0
                                          ? `${previous.open_count} tindak lanjut masih terbuka`
                                          : 'semua tindak lanjut selesai'
                                  }`
                                : 'Belum ada notulen rapat sebelumnya'
                        }
                        checked={source === 'continue'}
                        disabled={!previous}
                        onSelect={onSource}
                    />
                    <SourceCard
                        value="template"
                        title={templateName}
                        detail={
                            notes.template
                                ? ['Agenda', ...notes.template.blocks]
                                      .join(', ')
                                      .toLowerCase()
                                      .replace(/^./, (c) => c.toUpperCase())
                                : 'Satu bagian per butir agenda'
                        }
                        checked={source === 'template'}
                        onSelect={onSource}
                    />
                    <SourceCard
                        value="blank"
                        title={SOURCE_LABEL.blank}
                        checked={source === 'blank'}
                        onSelect={onSource}
                    />
                </fieldset>
            ) : (
                <p className="rounded-lg border border-border bg-surface px-4 py-3.5 text-[15px] text-text-muted">
                    Notulis memilih notulen yang dipakai. Anda bisa membacanya
                    selama rapat.
                </p>
            )}
            {previous && followUps.length > 0 && (
                <section
                    aria-labelledby="open-follow-ups"
                    className="flex flex-col gap-1.5 rounded-[14px] bg-warning-soft px-4 py-3.5 text-[14px] text-warning"
                    data-testid="open-follow-ups"
                >
                    <h2 id="open-follow-ups" className="font-bold">
                        Tindak lanjut terbuka dari{' '}
                        {shortDate(previous.occurrence_date)}
                    </h2>
                    <ul className="flex flex-col gap-1">
                        {followUps.slice(0, 5).map((item) => (
                            <li key={item.id}>
                                {item.task_key && (
                                    <span className="font-mono">
                                        {item.task_key}{' '}
                                    </span>
                                )}
                                {item.text} ·{' '}
                                {people.get(item.assignee_id ?? '')
                                    ?.first_name ?? 'Tanpa PIC'}{' '}
                                · {dueLabel(item.due_date, today).toLowerCase()}
                            </li>
                        ))}
                    </ul>
                    {followUps.length > 5 && (
                        <span>dan {followUps.length - 5} lainnya</span>
                    )}
                </section>
            )}
        </>
    );
}

/**
 * /rapat/{id}/gabung — "Notulen Hidup" pre-join: camera preview with
 * device keys, which minutes to open, open follow-ups of the last meeting,
 * the auto-minutes consent card, then "Masuk dan buka notulen". Device
 * choices are remembered per browser (read by the room page).
 */
export function PreJoinScreen({
    page,
    mobile,
}: {
    page: RoomPageProps;
    mobile: boolean;
}) {
    const room = normalizeRoom(page.room, page.notulen ?? null);
    const { meeting, video, viewer } = room;
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
    const [devicesOpen, setDevicesOpen] = useState(false);
    const [joining, setJoining] = useState(false);
    const notes = room.notesSource;
    const [source, setSource] = useState<NotesSourceKind>(() =>
        notes?.suggested === 'continue' && !notes.previous
            ? 'template'
            : (notes?.suggested ?? 'template'),
    );
    const consent = useConsent(room.notulen);
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

    // Someone else picked the notes source: show their choice (contract §5).
    const channel = room.features.realtime ? room.channel : null;
    const date = meeting.occurrence_date;

    useEffect(() => {
        if (!channel) {
            return;
        }

        try {
            if (!echoIsConfigured()) {
                return;
            }

            const instance = echo();
            instance
                .private(channel)
                .listen(
                    '.minutes.source_chosen',
                    (event: { occurrence_date?: string }) => {
                        if (event.occurrence_date === date) {
                            router.reload({ only: ['room'] });
                        }
                    },
                );

            return () => instance.leave(channel);
        } catch {
            return undefined;
        }
    }, [channel, date]);

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
    const nameOf = (id: string) =>
        room.participants.find((p) => p.id === id)?.name ?? 'Peserta';
    const canJoin =
        video.configured &&
        video.can_join &&
        windowState.state === 'open' &&
        supported;
    const choosing = Boolean(
        notes && notes.can_choose && !notes.chosen && room.links.notesSource,
    );

    const join = async () => {
        if (joining) {
            return;
        }

        setJoining(true);

        if (choosing && room.links.notesSource) {
            try {
                await videoApi.chooseNotesSource(
                    room.links.notesSource,
                    source,
                );
            } catch (failure) {
                setJoining(false);
                toast.error(
                    failure instanceof ApiError
                        ? failure.message
                        : 'Pilihan notulen belum tersimpan. Coba lagi.',
                );

                return;
            }
        }

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
            {audioTrack && userChoices.audioEnabled && (
                <span className="absolute bottom-3 left-3">
                    <MicLevel track={audioTrack} />
                </span>
            )}
        </div>
    );

    const keys = (
        <div className="flex gap-2.5">
            <DeviceKey
                label={
                    userChoices.audioEnabled
                        ? `Matikan mikrofon (${shortcutLabel('toggle-mic', isMac)})`
                        : `Nyalakan mikrofon (${shortcutLabel('toggle-mic', isMac)})`
                }
                off={!userChoices.audioEnabled}
                onClick={toggleMic}
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
                        ? `Matikan kamera (${shortcutLabel('toggle-camera', isMac)})`
                        : `Nyalakan kamera (${shortcutLabel('toggle-camera', isMac)})`
                }
                off={!userChoices.videoEnabled}
                onClick={toggleCamera}
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
    );

    const joinButton = (
        <Button
            size="xl"
            className="h-14 w-full rounded-lg text-[17px] font-bold"
            disabled={!canJoin || joining}
            onClick={() => void join()}
            data-testid="join-now"
        >
            {joining && <Spinner />}
            {windowState.state === 'early' && video.can_join && video.configured
                ? countdownLabel(windowState.msUntilOpen)
                : 'Masuk dan buka notulen'}
        </Button>
    );

    const consentCard = autoMinutesOn(room.notulen) && room.notulen && (
        <ConsentCard notulen={room.notulen} consent={consent} />
    );

    return (
        <div className="min-h-dvh bg-room-desk text-text">
            <div
                className={cn(
                    'relative mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-4 md:px-10 lg:px-20 lg:pt-10',
                    mobile ? 'pb-32' : 'pb-12',
                )}
            >
                <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-2 self-start"
                    asChild
                >
                    <Link href={meeting.href}>
                        <ArrowLeft aria-hidden />
                        Detail rapat
                    </Link>
                </Button>
                <header className="flex flex-col gap-1 lg:pr-[380px]">
                    <h1 className="text-[26px] leading-[32px] font-extrabold tracking-[-0.02em] md:text-[30px] md:leading-[38px]">
                        {meeting.title}
                    </h1>
                    <p className="text-[16px] text-text-muted">
                        {notes?.can_choose && !notes.chosen
                            ? 'Pilih notulen yang dipakai, lalu masuk.'
                            : 'Periksa kamera dan mikrofon, lalu masuk.'}
                    </p>
                    <p
                        className="text-[14px] text-text-muted"
                        data-testid="in-room"
                    >
                        {shortDate(officeDate(meeting.starts_at))} ·{' '}
                        {timeRange(meeting.starts_at, meeting.ends_at)} ·{' '}
                        {inRoom.length > 0
                            ? `${namesSummary(inRoom.map((p) => nameOf(p.user_id)))} sudah di ruang`
                            : 'Belum ada yang bergabung'}
                    </p>
                </header>

                {consentCard && !mobile && (
                    <div className="absolute top-10 right-4 w-[340px] md:right-10 lg:right-20">
                        {consentCard}
                    </div>
                )}

                <main className="grid gap-6 lg:grid-cols-[minmax(0,520px)_minmax(0,560px)] lg:justify-between lg:gap-10">
                    <section
                        aria-label="Kamera dan mikrofon"
                        className="flex min-w-0 flex-col gap-5"
                    >
                        {preview}
                        {keys}
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
                    </section>
                    <section
                        aria-label="Notulen"
                        className="flex min-w-0 flex-col gap-3"
                    >
                        {consentCard && mobile && consentCard}
                        <NotesChoice
                            room={room}
                            source={source}
                            onSource={setSource}
                        />
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
                        {!mobile && joinButton}
                    </section>
                </main>
            </div>
            {mobile && (
                <div className="glass fixed inset-x-0 bottom-0 z-30 border-x-0 border-b-0 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
                    {joinButton}
                </div>
            )}

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
        </div>
    );
}
