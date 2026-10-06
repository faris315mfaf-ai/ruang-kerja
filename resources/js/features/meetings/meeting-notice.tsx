import { Video, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { firstName, meetingPhase, personById, phaseLabel } from './lib';
import { useMeetingsContext } from './meetings-context';
import { useMeetingActions } from './meeting-ui';
import type { Meeting, Person } from './types';

const SNOOZE_MINUTES = 5;

/** Minutes before the start at which the notice opens by itself. */
export const NOTICE_MINUTES = 5;

/** "Putri, Dimas, dan 3 lainnya akan hadir" (RSVP yes). */
function attendingLine(meeting: Meeting, people: Person[]): string {
    const names = meeting.participants
        .filter(
            (participant) => participant.rsvp === 'yes' && participant.user_id,
        )
        .map((participant) =>
            firstName(personById(people, participant.user_id)?.name ?? ''),
        )
        .filter((name) => name !== '');

    if (names.length === 0) {
        return 'Belum ada peserta yang menyatakan hadir';
    }

    if (names.length <= 2) {
        return `${names.join(' dan ')} akan hadir`;
    }

    return `${names[0]}, ${names[1]}, dan ${names.length - 2} lainnya akan hadir`;
}

const DISMISSED_KEY = 'rk.meeting-notice.dismissed';

function readDismissed(): string[] {
    try {
        const raw = window.sessionStorage.getItem(DISMISSED_KEY);

        return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
        return [];
    }
}

function writeDismissed(keys: string[]): void {
    try {
        window.sessionStorage.setItem(
            DISMISSED_KEY,
            JSON.stringify(keys.slice(-20)),
        );
    } catch {
        // Storage blocked (private mode): the notice may show again after a reload.
    }
}

/**
 * Opens the "Rapat dimulai" notice by itself from `NOTICE_MINUTES` before
 * the start until the end of the meeting (client clock, no polling), unless
 * the viewer closed it for this occurrence in this tab; "Tunda" hides it
 * for five minutes. The server also sends `meeting.starting` notifications.
 */
export function useStartNotice(meeting: Meeting | null, now: number) {
    const [dismissed, setDismissed] = useState<string[]>(() =>
        typeof window === 'undefined' ? [] : readDismissed(),
    );
    const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);
    const due =
        meeting !== null &&
        !meeting.canceled &&
        meetingPhase(meeting, now) !== 'done' &&
        Date.parse(meeting.starts_at) - now <= NOTICE_MINUTES * 60_000;
    const open =
        due &&
        meeting !== null &&
        !dismissed.includes(meeting.key) &&
        (snoozedUntil === null || now >= snoozedUntil);

    return {
        open,
        snooze: () => setSnoozedUntil(Date.now() + SNOOZE_MINUTES * 60_000),
        dismiss: () => {
            if (!meeting) {
                return;
            }

            const next = [...dismissed, meeting.key];
            setDismissed(next);
            writeDismissed(next);
        },
    };
}

/**
 * "Rapat dimulai" notice (designs DNotifRapat & MNotifRapat): a glass toast
 * at the top right on desktop/tablet, a bottom sheet on phones.
 */
export function MeetingStartNotice({
    meeting,
    now,
    variant,
}: {
    meeting: Meeting;
    now: number;
    variant: 'desktop' | 'tablet' | 'mobile';
}) {
    const { people } = useMeetingsContext();
    const actions = useMeetingActions(meeting);
    const notice = useStartNotice(meeting, now);
    const live = meetingPhase(meeting, now) === 'live';

    const snooze = () => {
        notice.snooze();
        toast(
            `Diingatkan lagi ${formatTime(Date.now() + SNOOZE_MINUTES * 60_000)}`,
            { description: meeting.title },
        );
    };

    const join = () => {
        actions.join();

        if (actions.link) {
            notice.dismiss();
        }
    };

    if (variant === 'mobile') {
        return (
            <BottomSheet
                open={notice.open}
                onOpenChange={(open) => {
                    if (!open) {
                        notice.dismiss();
                    }
                }}
                title={meeting.title}
                description={
                    live
                        ? attendingLine(meeting, people)
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
                        {actions.link && (
                            <Button
                                size="xl"
                                className="col-span-2"
                                onClick={join}
                            >
                                {live
                                    ? 'Gabung sekarang'
                                    : `Gabung lewat ${actions.app}`}
                            </Button>
                        )}
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
                            onClick={snooze}
                        >
                            Tunda {SNOOZE_MINUTES} mnt
                        </Button>
                    </div>
                </div>
            </BottomSheet>
        );
    }

    if (!notice.open) {
        return null;
    }

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
                        {phaseLabel(meeting, now)}
                    </span>
                    <span className="truncate text-[15px] text-text-muted">
                        {meeting.title}
                        {actions.link ? ` · ${actions.app}` : ''}
                    </span>
                </span>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Tutup pemberitahuan"
                    onClick={notice.dismiss}
                >
                    <X aria-hidden />
                </Button>
            </div>
            <div className="flex gap-2">
                {actions.link && (
                    <Button className="flex-1 font-extrabold" onClick={join}>
                        Gabung
                    </Button>
                )}
                <Button
                    variant="outline"
                    className={cn(!actions.link && 'flex-1')}
                    onClick={snooze}
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
    const attending = meeting.participants.filter(
        (participant) => participant.rsvp === 'yes',
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
                    {meeting.title} · {attending} dari{' '}
                    {meeting.participants.length} peserta menyatakan hadir
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
