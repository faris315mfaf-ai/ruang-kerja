import { useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { HttpRequestError, requestJson } from '@/lib/http';
import employeeRoutes from '@/routes/attendance/employees';
import { isAttended, isSettable, toTimeInput } from './cells';
import type { DayDetail, DayTarget, SettableStatus } from './types';

type Load =
    | { state: 'idle' }
    | { state: 'loading' }
    | { state: 'ready'; detail: DayDetail }
    | { state: 'error'; message: string };

export type DayEditor = ReturnType<typeof useDayEditor>;

/**
 * Shared logic of the "Atur absensi" side sheet (desktop) and bottom sheet
 * (mobile): loads the date's detail JSON, keeps the chosen status, times and
 * reason, and saves (PUT) or clears (DELETE) via Inertia, reloading `reload`.
 */
export function useDayEditor(
    target: DayTarget | null,
    reload: string[],
    onDone: () => void,
) {
    const [load, setLoad] = useState<Load>({ state: 'idle' });
    const [attempt, setAttempt] = useState(0);
    const form = useForm<{
        status: SettableStatus | '';
        check_in: string;
        check_out: string;
        reason: string;
    }>({ status: '', check_in: '', check_out: '', reason: '' });
    const key = target ? `${target.employeeId}/${target.date}` : null;

    useEffect(() => {
        if (target === null) {
            setLoad({ state: 'idle' });

            return;
        }

        const controller = new AbortController();

        setLoad({ state: 'loading' });
        form.clearErrors();
        requestJson<DayDetail>(
            employeeRoutes.show.url({
                employee: target.employeeId,
                date: target.date,
            }),
            { signal: controller.signal },
        )
            .then((detail) => {
                const initial = {
                    status: isSettable(detail.status) ? detail.status : '',
                    check_in: toTimeInput(detail.check_in),
                    check_out: toTimeInput(detail.check_out),
                    reason: '',
                } as const;

                setLoad({ state: 'ready', detail });
                form.setDefaults(initial);
                form.setData(initial);
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) {
                    return;
                }

                setLoad({
                    state: 'error',
                    message:
                        error instanceof HttpRequestError &&
                        error.status === 404
                            ? 'Data pegawai atau tanggal ini tidak ditemukan.'
                            : 'Detail absensi gagal dimuat. Periksa koneksi lalu coba lagi.',
                });
            });

        return () => controller.abort();
        // form helpers are stable enough; refetch only for a new target/attempt.
    }, [key, attempt]); // oxlint-disable-line react-hooks/exhaustive-deps

    const url = target
        ? employeeRoutes.update.url({
              employee: target.employeeId,
              date: target.date,
          })
        : '';
    const attended = isAttended(form.data.status || null);

    const save = () => {
        if (!target) {
            return;
        }

        form.transform((data) => ({
            status: data.status,
            check_in: attended && data.check_in ? data.check_in : null,
            check_out: attended && data.check_out ? data.check_out : null,
            reason: data.reason.trim(),
        }));
        form.put(url, {
            preserveScroll: true,
            preserveState: true,
            only: reload,
            onSuccess: () => onDone(),
        });
    };

    const clear = () => {
        if (!target) {
            return;
        }

        form.transform((data) => ({ reason: data.reason.trim() }));
        form.delete(url, {
            preserveScroll: true,
            preserveState: true,
            only: reload,
            onSuccess: () => onDone(),
        });
    };

    return {
        load,
        form,
        attended,
        save,
        clear,
        retry: () => setAttempt((value) => value + 1),
    };
}
