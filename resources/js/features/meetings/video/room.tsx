import { Link } from '@inertiajs/react';
import {
    RoomAudioRenderer,
    RoomContext,
    useStartAudio,
} from '@livekit/components-react';
import type { Room as LiveRoom } from 'livekit-client';
import {
    ArrowLeft,
    PhoneOff,
    RefreshCw,
    VideoOff,
    Volume2,
    WifiOff,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { autoMinutesOn } from '../notulen/consent';
import type { NotulenSummary } from '../notulen/types';
import type { Room } from './contract';
import { normalizeRoom } from './contract';
import { ConnectedRoom } from './room-connected';
import type { RoomPageProps } from './types';
import type { MediaChoices, RoomStatus } from './use-video-room';
import { useVideoRoom } from './use-video-room';

/** Full-screen message on the desk: connecting, left, removed, errors. */
function RoomMessage({
    icon,
    title,
    body,
    children,
}: {
    icon: ReactNode;
    title: string;
    body?: string;
    children?: ReactNode;
}) {
    return (
        <div
            role="status"
            className="flex min-h-0 flex-1 items-center justify-center px-4"
        >
            <div className="flex w-full max-w-[560px] flex-col items-center gap-5 rounded-panel bg-surface px-6 py-10 text-center shadow-card md:px-10">
                <span className="flex size-16 items-center justify-center rounded-full bg-surface-2 text-text-muted [&_svg]:size-7">
                    {icon}
                </span>
                <span className="flex flex-col gap-2">
                    <span className="text-[24px] leading-8 font-extrabold">
                        {title}
                    </span>
                    {body && (
                        <span className="text-[16px] leading-6 text-text-muted">
                            {body}
                        </span>
                    )}
                </span>
                {children && (
                    <span className="flex flex-wrap justify-center gap-3">
                        {children}
                    </span>
                )}
            </div>
        </div>
    );
}

function StatusScreen({
    status,
    room,
    notulen,
    onRetry,
}: {
    status: RoomStatus;
    room: Room;
    notulen: NotulenSummary | null;
    onRetry: () => void;
}) {
    const back = (
        <Button variant="outline" size="lg" asChild>
            <Link href={room.meeting.href}>
                <ArrowLeft aria-hidden />
                Detail rapat
            </Link>
        </Button>
    );

    switch (status.kind) {
        case 'connecting':
            return (
                <RoomMessage
                    icon={<Spinner />}
                    title="Menyambungkan ke ruang rapat…"
                    body={room.meeting.title}
                />
            );
        case 'canceled':
            return (
                <RoomMessage
                    icon={<PhoneOff />}
                    title="Rapat dibatalkan"
                    body="Penyelenggara membatalkan rapat ini, ruang video sudah ditutup."
                >
                    {back}
                </RoomMessage>
            );
        case 'left':
            return (
                <RoomMessage
                    icon={<PhoneOff />}
                    title="Anda keluar dari rapat"
                    body={
                        autoMinutesOn(notulen)
                            ? 'Notulen otomatis disiapkan setelah rapat selesai. Notulis memeriksa drafnya sebelum masuk ke notulen.'
                            : room.meeting.title
                    }
                >
                    <Button size="lg" onClick={onRetry}>
                        Gabung lagi
                    </Button>
                    <Button variant="outline" size="lg" asChild>
                        <Link href={room.meeting.minutes_href}>
                            Buka notulen
                        </Link>
                    </Button>
                    {notulen?.available && notulen.can_view_transcript && (
                        <Button variant="quiet" size="lg" asChild>
                            <Link href={notulen.links.page}>
                                Notulen otomatis
                            </Link>
                        </Button>
                    )}
                    {back}
                </RoomMessage>
            );
        case 'removed':
            return (
                <RoomMessage
                    icon={<PhoneOff />}
                    title="Penyelenggara mengeluarkan Anda dari rapat"
                    body="Hubungi penyelenggara bila ini keliru."
                >
                    {back}
                </RoomMessage>
            );
        case 'unsupported':
            return (
                <RoomMessage
                    icon={<WifiOff />}
                    title="Browser ini belum didukung"
                    body="Buka rapat di Chrome, Edge, Firefox, atau Safari versi terbaru."
                >
                    {back}
                </RoomMessage>
            );
        case 'error':
            return (
                <RoomMessage
                    icon={<WifiOff />}
                    title="Tidak bisa masuk ke ruang rapat"
                    body={status.message}
                >
                    {status.canRetry && (
                        <Button size="lg" onClick={onRetry}>
                            <RefreshCw aria-hidden />
                            Coba lagi
                        </Button>
                    )}
                    {back}
                </RoomMessage>
            );
        default:
            return null;
    }
}

/** Banner when the browser blocked autoplay (opened /ruang directly). */
export function StartAudioBanner({ room }: { room: LiveRoom }) {
    const { mergedProps, canPlayAudio } = useStartAudio({ room, props: {} });

    if (canPlayAudio) {
        return null;
    }

    return (
        <div className="absolute inset-x-0 top-3 z-30 flex justify-center px-3">
            <Button size="lg" onClick={mergedProps.onClick}>
                <Volume2 aria-hidden />
                Aktifkan suara rapat
            </Button>
        </div>
    );
}

/**
 * /rapat/{id}/ruang — "Notulen Hidup" (arah C): the meeting's minutes are
 * the stage, faces run along the top. Full screen without the app shell;
 * follows the app theme (paper desk in light, Malam via tokens).
 */
export function VideoRoomScreen({
    page,
    choices,
}: {
    page: RoomPageProps;
    choices: MediaChoices;
}) {
    const room = normalizeRoom(page.room, page.notulen ?? null);
    const {
        room: live,
        status,
        connect,
        leave,
    } = useVideoRoom(room.meeting.id, room.meeting.occurrence_date, choices);
    const connected =
        status.kind === 'connected' || status.kind === 'reconnecting';

    if (!room.video.configured) {
        return (
            <div className="fixed inset-0 flex flex-col bg-room-desk text-text">
                <RoomMessage
                    icon={<VideoOff />}
                    title="Video RuangKerja belum disiapkan"
                    body="Server rapat video belum diatur. Hubungi admin, atau minta penyelenggara memakai Google Meet/Zoom."
                >
                    <Button variant="outline" size="lg" asChild>
                        <Link href={room.meeting.href}>
                            <ArrowLeft aria-hidden />
                            Detail rapat
                        </Link>
                    </Button>
                </RoomMessage>
            </div>
        );
    }

    return (
        <RoomContext.Provider value={live}>
            <div className="fixed inset-0 flex flex-col bg-room-desk pt-[env(safe-area-inset-top)] text-text">
                <h1 className="sr-only">{room.meeting.title}</h1>
                {connected ? (
                    <ConnectedRoom
                        room={room}
                        live={live}
                        status={status}
                        onLeave={leave}
                    />
                ) : (
                    <StatusScreen
                        status={status}
                        room={room}
                        notulen={room.notulen}
                        onRetry={() => void connect()}
                    />
                )}
                <RoomAudioRenderer />
            </div>
        </RoomContext.Provider>
    );
}
