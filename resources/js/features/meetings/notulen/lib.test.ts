import { describe, expect, it } from 'vitest';
import {
    filterSegments,
    formatDuration,
    formatOffset,
    shouldPoll,
    speakingShare,
} from './lib';
import type { NotulenSummary, TranscriptSegment } from './types';

const segment = (i: number, name: string, text: string): TranscriptSegment => ({
    i,
    speaker_identity: `id-${name}`,
    user_id: null,
    speaker_name: name,
    start_ms: i * 1000,
    end_ms: i * 1000 + 900,
    text,
});

describe('formatOffset', () => {
    it('formats minutes and hours', () => {
        expect(formatOffset(0)).toBe('00:00');
        expect(formatOffset(65_400)).toBe('01:05');
        expect(formatOffset(3_723_000)).toBe('1:02:03');
        expect(formatOffset(-5)).toBe('00:00');
    });
});

describe('formatDuration', () => {
    it('uses short Indonesian units', () => {
        expect(formatDuration(30)).toBe('30 dtk');
        expect(formatDuration(2700)).toBe('45 mnt');
        expect(formatDuration(3900)).toBe('1 j 5 mnt');
        expect(formatDuration(3600)).toBe('1 j');
        expect(formatDuration(null)).toBe('0 dtk');
    });
});

describe('filterSegments', () => {
    const segments = [
        segment(0, 'Rina Wulandari', 'Kampanye mulai 20 Oktober.'),
        segment(1, 'Budi Santoso', 'Gudang  Cikarang terlambat.'),
    ];

    it('matches text and speaker, ignoring case and spacing', () => {
        expect(filterSegments(segments, 'gudang cikarang')).toEqual([
            segments[1],
        ]);
        expect(filterSegments(segments, 'RINA')).toEqual([segments[0]]);
        expect(filterSegments(segments, '  ')).toBe(segments);
        expect(filterSegments(segments, 'tidak ada')).toEqual([]);
    });
});

describe('shouldPoll', () => {
    const base = { transcript: null, draft: null } as unknown as NotulenSummary;

    it('polls while recording, transcribing, summarizing or a draft is pending', () => {
        expect(shouldPoll(null)).toBe(false);
        expect(shouldPoll(base)).toBe(false);
        const withStatus = (status: string, draft?: string) =>
            ({
                ...base,
                transcript: { status },
                draft: draft ? { status: draft } : null,
            }) as unknown as NotulenSummary;
        expect(shouldPoll(withStatus('recording'))).toBe(true);
        expect(shouldPoll(withStatus('summarizing'))).toBe(true);
        expect(shouldPoll(withStatus('ready', 'pending'))).toBe(true);
        expect(shouldPoll(withStatus('ready', 'ready'))).toBe(false);
        expect(shouldPoll(withStatus('failed'))).toBe(false);
    });
});

describe('speakingShare', () => {
    it('gives whole percentages', () => {
        expect(
            speakingShare([
                { identity: 'a', seconds: 30 },
                { identity: 'b', seconds: 10 },
            ]),
        ).toEqual({ a: 75, b: 25 });
        expect(speakingShare([{ identity: 'a', seconds: 0 }])).toEqual({
            a: 0,
        });
    });
});
