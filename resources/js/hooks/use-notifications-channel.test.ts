import { act, renderHook } from '@testing-library/react';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';

type Handler = (payload: unknown) => void;

const echoState = {
    configured: false,
    status: 'connected' as string,
    handler: null as Handler | null,
    statusListener: null as ((status: string) => void) | null,
    left: [] as string[],
};

vi.mock('@laravel/echo-react', () => ({
    echoIsConfigured: () => echoState.configured,
    echo: () => ({
        private: () => ({
            notification: (handler: Handler) => {
                echoState.handler = handler;
            },
        }),
        leave: (name: string) => echoState.left.push(name),
        connector: {
            connectionStatus: () => echoState.status,
            onConnectionChange: (listener: (status: string) => void) => {
                echoState.statusListener = listener;

                return () => {
                    echoState.statusListener = null;
                };
            },
        },
    }),
}));

const {
    POLL_INTERVAL_MS,
    resetDeliveredNotifications,
    useNotificationsChannel,
} = await import('./use-notifications-channel');

function feedResponse(body: unknown) {
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

const notification = (id: string) => ({
    id,
    type: 'system.test',
    category: 'system',
    icon: 'bell',
    tone: 'primary',
    type_label: 'Notifikasi uji',
    title: `Notifikasi ${id}`,
    body: null,
    url: '/inbox',
    actor: null,
    subject: null,
    meta: {},
    action_required: false,
    read_at: null,
    archived_at: null,
    created_at: '2026-10-05T01:00:00Z',
});

describe('useNotificationsChannel', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetDeliveredNotifications();
        Object.assign(echoState, {
            configured: false,
            status: 'connected',
            handler: null,
            statusListener: null,
            left: [],
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('stays idle without a signed-in user', () => {
        const { result } = renderHook(() =>
            useNotificationsChannel({ userId: null, onNotification: vi.fn() }),
        );

        expect(result.current).toBe('idle');
    });

    it('falls back to polling every 30 s when Echo is not configured', async () => {
        const fetchMock = vi
            .fn()
            .mockImplementationOnce(() =>
                feedResponse({
                    unread: 2,
                    notifications: [notification('old')],
                    server_time: 'T1',
                }),
            )
            .mockImplementationOnce(() =>
                feedResponse({
                    unread: 4,
                    notifications: [notification('b'), notification('a')],
                    server_time: 'T2',
                }),
            );
        vi.stubGlobal('fetch', fetchMock);
        const onNotification = vi.fn();
        const onUnreadCount = vi.fn();

        const { result } = renderHook(() =>
            useNotificationsChannel({
                userId: 'u1',
                onNotification,
                onUnreadCount,
            }),
        );

        expect(result.current).toBe('polling');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        // First call only primes the cursor: no toast for old items.
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0][0])).toBe('/inbox/feed');
        expect(onNotification).not.toHaveBeenCalled();
        expect(onUnreadCount).toHaveBeenLastCalledWith(2);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
        });

        expect(String(fetchMock.mock.calls[1][0])).toBe('/inbox/feed?after=T1');
        expect(onNotification.mock.calls.map(([n]) => n.id)).toEqual([
            'a',
            'b',
        ]); // oldest first
        expect(onUnreadCount).toHaveBeenLastCalledWith(4);
    });

    it('listens on the private user channel when connected, without polling', () => {
        echoState.configured = true;
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const onNotification = vi.fn();

        const { result, unmount } = renderHook(() =>
            useNotificationsChannel({ userId: 'u1', onNotification }),
        );

        expect(result.current).toBe('realtime');

        act(() => {
            echoState.handler?.({ ...notification('r1'), meta: [] });
            echoState.handler?.({ ...notification('r1'), meta: [] }); // duplicate delivery
        });

        expect(onNotification).toHaveBeenCalledTimes(1);
        expect(onNotification.mock.calls[0][0]).toMatchObject({
            id: 'r1',
            meta: {},
            read_at: null,
        });
        expect(fetchMock).not.toHaveBeenCalled();

        unmount();
        expect(echoState.left).toEqual(['App.Models.User.u1']);
    });

    it('switches to polling when the socket drops and back when it reconnects', async () => {
        echoState.configured = true;
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                feedResponse({
                    unread: 0,
                    notifications: [],
                    server_time: 'T',
                }),
            ),
        );

        const { result } = renderHook(() =>
            useNotificationsChannel({ userId: 'u1', onNotification: vi.fn() }),
        );

        act(() => echoState.statusListener?.('disconnected'));
        expect(result.current).toBe('polling');

        act(() => echoState.statusListener?.('connected'));
        expect(result.current).toBe('realtime');
    });
});
