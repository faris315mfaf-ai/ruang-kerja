import { act, renderHook } from '@testing-library/react';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';
import { useGuestSession } from './use-guest-session';
import type { GuestInfo } from './types';

const info = (patch: Partial<GuestInfo> = {}): GuestInfo => ({
    status: 'none',
    status_label: 'Belum masuk',
    window: {
        state: 'open',
        opens_at: '2026-10-05T02:45:00Z',
        closes_at: '2026-10-05T06:00:00Z',
    },
    poll_seconds: 3,
    ...patch,
});

function reply(body: unknown, status = 200, headers: HeadersInit = {}) {
    return Promise.resolve(
        new Response(JSON.stringify(body), { status, headers }),
    );
}

const waiting = { status: 'waiting', status_label: 'Menunggu', window: 'open' };

async function tick(ms: number) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

describe('useGuestSession', () => {
    let fetcher: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.useFakeTimers();
        fetcher = vi.fn();
        vi.stubGlobal('fetch', fetcher);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('validates the name before calling the server', async () => {
        const { result } = renderHook(() => useGuestSession('tok', info()));

        await act(async () => result.current.submit());

        expect(fetcher).not.toHaveBeenCalled();
        expect(result.current.nameError).toMatch(/Tulis nama/);
    });

    it('sends the cleaned name and moves to waiting', async () => {
        fetcher.mockImplementation(() => reply(waiting));
        const { result } = renderHook(() => useGuestSession('tok', info()));

        act(() => result.current.setName('  Budi  (Tamu) '));
        await act(async () => result.current.submit());

        const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];

        expect(url).toBe('/api/tamu/tok/minta-masuk');
        expect(init.credentials).toBe('omit');
        expect(JSON.parse(init.body as string)).toEqual({ name: 'Budi' });
        expect(result.current.session.status).toBe('waiting');
    });

    it('polls every 3 seconds while waiting and stops once admitted', async () => {
        fetcher
            .mockImplementationOnce(() => reply(waiting))
            .mockImplementation(() =>
                reply({ ...waiting, status: 'admitted' }),
            );
        const { result } = renderHook(() =>
            useGuestSession('tok', info({ status: 'waiting' })),
        );

        await tick(2900);
        expect(fetcher).not.toHaveBeenCalled();
        await tick(200);
        expect(fetcher).toHaveBeenCalledTimes(1);
        await tick(3000);
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(result.current.session.status).toBe('admitted');
        await tick(30_000);
        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('keeps waiting through a network failure and backs off', async () => {
        fetcher
            .mockImplementationOnce(() => Promise.reject(new TypeError('x')))
            .mockImplementation(() => reply(waiting));
        const { result } = renderHook(() =>
            useGuestSession('tok', info({ status: 'waiting' })),
        );

        await tick(3000);
        expect(result.current.session.status).toBe('waiting');
        expect(result.current.session.failures).toBe(1);
        // Next poll after 6 s (one failure doubles the delay).
        await tick(5900);
        expect(fetcher).toHaveBeenCalledTimes(1);
        await tick(200);
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(result.current.session.failures).toBe(0);
    });

    it('honours Retry-After on a 429', async () => {
        fetcher
            .mockImplementationOnce(() =>
                reply({ message: 'Terlalu banyak' }, 429, {
                    'Retry-After': '15',
                }),
            )
            .mockImplementation(() => reply(waiting));
        renderHook(() => useGuestSession('tok', info({ status: 'waiting' })));

        await tick(3000);
        await tick(14_000);
        expect(fetcher).toHaveBeenCalledTimes(1);
        await tick(1500);
        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('turns a 404 on polling into "link not valid" and stops', async () => {
        fetcher.mockImplementation(() =>
            reply(
                { message: 'Tautan tidak dikenal.', code: 'tidak_dikenal' },
                404,
            ),
        );
        const { result } = renderHook(() =>
            useGuestSession('tok', info({ status: 'waiting' })),
        );

        await tick(3000);
        expect(result.current.session.status).toBe('unknown');
        await tick(60_000);
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('shows denied as a final status without polling more', async () => {
        fetcher.mockImplementation(() =>
            reply({ ...waiting, status: 'denied' }),
        );
        const { result } = renderHook(() =>
            useGuestSession('tok', info({ status: 'waiting' })),
        );

        await tick(3000);
        expect(result.current.session.status).toBe('denied');
        await tick(60_000);
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('maps a 410 kedaluwarsa on request to expired', async () => {
        fetcher.mockImplementation(() =>
            reply({ message: 'x', code: 'kedaluwarsa' }, 410),
        );
        const { result } = renderHook(() => useGuestSession('tok', info()));

        act(() => result.current.setName('Budi'));
        await act(async () => result.current.submit());

        expect(result.current.session.status).toBe('expired');
    });

    it('shows the server message when the room is not open yet', async () => {
        fetcher.mockImplementation(() =>
            reply(
                {
                    message: 'Ruang rapat dibuka pukul 09.45.',
                    code: 'ruang_belum_dibuka',
                },
                409,
            ),
        );
        const { result } = renderHook(() => useGuestSession('tok', info()));

        act(() => result.current.setName('Budi'));
        await act(async () => result.current.submit());

        expect(result.current.formError).toBe(
            'Ruang rapat dibuka pukul 09.45.',
        );
        expect(result.current.session.status).toBe('none');
    });
});
