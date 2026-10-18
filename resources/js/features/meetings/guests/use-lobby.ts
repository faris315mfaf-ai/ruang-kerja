import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/features/tasks/lib/api';
import { meetingGuestsApi } from './api';
import { guestErrorMessage } from './use-guests';
import type { LobbyEntry } from './types';

const POLL_MS = 4000;
/** With a live Reverb channel polling is only a safety net. */
const POLL_REALTIME_MS = 20_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * The waiting room of one occurrence for whoever may admit (organizer,
 * minute taker, internal participants): polled every ~4 s while the tab is
 * shown. In the room the Reverb event `lobby.updated` (useRoomLive) calls
 * `reload()` and polling only stays as a 20 s safety net (`realtime`).
 * Admit / deny are applied optimistically and rolled back on failure.
 * `allowed` turns false on 403/404 (not invited): polling stops for good.
 */
export function useLobby({
    meetingId,
    date,
    enabled,
    realtime = false,
    onNew,
}: {
    meetingId: string;
    date: string | null;
    enabled: boolean;
    /** Something else (Reverb) calls `reload()` when the lobby changes. */
    realtime?: boolean;
    /** Called with guests that were not in the previous answer. */
    onNew?: (entries: LobbyEntry[]) => void;
}) {
    const [waiting, setWaiting] = useState<LobbyEntry[]>([]);
    const [allowed, setAllowed] = useState(true);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
    const seen = useRef<ReadonlySet<string> | null>(null);
    const onNewRef = useRef(onNew);
    onNewRef.current = onNew;
    const reloadRef = useRef<() => void>(() => undefined);

    useEffect(() => {
        if (!enabled || !allowed) {
            return;
        }

        let stopped = false;
        let timer: number | undefined;
        let failures = 0;

        const apply = (entries: LobbyEntry[]) => {
            // The first answer only seeds the "already known" set, so opening
            // the room does not announce everybody who was waiting already.
            if (seen.current !== null) {
                const fresh = entries.filter(
                    (entry) => !seen.current?.has(entry.id),
                );

                if (fresh.length > 0) {
                    onNewRef.current?.(fresh);
                }
            }

            seen.current = new Set(entries.map((entry) => entry.id));
            setWaiting(entries);
        };

        const schedule = () => {
            if (stopped) {
                return;
            }

            const base = realtime ? POLL_REALTIME_MS : POLL_MS;

            timer = window.setTimeout(
                () => void run(),
                Math.min(MAX_BACKOFF_MS, base * 2 ** Math.min(failures, 4)),
            );
        };

        let inflight = false;
        let again = false;

        const run = async () => {
            if (stopped) {
                return;
            }

            if (document.hidden) {
                return; // Resumed by visibilitychange.
            }

            if (inflight) {
                // A reload asked for while one is running: go again after it.
                again = true;

                return;
            }

            inflight = true;

            try {
                const reply = await meetingGuestsApi.lobby(meetingId, date);

                if (stopped) {
                    return;
                }

                failures = 0;
                setError(null);
                setLoaded(true);
                apply(reply.waiting);
            } catch (failure) {
                if (stopped) {
                    return;
                }

                if (
                    failure instanceof ApiError &&
                    (failure.status === 403 || failure.status === 404)
                ) {
                    setAllowed(false);
                    setLoaded(true);

                    return;
                }

                failures += 1;
                // A hiccup keeps the list we have; only say so after a few.
                if (failures >= 3) {
                    setError('Daftar tamu menunggu belum bisa dimuat.');
                }
            } finally {
                inflight = false;
            }

            if (again) {
                again = false;
                void run();

                return;
            }

            schedule();
        };

        const refresh = () => {
            window.clearTimeout(timer);
            void run();
        };

        reloadRef.current = refresh;

        const onVisible = () => {
            if (!document.hidden && !stopped) {
                refresh();
            }
        };

        document.addEventListener('visibilitychange', onVisible);

        void run();

        return () => {
            stopped = true;
            window.clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [enabled, allowed, meetingId, date, realtime]);

    const decide = useCallback(
        async (id: string, admit: boolean) => {
            const before = waiting;

            setBusy((set) => new Set(set).add(id));
            setWaiting((list) => list.filter((entry) => entry.id !== id));

            try {
                await (admit
                    ? meetingGuestsApi.admit(meetingId, date, id)
                    : meetingGuestsApi.deny(meetingId, date, id));
                seen.current = new Set(
                    [...(seen.current ?? [])].filter((item) => item !== id),
                );

                return null;
            } catch (failure) {
                // 409 status_berubah: somebody decided already: just refresh.
                const code =
                    typeof failure === 'object' &&
                    failure !== null &&
                    'code' in failure
                        ? (failure as { code?: unknown }).code
                        : null;

                if (code !== 'status_berubah') {
                    setWaiting(before);
                }

                reloadRef.current();

                return guestErrorMessage(
                    failure,
                    admit
                        ? 'Tamu belum bisa diizinkan masuk. Coba lagi.'
                        : 'Tamu belum bisa ditolak. Coba lagi.',
                );
            } finally {
                setBusy((set) => {
                    const next = new Set(set);

                    next.delete(id);

                    return next;
                });
            }
        },
        [waiting, meetingId, date],
    );

    return {
        waiting,
        count: waiting.length,
        allowed,
        loaded,
        error,
        busy,
        /** Resolves to an error message, or null when it worked. */
        admit: (id: string) => decide(id, true),
        deny: (id: string) => decide(id, false),
        reload: () => reloadRef.current(),
    };
}

export type LobbyController = ReturnType<typeof useLobby>;
