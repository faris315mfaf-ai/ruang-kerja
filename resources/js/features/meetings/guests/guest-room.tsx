import {
    RoomAudioRenderer,
    RoomContext,
    useChat,
    useLocalParticipant,
    useParticipants,
    useTracks,
} from '@livekit/components-react';
import { RoomEvent, Track } from 'livekit-client';
import {
    MessageSquare,
    Mic,
    MicOff,
    MonitorUp,
    MoreHorizontal,
    PhoneOff,
    RefreshCw,
    Settings2,
    Users,
    Video,
    VideoOff,
    WifiOff,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';
import { CAPTION_SOURCE } from '../video/captions';
import { BarKey, ControlBar, LeaveKey } from '../video/room-bar';
import { Notices } from '../video/room-notices-view';
import { emitRoomNotice } from '../video/room-notices';
import { ChatPanel, SettingsPanel, SidePanel } from '../video/room-panels';
import {
    GuestViewProvider,
    personOfParticipant,
    useIsGuestView,
    useRoomPeople,
} from '../video/room-people';
import { RoomMessage, StartAudioBanner } from '../video/room-message';
import type { TileRef } from '../video/room-tiles';
import {
    Filmstrip,
    ParticipantTile,
    ScreenShare,
    tileKey,
} from '../video/room-tiles';
import type { MediaChoices } from '../video/use-video-room';
import { mediaErrorMessage, useVideoRoom } from '../video/use-video-room';
import { guestApi } from './api';
import { classifyGuestTokenError } from './token-errors';

type GuestPanel = 'chat' | 'people' | 'settings';

const isAgent = (identity: string) => identity === CAPTION_SOURCE;

/** Grid classes by number of tiles (single column on phones). */
export function gridClasses(count: number): string {
    if (count <= 1) {
        return 'grid-cols-1 mx-auto max-w-3xl';
    }

    if (count === 2) {
        return 'grid-cols-1 md:grid-cols-2';
    }

    if (count <= 4) {
        return 'grid-cols-2';
    }

    return 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4';
}

function useStageTracks() {
    const cameras = useTracks(
        [{ source: Track.Source.Camera, withPlaceholder: true }],
        { onlySubscribed: false },
    );
    const screen =
        useTracks(
            [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
            { onlySubscribed: false },
        )[0] ?? null;

    // Others first, yourself last (you know what you look like).
    const ordered = useMemo(
        () =>
            cameras
                .filter((ref) => !isAgent(ref.participant.identity))
                .sort(
                    (a, b) =>
                        Number(a.participant.isLocal) -
                        Number(b.participant.isLocal),
                ),
        [cameras],
    );

    return { cameras: ordered, screen };
}

function Stage({ mobile }: { mobile: boolean }) {
    const { cameras, screen } = useStageTracks();

    if (screen) {
        const activeKey = cameras[0] ? tileKey(cameras[0]) : null;

        return (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div
                    className={cn(
                        'min-h-0 flex-1',
                        mobile && 'aspect-[4/3] flex-none',
                    )}
                >
                    <ScreenShare trackRef={screen} />
                </div>
                <Filmstrip cameras={cameras} activeKey={activeKey} compact />
            </div>
        );
    }

    return (
        <ul
            aria-label="Peserta"
            className={cn(
                'grid min-h-0 flex-1 content-center gap-3 overflow-y-auto',
                gridClasses(cameras.length),
            )}
        >
            {cameras.map((ref) => (
                <li
                    key={tileKey(ref)}
                    className={cn(
                        'aspect-[4/3] md:aspect-video',
                        cameras.length === 1 && 'max-h-[60dvh]',
                    )}
                >
                    <ParticipantTile
                        trackRef={ref as TileRef}
                        fullName
                        className="size-full rounded-card"
                    />
                </li>
            ))}
        </ul>
    );
}

/** Who is in the room, with mic state; the guest has no moderation. */
function PeoplePanel() {
    const people = useRoomPeople();
    const guestView = useIsGuestView();
    const participants = useParticipants({
        updateOnlyOn: [
            RoomEvent.ParticipantConnected,
            RoomEvent.ParticipantDisconnected,
            RoomEvent.TrackMuted,
            RoomEvent.TrackUnmuted,
            RoomEvent.TrackPublished,
            RoomEvent.TrackUnpublished,
        ],
    }).filter((p) => !isAgent(p.identity));

    return (
        <ul
            aria-label="Peserta di ruang rapat"
            className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-[18px] pb-[18px]"
        >
            {participants.map((p) => {
                const person = personOfParticipant(people, p, guestView);
                const micOn =
                    p.getTrackPublication(Track.Source.Microphone)?.isMuted ===
                    false;

                return (
                    <li
                        key={p.identity}
                        className="flex min-h-11 items-center gap-2.5 text-[15px]"
                    >
                        <UserAvatar
                            name={person.plain_name}
                            className="size-8 text-[12px]"
                        />
                        <span className="min-w-0 flex-1 truncate font-semibold">
                            {person.name}
                            {p.isLocal ? ' · Anda' : ''}
                        </span>
                        {micOn ? (
                            <Mic
                                aria-label="Mikrofon menyala"
                                className="size-4 text-text-muted"
                            />
                        ) : (
                            <MicOff
                                aria-label="Mikrofon mati"
                                className="size-4 text-text-muted"
                            />
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

function GuestBar({
    mobile,
    panel,
    setPanel,
    unread,
    onLeave,
}: {
    mobile: boolean;
    panel: GuestPanel | null;
    setPanel: (panel: GuestPanel | null) => void;
    unread: number;
    onLeave: () => void;
}) {
    const {
        localParticipant,
        isMicrophoneEnabled,
        isCameraEnabled,
        isScreenShareEnabled,
    } = useLocalParticipant();
    const size = mobile ? 'lg' : 'md';
    const canShare =
        !mobile &&
        typeof navigator !== 'undefined' &&
        typeof navigator.mediaDevices?.getDisplayMedia === 'function';
    const toggle = (kind: GuestPanel) => setPanel(panel === kind ? null : kind);

    const toggleMic = () =>
        void localParticipant
            .setMicrophoneEnabled(!isMicrophoneEnabled)
            .catch((error: unknown) =>
                emitRoomNotice(mediaErrorMessage(error, 'mikrofon'), 'error'),
            );
    const toggleCamera = () =>
        void localParticipant
            .setCameraEnabled(!isCameraEnabled)
            .catch((error: unknown) =>
                emitRoomNotice(mediaErrorMessage(error, 'kamera'), 'error'),
            );
    const toggleScreen = () =>
        void localParticipant
            .setScreenShareEnabled(!isScreenShareEnabled, { audio: true })
            .catch((error: unknown) => {
                if (
                    error instanceof Error &&
                    error.name === 'NotAllowedError'
                ) {
                    return; // The picker was closed.
                }

                emitRoomNotice(
                    'Layar tidak bisa dibagikan dari browser ini.',
                    'error',
                );
            });

    const mic = (
        <BarKey
            size={size}
            label={
                isMicrophoneEnabled ? 'Matikan mikrofon' : 'Nyalakan mikrofon'
            }
            off={!isMicrophoneEnabled}
            onClick={toggleMic}
        >
            {isMicrophoneEnabled ? <Mic aria-hidden /> : <MicOff aria-hidden />}
        </BarKey>
    );
    const camera = (
        <BarKey
            size={size}
            label={isCameraEnabled ? 'Matikan kamera' : 'Nyalakan kamera'}
            off={!isCameraEnabled}
            onClick={toggleCamera}
        >
            {isCameraEnabled ? <Video aria-hidden /> : <VideoOff aria-hidden />}
        </BarKey>
    );
    const share = canShare && (
        <BarKey
            size={size}
            label={
                isScreenShareEnabled ? 'Berhenti presentasi' : 'Bagikan layar'
            }
            active={isScreenShareEnabled}
            onClick={toggleScreen}
        >
            <MonitorUp aria-hidden />
        </BarKey>
    );
    const chat = (
        <BarKey
            size={size}
            label="Obrolan"
            active={panel === 'chat'}
            badge={unread}
            onClick={() => toggle('chat')}
        >
            <MessageSquare aria-hidden />
        </BarKey>
    );
    const people = (
        <BarKey
            size={size}
            label="Peserta"
            active={panel === 'people'}
            onClick={() => toggle('people')}
        >
            <Users aria-hidden />
        </BarKey>
    );
    const settings = (
        <BarKey
            size={size}
            label="Setelan perangkat"
            active={panel === 'settings'}
            onClick={() => toggle('settings')}
        >
            {mobile ? (
                <MoreHorizontal aria-hidden />
            ) : (
                <Settings2 aria-hidden />
            )}
        </BarKey>
    );

    if (mobile) {
        return (
            <div
                role="toolbar"
                aria-label="Kontrol rapat"
                className="flex w-full items-center justify-between gap-1.5"
            >
                {mic}
                {camera}
                {chat}
                {people}
                {settings}
                <LeaveKey size="lg" onClick={onLeave} />
            </div>
        );
    }

    return (
        <ControlBar>
            {mic}
            {camera}
            {share}
            {chat}
            {people}
            {settings}
            <LeaveKey onClick={onLeave} />
        </ControlBar>
    );
}

function Connected({
    title,
    reconnecting,
    onLeave,
}: {
    title: string;
    reconnecting: boolean;
    onLeave: () => void;
}) {
    const mobile = useBreakpoint() === 'mobile';
    const [panel, setPanel] = useState<GuestPanel | null>(null);
    const chat = useChat();
    const [seen, setSeen] = useState(0);
    const unread = panel === 'chat' ? 0 : chat.chatMessages.length - seen;

    useEffect(() => {
        if (panel === 'chat') {
            setSeen(chat.chatMessages.length);
        }
    }, [panel, chat.chatMessages.length]);

    const titles: Record<GuestPanel, string> = {
        chat: 'Obrolan',
        people: 'Peserta',
        settings: 'Setelan',
    };
    const side = panel && (
        <SidePanel
            title={titles[panel]}
            mobile={mobile}
            onClose={() => setPanel(null)}
            className={mobile ? undefined : 'h-full'}
        >
            {panel === 'chat' ? (
                <ChatPanel chat={chat} autoFocus={!mobile} />
            ) : panel === 'people' ? (
                <PeoplePanel />
            ) : (
                <SettingsPanel />
            )}
        </SidePanel>
    );

    return (
        <div className="relative flex min-h-0 flex-1 flex-col">
            <header className="flex shrink-0 items-center gap-3 px-4 pt-3 md:px-6 md:pt-4">
                <h1 className="min-w-0 flex-1 truncate text-[16px] font-bold md:text-[18px]">
                    {title}
                </h1>
                <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-bold text-text-muted">
                    Anda masuk sebagai tamu
                </span>
            </header>
            <main className="flex min-h-0 flex-1 gap-4 px-4 pt-3 pb-3 md:px-6">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <Stage mobile={mobile} />
                </div>
                {!mobile && side && (
                    <div className="h-full w-[320px] shrink-0">{side}</div>
                )}
            </main>
            {mobile && side}
            <div
                className={cn(
                    'flex shrink-0 justify-center px-4 pt-1 pb-[max(16px,env(safe-area-inset-bottom))]',
                )}
            >
                <GuestBar
                    mobile={mobile}
                    panel={panel}
                    setPanel={setPanel}
                    unread={unread}
                    onLeave={onLeave}
                />
            </div>
            <Notices />
            {reconnecting && (
                <div
                    role="status"
                    className="absolute inset-x-0 top-14 z-30 flex justify-center px-3"
                >
                    <span className="inline-flex items-center gap-2 rounded-full bg-warning-soft px-4 py-2 text-[15px] font-semibold text-warning shadow-card">
                        <Spinner className="size-4" />
                        Menyambungkan ulang…
                    </span>
                </div>
            )}
        </div>
    );
}

/**
 * The call of an external guest: faces in a grid (or a shared screen with a
 * filmstrip), obrolan rapat, peserta, setelan perangkat, Keluar. No minutes,
 * no transcript, no tasks, no moderation; names come from LiveKit (signed by
 * the server). Token from POST /api/tamu/{token}/token.
 */
export function GuestRoom({
    token,
    title,
    choices,
    onRemoved,
    onCheckAgain,
}: {
    token: string;
    title: string;
    choices: MediaChoices;
    /** The organizer took this guest out of the room. */
    onRemoved: () => void;
    onCheckAgain: () => void;
}) {
    const source = useMemo(
        () => ({
            fetch: () => guestApi.token(token),
            classify: classifyGuestTokenError,
        }),
        [token],
    );
    const {
        room: live,
        status,
        connect,
        leave,
    } = useVideoRoom('guest', '', choices, source);
    const connected =
        status.kind === 'connected' || status.kind === 'reconnecting';
    const removed = status.kind === 'removed';

    useEffect(() => {
        if (removed) {
            onRemoved();
        }
    }, [removed, onRemoved]);

    let message = null;

    switch (status.kind) {
        case 'connecting':
            message = (
                <RoomMessage
                    icon={<Spinner />}
                    title="Menyambungkan ke ruang rapat…"
                    body={title}
                />
            );
            break;
        case 'left':
            message = (
                <RoomMessage
                    icon={<PhoneOff />}
                    title="Anda keluar dari rapat"
                    body="Terima kasih sudah bergabung. Anda bisa masuk lagi selama rapat masih berlangsung."
                >
                    <Button size="lg" onClick={() => void connect()}>
                        Gabung lagi
                    </Button>
                </RoomMessage>
            );
            break;
        case 'removed':
            message = (
                <RoomMessage
                    icon={<PhoneOff />}
                    title="Anda dikeluarkan dari rapat"
                    body="Penyelenggara mengeluarkan Anda dari ruang rapat."
                >
                    <Button size="lg" variant="outline" onClick={onCheckAgain}>
                        <RefreshCw aria-hidden />
                        Periksa lagi
                    </Button>
                </RoomMessage>
            );
            break;
        case 'canceled':
            message = (
                <RoomMessage
                    icon={<PhoneOff />}
                    title="Rapat sudah berakhir"
                    body="Ruang rapat ini sudah ditutup. Terima kasih sudah bergabung."
                />
            );
            break;
        case 'unsupported':
            message = (
                <RoomMessage
                    icon={<WifiOff />}
                    title="Browser ini belum didukung"
                    body="Buka tautan di Chrome, Edge, Firefox, atau Safari versi terbaru."
                />
            );
            break;
        case 'error':
            message = (
                <RoomMessage
                    icon={<VideoOff />}
                    title="Tidak bisa masuk ke ruang rapat"
                    body={status.message}
                >
                    {status.canRetry && (
                        <Button size="lg" onClick={() => void connect()}>
                            <RefreshCw aria-hidden />
                            Coba lagi
                        </Button>
                    )}
                </RoomMessage>
            );
            break;
        default:
            break;
    }

    return (
        <GuestViewProvider>
            <RoomContext.Provider value={live}>
                <div
                    className="fixed inset-0 flex flex-col bg-room-desk pt-[env(safe-area-inset-top)] text-text"
                    data-testid="guest-room"
                >
                    {connected ? (
                        <>
                            <Connected
                                title={title}
                                reconnecting={status.kind === 'reconnecting'}
                                onLeave={leave}
                            />
                            <StartAudioBanner room={live} />
                        </>
                    ) : (
                        message
                    )}
                    <RoomAudioRenderer />
                </div>
            </RoomContext.Provider>
        </GuestViewProvider>
    );
}
