import { useCallback, useEffect, useReducer, useState } from 'react';
import { guestApi, GuestApiError } from './api';
import {
    cleanGuestName,
    initialSession,
    isFinalStatus,
    pollDelayMs,
    reduceSession,
    validateGuestName,
} from './lib';
import type { GuestInfo, GuestStatus } from './types';

/** A final status that a failed call (404 / 410) stands for, if any. */
export function finalStatusOf(
    error: unknown,
): { status: GuestStatus; label: string } | null {
    if (!(error instanceof GuestApiError)) {
        return null;
    }

    if (error.status === 404) {
        return { status: 'unknown', label: 'Tautan tidak berlaku' };
    }

    if (error.status === 410) {
        return error.code === 'kedaluwarsa'
            ? { status: 'expired', label: 'Tautan sudah kedaluwarsa' }
            : { status: 'closed', label: 'Rapat sudah selesai' };
    }

    return null;
}

/**
 * Session of one guest link: the status the server reports (`none` →
 * `waiting` → `admitted` …), the name form, and the status poll while
 * waiting. Polling follows `poll_seconds`, backs off on failures and
 * `Retry-After`, pauses while the tab is hidden and resumes at once when it
 * is shown again. A failed poll never changes the status we already know.
 */
export function useGuestSession(token: string | null, info: GuestInfo) {
    const [session, dispatch] = useReducer(reduceSession, info, initialSession);
    const [name, setName] = useState(info.guest?.name ?? '');
    const [submitting, setSubmitting] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const pollSeconds = info.poll_seconds;

    const applyFailure = useCallback((error: unknown): boolean => {
        const final = finalStatusOf(error);

        if (final) {
            dispatch({ type: 'final', ...final });

            return true;
        }

        dispatch({
            type: 'failed',
            retryAfter:
                error instanceof GuestApiError ? error.retryAfter : null,
        });

        return false;
    }, []);

    // Status poll while waiting for the organizer.
    useEffect(() => {
        if (!token || session.status !== 'waiting') {
            return;
        }

        let stopped = false;
        let timer: number | undefined;
        let failures = 0;
        let retryAfter: number | null = null;

        const schedule = () => {
            if (stopped) {
                return;
            }

            timer = window.setTimeout(
                () => void run(),
                pollDelayMs({ pollSeconds, failures, retryAfter }),
            );
        };

        const run = async () => {
            if (stopped) {
                return;
            }

            if (document.hidden) {
                // Resumed by the visibilitychange listener below.
                return;
            }

            try {
                const reply = await guestApi.status(token);

                if (stopped) {
                    return;
                }

                failures = 0;
                retryAfter = null;
                dispatch({ type: 'reply', reply });

                if (isFinalStatus(reply.status) || reply.status !== 'waiting') {
                    return;
                }
            } catch (error) {
                if (stopped) {
                    return;
                }

                failures += 1;
                retryAfter =
                    error instanceof GuestApiError ? error.retryAfter : null;

                if (applyFailure(error)) {
                    return;
                }
            }

            schedule();
        };

        const onVisible = () => {
            if (!document.hidden && !stopped) {
                window.clearTimeout(timer);
                void run();
            }
        };

        document.addEventListener('visibilitychange', onVisible);
        schedule();

        return () => {
            stopped = true;
            window.clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [token, session.status, pollSeconds, applyFailure]);

    const submit = useCallback(async () => {
        if (!token || submitting) {
            return;
        }

        const problem = validateGuestName(name);

        setNameError(problem);
        setFormError(null);

        if (problem) {
            return;
        }

        setSubmitting(true);

        try {
            const reply = await guestApi.requestAdmission(
                token,
                cleanGuestName(name),
            );

            dispatch({ type: 'reply', reply });
        } catch (error) {
            if (error instanceof GuestApiError && error.status === 422) {
                setNameError(
                    error.errors.name?.[0] ??
                        (error.code === 'nama_kosong'
                            ? 'Tulis nama Anda.'
                            : error.message),
                );
            } else if (!applyFailure(error)) {
                setFormError(
                    error instanceof GuestApiError
                        ? error.message
                        : 'Permintaan belum terkirim. Coba lagi.',
                );
            }
        } finally {
            setSubmitting(false);
        }
    }, [token, name, submitting, applyFailure]);

    /** One-off status check ("Periksa lagi" after being removed). */
    const [checking, setChecking] = useState(false);
    const checkAgain = useCallback(async () => {
        if (!token || checking) {
            return;
        }

        setChecking(true);

        try {
            dispatch({ type: 'reply', reply: await guestApi.status(token) });
        } catch (error) {
            applyFailure(error);
        } finally {
            setChecking(false);
        }
    }, [token, checking, applyFailure]);

    /** The room told us the organizer removed this guest. */
    const markRemoved = useCallback(
        () =>
            dispatch({
                type: 'final',
                status: 'removed',
                label: 'Dikeluarkan dari ruang rapat',
            }),
        [],
    );

    return {
        session,
        name,
        setName: (value: string) => {
            setName(value);
            setNameError(null);
        },
        nameError,
        formError,
        submitting,
        submit,
        checking,
        checkAgain,
        markRemoved,
        /** True while polls keep failing (network). */
        offline: session.failures >= 2,
    };
}

export type GuestSessionController = ReturnType<typeof useGuestSession>;
