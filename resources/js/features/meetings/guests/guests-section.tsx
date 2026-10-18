import { useParticipants } from '@livekit/components-react';
import type { Participant } from 'livekit-client';
import { RoomEvent, Track } from 'livekit-client';
import { MicOff, MoreHorizontal, UserMinus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { isGuestIdentity, mergeGuestRows } from './lib';
import type { GuestAttendee, OrganizerGuest } from './types';

const STATUS_NOTE: Record<string, string> = {
    removed: 'dikeluarkan',
    denied: 'ditolak',
};

/**
 * "Tamu" group of the room's Kehadiran panel: external guests in the room
 * now (from LiveKit, with the organizer's Bisukan / Keluarkan), guests who
 * attended and left, and — for the organizer — guests who were removed or
 * denied, who can be let in again. Employees stay in the list above; guests
 * are never counted in the employee totals.
 */
export function GuestsSection({
    attended,
    invited,
    canModerate,
    onMute,
    onRemove,
    onAdmitAgain,
}: {
    attended: GuestAttendee[];
    /** Organizer's guest list (statuses), null for everybody else. */
    invited: OrganizerGuest[] | null;
    canModerate: boolean;
    onMute: (participant: Participant, trackSid: string) => void;
    onRemove: (participant: Participant) => Promise<void>;
    /** Resolves to an error message, or null when it worked. */
    onAdmitAgain: (guestId: string) => Promise<string | null>;
}) {
    const participants = useParticipants({
        updateOnlyOn: [
            RoomEvent.ParticipantConnected,
            RoomEvent.ParticipantDisconnected,
            RoomEvent.TrackMuted,
            RoomEvent.TrackUnmuted,
            RoomEvent.TrackPublished,
            RoomEvent.TrackUnpublished,
        ],
    });
    const live = useMemo(
        () => participants.filter((p) => isGuestIdentity(p.identity)),
        [participants],
    );
    const rows = mergeGuestRows({
        live: live.map((p) => ({ identity: p.identity, name: p.name ?? '' })),
        attended,
        invited,
    });
    const [removing, setRemoving] = useState<Participant | null>(null);
    const [busy, setBusy] = useState(false);
    const [admitting, setAdmitting] = useState<string | null>(null);

    if (rows.length === 0) {
        return null;
    }

    return (
        <section
            aria-label="Tamu"
            className="flex flex-col gap-2 border-t border-border pt-2.5"
            data-testid="guests-section"
        >
            <h3 className="flex items-center gap-2 text-[13px] font-bold text-text-muted">
                Tamu ({rows.length})
            </h3>
            <ul className="flex flex-col gap-2.5">
                {rows.map((row) => {
                    const participant = live.find(
                        (p) => p.identity === row.identity,
                    );
                    const publication = participant?.getTrackPublication(
                        Track.Source.Microphone,
                    );
                    const micSid = publication?.trackSid;
                    const micMuted = publication?.isMuted ?? true;
                    const note = STATUS_NOTE[row.status ?? ''];

                    return (
                        <li
                            key={row.identity}
                            className="flex items-center gap-2.5 text-[14px]"
                        >
                            <UserAvatar
                                name={row.name}
                                className={cn(
                                    'size-7 text-[11px]',
                                    !row.live && 'opacity-60',
                                )}
                            />
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="flex min-w-0 items-center gap-1.5">
                                    <span className="truncate font-semibold">
                                        {row.name}
                                    </span>
                                    <Badge
                                        variant="label"
                                        className="h-5 rounded-full px-1.5 text-[11px]"
                                    >
                                        Tamu
                                    </Badge>
                                </span>
                                <span className="font-mono text-[12px] text-text-muted">
                                    {row.live
                                        ? row.joinedAt
                                            ? `masuk ${formatTime(row.joinedAt)}`
                                            : 'di ruang rapat'
                                        : note
                                          ? note
                                          : row.joinedAt
                                            ? `masuk ${formatTime(row.joinedAt)} · keluar`
                                            : 'belum masuk'}
                                </span>
                            </span>
                            {canModerate && row.live && participant && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label={`Moderasi ${row.name} (Tamu)`}
                                        >
                                            <MoreHorizontal aria-hidden />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            disabled={micMuted || !micSid}
                                            onSelect={() =>
                                                micSid &&
                                                onMute(participant, micSid)
                                            }
                                        >
                                            <MicOff aria-hidden />
                                            Bisukan {row.name}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            variant="destructive"
                                            onSelect={() =>
                                                setRemoving(participant)
                                            }
                                        >
                                            <UserMinus aria-hidden />
                                            Keluarkan dari rapat
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                            {canModerate &&
                                !row.live &&
                                row.guestId &&
                                (row.status === 'removed' ||
                                    row.status === 'denied') && (
                                    <Button
                                        variant="quiet"
                                        size="sm"
                                        className="h-9 px-2 text-[13px]"
                                        disabled={admitting === row.guestId}
                                        onClick={() => {
                                            setAdmitting(row.guestId);
                                            void onAdmitAgain(
                                                row.guestId as string,
                                            ).finally(() => setAdmitting(null));
                                        }}
                                    >
                                        {admitting === row.guestId && (
                                            <Spinner />
                                        )}
                                        Izinkan masuk lagi
                                    </Button>
                                )}
                        </li>
                    );
                })}
            </ul>
            <Dialog
                open={removing !== null}
                onOpenChange={(open) => !open && setRemoving(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Keluarkan {removing?.name ?? 'tamu'}?
                        </DialogTitle>
                        <DialogDescription>
                            Tamu keluar dari ruang rapat sekarang dan tidak bisa
                            masuk lagi sampai Anda memilih &quot;Izinkan masuk
                            lagi&quot;.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setRemoving(null)}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={busy}
                            onClick={() => {
                                if (!removing) {
                                    return;
                                }

                                setBusy(true);
                                void onRemove(removing).finally(() => {
                                    setBusy(false);
                                    setRemoving(null);
                                });
                            }}
                        >
                            Keluarkan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
