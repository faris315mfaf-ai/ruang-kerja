import { Link } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { RoomAudioRenderer, RoomContext } from '@livekit/components-react';
import {
    ArrowLeft,
    PhoneOff,
    RefreshCw,
    VideoOff,
    WifiOff,
} from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { autoMinutesOn } from '../notulen/consent';
import type { NotulenSummary } from '../notulen/types';
import type { Room } from './contract';
import { normalizeRoom } from './contract';
import { ConnectedRoom } from './room-connected';
import { RoomMessage } from './room-message';
import type { RoomPageProps } from './types';
import type { MediaChoices, RoomStatus } from './use-video-room';
import { useVideoRoom } from './use-video-room';

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
                    body="Hubungi penyelenggara bila ini keliru. Setelah penyelenggara mengizinkan masuk lagi, Anda bisa bergabung kembali."
                >
                    <Button size="lg" variant="outline" onClick={onRetry}>
                        <RefreshCw aria-hidden />
                        Coba masuk lagi
                    </Button>
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
    const removed = status.kind === 'removed';
    const channel = room.features.realtime ? room.channel : null;
    const me = room.viewer.id;
    const date = room.meeting.occurrence_date;

    // "Izinkan masuk lagi" (participant.readmitted, audit B-08): back in with
    // a fresh video token; the room remounts and asks a new collab token.
    useEffect(() => {
        if (!removed || !channel) {
            return;
        }

        try {
            if (!echoIsConfigured()) {
                return;
            }

            const instance = echo();
            instance
                .private(channel)
                .listen(
                    '.participant.readmitted',
                    (event: { occurrence_date?: string; user_id?: string }) => {
                        if (
                            event.occurrence_date === date &&
                            event.user_id === me
                        ) {
                            void connect();
                        }
                    },
                );

            return () => instance.leave(channel);
        } catch {
            return undefined;
        }
    }, [removed, channel, date, me, connect]);

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
