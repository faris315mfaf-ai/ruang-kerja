import {
    useChat,
    useLocalParticipant,
    useRoomContext,
    useParticipants,
    useSpeakingParticipants,
    useTracks,
} from '@livekit/components-react';
import type { Participant, Room as LiveRoom } from 'livekit-client';
import { RoomEvent, Track } from 'livekit-client';
import {
    Captions,
    Hand,
    Keyboard,
    MessageSquare,
    Mic,
    MicOff,
    MonitorUp,
    MoreHorizontal,
    Settings2,
    Timer,
    Users,
    Video,
    VideoOff,
} from 'lucide-react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import {
    lazy,
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Badge } from '@/components/ui/badge';
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
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/features/tasks/lib/api';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';
import { useNow } from '../meetings-context';
import { ConsentCard, LiveChip, useConsent } from '../notulen/consent';
import type { AttendanceRoster } from './api';
import { RoomApiError, videoApi } from './api';
import type { Room } from './contract';
import { attendanceRows, navigatorSections } from './contract';
import {
    elapsedClock,
    isMacPlatform,
    shortcutAction,
    shortcutLabel,
} from './lib';
import { CAPTION_SOURCE } from './captions';
import { BarKey, ControlBar, LeaveKey } from './room-bar';
import { CaptionBox, useCaptions } from './room-captions';
import type { DocPresence } from './room-doc';
import { docAnchor, MinutesDoc } from './room-doc';
import type { MinutesSync } from './room-minutes';
import { MinutesProvider, useRoomMinutes } from './room-minutes';
import { emitRoomNotice, useRoomNotices } from './room-notices';
import type { PanelKind } from './room-panels';
import { ChatPanel, SettingsPanel, SidePanel } from './room-panels';
import {
    resolvePerson,
    RoomPeopleProvider,
    useRoomPeople,
} from './room-people';
import { AttendancePanel, SectionNav, TalkTimePanel } from './room-side';
import type { TileRef } from './room-tiles';
import { Filmstrip, ParticipantTile, ScreenShare, tileKey } from './room-tiles';
import { talkRows, talkSummary } from './talk-time';
import type {
    MinutesEditingHolder,
    OwnAttributes,
    RoomParticipant,
} from './types';
import { useRoomLive } from './use-room-live';
import { TalkStore, useTalkReporting, useTalkTotals } from './use-talk-time';
import type { RoomStatus } from './use-video-room';
import { mediaErrorMessage } from './use-video-room';

/** Tiptap + Yjs only load when the minutes are collaborative. */
const NoteEditor = lazy(() =>
    import('@/features/notes/note-editor').then((module) => ({
        default: module.NoteEditor,
    })),
);

/** The auto-minutes worker is not a person: no tile, notice or bar. */
const isAgent = (identity: string) => identity === CAPTION_SOURCE;

/** LiveKit attribute: which part of the minutes this person is typing in. */
const PRESENCE_ATTRIBUTE = 'rk_minutes_at';

/**
 * "Not typing": "" removes the attribute (contract; accepted since audit
 * B-04, 1fa3519). "off" is still ignored when read, for rooms where an older
 * client set it.
 */
const PRESENCE_OFF = '';
const PRESENCE_LEGACY_OFF = 'off';

const SHORTCUTS = [
    ['toggle-mic', 'Nyalakan/matikan mikrofon'],
    ['toggle-camera', 'Nyalakan/matikan kamera'],
    ['toggle-hand', 'Angkat/turunkan tangan'],
    ['toggle-captions', 'Tampilkan/sembunyikan subtitle'],
    ['toggle-chat', 'Buka/tutup obrolan'],
    ['toggle-people', 'Buka/tutup kehadiran'],
] as const;

const AVATAR_TONE: Record<RoomParticipant['tone'], string> = {
    blue: 'bg-avatar-blue text-avatar-blue-fg',
    teal: 'bg-avatar-teal text-avatar-teal-fg',
    amber: 'bg-avatar-amber text-avatar-amber-fg',
};

const PRESENCE_EVENTS = [
    RoomEvent.ParticipantConnected,
    RoomEvent.ParticipantDisconnected,
    RoomEvent.ParticipantAttributesChanged,
];

const useIsMac = () =>
    useMemo(
        () =>
            typeof navigator !== 'undefined' &&
            isMacPlatform(navigator.platform || navigator.userAgent),
        [],
    );

/**
 * Own LiveKit attributes go through the server (`POST links.attributes`,
 * tokens cannot set them — audit R-05). Older backends: set them directly.
 */
function useSetOwnAttributes(room: Room) {
    const { localParticipant } = useRoomContext();
    const url = room.links.attributes;

    return useCallback(
        (attributes: OwnAttributes) =>
            (url
                ? videoApi.attributes(url, attributes)
                : localParticipant.setAttributes(
                      attributes as Record<string, string>,
                  )
            ).catch(() => undefined),
        [url, localParticipant],
    );
}

// ---------------------------------------------------------------------------
// Leaves: each subscribes to what it shows, so the room does not re-render
// as a whole on every speaker, attribute or clock tick (audit §4).
// ---------------------------------------------------------------------------

function Notices() {
    const notices = useRoomNotices();

    return (
        <ul
            aria-live="polite"
            className="pointer-events-none absolute inset-x-0 top-3 z-30 flex flex-col items-center gap-2 px-3"
        >
            {notices.map((notice) => (
                <li
                    key={notice.id}
                    className={cn(
                        'inline-flex max-w-full items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold shadow-inverse',
                        notice.tone === 'error'
                            ? 'bg-danger text-on-danger'
                            : 'bg-room-bar text-on-room-bar',
                    )}
                >
                    {notice.tone === 'hand' && (
                        <Hand aria-hidden className="size-4" />
                    )}
                    {notice.text}
                </li>
            ))}
        </ul>
    );
}

/** "00:18:42" since the meeting started (its own 1 s tick). */
function RoomClock({ startsAt }: { startsAt: string }) {
    const now = useNow(1000);
    const start = Date.parse(startsAt);

    if (now < start) {
        return null;
    }

    const clock = elapsedClock(now - start);

    return (
        <span
            className="shrink-0 pt-1 font-mono text-[13px] text-text-muted tnum"
            aria-label={`Rapat berjalan ${clock}`}
        >
            {clock}
        </span>
    );
}

/** Cameras in roster order (organizer, minute taker, then names). */
function useCameras(): { cameras: TileRef[]; activeKey: string | null } {
    const people = useRoomPeople();
    const tracks = useTracks(
        [{ source: Track.Source.Camera, withPlaceholder: true }],
        { onlySubscribed: false },
    );
    const speakers = useSpeakingParticipants();
    const last = useRef<string | null>(null);

    // Like Meet: the widest tile is the last *other* person who spoke.
    const speaker = speakers.find((p) => !p.isLocal && !isAgent(p.identity));

    if (speaker) {
        last.current = speaker.identity;
    }

    const cameras = useMemo(
        () =>
            tracks
                .filter((ref) => !isAgent(ref.participant.identity))
                .sort(
                    (a, b) =>
                        (people.get(a.participant.identity)?.seat ?? 99) -
                            (people.get(b.participant.identity)?.seat ?? 99) ||
                        a.participant.identity.localeCompare(
                            b.participant.identity,
                        ),
                ),
        [tracks, people],
    );
    const active =
        cameras.find((ref) => ref.participant.identity === last.current) ??
        cameras.find((ref) => !ref.participant.isLocal) ??
        cameras[0];

    return { cameras, activeKey: active ? tileKey(active) : null };
}

function StripLive({ compact }: { compact: boolean }) {
    const { cameras, activeKey } = useCameras();

    return (
        <Filmstrip cameras={cameras} activeKey={activeKey} compact={compact} />
    );
}

function MobileStageLive({ screen }: { screen: TileRef | null }) {
    const { cameras, activeKey } = useCameras();
    const big = cameras.find((ref) => tileKey(ref) === activeKey) ?? null;
    const others = cameras.filter(
        (ref) => screen !== null || tileKey(ref) !== activeKey,
    );

    return (
        <>
            {screen ? (
                <div className="aspect-[4/3] w-full shrink-0">
                    <ScreenShare trackRef={screen} />
                </div>
            ) : (
                big && (
                    <ParticipantTile
                        trackRef={big}
                        fullName
                        className="aspect-[358/330] w-full shrink-0 rounded-[22px]"
                    />
                )
            )}
            <ul aria-label="Peserta lain" className="grid grid-cols-3 gap-2">
                {others.map((ref) => (
                    <li key={tileKey(ref)} className="aspect-square">
                        <ParticipantTile
                            trackRef={ref}
                            className="size-full rounded-[18px]"
                        />
                    </li>
                ))}
            </ul>
        </>
    );
}

/** Avatars of who is in the room + who speaks (phone "Notulen" tab). */
function NotesAvatarsLive() {
    const people = useRoomPeople();
    const participants = useParticipants({
        updateOnlyOn: [
            RoomEvent.ParticipantConnected,
            RoomEvent.ParticipantDisconnected,
            RoomEvent.ActiveSpeakersChanged,
        ],
    });
    const speaking = participants.find(
        (p) => p.isSpeaking && !isAgent(p.identity),
    );
    const present = participants
        .filter((p) => !isAgent(p.identity))
        .map((p) => resolvePerson(people, p.identity));

    return (
        <div className="flex shrink-0 items-center gap-1.5 px-4 pt-3 pb-3">
            {present.slice(0, 5).map((person) => (
                <span
                    key={person.id}
                    className={cn(
                        'flex size-[34px] items-center justify-center rounded-full text-[13px] font-bold',
                        AVATAR_TONE[people.get(person.id)?.tone ?? 'blue'],
                        person.id === speaking?.identity &&
                            'ring-[3px] ring-primary',
                    )}
                    aria-hidden
                >
                    {people.get(person.id)?.initials ?? '?'}
                </span>
            ))}
            {present.length > 5 && (
                <Badge variant="secondary" className="h-[34px] rounded-full">
                    +{present.length - 5}
                </Badge>
            )}
            <span className="ml-1 truncate text-[13px] text-text-muted">
                {speaking
                    ? `${resolvePerson(people, speaking.identity).first_name} bicara`
                    : `${present.length} di ruang`}
            </span>
        </div>
    );
}

/** "Waktu bicara" bars (throttled to 1 s while someone speaks). */
function TalkLive({
    store,
    roster,
}: {
    store: TalkStore;
    roster: AttendanceRoster;
}) {
    const people = useRoomPeople();
    const participants = useParticipants({
        updateOnlyOn: [
            RoomEvent.ParticipantConnected,
            RoomEvent.ParticipantDisconnected,
        ],
    });
    const { totals, silent } = useTalkTotals(store);
    const ids = [
        ...new Set([
            ...participants.map((p) => p.identity),
            ...roster.attendance.map((row) => row.user_id),
            ...silent,
        ]),
    ].filter((id) => !isAgent(id));
    const rows = talkRows(totals, ids);

    return (
        <TalkTimePanel
            rows={rows}
            summary={talkSummary(
                rows,
                (id) => resolvePerson(people, id).first_name,
            )}
        />
    );
}

function NavLive({
    agenda,
    container,
}: {
    agenda: string[];
    container: HTMLElement | null;
}) {
    const { data } = useRoomMinutes();
    const sections = navigatorSections(data?.minutes ?? null, agenda);
    const keys = sections.map((section) => section.key).join('|');
    const [active, setActive] = useState<string | null>(
        sections[0]?.key ?? null,
    );

    // Section at the top of the paper.
    useEffect(() => {
        if (!container || typeof IntersectionObserver === 'undefined') {
            return;
        }

        const visible = new Map<string, number>();
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const key = entry.target.id.replace(/^notulen-/, '');

                    if (entry.isIntersecting) {
                        visible.set(key, entry.boundingClientRect.top);
                    } else {
                        visible.delete(key);
                    }
                }

                const first = [...visible.entries()].sort(
                    (a, b) => a[1] - b[1],
                )[0];

                if (first) {
                    setActive(first[0]);
                }
            },
            { root: container, rootMargin: '0px 0px -55% 0px' },
        );

        for (const key of keys.split('|')) {
            const element = document.getElementById(docAnchor(key));

            if (element) {
                observer.observe(element);
            }
        }

        return () => observer.disconnect();
    }, [container, keys]);

    const jump = (key: string) => {
        // Collaborative minutes: sections are headings inside the editor.
        const title = sections.find((section) => section.key === key)?.title;
        const target =
            document.getElementById(docAnchor(key)) ??
            [
                ...document.querySelectorAll<HTMLElement>(
                    '[data-testid="minutes-doc"] h2, [data-testid="minutes-doc"] h3',
                ),
            ].find((heading) => heading.textContent?.trim() === title);

        if (!target) {
            return;
        }

        const reduce = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches;
        target.scrollIntoView({
            behavior: reduce ? 'auto' : 'smooth',
            block: 'start',
        });
        const field = target.querySelector<HTMLElement>('textarea, input');
        (field ?? target).focus({ preventScroll: true });
        setActive(key);
    };

    return <SectionNav sections={sections} active={active} onJump={jump} />;
}

/** The minutes document + who is typing where (attribute presence). */
function DocLive({
    room,
    variant,
    editingHolder,
}: {
    room: Room;
    variant: 'page' | 'column' | 'sheet';
    editingHolder: MinutesEditingHolder | null;
}) {
    const { data, collab } = useRoomMinutes();
    const people = useRoomPeople();
    const participants = useParticipants({ updateOnlyOn: PRESENCE_EVENTS });
    const setOwn = useSetOwnAttributes(room);
    const editingUrl =
        room.minutes?.mode === 'autosave'
            ? (room.minutes.links.editing ?? null)
            : null;
    const [focused, setFocused] = useState<string | null>(null);
    const presence: DocPresence = {};
    const editors: RoomParticipant[] = [];

    for (const participant of participants) {
        const at = participant.attributes[PRESENCE_ATTRIBUTE];
        const person = people.get(participant.identity);

        if (!at || at === PRESENCE_LEGACY_OFF || !person) {
            continue;
        }

        editors.push(person);

        if (!participant.isLocal) {
            (presence[at] ??= []).push(person);
        }
    }

    // Where I am typing: LiveKit attribute (debounced) for the name flags,
    // plus the autosave "X sedang menyunting" heartbeat every 15 s.
    const sent = useRef<string | null>(null);

    useEffect(() => {
        // Nothing to clear before I first typed somewhere.
        if (focused === sent.current) {
            return;
        }

        const id = window.setTimeout(() => {
            sent.current = focused;
            void setOwn({ [PRESENCE_ATTRIBUTE]: focused ?? PRESENCE_OFF });
        }, 400);

        return () => window.clearTimeout(id);
    }, [focused, setOwn]);

    const typing = focused !== null;

    useEffect(() => {
        if (!editingUrl || !typing) {
            return;
        }

        const beat = () =>
            void videoApi.editing(editingUrl, true).catch(() => undefined);
        beat();
        const id = window.setInterval(beat, 15_000);

        return () => {
            window.clearInterval(id);
            void videoApi.editing(editingUrl, false).catch(() => undefined);
        };
    }, [editingUrl, typing]);

    const focusPart = useCallback((key: string | null) => setFocused(key), []);

    if (!data) {
        return (
            <div className="flex flex-col gap-2 px-6 py-10 text-center text-text-muted">
                <p className="text-[16px] font-semibold text-text">
                    Notulen belum bisa dibuka di ruang ini.
                </p>
                <a
                    href={room.meeting.minutes_href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[15px] font-semibold text-link underline"
                >
                    Buka halaman notulen di tab baru
                </a>
            </div>
        );
    }

    return (
        <MinutesDoc
            data={data}
            title={room.meeting.title}
            date={room.meeting.starts_at}
            participants={room.participants}
            presence={presence}
            editors={editors}
            onFocusPart={focusPart}
            variant={variant}
            quickAdd={variant === 'sheet'}
            viewerId={room.viewer.id}
            editingName={
                editingHolder && editingHolder.user_id !== room.viewer.id
                    ? resolvePerson(people, editingHolder.user_id).first_name
                    : null
            }
            collabBody={
                collab.mode === 'live' ? (
                    <Suspense fallback={<Spinner />}>
                        <NoteEditor
                            live={collab.live}
                            initial={null}
                            editable={collab.canEdit}
                            me={{ id: room.viewer.id, name: room.viewer.name }}
                            workspaceKey={room.meeting.workspace?.key ?? null}
                            onReady={() => undefined}
                        />
                    </Suspense>
                ) : collab.mode === 'waiting' ? (
                    <p
                        role="status"
                        className="rounded-control bg-surface-2 px-4 py-3 text-[15px] text-text-muted"
                    >
                        Notulen belum dimulai. Halaman ini terbuka sendiri
                        begitu notulis mulai menulis.
                    </p>
                ) : undefined
            }
        />
    );
}

/** Captions box: subscribes to `lk.transcription` (only from rk-notulen). */
function CaptionsLive({
    live,
    show,
    onAvailable,
    className,
    boxClassName,
}: {
    live: LiveRoom;
    show: boolean;
    onAvailable: () => void;
    className: string;
    boxClassName?: string;
}) {
    const people = useRoomPeople();
    const { available, visible } = useCaptions(live);

    useEffect(() => {
        if (available) {
            onAvailable();
        }
    }, [available, onAvailable]);

    if (!available || !show) {
        return null;
    }

    return (
        <div className={className}>
            <CaptionBox
                lines={visible}
                nameOf={(identity) =>
                    resolvePerson(people, identity).first_name
                }
                seatOf={(identity) => resolvePerson(people, identity).seat}
                className={boxClassName}
            />
        </div>
    );
}

type BarProps = {
    size: 'md' | 'lg';
    panel: PanelKind | null;
    setPanel: Dispatch<SetStateAction<PanelKind | null>>;
    unread: number;
    captionsAvailable: boolean;
    captionsOn: boolean;
    setCaptionsOn: Dispatch<SetStateAction<boolean>>;
    autoMinutes: boolean;
    tablet: boolean;
    onShortcuts: () => void;
    onLeave: () => void;
    /** POST { raised } — the server sets the `hand` attribute (R-05). */
    handUrl: string | null;
};

/** Control bar + keyboard shortcuts (local participant state lives here). */
function BarLive({
    size,
    panel,
    setPanel,
    unread,
    captionsAvailable,
    captionsOn,
    setCaptionsOn,
    autoMinutes,
    tablet,
    onShortcuts,
    onLeave,
    handUrl,
}: BarProps) {
    const isMac = useIsMac();
    const mobile = size === 'lg';
    const {
        localParticipant,
        isMicrophoneEnabled,
        isCameraEnabled,
        isScreenShareEnabled,
    } = useLocalParticipant();
    const hand = localParticipant.attributes.hand ?? '';
    const canShare =
        !mobile &&
        typeof navigator !== 'undefined' &&
        typeof navigator.mediaDevices?.getDisplayMedia === 'function';

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
        void (
            handUrl
                ? videoApi.hand(handUrl, !hand)
                : localParticipant.setAttributes({
                      hand: hand ? '' : String(Date.now()),
                  })
        ).catch(() =>
            emitRoomNotice('Tangan gagal diangkat. Coba lagi.', 'error'),
        );
    const toggle = (kind: PanelKind) =>
        setPanel((open) => (open === kind ? null : kind));

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
                'toggle-chat': () => toggle('chat'),
                'toggle-people': () => toggle('attendance'),
                'toggle-hand': toggleHand,
                'toggle-captions': () => setCaptionsOn((on) => !on),
            })[action]();
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    });

    const keys = {
        mic: (
            <BarKey
                size={size}
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
            </BarKey>
        ),
        camera: (
            <BarKey
                size={size}
                label={isCameraEnabled ? 'Matikan kamera' : 'Nyalakan kamera'}
                shortcut={shortcutLabel('toggle-camera', isMac)}
                off={!isCameraEnabled}
                onClick={toggleCamera}
            >
                {isCameraEnabled ? (
                    <Video aria-hidden />
                ) : (
                    <VideoOff aria-hidden />
                )}
            </BarKey>
        ),
        hand: (
            <BarKey
                size={size}
                label={hand ? 'Turunkan tangan' : 'Angkat tangan'}
                shortcut={shortcutLabel('toggle-hand', isMac)}
                active={Boolean(hand)}
                onClick={toggleHand}
            >
                <Hand aria-hidden />
            </BarKey>
        ),
        chat: (
            <BarKey
                size={size}
                label="Obrolan"
                shortcut={shortcutLabel('toggle-chat', isMac)}
                active={panel === 'chat'}
                onClick={() => toggle('chat')}
                badge={unread}
            >
                <MessageSquare aria-hidden />
            </BarKey>
        ),
        more: (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <BarKey
                        label="Opsi lainnya"
                        size={size}
                        aria-haspopup="menu"
                    >
                        <MoreHorizontal aria-hidden />
                    </BarKey>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top" className="w-64">
                    {(mobile || tablet) && (
                        <>
                            <DropdownMenuItem
                                onSelect={() => setPanel('attendance')}
                            >
                                <Users aria-hidden />
                                Kehadiran
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setPanel('talk')}>
                                <Timer aria-hidden />
                                Waktu bicara
                            </DropdownMenuItem>
                        </>
                    )}
                    {mobile && captionsAvailable && (
                        <DropdownMenuItem
                            onSelect={() => setCaptionsOn((on) => !on)}
                        >
                            <Captions aria-hidden />
                            {captionsOn
                                ? 'Sembunyikan subtitle'
                                : 'Tampilkan subtitle'}
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => setPanel('settings')}>
                        <Settings2 aria-hidden />
                        {autoMinutes
                            ? 'Setelan perangkat & transkrip'
                            : 'Setelan perangkat'}
                    </DropdownMenuItem>
                    {!mobile && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={onShortcuts}>
                                <Keyboard aria-hidden />
                                Pintasan keyboard
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        ),
    };

    if (mobile) {
        return (
            <div
                role="toolbar"
                aria-label="Kontrol rapat"
                className="flex w-full items-center justify-between gap-1.5"
            >
                {keys.mic}
                {keys.camera}
                {keys.hand}
                {keys.chat}
                {keys.more}
                <LeaveKey size="lg" onClick={onLeave} />
            </div>
        );
    }

    return (
        <ControlBar>
            {keys.mic}
            {keys.camera}
            {canShare && (
                <BarKey
                    label={
                        isScreenShareEnabled
                            ? 'Berhenti presentasi'
                            : 'Bagikan layar'
                    }
                    active={isScreenShareEnabled}
                    onClick={toggleScreen}
                >
                    <MonitorUp aria-hidden />
                </BarKey>
            )}
            {keys.hand}
            {captionsAvailable && (
                <BarKey
                    label={
                        captionsOn
                            ? 'Sembunyikan subtitle'
                            : 'Tampilkan subtitle'
                    }
                    shortcut={shortcutLabel('toggle-captions', isMac)}
                    active={captionsOn}
                    onClick={() => setCaptionsOn((on) => !on)}
                >
                    <Captions aria-hidden />
                </BarKey>
            )}
            {keys.chat}
            <BarKey
                label="Kehadiran"
                shortcut={shortcutLabel('toggle-people', isMac)}
                active={panel === 'attendance'}
                onClick={() => toggle('attendance')}
            >
                <Users aria-hidden />
            </BarKey>
            {keys.more}
            <LeaveKey onClick={onLeave} />
        </ControlBar>
    );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

/**
 * The joined room. Desktop: filmstrip on top, the live minutes on paper in
 * the centre, "Bagian" on the left, "Waktu bicara" (or an open panel) on
 * the right, the compact dark bar bottom centre with captions above it;
 * a shared screen moves the minutes into a right column (Presentasi).
 * Phone: tabs Video | Notulen. Keyboard shortcuts as in Google Meet.
 * Names and avatars always come from the server's participant list (R-05).
 */
export function ConnectedRoom({
    room,
    live,
    status,
    onLeave,
}: {
    room: Room;
    live: LiveRoom;
    status: RoomStatus;
    onLeave: () => void;
}) {
    const breakpoint = useBreakpoint() ?? 'desktop';
    const mobile = breakpoint === 'mobile';
    const isMac = useIsMac();
    const [panel, setPanel] = useState<PanelKind | null>(null);
    const [captionsOn, setCaptionsOn] = useState(true);
    const [captionsAvailable, setCaptionsAvailable] = useState(false);
    const [tab, setTab] = useState<'video' | 'notes'>('video');
    const [notesUnseen, setNotesUnseen] = useState(false);
    const [seenMessages, setSeenMessages] = useState(0);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const [paper, setPaper] = useState<HTMLElement | null>(null);
    const [roster, setRoster] = useState<AttendanceRoster>(() => ({
        attendance: room.video.attendance,
        in_room: room.video.in_room,
        not_joined: room.video.not_joined ?? [],
        late_grace_minutes: room.video.late_grace_minutes ?? 2,
        removed: room.video.removed ?? [],
    }));
    const [calling, setCalling] = useState<Set<string>>(new Set());
    const minutesSync: MinutesSync = useRef(null);
    const tabRef = useRef(tab);
    tabRef.current = tab;
    const people = useMemo(
        () => new Map(room.participants.map((p) => [p.id, p])),
        [room.participants],
    );
    const nameOf = (identity: string) => resolvePerson(people, identity).name;

    const chat = useChat();
    const screen =
        useTracks(
            [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
            { onlySubscribed: false },
        )[0] ?? null;
    const onCaptionsAvailable = useCallback(
        () => setCaptionsAvailable(true),
        [],
    );

    // Speaking time (outside React state; only the panel subscribes).
    const [talk] = useState(() => new TalkStore(room.viewer.id, room.speaking));
    useTalkReporting({
        store: talk,
        room: live,
        reportUrl: room.links.speaking,
        canReport: room.can.report_speaking,
        connected: status.kind === 'connected',
        intervalSeconds: room.speaking?.interval_seconds ?? 15,
    });

    // The choice is private: only the server tells the worker (contract
    // notulen §2.1), never a LiveKit attribute everyone in the room can read.
    const consent = useConsent(room.notulen);
    const [editingHolder, setEditingHolder] =
        useState<MinutesEditingHolder | null>(room.minutes?.editing ?? null);
    const autoMinutes = room.features.auto_minutes;

    useRoomLive({
        room: live,
        connected: status.kind === 'connected',
        channel: room.channel,
        date: room.meeting.occurrence_date,
        me: room.viewer.id,
        minutesUrl: room.minutes?.links.data ?? null,
        attendanceUrl: room.links.attendance,
        speakingUrl: room.links.speaking,
        realtime: room.features.realtime,
        handlers: {
            onMinutes: (minutes) => {
                minutesSync.current?.(minutes);

                if (tabRef.current === 'video') {
                    setNotesUnseen(true);
                }
            },
            onAttendance: setRoster,
            onSpeaking: talk.apply,
            onEditing: setEditingHolder,
            onReadmitted: (userId) =>
                setRoster((current) => ({
                    ...current,
                    removed: (current.removed ?? []).filter(
                        (row) => row.user_id !== userId,
                    ),
                })),
        },
    });

    // Chat badge.
    const unread =
        panel === 'chat' ? 0 : chat.chatMessages.length - seenMessages;

    useEffect(() => {
        if (panel === 'chat') {
            setSeenMessages(chat.chatMessages.length);
        }
    }, [panel, chat.chatMessages.length]);

    useEffect(() => {
        if (tab === 'notes') {
            setNotesUnseen(false);
        }
    }, [tab]);

    // Join / leave / raised hand notices (names from the server list).
    useEffect(() => {
        const name = (p: Participant) => resolvePerson(people, p.identity).name;
        const onJoin = (p: Participant) =>
            !isAgent(p.identity) && emitRoomNotice(`${name(p)} bergabung`);
        const onLeft = (p: Participant) =>
            !isAgent(p.identity) && emitRoomNotice(`${name(p)} keluar`);
        const onAttributes = (
            changed: Record<string, string>,
            p: Participant,
        ) => {
            if (!p.isLocal && 'hand' in changed && Number(changed.hand) > 0) {
                emitRoomNotice(`${name(p)} mengangkat tangan`, 'hand');
            }
        };

        live.on(RoomEvent.ParticipantConnected, onJoin)
            .on(RoomEvent.ParticipantDisconnected, onLeft)
            .on(RoomEvent.ParticipantAttributesChanged, onAttributes);

        return () => {
            live.off(RoomEvent.ParticipantConnected, onJoin)
                .off(RoomEvent.ParticipantDisconnected, onLeft)
                .off(RoomEvent.ParticipantAttributesChanged, onAttributes);
        };
    }, [live, people]);

    const call = (userId: string) => {
        if (!room.links.call) {
            return;
        }

        setCalling((set) => new Set(set).add(userId));
        videoApi
            .call(room.links.call, userId)
            .then(({ called }) => {
                emitRoomNotice(`${nameOf(userId)} dipanggil`);
                setRoster((current) => ({
                    ...current,
                    not_joined: current.not_joined.map((row) =>
                        row.user_id === userId
                            ? { ...row, called_at: called.called_at }
                            : row,
                    ),
                }));
            })
            .catch((error: unknown) => {
                emitRoomNotice(
                    error instanceof ApiError
                        ? error.message
                        : 'Panggilan gagal. Coba lagi.',
                    'error',
                );

                // 429: "Lukman baru saja dipanggil" — keep the button off
                // for the cooldown the server gives.
                return error instanceof RoomApiError && error.retryAfter
                    ? new Promise((resolve) =>
                          window.setTimeout(resolve, error.retryAfter! * 1000),
                      )
                    : undefined;
            })
            .finally(() =>
                setCalling((set) => {
                    const next = new Set(set);
                    next.delete(userId);

                    return next;
                }),
            );
    };
    const mute = (participant: Participant, trackSid: string) =>
        videoApi
            .mute(
                room.meeting.id,
                room.meeting.occurrence_date,
                participant.identity,
                trackSid,
            )
            .then(() =>
                emitRoomNotice(
                    `Mikrofon ${nameOf(participant.identity)} dimatikan.`,
                ),
            )
            .catch((error: Error) => emitRoomNotice(error.message, 'error'));
    const remove = (participant: Participant) =>
        videoApi
            .remove(
                room.meeting.id,
                room.meeting.occurrence_date,
                participant.identity,
            )
            .then(() =>
                emitRoomNotice(
                    `${nameOf(participant.identity)} dikeluarkan dari rapat.`,
                ),
            )
            .catch((error: Error) => emitRoomNotice(error.message, 'error'));

    const readmit = (userId: string) => {
        if (!room.links.readmit) {
            return;
        }

        videoApi
            .readmit(room.links.readmit, userId)
            .then(() => {
                emitRoomNotice(`${nameOf(userId)} boleh masuk lagi`);
                setRoster((current) => ({
                    ...current,
                    removed: (current.removed ?? []).filter(
                        (row) => row.user_id !== userId,
                    ),
                }));
            })
            .catch((error: Error) => emitRoomNotice(error.message, 'error'));
    };

    const attendance = attendanceRows({
        meeting: room.meeting,
        participants: room.participants,
        video: {
            ...room.video,
            attendance: roster.attendance,
            not_joined: room.video.not_joined ? roster.not_joined : undefined,
            late_grace_minutes: roster.late_grace_minutes,
            removed: roster.removed ?? room.video.removed,
        },
    });

    const panelTitle: Record<PanelKind, string> = {
        attendance: 'Kehadiran',
        chat: 'Obrolan',
        settings: 'Setelan',
        talk: 'Waktu bicara',
    };
    const panelBody = (kind: PanelKind): ReactNode =>
        kind === 'attendance' ? (
            <div className="flex min-h-0 flex-1 flex-col px-[18px] pb-[18px]">
                <AttendancePanel
                    rows={attendance}
                    canCall={Boolean(
                        room.links.call && room.can.call_participants,
                    )}
                    calling={calling}
                    onCall={call}
                    canModerate={room.can.moderate}
                    onMute={mute}
                    onRemove={remove}
                    onReadmit={room.links.readmit ? readmit : null}
                />
            </div>
        ) : kind === 'chat' ? (
            <ChatPanel chat={chat} autoFocus={!mobile} />
        ) : kind === 'talk' ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-[18px]">
                <TalkLive store={talk} roster={roster} />
            </div>
        ) : (
            <SettingsPanel>
                {autoMinutes && room.notulen && (
                    <ConsentCard
                        notulen={room.notulen}
                        consent={consent}
                        className="shadow-none"
                    />
                )}
            </SettingsPanel>
        );
    const sidePanel = panel && (
        <SidePanel
            title={panelTitle[panel]}
            aside={panel === 'attendance' ? 'otomatis dari ruang' : undefined}
            mobile={mobile}
            onClose={() => setPanel(null)}
            className={mobile ? undefined : 'h-full'}
        >
            {panelBody(panel)}
        </SidePanel>
    );

    const bar = (
        <BarLive
            size={mobile ? 'lg' : 'md'}
            panel={panel}
            setPanel={setPanel}
            unread={unread}
            captionsAvailable={captionsAvailable}
            captionsOn={captionsOn}
            setCaptionsOn={setCaptionsOn}
            autoMinutes={autoMinutes}
            tablet={breakpoint === 'tablet'}
            onShortcuts={() => setShortcutsOpen(true)}
            onLeave={onLeave}
            handUrl={room.links.hand}
        />
    );
    const overlay = (
        <>
            <Notices />
            {status.kind === 'reconnecting' && (
                <div
                    role="status"
                    className="absolute inset-x-0 top-3 z-30 flex justify-center px-3"
                >
                    <span className="inline-flex items-center gap-2 rounded-full bg-warning-soft px-4 py-2 text-[15px] font-semibold text-warning shadow-card">
                        <Spinner className="size-4" />
                        Menyambungkan ulang…
                    </span>
                </div>
            )}
            <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Pintasan keyboard</DialogTitle>
                        <DialogDescription>
                            Sama seperti Google Meet.
                        </DialogDescription>
                    </DialogHeader>
                    <dl className="flex flex-col">
                        {SHORTCUTS.map(([action, label]) => (
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

    const layout = mobile ? (
        <MobileRoom
            tab={tab}
            onTab={setTab}
            notesUnseen={notesUnseen}
            stage={<MobileStageLive screen={screen} />}
            chip={
                <LiveChip
                    autoMinutes={autoMinutes}
                    subtitles={captionsAvailable}
                    className="mx-4 mt-2 self-start"
                />
            }
            doc={
                <DocLive
                    room={room}
                    variant="sheet"
                    editingHolder={editingHolder}
                />
            }
            captions={
                <CaptionsLive
                    live={live}
                    show={captionsOn && tab === 'video'}
                    onAvailable={onCaptionsAvailable}
                    className="pointer-events-none absolute inset-x-4 bottom-[100px] z-10"
                    boxClassName="px-3.5 py-2.5"
                />
            }
            bar={bar}
            panel={sidePanel}
            overlay={overlay}
        />
    ) : (
        <DesktopRoom
            wide={breakpoint === 'desktop'}
            screen={screen}
            clock={<RoomClock startsAt={room.meeting.starts_at} />}
            paperRef={setPaper}
            doc={
                <DocLive
                    room={room}
                    variant={screen ? 'column' : 'page'}
                    editingHolder={editingHolder}
                />
            }
            nav={
                <NavLive agenda={room.meeting.agenda ?? []} container={paper} />
            }
            chip={
                <LiveChip
                    autoMinutes={autoMinutes}
                    subtitles={captionsAvailable}
                />
            }
            talk={<TalkLive store={talk} roster={roster} />}
            panel={sidePanel}
            captions={
                <CaptionsLive
                    live={live}
                    show={captionsOn}
                    onAvailable={onCaptionsAvailable}
                    className="pointer-events-none absolute inset-x-0 bottom-[86px] z-10 mx-auto w-[min(700px,calc(100%-32px))]"
                />
            }
            bar={bar}
            overlay={overlay}
        />
    );

    return (
        <RoomPeopleProvider participants={room.participants}>
            <MinutesProvider room={room} live={live} syncRef={minutesSync}>
                {layout}
            </MinutesProvider>
        </RoomPeopleProvider>
    );
}

function DesktopRoom({
    wide,
    screen,
    clock,
    paperRef,
    doc,
    nav,
    chip,
    talk,
    panel,
    captions,
    bar,
    overlay,
}: {
    wide: boolean;
    screen: TileRef | null;
    clock: ReactNode;
    paperRef: (element: HTMLElement | null) => void;
    doc: ReactNode;
    nav: ReactNode;
    chip: ReactNode;
    talk: ReactNode;
    panel: ReactNode;
    captions: ReactNode;
    bar: ReactNode;
    overlay: ReactNode;
}) {
    const presenting = screen !== null;
    const paper = (
        <div
            ref={paperRef}
            tabIndex={-1}
            className="min-h-0 [scrollbar-gutter:stable] overflow-y-auto rounded-t-[6px] bg-surface shadow-card outline-none"
        >
            {doc}
        </div>
    );

    return (
        <div className="relative flex min-h-0 flex-1 flex-col">
            <header className="flex shrink-0 items-start gap-4 px-5 pt-5">
                <div className="min-w-0 flex-1">
                    <StripLive compact={presenting} />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                    {clock}
                    {!wide && !presenting && chip}
                </div>
            </header>

            {presenting ? (
                <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] gap-5 px-5 pt-3">
                    <div className="min-h-0 pb-[90px]">
                        <ScreenShare trackRef={screen} />
                    </div>
                    <div className="flex min-h-0 flex-col gap-2">
                        <span className="flex flex-wrap items-center justify-between gap-2 pl-2.5 text-[13px] font-semibold text-text-muted">
                            <span className="whitespace-nowrap">
                                Notulen tetap bisa diketik
                            </span>
                            {chip}
                        </span>
                        {paper}
                    </div>
                    {panel && (
                        <div className="absolute top-[150px] right-5 bottom-[90px] z-20 w-[300px]">
                            {panel}
                        </div>
                    )}
                </main>
            ) : (
                <main
                    className={cn(
                        'grid min-h-0 flex-1 gap-6 px-6 pt-[26px]',
                        !wide && 'grid-cols-[minmax(0,1fr)]',
                        wide &&
                            !panel &&
                            'grid-cols-[200px_minmax(0,1fr)_220px] 2xl:grid-cols-[220px_minmax(0,1fr)_260px]',
                        wide &&
                            panel &&
                            'grid-cols-[200px_minmax(0,1fr)_300px]',
                    )}
                >
                    {wide && (
                        <div className="min-h-0 overflow-y-auto pt-6">
                            {nav}
                        </div>
                    )}
                    <div className="mx-auto flex min-h-0 w-full max-w-[820px] flex-col">
                        {paper}
                    </div>
                    {wide && (
                        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pb-[90px]">
                            {panel ?? (
                                <div className="flex flex-col gap-4 pt-1">
                                    {chip}
                                    {talk}
                                </div>
                            )}
                        </div>
                    )}
                    {!wide && panel && (
                        <div className="absolute top-[170px] right-5 bottom-[90px] z-20 w-[320px]">
                            {panel}
                        </div>
                    )}
                </main>
            )}

            {captions}
            <div className="absolute bottom-[18px] left-1/2 z-20 -translate-x-1/2">
                {bar}
            </div>
            {overlay}
        </div>
    );
}

function MobileRoom({
    tab,
    onTab,
    notesUnseen,
    stage,
    chip,
    doc,
    captions,
    bar,
    panel,
    overlay,
}: {
    tab: 'video' | 'notes';
    onTab: (tab: 'video' | 'notes') => void;
    notesUnseen: boolean;
    stage: ReactNode;
    chip: ReactNode;
    doc: ReactNode;
    captions: ReactNode;
    bar: ReactNode;
    panel: ReactNode;
    overlay: ReactNode;
}) {
    return (
        <div className="relative flex min-h-0 flex-1 flex-col">
            <div
                role="tablist"
                aria-label="Tampilan ruang rapat"
                className="mx-4 mt-3 flex shrink-0 gap-1 rounded-[14px] bg-tile-off p-1"
            >
                {(['video', 'notes'] as const).map((value) => (
                    <button
                        key={value}
                        type="button"
                        role="tab"
                        id={`room-tab-${value}`}
                        aria-controls={`room-panel-${value}`}
                        aria-selected={tab === value}
                        onClick={() => onTab(value)}
                        className={cn(
                            'flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-[16px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                            tab === value
                                ? 'bg-surface text-text shadow-segment'
                                : 'text-text-muted',
                        )}
                    >
                        {value === 'video' ? 'Video' : 'Notulen'}
                        {value === 'notes' && notesUnseen && (
                            <span
                                aria-label="ada perubahan"
                                className="size-2 rounded-full bg-tag-pink"
                            />
                        )}
                    </button>
                ))}
            </div>
            {chip}

            {tab === 'video' ? (
                <div
                    id="room-panel-video"
                    role="tabpanel"
                    aria-labelledby="room-tab-video"
                    className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-3 pb-[180px]"
                >
                    {stage}
                </div>
            ) : (
                <div
                    id="room-panel-notes"
                    role="tabpanel"
                    aria-labelledby="room-tab-notes"
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <NotesAvatarsLive />
                    <div className="min-h-0 flex-1 overflow-y-auto rounded-t-[24px] bg-surface pb-[110px]">
                        {doc}
                    </div>
                </div>
            )}

            {captions}
            <div className="absolute inset-x-4 bottom-[max(16px,env(safe-area-inset-bottom))] z-20">
                {bar}
            </div>
            {panel}
            {overlay}
        </div>
    );
}
