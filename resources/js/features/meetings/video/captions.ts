/**
 * Live captions of Video RuangKerja (pure, no React/LiveKit; tested in
 * captions.test.ts). Text arrives as LiveKit text streams on the topic
 * `lk.transcription` (LiveKit Agents convention, docs/fitur/notulen-otomatis-
 * kontrak.md §3): one stream per update of a segment with the attributes
 * `lk.segment_id`, `lk.transcribed_track_id` and `lk.transcription_final`.
 * A stream either carries the whole text so far or deltas, so the text of a
 * stream (deltas joined) replaces the text of its segment.
 */

export const CAPTION_TOPIC = 'lk.transcription';

/**
 * The only identity allowed to publish captions: the hidden auto-minutes
 * worker. Every participant may publish data, so a stream from anyone else
 * could fake captions in someone's name (audit N-07); user identities are
 * ULIDs and can never be "rk-notulen".
 */
export const CAPTION_SOURCE = 'rk-notulen';

export function acceptCaptionStream(identity: string): boolean {
    return identity === CAPTION_SOURCE;
}

/** How long the last line stays after the speaker stops (ms). */
export const CAPTION_HOLD_MS = 6000;

/** Lines kept in the buffer; the overlay shows the last two. */
const MAX_LINES = 6;

export type CaptionLine = {
    segmentId: string;
    /** Identity of the person who spoke (owner of the transcribed track). */
    speaker: string;
    text: string;
    final: boolean;
    /** Last update (ms). */
    at: number;
};

export type CaptionUpdate = {
    segmentId: string;
    speaker: string;
    text: string;
    final: boolean;
    at: number;
};

/** Attributes of a transcription stream → the fields the buffer needs. */
export function readCaptionAttributes(
    attributes: Record<string, string> | undefined,
    streamId: string,
): { segmentId: string; trackId: string | null; final: boolean } {
    const value = attributes ?? {};

    return {
        segmentId: value['lk.segment_id'] || streamId,
        trackId: value['lk.transcribed_track_id'] || null,
        final: value['lk.transcription_final'] === 'true',
    };
}

/**
 * Adds or replaces a segment. A segment that already exists keeps its place
 * (the line grows in place while the person talks); a new one goes last.
 * Empty interim text is ignored; a final segment never becomes interim again.
 */
export function applyCaption(
    lines: CaptionLine[],
    update: CaptionUpdate,
): CaptionLine[] {
    const text = update.text.replace(/\s+/g, ' ').trim();
    const index = lines.findIndex(
        (line) => line.segmentId === update.segmentId,
    );

    if (text === '') {
        return lines;
    }

    if (index >= 0) {
        const current = lines[index];
        const next: CaptionLine = {
            ...current,
            text,
            final: current.final || update.final,
            at: update.at,
        };

        return lines.map((line, i) => (i === index ? next : line));
    }

    return [
        ...lines,
        {
            segmentId: update.segmentId,
            speaker: update.speaker,
            text,
            final: update.final,
            at: update.at,
        },
    ].slice(-MAX_LINES);
}

/**
 * Lines to show at `now`: the last two, as long as the newest one changed
 * less than CAPTION_HOLD_MS ago (otherwise the box hides).
 */
export function visibleCaptions(
    lines: CaptionLine[],
    now: number,
    count = 2,
): CaptionLine[] {
    const last = lines[lines.length - 1];

    if (!last || now - last.at > CAPTION_HOLD_MS) {
        return [];
    }

    return lines.slice(-count);
}

/**
 * Two consecutive lines of the same speaker read as one paragraph: only the
 * first carries the name (the mockup shows the name once per turn).
 */
export function showSpeakerName(lines: CaptionLine[], index: number): boolean {
    return index === 0 || lines[index - 1]?.speaker !== lines[index]?.speaker;
}
