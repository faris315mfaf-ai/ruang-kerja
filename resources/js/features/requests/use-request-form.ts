import { useForm } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { preview as previewRoute, store, update } from '@/routes/requests';
import type {
    FormCategory,
    FormLeaveType,
    RequestCategory,
    RequestDetail,
    RequestPreview,
} from '@/types/requests';

export type RequestFormInitial = {
    category: RequestCategory;
    leave_type_id?: string;
    start_date?: string;
    end_date?: string;
    date?: string;
    start_time?: string | null;
    end_time?: string | null;
    check_in?: string | null;
    check_out?: string | null;
    half_day?: boolean;
    destination?: string | null;
    substitute_id?: string | null;
    reason?: string;
};

export type RequestFormData = {
    intent: 'submit' | 'draft';
    leave_type_id: string;
    start_date: string;
    end_date: string;
    date: string;
    start_time: string;
    end_time: string;
    check_in: string;
    check_out: string;
    half_day: boolean;
    destination: string;
    substitute_id: string;
    reason: string;
    attachments: File[];
    remove_attachments: number[];
};

type Options = {
    categories: FormCategory[];
    initial: RequestFormInitial;
    request: RequestDetail | null;
    today: string;
};

/** Hourly permit vs whole days. */
export type PermitMode = 'days' | 'hours';

function firstType(
    categories: FormCategory[],
    category: RequestCategory,
): FormLeaveType | undefined {
    const types = categories.find((c) => c.value === category)?.types ?? [];

    return types.find((t) => t.eligible) ?? types[0];
}

/**
 * State, live preview and submission of the request form, shared by the
 * desktop and mobile layouts (docs/PLATFORM.md §5 rule 2).
 */
export function useRequestForm({
    categories,
    initial,
    request,
    today,
}: Options) {
    const [category, setCategoryState] = useState<RequestCategory>(
        categories.some((c) => c.value === initial.category)
            ? initial.category
            : (categories[0]?.value ?? 'leave'),
    );
    const [permitMode, setPermitMode] = useState<PermitMode>(
        initial.start_time ? 'hours' : 'days',
    );

    const form = useForm<RequestFormData>({
        intent: 'submit',
        leave_type_id:
            initial.leave_type_id ?? firstType(categories, category)?.id ?? '',
        start_date: initial.start_date ?? today,
        end_date: initial.end_date ?? today,
        date: initial.date ?? today,
        start_time:
            initial.start_time ?? (category === 'overtime' ? '17:00' : ''),
        end_time: initial.end_time ?? (category === 'overtime' ? '19:00' : ''),
        check_in: initial.check_in ?? '',
        check_out: initial.check_out ?? '',
        half_day: initial.half_day ?? false,
        destination: initial.destination ?? '',
        substitute_id: initial.substitute_id ?? '',
        reason: initial.reason ?? '',
        attachments: [],
        remove_attachments: [],
    });

    const types = useMemo(
        () => categories.find((c) => c.value === category)?.types ?? [],
        [categories, category],
    );
    const type =
        types.find((t) => t.id === form.data.leave_type_id) ?? types[0];

    const setCategory = (next: RequestCategory) => {
        setCategoryState(next);
        const nextType = firstType(categories, next);
        form.setData((data) => ({
            ...data,
            leave_type_id: nextType?.id ?? '',
            half_day: false,
            start_time:
                next === 'overtime'
                    ? '17:00'
                    : next === 'permit' && permitMode === 'hours'
                      ? '13:00'
                      : '',
            end_time:
                next === 'overtime'
                    ? '19:00'
                    : next === 'permit' && permitMode === 'hours'
                      ? '15:00'
                      : '',
        }));
        form.clearErrors();
    };

    const changePermitMode = (mode: PermitMode) => {
        setPermitMode(mode);
        form.setData((data) => ({
            ...data,
            start_time: mode === 'hours' ? '13:00' : '',
            end_time: mode === 'hours' ? '15:00' : '',
        }));
    };

    // Live summary (debounced GET, nothing stored).
    const [preview, setPreview] = useState<RequestPreview | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [previewFailed, setPreviewFailed] = useState(false);
    const controller = useRef<AbortController | null>(null);

    const usesHours =
        category === 'overtime' ||
        (category === 'permit' && permitMode === 'hours');
    const query = useMemo(() => {
        const params: Record<string, string> = {
            leave_type_id: form.data.leave_type_id,
        };

        if (category === 'correction') {
            Object.assign(params, {
                date: form.data.date,
                check_in: form.data.check_in,
                check_out: form.data.check_out,
            });
        } else if (usesHours) {
            Object.assign(params, {
                date: form.data.date,
                start_time: form.data.start_time,
                end_time: form.data.end_time,
            });
        } else {
            Object.assign(params, {
                start_date: form.data.start_date,
                end_date: form.data.end_date,
                half_day: form.data.half_day ? '1' : '0',
                destination: form.data.destination,
            });
        }

        if (request) {
            params.request_id = request.id;
        }

        return params;
    }, [
        category,
        usesHours,
        request,
        form.data.leave_type_id,
        form.data.date,
        form.data.check_in,
        form.data.check_out,
        form.data.start_time,
        form.data.end_time,
        form.data.start_date,
        form.data.end_date,
        form.data.half_day,
        form.data.destination,
    ]);

    useEffect(() => {
        if (!query.leave_type_id) {
            return;
        }

        const timer = window.setTimeout(() => {
            controller.current?.abort();
            const abort = new AbortController();
            controller.current = abort;
            setPreviewing(true);

            fetch(previewRoute.url({ query }), {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                signal: abort.signal,
            })
                .then((response) =>
                    response.ok
                        ? (response.json() as Promise<RequestPreview>)
                        : Promise.reject(new Error(String(response.status))),
                )
                .then((data) => {
                    setPreview(data);
                    setPreviewFailed(false);
                })
                .catch((error: unknown) => {
                    if (
                        !(
                            error instanceof DOMException &&
                            error.name === 'AbortError'
                        )
                    ) {
                        setPreviewFailed(true);
                    }
                })
                .finally(() => {
                    if (controller.current === abort) {
                        setPreviewing(false);
                    }
                });
        }, 300);

        return () => window.clearTimeout(timer);
    }, [query]);

    useEffect(() => () => controller.current?.abort(), []);

    const submit = (intent: 'submit' | 'draft') => {
        form.transform((data) => {
            const payload: Partial<RequestFormData> & {
                intent: 'submit' | 'draft';
            } = {
                ...data,
                intent,
                // Fields of other categories are not sent.
                start_time: usesHours ? data.start_time : '',
                end_time: usesHours ? data.end_time : '',
            };

            if (category !== 'leave') {
                payload.substitute_id = '';
            }

            return payload;
        });

        const url = request
            ? update.url({ employeeRequest: request.id })
            : store.url();
        form.post(url, { forceFormData: true, preserveScroll: true });
    };

    const existingAttachments = (request?.attachments ?? []).filter(
        (file) => !form.data.remove_attachments.includes(file.index),
    );

    return {
        form,
        category,
        setCategory,
        types,
        type,
        permitMode,
        changePermitMode,
        usesHours,
        preview,
        previewing,
        previewFailed,
        submit,
        existingAttachments,
        removeExisting: (index: number) =>
            form.setData('remove_attachments', [
                ...form.data.remove_attachments,
                index,
            ]),
        addFiles: (files: FileList | File[]) =>
            form.setData('attachments', [
                ...form.data.attachments,
                ...Array.from(files),
            ]),
        removeFile: (index: number) =>
            form.setData(
                'attachments',
                form.data.attachments.filter((_, i) => i !== index),
            ),
    };
}

export type RequestFormState = ReturnType<typeof useRequestForm>;
