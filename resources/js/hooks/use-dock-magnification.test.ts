import { describe, expect, it } from 'vite-plus/test';
import { magnifiedSize, stepSpring } from './use-dock-magnification';

describe('magnifiedSize', () => {
    it('is max right under the pointer and base outside the range', () => {
        expect(magnifiedSize(0, 46, 74, 150)).toBe(74);
        expect(magnifiedSize(150, 46, 74, 150)).toBe(46);
        expect(magnifiedSize(-200, 46, 74, 150)).toBe(46);
        expect(magnifiedSize(null, 46, 74, 150)).toBe(46);
    });

    it('falls off smoothly and symmetrically (raised cosine)', () => {
        expect(magnifiedSize(75, 46, 74, 150)).toBeCloseTo(60, 5);
        expect(magnifiedSize(-75, 46, 74, 150)).toBeCloseTo(60, 5);

        const near = magnifiedSize(10, 46, 74, 150);
        const far = magnifiedSize(100, 46, 74, 150);
        expect(near).toBeGreaterThan(far);
        expect(far).toBeGreaterThan(46);
    });
});

describe('stepSpring', () => {
    const settle = (from: number, target: number, seconds: number) => {
        let spring = { value: from, velocity: 0 };
        let peak = from;

        for (let t = 0; t < seconds; t += 1 / 60) {
            spring = stepSpring(spring, target, 1 / 60, 0.22);
            peak = Math.max(peak, spring.value);
        }

        return { spring, peak };
    };

    it('reaches the target without overshoot (critically damped)', () => {
        const { spring, peak } = settle(46, 74, 1);

        expect(spring.value).toBeCloseTo(74, 2);
        expect(peak).toBeLessThanOrEqual(74.001);
    });

    it('starts from the current value and velocity when retargeted', () => {
        let spring = { value: 46, velocity: 0 };

        for (let i = 0; i < 6; i += 1) {
            spring = stepSpring(spring, 74, 1 / 60, 0.22);
        }

        const midway = spring.value;
        const next = stepSpring(spring, 46, 1 / 60, 0.22);

        // No jump back to 46: one frame later it is still near where it was.
        expect(Math.abs(next.value - midway)).toBeLessThan(3);
        expect(midway).toBeGreaterThan(46);
    });

    it('stays stable on a long dropped frame', () => {
        const next = stepSpring({ value: 46, velocity: 0 }, 74, 0.5, 0.22);

        expect(Number.isFinite(next.value)).toBe(true);
        expect(next.value).toBeLessThanOrEqual(74.5);
    });
});
