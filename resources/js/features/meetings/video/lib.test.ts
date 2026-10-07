import { describe, expect, it } from 'vitest';
import {
    countdownLabel,
    durationShort,
    elapsedClock,
    isMacPlatform,
    joinWindow,
    namesSummary,
    raisedHandOrder,
    shortcutAction,
    shortcutLabel,
} from './lib';

const video = {
    opens_at: '2026-10-05T02:45:00Z',
    closes_at: '2026-10-05T06:00:00Z',
    is_organizer: false,
};

const key = (
    k: string,
    mods: Partial<{
        ctrlKey: boolean;
        metaKey: boolean;
        altKey: boolean;
        shiftKey: boolean;
        code: string;
    }> = {},
) => ({
    key: k,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...mods,
});

describe('joinWindow', () => {
    it('is early before the window, with the time left', () => {
        expect(joinWindow(video, Date.parse('2026-10-05T02:35:00Z'))).toEqual({
            state: 'early',
            msUntilOpen: 10 * 60_000,
        });
    });

    it('is open from opens_at until closes_at (inclusive)', () => {
        expect(joinWindow(video, Date.parse(video.opens_at)).state).toBe(
            'open',
        );
        expect(joinWindow(video, Date.parse(video.closes_at)).state).toBe(
            'open',
        );
        expect(
            joinWindow(video, Date.parse('2026-10-05T06:00:01Z')).state,
        ).toBe('closed');
    });

    it('is always open for the organizer', () => {
        const organizer = { ...video, is_organizer: true };

        expect(
            joinWindow(organizer, Date.parse('2026-10-04T00:00:00Z')),
        ).toEqual({ state: 'open' });
        expect(
            joinWindow(organizer, Date.parse('2026-10-06T00:00:00Z')).state,
        ).toBe('open');
    });
});

describe('countdownLabel', () => {
    it('counts seconds, minutes, hours and days', () => {
        expect(countdownLabel(45_000)).toBe('Dibuka dalam 45 detik');
        expect(countdownLabel(60_000)).toBe('Dibuka dalam 1 menit');
        expect(countdownLabel(12 * 60_000 - 500)).toBe('Dibuka dalam 12 menit');
        expect(countdownLabel(60 * 60_000)).toBe('Dibuka dalam 1 jam');
        expect(countdownLabel(65 * 60_000)).toBe('Dibuka dalam 1 jam 5 menit');
        expect(countdownLabel(50 * 3_600_000)).toBe('Dibuka dalam 2 hari');
        expect(countdownLabel(-5)).toBe('Dibuka dalam 0 detik');
    });
});

describe('durationShort', () => {
    it('formats minutes and hours', () => {
        expect(durationShort(20)).toBe('< 1 mnt');
        expect(durationShort(42 * 60)).toBe('42 mnt');
        expect(durationShort(60 * 60)).toBe('1 j');
        expect(durationShort(65 * 60 + 30)).toBe('1 j 5 mnt');
    });
});

describe('elapsedClock', () => {
    it('formats hours, minutes and seconds with leading zeros', () => {
        expect(elapsedClock(0)).toBe('00:00:00');
        expect(elapsedClock((18 * 60 + 42) * 1000 + 900)).toBe('00:18:42');
        expect(elapsedClock((2 * 3600 + 5) * 1000)).toBe('02:00:05');
        expect(elapsedClock(-5000)).toBe('00:00:00');
    });
});

describe('shortcuts', () => {
    it('maps Meet shortcuts with ⌘ on macOS and Ctrl elsewhere', () => {
        expect(shortcutAction(key('d', { metaKey: true }), true)).toBe(
            'toggle-mic',
        );
        expect(shortcutAction(key('e', { ctrlKey: true }), false)).toBe(
            'toggle-camera',
        );
        expect(shortcutAction(key('d', { ctrlKey: true }), true)).toBeNull();
        expect(shortcutAction(key('D', { ctrlKey: true }), false)).toBe(
            'toggle-mic',
        );
    });

    it('uses the physical key with Alt/Option (macOS prints ç for ⌥C)', () => {
        expect(
            shortcutAction(
                key('ç', { metaKey: true, altKey: true, code: 'KeyC' }),
                true,
            ),
        ).toBe('toggle-chat');
        expect(
            shortcutAction(key('p', { ctrlKey: true, altKey: true }), false),
        ).toBe('toggle-people');
        expect(
            shortcutAction(key('h', { ctrlKey: true, altKey: true }), false),
        ).toBe('toggle-hand');
        expect(
            shortcutAction(key('s', { ctrlKey: true, altKey: true }), false),
        ).toBe('toggle-captions');
    });

    it('ignores other combinations', () => {
        expect(shortcutAction(key('d'), false)).toBeNull();
        expect(
            shortcutAction(key('d', { ctrlKey: true, shiftKey: true }), false),
        ).toBeNull();
        expect(shortcutAction(key('x', { ctrlKey: true }), false)).toBeNull();
        expect(
            shortcutAction(key('d', { ctrlKey: true, altKey: true }), false),
        ).toBeNull();
    });

    it('labels shortcuts per platform', () => {
        expect(shortcutLabel('toggle-mic', true)).toBe('⌘ D');
        expect(shortcutLabel('toggle-chat', false)).toBe('Ctrl + Alt + C');
        expect(shortcutLabel('toggle-captions', true)).toBe('⌘ ⌥ S');
        expect(isMacPlatform('MacIntel')).toBe(true);
        expect(isMacPlatform('Win32')).toBe(false);
    });
});

describe('participants', () => {
    it('orders raised hands by the time they were raised', () => {
        expect(
            raisedHandOrder(
                [
                    { id: 'a', hand: '300' },
                    { id: 'b' },
                    { id: 'c', hand: '100' },
                    { id: 'd', hand: '' },
                ],
                (p) => p.hand,
            ).map((p) => p.id),
        ).toEqual(['c', 'a']);
    });

    it('summarizes names', () => {
        expect(namesSummary([])).toBe('');
        expect(namesSummary(['Rizky Aditya'])).toBe('Rizky');
        expect(namesSummary(['Rizky Aditya', 'Sari Dewi'])).toBe(
            'Rizky dan Sari',
        );
        expect(
            namesSummary(['Rizky A', 'Sari D', 'Bayu', 'Putri', 'Dimas']),
        ).toBe('Rizky, Sari, dan 3 lainnya');
    });
});
