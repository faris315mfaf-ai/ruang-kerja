import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';
import type { CardResult } from './task-card';
import { createCardRefresher } from './task-card';

describe('createCardRefresher', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('collapses a burst of events into one refetch per task', async () => {
        const fetcher = vi.fn((): Promise<CardResult> =>
            Promise.resolve({ kind: 'gone' }),
        );
        const apply = vi.fn();
        const refresher = createCardRefresher(apply, fetcher, 100);

        refresher.schedule('a');
        refresher.schedule('a');
        refresher.schedule('b');
        refresher.schedule('a');

        await vi.advanceTimersByTimeAsync(100);

        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(fetcher).toHaveBeenCalledWith('a');
        expect(fetcher).toHaveBeenCalledWith('b');
        expect(apply).toHaveBeenCalledWith('a', { kind: 'gone' });
    });

    it('drops pending refetches when cancelled', async () => {
        const fetcher = vi.fn((): Promise<CardResult> =>
            Promise.resolve({ kind: 'failed' }),
        );
        const refresher = createCardRefresher(vi.fn(), fetcher, 100);

        refresher.schedule('a');
        refresher.cancel();

        await vi.advanceTimersByTimeAsync(200);

        expect(fetcher).not.toHaveBeenCalled();
    });
});
