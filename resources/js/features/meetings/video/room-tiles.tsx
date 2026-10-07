import {
    isTrackReference,
    useConnectionQualityIndicator,
    useIsSpeaking,
    useParticipantAttribute,
    useParticipantInfo,
    useTrackMutedIndicator,
    VideoTrack,
} from '@livekit/components-react';
import { ConnectionQuality, Track } from 'livekit-client';
import { Hand, MicOff, MonitorUp, WifiOff } from 'lucide-react';
import type { CSSProperties } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { cn } from '@/lib/utils';
import { parseMeta } from './lib';

/** A camera/screen track or a placeholder for a participant without one. */
export type TileRef = NonNullable<Parameters<typeof useTrackMutedIndicator>[0]>;

export function tileKey(ref: TileRef): string {
    return `${ref.participant.identity}:${ref.source}`;
}

/** Three bars beside the name of whoever is speaking (mockup "▮▮▮ Sari"). */
function SpeakingBars() {
    return (
        <span aria-hidden className="inline-flex h-3 items-end gap-0.5">
            <i className="h-[5px] w-[3px] rounded-[2px] bg-current motion-safe:animate-pulse" />
            <i className="h-[11px] w-[3px] rounded-[2px] bg-current" />
            <i className="h-[7px] w-[3px] rounded-[2px] bg-current motion-safe:animate-pulse" />
        </span>
    );
}

/**
 * One face in the filmstrip (or the phone grid): video or initials on the
 * camera-off tone, a name pill with the mic state and speaking bars, a teal
 * ring while speaking, raised hand and weak-connection badges.
 */
export function ParticipantTile({
    trackRef,
    fullName = false,
    className,
    style,
}: {
    trackRef: TileRef;
    /** "Sari Wulandari" instead of "Sari" (big phone tile). */
    fullName?: boolean;
    className?: string;
    style?: CSSProperties;
}) {
    const participant = trackRef.participant;
    const { name, metadata } = useParticipantInfo({ participant });
    const meta = parseMeta(metadata);
    const displayName = name || participant.identity;
    const shortName = fullName
        ? displayName
        : (displayName.split(' ')[0] ?? displayName);
    const speaking = useIsSpeaking(participant);
    const { quality } = useConnectionQualityIndicator({ participant });
    const { isMuted: micMuted } = useTrackMutedIndicator({
        participant,
        source: Track.Source.Microphone,
    });
    const { isMuted: videoMuted } = useTrackMutedIndicator(trackRef);
    const hand = useParticipantAttribute('hand', { participant });
    const showVideo = isTrackReference(trackRef) && !videoMuted;

    return (
        <div
            className={cn(
                'group relative isolate flex items-center justify-center overflow-hidden rounded-lg bg-tile-off',
                className,
            )}
            style={style}
            data-testid="participant-tile"
            data-identity={participant.identity}
            data-local={participant.isLocal ? 'true' : 'false'}
            data-source={trackRef.source}
            data-speaking={speaking ? 'true' : 'false'}
        >
            {showVideo ? (
                <VideoTrack
                    trackRef={trackRef}
                    className={cn(
                        'size-full object-cover',
                        participant.isLocal && '-scale-x-100',
                    )}
                />
            ) : (
                <UserAvatar
                    name={displayName}
                    src={meta.avatar_url}
                    className="size-[42%] max-h-24 min-h-10 max-w-24 min-w-10 text-[clamp(14px,2.2vw,28px)]"
                />
            )}

            {speaking && (
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-[inherit] ring-[3px] ring-primary ring-inset"
                />
            )}

            {hand && (
                <span
                    className="absolute top-2 left-2 inline-flex size-7 items-center justify-center rounded-full bg-fill-warning text-on-brand shadow-card"
                    title="Mengangkat tangan"
                >
                    <Hand aria-hidden className="size-4" />
                    <span className="sr-only">
                        {displayName} mengangkat tangan
                    </span>
                </span>
            )}

            {(quality === ConnectionQuality.Poor ||
                quality === ConnectionQuality.Lost) && (
                <span
                    className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-full bg-caption text-on-caption"
                    title="Koneksi lemah"
                >
                    <WifiOff aria-hidden className="size-4" />
                    <span className="sr-only">Koneksi {displayName} lemah</span>
                </span>
            )}

            <span className="absolute bottom-2 left-2.5 inline-flex max-w-[calc(100%-20px)] items-center gap-1.5 rounded-full bg-caption px-2.5 py-[3px] text-[13px] font-semibold text-on-caption">
                {micMuted && (
                    <MicOff
                        aria-label="Mikrofon mati"
                        className="size-3.5 shrink-0"
                    />
                )}
                {speaking && !micMuted && <SpeakingBars />}
                <span className="truncate">
                    {shortName}
                    {participant.isLocal ? ' (Anda)' : ''}
                </span>
            </span>
        </div>
    );
}

/**
 * Filmstrip on top of the room: everyone's camera, the active speaker wider
 * (250 × 140 vs 150 × 140 in the mockup; `compact` = 150 × 110 while a screen
 * is shared). Scrolls sideways when there are more faces than fit.
 */
export function Filmstrip({
    cameras,
    activeKey,
    compact,
}: {
    cameras: TileRef[];
    activeKey: string | null;
    compact: boolean;
}) {
    return (
        <ul
            aria-label="Peserta"
            className="flex min-w-0 [scrollbar-width:thin] gap-2.5 overflow-x-auto pb-1"
        >
            {cameras.map((ref) => {
                const active = !compact && tileKey(ref) === activeKey;

                return (
                    <li
                        key={tileKey(ref)}
                        className={cn(
                            'shrink-0 transition-[width] duration-180 ease-brand motion-reduce:transition-none',
                            compact ? 'h-[110px] w-[150px]' : 'h-[140px]',
                            !compact && (active ? 'w-[250px]' : 'w-[150px]'),
                        )}
                    >
                        <ParticipantTile trackRef={ref} className="size-full" />
                    </li>
                );
            })}
        </ul>
    );
}

/** Shared screen in Presentasi mode (dark frame, picture contained). */
export function ScreenShare({ trackRef }: { trackRef: TileRef }) {
    const participant = trackRef.participant;
    const name = participant.name || participant.identity;
    const mine = participant.isLocal;

    return (
        <figure
            className="relative flex size-full items-center justify-center overflow-hidden rounded-[18px] bg-room-bar p-3"
            data-testid="screen-share"
        >
            {isTrackReference(trackRef) && !mine ? (
                <VideoTrack
                    trackRef={trackRef}
                    className="size-full rounded-[14px] object-contain"
                />
            ) : (
                <span className="flex flex-col items-center gap-2 px-6 text-center text-on-room-bar">
                    <MonitorUp aria-hidden className="size-9" />
                    <span className="text-[16px] font-semibold">
                        Anda sedang mempresentasikan layar ke semua orang
                    </span>
                </span>
            )}
            <figcaption className="absolute bottom-5 left-5 rounded-full bg-caption px-3 py-1 text-[13px] font-semibold text-on-caption">
                {mine ? 'Presentasi Anda' : `${name} sedang presentasi`}
            </figcaption>
        </figure>
    );
}
