import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage, fieldErrors, meetingsApi } from './api';
import {
    addDays,
    firstName,
    minutesProblems,
    officeDate,
    personById,
} from './lib';
import { useNow } from './meetings-context';
import type { ActionItem, Minutes, MinutesProps } from './types';

const AUTOSAVE_MS = 900;
const ITEM_SAVE_MS = 700;

type ItemPatch = Partial<
    Pick<ActionItem, 'text' | 'assignee_id' | 'due_date' | 'done'>
>;

/**
 * Minutes of one meeting occurrence (DNotulen / MNotulen), shared by the
 * desktop and phone layouts. Content edits autosave (debounced PUT, a new
 * version at most every five minutes per person on the server); follow-ups
 * are saved one by one, optimistically with rollback; "Finalkan & bagikan"
 * locks the minutes and notifies the participants.
 */
export function useMinutes(props: MinutesProps) {
    const now = useNow();
    const today = officeDate(now);
    const meeting = props.meeting;
    const me = props.viewer_id;
    const date = meeting.recurrence === 'none' ? null : meeting.occurrence_date;
    const [minutes, setMinutes] = useState<Minutes>(props.minutes);
    const [saving, setSaving] = useState(false);
    const [unsaved, setUnsaved] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [problems, setProblems] = useState<string[]>([]);
    const [reminded, setReminded] = useState(false);
    const [workspaceId, setWorkspaceId] = useState<string | null>(
        meeting.workspace?.id ?? props.workspaces[0]?.id ?? null,
    );
    const latest = useRef(minutes);
    const timer = useRef<number | null>(null);
    const inflight = useRef<Promise<void> | null>(null);
    const itemTimers = useRef(new Map<string, number>());
    const itemPatches = useRef(new Map<string, ItemPatch>());

    latest.current = minutes;

    useEffect(() => {
        const timers = itemTimers.current;

        return () => {
            if (timer.current) {
                window.clearTimeout(timer.current);
            }

            timers.forEach((id) => window.clearTimeout(id));
        };
    }, []);

    const canEdit = props.can.edit;
    const readOnly = !canEdit || minutes.status === 'final';

    const saveContent = (): Promise<void> => {
        const current = latest.current;
        setSaving(true);

        const request = meetingsApi
            .saveMinutes(meeting.id, date, {
                attendance: current.attendance,
                sections: current.sections,
                decisions: current.decisions,
            })
            .then(({ minutes: saved }) => {
                setUnsaved(false);
                setMinutes((value) => ({
                    ...value,
                    id: saved.id,
                    saved_at: saved.saved_at,
                    version_count: saved.version_count,
                }));
            })
            .catch((error: unknown) => {
                setUnsaved(true);
                toast.error(
                    errorMessage(
                        error,
                        'Notulen belum tersimpan. Periksa koneksi lalu ketik lagi.',
                    ),
                );
            })
            .finally(() => setSaving(false));

        inflight.current = request;

        return request;
    };

    /** Saves the pending autosave now and waits for every save in flight. */
    const flush = async (): Promise<void> => {
        if (timer.current) {
            window.clearTimeout(timer.current);
            timer.current = null;
            await saveContent();
        }

        await inflight.current;

        for (const [id, handle] of itemTimers.current) {
            window.clearTimeout(handle);
            itemTimers.current.delete(id);
            await sendItem(id);
        }
    };

    /** Apply a content edit and schedule the autosave. */
    const edit = (change: (current: Minutes) => Minutes) => {
        if (readOnly) {
            return;
        }

        setMinutes((current) => change(current));
        setUnsaved(true);

        if (timer.current) {
            window.clearTimeout(timer.current);
        }

        timer.current = window.setTimeout(() => {
            timer.current = null;
            void saveContent();
        }, AUTOSAVE_MS);
    };

    const replaceItem = (id: string, item: ActionItem) =>
        setMinutes((current) => ({
            ...current,
            action_items: current.action_items.map((value) =>
                value.id === id ? item : value,
            ),
        }));

    const patchLocal = (id: string, patch: ItemPatch) =>
        setMinutes((current) => ({
            ...current,
            action_items: current.action_items.map((item) =>
                item.id === id ? { ...item, ...patch } : item,
            ),
        }));

    const sendItem = async (id: string): Promise<void> => {
        const patch = itemPatches.current.get(id);
        itemPatches.current.delete(id);

        if (!patch) {
            return;
        }

        const before = latest.current.action_items.find(
            (item) => item.id === id,
        );

        try {
            const { item } = await meetingsApi.updateItem(
                meeting.id,
                id,
                patch,
            );
            // Keep text typed meanwhile; take the rest from the server.
            const local = latest.current.action_items.find(
                (value) => value.id === id,
            );
            replaceItem(id, local ? { ...item, text: local.text } : item);
        } catch (error) {
            if (before) {
                patchLocal(
                    id,
                    Object.fromEntries(
                        Object.keys(patch).map((key) => [
                            key,
                            before[key as keyof ItemPatch],
                        ]),
                    ) as ItemPatch,
                );
            }

            toast.error(
                errorMessage(error, 'Tindak lanjut gagal disimpan. Coba lagi.'),
            );
        }
    };

    /** Optimistic change of a follow-up; text is debounced, the rest immediate. */
    const updateItem = (id: string, patch: ItemPatch) => {
        if (id.startsWith('tmp-')) {
            return;
        }

        patchLocal(id, patch);
        itemPatches.current.set(id, {
            ...itemPatches.current.get(id),
            ...patch,
        });

        const existing = itemTimers.current.get(id);

        if (existing) {
            window.clearTimeout(existing);
        }

        const delay = 'text' in patch ? ITEM_SAVE_MS : 0;
        itemTimers.current.set(
            id,
            window.setTimeout(() => {
                itemTimers.current.delete(id);
                void sendItem(id);
            }, delay),
        );
    };

    const addItem = () => {
        if (readOnly) {
            return;
        }

        const tempId = `tmp-${Date.now()}`;
        const draft: ActionItem = {
            id: tempId,
            text: '',
            assignee_id: me,
            due_date: addDays(today, 2),
            task_key: null,
            done: false,
        };

        setMinutes((current) => ({
            ...current,
            action_items: [...current.action_items, draft],
        }));

        meetingsApi
            .addItem(meeting.id, date, {
                text: '',
                assignee_id: draft.assignee_id,
                due_date: draft.due_date,
            })
            .then(({ item }) => replaceItem(tempId, item))
            .catch((error: unknown) => {
                setMinutes((current) => ({
                    ...current,
                    action_items: current.action_items.filter(
                        (value) => value.id !== tempId,
                    ),
                }));
                toast.error(
                    errorMessage(error, 'Butir gagal ditambahkan. Coba lagi.'),
                );
            });
    };

    const removeItem = (id: string) => {
        const before = latest.current.action_items;
        setMinutes((current) => ({
            ...current,
            action_items: current.action_items.filter((item) => item.id !== id),
        }));

        meetingsApi.removeItem(meeting.id, id).catch((error: unknown) => {
            setMinutes((current) => ({ ...current, action_items: before }));
            toast.error(errorMessage(error, 'Butir gagal dihapus. Coba lagi.'));
        });
    };

    const toggleDone = (id: string) => {
        const item = latest.current.action_items.find(
            (value) => value.id === id,
        );

        if (item) {
            updateItem(id, { done: !item.done });
        }
    };

    const makeTasks = async (ids: string[]) => {
        const targets = latest.current.action_items.filter(
            (item) =>
                ids.includes(item.id) &&
                !item.task_key &&
                item.text.trim() !== '' &&
                !item.id.startsWith('tmp-'),
        );

        if (targets.length === 0 || processing) {
            return;
        }

        if (!meeting.workspace && !workspaceId) {
            toast.error('Pilih workspace untuk tugas tindak lanjut.');

            return;
        }

        setProcessing(true);

        try {
            await flush();
            const response = await meetingsApi.makeTasks(
                meeting.id,
                date,
                targets.map((item) => item.id),
                meeting.workspace ? null : workspaceId,
            );
            setMinutes((current) => ({
                ...current,
                action_items: response.minutes.action_items,
            }));
            const keys = response.minutes.action_items
                .filter((item) => targets.some((t) => t.id === item.id))
                .map((item) => item.task_key)
                .filter((key): key is string => Boolean(key));
            toast.success(
                keys.length === 1
                    ? `Tugas ${keys[0]} dibuat dan masuk ke Tugas saya penanggung jawab`
                    : `${keys.length} tugas dibuat: ${keys.join(', ')}`,
            );
        } catch (error) {
            toast.error(errorMessage(error, 'Tugas gagal dibuat. Coba lagi.'));
        } finally {
            setProcessing(false);
        }
    };

    const finalize = async () => {
        const found = minutesProblems(latest.current);
        setProblems(found);

        if (found.length > 0) {
            toast.error('Notulen belum bisa difinalkan', {
                description: found[0],
            });

            return;
        }

        setProcessing(true);

        try {
            await flush();
            const response = await meetingsApi.finalize(meeting.id, date);
            setMinutes(response.minutes);
            setUnsaved(false);
            toast.success(
                'Notulen difinalkan dan dibagikan ke peserta lewat Inbox & email',
            );
        } catch (error) {
            const serverProblems = fieldErrors(error, 'minutes');
            setProblems(serverProblems);
            toast.error(
                serverProblems.length > 0
                    ? 'Notulen belum bisa difinalkan'
                    : errorMessage(
                          error,
                          'Gagal membagikan notulen. Coba lagi.',
                      ),
                serverProblems.length > 0
                    ? { description: serverProblems[0] }
                    : undefined,
            );
        } finally {
            setProcessing(false);
        }
    };

    const reopen = async () => {
        setProcessing(true);

        try {
            const response = await meetingsApi.reopen(meeting.id, date);
            setMinutes(response.minutes);
            toast.success('Notulen dibuka kembali sebagai draf');
        } catch (error) {
            toast.error(
                errorMessage(error, 'Notulen gagal dibuka. Coba lagi.'),
            );
        } finally {
            setProcessing(false);
        }
    };

    const openOwners = [
        ...new Set(
            minutes.action_items
                .filter(
                    (item) => !item.done && !item.task_key && item.assignee_id,
                )
                .map((item) => item.assignee_id as string),
        ),
    ];

    const remind = async () => {
        setProcessing(true);

        try {
            const { reminded: ids } = await meetingsApi.remind(
                meeting.id,
                date,
            );
            setReminded(true);
            toast.success(
                ids.length === 0
                    ? 'Semua penanggung jawab sudah diingatkan hari ini'
                    : `Pengingat terkirim ke ${ids
                          .map((id) =>
                              firstName(
                                  personById(props.people, id)?.name ?? '',
                              ),
                          )
                          .join(' & ')}`,
            );
        } catch (error) {
            toast.error(
                errorMessage(error, 'Pengingat gagal dikirim. Coba lagi.'),
            );
        } finally {
            setProcessing(false);
        }
    };

    return {
        now,
        today,
        me,
        meeting,
        minutes,
        readOnly,
        canEdit,
        canReopen: props.can.reopen,
        canTick: (item: ActionItem) =>
            !item.id.startsWith('tmp-') && (canEdit || item.assignee_id === me),
        saving,
        unsaved,
        problems,
        processing,
        workspaces: props.workspaces,
        workspaceId,
        setWorkspaceId,
        toggleAttendance: (userId: string) =>
            edit((current) => ({
                ...current,
                attendance: current.attendance.map((mark) =>
                    mark.user_id === userId
                        ? { ...mark, present: !mark.present, reason: null }
                        : mark,
                ),
            })),
        updateSection: (index: number, body: string) =>
            edit((current) => ({
                ...current,
                sections: current.sections.map((section, i) =>
                    i === index ? { ...section, body } : section,
                ),
            })),
        addSection: (title: string) =>
            title.trim() &&
            edit((current) => ({
                ...current,
                sections: [
                    ...current.sections,
                    { title: title.trim(), body: '' },
                ],
            })),
        addDecision: (text: string) =>
            text.trim() &&
            edit((current) => ({
                ...current,
                decisions: [...current.decisions, text.trim()],
            })),
        removeDecision: (index: number) =>
            edit((current) => ({
                ...current,
                decisions: current.decisions.filter((_, i) => i !== index),
            })),
        addItem,
        updateItem,
        removeItem,
        toggleDone,
        makeTask: (id: string) => void makeTasks([id]),
        makeAllTasks: () =>
            void makeTasks(latest.current.action_items.map((item) => item.id)),
        finalize: () => void finalize(),
        reopen: () => void reopen(),
        openOwners,
        remind: () => void remind(),
        reminded,
    };
}

export type MinutesData = ReturnType<typeof useMinutes>;
