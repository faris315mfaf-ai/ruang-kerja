import { router } from '@inertiajs/react';
import { Copy, Video } from 'lucide-react';
import { useEffect } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { stripGuestSuffix } from '../guests/lib';
import { personById } from '../lib';
import { useMeetingsContext } from '../meetings-context';
import type { Meeting } from '../types';
import { countdownLabel, durationShort, joinWindow, namesSummary } from './lib';
import type { VideoSummary } from './types';

/** Joinable now: configured, invited, not canceled, inside the window. */
export function videoJoinable(
    meeting: Meeting,
    video: VideoSummary | null,
    now: number,
): boolean {
    return (
        meeting.platform === 'video' &&
        video !== null &&
        video.configured &&
        video.can_join &&
        !meeting.canceled &&
        joinWindow(video, now).state === 'open'
    );
}

/**
 * Refreshes the `video` prop (who is in the room) every 30 seconds while the
 * room can be joined — a partial Inertia reload, nothing else is refetched.
 */
export function useVideoPresencePoll(
    meeting: Meeting,
    video: VideoSummary | null,
    now: number,
) {
    const active =
        video !== null &&
        video.configured &&
        !meeting.canceled &&
        joinWindow({ ...video, is_organizer: false }, now).state === 'open';

    useEffect(() => {
        if (!active) {
            return;
        }

        const id = window.setInterval(
            () => router.reload({ only: ['video'] }),
            30_000,
        );

        return () => window.clearInterval(id);
    }, [active]);
}

/**
 * Detail page card of a Video RuangKerja meeting (replaces the pasted-link
 * card): who is in the room, the join window and "Gabung rapat video".
 */
export function VideoJoinCard({
    meeting,
    video,
    now,
    onCopy,
    copied,
}: {
    meeting: Meeting;
    video: VideoSummary | null;
    now: number;
    onCopy: () => void;
    copied: boolean;
}) {
    const { people } = useMeetingsContext();

    if (!video || !video.configured) {
        return (
            <div className="flex items-center gap-4 rounded-panel border border-border bg-surface p-5 shadow-card md:p-6">
                <span
                    aria-hidden
                    className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-muted"
                >
                    <Video className="size-6" />
                </span>
                <span className="flex flex-col">
                    <span className="text-[18px] font-bold">
                        Video RuangKerja
                    </span>
                    <span className="text-[15px] text-text-muted">
                        Server rapat video belum disiapkan. Hubungi admin, atau
                        ubah tempat rapat ke Google Meet/Zoom.
                    </span>
                </span>
            </div>
        );
    }

    const state = joinWindow(video, now);
    const inRoom = video.attendance.filter((person) => person.in_room);
    const names = inRoom.map(
        (person) => personById(people, person.user_id)?.name ?? 'Peserta',
    );
    const joinable = videoJoinable(meeting, video, now);
    const headline = meeting.canceled
        ? 'Rapat dibatalkan'
        : inRoom.length > 0
          ? `${inRoom.length} orang di ruang rapat`
          : state.state === 'early'
            ? `Ruang dibuka ${formatTime(video.opens_at)}`
            : state.state === 'closed'
              ? 'Ruang rapat sudah ditutup'
              : 'Ruang rapat terbuka';
    const detail = !video.can_join
        ? (video.denied_reason ?? 'Anda tidak diundang ke rapat ini.')
        : inRoom.length > 0
          ? `${namesSummary(names)} sudah bergabung`
          : 'Kamera & mikrofon dicek dulu sebelum masuk.';

    return (
        <div
            className="flex flex-wrap items-center gap-4 rounded-panel border border-border bg-surface p-5 shadow-card md:p-6"
            data-testid="video-join-card"
        >
            <span
                aria-hidden
                className="relative flex size-12 shrink-0 items-center justify-center rounded-lg bg-grad-aksi text-on-brand"
            >
                <Video className="size-6" />
                {inRoom.length > 0 && (
                    <span className="absolute -top-1 -right-1 size-3.5 rounded-full border-2 border-surface bg-success" />
                )}
            </span>
            <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                    <Badge variant="label" tone="info">
                        Video RuangKerja
                    </Badge>
                </span>
                <span
                    className="text-[18px] font-bold"
                    aria-live="polite"
                    data-testid="video-headline"
                >
                    {headline}
                </span>
                <span className="text-[15px] text-text-muted">{detail}</span>
            </span>
            <span className="flex flex-wrap gap-2.5">
                <Button variant="outline" onClick={onCopy}>
                    <Copy aria-hidden />
                    {copied ? 'Tautan disalin' : 'Salin tautan'}
                </Button>
                {video.can_join &&
                    !meeting.canceled &&
                    state.state !== 'closed' && (
                        <Button
                            disabled={!joinable}
                            onClick={() => router.visit(video.join_href)}
                        >
                            <Video aria-hidden />
                            {state.state === 'early'
                                ? countdownLabel(state.msUntilOpen)
                                : 'Gabung rapat video'}
                        </Button>
                    )}
            </span>
        </div>
    );
}

/** "Hadir di rapat video": who joined, when, and for how long (webhooks). */
export function VideoAttendancePanel({
    video,
    className,
}: {
    video: VideoSummary | null;
    className?: string;
}) {
    const { people, me } = useMeetingsContext();

    const guests = video?.guests ?? [];

    if (!video || (video.attendance.length === 0 && guests.length === 0)) {
        return null;
    }

    return (
        <Panel
            title="Hadir di rapat video"
            className={className}
            action={
                <span className="text-[15px] font-bold text-link">
                    {video.attendance.length} orang
                    {guests.length > 0 && ` + ${guests.length} tamu`}
                </span>
            }
        >
            <ul className="flex flex-col divide-y divide-divider">
                {video.attendance.map((person) => {
                    const known = personById(people, person.user_id);
                    const name = known?.name ?? 'Peserta';

                    return (
                        <li
                            key={person.user_id}
                            className="flex min-h-14 items-center gap-3 py-2"
                        >
                            <UserAvatar
                                name={name}
                                src={known?.avatar_url}
                                className="size-9 text-[14px]"
                            />
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-[15px] font-semibold">
                                    {person.user_id === me
                                        ? `${name} (Anda)`
                                        : name}
                                </span>
                                <span className="text-[14px] text-text-muted tnum">
                                    {formatTime(person.joined_at)}
                                    {person.left_at
                                        ? `–${formatTime(person.left_at)}`
                                        : ''}{' '}
                                    · {durationShort(person.duration_seconds)}
                                    {person.sessions > 1
                                        ? ` · ${person.sessions} kali masuk`
                                        : ''}
                                </span>
                            </span>
                            {person.in_room && (
                                <Badge
                                    variant="status"
                                    tone="success"
                                    dot
                                    className={cn('shrink-0')}
                                >
                                    Di ruang
                                </Badge>
                            )}
                        </li>
                    );
                })}
            </ul>
            {guests.length > 0 && (
                <ul
                    aria-label="Tamu di rapat video"
                    className="flex flex-col divide-y divide-divider border-t border-border"
                >
                    {guests.map((guest) => (
                        <li
                            key={guest.participant_id}
                            className="flex min-h-14 items-center gap-3 py-2"
                        >
                            <UserAvatar
                                name={stripGuestSuffix(guest.name) || 'Tamu'}
                                className="size-9 text-[14px]"
                            />
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="flex min-w-0 items-center gap-1.5">
                                    <span className="truncate text-[15px] font-semibold">
                                        {stripGuestSuffix(guest.name) || 'Tamu'}
                                    </span>
                                    <Badge
                                        variant="label"
                                        className="h-5 rounded-full px-1.5 text-[11px]"
                                    >
                                        Tamu
                                    </Badge>
                                </span>
                                <span className="text-[14px] text-text-muted tnum">
                                    {formatTime(guest.joined_at)}
                                    {guest.left_at
                                        ? `–${formatTime(guest.left_at)}`
                                        : ''}{' '}
                                    · {durationShort(guest.duration_seconds)}
                                </span>
                            </span>
                            {guest.in_room && (
                                <Badge variant="status" tone="success" dot>
                                    Di ruang
                                </Badge>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}
