import { describe, expect, it } from 'vitest';

// Raw sources of every component/page/style (Vite glob, resolved at test time).
const sources = import.meta.glob<string>(
    ['/resources/js/**/*.{ts,tsx}', '/resources/css/**/*.css'],
    { query: '?raw', import: 'default', eager: true },
);

describe('color tokens', () => {
    it('finds the sources to scan', () => {
        expect(Object.keys(sources).length).toBeGreaterThan(50);
    });

    // Tokens in resources/css are full colors (hex/oklch): passing a token to
    // hsl() yields an invalid color and the style silently drops.
    it('never wraps a CSS color token in hsl()', () => {
        const offenders = Object.entries(sources)
            .filter(([, source]) => /hsla?\(\s*var\(--/.test(source))
            .map(([path]) => path);

        expect(offenders).toEqual([]);
    });
});
