import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
    clampScale,
    getNoteScale,
    resetNoteScaleCache,
    SCALE_KEY,
    setNoteScale,
    stepNoteScale,
} from './note-scale';

describe('note text size', () => {
    afterEach(() => {
        window.localStorage.clear();
        resetNoteScaleCache();
        vi.restoreAllMocks();
    });

    it('stays between 90% and 160% in steps of 10', () => {
        expect(clampScale(40)).toBe(90);
        expect(clampScale(500)).toBe(160);
        expect(clampScale(124)).toBe(120);
        expect(clampScale('130')).toBe(130);
        expect(clampScale('besar')).toBe(100);
        expect(clampScale(Number.NaN)).toBe(100);
        expect(clampScale(null)).toBe(100);
    });

    it('steps and remembers the size on this device', () => {
        expect(getNoteScale()).toBe(100);

        for (let index = 0; index < 10; index++) {
            stepNoteScale(1);
        }

        expect(getNoteScale()).toBe(160);
        expect(window.localStorage.getItem(SCALE_KEY)).toBe('160');

        resetNoteScaleCache();
        expect(getNoteScale()).toBe(160);

        for (let index = 0; index < 10; index++) {
            stepNoteScale(-1);
        }

        expect(getNoteScale()).toBe(90);

        setNoteScale(100);
        expect(window.localStorage.getItem(SCALE_KEY)).toBeNull();
    });

    it('reads a damaged stored value as 100%', () => {
        window.localStorage.setItem(SCALE_KEY, 'raksasa');
        resetNoteScaleCache();

        expect(getNoteScale()).toBe(100);
    });

    it('still applies the size when storage is blocked', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('SecurityError');
        });

        expect(setNoteScale(140)).toBe(140);
        expect(getNoteScale()).toBe(140);
    });
});
