import { Link } from '@inertiajs/react';
import {
    BellRing,
    CalendarX2,
    Copy,
    FileText,
    MapPin,
    NotebookPen,
    Presentation,
    Sheet as SheetIcon,
    Video,
} from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useRef, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { nextTabIndex } from '@/components/ui/tabs';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { cn } from '@/lib/utils';
import { GOOGLE_SYNC, ME, MEETINGS, PEOPLE } from './fixtures';
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
import { MeetingStartNotice } from './meeting-notice';
import {
    AvatarStack,
    ErrorState,
    ListSkeleton,
    MinutesBadge,
    participantName,
    PlatformBadge,
    PreviewBar,
    SyncChip,
    useMeetingActions,
} from './meeting-ui';
import type { Meeting, Participant, RelatedDocument, Rsvp } from './types';
import { useDemoClock, usePreviewState } from './use-preview';

export const DETAIL_PREVIEWS = [
    { label: 'Rapat berlangsung', query: 'jam=10.42' },
];

export function useMeetingDetail(meetingId: string) {
    const { state } = usePreviewState();
    const now = useDemoClock();
    const meeting =
        state === 'kosong'
            ? null
            : (MEETINGS.find((item) => item.id === meetingId) ?? null);
    const mine = meeting?.participants.find((p) => p.user_id === ME);
    const [rsvp, setRsvp] = useState<Rsvp>(mine?.rsvp ?? 'pending');
    const [noticeOpen, setNoticeOpen] = useState(false);
    const mutation = useFakeMutation();
    const actions = useMeetingActions(meeting);

    const answer = (value: Rsvp) => {
        setRsvp(value);
        void mutation.run(() => {}, {
            delay: 300,
            success: `Kehadiran Anda: ${RSVP_LABEL[value]}. Penyelenggara diberi tahu.`,
        });
    };

    // The viewer's own answer replaces the stored one in counts and lists.
    const participants: Participant[] = meeting
        ? meeting.participants.map((p) =>
              p.user_id === ME ? { ...p, rsvp } : p,
          )
        : [];

    return {
        state,
        now,
        meeting,
        participants,
        isGuest: Boolean(mine),
        rsvp,
        answer,
        noticeOpen,
        setNoticeOpen,
        actions,
    };
}

export type MeetingDetailData = ReturnType<typeof useMeetingDetail>;

const RSVP_TONE: Record<Rsvp, 'success' | 'warning' | 'danger' | 'neutral'> = {
    accepted: 'success',
    tentative: 'warning',
    declined: 'danger',
    pending: 'neutral',
};

const RSVP_CHOICES: { value: Rsvp; label: string }[] = [
    { value: 'accepted', label: 'Hadir' },
    { value: 'tentative', label: 'Mungkin' },
    { value: 'declined', label: 'Tidak' },
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

const DOC_ICON: Record<
    RelatedDocument['kind'],
    { icon: typeof FileText; tone: string }
> = {
    doc: { icon: FileText, tone: 'bg-info-soft text-info' },
    sheet: { icon: SheetIcon, tone: 'bg-success-soft text-success' },
    slide: { icon: Presentation, tone: 'bg-warning-soft text-warning' },
    video: { icon: Video, tone: 'bg-danger-soft text-danger' },
    pdf: { icon: FileText, tone: 'bg-danger-soft text-danger' },
};

export function DocumentsList({ documents }: { documents: RelatedDocument[] }) {
    if (documents.length === 0) {
        return (
            <EmptyState size="sm" icon={FileText} title="Belum ada dokumen">
                Lampirkan dokumen dari Drive workspace saat mengubah rapat.
            </EmptyState>
        );
    }

    return (
        <ul className="flex flex-col gap-2.5">
            {documents.map((document) => {
                const { icon: Icon, tone } = DOC_ICON[document.kind];

                return (
                    <li key={document.id} className="flex items-center gap-3">
                        <span
                            aria-hidden
                            className={cn(
                                'flex size-10 shrink-0 items-center justify-center rounded-control',
                                tone,
                            )}
                        >
                            <Icon className="size-5" />
                        </span>
                        <span className="flex min-w-0 flex-col">
                            <span className="truncate text-[15px] font-semibold">
                                {document.name}
                            </span>
                            <span className="truncate text-[13px] text-text-muted">
                                {document.source}
                            </span>
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

export function ParticipantList({
    participants,
}: {
    participants: Participant[];
}) {
    return (
        <ul className="flex flex-col">
            {participants.map((participant) => {
                const person = personById(PEOPLE, participant.user_id);

                return (
                    <li
                        key={participant.user_id ?? participant.email}
                        className="flex min-h-14 items-center gap-3 border-t border-divider first:border-t-0"
                    >
                        <UserAvatar
                            name={person?.name ?? participant.email ?? 'Tamu'}
                            ring={participant.user_id === ME}
                            className="size-9"
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-[16px] font-semibold">
                                {participantName(participant)}
                            </span>
                            <span className="truncate text-[14px] text-text-muted">
                                {person ? person.title : 'Tamu eksternal'}
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

function infoRows(meeting: Meeting): [string, string][] {
    const organizer = personById(PEOPLE, meeting.organizer_id);
    const taker = personById(PEOPLE, meeting.minute_taker_id);

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
            organizer ? (organizer.id === ME ? 'Anda' : organizer.name) : '–',
        ],
        [
            'Notulis',
            taker
                ? taker.id === ME
                    ? 'Anda'
                    : taker.name
                : 'Belum ditentukan',
        ],
        ['Workspace', meeting.workspace?.name ?? '–'],
        ['Berulang', RECURRENCE_LABEL[meeting.recurrence]],
        [
            'Pengingat',
            meeting.reminders.map((m) => `${m}`).join(' dan ') +
                ' menit sebelum',
        ],
    ];
}

function NotFound() {
    return (
        <EmptyState
            icon={CalendarX2}
            title="Rapat tidak ditemukan"
            description="Rapat ini mungkin sudah dibatalkan atau Anda tidak diundang."
            action={
                <Button asChild>
                    <Link href="/rapat">Ke daftar rapat</Link>
                </Button>
            }
        />
    );
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

function canJoin(meeting: Meeting): boolean {
    return (
        Boolean(joinLink(meeting)) &&
        (meeting.platform === 'meet' || meeting.platform === 'zoom')
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
    const { meeting, now, actions } = data;

    if (data.state === 'memuat') {
        return (
            <div className="flex flex-col gap-6">
                <PreviewBar extra={DETAIL_PREVIEWS} />
                <ListSkeleton rows={5} />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <PreviewBar extra={DETAIL_PREVIEWS} />
            {data.state === 'galat' ? (
                <ErrorState
                    title="Detail rapat gagal dimuat"
                    description="Google Calendar tidak menjawab. Coba lagi sebentar."
                />
            ) : !meeting ? (
                <NotFound />
            ) : (
                <>
                    <section className="flex flex-wrap items-end justify-between gap-4">
                        <div className="flex min-w-0 flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                    variant="status"
                                    tone={phaseTone(meeting, now)}
                                    dot
                                >
                                    {phaseLabel(meeting, now)}
                                </Badge>
                                <MinutesBadge
                                    status={meeting.minutes_status}
                                    className="h-8 text-[14px]"
                                />
                            </div>
                            <h1 className="text-[34px] leading-[42px] font-extrabold tracking-[-0.025em] lg:text-[40px] lg:leading-[48px]">
                                {meeting.title}
                            </h1>
                            <p className="text-[17px] text-text-muted">
                                {shortDate(officeDate(meeting.starts_at))} ·{' '}
                                {timeRange(meeting.starts_at, meeting.ends_at)}{' '}
                                · {PLATFORM_LABEL[meeting.platform]}
                                {meeting.workspace
                                    ? ` · ${meeting.workspace.name}`
                                    : ''}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Button
                                variant="outline"
                                size="lg"
                                onClick={() => data.setNoticeOpen(true)}
                            >
                                <BellRing aria-hidden />
                                Uji pemberitahuan
                            </Button>
                            <Button variant="outline" size="lg" asChild>
                                <Link href={`/rapat/${meeting.id}/notulen`}>
                                    <NotebookPen aria-hidden />
                                    {meeting.minutes_status === 'none'
                                        ? 'Mulai notulen'
                                        : 'Buka notulen'}
                                </Link>
                            </Button>
                            {canJoin(meeting) &&
                                meetingPhase(meeting, now) !== 'done' && (
                                    <Button size="lg" onClick={actions.join}>
                                        <Video aria-hidden />
                                        {actions.joined
                                            ? `Buka lagi ${actions.app}`
                                            : `Gabung lewat ${actions.app}`}
                                    </Button>
                                )}
                        </div>
                    </section>

                    <section className="flex flex-wrap items-start gap-5">
                        <div className="flex min-w-0 flex-[2_1_600px] flex-col gap-5">
                            <JoinCard meeting={meeting} actions={actions} />
                            <Panel title="Agenda">
                                <ol className="flex flex-col gap-3">
                                    {meeting.agenda.map((item, index) => (
                                        <li
                                            key={item}
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
                            <ParticipantsPanel
                                participants={data.participants}
                            />
                        </div>
                        <aside
                            className={cn(
                                'flex min-w-0 flex-col gap-4',
                                isTablet
                                    ? 'flex-[1_1_100%]'
                                    : 'flex-[1_1_320px]',
                            )}
                        >
                            {data.isGuest && (
                                <Panel title="Kehadiran Anda">
                                    <RsvpPicker
                                        value={data.rsvp}
                                        onChange={data.answer}
                                    />
                                </Panel>
                            )}
                            <Panel title="Detail">
                                <dl className="flex flex-col">
                                    {infoRows(meeting).map(([key, value]) => (
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
                                    ))}
                                </dl>
                            </Panel>
                            <Panel title="Dokumen terkait">
                                <DocumentsList documents={meeting.documents} />
                            </Panel>
                            <div className="flex flex-col gap-2">
                                <SyncChip
                                    sync={GOOGLE_SYNC}
                                    now={now}
                                    className="w-full justify-start"
                                />
                                {meeting.calendar_event && (
                                    <p className="px-1 font-mono text-[13px] text-text-muted">
                                        {meeting.calendar_event.google_event_id}
                                    </p>
                                )}
                            </div>
                        </aside>
                    </section>

                    <MeetingStartNotice
                        meeting={meeting}
                        now={now}
                        open={data.noticeOpen}
                        onOpenChange={data.setNoticeOpen}
                        variant={isTablet ? 'tablet' : 'desktop'}
                    />
                </>
            )}
        </div>
    );
}

function ParticipantsPanel({ participants }: { participants: Participant[] }) {
    const counts = participants.reduce<Record<Rsvp, number>>(
        (acc, p) => ({ ...acc, [p.rsvp]: acc[p.rsvp] + 1 }),
        { accepted: 0, tentative: 0, declined: 0, pending: 0 },
    );

    return (
        <Panel
            title="Peserta"
            action={
                <span className="text-[15px] font-bold text-link">
                    {counts.accepted} hadir · {counts.tentative} mungkin ·{' '}
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

    if (!link) {
        return (
            <div className="flex items-center gap-4 rounded-panel border border-border bg-surface p-5 shadow-card md:p-6">
                <span
                    aria-hidden
                    className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-muted"
                >
                    <MapPin className="size-6" />
                </span>
                <span className="flex flex-col">
                    <span className="text-[18px] font-bold">
                        {meeting.location ?? PLATFORM_LABEL[meeting.platform]}
                    </span>
                    <span className="text-[15px] text-text-muted">
                        Rapat tatap muka · tidak ada tautan daring
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
    const { meeting, now, actions } = data;
    const [allPeople, setAllPeople] = useState(false);

    if (data.state === 'memuat') {
        return (
            <div className="flex flex-col gap-3.5">
                <PreviewBar extra={DETAIL_PREVIEWS} />
                <ListSkeleton rows={5} />
            </div>
        );
    }

    if (data.state === 'galat' || !meeting) {
        return (
            <div className="flex flex-col gap-3.5">
                <PreviewBar extra={DETAIL_PREVIEWS} />
                {data.state === 'galat' ? (
                    <ErrorState
                        title="Detail rapat gagal dimuat"
                        description="Periksa koneksi lalu coba lagi."
                    />
                ) : (
                    <NotFound />
                )}
            </div>
        );
    }

    const counts = rsvpCounts({ ...meeting, participants: data.participants });
    const taker = personById(PEOPLE, meeting.minute_taker_id);
    const joinable = canJoin(meeting) && meetingPhase(meeting, now) !== 'done';

    return (
        <div className={cn('flex flex-col gap-3.5', joinable && 'pb-28')}>
            <PreviewBar extra={DETAIL_PREVIEWS} />
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant="status" tone={phaseTone(meeting, now)} dot>
                    {phaseLabel(meeting, now)}
                </Badge>
                <MinutesBadge
                    status={meeting.minutes_status}
                    className="h-8 text-[14px]"
                />
            </div>
            <h2 className="text-[28px] leading-[35px] font-extrabold tracking-[-0.02em]">
                {meeting.title}
            </h2>
            <dl className="rounded-[22px] border border-border bg-surface px-4 py-1">
                {infoRows(meeting)
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
            {data.isGuest && (
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
            <section
                aria-label="Agenda"
                className="flex flex-col gap-2 rounded-[22px] border border-border bg-surface p-4"
            >
                <span className="text-[16px] font-bold">Agenda</span>
                <ol className="flex list-decimal flex-col gap-1 pl-5 text-[16px] leading-[25px] text-text">
                    {meeting.agenda.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ol>
            </section>
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
                        {data.participants.length} peserta · {counts.accepted}{' '}
                        hadir
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
            <section
                aria-label="Dokumen terkait"
                className="flex flex-col gap-3 rounded-[22px] border border-border bg-surface p-4"
            >
                <span className="text-[16px] font-bold">Dokumen terkait</span>
                <DocumentsList documents={meeting.documents} />
            </section>
            <div className="grid grid-cols-2 gap-2.5">
                <Button variant="outline" size="lg" className="px-3" asChild>
                    <Link href={`/rapat/${meeting.id}/notulen`}>
                        {meeting.minutes_status === 'none'
                            ? 'Mulai notulen'
                            : 'Notulen'}
                    </Link>
                </Button>
                <Button
                    variant="outline"
                    size="lg"
                    className="px-3"
                    onClick={() => data.setNoticeOpen(true)}
                >
                    Uji notifikasi
                </Button>
                {joinLink(meeting) && (
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
                        {actions.joined
                            ? `Membuka ${actions.app}…`
                            : `Gabung lewat ${actions.app}`}
                    </Button>
                    <span className="text-center text-[13px] text-text-muted">
                        Membuka aplikasi {actions.app} bila terpasang
                    </span>
                </div>
            )}

            <MeetingStartNotice
                meeting={meeting}
                now={now}
                open={data.noticeOpen}
                onOpenChange={data.setNoticeOpen}
                variant="mobile"
            />
        </div>
    );
}
