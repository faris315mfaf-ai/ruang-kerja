import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/features/tasks/lib/api';
import { notulenApi } from './api';
import { shouldPoll } from './lib';
import type { DraftAction, NotulenSummary } from './types';

const POLL_MS = 20_000;

function message(error: unknown, fallback: string): string {
    return error instanceof ApiError ? error.message : fallback;
}

/**
 * Notulen otomatis state of one occurrence: the summary (polled while the
 * worker or the summarizer is busy) and the actions of the contract
 * (auto_minutes, opt-out, insert, discard, re-run, suggestion → task).
 * `initial` = Inertia prop; `statusUrl` loads it when the page has none.
 */
export function useNotulen(
    initial: NotulenSummary | null,
    statusUrl?: string | null,
) {
    const [summary, setSummary] = useState<NotulenSummary | null>(initial);
    const [busy, setBusy] = useState<string | null>(null);
    const [loadError, setLoadError] = useState(false);

    const refresh = useCallback(async () => {
        const url = summary?.links.status ?? statusUrl;

        if (!url) {
            return;
        }

        try {
            const fresh = await notulenApi.status({
                links: { status: url },
            } as NotulenSummary);
            setSummary(fresh);
            setLoadError(false);
        } catch {
            setLoadError(true);
        }
    }, [summary?.links.status, statusUrl]);

    useEffect(() => {
        if (!initial && statusUrl) {
            void refresh();
        }
        // Load once per occurrence.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusUrl]);

    useEffect(() => {
        if (!shouldPoll(summary)) {
            return;
        }

        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                void refresh();
            }
        }, POLL_MS);

        return () => window.clearInterval(timer);
    }, [summary, refresh]);

    const run = async <T>(
        key: string,
        action: (current: NotulenSummary) => Promise<T>,
        fallback: string,
    ): Promise<T | null> => {
        if (!summary || busy) {
            return null;
        }

        setBusy(key);

        try {
            return await action(summary);
        } catch (error) {
            toast.error(message(error, fallback));

            return null;
        } finally {
            setBusy(null);
        }
    };

    return {
        summary,
        busy,
        loadError,
        refresh,

        setAutoMinutes: (enabled: boolean) =>
            run(
                'auto',
                async (s) => {
                    setSummary(await notulenApi.setAutoMinutes(s, enabled));
                    toast.success(
                        enabled
                            ? 'Notulen otomatis dinyalakan untuk rapat ini.'
                            : 'Notulen otomatis dimatikan.',
                    );
                },
                'Pengaturan gagal disimpan. Coba lagi.',
            ),

        /** Private opt-out: the server relays it to the recorder. */
        setOptOut: (optedOut: boolean) =>
            run(
                'consent',
                async (s) => {
                    const result = await notulenApi.setOptOut(s, optedOut);
                    setSummary({
                        ...s,
                        consent: { ...s.consent, opted_out: result.opted_out },
                    });
                    toast.success(
                        optedOut
                            ? 'Suara Anda tidak akan ditranskrip.'
                            : 'Suara Anda ikut ditranskrip.',
                    );

                    return result.opted_out;
                },
                'Pilihan gagal disimpan. Coba lagi.',
            ),

        insert: () =>
            run(
                'insert',
                async (s) => {
                    const result = await notulenApi.insert(s);
                    toast.success('Draf dimasukkan ke notulen.');
                    setSummary(await notulenApi.status(s));

                    return result;
                },
                'Draf gagal dimasukkan. Coba lagi.',
            ),

        discard: () =>
            run(
                'discard',
                async (s) => {
                    setSummary(await notulenApi.discard(s));
                    toast.success('Draf dibuang. Transkrip tetap tersimpan.');
                },
                'Draf gagal dibuang. Coba lagi.',
            ),

        resummarize: () =>
            run(
                'resummarize',
                async (s) => {
                    setSummary(await notulenApi.resummarize(s));
                    toast.success('Draf baru sedang disusun.');
                },
                'Ringkasan gagal dimulai. Coba lagi.',
            ),

        toTask: (action: DraftAction, workspaceId?: string | null) =>
            run(
                `task:${action.id}`,
                async (s) => {
                    const result = await notulenApi.task(
                        s,
                        action.id,
                        workspaceId,
                    );
                    setSummary({
                        ...s,
                        draft: s.draft && {
                            ...s.draft,
                            tindak_lanjut: s.draft.tindak_lanjut.map((item) =>
                                item.id === action.id
                                    ? result.suggestion
                                    : item,
                            ),
                        },
                    });
                    toast.success(
                        result.task
                            ? `Tugas ${result.task.key} dibuat.`
                            : 'Tindak lanjut ditambahkan.',
                    );

                    return result;
                },
                'Tugas gagal dibuat. Coba lagi.',
            ),
    };
}

export type NotulenState = ReturnType<typeof useNotulen>;
