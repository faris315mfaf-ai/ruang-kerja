import { act, renderHook } from '@testing-library/react';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';

vi.mock('@laravel/echo-react', () => ({
    echoIsConfigured: () => false,
    echo: () => {
        throw new Error('not configured');
    },
}));

const { STATUS_POLL_MS, usePasswordResetStatus } =
    await import('./use-password-reset-status');

function respond(body: unknown, status = 200) {
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function setVisibility(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => state,
    });
}

async function tick(ms = STATUS_POLL_MS) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

describe('usePasswordResetStatus', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        setVisibility('visible');
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('polls every 5 seconds while pending', async () => {
        const fetcher = vi.fn(() => respond({ status: 'pending' }));
        const { result } = renderHook(() =>
            usePasswordResetStatus({
                initial: 'pending',
                url: '/lupa-sandi/status',
                onApproved: vi.fn(),
                onFinal: vi.fn(),
                fetcher,
            }),
        );

        expect(fetcher).not.toHaveBeenCalled();
        await tick();
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(fetcher).toHaveBeenCalledWith(
            '/lupa-sandi/status',
            expect.objectContaining({ credentials: 'same-origin' }),
        );
        await tick();
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(result.current).toBe('pending');
    });

    it('continues to the new password as soon as HR approves, then stops', async () => {
        const fetcher = vi
            .fn()
            .mockImplementationOnce(() => respond({ status: 'pending' }))
            .mockImplementation(() => respond({ status: 'approved' }));
        const onApproved = vi.fn();
        const { result } = renderHook(() =>
            usePasswordResetStatus({
                initial: 'pending',
                url: '/status',
                onApproved,
                onFinal: vi.fn(),
                fetcher,
            }),
        );

        await tick();
        expect(onApproved).not.toHaveBeenCalled();
        await tick();
        expect(onApproved).toHaveBeenCalledTimes(1);
        expect(result.current).toBe('approved');

        await tick(STATUS_POLL_MS * 3);
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(onApproved).toHaveBeenCalledTimes(1);
    });

    it.each(['rejected', 'expired'] as const)(
        'reports a final %s state once and stops polling',
        async (state) => {
            const fetcher = vi.fn(() => respond({ status: state }));
            const onFinal = vi.fn();
            renderHook(() =>
                usePasswordResetStatus({
                    initial: 'pending',
                    url: '/status',
                    onApproved: vi.fn(),
                    onFinal,
                    fetcher,
                }),
            );

            await tick();
            expect(onFinal).toHaveBeenCalledWith(state);
            await tick(STATUS_POLL_MS * 2);
            expect(fetcher).toHaveBeenCalledTimes(1);
        },
    );

    it('does not poll while the tab is hidden and checks again when shown', async () => {
        setVisibility('hidden');
        const fetcher = vi.fn(() => respond({ status: 'pending' }));
        renderHook(() =>
            usePasswordResetStatus({
                initial: 'pending',
                url: '/status',
                onApproved: vi.fn(),
                onFinal: vi.fn(),
                fetcher,
            }),
        );

        await tick(STATUS_POLL_MS * 3);
        expect(fetcher).not.toHaveBeenCalled();

        setVisibility('visible');
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('ignores errors and rate limits, and keeps polling', async () => {
        const fetcher = vi
            .fn()
            .mockImplementationOnce(() =>
                Promise.reject(new TypeError('offline')),
            )
            .mockImplementationOnce(() =>
                respond({ message: 'Terlalu banyak' }, 429),
            )
            .mockImplementation(() => respond({ status: 'approved' }));
        const onApproved = vi.fn();
        renderHook(() =>
            usePasswordResetStatus({
                initial: 'pending',
                url: '/status',
                onApproved,
                onFinal: vi.fn(),
                fetcher,
            }),
        );

        await tick();
        await tick();
        expect(onApproved).not.toHaveBeenCalled();
        await tick();
        expect(onApproved).toHaveBeenCalledTimes(1);
    });

    it('does not poll when the page starts in a final state', async () => {
        const fetcher = vi.fn(() => respond({ status: 'pending' }));
        renderHook(() =>
            usePasswordResetStatus({
                initial: 'rejected',
                url: '/status',
                onApproved: vi.fn(),
                onFinal: vi.fn(),
                fetcher,
            }),
        );

        await tick(STATUS_POLL_MS * 2);
        expect(fetcher).not.toHaveBeenCalled();
    });
});
