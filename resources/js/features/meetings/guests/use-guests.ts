import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/features/tasks/lib/api';
import { meetingGuestsApi } from './api';
import { dropGuest, upsertGuest } from './lib';
import type { GuestWindow, OrganizerGuest } from './types';

const REFRESH_MS = 10_000;

/** Server message of a failed call, else a fallback. */
export function guestErrorMessage(error: unknown, fallback: string): string {
    return error instanceof ApiError && error.message !== ''
        ? error.message
        : fallback;
}

/**
 * The organizer's guest list of one occurrence (GET /rapat/{id}/tamu): add,
 * rotate and revoke, plus a quiet refresh every 10 s while the tab is shown
 * so lobby statuses and "di ruang" stay current. `forbidden` = not the
 * organizer (nothing to show).
 */
export function useGuests({
    meetingId,
    date,
    enabled,
}: {
    meetingId: string;
    date: string | null;
    enabled: boolean;
}) {
    const [guests, setGuests] = useState<OrganizerGuest[]>([]);
    const [limit, setLimit] = useState(30);
    const [joinWindow, setJoinWindow] = useState<GuestWindow | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [forbidden, setForbidden] = useState(false);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);

    const load = useCallback(
        async (quiet = false) => {
            try {
                const reply = await meetingGuestsApi.list(meetingId, date);

                if (!mounted.current) {
                    return;
                }

                setGuests(reply.guests);
                setLimit(reply.limit);
                setJoinWindow(reply.window);
                setError(null);
                setLoaded(true);
            } catch (failure) {
                if (!mounted.current) {
                    return;
                }

                if (
                    failure instanceof ApiError &&
                    (failure.status === 403 || failure.status === 404)
                ) {
                    setForbidden(true);
                    setLoaded(true);

                    return;
                }

                // A failed quiet refresh keeps what is on screen.
                if (!quiet) {
                    setError(
                        guestErrorMessage(
                            failure,
                            'Daftar tamu belum bisa dimuat. Coba lagi.',
                        ),
                    );
                    setLoaded(true);
                }
            }
        },
        [meetingId, date],
    );

    useEffect(() => {
        if (!enabled) {
            return;
        }

        void load();
        const id = setInterval(() => {
            if (!document.hidden) {
                void load(true);
            }
        }, REFRESH_MS);

        return () => clearInterval(id);
    }, [enabled, load]);

    const add = useCallback(
        async (email: string, name: string | null) => {
            const { guest } = await meetingGuestsApi.add(meetingId, date, {
                email,
                name,
            });

            setGuests((list) => upsertGuest(list, guest));

            return guest;
        },
        [meetingId, date],
    );

    const rotate = useCallback(
        async (id: string) => {
            const { guest } = await meetingGuestsApi.rotate(
                meetingId,
                date,
                id,
            );

            setGuests((list) => upsertGuest(list, guest));

            return guest;
        },
        [meetingId, date],
    );

    const revoke = useCallback(
        async (id: string) => {
            await meetingGuestsApi.revoke(meetingId, date, id);
            setGuests((list) => dropGuest(list, id));
        },
        [meetingId, date],
    );

    /** Lobby decision from the guest list (waiting / removed / denied rows). */
    const decide = useCallback(
        async (id: string, admit: boolean) => {
            await (admit
                ? meetingGuestsApi.admit(meetingId, date, id)
                : meetingGuestsApi.deny(meetingId, date, id));
            await load(true);
        },
        [meetingId, date, load],
    );

    return {
        guests,
        limit,
        window: joinWindow,
        loaded,
        error,
        forbidden,
        reload: () => load(),
        add,
        rotate,
        revoke,
        decide,
    };
}

export type GuestsController = ReturnType<typeof useGuests>;
