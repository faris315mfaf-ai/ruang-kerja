import { describe, expect, it } from 'vite-plus/test';
import { scrollDeltaAboveBar } from './room-scroll';

// Paper 0–800 px, the bar area reserves the last 96 px (60 bar + 18 gap + 18).
const PAPER = { top: 0, bottom: 800 };

describe('scrollDeltaAboveBar (audit U-03)', () => {
    it('leaves a field that is above the bar alone', () => {
        expect(scrollDeltaAboveBar({ top: 600, bottom: 640 }, PAPER, 96)).toBe(
            0,
        );
        expect(scrollDeltaAboveBar({ top: 660, bottom: 704 }, PAPER, 96)).toBe(
            0,
        );
    });

    it('scrolls a field under the bar just above it', () => {
        // "Tulis keputusan…" at 750–794 (under the bar): 90 px up.
        expect(scrollDeltaAboveBar({ top: 750, bottom: 794 }, PAPER, 96)).toBe(
            90,
        );
    });

    it('never scrolls the top of a tall field out of view', () => {
        expect(scrollDeltaAboveBar({ top: 40, bottom: 900 }, PAPER, 96)).toBe(
            40,
        );
    });
});
