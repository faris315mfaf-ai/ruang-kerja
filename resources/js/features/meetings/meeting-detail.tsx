import { Link, router } from '@inertiajs/react';
import { Copy, MapPin, NotebookPen, Pencil, Video } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { CancelMeetingDialog } from './cancel-dialog';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { nextTabIndex } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import meetingRoutes from '@/routes/meetings';
import { errorMessage, meetingsApi } from './api';
import {
    displayLink,
    durationLabel,
    durationMinutes,
    joinLink,
    meetingPhase,
    officeDate,
    personById,
    phaseLabel,
    PLATFORM_LABEL,
    RECURRENCE_LABEL,
    RSVP_LABEL,
    rsvpCounts,
    shortDate,
    timeRange,
} from './lib';
import { GuestPanel } from './guests/guest-panel';
import { resolveGuestRight } from './guests/lib';
import { MeetingStartNotice } from './meeting-notice';
import { NotulenCard } from './notulen/notulen-card';
import { useMeetingsContext, useNow } from './meetings-context';
import {
    AvatarStack,
    CanceledBadge,
    HeldChip,
    MinutesBadge,
    participantName,
    PlatformBadge,
    useMeetingActions,
} from './meeting-ui';
import type { VideoSummary } from './video/types';
import {
    useVideoPresencePoll,
    VideoAttendancePanel,
    VideoJoinCard,
    videoJoinable,
} from './video/video-join-card';
import type {
    Meeting,
    MeetingDetailProps,
    Participant,
    Person,
    PersonId,
    Rsvp,
} from './types';

/**
 * Shared data of /rapat/{id}: RSVP (optimistic + rollback), cancel, and the
 * Video RuangKerja summary (`video`, polled while the room is open).
 */
export function useMeetingDetail(
    props: MeetingDetailProps,
    video: VideoSummary | null = null,
) {
    const now = useNow();
    const meeting = props.meeting;
    const mine = meeting.participants.find(
        (p) => p.user_id === props.viewer_id,
    );
    const [rsvp, setRsvp] = useState<Rsvp>(mine?.rsvp ?? 'pending');
    const [saving, setSaving] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const actions = useMeetingActions(meeting);
    useVideoPresencePoll(meeting, video, now);

    const answer = (value: Rsvp) => {
        if (value === 'pending' || value === rsvp || saving) {
            return;
        }

        const previous = rsvp;
        setRsvp(value);
        setSaving(true);
        meetingsApi
            .rsvp(meeting.id, value)
            .then(() => toast.success(`Kehadiran Anda: ${RSVP_LABEL[value]}.`))
            .catch((error: unknown) => {
                setRsvp(previous);
                toast.error(
                    errorMessage(error, 'Kehadiran gagal disimpan. Coba lagi.'),
                );
            })
            .finally(() => setSaving(false));
    };

    const cancel = () =>
        router.delete(meetingRoutes.cancel(meeting.id).url, {
            preserveScroll: true,
            onFinish: () => setCancelOpen(false),
            onError: () => toast.error('Rapat gagal dibatalkan. Coba lagi.'),
        });

    // The viewer's own answer replaces the stored one in counts and lists.
    const participants: Participant[] = meeting.participants.map((p) =>
        p.user_id === props.viewer_id ? { ...p, rsvp } : p,
    );

    return {
        now,
        meeting,
        participants,
        can: props.can,
        // Server flag (MeetingPolicy::manageGuests); an older server falls back to organizer.
        canManageGuests: resolveGuestRight(
            props.can.manage_guests,
            meeting.organizer_id === props.viewer_id,
        ),
        rsvp,
        answer,
        cancel,
        cancelOpen,
        setCancelOpen,
        actions,
        video,
    };
}

export type MeetingDetailData = ReturnType<typeof useMeetingDetail>;

const RSVP_TONE: Record<Rsvp, 'success' | 'warning' | 'danger' | 'neutral'> = {
    yes: 'success',
    maybe: 'warning',
    no: 'danger',
    pending: 'neutral',
};

const RSVP_CHOICES: { value: Rsvp; label: string }[] = [
    { value: 'yes', label: 'Hadir' },
    { value: 'maybe', label: 'Mungkin' },
    { value: 'no', label: 'Tidak' },
];

/** Hadir · Mungkin · Tidak (MRapatDetail "Kehadiran Anda"). */
function RsvpPicker({
    value,
    onChange,
}: {
    value: Rsvp;
    onChange: (value: Rsvp) => void;
}) {
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    const current = Math.max(
        0,
        RSVP_CHOICES.findIndex((c) => c.value === value),
    );

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        const next = nextTabIndex(current, event.key, RSVP_CHOICES.length);

        if (next === null) {
            return;
        }

        event.preventDefault();
        onChange(RSVP_CHOICES[next].value);
        refs.current[next]?.focus();
    };

    return (
        <div
            role="radiogroup"
            aria-label="Kehadiran Anda"
            className="grid grid-cols-3 gap-1.5"
        >
            {RSVP_CHOICES.map((choice, index) => {
                const selected = choice.value === value;

                return (
                    <button
                        key={choice.value}
                        ref={(element) => {
                            refs.current[index] = element;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        tabIndex={
                            selected || (value === 'pending' && index === 0)
                                ? 0
                                : -1
                        }
                        onClick={() => onChange(choice.value)}
                        onKeyDown={onKeyDown}
                        className={cn(
                            'h-11 rounded-control text-[15px] font-extrabold transition-colors duration-120 ease-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                            selected
                                ? 'border-2 border-primary bg-link-soft text-link'
                                : 'border border-border bg-surface text-text hover:bg-surface-2',
                        )}
                    >
                        {choice.label}
                    </button>
                );
            })}
        </div>
    );
}

export function ParticipantList({
    participants,
}: {
    participants: Participant[];
}) {
    const { people, me } = useMeetingsContext();

    return (
        <ul className="flex flex-col">
            {participants.map((participant) => {
                const person = personById(people, participant.user_id);

                return (
                    <li
                        key={participant.user_id ?? participant.email}
                        className="flex min-h-14 items-center gap-3 border-t border-divider first:border-t-0"
                    >
                        <UserAvatar
                            name={person?.name ?? participant.email ?? 'Tamu'}
                            ring={participant.user_id === me}
                            className="size-9"
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-[16px] font-semibold">
                                {participantName(participant, people, me)}
                            </span>
                            <span className="truncate text-[14px] text-text-muted">
                                {person
                                    ? person.title || person.division
                                    : 'Tamu eksternal · masuk lewat tautan pribadi'}
                                {participant.optional ? ' · opsional' : ''}
                            </span>
                        </span>
                        <Badge
                            variant="status"
                            tone={RSVP_TONE[participant.rsvp]}
                            className="h-7 px-2.5 text-[13px]"
                        >
                            {RSVP_LABEL[participant.rsvp]}
                        </Badge>
                    </li>
                );
            })}
        </ul>
    );
}

function infoRows(
    meeting: Meeting,
    people: Person[],
    me: PersonId,
): [string, string][] {
    const organizer = personById(people, meeting.organizer_id);
    const taker = personById(people, meeting.minute_taker_id);

    return [
        [
            'Waktu',
            `${shortDate(officeDate(meeting.starts_at))} · ${timeRange(meeting.starts_at, meeting.ends_at)}`,
        ],
        [
            'Durasi',
            durationLabel(durationMinutes(meeting.starts_at, meeting.ends_at)),
        ],
        ['Tempat', meeting.location ?? PLATFORM_LABEL[meeting.platform]],
        [
            'Penyelenggara',
            organizer ? (organizer.id === me ? 'Anda' : organizer.name) : '–',
        ],
        [
            'Notulis',
            taker
                ? taker.id === me
                    ? 'Anda'
                    : taker.name
                : 'Belum ditentukan',
        ],
        ['Workspace', meeting.workspace?.name ?? '–'],
        ['Berulang', RECURRENCE_LABEL[meeting.recurrence]],
        [
            'Pengingat',
            meeting.reminders.length === 0
                ? 'Tidak ada'
                : meeting.reminders.map((m) => `${m}`).join(' dan ') +
                  ' menit sebelum',
        ],
    ];
}

function phaseTone(
    meeting: Meeting,
    now: number,
): 'danger' | 'warning' | 'neutral' | 'link' {
    const phase = meetingPhase(meeting, now);

    return phase === 'live'
        ? 'danger'
        : phase === 'soon'
          ? 'warning'
          : phase === 'done'
            ? 'neutral'
            : 'link';
}

function canJoin(data: MeetingDetailData): boolean {
    const { meeting, video, now } = data;

    if (meeting.platform === 'video') {
        return videoJoinable(meeting, video, now);
    }

    return (
        Boolean(joinLink(meeting)) &&
        !meeting.canceled &&
        meetingPhase(meeting, now) !== 'done'
    );
}

function joinLabel(data: MeetingDetailData): string {
    if (data.meeting.platform === 'video') {
        return 'Gabung rapat video';
    }

    return data.actions.joined
        ? `Buka lagi ${data.actions.app}`
        : `Gabung lewat ${data.actions.app}`;
}

/** Organizer tools: edit and cancel (with confirmation). */
function OrganizerActions({
    data,
    compact = false,
}: {
    data: MeetingDetailData;
    compact?: boolean;
}) {
    if (!data.can.update) {
        return null;
    }

    return (
        <>
            <Button
                variant="outline"
                size="lg"
                className={cn(compact && 'px-3')}
                asChild
            >
                <Link href={meetingRoutes.edit(data.meeting.id).url}>
                    <Pencil aria-hidden />
                    Ubah
                </Link>
            </Button>
            <Button
                variant="outline"
                size="lg"
                className={cn('text-danger', compact && 'px-3')}
                onClick={() => data.setCancelOpen(true)}
            >
                Batalkan
            </Button>
            <CancelMeetingDialog
                open={data.cancelOpen}
                onOpenChange={data.setCancelOpen}
                recurring={data.meeting.recurrence !== 'none'}
                onConfirm={data.cancel}
            />
        </>
    );
}

/** /rapat/{id} on desktop & tablet. */
export function MeetingDetailDesktop({
    data,
    isTablet,
}: {
    data: MeetingDetailData;
    isTablet: boolean;
}) {
    const { meeting, now, actions, canManageGuests } = data;
    const { people, me } = useMeetingsContext();
    const isParticipant = data.can.respond;

    return (
        <div className="flex flex-col gap-6">
            <section className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        {meeting.canceled ? (
                            <CanceledBadge />
                        ) : (
                            <Badge
                                variant="status"
                                tone={phaseTone(meeting, now)}
                                dot
                            >
                                {phaseLabel(meeting, now)}
                            </Badge>
                        )}
                        <MinutesBadge
                            status={meeting.minutes_status}
                            className="h-8 text-[14px]"
                        />
                        {meeting.leadership && (
                            <Badge
                                variant="status"
                                tone="info"
                                className="h-8 text-[14px]"
                            >
                                Rapat pimpinan
                            </Badge>
                        )}
                    </div>
                    <h1 className="text-[34px] leading-[42px] font-extrabold tracking-[-0.025em] lg:text-[40px] lg:leading-[48px]">
                        {meeting.title}
                    </h1>
                    <p className="text-[17px] text-text-muted">
                        {shortDate(officeDate(meeting.starts_at))} ·{' '}
                        {timeRange(meeting.starts_at, meeting.ends_at)} ·{' '}
                        {PLATFORM_LABEL[meeting.platform]}
                        {meeting.workspace
                            ? ` · ${meeting.workspace.name}`
                            : ''}
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <OrganizerActions data={data} />
                    <Button variant="outline" size="lg" asChild>
                        <Link href={meeting.minutes_href}>
                            <NotebookPen aria-hidden />
                            {meeting.minutes_status === 'none' &&
                            data.can.write_minutes
                                ? 'Mulai notulen'
                                : 'Buka notulen'}
                        </Link>
                    </Button>
                    {/* Video RuangKerja joins from its card below (one gradient per area). */}
                    {meeting.platform !== 'video' && canJoin(data) && (
                        <Button size="lg" onClick={actions.join}>
                            <Video aria-hidden />
                            {joinLabel(data)}
                        </Button>
                    )}
                </div>
            </section>

            <section className="flex flex-wrap items-start gap-5">
                <div className="flex min-w-0 flex-[2_1_600px] flex-col gap-5">
                    {meeting.platform === 'video' ? (
                        <>
                            <VideoJoinCard
                                meeting={meeting}
                                video={data.video}
                                now={now}
                                onCopy={actions.copy}
                                copied={actions.copied}
                            />
                            <VideoAttendancePanel video={data.video} />
                            {canManageGuests && (
                                <GuestPanel
                                    meetingId={meeting.id}
                                    date={meeting.occurrence_date}
                                    now={now}
                                    canceled={meeting.canceled}
                                />
                            )}
                            <NotulenCard
                                meetingId={meeting.id}
                                date={meeting.occurrence_date}
                            />
                        </>
                    ) : (
                        <JoinCard meeting={meeting} actions={actions} />
                    )}
                    {meeting.description && (
                        <Panel title="Keterangan">
                            <p className="text-[16px] leading-6 whitespace-pre-line">
                                {meeting.description}
                            </p>
                        </Panel>
                    )}
                    <Panel title="Agenda">
                        <ol className="flex flex-col gap-3">
                            {meeting.agenda.map((item, index) => (
                                <li
                                    key={`${index}-${item}`}
                                    className="flex items-center gap-3.5"
                                >
                                    <span
                                        aria-hidden
                                        className="flex size-9 shrink-0 items-center justify-center rounded-control bg-grad-merek text-[16px] font-extrabold text-on-brand"
                                    >
                                        {index + 1}
                                    </span>
                                    <span className="text-[17px] leading-6 font-semibold">
                                        {item}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </Panel>
                    <ParticipantsPanel participants={data.participants} />
                </div>
                <aside
                    className={cn(
                        'flex min-w-0 flex-col gap-4',
                        isTablet ? 'flex-[1_1_100%]' : 'flex-[1_1_320px]',
                    )}
                >
                    {isParticipant && (
                        <Panel title="Kehadiran Anda">
                            <RsvpPicker
                                value={data.rsvp}
                                onChange={data.answer}
                            />
                        </Panel>
                    )}
                    <Panel title="Detail">
                        <dl className="flex flex-col">
                            {infoRows(meeting, people, me).map(
                                ([key, value]) => (
                                    <div
                                        key={key}
                                        className="flex min-h-12 items-center justify-between gap-3 border-t border-divider text-[15px] first:border-t-0"
                                    >
                                        <dt className="font-semibold text-text-muted">
                                            {key}
                                        </dt>
                                        <dd className="text-right font-bold">
                                            {value}
                                        </dd>
                                    </div>
                                ),
                            )}
                        </dl>
                    </Panel>
                    <HeldChip className="w-full justify-start" />
                </aside>
            </section>

            <MeetingStartNotice
                meeting={meeting}
                now={now}
                variant={isTablet ? 'tablet' : 'desktop'}
            />
        </div>
    );
}

function ParticipantsPanel({ participants }: { participants: Participant[] }) {
    const counts = participants.reduce<Record<Rsvp, number>>(
        (acc, p) => ({ ...acc, [p.rsvp]: acc[p.rsvp] + 1 }),
        { yes: 0, maybe: 0, no: 0, pending: 0 },
    );

    return (
        <Panel
            title="Peserta"
            action={
                <span className="text-[15px] font-bold text-link">
                    {counts.yes} hadir · {counts.maybe} mungkin ·{' '}
                    {counts.pending} belum menjawab
                </span>
            }
        >
            <ParticipantList participants={participants} />
        </Panel>
    );
}

/** Join link card: Meet/Zoom link with copy, or the room/address. */
function JoinCard({
    meeting,
    actions,
}: {
    meeting: Meeting;
    actions: ReturnType<typeof useMeetingActions>;
}) {
    const link = joinLink(meeting);
    const online = meeting.platform === 'meet' || meeting.platform === 'zoom';

    if (!link) {
        return (
            <div className="flex items-center gap-4 rounded-panel border border-border bg-surface p-5 shadow-card md:p-6">
                <span
                    aria-hidden
                    className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-muted"
                >
                    {online ? (
                        <Video className="size-6" />
                    ) : (
                        <MapPin className="size-6" />
                    )}
                </span>
                <span className="flex flex-col">
                    <span className="text-[18px] font-bold">
                        {online
                            ? PLATFORM_LABEL[meeting.platform]
                            : (meeting.location ??
                              PLATFORM_LABEL[meeting.platform])}
                    </span>
                    <span className="text-[15px] text-text-muted">
                        {online
                            ? 'Tautan rapat belum diisi penyelenggara. Tautan Meet otomatis ditahan.'
                            : 'Rapat tatap muka · tidak ada tautan daring'}
                    </span>
                </span>
            </div>
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-4 rounded-panel border border-border bg-surface p-5 shadow-card md:p-6">
            <span
                aria-hidden
                className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-grad-aksi text-on-brand"
            >
                <Video className="size-6" />
            </span>
            <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
                <PlatformBadge
                    platform={meeting.platform}
                    className="self-start"
                />
                <span className="font-mono text-[15px] font-semibold break-all">
                    {displayLink(link)}
                </span>
            </span>
            <Button variant="outline" onClick={actions.copy}>
                <Copy aria-hidden />
                {actions.copied ? 'Tautan disalin' : 'Salin tautan'}
            </Button>
        </div>
    );
}

/** /rapat/{id} on phones (design MRapatDetail). */
export function MeetingDetailMobile({ data }: { data: MeetingDetailData }) {
    const { meeting, now, actions, canManageGuests } = data;
    const { people, me } = useMeetingsContext();
    const [allPeople, setAllPeople] = useState(false);
    const counts = rsvpCounts({ ...meeting, participants: data.participants });
    const taker = personById(people, meeting.minute_taker_id);
    const joinable = canJoin(data);

    return (
        <div className={cn('flex flex-col gap-3.5', joinable && 'pb-28')}>
            <div className="flex flex-wrap items-center gap-2">
                {meeting.canceled ? (
                    <CanceledBadge />
                ) : (
                    <Badge variant="status" tone={phaseTone(meeting, now)} dot>
                        {phaseLabel(meeting, now)}
                    </Badge>
                )}
                <MinutesBadge
                    status={meeting.minutes_status}
                    className="h-8 text-[14px]"
                />
            </div>
            <h2 className="text-[28px] leading-[35px] font-extrabold tracking-[-0.02em]">
                {meeting.title}
            </h2>
            <dl className="rounded-[22px] border border-border bg-surface px-4 py-1">
                {infoRows(meeting, people, me)
                    .filter(([key]) =>
                        [
                            'Waktu',
                            'Tempat',
                            'Penyelenggara',
                            'Notulis',
                        ].includes(key),
                    )
                    .map(([key, value]) => (
                        <div
                            key={key}
                            className="flex min-h-[50px] items-center justify-between gap-3 border-t border-divider text-[16px] first:border-t-0"
                        >
                            <dt className="text-text-muted">{key}</dt>
                            <dd
                                className={cn(
                                    'text-right font-bold',
                                    key === 'Tempat' && 'text-link',
                                )}
                            >
                                {value}
                            </dd>
                        </div>
                    ))}
            </dl>
            {meeting.platform === 'video' && (
                <VideoJoinCard
                    meeting={meeting}
                    video={data.video}
                    now={now}
                    onCopy={actions.copy}
                    copied={actions.copied}
                />
            )}
            {data.can.respond && (
                <section
                    aria-label="Kehadiran Anda"
                    className="flex flex-col gap-2.5 rounded-[22px] border border-border bg-surface p-4"
                >
                    <span className="text-[16px] font-bold">
                        Kehadiran Anda
                    </span>
                    <RsvpPicker value={data.rsvp} onChange={data.answer} />
                </section>
            )}
            {meeting.description && (
                <section
                    aria-label="Keterangan"
                    className="flex flex-col gap-2 rounded-[22px] border border-border bg-surface p-4"
                >
                    <span className="text-[16px] font-bold">Keterangan</span>
                    <p className="text-[16px] leading-[25px] whitespace-pre-line">
                        {meeting.description}
                    </p>
                </section>
            )}
            <section
                aria-label="Agenda"
                className="flex flex-col gap-2 rounded-[22px] border border-border bg-surface p-4"
            >
                <span className="text-[16px] font-bold">Agenda</span>
                <ol className="flex list-decimal flex-col gap-1 pl-5 text-[16px] leading-[25px] text-text">
                    {meeting.agenda.map((item, index) => (
                        <li key={`${index}-${item}`}>{item}</li>
                    ))}
                </ol>
            </section>
            <VideoAttendancePanel video={data.video} />
            {meeting.platform === 'video' && canManageGuests && (
                <GuestPanel
                    meetingId={meeting.id}
                    date={meeting.occurrence_date}
                    now={now}
                    canceled={meeting.canceled}
                />
            )}
            {meeting.platform === 'video' && (
                <NotulenCard
                    meetingId={meeting.id}
                    date={meeting.occurrence_date}
                />
            )}
            <section
                aria-label="Peserta"
                className="flex flex-col gap-2 rounded-[22px] border border-border bg-surface p-4"
            >
                <button
                    type="button"
                    aria-expanded={allPeople}
                    onClick={() => setAllPeople((open) => !open)}
                    className="-m-1 flex min-h-11 items-center gap-2 rounded-control p-1 text-left text-[15px] text-text-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                >
                    <AvatarStack participants={data.participants} />
                    <span className="flex-1">
                        {data.participants.length} peserta · {counts.yes} hadir
                        {taker ? ` · notulis ${taker.name.split(' ')[0]}` : ''}
                    </span>
                    <span className="font-bold text-link">
                        {allPeople ? 'Tutup' : 'Lihat'}
                    </span>
                </button>
                {allPeople && (
                    <ParticipantList participants={data.participants} />
                )}
            </section>
            <div className="grid grid-cols-2 gap-2.5">
                <Button
                    variant="outline"
                    size="lg"
                    className="col-span-2 px-3"
                    asChild
                >
                    <Link href={meeting.minutes_href}>
                        <NotebookPen aria-hidden />
                        {meeting.minutes_status === 'none' &&
                        data.can.write_minutes
                            ? 'Mulai notulen'
                            : 'Notulen'}
                    </Link>
                </Button>
                <OrganizerActions data={data} compact />
                {joinLink(meeting) && meeting.platform !== 'video' && (
                    <Button
                        variant="outline"
                        size="lg"
                        className="col-span-2"
                        onClick={actions.copy}
                    >
                        <Copy aria-hidden />
                        {actions.copied
                            ? 'Tautan disalin'
                            : 'Salin tautan rapat'}
                    </Button>
                )}
            </div>

            {joinable && (
                <div className="glass fixed inset-x-0 bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom))] z-30 flex flex-col gap-1.5 border-x-0 border-b-0 px-4 py-3">
                    <Button
                        size="xl"
                        className="w-full font-extrabold"
                        onClick={actions.join}
                    >
                        {joinLabel(data)}
                    </Button>
                    <span className="text-center text-[13px] text-text-muted">
                        {meeting.platform === 'video'
                            ? 'Kamera & mikrofon dicek dulu sebelum masuk'
                            : `Membuka aplikasi ${actions.app} bila terpasang`}
                    </span>
                </div>
            )}

            <MeetingStartNotice meeting={meeting} now={now} variant="mobile" />
        </div>
    );
}
