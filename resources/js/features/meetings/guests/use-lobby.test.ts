import { act, renderHook } from '@testing-library/react';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';
import { RoomApiError } from '../video/api';
import type { LobbyEntry } from './types';

const lobby = vi.fn();
const admit = vi.fn();
const deny = vi.fn();

vi.mock('./api', () => ({
    meetingGuestsApi: {
        lobby: (...args: unknown[]) => lobby(...args),
        admit: (...args: unknown[]) => admit(...args),
        deny: (...args: unknown[]) => deny(...args),
    },
}));

const { useLobby } = await import('./use-lobby');

const entry = (id: string, name = id): LobbyEntry => ({
    id,
    name,
    email: `${id}@x.id`,
    requested_at: '2026-10-05T03:00:00Z',
    identity: `guest:${id}`,
});

const answer = (waiting: LobbyEntry[]) =>
    Promise.resolve({
        occurrence_date: '2026-10-05',
        window: null,
        waiting,
        waiting_count: waiting.length,
    });

async function tick(ms: number) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

describe('useLobby', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        lobby.mockReset();
        admit.mockReset();
        deny.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('loads at once, then polls every 4 seconds', async () => {
        lobby.mockImplementation(() => answer([entry('a')]));
        const { result } = renderHook(() =>
            useLobby({ meetingId: 'm', date: '2026-10-05', enabled: true }),
        );

        await tick(0);
        expect(result.current.count).toBe(1);
        expect(lobby).toHaveBeenCalledTimes(1);
        await tick(4000);
        expect(lobby).toHaveBeenCalledTimes(2);
    });

    it('does not announce who was already waiting, only newcomers', async () => {
        const onNew = vi.fn();

        lobby
            .mockImplementationOnce(() => answer([entry('a')]))
            .mockImplementation(() => answer([entry('a'), entry('b')]));
        renderHook(() =>
            useLobby({ meetingId: 'm', date: null, enabled: true, onNew }),
        );

        await tick(0);
        expect(onNew).not.toHaveBeenCalled();
        await tick(4000);
        expect(onNew).toHaveBeenCalledTimes(1);
        expect(onNew.mock.calls[0][0].map((e: LobbyEntry) => e.id)).toEqual([
            'b',
        ]);
    });

    it('slows down to a safety net when realtime drives it', async () => {
        lobby.mockImplementation(() => answer([]));
        renderHook(() =>
            useLobby({
                meetingId: 'm',
                date: null,
                enabled: true,
                realtime: true,
            }),
        );

        await tick(0);
        await tick(10_000);
        expect(lobby).toHaveBeenCalledTimes(1);
        await tick(10_000);
        expect(lobby).toHaveBeenCalledTimes(2);
    });

    it('stops for good when the viewer may not admit (403)', async () => {
        lobby.mockImplementation(() =>
            Promise.reject(new RoomApiError('x', 403, {}, null)),
        );
        const { result } = renderHook(() =>
            useLobby({ meetingId: 'm', date: null, enabled: true }),
        );

        await tick(0);
        expect(result.current.allowed).toBe(false);
        await tick(60_000);
        expect(lobby).toHaveBeenCalledTimes(1);
    });

    it('keeps the list through a failed refresh', async () => {
        lobby
            .mockImplementationOnce(() => answer([entry('a')]))
            .mockImplementationOnce(() =>
                Promise.reject(new RoomApiError('x', 500, {}, null)),
            )
            .mockImplementation(() => answer([entry('a')]));
        const { result } = renderHook(() =>
            useLobby({ meetingId: 'm', date: null, enabled: true }),
        );

        await tick(0);
        await tick(4000);
        expect(result.current.count).toBe(1);
        expect(result.current.error).toBeNull();
    });

    it('removes a guest at once on admit and puts them back on failure', async () => {
        lobby.mockImplementation(() => answer([entry('a'), entry('b')]));
        admit.mockImplementation(() =>
            Promise.reject(new RoomApiError('Gagal', 500, {}, null)),
        );
        const { result } = renderHook(() =>
            useLobby({ meetingId: 'm', date: null, enabled: true }),
        );

        await tick(0);

        let message: string | null = null;

        await act(async () => {
            message = await result.current.admit('a');
        });

        expect(message).toBe('Gagal');
        expect(result.current.waiting.map((e) => e.id)).toEqual(['a', 'b']);
    });

    it('does not restore a guest somebody else already decided (409)', async () => {
        lobby
            .mockImplementationOnce(() => answer([entry('a')]))
            .mockImplementation(() => answer([]));
        deny.mockImplementation(() =>
            Promise.reject(
                new RoomApiError(
                    'Status berubah',
                    409,
                    {},
                    null,
                    'status_berubah',
                ),
            ),
        );
        const { result } = renderHook(() =>
            useLobby({ meetingId: 'm', date: null, enabled: true }),
        );

        await tick(0);
        await act(async () => {
            await result.current.deny('a');
        });
        await tick(0);

        expect(result.current.count).toBe(0);
    });
});
