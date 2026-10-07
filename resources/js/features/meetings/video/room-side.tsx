import type { Participant } from 'livekit-client';
import { RoomEvent, Track } from 'livekit-client';
import { useParticipants } from '@livekit/components-react';
import { Hand, MicOff, MoreHorizontal, UserMinus } from 'lucide-react';
import { useState } from 'react';
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
import { formatTime } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import type { AttendanceRow } from './contract';
import { docAnchor } from './room-doc';
import { raisedHandOrder } from './lib';
import { resolvePerson, useRoomPeople } from './room-people';
import type { TalkRow } from './talk-time';
import { talkMinutes } from './talk-time';
import type { AgendaSection } from './types';

/** "Bagian": jumps to a section of the minutes document. */
export function SectionNav({
    sections,
    active,
    onJump,
    className,
}: {
    sections: AgendaSection[];
    active: string | null;
    onJump: (key: string) => void;
    className?: string;
}) {
    let number = 0;

    return (
        <nav
            aria-label="Bagian notulen"
            className={cn('flex flex-col gap-2', className)}
        >
            <h2 className="text-[15px] font-bold">Bagian</h2>
            <ol className="flex flex-col gap-1">
                {sections.map((section) => {
                    const numbered = section.index !== null;
                    number += numbered ? 1 : 0;
                    const current = section.key === active;

                    return (
                        <li key={section.key}>
                            <a
                                href={`#${docAnchor(section.key)}`}
                                aria-current={current ? 'location' : undefined}
                                onClick={(event) => {
                                    event.preventDefault();
                                    onJump(section.key);
                                }}
                                className={cn(
                                    'block rounded-[10px] px-2.5 py-2 text-[14px] leading-5 transition-colors duration-120 ease-brand',
                                    current
                                        ? 'bg-surface font-semibold text-text shadow-card'
                                        : 'text-text-muted hover:bg-surface/60 hover:text-text',
                                    focusRing,
                                )}
                            >
                                {numbered ? `${number}. ` : ''}
                                {section.title}
                            </a>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

/** "Waktu bicara": bars per person, minutes, who dominates, who is silent. */
export function TalkTimePanel({
    rows,
    summary,
}: {
    rows: TalkRow[];
    summary: string | null;
}) {
    const people = useRoomPeople();
    return (
        <section
            aria-labelledby="talk-time-title"
            className="flex flex-col gap-3"
            data-testid="talk-time"
        >
            <h2 id="talk-time-title" className="text-[15px] font-bold">
                Waktu bicara
            </h2>
            {rows.length === 0 ? (
                <p className="text-[13px] text-text-muted">
                    Muncul setelah ada yang bicara.
                </p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {rows.map((row) => {
                        const person = people.get(row.id);
                        const name = person?.first_name ?? 'Peserta';

                        return (
                            <li key={row.id} className="flex flex-col gap-1">
                                <span className="flex items-center gap-2 text-[13px]">
                                    <UserAvatar
                                        name={person?.name ?? name}
                                        src={person?.avatar_url}
                                        className="size-[22px] text-[9px]"
                                    />
                                    <span className="min-w-0 flex-1 truncate">
                                        {name}
                                    </span>
                                    <span className="font-mono text-text-muted tnum">
                                        {talkMinutes(row.ms)}
                                    </span>
                                </span>
                                <span
                                    role="meter"
                                    aria-label={`Waktu bicara ${name}`}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={Math.round(row.share * 100)}
                                    aria-valuetext={`${talkMinutes(row.ms)} menit, ${Math.round(row.share * 100)}%`}
                                    className="h-1.5 overflow-hidden rounded-full bg-border"
                                >
                                    <span
                                        className={cn(
                                            'block h-full rounded-full transition-[width] duration-180 ease-brand motion-reduce:transition-none',
                                            row.dominant
                                                ? 'bg-warning'
                                                : 'bg-primary',
                                        )}
                                        style={{
                                            width: `${Math.round(row.relative * 100)}%`,
                                        }}
                                    />
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
            {summary && (
                <p className="text-[12px] leading-[17px] text-text-subtle">
                    {summary}
                </p>
            )}
        </section>
    );
}

/**
 * "Kehadiran": who joined when (from the LiveKit webhook attendance), late
 * badges, raised hands, who has not joined with **Panggil** (minute taker /
 * organizer), and the organizer's Bisukan / Keluarkan.
 */
export function AttendancePanel({
    rows,
    canCall,
    calling,
    onCall,
    canModerate,
    onMute,
    onRemove,
}: {
    rows: AttendanceRow[];
    canCall: boolean;
    calling: Set<string>;
    onCall: (userId: string) => void;
    canModerate: boolean;
    onMute: (participant: Participant, trackSid: string) => void;
    onRemove: (participant: Participant) => Promise<void>;
}) {
    const people = useRoomPeople();
    // Leaf subscription: joins, leaves, mute and hand changes only.
    const participants = useParticipants({
        updateOnlyOn: [
            RoomEvent.ParticipantConnected,
            RoomEvent.ParticipantDisconnected,
            RoomEvent.ParticipantAttributesChanged,
            RoomEvent.TrackMuted,
            RoomEvent.TrackUnmuted,
            RoomEvent.TrackPublished,
            RoomEvent.TrackUnpublished,
        ],
    });
    const live = (identity: string) =>
        participants.find((p) => p.identity === identity);
    const hands = raisedHandOrder(participants, (p) => p.attributes.hand);
    const [removing, setRemoving] = useState<Participant | null>(null);
    const [busy, setBusy] = useState(false);
    const joined = rows.filter((row) => row.kind === 'joined');
    const absent = rows.filter((row) => row.kind === 'absent');
    const nameOf = (id: string) => people.get(id)?.first_name ?? 'Peserta';

    return (
        <div
            className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto"
            data-testid="attendance"
        >
            {hands.length > 0 && (
                <section
                    aria-label="Angkat tangan"
                    className="flex flex-col gap-1.5 rounded-control bg-warning-soft px-3 py-2.5 text-warning"
                >
                    <h3 className="text-[13px] font-bold">
                        Angkat tangan ({hands.length})
                    </h3>
                    <ol className="flex flex-col gap-1 text-[14px] font-semibold">
                        {hands.map((p, index) => (
                            <li
                                key={p.identity}
                                className="flex items-center gap-2"
                            >
                                <Hand aria-hidden className="size-4" />
                                {index + 1}.{' '}
                                {p.isLocal
                                    ? 'Anda'
                                    : resolvePerson(people, p.identity)
                                          .first_name}
                            </li>
                        ))}
                    </ol>
                </section>
            )}
            <ul className="flex flex-col gap-2.5">
                {joined.map((row) => {
                    if (row.kind !== 'joined') {
                        return null;
                    }

                    const person = people.get(row.userId);
                    const participant = live(row.userId);
                    const micSid = participant?.getTrackPublication(
                        Track.Source.Microphone,
                    )?.trackSid;
                    const micMuted =
                        participant?.getTrackPublication(
                            Track.Source.Microphone,
                        )?.isMuted ?? true;

                    return (
                        <li
                            key={row.userId}
                            className="flex items-center gap-2.5 text-[14px]"
                        >
                            <UserAvatar
                                name={person?.name ?? 'Peserta'}
                                src={person?.avatar_url}
                                className={cn(
                                    'size-7 text-[11px]',
                                    !row.inRoom && 'opacity-60',
                                )}
                            />
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate font-semibold">
                                    {nameOf(row.userId)}
                                </span>
                                <span className="font-mono text-[12px] text-text-subtle">
                                    masuk {formatTime(row.joinedAt)}
                                    {!row.inRoom && ' · keluar'}
                                </span>
                            </span>
                            <Badge
                                variant="status"
                                tone={row.late ? 'warning' : 'success'}
                                className="h-6 px-2 text-[12px]"
                            >
                                {row.late
                                    ? `Terlambat ${row.lateMinutes} mnt`
                                    : 'Hadir'}
                            </Badge>
                            {canModerate &&
                                participant &&
                                !participant.isLocal && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label={`Moderasi ${nameOf(row.userId)}`}
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
                                                Bisukan {nameOf(row.userId)}
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
                        </li>
                    );
                })}
            </ul>
            {absent.length > 0 && (
                <ul className="flex flex-col gap-2 border-t border-border pt-2.5">
                    {absent.map((row) => {
                        if (row.kind !== 'absent') {
                            return null;
                        }

                        const person = people.get(row.userId);
                        const called =
                            calling.has(row.userId) || row.calledAt !== null;

                        return (
                            <li
                                key={row.userId}
                                className="flex min-h-9 items-center gap-2.5 text-[14px] text-text-muted"
                            >
                                <UserAvatar
                                    name={person?.name ?? 'Peserta'}
                                    src={person?.avatar_url}
                                    className="size-7 text-[11px] opacity-80"
                                />
                                <span className="min-w-0 flex-1 truncate">
                                    {nameOf(row.userId)} ·{' '}
                                    {row.rsvp === 'no'
                                        ? 'menolak undangan'
                                        : 'belum masuk'}
                                    {row.calledAt && (
                                        <span className="block text-[12px] text-text-subtle">
                                            Dipanggil {formatTime(row.calledAt)}
                                        </span>
                                    )}
                                </span>
                                {canCall && (
                                    <Button
                                        variant="quiet"
                                        size="sm"
                                        className="h-9 px-2 text-[13px]"
                                        disabled={calling.has(row.userId)}
                                        onClick={() => onCall(row.userId)}
                                    >
                                        {called ? 'Panggil lagi' : 'Panggil'}
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            <Dialog
                open={removing !== null}
                onOpenChange={(open) => !open && setRemoving(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Keluarkan{' '}
                            {removing
                                ? resolvePerson(people, removing.identity).name
                                : 'peserta'}
                            ?
                        </DialogTitle>
                        <DialogDescription>
                            Ia keluar dari ruang rapat sekarang. Selama rapat
                            masih dibuka, ia masih bisa bergabung lagi.
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
        </div>
    );
}
