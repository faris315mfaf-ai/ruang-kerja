import { describe, expect, it } from 'vitest';
import { palette, paletteGradient } from './palette';

describe('palette', () => {
    it('maps names to token classes and falls back to gray', () => {
        expect(palette('teal').bg).toBe('bg-tag-teal');
        expect(palette('unknown').bg).toBe('bg-tag-gray');
    });

    it('picks an Arus gradient for a palette colour', () => {
        expect(paletteGradient('teal')).toBe('bg-grad-merek');
        expect(paletteGradient('violet')).toBe('bg-grad-indigo');
        expect(paletteGradient('orange')).toBe('bg-grad-hangat');
        expect(paletteGradient('blue')).toBe('bg-grad-aksi');
        expect(paletteGradient(null)).toBe('bg-grad-aksi');
    });
});
