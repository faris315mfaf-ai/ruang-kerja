import { Video, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PEOPLE } from './fixtures';
import { firstName, meetingPhase, personById, phaseLabel } from './lib';
import { useMeetingActions } from './meeting-ui';
import type { Meeting } from './types';

const SNOOZE_MINUTES = 5;

/** "Putri, Dimas, dan 3 lainnya sudah bergabung" (sample: accepted = joined). */
function joinedLine(meeting: Meeting): string {
    const names = meeting.participants
        .filter(
            (participant) =>
                participant.rsvp === 'accepted' && participant.user_id,
        )
        .map((participant) =>
            firstName(personById(PEOPLE, participant.user_id)?.name ?? ''),
        );

    if (names.length === 0) {
        return 'Belum ada peserta yang bergabung';
    }

    if (names.length <= 2) {
        return `${names.join(' dan ')} sudah bergabung`;
    }

    return `${names[0]}, ${names[1]}, dan ${names.length - 2} lainnya sudah bergabung`;
}

/**
 * "Rapat dimulai" notice (designs DNotifRapat & MNotifRapat): a glass toast
 * at the top right on desktop/tablet, a bottom sheet on phones. Pages open
 * it from "Lihat contoh pemberitahuan"; in production the reminder job would
 * trigger it 5 minutes before start.
 */
export function MeetingStartNotice({
    meeting,
    now,
    open,
    onOpenChange,
    variant,
}: {
    meeting: Meeting;
    now: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    variant: 'desktop' | 'tablet' | 'mobile';
}) {
    const actions = useMeetingActions(meeting);
    const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);
    const [lateSent, setLateSent] = useState(false);
    const live = meetingPhase(meeting, now) === 'live';
    const organizer = personById(PEOPLE, meeting.organizer_id);

    const snooze = () => {
        const until = now + SNOOZE_MINUTES * 60_000;
        setSnoozedUntil(until);
        toast(`Diingatkan lagi ${formatTime(until)}`, {
            description: meeting.title,
        });
    };

    const sendLate = () => {
        setLateSent(true);
        toast.success(
            `Pesan "terlambat 5 menit" terkirim ke ${organizer ? firstName(organizer.name) : 'penyelenggara'}`,
        );
    };

    if (variant === 'mobile') {
        return (
            <BottomSheet
                open={open}
                onOpenChange={onOpenChange}
                title={meeting.title}
                description={
                    live
                        ? joinedLine(meeting)
                        : `${actions.app} · ${formatTime(meeting.starts_at)}`
                }
            >
                <div className="flex flex-col gap-4 pt-1">
                    <span className="flex items-center gap-3">
                        <span
                            aria-hidden
                            className={cn(
                                'size-3 rounded-full ring-[5px]',
                                live
                                    ? 'bg-danger ring-danger-soft'
                                    : 'bg-fill-warning ring-warning-soft',
                            )}
                        />
                        <span
                            className={cn(
                                'text-[15px] font-extrabold uppercase',
                                live ? 'text-danger' : 'text-warning',
                            )}
                        >
                            {phaseLabel(meeting, now)}
                        </span>
                    </span>
                    <div className="grid grid-cols-2 gap-2.5">
                        <Button
                            size="xl"
                            className="col-span-2"
                            onClick={actions.join}
                        >
                            {actions.joined
                                ? `Membuka ${actions.app}…`
                                : live
                                  ? 'Gabung sekarang'
                                  : `Gabung lewat ${actions.app}`}
                        </Button>
                        <Button
                            variant="outline"
                            size="lg"
                            className="px-3"
                            onClick={actions.copy}
                            disabled={!actions.link}
                        >
                            {actions.copied ? 'Tautan disalin' : 'Salin tautan'}
                        </Button>
                        <Button
                            variant="outline"
                            size="lg"
                            className="px-3"
                            onClick={sendLate}
                            disabled={lateSent}
                        >
                            {lateSent
                                ? `Terkirim ke ${organizer ? firstName(organizer.name) : 'penyelenggara'}`
                                : 'Kabari terlambat'}
                        </Button>
                    </div>
                </div>
            </BottomSheet>
        );
    }

    if (!open) {
        return null;
    }

    const title = actions.joined
        ? `Membuka ${actions.app}…`
        : snoozedUntil
          ? `Diingatkan lagi ${formatTime(snoozedUntil)}`
          : phaseLabel(meeting, now);
    const subtitle = actions.joined
        ? 'Kehadiran tercatat untuk notulen'
        : snoozedUntil
          ? meeting.title
          : `${meeting.title} · ${actions.app}`;

    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(
                'glass-strong fixed right-5 z-50 flex w-[380px] max-w-[calc(100vw-2.5rem)] flex-col gap-3 rounded-[22px] p-[18px] shadow-float',
                'animate-in duration-180 ease-brand fade-in-0 slide-in-from-top-2 motion-reduce:animate-none',
                variant === 'desktop'
                    ? 'top-[calc(var(--menu-bar-height)+16px)]'
                    : 'top-5',
            )}
        >
            <div className="flex items-center gap-3">
                <span
                    aria-hidden
                    className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-grad-aksi text-on-brand"
                >
                    <Video className="size-[22px]" strokeWidth={2} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[17px] leading-6 font-extrabold">
                        {title}
                    </span>
                    <span className="truncate text-[15px] text-text-muted">
                        {subtitle}
                    </span>
                </span>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Tutup pemberitahuan"
                    onClick={() => onOpenChange(false)}
                >
                    <X aria-hidden />
                </Button>
            </div>
            <div className="flex gap-2">
                <Button
                    className="flex-1 font-extrabold"
                    onClick={actions.join}
                >
                    Gabung
                </Button>
                <Button
                    variant="outline"
                    onClick={snooze}
                    disabled={actions.joined}
                >
                    Tunda {SNOOZE_MINUTES} mnt
                </Button>
            </div>
        </div>
    );
}

/**
 * Warm banner while a meeting runs and the viewer has not joined yet
 * (DNotifRapat §3). One warm gradient per screen.
 */
export function LiveMeetingBanner({
    meeting,
    now,
    onJoin,
    className,
}: {
    meeting: Meeting;
    now: number;
    onJoin: () => void;
    className?: string;
}) {
    const joined = meeting.participants.filter(
        (participant) => participant.rsvp === 'accepted',
    ).length;

    return (
        <section
            aria-label="Rapat sedang berlangsung"
            className={cn(
                'flex flex-wrap items-center gap-3.5 rounded-[18px] bg-grad-hangat px-[18px] py-4 text-on-brand shadow-warm',
                className,
            )}
        >
            <span
                aria-hidden
                className="size-3 shrink-0 rounded-full bg-on-brand ring-[5px] ring-on-brand/30"
            />
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[17px] font-extrabold">
                    {phaseLabel(meeting, now)}
                </span>
                <span className="text-[15px]">
                    {meeting.title} · {joined} dari{' '}
                    {meeting.participants.length} peserta sudah bergabung
                </span>
            </span>
            <Button
                variant="outline"
                className="border-0 bg-on-brand font-extrabold text-danger hover:bg-on-brand/90"
                onClick={onJoin}
            >
                Gabung
            </Button>
        </section>
    );
}
