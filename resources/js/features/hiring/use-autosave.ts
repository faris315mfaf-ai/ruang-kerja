import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { HttpRequestError } from '@/lib/http';

export type AutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/** Indonesian status line under an autosaved field. */
export function autosaveLabel(status: AutosaveStatus): string | null {
    switch (status) {
        case 'dirty':
        case 'saving':
            return 'Menyimpan…';
        case 'saved':
            return 'Tersimpan';
        case 'error':
            return 'Gagal menyimpan. Periksa koneksi lalu ketik lagi.';
        default:
            return null;
    }
}

/** First validation message of a Laravel JSON error, or a generic one. */
export function errorMessage(error: unknown): string {
    if (error instanceof HttpRequestError) {
        const body = error.body as {
            message?: string;
            errors?: Record<string, string[]>;
        } | null;
        const first = body?.errors ? Object.values(body.errors)[0]?.[0] : null;

        if (first) {
            return first;
        }

        if (error.status === 403 || error.status === 404) {
            return (
                body?.message ?? 'Anda tidak punya akses untuk mengubah ini.'
            );
        }
    }

    return 'Gagal menyimpan. Coba lagi.';
}

/**
 * Debounced save of a text value (interview answer, score note): saves
 * `delay` ms after the last change and immediately on flush() (blur). Only
 * the latest value is sent; a failed save shows a toast and keeps the text.
 */
export function useAutosave<T>(
    save: (value: T) => Promise<unknown>,
    delay = 800,
): {
    status: AutosaveStatus;
    schedule: (value: T) => void;
    flush: () => void;
} {
    const [status, setStatus] = useState<AutosaveStatus>('idle');
    const timer = useRef<number | null>(null);
    const pending = useRef<{ value: T } | null>(null);
    const saveRef = useRef(save);

    useEffect(() => {
        saveRef.current = save;
    }, [save]);

    const run = useCallback(() => {
        if (timer.current !== null) {
            window.clearTimeout(timer.current);
            timer.current = null;
        }

        const next = pending.current;

        if (next === null) {
            return;
        }

        pending.current = null;
        setStatus('saving');
        saveRef
            .current(next.value)
            .then(() => {
                setStatus(pending.current === null ? 'saved' : 'dirty');
            })
            .catch((error: unknown) => {
                setStatus('error');
                toast.error(errorMessage(error));
            });
    }, []);

    const schedule = useCallback(
        (value: T) => {
            pending.current = { value };
            setStatus('dirty');

            if (timer.current !== null) {
                window.clearTimeout(timer.current);
            }

            timer.current = window.setTimeout(run, delay);
        },
        [delay, run],
    );

    // Save what is left when the component goes away (tab switch).
    useEffect(() => () => run(), [run]);

    return { status, schedule, flush: run };
}
