import { Link } from '@inertiajs/react';
import {
    BellRing,
    CalendarCheck,
    ChevronRight,
    Plus,
    Video,
} from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { appBarIconButton } from '@/components/mobile/app-bar';
import { Button } from '@/components/ui/button';
import { Panel, PanelLink } from '@/components/ui/panel';
import { formatTime } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { ME, MEETINGS, PEOPLE } from './fixtures';
import type { OwnedAction } from './lib';
import {
    displayLink,
    dueLabel,
    joinLink,
    meetingPhase,
    officeDate,
    personById,
    PLATFORM_LABEL,
    rsvpCounts,
    shortDate,
    timeRange,
} from './lib';
import {
    AvatarStack,
    MinutesBadge,
    PLATFORM_EDGE,
    PlatformBadge,
    useMeetingActions,
} from './meeting-ui';
import type { Meeting } from './types';

/** Round gradient "+" in the phone app bar (MRapat). */
export function NewMeetingAction() {
    return (
        <Link
            href="/rapat/baru"
            aria-label="Jadwalkan rapat"
            className={cn(
                appBarIconButton,
                'border-0 bg-grad-aksi text-on-brand active:bg-grad-aksi',
            )}
        >
            <Plus className="size-6" strokeWidth={2.4} aria-hidden />
        </Link>
    );
}

export function meetingMeta(meeting: Meeting): string {
    if (meeting.note) {
        return meeting.note;
    }

    const organizer = personById(PEOPLE, meeting.organizer_id);
    const who =
        meeting.organizer_id === ME
            ? 'Anda penyelenggara'
            : (organizer?.name ?? 'Penyelenggara');

    return `${who} · ${meeting.participants.length} peserta`;
}

type RowAction = {
    label: string;
    href?: string;
    tone: 'join' | 'minutes' | 'plain';
};

function rowAction(meeting: Meeting, now: number): RowAction {
    const phase = meetingPhase(meeting, now);

    if (phase === 'soon' || phase === 'live') {
        return { label: 'Gabung', tone: 'join' };
    }

    if (
        phase === 'done' &&
        meeting.minutes_status === 'draft' &&
        meeting.minute_taker_id === ME
    ) {
        return {
            label: 'Lengkapi notulen',
            href: `/rapat/${meeting.id}/notulen`,
            tone: 'minutes',
        };
    }

    if (meeting.minutes_status !== 'none') {
        return {
            label: 'Lihat notulen',
            href: `/rapat/${meeting.id}/notulen`,
            tone: 'plain',
        };
    }

    return { label: 'Detail', href: `/rapat/${meeting.id}`, tone: 'plain' };
}

/** One meeting row of the agenda card (DRapat list). */
export function AgendaRow({ meeting, now }: { meeting: Meeting; now: number }) {
    const phase = meetingPhase(meeting, now);
    const highlight = phase === 'soon' || phase === 'live';
    const action = rowAction(meeting, now);
    const actions = useMeetingActions(meeting);

    return (
        <li
            className={cn(
                'flex flex-wrap items-center gap-x-[18px] gap-y-3 border-t border-divider px-5 py-[18px] first:border-t-0 md:px-6',
                highlight && 'bg-link-soft/50',
            )}
        >
            <span className="flex w-[88px] shrink-0 flex-col">
                <span className="text-[20px] leading-7 font-extrabold">
                    {formatTime(meeting.starts_at)}
                </span>
                <span className="text-[14px] text-text-muted">
                    s.d. {formatTime(meeting.ends_at)}
                </span>
            </span>
            <span
                aria-hidden
                className={cn(
                    'w-1 self-stretch rounded-[2px]',
                    highlight
                        ? 'bg-grad-merek-y'
                        : PLATFORM_EDGE[meeting.platform],
                )}
            />
            <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
                <Link
                    href={`/rapat/${meeting.id}`}
                    className={cn(
                        'w-fit rounded-sm text-[18px] leading-6 font-bold hover:underline',
                        phase === 'done' ? 'text-text-muted' : 'text-text',
                        focusRing,
                    )}
                >
                    {meeting.title}
                </Link>
                <span className="flex flex-wrap items-center gap-2 text-[14px] text-text-muted">
                    <PlatformBadge platform={meeting.platform} />
                    <span>{meetingMeta(meeting)}</span>
                </span>
            </span>
            <span className="ml-auto flex items-center gap-3">
                <MinutesBadge status={meeting.minutes_status} />
                {action.tone === 'join' ? (
                    <Button
                        onClick={actions.join}
                        aria-label={`Gabung ${meeting.title}`}
                    >
                        <Video aria-hidden />
                        Gabung
                    </Button>
                ) : (
                    <Button
                        asChild
                        variant={
                            action.tone === 'minutes' ? 'secondary' : 'outline'
                        }
                        className={cn(
                            action.tone === 'minutes' &&
                                'bg-warning-soft text-warning hover:bg-warning-soft/80',
                        )}
                    >
                        <Link
                            href={action.href!}
                            aria-label={`${action.label}: ${meeting.title}`}
                        >
                            {action.label}
                        </Link>
                    </Button>
                )}
            </span>
        </li>
    );
}

/** Compact row for phones and the tablet agenda (MRapat list). */
export function AgendaRowCompact({
    meeting,
    now,
}: {
    meeting: Meeting;
    now: number;
}) {
    const phase = meetingPhase(meeting, now);
    const href =
        meeting.minutes_status !== 'none' && phase === 'done'
            ? `/rapat/${meeting.id}/notulen`
            : `/rapat/${meeting.id}`;
    const note =
        meeting.minutes_status === 'final'
            ? 'Notulen final'
            : meeting.minutes_status === 'draft'
              ? 'Notulen draf'
              : meeting.organizer_id === ME
                ? 'Anda penyelenggara'
                : 'Anda diundang';

    return (
        <li className="border-t border-divider first:border-t-0">
            <Link
                href={href}
                className={cn(
                    'flex min-h-[72px] items-center gap-3 px-4 py-3.5 transition-colors duration-120 ease-brand active:bg-surface-2',
                    focusRing,
                    'focus-visible:ring-inset',
                )}
            >
                <span className="flex w-[54px] shrink-0 flex-col">
                    <span className="text-[17px] leading-6 font-extrabold">
                        {formatTime(meeting.starts_at)}
                    </span>
                    <span className="text-[13px] text-text-muted">
                        {formatTime(meeting.ends_at)}
                    </span>
                </span>
                <span
                    aria-hidden
                    className={cn(
                        'w-1 self-stretch rounded-[2px]',
                        PLATFORM_EDGE[meeting.platform],
                    )}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span
                        className={cn(
                            'text-[16px] leading-[22px] font-bold',
                            phase === 'done' ? 'text-text-muted' : 'text-text',
                        )}
                    >
                        {meeting.title}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-text-muted">
                        <PlatformBadge
                            platform={meeting.platform}
                            className="h-[22px] px-2 text-[13px]"
                        />
                        {note}
                    </span>
                </span>
                <ChevronRight
                    aria-hidden
                    className="size-[18px] shrink-0 text-text-subtle"
                    strokeWidth={2.4}
                />
            </Link>
        </li>
    );
}

/** Gradient card for the meeting about to start / running (DRapat hero). */
export function NextMeetingHero({
    meeting,
    now,
    compact = false,
    actions: shared,
    className,
}: {
    meeting: Meeting;
    now: number;
    compact?: boolean;
    /** Share join state with a live banner on the same page. */
    actions?: ReturnType<typeof useMeetingActions>;
    className?: string;
}) {
    const own = useMeetingActions(meeting);
    const actions = shared ?? own;
    const phase = meetingPhase(meeting, now);
    const organizer = personById(PEOPLE, meeting.organizer_id);
    const counts = rsvpCounts(meeting);
    const optional = meeting.participants.filter((p) => p.optional).length;
    const link = joinLink(meeting);
    const badge = actions.joined
        ? `Anda sudah bergabung · ${formatTime(now)}`
        : phase === 'live'
          ? 'Sedang berlangsung'
          : phase === 'soon'
            ? `Mulai ${Math.max(1, Math.ceil((Date.parse(meeting.starts_at) - now) / 60_000))} menit lagi`
            : officeDate(meeting.starts_at) === officeDate(now)
              ? `Berikutnya · ${formatTime(meeting.starts_at)}`
              : shortDate(officeDate(meeting.starts_at));

    if (compact) {
        return (
            <section
                aria-label="Rapat berikutnya"
                className={cn(
                    'flex flex-col gap-2.5 rounded-panel bg-grad-highlight p-[18px] text-on-brand shadow-glow',
                    className,
                )}
            >
                <span className="inline-flex h-7 items-center self-start rounded-full bg-on-brand/20 px-2.5 text-[13px] font-extrabold uppercase">
                    {badge}
                </span>
                <Link
                    href={`/rapat/${meeting.id}`}
                    className={cn(
                        'rounded-sm text-[21px] leading-[27px] font-extrabold',
                        focusRing,
                    )}
                >
                    {meeting.title}
                </Link>
                <span className="text-[15px]">
                    {timeRange(meeting.starts_at, meeting.ends_at)} ·{' '}
                    {PLATFORM_LABEL[meeting.platform]} ·{' '}
                    {meeting.participants.length} peserta
                </span>
                {(meeting.platform === 'meet' ||
                    meeting.platform === 'zoom') && (
                    <Button
                        size="lg"
                        className="bg-on-brand bg-none font-extrabold text-brand-800 shadow-none hover:bg-on-brand/90"
                        onClick={actions.join}
                    >
                        {actions.joined ? `Membuka ${actions.app}…` : 'Gabung'}
                    </Button>
                )}
            </section>
        );
    }

    return (
        <section
            aria-label="Rapat berikutnya"
            className={cn(
                'flex flex-wrap items-center gap-6 rounded-[28px] bg-grad-highlight p-6 text-on-brand shadow-glow md:p-7',
                className,
            )}
        >
            <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2.5">
                <span className="inline-flex h-8 items-center gap-2 self-start rounded-full bg-on-brand/20 px-3 text-[15px] font-extrabold">
                    <span
                        aria-hidden
                        className="size-2 rounded-full bg-on-brand"
                    />
                    {badge}
                </span>
                <Link
                    href={`/rapat/${meeting.id}`}
                    className={cn(
                        'rounded-sm text-[28px] leading-9 font-extrabold tracking-[-0.02em] hover:underline md:text-[32px] md:leading-10',
                        focusRing,
                    )}
                >
                    {meeting.title}
                </Link>
                <span className="text-[17px]">
                    {timeRange(meeting.starts_at, meeting.ends_at)} ·{' '}
                    {PLATFORM_LABEL[meeting.platform]} · diadakan{' '}
                    {organizer?.name ?? 'penyelenggara'}
                    {meeting.workspace
                        ? ` · workspace ${meeting.workspace.key}`
                        : ''}
                </span>
                <span className="flex items-center gap-2.5 text-[15px]">
                    <AvatarStack
                        participants={meeting.participants}
                        ringClassName="ring-accent-blue-strong"
                    />
                    {meeting.participants.length} peserta · {counts.accepted}{' '}
                    hadir
                    {optional > 0 ? ` · ${optional} opsional` : ''}
                </span>
            </div>
            <div className="flex min-w-0 flex-[0_1_360px] flex-col gap-2.5">
                {(meeting.platform === 'meet' ||
                    meeting.platform === 'zoom') && (
                    <Button
                        size="xl"
                        className="bg-on-brand bg-none font-extrabold text-brand-800 shadow-none hover:bg-on-brand/90"
                        onClick={actions.join}
                    >
                        <Video aria-hidden className="size-[22px]" />
                        {actions.joined
                            ? `Buka lagi ${actions.app}`
                            : `Gabung lewat ${actions.app}`}
                    </Button>
                )}
                <div className="flex gap-2.5">
                    {link && (
                        <Button
                            variant="outline"
                            className="h-[46px] flex-1 border-on-brand/45 bg-on-brand/12 font-bold text-on-brand hover:bg-on-brand/20"
                            onClick={actions.copy}
                        >
                            {actions.copied ? 'Tautan disalin' : 'Salin tautan'}
                        </Button>
                    )}
                    <Button
                        asChild
                        variant="outline"
                        className="h-[46px] flex-1 border-on-brand/45 bg-on-brand/12 font-bold text-on-brand hover:bg-on-brand/20"
                    >
                        <Link href={`/rapat/${meeting.id}/notulen`}>
                            Buka notulen
                        </Link>
                    </Button>
                </div>
                {link && (
                    <span className="text-center font-mono text-[14px] break-all">
                        {displayLink(link)}
                    </span>
                )}
            </div>
        </section>
    );
}

/** "Tindak lanjut untuk Anda" (DRapat aside). */
export function FollowUpsPanel({
    items,
    today,
    className,
}: {
    items: OwnedAction[];
    today: string;
    className?: string;
}) {
    return (
        <Panel title="Tindak lanjut untuk Anda" className={className}>
            {items.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={CalendarCheck}
                    title="Semua tindak lanjut beres"
                >
                    Butir tindak lanjut dari notulen yang ditugaskan kepada Anda
                    muncul di sini.
                </EmptyState>
            ) : (
                <ul className="flex flex-col">
                    {items.map((item) => {
                        const meeting = MEETINGS.find(
                            (m) => m.id === item.meeting_id,
                        );
                        const late = item.due_date < today;

                        return (
                            <li
                                key={`${item.meeting_id}-${item.id}`}
                                className="border-t border-divider first:border-t-0"
                            >
                                <Link
                                    href={`/rapat/${item.meeting_id}/notulen`}
                                    className={cn(
                                        'flex flex-col gap-1 rounded-sm py-3 transition-opacity duration-120 ease-brand hover:opacity-80',
                                        focusRing,
                                    )}
                                >
                                    <span className="text-[16px] leading-6 font-semibold">
                                        {item.text}
                                    </span>
                                    <span className="text-[14px] text-text-muted">
                                        {meeting
                                            ? `${meeting.title} ${shortDate(officeDate(meeting.starts_at)).split(', ')[1]}`
                                            : 'Rapat'}{' '}
                                        ·{' '}
                                        <b
                                            className={
                                                late
                                                    ? 'text-danger'
                                                    : 'text-text'
                                            }
                                        >
                                            {dueLabel(item.due_date, today)}
                                        </b>
                                        {item.task_key && (
                                            <span className="font-mono font-semibold">
                                                {' '}
                                                · {item.task_key}
                                            </span>
                                        )}
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Panel>
    );
}

/** "Pengingat rapat" settings summary + sample notice trigger. */
export function RemindersPanel({
    onPreview,
    className,
}: {
    onPreview?: () => void;
    className?: string;
}) {
    const rows = [
        ['Waktu', '15 dan 5 menit sebelum'],
        ['Kanal', 'Aplikasi, email'],
    ];

    return (
        <Panel title="Pengingat rapat" className={className}>
            <dl className="flex flex-col gap-2.5">
                {rows.map(([key, value]) => (
                    <div
                        key={key}
                        className="flex justify-between gap-3 text-[16px]"
                    >
                        <dt className="text-text-muted">{key}</dt>
                        <dd className="text-right font-bold">{value}</dd>
                    </div>
                ))}
                <div className="flex justify-between gap-3 text-[16px]">
                    <dt className="text-text-muted">WhatsApp</dt>
                    <dd className="text-right">
                        <PanelLink href="/pengaturan/whatsapp">
                            Atur WhatsApp
                        </PanelLink>
                    </dd>
                </div>
            </dl>
            {onPreview && (
                <Button
                    variant="tonal"
                    className="mt-3 self-start"
                    onClick={onPreview}
                >
                    <BellRing aria-hidden />
                    Lihat contoh pemberitahuan
                </Button>
            )}
        </Panel>
    );
}
