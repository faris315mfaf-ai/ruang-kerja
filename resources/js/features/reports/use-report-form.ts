import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { HttpRequestError, requestJson } from '@/lib/http';
import { emptyRow, formFromReport, reportPayload, submitProblems } from './lib';
import type {
    DailyReportData,
    ReportFormItem,
    ReportFormState,
    ReportTaskOption,
} from './types';

/** Debounce of the draft autosave (ms). */
export const REPORT_AUTOSAVE_DELAY = 1200;

type Options = {
    report: DailyReportData;
    suggestions: ReportTaskOption[];
    chosen: ReportTaskOption[];
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function errorsOf(error: unknown): Record<string, string> {
    if (
        error instanceof HttpRequestError &&
        error.status === 422 &&
        typeof error.body === 'object' &&
        error.body !== null &&
        'errors' in error.body
    ) {
        const errors = (error.body as { errors: Record<string, string[]> })
            .errors;

        return Object.fromEntries(
            Object.entries(errors).map(([key, messages]) => [
                key,
                messages[0] ?? '',
            ]),
        );
    }

    return {};
}

/**
 * State of the daily report form (shared by desktop & phone): rows, autosave
 * of the draft (PUT, debounced), "Kirim" (POST) and the task options.
 */
export function useReportForm({
    report: initial,
    suggestions,
    chosen,
}: Options) {
    const [report, setReport] = useState<DailyReportData>(initial);
    const [form, setForm] = useState<ReportFormState>(() =>
        formFromReport(initial),
    );
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const [savedAt, setSavedAt] = useState<string | null>(initial.updated_at);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [locked, setLocked] = useState(!initial.editable);
    const dirty = useRef(false);
    const latest = useRef(form);
    latest.current = form;

    // Every task option seen (suggestions, already chosen, search results).
    const [extra, setExtra] = useState<ReportTaskOption[]>([]);
    const options = useMemo(() => {
        const map = new Map<string, ReportTaskOption>();

        for (const option of [...chosen, ...suggestions, ...extra]) {
            map.set(option.id, option);
        }

        return map;
    }, [chosen, suggestions, extra]);

    const update = useCallback(
        (change: (state: ReportFormState) => ReportFormState) => {
            dirty.current = true;
            setForm((state) => change(state));
        },
        [],
    );

    const handleError = useCallback((error: unknown, fallback: string) => {
        const found = errorsOf(error);

        if (found.report_date) {
            setLocked(true);
        }

        setErrors(found);

        if (Object.keys(found).length === 0) {
            toast.error(fallback);
        }
    }, []);

    const save = useCallback(async () => {
        if (!dirty.current || locked) {
            return;
        }

        dirty.current = false;
        setSaveState('saving');

        try {
            const response = await requestJson<{ report: DailyReportData }>(
                '/laporan/hari-ini',
                {
                    method: 'PUT',
                    body: reportPayload(report.date, latest.current),
                },
            );
            setReport(response.report);
            setSavedAt(response.report.updated_at);
            setErrors({});
            setSaveState('saved');
        } catch (error) {
            dirty.current = true;
            setSaveState('error');
            handleError(error, 'Draf gagal disimpan. Periksa koneksi Anda.');
        }
    }, [locked, report.date, handleError]);

    // Debounced autosave after each change.
    useEffect(() => {
        if (!dirty.current) {
            return;
        }

        const timer = window.setTimeout(() => {
            void save();
        }, REPORT_AUTOSAVE_DELAY);

        return () => window.clearTimeout(timer);
    }, [form, save]);

    const submit = async () => {
        const problems = submitProblems(form);

        if (problems.length > 0) {
            setErrors({ items: problems[0] });
            toast.error(problems[0]);

            return;
        }

        setSubmitting(true);
        dirty.current = false;

        try {
            const response = await requestJson<{
                report: DailyReportData;
                message: string;
            }>('/laporan/hari-ini/kirim', {
                method: 'POST',
                body: reportPayload(report.date, form),
            });
            setReport(response.report);
            setSavedAt(response.report.updated_at);
            setErrors({});
            setSaveState('saved');
            toast.success(response.message);
        } catch (error) {
            dirty.current = true;
            handleError(error, 'Laporan gagal dikirim. Coba lagi.');
        } finally {
            setSubmitting(false);
        }
    };

    const addTask = (option: ReportTaskOption) => {
        setExtra((list) =>
            list.some((item) => item.id === option.id)
                ? list
                : [...list, option],
        );
        update((state) =>
            state.items.some((item) => item.task_id === option.id)
                ? state
                : { ...state, items: [...state.items, emptyRow(option.id)] },
        );
    };

    const addOther = () =>
        update((state) => ({ ...state, items: [...state.items, emptyRow()] }));

    const changeItem = (key: string, change: Partial<ReportFormItem>) =>
        update((state) => ({
            ...state,
            items: state.items.map((item) =>
                item.key === key ? { ...item, ...change } : item,
            ),
        }));

    const removeItem = (key: string) =>
        update((state) => ({
            ...state,
            items: state.items.filter((item) => item.key !== key),
        }));

    const setText = (field: 'summary' | 'blockers' | 'notes', value: string) =>
        update((state) => ({ ...state, [field]: value }));

    return {
        report,
        form,
        options,
        errors,
        saveState,
        savedAt,
        submitting,
        locked,
        addTask,
        addOther,
        changeItem,
        removeItem,
        setText,
        submit,
        saveNow: save,
        rememberOptions: (found: ReportTaskOption[]) =>
            setExtra((list) => [
                ...list,
                ...found.filter(
                    (option) => !list.some((item) => item.id === option.id),
                ),
            ]),
    };
}

export type ReportFormApi = ReturnType<typeof useReportForm>;
