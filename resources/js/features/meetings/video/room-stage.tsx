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
import { Hand, MicOff, MonitorUp, Pin, PinOff, WifiOff } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { cn, focusRing } from '@/lib/utils';
import type { StageMode } from './lib';
import { gridShape, parseMeta } from './lib';

/** A camera/screen track or a placeholder for a participant without one. */
export type TileRef = NonNullable<Parameters<typeof useTrackMutedIndicator>[0]>;

export function tileKey(ref: TileRef): string {
    return `${ref.participant.identity}:${ref.source}`;
}

function useElementSize<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const element = ref.current;

        if (!element || typeof ResizeObserver === 'undefined') {
            return;
        }

        const observer = new ResizeObserver(([entry]) => {
            const box = entry.contentRect;
            setSize({ width: box.width, height: box.height });
        });
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    return [ref, size] as const;
}

/** Name chip, mic state, raised hand, poor connection, pin — over a video or avatar. */
export function ParticipantTile({
    trackRef,
    compact = false,
    pinned = false,
    onTogglePin,
    className,
    style,
}: {
    trackRef: TileRef;
    compact?: boolean;
    pinned?: boolean;
    onTogglePin?: () => void;
    className?: string;
    style?: CSSProperties;
}) {
    const participant = trackRef.participant;
    const { name, metadata } = useParticipantInfo({ participant });
    const meta = parseMeta(metadata);
    const displayName = name || participant.identity;
    const speaking = useIsSpeaking(participant);
    const { quality } = useConnectionQualityIndicator({ participant });
    const { isMuted: micMuted } = useTrackMutedIndicator({
        participant,
        source: Track.Source.Microphone,
    });
    const { isMuted: videoMuted } = useTrackMutedIndicator(trackRef);
    const hand = useParticipantAttribute('hand', { participant });
    const isScreen = trackRef.source === Track.Source.ScreenShare;
    const showVideo =
        isTrackReference(trackRef) &&
        !videoMuted &&
        !(isScreen && participant.isLocal);
    const label = isScreen
        ? participant.isLocal
            ? 'Anda sedang presentasi'
            : `${displayName} (presentasi)`
        : participant.isLocal
          ? `${displayName} (Anda)`
          : displayName;

    return (
        <div
            className={cn(
                'group relative isolate flex items-center justify-center overflow-hidden rounded-lg bg-surface-2',
                className,
            )}
            style={style}
            data-testid="participant-tile"
            data-identity={participant.identity}
            data-local={participant.isLocal ? 'true' : 'false'}
            data-source={trackRef.source}
        >
            {showVideo ? (
                <VideoTrack
                    trackRef={trackRef}
                    className={cn(
                        'size-full',
                        isScreen
                            ? 'bg-preview-dark object-contain'
                            : 'object-cover',
                        participant.isLocal && !isScreen && '-scale-x-100',
                    )}
                />
            ) : isScreen ? (
                <span className="flex flex-col items-center gap-2 px-4 text-center text-text-muted">
                    <MonitorUp aria-hidden className="size-8" />
                    <span className="text-[15px] font-semibold">
                        Anda sedang mempresentasikan layar ke semua orang
                    </span>
                </span>
            ) : (
                <UserAvatar
                    name={displayName}
                    src={meta.avatar_url}
                    className={cn(
                        compact
                            ? 'size-12 text-[17px]'
                            : 'size-20 text-[28px] md:size-24 md:text-[32px]',
                    )}
                />
            )}

            {speaking && !isScreen && (
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-lg ring-[3px] ring-primary ring-inset"
                />
            )}

            {hand && !isScreen && (
                <span
                    className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-fill-warning px-2 py-1 text-[13px] font-bold text-on-brand shadow-card"
                    title="Mengangkat tangan"
                >
                    <Hand aria-hidden className="size-4" />
                    {!compact && <span>Angkat tangan</span>}
                    <span className="sr-only">
                        {displayName} mengangkat tangan
                    </span>
                </span>
            )}

            {(quality === ConnectionQuality.Poor ||
                quality === ConnectionQuality.Lost) && (
                <span
                    className="absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-full bg-preview-dark/70 text-on-brand"
                    title="Koneksi lemah"
                >
                    <WifiOff aria-hidden className="size-4" />
                    <span className="sr-only">Koneksi {displayName} lemah</span>
                </span>
            )}

            {onTogglePin && (
                <button
                    type="button"
                    onClick={onTogglePin}
                    aria-pressed={pinned}
                    aria-label={
                        pinned
                            ? `Lepas sematan ${displayName}`
                            : `Sematkan ${displayName}`
                    }
                    className={cn(
                        'absolute top-2 right-12 inline-flex size-9 items-center justify-center rounded-full bg-preview-dark/70 text-on-brand opacity-0 transition-opacity duration-120 ease-brand group-hover:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none',
                        pinned && 'opacity-100',
                        focusRing,
                    )}
                >
                    {pinned ? (
                        <PinOff aria-hidden className="size-4" />
                    ) : (
                        <Pin aria-hidden className="size-4" />
                    )}
                </button>
            )}

            <span
                className={cn(
                    'absolute bottom-2 left-2 inline-flex max-w-[calc(100%-16px)] items-center gap-1.5 rounded-sm bg-preview-dark/70 px-2 py-1 font-semibold text-on-brand',
                    compact ? 'text-[12px]' : 'text-[14px]',
                )}
            >
                {micMuted && !isScreen && (
                    <MicOff
                        aria-label="Mikrofon mati"
                        className="size-3.5 shrink-0"
                    />
                )}
                <span className="truncate">{label}</span>
            </span>
        </div>
    );
}

/** "+N lainnya" in place of the last grid tile when there are too many. */
function OverflowTile({
    refs,
    onOpen,
    style,
}: {
    refs: TileRef[];
    onOpen?: () => void;
    style?: CSSProperties;
}) {
    return (
        <button
            type="button"
            onClick={onOpen}
            style={style}
            className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-lg bg-surface-2 text-text',
                focusRing,
            )}
        >
            <span className="flex -space-x-3">
                {refs.slice(0, 3).map((ref) => (
                    <UserAvatar
                        key={tileKey(ref)}
                        name={ref.participant.name || ref.participant.identity}
                        src={parseMeta(ref.participant.metadata).avatar_url}
                        className="size-12 text-[16px] ring-2 ring-surface-2"
                    />
                ))}
            </span>
            <span className="text-[15px] font-bold">{refs.length} lainnya</span>
        </button>
    );
}

function Grid({
    refs,
    maxTiles,
    mobile,
    pinnedKey,
    onTogglePin,
    onOpenPeople,
}: {
    refs: TileRef[];
    maxTiles: number;
    mobile: boolean;
    pinnedKey: string | null;
    onTogglePin: (key: string) => void;
    onOpenPeople: () => void;
}) {
    const [ref, size] = useElementSize<HTMLDivElement>();
    const overflow = refs.length > maxTiles ? refs.slice(maxTiles - 1) : [];
    const visible = overflow.length > 0 ? refs.slice(0, maxTiles - 1) : refs;
    const count = visible.length + (overflow.length > 0 ? 1 : 0);
    const gap = 8;
    const { cols, rows } = gridShape(count, size.width, size.height, {
        gap,
        aspect: mobile ? 3 / 4 : 16 / 9,
    });
    const cell: CSSProperties = {
        width: `calc((100% - ${gap * (cols - 1)}px) / ${cols})`,
        height: `calc((100% - ${gap * (rows - 1)}px) / ${rows})`,
    };

    return (
        <div
            ref={ref}
            className="flex size-full flex-wrap content-center justify-center gap-2"
        >
            {visible.map((tile) => (
                <ParticipantTile
                    key={tileKey(tile)}
                    trackRef={tile}
                    style={cell}
                    compact={cols > 3}
                    pinned={pinnedKey === tileKey(tile)}
                    onTogglePin={
                        mobile ? undefined : () => onTogglePin(tileKey(tile))
                    }
                />
            ))}
            {overflow.length > 0 && (
                <OverflowTile
                    refs={overflow}
                    style={cell}
                    onOpen={onOpenPeople}
                />
            )}
        </div>
    );
}

/**
 * The video area: solo, Meet-style floating self view (pip), grid, or
 * spotlight + filmstrip (decided by stageLayout()).
 */
export function Stage({
    refs,
    mode,
    maxTiles,
    main,
    mobile,
    pinnedKey,
    onTogglePin,
    onOpenPeople,
    overlay,
}: {
    /** Screen shares first, then cameras (remote before local). */
    refs: TileRef[];
    mode: StageMode;
    maxTiles: number;
    /** Tile for solo / pip / spotlight. */
    main: TileRef | null;
    mobile: boolean;
    pinnedKey: string | null;
    onTogglePin: (key: string) => void;
    onOpenPeople: () => void;
    overlay?: ReactNode;
}) {
    const local = refs.find(
        (ref) => ref.participant.isLocal && ref.source === Track.Source.Camera,
    );

    if ((mode === 'solo' || mode === 'pip') && main) {
        return (
            <div className="relative size-full">
                <ParticipantTile
                    trackRef={main}
                    className="size-full"
                    pinned={pinnedKey === tileKey(main)}
                    onTogglePin={
                        mode === 'pip' && !mobile
                            ? () => onTogglePin(tileKey(main))
                            : undefined
                    }
                />
                {mode === 'pip' && local && local !== main && (
                    <ParticipantTile
                        trackRef={local}
                        compact
                        className={cn(
                            'absolute right-3 bottom-3 z-10 shadow-float',
                            mobile
                                ? 'aspect-[3/4] w-28'
                                : 'aspect-video w-[min(30%,280px)]',
                        )}
                    />
                )}
                {overlay}
            </div>
        );
    }

    if (mode === 'spotlight' && main) {
        const others = refs.filter((ref) => tileKey(ref) !== tileKey(main));
        const strip = others.slice(0, maxTiles);
        const hidden = others.length - strip.length;

        return (
            <div
                className={cn(
                    'relative flex size-full gap-2',
                    mobile ? 'flex-col' : 'flex-row',
                )}
            >
                <ParticipantTile
                    trackRef={main}
                    className="min-h-0 min-w-0 flex-1"
                    pinned={pinnedKey === tileKey(main)}
                    onTogglePin={
                        mobile ? undefined : () => onTogglePin(tileKey(main))
                    }
                />
                {strip.length > 0 && (
                    <div
                        aria-label="Peserta lain"
                        className={cn(
                            'flex shrink-0 gap-2',
                            mobile
                                ? 'h-28 flex-row overflow-x-auto'
                                : 'w-[240px] flex-col overflow-y-auto',
                        )}
                    >
                        {strip.map((ref) => (
                            <ParticipantTile
                                key={tileKey(ref)}
                                trackRef={ref}
                                compact
                                className={cn(
                                    'shrink-0',
                                    mobile
                                        ? 'aspect-[4/3] h-full'
                                        : 'aspect-video w-full',
                                )}
                                pinned={pinnedKey === tileKey(ref)}
                                onTogglePin={
                                    mobile
                                        ? undefined
                                        : () => onTogglePin(tileKey(ref))
                                }
                            />
                        ))}
                        {hidden > 0 && (
                            <button
                                type="button"
                                onClick={onOpenPeople}
                                className={cn(
                                    'flex shrink-0 items-center justify-center rounded-lg bg-surface-2 text-[14px] font-bold',
                                    mobile
                                        ? 'aspect-[4/3] h-full'
                                        : 'aspect-video w-full',
                                    focusRing,
                                )}
                            >
                                {hidden} lainnya
                            </button>
                        )}
                    </div>
                )}
                {overlay}
            </div>
        );
    }

    return (
        <div className="relative size-full">
            <Grid
                refs={refs}
                maxTiles={maxTiles}
                mobile={mobile}
                pinnedKey={pinnedKey}
                onTogglePin={onTogglePin}
                onOpenPeople={onOpenPeople}
            />
            {overlay}
        </div>
    );
}
