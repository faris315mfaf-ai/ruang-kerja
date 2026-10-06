import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
    endMinutesSession,
    parseSession,
    readSession,
    SESSION_KEY,
    sessionUrl,
    startMinutesSession,
    updateMinutesSession,
    useMinutesSession,
} from './minutes-session';

const USER = '01k6x0000000000000000000aa';
const OTHER = '01k6x0000000000000000000bb';
const ROOT = '01k6x0000000000000000000cc';
const TAB = '01k6x0000000000000000000dd';
const ROOT_2 = '01k6x0000000000000000000ee';

describe('minutes session', () => {
    afterEach(() => {
        endMinutesSession();
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    it('starts, follows the open tab and ends', () => {
        const started = startMinutesSession({
            userId: USER,
            noteId: ROOT,
            rootId: ROOT,
            title: 'Notulensi · Selasa',
        });

        expect(readSession()).toEqual(started);
        expect(
            JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? ''),
        ).toEqual(started);

        updateMinutesSession({ noteId: TAB, title: 'Rapat mingguan' });
        expect(readSession()).toMatchObject({
            noteId: TAB,
            rootId: ROOT,
            title: 'Rapat mingguan',
            startedAt: started.startedAt,
        });
        expect(sessionUrl(readSession()!)).toBe(`/catatan/${TAB}`);

        endMinutesSession();
        expect(readSession()).toBeNull();
        expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
    });

    it('keeps the start time on another tab of the same document only', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-06T07:05:00Z'));
        const first = startMinutesSession({
            userId: USER,
            noteId: ROOT,
            rootId: ROOT,
            title: 'A',
        });
        vi.setSystemTime(new Date('2026-10-06T07:30:00Z'));

        expect(
            startMinutesSession({
                userId: USER,
                noteId: TAB,
                rootId: ROOT,
                title: 'A',
            }).startedAt,
        ).toBe(first.startedAt);
        expect(
            startMinutesSession({
                userId: USER,
                noteId: ROOT_2,
                rootId: ROOT_2,
                title: 'B',
            }).startedAt,
        ).toBe('2026-10-06T07:30:00.000Z');
        vi.useRealTimers();
    });

    it('ignores damaged or foreign storage values', () => {
        expect(parseSession('{rusak')).toBeNull();
        expect(parseSession('null')).toBeNull();
        expect(parseSession(JSON.stringify({ userId: USER }))).toBeNull();
        expect(
            parseSession(
                JSON.stringify({
                    userId: USER,
                    noteId: '../admin',
                    rootId: ROOT,
                    title: 'x',
                    startedAt: 'now',
                }),
            ),
        ).toBeNull();

        window.localStorage.setItem(SESSION_KEY, '{rusak');
        expect(readSession()).toBeNull();
    });

    it('works for this page when storage is blocked', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceeded');
        });
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError');
        });

        startMinutesSession({
            userId: USER,
            noteId: ROOT,
            rootId: ROOT,
            title: 'A',
        });
        expect(readSession()?.rootId).toBe(ROOT);
    });

    it('belongs to the signed-in user only and updates subscribers', () => {
        const { result, rerender } = renderHook(
            ({ user }: { user: string }) => useMinutesSession(user),
            { initialProps: { user: USER } },
        );

        expect(result.current).toBeNull();

        act(() => {
            startMinutesSession({
                userId: USER,
                noteId: ROOT,
                rootId: ROOT,
                title: 'A',
            });
        });
        expect(result.current?.rootId).toBe(ROOT);

        rerender({ user: OTHER });
        expect(result.current).toBeNull();
    });
});
