import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { ApiError } from '@/features/tasks/lib/api';

type Options = {
    token: () => Promise<string>;
    name: string;
};

const providers: FakeProvider[] = [];

class FakeProvider {
    options: Options;
    handlers: Record<string, ((payload?: unknown) => void)[]> = {};
    awareness = { setLocalStateField: vi.fn() };

    constructor(options: Options) {
        this.options = options;
        providers.push(this);
    }

    on(event: string, handler: (payload?: unknown) => void) {
        (this.handlers[event] ??= []).push(handler);
    }

    emit(event: string, payload?: unknown) {
        this.handlers[event]?.forEach((handler) => handler(payload));
    }

    destroy() {}
}

// Set by the mock factory: proves the collab stack only loads when the hook
// actually needs it (audit U-06).
const stack = vi.hoisted(() => ({ loaded: false }));

vi.mock('@hocuspocus/provider', () => {
    stack.loaded = true;

    return { HocuspocusProvider: FakeProvider };
});

const collabToken = vi.fn();

vi.mock('./api', () => ({
    videoApi: { collabToken: (url: string) => collabToken(url) },
}));

const { useMinutesCollab } = await import('./use-minutes-collab');

const COLLAB = {
    token_url: '/rapat/01k6x0000000000000000000aa/notulen/kolaborasi',
    url: 'wss://collab.test',
};
const ME = { id: '01k6x0000000000000000000bb', name: 'Nadia', seat: 2 };
const token = (canEdit: boolean, value: string) => ({
    document: 'meeting-minutes.01k6x0000000000000000000cc',
    token: value,
    url: 'wss://collab.test',
    can_edit: canEdit,
    expires_in: 120,
});

describe('useMinutesCollab (audit U-02)', () => {
    afterEach(() => {
        providers.length = 0;
        collabToken.mockReset();
        stack.loaded = false;
    });

    it('never loads the collab stack without a document (U-06)', async () => {
        collabToken.mockRejectedValueOnce(new ApiError('tidak ada', 404));
        const { result } = renderHook(() =>
            useMinutesCollab(COLLAB as never, ME),
        );

        await waitFor(() =>
            expect(result.current).toMatchObject({ mode: 'waiting' }),
        );
        expect(stack.loaded).toBe(false);
    });

    it('follows the edit right of every reconnect token', async () => {
        collabToken.mockResolvedValueOnce(token(true, 'first'));
        const { result } = renderHook(() =>
            useMinutesCollab(COLLAB as never, ME),
        );

        await waitFor(() => expect(providers).toHaveLength(1));
        const provider = providers[0];
        expect(await provider.options.token()).toBe('first');
        act(() => provider.emit('synced'));
        expect(result.current).toMatchObject({ mode: 'live', canEdit: true });

        // Server forced a reconnect (minutes finalized / participant removed).
        collabToken.mockResolvedValueOnce(token(false, 'read-only'));
        await act(async () => {
            expect(await provider.options.token()).toBe('read-only');
        });
        expect(result.current).toMatchObject({ mode: 'live', canEdit: false });

        // Re-admitted / reopened: editable again after the next reconnect.
        collabToken.mockResolvedValueOnce(token(true, 'again'));
        await act(async () => {
            await provider.options.token();
        });
        expect(result.current).toMatchObject({ mode: 'live', canEdit: true });
    });
});
