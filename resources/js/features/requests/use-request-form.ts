import { useForm, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { preview as previewRoute, store, update } from '@/routes/requests';
import type {
    FormCategory,
    FormLeaveType,
    RequestCategory,
    RequestDetail,
    RequestPreview,
} from '@/types/requests';
import {
    clearDraft,
    clearFormDrafts,
    deviceStorage,
    differsFrom,
    draftKey,
    loadDraft,
    pickDraftFields,
    saveDraft,
} from './draft-storage';
import type { StoredDraft, StoredDraftFields } from './draft-storage';
import { categoryLocked, firstOpenType } from './locks';

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
    remove_attachments: string[];
};

type Options = {
    categories: FormCategory[];
    initial: RequestFormInitial;
    request: RequestDetail | null;
    today: string;
};

/** Hourly permit vs whole days. */
export type PermitMode = 'days' | 'hours';

/** Debounce of the device autosave (ms). */
export const AUTOSAVE_DELAY = 500;

function firstType(
    categories: FormCategory[],
    category: RequestCategory,
): FormLeaveType | undefined {
    return firstOpenType(
        categories.find((c) => c.value === category)?.types ?? [],
    );
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
    // An edited request keeps its category even when locked (its draft can
    // then only be canceled); a new one never starts on a locked category.
    const [category, setCategoryState] = useState<RequestCategory>(
        categories.some(
            (c) =>
                c.value === initial.category &&
                (request !== null || !categoryLocked(c)),
        )
            ? initial.category
            : (categories.find((c) => !categoryLocked(c))?.value ??
                  categories[0]?.value ??
                  'leave'),
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

    // Device autosave (localStorage) of the unsent form, per user + category.
    // `baseline` = the untouched starting values of the current category; only
    // changes from it are stored, so merely opening or switching categories
    // saves nothing.
    const userId = usePage().props.auth.user?.id ?? null;
    const requestId = request?.id ?? null;
    const [restored, setRestored] = useState<StoredDraft | null>(null);
    const baseline = useRef<StoredDraftFields>(pickDraftFields(form.data));
    const { setData, reset, clearErrors } = form;

    const keyFor = useCallback(
        (value: RequestCategory) =>
            userId === null ? null : draftKey(userId, value, requestId),
        [userId, requestId],
    );

    const restoreDraft = useCallback(
        (value: RequestCategory, current: RequestFormData) => {
            const key = keyFor(value);
            const draft = key === null ? null : loadDraft(deviceStorage(), key);

            if (!draft || !differsFrom(draft.fields, current)) {
                setRestored(null);

                return;
            }

            const known =
                categories
                    .find((c) => c.value === value)
                    ?.types.some((t) => t.id === draft.fields.leave_type_id) ??
                false;

            setPermitMode(draft.permitMode);
            setData({
                ...current,
                ...draft.fields,
                leave_type_id: known
                    ? draft.fields.leave_type_id
                    : current.leave_type_id,
            });
            setRestored(draft);
        },
        [categories, keyFor, setData],
    );

    // Restore once on open (the initial category); category switches restore in setCategory.
    const initialData = useRef(form.data);
    const initialCategory = useRef(category);
    const restoredOnce = useRef(false);
    useEffect(() => {
        if (restoredOnce.current) {
            return;
        }

        restoredOnce.current = true;
        restoreDraft(initialCategory.current, initialData.current);
    }, [restoreDraft]);

    // Saved on the server as a new draft (same page, new request id): what is
    // on screen now is the server state, not an unsent change.
    const lastRequestId = useRef(requestId);
    useEffect(() => {
        if (lastRequestId.current !== requestId) {
            lastRequestId.current = requestId;
            baseline.current = pickDraftFields(form.data);
        }
    }, [requestId, form.data]);

    // Debounced autosave of what the user typed (never attachments).
    useEffect(() => {
        const key = keyFor(category);

        if (key === null) {
            return;
        }

        const timer = window.setTimeout(() => {
            if (differsFrom(pickDraftFields(form.data), baseline.current)) {
                saveDraft(deviceStorage(), key, form.data, permitMode);
            } else {
                clearDraft(deviceStorage(), key);
            }
        }, AUTOSAVE_DELAY);

        return () => window.clearTimeout(timer);
    }, [form.data, category, permitMode, keyFor]);

    /** Forget every device draft of this form (sent, saved on the server, discarded). */
    const forgetDeviceDrafts = useCallback(() => {
        if (userId !== null) {
            clearFormDrafts(deviceStorage(), userId, requestId);
        }

        setRestored(null);
    }, [userId, requestId]);

    /** "Buang": drop the device copy and go back to the form's starting values. */
    const discardDeviceDraft = () => {
        forgetDeviceDrafts();
        setCategoryState(initialCategory.current);
        setPermitMode(initial.start_time ? 'hours' : 'days');
        baseline.current = pickDraftFields(initialData.current);
        reset();
        clearErrors();
    };

    const types = useMemo(
        () => categories.find((c) => c.value === category)?.types ?? [],
        [categories, category],
    );
    const type =
        types.find((t) => t.id === form.data.leave_type_id) ?? types[0];

    const setCategory = (next: RequestCategory) => {
        const target = categories.find((c) => c.value === next);

        if (!target || categoryLocked(target)) {
            return;
        }

        setCategoryState(next);
        const nextType = firstType(categories, next);
        const nextData: RequestFormData = {
            ...form.data,
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
        };
        // Untouched defaults of that category (text carried over from the
        // previous category still counts as a change worth keeping).
        baseline.current = pickDraftFields({
            ...initialData.current,
            leave_type_id: nextData.leave_type_id,
            half_day: false,
            start_time: nextData.start_time,
            end_time: nextData.end_time,
        });
        setData(nextData);
        clearErrors();

        // A device draft of the other category is offered back too.
        restoreDraft(next, nextData);
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
        form.post(url, {
            forceFormData: true,
            preserveScroll: true,
            // Sent or saved on the server: the device copy is no longer needed.
            onSuccess: () => forgetDeviceDrafts(),
        });
    };

    const existingAttachments = (request?.attachments ?? []).filter(
        (file) => !form.data.remove_attachments.includes(file.id),
    );

    return {
        form,
        category,
        setCategory,
        types,
        type,
        /** The chosen type is locked: nothing can be sent or saved. */
        locked: type?.locked === true,
        permitMode,
        changePermitMode,
        usesHours,
        preview,
        previewing,
        previewFailed,
        submit,
        restoredDraft: restored,
        discardDeviceDraft,
        existingAttachments,
        removeExisting: (id: string) =>
            form.setData('remove_attachments', [
                ...form.data.remove_attachments,
                id,
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
