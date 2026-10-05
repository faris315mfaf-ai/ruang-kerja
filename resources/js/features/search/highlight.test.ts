import { describe, expect, it } from 'vite-plus/test';
import { highlightMatches } from './highlight';

describe('highlightMatches', () => {
    it('marks case-insensitive matches of every word', () => {
        expect(
            highlightMatches('Landing page produk baru', 'landing pro'),
        ).toEqual([
            { text: 'Landing', match: true },
            { text: ' page ', match: false },
            { text: 'pro', match: true },
            { text: 'duk baru', match: false },
        ]);
    });

    it('ignores one-letter words and escapes regex characters', () => {
        expect(highlightMatches('Biaya (Q4)', 'a')).toEqual([
            { text: 'Biaya (Q4)', match: false },
        ]);
        expect(highlightMatches('Biaya (Q4)', '(q4)')).toEqual([
            { text: 'Biaya ', match: false },
            { text: '(Q4)', match: true },
        ]);
    });
});
