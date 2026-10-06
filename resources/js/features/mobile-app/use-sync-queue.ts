import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SYNC_QUEUE } from './fixtures';
import {
    completeAttempt,
    markSyncing,
    nextToSync,
    pauseSync,
    queueBanner,
    retryFailed,
    summarizeQueue,
} from './logic';
import type { NetworkState, PreviewState, SyncItem } from './types';

const SEND_MS = 900;

function initialQueue(state: PreviewState): SyncItem[] {
    if (state === 'kosong') {
        return [];
    }

    if (state === 'galat') {
        return SYNC_QUEUE.map((item) =>
            item.fails_once
                ? {
                      ...item,
                      status: 'failed',
                      attempts: 1,
                      error: 'Status tugas sudah diubah Rizky. Kirim ulang untuk menimpa.',
                  }
                : { ...item, status: 'sent', attempts: 1 },
        );
    }

    return SYNC_QUEUE;
}

/**
 * Offline queue simulation (MOffline): items wait while offline and are
 * sent one by one once the network is back; one item hits a conflict on its
 * first attempt. Follows the browser's real online/offline events too.
 */
export function useSyncQueue(state: PreviewState) {
    const [items, setItems] = useState<SyncItem[]>(() => initialQueue(state));
    const [network, setNetwork] = useState<NetworkState>(
        state === 'normal' ? 'offline' : 'online',
    );
    const [lastSync, setLastSync] = useState('09.12');

    const summary = useMemo(() => summarizeQueue(items), [items]);
    const banner = queueBanner(network, summary, lastSync);

    const goOffline = useCallback(() => {
        setNetwork('offline');
        setItems((current) => pauseSync(current));
    }, []);

    const goOnline = useCallback(() => setNetwork('online'), []);

    useEffect(() => {
        window.addEventListener('offline', goOffline);
        window.addEventListener('online', goOnline);

        return () => {
            window.removeEventListener('offline', goOffline);
            window.removeEventListener('online', goOnline);
        };
    }, [goOffline, goOnline]);

    // Sync loop: one item at a time while online.
    useEffect(() => {
        if (network !== 'online') {
            return;
        }

        const sending = items.find((item) => item.status === 'syncing');

        if (sending) {
            const timer = window.setTimeout(() => {
                setItems((current) => completeAttempt(current, sending.id));
            }, SEND_MS);

            return () => window.clearTimeout(timer);
        }

        const next = nextToSync(items);

        if (next) {
            const timer = window.setTimeout(() => {
                setItems((current) => markSyncing(current, next.id));
            }, 150);

            return () => window.clearTimeout(timer);
        }
    }, [network, items]);

    // Announce the end of a sync round once.
    const settled =
        network === 'online' &&
        summary.total > 0 &&
        summary.pending + summary.syncing === 0;
    const failedCount = summary.failed;

    useEffect(() => {
        if (!settled) {
            return;
        }

        if (failedCount > 0) {
            toast.error(`${failedCount} perubahan gagal terkirim`);
        } else {
            setLastSync('10.06');
            toast.success('Semua perubahan tersinkron');
        }
    }, [settled, failedCount]);

    const retry = useCallback((id?: string) => {
        setNetwork('online');
        setItems((current) => retryFailed(current, id));
    }, []);

    return {
        items,
        network,
        summary,
        banner,
        lastSync,
        goOnline,
        goOffline,
        retry,
    };
}
