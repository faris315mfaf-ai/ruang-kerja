import {
    useChat,
    useLocalParticipant,
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
import type { ReactNode } from 'react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
import type { Minutes } from '../types';
import { ConsentCard, LiveChip, useConsent } from '../notulen/consent';
import type { AttendanceRoster } from './api';
import { videoApi } from './api';
import type { Room } from './contract';
import { attendanceRows, navigatorSections } from './contract';
import {
    elapsedClock,
    isMacPlatform,
    raisedHandOrder,
    shortcutAction,
    shortcutLabel,
} from './lib';
import { BarKey, ControlBar, LeaveKey } from './room-bar';
import { CaptionBox, useCaptions } from './room-captions';
import type { DocPresence } from './room-doc';
import { docAnchor, MinutesDoc } from './room-doc';
import { MinutesHost } from './room-minutes';
import { emitRoomNotice, useRoomNotices } from './room-notices';
import type { PanelKind } from './room-panels';
import { ChatPanel, SettingsPanel, SidePanel } from './room-panels';
import { AttendancePanel, SectionNav, TalkTimePanel } from './room-side';
import type { TileRef } from './room-tiles';
import { Filmstrip, ParticipantTile, ScreenShare, tileKey } from './room-tiles';
import { talkRows, talkSummary } from './talk-time';
import type { RoomParticipant } from './types';
import { useRoomLive } from './use-room-live';
import { useTalkTime } from './use-talk-time';
import type { RoomStatus } from './use-video-room';
import { mediaErrorMessage } from './use-video-room';

/** Tiptap + Yjs only load when the minutes are collaborative. */
const NoteEditor = lazy(() =>
    import('@/features/notes/note-editor').then((module) => ({
        default: module.NoteEditor,
    })),
);

/** LiveKit attribute: which part of the minutes this person is typing in. */
const PRESENCE_ATTRIBUTE = 'rk_minutes_at';

const SHORTCUTS = [
    ['toggle-mic', 'Nyalakan/matikan mikrofon'],
    ['toggle-camera', 'Nyalakan/matikan kamera'],
    ['toggle-hand', 'Angkat/turunkan tangan'],
    ['toggle-captions', 'Tampilkan/sembunyikan subtitle'],
    ['toggle-chat', 'Buka/tutup obrolan'],
    ['toggle-people', 'Buka/tutup kehadiran'],
] as const;

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

/** Scrolls the minutes to a navigator section and moves focus there. */
function jumpTo(key: string) {
    const target = document.getElementById(docAnchor(key));

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
}

/** Section of the minutes currently at the top of the paper. */
function useActiveSection(
    container: HTMLElement | null,
    keys: string[],
): string | null {
    const [active, setActive] = useState<string | null>(keys[0] ?? null);
    const signature = keys.join('|');

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

        for (const key of signature.split('|')) {
            const element = document.getElementById(docAnchor(key));

            if (element) {
                observer.observe(element);
            }
        }

        return () => observer.disconnect();
    }, [container, signature]);

    return active;
}

/**
 * The joined room. Desktop: filmstrip on top, the live minutes on paper in
 * the centre, "Bagian" on the left, "Waktu bicara" (or an open panel) on
 * the right, the compact dark bar bottom centre with captions above it;
 * a shared screen moves the minutes into a right column (Presentasi).
 * Phone: tabs Video | Notulen. Keyboard shortcuts as in Google Meet.
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
    const isMac = useMemo(
        () =>
            typeof navigator !== 'undefined' &&
            isMacPlatform(navigator.platform || navigator.userAgent),
        [],
    );
    const now = useNow(1000);
    const [panel, setPanel] = useState<PanelKind | null>(null);
    const [captionsOn, setCaptionsOn] = useState(true);
    const [tab, setTab] = useState<'video' | 'notes'>('video');
    const [notesUnseen, setNotesUnseen] = useState(false);
    const [seenMessages, setSeenMessages] = useState(0);
    const [roster, setRoster] = useState<AttendanceRoster>(() => ({
        attendance: room.video.attendance,
        in_room: room.video.in_room,
        not_joined: room.video.not_joined ?? [],
        late_grace_minutes: room.video.late_grace_minutes ?? 2,
    }));
    const [calling, setCalling] = useState<Set<string>>(new Set());
    const [paper, setPaper] = useState<HTMLElement | null>(null);
    const minutesSync = useRef<((minutes: Minutes) => void) | null>(null);

    const chat = useChat();
    const participants = useParticipants();
    const speakers = useSpeakingParticipants();
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
    const people = useMemo(
        () => new Map(room.participants.map((p) => [p.id, p])),
        [room.participants],
    );
    const seatOf = (identity: string) => people.get(identity)?.seat ?? 9;
    const firstNameOf = (identity: string) =>
        people.get(identity)?.first_name ??
        participants
            .find((p) => p.identity === identity)
            ?.name?.split(' ')[0] ??
        'Peserta';

    // Faces in roster order (organizer, minute taker, then names).
    const cameras: TileRef[] = useMemo(
        () =>
            tracks
                .filter((ref) => ref.source === Track.Source.Camera)
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
    const screen =
        tracks.find((ref) => ref.source === Track.Source.ScreenShare) ?? null;
    const lastSpeaker = useRef<string | null>(null);
    const speaking = speakers[0];

    if (speaking) {
        lastSpeaker.current = speaking.identity;
    }

    const activeKey = lastSpeaker.current
        ? `${lastSpeaker.current}:${Track.Source.Camera}`
        : null;
    const activeRef =
        cameras.find((ref) => tileKey(ref) === activeKey) ??
        cameras.find((ref) => !ref.participant.isLocal) ??
        cameras[0] ??
        null;

    // Captions (stage 2 feeds `lk.transcription`; hidden until it does).
    const captions = useCaptions(live);
    const showCaptions = captions.available && captionsOn;

    // Speaking time.
    const talk = useTalkTime({
        room: live,
        me: room.viewer.id,
        initial: room.speaking,
        reportUrl: room.links.speaking,
        canReport: room.can.report_speaking,
        connected: status.kind === 'connected',
    });
    const talkIds = [
        ...new Set([
            ...participants.map((p) => p.identity),
            ...roster.attendance.map((row) => row.user_id),
            ...talk.silent,
        ]),
    ].filter(
        (id) => people.has(id) || participants.some((p) => p.identity === id),
    );
    const rows = talkRows(talk.totals, talkIds);
    const summary = talkSummary(rows, firstNameOf);

    // Attendance (webhook) + who has not joined.
    const attendance = attendanceRows({
        meeting: room.meeting,
        participants: room.participants,
        video: {
            ...room.video,
            attendance: roster.attendance,
            not_joined: room.video.not_joined ? roster.not_joined : undefined,
            late_grace_minutes: roster.late_grace_minutes,
        },
    });
    const hands = raisedHandOrder(participants, (p) => p.attributes.hand);

    // Who is typing where (collaborator flags on the paper).
    const presence: DocPresence = {};
    const editors: RoomParticipant[] = [];

    for (const participant of participants) {
        const at = participant.attributes[PRESENCE_ATTRIBUTE];
        const person = people.get(participant.identity);

        if (!at || !person) {
            continue;
        }

        editors.push(person);

        if (!participant.isLocal) {
            (presence[at] ??= []).push(person);
        }
    }

    const focusPart = (key: string | null) =>
        void localParticipant
            .setAttributes({ [PRESENCE_ATTRIBUTE]: key ?? '' })
            .catch(() => undefined);

    // Consent switch in the room (attribute follows, contract §3).
    const consent = useConsent(
        room.notulen,
        (attributes) =>
            void localParticipant
                .setAttributes(attributes)
                .catch(() => undefined),
    );
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

                if (tab === 'video') {
                    setNotesUnseen(true);
                }
            },
            onAttendance: setRoster,
            onSpeaking: talk.apply,
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
    const [shortcutsOpen, setShortcutsOpen] = useState(false);

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
                'toggle-people': () => togglePanel('attendance'),
                'toggle-hand': toggleHand,
                'toggle-captions': () => setCaptionsOn((on) => !on),
            })[action]();
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    });

    // Join / leave / raised hand notices.
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

        live.on(RoomEvent.ParticipantConnected, onJoin)
            .on(RoomEvent.ParticipantDisconnected, onLeft)
            .on(RoomEvent.ParticipantAttributesChanged, onAttributes);

        return () => {
            live.off(RoomEvent.ParticipantConnected, onJoin)
                .off(RoomEvent.ParticipantDisconnected, onLeft)
                .off(RoomEvent.ParticipantAttributesChanged, onAttributes);
        };
    }, [live]);

    const call = (userId: string) => {
        if (!room.links.call) {
            return;
        }

        setCalling((set) => new Set(set).add(userId));
        videoApi
            .call(room.links.call, userId)
            .then(({ called }) => {
                emitRoomNotice(`${firstNameOf(userId)} dipanggil`);
                setRoster((current) => ({
                    ...current,
                    not_joined: current.not_joined.map((row) =>
                        row.user_id === userId
                            ? { ...row, called_at: called.called_at }
                            : row,
                    ),
                }));
            })
            .catch((error: unknown) =>
                emitRoomNotice(
                    error instanceof ApiError
                        ? error.message
                        : 'Panggilan gagal. Coba lagi.',
                    'error',
                ),
            )
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
                    `Mikrofon ${participant.name || 'peserta'} dimatikan.`,
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
                    `${participant.name || 'Peserta'} dikeluarkan dari rapat.`,
                ),
            )
            .catch((error: Error) => emitRoomNotice(error.message, 'error'));

    const startedAt = Date.parse(room.meeting.starts_at);
    const clock = now >= startedAt ? elapsedClock(now - startedAt) : null;
    const canShare =
        !mobile &&
        typeof navigator !== 'undefined' &&
        typeof navigator.mediaDevices?.getDisplayMedia === 'function';

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
                    people={people}
                    live={(identity) =>
                        participants.find((p) => p.identity === identity)
                    }
                    hands={hands}
                    canCall={Boolean(
                        room.links.call && room.can.call_participants,
                    )}
                    calling={calling}
                    onCall={call}
                    canModerate={room.can.moderate}
                    onMute={mute}
                    onRemove={remove}
                />
            </div>
        ) : kind === 'chat' ? (
            <ChatPanel chat={chat} autoFocus={!mobile} />
        ) : kind === 'talk' ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-[18px]">
                <TalkTimePanel rows={rows} people={people} summary={summary} />
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

    const moreMenu = (size: 'md' | 'lg') => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <BarKey
                    label="Opsi lainnya"
                    size={size}
                    aria-haspopup="menu"
                    badge={mobile ? unread : undefined}
                >
                    <MoreHorizontal aria-hidden />
                </BarKey>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="w-64">
                {(mobile || breakpoint === 'tablet') && (
                    <>
                        <DropdownMenuItem
                            onSelect={() => setPanel('attendance')}
                        >
                            <Users aria-hidden />
                            Kehadiran ({participants.length} di ruang)
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setPanel('talk')}>
                            <Timer aria-hidden />
                            Waktu bicara
                        </DropdownMenuItem>
                    </>
                )}
                {mobile && captions.available && (
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
                    Setelan perangkat{autoMinutes ? ' & transkrip' : ''}
                </DropdownMenuItem>
                {!mobile && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onSelect={() => setShortcutsOpen(true)}
                        >
                            <Keyboard aria-hidden />
                            Pintasan keyboard
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );

    const micKey = (size: 'md' | 'lg') => (
        <BarKey
            size={size}
            label={
                isMicrophoneEnabled ? 'Matikan mikrofon' : 'Nyalakan mikrofon'
            }
            shortcut={shortcutLabel('toggle-mic', isMac)}
            off={!isMicrophoneEnabled}
            onClick={toggleMic}
        >
            {isMicrophoneEnabled ? <Mic aria-hidden /> : <MicOff aria-hidden />}
        </BarKey>
    );
    const cameraKey = (size: 'md' | 'lg') => (
        <BarKey
            size={size}
            label={isCameraEnabled ? 'Matikan kamera' : 'Nyalakan kamera'}
            shortcut={shortcutLabel('toggle-camera', isMac)}
            off={!isCameraEnabled}
            onClick={toggleCamera}
        >
            {isCameraEnabled ? <Video aria-hidden /> : <VideoOff aria-hidden />}
        </BarKey>
    );
    const handKey = (size: 'md' | 'lg') => (
        <BarKey
            size={size}
            label={hand ? 'Turunkan tangan' : 'Angkat tangan'}
            shortcut={shortcutLabel('toggle-hand', isMac)}
            active={Boolean(hand)}
            onClick={toggleHand}
        >
            <Hand aria-hidden />
        </BarKey>
    );
    const chatKey = (size: 'md' | 'lg') => (
        <BarKey
            size={size}
            label="Obrolan"
            shortcut={shortcutLabel('toggle-chat', isMac)}
            active={panel === 'chat'}
            onClick={() => togglePanel('chat')}
            badge={unread}
        >
            <MessageSquare aria-hidden />
        </BarKey>
    );

    const reconnecting = status.kind === 'reconnecting' && (
        <div
            role="status"
            className="absolute inset-x-0 top-3 z-30 flex justify-center px-3"
        >
            <span className="inline-flex items-center gap-2 rounded-full bg-warning-soft px-4 py-2 text-[15px] font-semibold text-warning shadow-card">
                <Spinner className="size-4" />
                Menyambungkan ulang…
            </span>
        </div>
    );

    const shortcutsDialog = (
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
    );

    return (
        <MinutesHost room={room} live={live} syncRef={minutesSync}>
            {(minutes, collab) => {
                const sections = navigatorSections(
                    minutes?.minutes ?? null,
                    room.meeting.agenda ?? [],
                );
                const doc = (variant: 'page' | 'column' | 'sheet') =>
                    minutes ? (
                        <MinutesDoc
                            data={minutes}
                            title={room.meeting.title}
                            date={room.meeting.starts_at}
                            participants={room.participants}
                            presence={presence}
                            editors={editors}
                            onFocusPart={focusPart}
                            variant={variant}
                            quickAdd={variant === 'sheet'}
                            viewerId={room.viewer.id}
                            collabBody={
                                collab.mode === 'live' ? (
                                    <Suspense fallback={<Spinner />}>
                                        {' '}
                                        <NoteEditor
                                            live={collab.live}
                                            initial={null}
                                            editable
                                            me={{
                                                id: room.viewer.id,
                                                name: room.viewer.name,
                                            }}
                                            workspaceKey={
                                                room.meeting.workspace?.key ??
                                                null
                                            }
                                            onReady={() => undefined}
                                        />
                                    </Suspense>
                                ) : undefined
                            }
                        />
                    ) : (
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

                return mobile ? (
                    <MobileRoom
                        tab={tab}
                        onTab={setTab}
                        notesUnseen={notesUnseen}
                        cameras={cameras}
                        activeRef={activeRef}
                        screen={screen}
                        speakingName={
                            speaking ? firstNameOf(speaking.identity) : null
                        }
                        speakingId={speaking?.identity ?? null}
                        participants={room.participants.filter((p) =>
                            participants.some((live) => live.identity === p.id),
                        )}
                        doc={doc('sheet')}
                        captions={
                            showCaptions ? (
                                <CaptionBox
                                    lines={captions.visible}
                                    nameOf={firstNameOf}
                                    seatOf={seatOf}
                                    className="px-3.5 py-2.5"
                                />
                            ) : null
                        }
                        bar={
                            <div className="flex w-full items-center justify-between gap-1.5">
                                {micKey('lg')}
                                {cameraKey('lg')}
                                {handKey('lg')}
                                {chatKey('lg')}
                                {moreMenu('lg')}
                                <LeaveKey size="lg" onClick={onLeave} />
                            </div>
                        }
                        panel={
                            panel && (
                                <SidePanel
                                    title={panelTitle[panel]}
                                    mobile
                                    onClose={() => setPanel(null)}
                                >
                                    {panelBody(panel)}
                                </SidePanel>
                            )
                        }
                        overlay={
                            <>
                                <Notices />
                                {reconnecting}
                            </>
                        }
                    />
                ) : (
                    <DesktopRoom
                        wide={breakpoint === 'desktop'}
                        cameras={cameras}
                        activeKey={activeRef ? tileKey(activeRef) : null}
                        screen={screen}
                        clock={clock}
                        paperRef={setPaper}
                        doc={doc(screen ? 'column' : 'page')}
                        nav={
                            <SectionNavLive
                                sections={sections}
                                container={paper}
                            />
                        }
                        chip={
                            <LiveChip
                                autoMinutes={autoMinutes}
                                subtitles={captions.available}
                            />
                        }
                        talk={
                            <TalkTimePanel
                                rows={rows}
                                people={people}
                                summary={summary}
                            />
                        }
                        panel={
                            panel && (
                                <SidePanel
                                    title={panelTitle[panel]}
                                    aside={
                                        panel === 'attendance'
                                            ? 'otomatis dari ruang'
                                            : undefined
                                    }
                                    mobile={false}
                                    onClose={() => setPanel(null)}
                                    className="h-full"
                                >
                                    {panelBody(panel)}
                                </SidePanel>
                            )
                        }
                        captions={
                            showCaptions ? (
                                <CaptionBox
                                    lines={captions.visible}
                                    nameOf={firstNameOf}
                                    seatOf={seatOf}
                                />
                            ) : null
                        }
                        bar={
                            <ControlBar>
                                {micKey('md')}
                                {cameraKey('md')}
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
                                {handKey('md')}
                                {captions.available && (
                                    <BarKey
                                        label={
                                            captionsOn
                                                ? 'Sembunyikan subtitle'
                                                : 'Tampilkan subtitle'
                                        }
                                        shortcut={shortcutLabel(
                                            'toggle-captions',
                                            isMac,
                                        )}
                                        active={captionsOn}
                                        onClick={() =>
                                            setCaptionsOn((on) => !on)
                                        }
                                    >
                                        <Captions aria-hidden />
                                    </BarKey>
                                )}
                                {chatKey('md')}
                                <BarKey
                                    label="Kehadiran"
                                    shortcut={shortcutLabel(
                                        'toggle-people',
                                        isMac,
                                    )}
                                    active={panel === 'attendance'}
                                    onClick={() => togglePanel('attendance')}
                                >
                                    <Users aria-hidden />
                                </BarKey>
                                {moreMenu('md')}
                                <LeaveKey onClick={onLeave} />
                            </ControlBar>
                        }
                        overlay={
                            <>
                                <Notices />
                                {reconnecting}
                                {shortcutsDialog}
                            </>
                        }
                    />
                );
            }}
        </MinutesHost>
    );
}

function SectionNavLive({
    sections,
    container,
}: {
    sections: ReturnType<typeof navigatorSections>;
    container: HTMLElement | null;
}) {
    const active = useActiveSection(
        container,
        sections.map((section) => section.key),
    );

    return <SectionNav sections={sections} active={active} onJump={jumpTo} />;
}

function DesktopRoom({
    wide,
    cameras,
    activeKey,
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
    cameras: TileRef[];
    activeKey: string | null;
    screen: TileRef | null;
    clock: string | null;
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
                    <Filmstrip
                        cameras={cameras}
                        activeKey={activeKey}
                        compact={presenting}
                    />
                </div>
                {clock && (
                    <span
                        className="shrink-0 pt-1 font-mono text-[13px] text-text-muted tnum"
                        aria-label={`Rapat berjalan ${clock}`}
                    >
                        {clock}
                    </span>
                )}
            </header>

            {presenting ? (
                <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] gap-5 px-5 pt-3">
                    <div className="min-h-0 pb-[90px]">
                        <ScreenShare trackRef={screen} />
                    </div>
                    <div className="flex min-h-0 flex-col gap-2">
                        <span className="flex items-center justify-between gap-2 pl-2.5 text-[13px] font-semibold text-text-muted">
                            Notulen tetap bisa diketik
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
                        wide
                            ? 'grid-cols-[200px_minmax(0,1fr)_220px] 2xl:grid-cols-[220px_minmax(0,1fr)_260px]'
                            : 'grid-cols-[minmax(0,1fr)]',
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

            {captions && (
                <div className="pointer-events-none absolute inset-x-0 bottom-[86px] z-10 flex justify-center px-4">
                    <div className="w-[min(700px,100%)]">{captions}</div>
                </div>
            )}
            <div className="absolute bottom-[18px] left-1/2 z-20 -translate-x-1/2">
                {bar}
            </div>
            {overlay}
        </div>
    );
}

const AVATAR_TONE: Record<RoomParticipant['tone'], string> = {
    blue: 'bg-avatar-blue text-avatar-blue-fg',
    teal: 'bg-avatar-teal text-avatar-teal-fg',
    amber: 'bg-avatar-amber text-avatar-amber-fg',
};

function MobileRoom({
    tab,
    onTab,
    notesUnseen,
    cameras,
    activeRef,
    screen,
    speakingName,
    speakingId,
    participants,
    doc,
    captions,
    bar,
    panel,
    overlay,
}: {
    tab: 'video' | 'notes';
    onTab: (tab: 'video' | 'notes') => void;
    notesUnseen: boolean;
    cameras: TileRef[];
    activeRef: TileRef | null;
    screen: TileRef | null;
    speakingName: string | null;
    speakingId: string | null;
    participants: RoomParticipant[];
    doc: ReactNode;
    captions: ReactNode;
    bar: ReactNode;
    panel: ReactNode;
    overlay: ReactNode;
}) {
    const big = screen ?? activeRef;
    const others = cameras.filter(
        (ref) => !big || tileKey(ref) !== tileKey(big),
    );

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

            {tab === 'video' ? (
                <div
                    id="room-panel-video"
                    role="tabpanel"
                    aria-labelledby="room-tab-video"
                    className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-3 pb-[180px]"
                >
                    {big &&
                        (screen ? (
                            <div className="aspect-[4/3] w-full shrink-0">
                                <ScreenShare trackRef={screen} />
                            </div>
                        ) : (
                            <ParticipantTile
                                trackRef={big}
                                fullName
                                className="aspect-[358/330] w-full shrink-0 rounded-[22px]"
                            />
                        ))}
                    <ul
                        aria-label="Peserta lain"
                        className="grid grid-cols-3 gap-2"
                    >
                        {others.map((ref) => (
                            <li key={tileKey(ref)} className="aspect-square">
                                <ParticipantTile
                                    trackRef={ref}
                                    className="size-full rounded-[18px]"
                                />
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <div
                    id="room-panel-notes"
                    role="tabpanel"
                    aria-labelledby="room-tab-notes"
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <div className="flex shrink-0 items-center gap-1.5 px-4 pt-3 pb-3">
                        {participants.slice(0, 5).map((person) => (
                            <span
                                key={person.id}
                                className={cn(
                                    'rounded-full',
                                    person.id === speakingId &&
                                        'ring-[3px] ring-primary',
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex size-[34px] items-center justify-center rounded-full text-[13px] font-bold',
                                        AVATAR_TONE[person.tone],
                                    )}
                                    aria-hidden
                                >
                                    {person.initials}
                                </span>
                            </span>
                        ))}
                        {participants.length > 5 && (
                            <Badge
                                variant="secondary"
                                className="h-[34px] rounded-full"
                            >
                                +{participants.length - 5}
                            </Badge>
                        )}
                        <span className="ml-1 truncate text-[13px] text-text-muted">
                            {speakingName
                                ? `${speakingName} bicara`
                                : `${participants.length} di ruang`}
                        </span>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto rounded-t-[24px] bg-surface pb-[110px]">
                        {doc}
                    </div>
                </div>
            )}

            {tab === 'video' && captions && (
                <div className="pointer-events-none absolute inset-x-4 bottom-[100px] z-10">
                    {captions}
                </div>
            )}
            <div className="absolute inset-x-4 bottom-[max(16px,env(safe-area-inset-bottom))] z-20">
                {bar}
            </div>
            {panel}
            {overlay}
        </div>
    );
}
