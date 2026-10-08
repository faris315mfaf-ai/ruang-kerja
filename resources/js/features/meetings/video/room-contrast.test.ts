import { describe, expect, it } from 'vite-plus/test';

// docs/DESIGN.md: --text-subtle (≈ 3:1, 2,7:1 on the room desk) is only for
// placeholders, decorative icons and disabled elements — never for text that
// must be read (audit U-04). Scans the video room and the auto-minutes UI.
const sources = import.meta.glob<string>(
    [
        '/resources/js/features/meetings/video/*.tsx',
        '/resources/js/features/meetings/notulen/*.tsx',
    ],
    { query: '?raw', import: 'default', eager: true },
);

describe('room text contrast (audit U-04)', () => {
    it('finds the room sources', () => {
        expect(Object.keys(sources).length).toBeGreaterThan(10);
    });

    it('uses text-subtle only for placeholders and decorative icon tiles', () => {
        const offenders = Object.entries(sources).flatMap(([path, source]) =>
            source
                .split('\n')
                .map((line, index) => ({ line, index }))
                .filter(
                    ({ line }) =>
                        /(?<!placeholder:)text-text-subtle/.test(line) &&
                        // Icon tiles / icon-only labels (aria-hidden content).
                        !line.includes('bg-surface-2'),
                )
                .map(({ index }) => `${path}:${index + 1}`),
        );

        expect(offenders).toEqual([]);
    });
});
