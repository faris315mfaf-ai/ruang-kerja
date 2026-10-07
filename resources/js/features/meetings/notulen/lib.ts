/**
 * Pure helpers of the notulen otomatis screens (Vitest: lib.test.ts).
 */
import type {
    NotulenSummary,
    TranscriptSegment,
    TranscriptStatus,
} from './types';

/** "01:05" / "1:02:03" from milliseconds since the recording started. */
export function formatOffset(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');

    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "45 mnt", "1 j 5 mnt", "30 dtk". */
export function formatDuration(seconds: number | null | undefined): string {
    const total = Math.max(0, Math.round(seconds ?? 0));

    if (total < 60) {
        return `${total} dtk`;
    }

    const hours = Math.floor(total / 3600);
    const minutes = Math.round((total % 3600) / 60);

    return hours > 0
        ? `${hours} j${minutes > 0 ? ` ${minutes} mnt` : ''}`
        : `${minutes} mnt`;
}

/** Case/diacritic-insensitive search over speaker name and text. */
export function filterSegments(
    segments: TranscriptSegment[],
    query: string,
): TranscriptSegment[] {
    const wanted = normalize(query);

    if (wanted === '') {
        return segments;
    }

    return segments.filter(
        (segment) =>
            normalize(segment.text).includes(wanted) ||
            normalize(segment.speaker_name).includes(wanted),
    );
}

function normalize(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

export type ChipTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const TRANSCRIPT_TONE: Record<TranscriptStatus, ChipTone> = {
    recording: 'danger',
    transcribing: 'info',
    summarizing: 'info',
    ready: 'success',
    failed: 'danger',
};

/** Keep polling GET …/status while the worker or the summarizer is busy. */
export function shouldPoll(summary: NotulenSummary | null): boolean {
    if (!summary?.transcript) {
        return false;
    }

    const busy = ['recording', 'transcribing', 'summarizing'].includes(
        summary.transcript.status,
    );

    return busy || summary.draft?.status === 'pending';
}

/** Share of speaking time per speaker, in whole percent (sums to ~100). */
export function speakingShare(
    speakers: { identity: string; seconds: number }[],
): Record<string, number> {
    const total = speakers.reduce((sum, s) => sum + s.seconds, 0);

    return Object.fromEntries(
        speakers.map((s) => [
            s.identity,
            total > 0 ? Math.round((s.seconds / total) * 100) : 0,
        ]),
    );
}
