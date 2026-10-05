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

    // AGENTS.md: colours only from tokens. Components never carry hex/rgb
    // literals or Tailwind palette classes (bg-red-500, text-white …).
    it('keeps components on design tokens (no hex, rgb or palette classes)', () => {
        const palette =
            /\b(?:bg|text|border|ring|from|via|to|fill|stroke|outline|divide|decoration|caret|accent|shadow)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b|\b(?:bg|text|border)-(?:white|black)\b/;
        const literal = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/;
        const offenders = Object.entries(sources)
            .filter(
                ([path]) => path.endsWith('.tsx') && !path.includes('.test.'),
            )
            .filter(
                ([, source]) => palette.test(source) || literal.test(source),
            )
            .map(([path]) => path);

        expect(offenders).toEqual([]);
    });
});
