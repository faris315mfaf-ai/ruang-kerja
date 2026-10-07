import {
    useChat,
    useIsSpeaking,
    useMediaDeviceSelect,
    useParticipantAttribute,
    useParticipants,
    useTrackMutedIndicator,
} from '@livekit/components-react';
import type { Participant } from 'livekit-client';
import { supportsAudioOutputSelection, Track } from 'livekit-client';
import {
    Hand,
    MessageSquare,
    Mic,
    MicOff,
    Send,
    UserMinus,
    X,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Person } from '../types';
import { videoApi } from './api';
import { parseMeta } from './lib';
import { emitRoomNotice } from './room-notices';

export type PanelKind = 'chat' | 'people' | 'settings';

/** Side panel (desktop/tablet) or full-screen sheet (phone). */
export function SidePanel({
    title,
    onClose,
    mobile,
    children,
}: {
    title: string;
    onClose: () => void;
    mobile: boolean;
    children: ReactNode;
}) {
    return (
        <aside
            aria-label={title}
            className={cn(
                'flex min-h-0 flex-col bg-surface text-text',
                mobile
                    ? 'fixed inset-0 z-40 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
                    : 'my-2 mr-2 w-[360px] shrink-0 rounded-panel border border-border shadow-card',
            )}
        >
            <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-divider pr-2 pl-5">
                <h2 className="text-[18px] font-bold">{title}</h2>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    aria-label={`Tutup ${title.toLowerCase()}`}
                >
                    <X aria-hidden />
                </Button>
            </header>
            {children}
        </aside>
    );
}

/** In-call chat over the LiveKit data channel (not stored, like Meet). */
export function ChatPanel({
    chat,
    autoFocus,
}: {
    chat: ReturnType<typeof useChat>;
    autoFocus: boolean;
}) {
    const [draft, setDraft] = useState('');
    const list = useRef<HTMLOListElement>(null);
    const count = chat.chatMessages.length;

    useEffect(() => {
        list.current?.lastElementChild?.scrollIntoView({ block: 'end' });
    }, [count]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const text = draft.trim();

        if (text === '' || chat.isSending) {
            return;
        }

        chat.send(text)
            .then(() => setDraft(''))
            .catch(() =>
                emitRoomNotice('Pesan gagal terkirim. Coba lagi.', 'error'),
            );
    };

    return (
        <>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <p className="mb-4 rounded-control bg-surface-2 px-3.5 py-3 text-[14px] leading-5 text-text-muted">
                    Pesan hanya terlihat oleh orang yang ada di rapat dan hilang
                    saat rapat selesai.
                </p>
                {count === 0 ? (
                    <p className="flex flex-col items-center gap-2 py-10 text-center text-[15px] text-text-muted">
                        <MessageSquare aria-hidden className="size-8" />
                        Belum ada pesan.
                    </p>
                ) : (
                    <ol
                        ref={list}
                        aria-live="polite"
                        className="flex flex-col gap-4"
                    >
                        {chat.chatMessages.map((message) => (
                            <li
                                key={message.id}
                                className="flex flex-col gap-1"
                            >
                                <span className="flex items-baseline gap-2">
                                    <span className="text-[14px] font-bold">
                                        {message.from?.isLocal
                                            ? 'Anda'
                                            : message.from?.name ||
                                              message.from?.identity ||
                                              'Peserta'}
                                    </span>
                                    <span className="text-[13px] text-text-subtle">
                                        {formatTime(
                                            new Date(message.timestamp),
                                        )}
                                    </span>
                                </span>
                                <span className="text-[15px] leading-[22px] break-words whitespace-pre-wrap">
                                    {message.message}
                                </span>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
            <form
                onSubmit={submit}
                className="flex shrink-0 items-center gap-2 border-t border-divider p-3"
            >
                <label htmlFor="video-chat-input" className="sr-only">
                    Kirim pesan ke semua orang
                </label>
                <input
                    id="video-chat-input"
                    value={draft}
                    autoFocus={autoFocus}
                    maxLength={1000}
                    autoComplete="off"
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Kirim pesan ke semua orang"
                    className="h-12 min-w-0 flex-1 rounded-full border border-border-strong bg-surface px-4 text-[16px] text-text outline-none placeholder:text-text-subtle focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-ring/55"
                />
                <Button
                    type="submit"
                    size="icon"
                    className="size-12 rounded-full"
                    disabled={draft.trim() === '' || chat.isSending}
                    aria-label="Kirim pesan"
                >
                    <Send aria-hidden />
                </Button>
            </form>
        </>
    );
}

function PersonRow({
    participant,
    isOrganizer,
    canModerate,
    onMute,
    onRemove,
}: {
    participant: Participant;
    isOrganizer: boolean;
    canModerate: boolean;
    onMute: (participant: Participant, trackSid: string) => void;
    onRemove: (participant: Participant) => void;
}) {
    const meta = parseMeta(participant.metadata);
    const name = participant.name || participant.identity;
    const speaking = useIsSpeaking(participant);
    const hand = useParticipantAttribute('hand', { participant });
    const { isMuted } = useTrackMutedIndicator({
        participant,
        source: Track.Source.Microphone,
    });
    const micSid = participant.getTrackPublication(
        Track.Source.Microphone,
    )?.trackSid;

    return (
        <li className="flex min-h-16 items-center gap-3 py-2">
            <UserAvatar
                name={name}
                src={meta.avatar_url}
                className="size-10 text-[15px]"
            />
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold">
                    {name}
                    {participant.isLocal ? ' (Anda)' : ''}
                </span>
                {isOrganizer && (
                    <span className="text-[13px] text-text-muted">
                        Penyelenggara
                    </span>
                )}
            </span>
            {hand && (
                <Hand
                    aria-label="Mengangkat tangan"
                    className="size-5 text-warning"
                />
            )}
            <span
                className={cn(
                    'inline-flex size-9 items-center justify-center rounded-full',
                    speaking && !isMuted
                        ? 'bg-link-soft text-link'
                        : 'text-text-muted',
                )}
            >
                {isMuted ? (
                    <MicOff aria-label="Mikrofon mati" className="size-4" />
                ) : (
                    <Mic
                        aria-label={
                            speaking ? 'Sedang bicara' : 'Mikrofon nyala'
                        }
                        className="size-4"
                    />
                )}
            </span>
            {canModerate && !participant.isLocal && (
                <span className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        disabled={isMuted || !micSid}
                        onClick={() => micSid && onMute(participant, micSid)}
                        aria-label={`Bisukan ${name}`}
                        title="Bisukan untuk semua orang"
                    >
                        <MicOff aria-hidden />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-danger"
                        onClick={() => onRemove(participant)}
                        aria-label={`Keluarkan ${name} dari rapat`}
                        title="Keluarkan dari rapat"
                    >
                        <UserMinus aria-hidden />
                    </Button>
                </span>
            )}
        </li>
    );
}

/**
 * "Orang": raised hands first, everyone in the room, then invitees who have
 * not joined. The organizer can mute or remove others (Room Service API).
 */
export function PeoplePanel({
    meetingId,
    date,
    organizerId,
    canModerate,
    invited,
}: {
    meetingId: string;
    date: string;
    organizerId: string;
    canModerate: boolean;
    invited: Person[];
}) {
    const participants = useParticipants();
    const [removing, setRemoving] = useState<Participant | null>(null);
    const [busy, setBusy] = useState(false);
    const present = new Set(participants.map((p) => p.identity));
    const absent = invited.filter((person) => !present.has(person.id));
    const hands = participants
        .filter((p) => Number(p.attributes.hand) > 0)
        .sort((a, b) => Number(a.attributes.hand) - Number(b.attributes.hand));

    const mute = (participant: Participant, trackSid: string) => {
        videoApi
            .mute(meetingId, date, participant.identity, trackSid)
            .then(() =>
                emitRoomNotice(
                    `Mikrofon ${participant.name || 'peserta'} dimatikan.`,
                ),
            )
            .catch((error: Error) => emitRoomNotice(error.message, 'error'));
    };

    const remove = () => {
        if (!removing) {
            return;
        }

        setBusy(true);
        videoApi
            .remove(meetingId, date, removing.identity)
            .then(() =>
                emitRoomNotice(
                    `${removing.name || 'Peserta'} dikeluarkan dari rapat.`,
                ),
            )
            .catch((error: Error) => emitRoomNotice(error.message, 'error'))
            .finally(() => {
                setBusy(false);
                setRemoving(null);
            });
    };

    return (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            {hands.length > 0 && (
                <section aria-label="Angkat tangan" className="pt-4">
                    <h3 className="text-overline text-text-muted">
                        Angkat tangan ({hands.length})
                    </h3>
                    <ol className="mt-2 flex flex-col gap-1">
                        {hands.map((p, index) => (
                            <li
                                key={p.identity}
                                className="flex items-center gap-2 text-[15px] font-semibold"
                            >
                                <span className="inline-flex size-6 items-center justify-center rounded-full bg-warning-soft text-[13px] font-bold text-warning">
                                    {index + 1}
                                </span>
                                {p.isLocal ? 'Anda' : p.name || p.identity}
                            </li>
                        ))}
                    </ol>
                </section>
            )}
            <section aria-label="Di rapat" className="pt-4">
                <h3 className="text-overline text-text-muted">
                    Di rapat ({participants.length})
                </h3>
                <ul className="divide-y divide-divider">
                    {participants.map((participant) => (
                        <PersonRow
                            key={participant.identity}
                            participant={participant}
                            isOrganizer={participant.identity === organizerId}
                            canModerate={canModerate}
                            onMute={mute}
                            onRemove={setRemoving}
                        />
                    ))}
                </ul>
            </section>
            {absent.length > 0 && (
                <section aria-label="Belum bergabung" className="pt-4">
                    <h3 className="text-overline text-text-muted">
                        Diundang, belum bergabung ({absent.length})
                    </h3>
                    <ul className="divide-y divide-divider">
                        {absent.map((person) => (
                            <li
                                key={person.id}
                                className="flex min-h-14 items-center gap-3 py-2 text-text-muted"
                            >
                                <UserAvatar
                                    name={person.name}
                                    src={person.avatar_url}
                                    className="size-10 text-[15px] opacity-70"
                                />
                                <span className="truncate text-[15px]">
                                    {person.name}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <Dialog
                open={removing !== null}
                onOpenChange={(open) => !open && setRemoving(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Keluarkan {removing?.name || 'peserta'}?
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
                            onClick={remove}
                            disabled={busy}
                        >
                            Keluarkan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function DeviceSelect({
    kind,
    label,
}: {
    kind: MediaDeviceKind;
    label: string;
}) {
    const id = `video-device-${kind}`;
    const { devices, activeDeviceId, setActiveMediaDevice } =
        useMediaDeviceSelect({ kind, requestPermissions: false });
    const options = useMemo(
        () => devices.filter((device) => device.deviceId !== ''),
        [devices],
    );

    return (
        <div className="flex flex-col gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Select
                value={activeDeviceId || options[0]?.deviceId || ''}
                onValueChange={(value) =>
                    void setActiveMediaDevice(value).catch(() =>
                        emitRoomNotice(`${label} tidak bisa dipilih.`, 'error'),
                    )
                }
                disabled={options.length === 0}
            >
                <SelectTrigger id={id} className="w-full">
                    <SelectValue placeholder="Tidak ada perangkat" />
                </SelectTrigger>
                <SelectContent>
                    {options.map((device, index) => (
                        <SelectItem
                            key={device.deviceId}
                            value={device.deviceId}
                        >
                            {device.label || `${label} ${index + 1}`}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

/** Microphone, camera and speaker of the running call. */
export function SettingsPanel() {
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
            <DeviceSelect kind="audioinput" label="Mikrofon" />
            <DeviceSelect kind="videoinput" label="Kamera" />
            {supportsAudioOutputSelection() && (
                <DeviceSelect kind="audiooutput" label="Speaker" />
            )}
            <p className="text-[14px] leading-5 text-text-muted">
                Suara diperjernih otomatis (peredam gema & bising). Video
                menyesuaikan kecepatan jaringan setiap peserta.
            </p>
            <Badge variant="label" className="self-start">
                Video RuangKerja
            </Badge>
        </div>
    );
}
