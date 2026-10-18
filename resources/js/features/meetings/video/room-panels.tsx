import { useChat, useMediaDeviceSelect } from '@livekit/components-react';
import { supportsAudioOutputSelection } from 'livekit-client';
import { MessageSquare, Send, X } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
    personOfParticipant,
    useIsGuestView,
    useRoomPeople,
} from './room-people';
import { emitRoomNotice } from './room-notices';

export type PanelKind = 'attendance' | 'chat' | 'settings' | 'talk' | 'lobby';

/**
 * Right-hand panel of the room (mockup "Kehadiran": white card radius 20)
 * or a full-screen sheet on phones.
 */
export function SidePanel({
    title,
    aside,
    onClose,
    mobile,
    children,
    className,
}: {
    title: string;
    aside?: ReactNode;
    onClose: () => void;
    mobile: boolean;
    children: ReactNode;
    className?: string;
}) {
    return (
        <aside
            aria-label={title}
            className={cn(
                'flex min-h-0 flex-col bg-surface text-text',
                mobile
                    ? 'fixed inset-0 z-40 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
                    : 'rounded-card shadow-card',
                className,
            )}
        >
            <header className="flex h-14 shrink-0 items-center justify-between gap-2 pr-2 pl-[18px]">
                <h2 className="flex min-w-0 items-baseline gap-3 text-[16px] font-bold">
                    {title}
                    {aside && (
                        <span className="truncate text-[12px] font-normal text-text-muted">
                            {aside}
                        </span>
                    )}
                </h2>
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
    const people = useRoomPeople();
    const guestView = useIsGuestView();
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
            <div className="min-h-0 flex-1 overflow-y-auto px-[18px] py-2">
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
                                            : personOfParticipant(
                                                  people,
                                                  message.from ?? {
                                                      identity: '',
                                                  },
                                                  guestView,
                                              ).name}
                                    </span>
                                    <span className="text-[13px] text-text-muted">
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

/** Microphone, camera and speaker of the running call (+ transcript consent). */
export function SettingsPanel({ children }: { children?: ReactNode }) {
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-[18px] pb-5">
            {children}
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
