import { Link } from '@inertiajs/react';
import {
    RoomAudioRenderer,
    RoomContext,
    useChat,
    useLocalParticipant,
    useParticipants,
    useSpeakingParticipants,
    useStartAudio,
    useTracks,
} from '@livekit/components-react';
import type { Participant, Room } from 'livekit-client';
import { RoomEvent, Track } from 'livekit-client';
import {
    ArrowLeft,
    Hand,
    Keyboard,
    MessageSquare,
    Mic,
    MicOff,
    MonitorUp,
    MoreVertical,
    PhoneOff,
    RefreshCw,
    Settings2,
    Users,
    Video,
    VideoOff,
    Volume2,
    WifiOff,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatTime } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import type { LayoutPreference, ShortcutAction } from './lib';
import {
    isMacPlatform,
    shortcutAction,
    shortcutLabel,
    stageLayout,
} from './lib';
import type { PanelKind } from './room-panels';
import {
    ChatPanel,
    PeoplePanel,
    SettingsPanel,
    SidePanel,
} from './room-panels';
import type { TileRef } from './room-stage';
import { emitRoomNotice, useRoomNotices } from './room-notices';
import { Stage, tileKey } from './room-stage';
import type { VideoRoomProps } from './types';
import type { MediaChoices, RoomStatus } from './use-video-room';
import { mediaErrorMessage, useVideoRoom } from './use-video-room';

const SHORTCUTS: { action: ShortcutAction; label: string }[] = [
    { action: 'toggle-mic', label: 'Nyalakan/matikan mikrofon' },
    { action: 'toggle-camera', label: 'Nyalakan/matikan kamera' },
    { action: 'toggle-chat', label: 'Buka/tutup chat' },
    { action: 'toggle-people', label: 'Buka/tutup daftar orang' },
    { action: 'toggle-hand', label: 'Angkat/turunkan tangan' },
];

function useIsMac(): boolean {
    return useMemo(
        () =>
            typeof navigator !== 'undefined' &&
            isMacPlatform(navigator.platform || navigator.userAgent),
        [],
    );
}

function useClock(): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 15_000);

        return () => window.clearInterval(id);
    }, []);

    return now;
}

/** Round control button (Meet): red when the device is off. */
function RoundButton({
    label,
    shortcut,
    active = false,
    off = false,
    danger = false,
    wide = false,
    onClick,
    children,
    badge,
    badgeTone = 'unread',
}: {
    label: string;
    shortcut?: string;
    active?: boolean;
    off?: boolean;
    danger?: boolean;
    wide?: boolean;
    onClick?: () => void;
    children: ReactNode;
    badge?: number;
    /** `count` = neutral number (people), default = red unread badge. */
    badgeTone?: 'unread' | 'count';
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            aria-pressed={danger ? undefined : active || off ? true : false}
            title={shortcut ? `${label} (${shortcut})` : label}
            className={cn(
                'relative inline-flex h-12 shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-120 ease-brand active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 [&_svg]:size-5',
                wide ? 'w-16' : 'w-12',
                danger
                    ? 'bg-danger text-on-danger hover:opacity-90'
                    : off
                      ? 'bg-danger text-on-danger hover:opacity-90'
                      : active
                        ? 'bg-link-soft text-link'
                        : 'bg-surface-2 text-text hover:bg-border',
                focusRing,
            )}
        >
            {children}
            {badge !== undefined && badge > 0 && (
                <span
                    className={cn(
                        'absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[12px] font-bold',
                        badgeTone === 'count'
                            ? 'bg-surface text-text ring-1 ring-border'
                            : 'bg-badge text-on-badge',
                    )}
                >
                    {badge > 9 ? '9+' : badge}
                </span>
            )}
        </button>
    );
}

/** Full-screen message: connecting, left, removed, ended, errors. */
function RoomMessage({
    icon,
    title,
    body,
    children,
}: {
    icon: ReactNode;
    title: string;
    body?: string;
    children?: ReactNode;
}) {
    return (
        <div
            role="status"
            className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6 text-center"
        >
            <span className="flex size-16 items-center justify-center rounded-full bg-surface-2 text-text-muted [&_svg]:size-7">
                {icon}
            </span>
            <span className="flex max-w-md flex-col gap-2">
                <span className="text-[24px] leading-8 font-extrabold">
                    {title}
                </span>
                {body && (
                    <span className="text-[16px] leading-6 text-text-muted">
                        {body}
                    </span>
                )}
            </span>
            {children && (
                <span className="flex flex-wrap justify-center gap-3">
                    {children}
                </span>
            )}
        </div>
    );
}

function StatusScreen({
    status,
    props,
    onRetry,
}: {
    status: RoomStatus;
    props: VideoRoomProps;
    onRetry: () => void;
}) {
    const back = (
        <Button variant="outline" size="lg" asChild>
            <Link href={props.meeting.href}>
                <ArrowLeft aria-hidden />
                Kembali ke detail rapat
            </Link>
        </Button>
    );

    switch (status.kind) {
        case 'connecting':
            return (
                <RoomMessage
                    icon={<Spinner />}
                    title="Menyambungkan ke ruang rapat…"
                    body={props.meeting.title}
                />
            );
        case 'left':
            return (
                <RoomMessage
                    icon={<PhoneOff />}
                    title="Anda keluar dari rapat"
                    body={props.meeting.title}
                >
                    <Button size="lg" onClick={onRetry}>
                        Gabung lagi
                    </Button>
                    {back}
                    <Button variant="quiet" size="lg" asChild>
                        <Link href={props.meeting.minutes_href}>
                            Buka notulen
                        </Link>
                    </Button>
                </RoomMessage>
            );
        case 'removed':
            return (
                <RoomMessage
                    icon={<PhoneOff />}
                    title="Penyelenggara mengeluarkan Anda dari rapat"
                    body="Hubungi penyelenggara bila ini keliru."
                >
                    {back}
                </RoomMessage>
            );
        case 'ended':
            return (
                <RoomMessage icon={<PhoneOff />} title="Rapat sudah diakhiri">
                    {back}
                </RoomMessage>
            );
        case 'unsupported':
            return (
                <RoomMessage
                    icon={<WifiOff />}
                    title="Browser ini belum didukung"
                    body="Buka rapat di Chrome, Edge, Firefox, atau Safari versi terbaru."
                >
                    {back}
                </RoomMessage>
            );
        case 'error':
            return (
                <RoomMessage
                    icon={<WifiOff />}
                    title="Tidak bisa masuk ke ruang rapat"
                    body={status.message}
                >
                    {status.canRetry && (
                        <Button size="lg" onClick={onRetry}>
                            <RefreshCw aria-hidden />
                            Coba lagi
                        </Button>
                    )}
                    {back}
                </RoomMessage>
            );
        default:
            return null;
    }
}

/** Banner when the browser blocked autoplay (opened /ruang directly). */
function StartAudioBanner({ room }: { room: Room }) {
    const { mergedProps, canPlayAudio } = useStartAudio({ room, props: {} });

    if (canPlayAudio) {
        return null;
    }

    return (
        <div className="absolute inset-x-0 top-3 z-20 flex justify-center px-3">
            <Button size="lg" onClick={mergedProps.onClick}>
                <Volume2 aria-hidden />
                Aktifkan suara rapat
            </Button>
        </div>
    );
}

/** Joined room: stage, side panel, control bar, shortcuts, notices. */
function ConnectedRoom({
    props,
    room,
    status,
    onLeave,
}: {
    props: VideoRoomProps;
    room: Room;
    status: RoomStatus;
    onLeave: () => void;
}) {
    const breakpoint = useBreakpoint();
    const mobile = breakpoint === 'mobile';
    const isMac = useIsMac();
    const now = useClock();
    const [panel, setPanel] = useState<PanelKind | null>(null);
    const [pinned, setPinned] = useState<string | null>(null);
    const [preference, setPreference] = useState<LayoutPreference>('auto');
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const [seenMessages, setSeenMessages] = useState(0);
    const notices = useRoomNotices();
    const chat = useChat();
    const participants = useParticipants();
    const speakers = useSpeakingParticipants();
    const lastSpeaker = useRef<string | null>(null);
    const {
        localParticipant,
        isMicrophoneEnabled,
        isCameraEnabled,
        isScreenShareEnabled,
    } = useLocalParticipant();
    const hand = localParticipant.attributes.hand ?? '';
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false },
    );

    // Screen shares first, then remote cameras, my camera last.
    const refs: TileRef[] = useMemo(
        () =>
            [...tracks].sort((a, b) => {
                const rank = (ref: TileRef) =>
                    ref.source === Track.Source.ScreenShare
                        ? 0
                        : ref.participant.isLocal
                          ? 2
                          : 1;

                return rank(a) - rank(b);
            }),
        [tracks],
    );
    const screens = refs.filter(
        (ref) => ref.source === Track.Source.ScreenShare,
    );
    const pinnedRef = refs.find((ref) => tileKey(ref) === pinned) ?? null;
    const decision = stageLayout({
        participants: participants.length,
        screenShares: screens.length,
        pinned: pinnedRef !== null,
        preference,
        mobile,
    });

    const speaking = speakers.find((p) => !p.isLocal);

    if (speaking) {
        lastSpeaker.current = speaking.identity;
    }

    const cameraOf = (identity: string | null) =>
        refs.find(
            (ref) =>
                ref.participant.identity === identity &&
                ref.source === Track.Source.Camera,
        );
    const firstRemote = refs.find(
        (ref) => !ref.participant.isLocal && ref.source === Track.Source.Camera,
    );
    const localCamera = refs.find(
        (ref) => ref.participant.isLocal && ref.source === Track.Source.Camera,
    );
    const main =
        decision.mode === 'solo'
            ? (pinnedRef ?? screens[0] ?? localCamera ?? refs[0] ?? null)
            : decision.mode === 'pip'
              ? (firstRemote ?? null)
              : (pinnedRef ??
                screens[0] ??
                cameraOf(lastSpeaker.current) ??
                firstRemote ??
                refs[0] ??
                null);

    const unread =
        panel === 'chat' ? 0 : chat.chatMessages.length - seenMessages;

    useEffect(() => {
        if (panel === 'chat') {
            setSeenMessages(chat.chatMessages.length);
        }
    }, [panel, chat.chatMessages.length]);

    // A pinned tile that left is unpinned.
    useEffect(() => {
        if (pinned && !pinnedRef) {
            setPinned(null);
        }
    }, [pinned, pinnedRef]);

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
                    return; // The person closed the picker.
                }

                emitRoomNotice(
                    'Layar tidak bisa dibagikan dari browser ini.',
                    'error',
                );
            });
    const toggleHand = () =>
        void localParticipant
            .setAttributes({ hand: hand ? '' : String(Date.now()) })
            .catch(() =>
                emitRoomNotice('Tangan gagal diangkat. Coba lagi.', 'error'),
            );
    const togglePanel = (kind: PanelKind) =>
        setPanel((open) => (open === kind ? null : kind));

    // Google Meet shortcuts.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const action = shortcutAction(event, isMac);

            if (!action) {
                return;
            }

            event.preventDefault();
            ({
                'toggle-mic': toggleMic,
                'toggle-camera': toggleCamera,
                'toggle-chat': () => togglePanel('chat'),
                'toggle-people': () => togglePanel('people'),
                'toggle-hand': toggleHand,
            })[action]();
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    });

    // Small notices over the stage (sonner toasts would cover the controls):
    // someone joined, left or raised a hand. Each fades after 4 seconds.
    useEffect(() => {
        const name = (p: Participant) => p.name || 'Peserta';
        const onJoin = (p: Participant) =>
            emitRoomNotice(`${name(p)} bergabung`);
        const onLeft = (p: Participant) => emitRoomNotice(`${name(p)} keluar`);
        const onAttributes = (
            changed: Record<string, string>,
            p: Participant,
        ) => {
            if (!p.isLocal && 'hand' in changed && Number(changed.hand) > 0) {
                emitRoomNotice(`${name(p)} mengangkat tangan`, 'hand');
            }
        };

        room.on(RoomEvent.ParticipantConnected, onJoin)
            .on(RoomEvent.ParticipantDisconnected, onLeft)
            .on(RoomEvent.ParticipantAttributesChanged, onAttributes);

        return () => {
            room.off(RoomEvent.ParticipantConnected, onJoin)
                .off(RoomEvent.ParticipantDisconnected, onLeft)
                .off(RoomEvent.ParticipantAttributesChanged, onAttributes);
        };
    }, [room]);

    const titles: Record<PanelKind, string> = {
        chat: 'Chat rapat',
        people: `Orang (${participants.length})`,
        settings: 'Setelan perangkat',
    };
    const canShare =
        typeof navigator !== 'undefined' &&
        typeof navigator.mediaDevices?.getDisplayMedia === 'function';
    const invited = props.people.filter(
        (person) => person.id !== props.viewer.id,
    );

    const moreMenu = (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <span>
                    <RoundButton
                        label="Opsi lainnya"
                        badge={mobile ? unread : undefined}
                    >
                        <MoreVertical aria-hidden />
                    </RoundButton>
                </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="w-64">
                {mobile && (
                    <>
                        <DropdownMenuItem onSelect={() => setPanel('chat')}>
                            <MessageSquare aria-hidden />
                            Chat{unread > 0 ? ` (${unread} baru)` : ''}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setPanel('people')}>
                            <Users aria-hidden />
                            Orang ({participants.length})
                        </DropdownMenuItem>
                        {canShare && (
                            <DropdownMenuItem onSelect={toggleScreen}>
                                <MonitorUp aria-hidden />
                                {isScreenShareEnabled
                                    ? 'Berhenti presentasi'
                                    : 'Bagikan layar'}
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                    </>
                )}
                <DropdownMenuLabel>Tata letak</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                    value={preference}
                    onValueChange={(value) => {
                        setPreference(value as LayoutPreference);
                        setPinned(null);
                    }}
                >
                    <DropdownMenuRadioItem value="auto">
                        Otomatis
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="grid">
                        Petak
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="spotlight">
                        Sorotan
                    </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setPanel('settings')}>
                    <Settings2 aria-hidden />
                    Setelan perangkat
                </DropdownMenuItem>
                {!mobile && (
                    <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
                        <Keyboard aria-hidden />
                        Pintasan keyboard
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );

    return (
        <>
            {mobile && (
                <header className="flex h-11 shrink-0 items-center gap-3 px-4 text-[15px]">
                    <span className="truncate font-semibold">
                        {props.meeting.title}
                    </span>
                    <span className="ml-auto text-text-muted tnum">
                        {formatTime(new Date(now))}
                    </span>
                </header>
            )}
            <div className="flex min-h-0 flex-1">
                <main
                    aria-label="Video peserta"
                    className="relative min-h-0 min-w-0 flex-1 p-2 md:p-3"
                >
                    <Stage
                        refs={refs}
                        mode={decision.mode}
                        maxTiles={decision.maxTiles}
                        main={main}
                        mobile={mobile}
                        pinnedKey={pinned}
                        onTogglePin={(key) =>
                            setPinned((current) =>
                                current === key ? null : key,
                            )
                        }
                        onOpenPeople={() => setPanel('people')}
                    />
                    <StartAudioBanner room={room} />
                    <ul
                        aria-live="polite"
                        className="pointer-events-none absolute inset-x-0 top-5 z-20 flex flex-col items-center gap-2 px-3"
                    >
                        {notices.map((notice) => (
                            <li
                                key={notice.id}
                                className={cn(
                                    'inline-flex max-w-full items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold shadow-inverse',
                                    notice.tone === 'error'
                                        ? 'bg-danger text-on-danger'
                                        : 'bg-inverse text-on-inverse',
                                )}
                            >
                                {notice.tone === 'hand' && (
                                    <Hand aria-hidden className="size-4" />
                                )}
                                {notice.text}
                            </li>
                        ))}
                    </ul>
                    {status.kind === 'reconnecting' && (
                        <div
                            role="status"
                            className="absolute inset-x-0 top-3 z-20 flex justify-center px-3"
                        >
                            <span className="inline-flex items-center gap-2 rounded-full bg-warning-soft px-4 py-2 text-[15px] font-semibold text-warning shadow-card">
                                <Spinner className="size-4" />
                                Menyambungkan ulang…
                            </span>
                        </div>
                    )}
                </main>
                {panel && (
                    <SidePanel
                        title={titles[panel]}
                        mobile={mobile}
                        onClose={() => setPanel(null)}
                    >
                        {panel === 'chat' ? (
                            <ChatPanel chat={chat} autoFocus={!mobile} />
                        ) : panel === 'people' ? (
                            <PeoplePanel
                                meetingId={props.meeting.id}
                                date={props.meeting.occurrence_date}
                                organizerId={props.meeting.organizer_id}
                                canModerate={props.video.is_organizer}
                                invited={invited}
                            />
                        ) : (
                            <SettingsPanel />
                        )}
                    </SidePanel>
                )}
            </div>

            <footer
                className={cn(
                    'grid shrink-0 items-center gap-3 px-3 pb-[max(12px,env(safe-area-inset-bottom))] md:px-5',
                    mobile
                        ? 'grid-cols-1 pt-1'
                        : 'h-20 grid-cols-[1fr_auto_1fr] pt-0 pb-0',
                )}
            >
                {!mobile && (
                    <span className="flex min-w-0 items-center gap-3 text-[16px]">
                        <span className="font-semibold tnum">
                            {formatTime(new Date(now))}
                        </span>
                        <span aria-hidden className="h-5 w-px bg-border" />
                        <span className="truncate font-semibold">
                            {props.meeting.title}
                        </span>
                    </span>
                )}
                <span className="flex items-center justify-center gap-2 md:gap-3">
                    <RoundButton
                        label={
                            isMicrophoneEnabled
                                ? 'Matikan mikrofon'
                                : 'Nyalakan mikrofon'
                        }
                        shortcut={shortcutLabel('toggle-mic', isMac)}
                        off={!isMicrophoneEnabled}
                        onClick={toggleMic}
                    >
                        {isMicrophoneEnabled ? (
                            <Mic aria-hidden />
                        ) : (
                            <MicOff aria-hidden />
                        )}
                    </RoundButton>
                    <RoundButton
                        label={
                            isCameraEnabled
                                ? 'Matikan kamera'
                                : 'Nyalakan kamera'
                        }
                        shortcut={shortcutLabel('toggle-camera', isMac)}
                        off={!isCameraEnabled}
                        onClick={toggleCamera}
                    >
                        {isCameraEnabled ? (
                            <Video aria-hidden />
                        ) : (
                            <VideoOff aria-hidden />
                        )}
                    </RoundButton>
                    {!mobile && canShare && (
                        <RoundButton
                            label={
                                isScreenShareEnabled
                                    ? 'Berhenti presentasi'
                                    : 'Bagikan layar'
                            }
                            active={isScreenShareEnabled}
                            onClick={toggleScreen}
                        >
                            <MonitorUp aria-hidden />
                        </RoundButton>
                    )}
                    <RoundButton
                        label={hand ? 'Turunkan tangan' : 'Angkat tangan'}
                        shortcut={shortcutLabel('toggle-hand', isMac)}
                        active={Boolean(hand)}
                        onClick={toggleHand}
                    >
                        <Hand aria-hidden />
                    </RoundButton>
                    {moreMenu}
                    <RoundButton
                        label="Keluar dari rapat"
                        danger
                        wide
                        onClick={onLeave}
                    >
                        <PhoneOff aria-hidden />
                    </RoundButton>
                </span>
                {!mobile && (
                    <span className="flex items-center justify-end gap-2">
                        <RoundButton
                            label="Orang"
                            shortcut={shortcutLabel('toggle-people', isMac)}
                            active={panel === 'people'}
                            onClick={() => togglePanel('people')}
                            badge={participants.length}
                            badgeTone="count"
                        >
                            <Users aria-hidden />
                        </RoundButton>
                        <RoundButton
                            label="Chat"
                            shortcut={shortcutLabel('toggle-chat', isMac)}
                            active={panel === 'chat'}
                            onClick={() => togglePanel('chat')}
                            badge={unread}
                        >
                            <MessageSquare aria-hidden />
                        </RoundButton>
                    </span>
                )}
            </footer>

            <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Pintasan keyboard</DialogTitle>
                        <DialogDescription>
                            Sama seperti Google Meet.
                        </DialogDescription>
                    </DialogHeader>
                    <dl className="flex flex-col">
                        {SHORTCUTS.map(({ action, label }) => (
                            <div
                                key={action}
                                className="flex min-h-11 items-center justify-between gap-3 border-t border-divider text-[15px] first:border-t-0"
                            >
                                <dt>{label}</dt>
                                <dd className="font-mono font-semibold">
                                    {shortcutLabel(action, isMac)}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </DialogContent>
            </Dialog>
        </>
    );
}

/**
 * /rapat/{id}/ruang — the call itself, full screen without the app shell,
 * always in the dark theme (video looks best on dark, like Meet).
 */
export function VideoRoomScreen({
    props,
    choices,
}: {
    props: VideoRoomProps;
    choices: MediaChoices;
}) {
    const { room, status, connect, leave } = useVideoRoom(
        props.meeting.id,
        props.meeting.occurrence_date,
        choices,
    );
    const live = status.kind === 'connected' || status.kind === 'reconnecting';

    // Dark theme while the room is open (portals included), restored on leave.
    useEffect(() => {
        const root = document.documentElement;
        const wasDark = root.classList.contains('dark');
        root.classList.add('dark');

        return () => {
            if (!wasDark) {
                root.classList.remove('dark');
            }
        };
    }, []);

    if (!props.video.configured) {
        return (
            <div className="dark fixed inset-0 flex flex-col bg-background text-text">
                <RoomMessage
                    icon={<VideoOff />}
                    title="Video RuangKerja belum disiapkan"
                    body="Server rapat video belum diatur. Hubungi admin, atau minta penyelenggara memakai Google Meet/Zoom."
                >
                    <Button variant="outline" size="lg" asChild>
                        <Link href={props.meeting.href}>
                            <ArrowLeft aria-hidden />
                            Kembali ke detail rapat
                        </Link>
                    </Button>
                </RoomMessage>
            </div>
        );
    }

    return (
        <RoomContext.Provider value={room}>
            <div className="dark fixed inset-0 flex flex-col bg-background pt-[env(safe-area-inset-top)] text-text">
                {live ? (
                    <ConnectedRoom
                        props={props}
                        room={room}
                        status={status}
                        onLeave={leave}
                    />
                ) : (
                    <StatusScreen
                        status={status}
                        props={props}
                        onRetry={() => void connect()}
                    />
                )}
                <RoomAudioRenderer />
            </div>
        </RoomContext.Provider>
    );
}
