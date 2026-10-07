import type { Room } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { CaptionLine } from './captions';
import {
    acceptCaptionStream,
    applyCaption,
    CAPTION_HOLD_MS,
    CAPTION_TOPIC,
    readCaptionAttributes,
    showSpeakerName,
    visibleCaptions,
} from './captions';

/** Identity that owns a published track (the person whose voice it is). */
function speakerOf(room: Room, trackId: string | null, fallback: string) {
    if (trackId) {
        for (const participant of [
            room.localParticipant,
            ...room.remoteParticipants.values(),
        ]) {
            if (participant.trackPublications.has(trackId)) {
                return participant.identity;
            }
        }
    }

    return fallback;
}

/**
 * Subscribes to LiveKit text streams on `lk.transcription` (stage 2 of the
 * auto-minutes worker feeds them). `available` turns true with the first
 * stream; until then the toggle and the box stay hidden.
 */
export function useCaptions(room: Room) {
    const [lines, setLines] = useState<CaptionLine[]>([]);
    const [available, setAvailable] = useState(false);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        let active = true;

        try {
            room.registerTextStreamHandler(
                CAPTION_TOPIC,
                (reader, participantInfo) => {
                    if (!acceptCaptionStream(participantInfo.identity)) {
                        return; // Not the auto-minutes worker (audit N-07).
                    }

                    const info = readCaptionAttributes(
                        reader.info.attributes,
                        reader.info.id,
                    );
                    const speaker = speakerOf(
                        room,
                        info.trackId,
                        participantInfo.identity,
                    );
                    let text = '';

                    setAvailable(true);
                    void (async () => {
                        try {
                            for await (const chunk of reader) {
                                if (!active) {
                                    return;
                                }

                                text += chunk;
                                setLines((current) =>
                                    applyCaption(current, {
                                        segmentId: info.segmentId,
                                        speaker,
                                        text,
                                        final: false,
                                        at: Date.now(),
                                    }),
                                );
                            }

                            if (active && info.final) {
                                setLines((current) =>
                                    applyCaption(current, {
                                        segmentId: info.segmentId,
                                        speaker,
                                        text,
                                        final: true,
                                        at: Date.now(),
                                    }),
                                );
                            }
                        } catch {
                            // A broken stream only loses that caption line.
                        }
                    })();
                },
            );
        } catch {
            // Already registered (StrictMode double effect): keep the first.
        }

        return () => {
            active = false;
            room.unregisterTextStreamHandler(CAPTION_TOPIC);
        };
    }, [room]);

    // Re-render while a line is on screen so it hides after the hold time.
    const last = lines.at(-1)?.at ?? 0;

    useEffect(() => {
        if (last === 0) {
            return;
        }

        setNow(Date.now());
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        const stop = window.setTimeout(
            () => window.clearInterval(id),
            CAPTION_HOLD_MS + 1500,
        );

        return () => {
            window.clearInterval(id);
            window.clearTimeout(stop);
        };
    }, [last]);

    return { available, visible: visibleCaptions(lines, now) };
}

const NAME_TONES = [
    'text-caption-name-a',
    'text-caption-name-b',
    'text-caption-name-c',
];

/**
 * Caption box above the control bar: the last two lines with speaker names
 * (older line smaller and muted, interim text slightly faded). Announced
 * politely to screen readers, only final lines (no partial chatter).
 */
export function CaptionBox({
    lines,
    nameOf,
    seatOf,
    className,
}: {
    lines: CaptionLine[];
    nameOf: (identity: string) => string;
    seatOf: (identity: string) => number;
    className?: string;
}) {
    const announced = useRef<string>('');
    const finalText = lines
        .filter((line) => line.final)
        .map((line) => `${nameOf(line.speaker)}: ${line.text}`)
        .at(-1);

    if (finalText) {
        announced.current = finalText;
    }

    return (
        <div
            className={cn(
                'pointer-events-none flex flex-col gap-1 rounded-lg bg-caption px-[18px] py-3 text-on-caption shadow-float',
                lines.length === 0 && 'invisible',
                className,
            )}
            data-testid="captions"
        >
            <p aria-live="polite" className="sr-only">
                {announced.current}
            </p>
            {lines.map((line, index) => {
                const older = index < lines.length - 1;

                return (
                    <p
                        key={line.segmentId}
                        aria-hidden
                        className={cn(
                            older
                                ? 'text-[14px] leading-5 text-caption-muted'
                                : 'text-[19px] leading-[26px] max-md:text-[16px] max-md:leading-[22px]',
                        )}
                    >
                        {showSpeakerName(lines, index) && (
                            <b
                                className={cn(
                                    'mr-1.5 font-bold',
                                    NAME_TONES[
                                        seatOf(line.speaker) % NAME_TONES.length
                                    ],
                                )}
                            >
                                {nameOf(line.speaker)}
                            </b>
                        )}
                        <span
                            className={cn(
                                !line.final && !older && 'opacity-90',
                            )}
                        >
                            {line.text}
                        </span>
                    </p>
                );
            })}
        </div>
    );
}
