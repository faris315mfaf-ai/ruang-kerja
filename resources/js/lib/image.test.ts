import { describe, expect, it } from 'vite-plus/test';
import { MAX_SELFIE_BYTES, encodeWithinBudget, fitWithin } from './image';

const blobOf = (size: number) =>
    new Blob([new Uint8Array(size)], { type: 'image/jpeg' });

describe('encodeWithinBudget', () => {
    it('keeps the best quality that fits', async () => {
        const calls: number[] = [];
        const blob = await encodeWithinBudget(async (quality) => {
            calls.push(quality);

            return blobOf(quality >= 0.8 ? 400_000 : 250_000);
        });

        expect(blob.size).toBe(250_000);
        expect(calls).toEqual([0.85, 0.75]);
    });

    it('reduces the resolution when quality alone is not enough', async () => {
        const scales: number[] = [];
        const blob = await encodeWithinBudget(async (quality, scale) => {
            scales.push(scale);

            return blobOf(Math.round(900_000 * scale * scale * quality));
        });

        expect(blob.size).toBeLessThanOrEqual(MAX_SELFIE_BYTES);
        expect(Math.min(...scales)).toBeLessThan(1);
    });

    it('returns the smallest attempt when nothing fits', async () => {
        const blob = await encodeWithinBudget(
            async (quality, scale) =>
                blobOf(Math.round(10_000_000 * quality * scale)),
            10,
        );

        expect(blob.size).toBeGreaterThan(10);
        expect(blob.size).toBe(Math.round(10_000_000 * 0.45 * 0.8 ** 4));
    });
});

describe('fitWithin', () => {
    it('limits the longest side and keeps the aspect ratio', () => {
        expect(fitWithin(1920, 1080)).toEqual({ width: 960, height: 540 });
        expect(fitWithin(720, 960)).toEqual({ width: 720, height: 960 });
        expect(fitWithin(3000, 4000, 800)).toEqual({ width: 600, height: 800 });
    });
});
