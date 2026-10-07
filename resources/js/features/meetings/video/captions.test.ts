import { describe, expect, it } from 'vitest';
import type { CaptionLine } from './captions';
import {
    applyCaption,
    CAPTION_HOLD_MS,
    readCaptionAttributes,
    showSpeakerName,
    visibleCaptions,
} from './captions';

const update = (
    segmentId: string,
    speaker: string,
    text: string,
    at: number,
    final = false,
) => ({ segmentId, speaker, text, at, final });

describe('readCaptionAttributes', () => {
    it('reads the LiveKit Agents transcription attributes', () => {
        expect(
            readCaptionAttributes(
                {
                    'lk.segment_id': 'SG_1',
                    'lk.transcribed_track_id': 'TR_9',
                    'lk.transcription_final': 'true',
                },
                'stream-1',
            ),
        ).toEqual({ segmentId: 'SG_1', trackId: 'TR_9', final: true });
    });

    it('falls back to the stream id and interim without attributes', () => {
        expect(readCaptionAttributes(undefined, 'stream-1')).toEqual({
            segmentId: 'stream-1',
            trackId: null,
            final: false,
        });
    });
});

describe('applyCaption', () => {
    it('grows a segment in place while the person talks', () => {
        let lines: CaptionLine[] = [];
        lines = applyCaption(lines, update('a', 'dimas', 'Oke,', 1));
        lines = applyCaption(lines, update('b', 'sari', 'Jadi untuk', 2));
        lines = applyCaption(
            lines,
            update('a', 'dimas', 'Oke, biayanya masuk anggaran Q4.', 3, true),
        );

        expect(lines.map((line) => [line.segmentId, line.text])).toEqual([
            ['a', 'Oke, biayanya masuk anggaran Q4.'],
            ['b', 'Jadi untuk'],
        ]);
        expect(lines[0].final).toBe(true);
        expect(lines[0].at).toBe(3);
    });

    it('ignores empty text and never turns a final line interim', () => {
        let lines = applyCaption([], update('a', 'dimas', 'Selesai.', 1, true));
        lines = applyCaption(lines, update('a', 'dimas', '   ', 2));
        expect(lines[0].text).toBe('Selesai.');
        lines = applyCaption(lines, update('a', 'dimas', 'Selesai lagi.', 3));
        expect(lines[0].final).toBe(true);
        expect(applyCaption([], update('x', 'y', '', 1))).toEqual([]);
    });

    it('collapses whitespace and keeps a bounded buffer', () => {
        let lines: CaptionLine[] = [];

        for (let i = 0; i < 10; i++) {
            lines = applyCaption(
                lines,
                update(`s${i}`, 'p', ` kata\n ${i} `, i),
            );
        }

        expect(lines).toHaveLength(6);
        expect(lines[0].segmentId).toBe('s4');
        expect(lines.at(-1)?.text).toBe('kata 9');
    });
});

describe('visibleCaptions', () => {
    const lines = [
        update('a', 'dimas', 'satu', 1000),
        update('b', 'sari', 'dua', 2000),
        update('c', 'sari', 'tiga', 3000),
    ] as CaptionLine[];

    it('shows the last two lines while the newest one is fresh', () => {
        expect(visibleCaptions(lines, 4000).map((l) => l.text)).toEqual([
            'dua',
            'tiga',
        ]);
    });

    it('hides the box after the hold time and when empty', () => {
        expect(visibleCaptions(lines, 3000 + CAPTION_HOLD_MS + 1)).toEqual([]);
        expect(visibleCaptions([], 0)).toEqual([]);
    });

    it('names the speaker once per turn', () => {
        const shown = visibleCaptions(lines, 4000, 3);
        expect(shown.map((_, i) => showSpeakerName(shown, i))).toEqual([
            true,
            true,
            false,
        ]);
    });
});
