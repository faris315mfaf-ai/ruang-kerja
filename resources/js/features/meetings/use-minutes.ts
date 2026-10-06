import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { ME, MEETINGS, MINUTES, PEOPLE } from './fixtures';
import {
    addDays,
    blankMinutes,
    convertToTasks,
    firstName,
    minutesProblems,
    officeDate,
    personById,
} from './lib';
import type { ActionItem, Minutes } from './types';
import { useDemoClock, usePreviewState } from './use-preview';

const AUTOSAVE_MS = 900;

/**
 * Editable minutes of one meeting (DNotulen / MNotulen), shared by the
 * desktop and phone layouts. Edits autosave (simulated) into a new version;
 * "Finalkan & bagikan" locks them and shares with the participants.
 */
export function useMinutes(meetingId: string) {
    const { state, query } = usePreviewState();
    const now = useDemoClock();
    const forceFinal = new URLSearchParams(query).get('final') === '1';
    const today = officeDate(now);
    const meeting =
        state === 'kosong'
            ? null
            : (MEETINGS.find((item) => item.id === meetingId) ?? null);
    const [minutes, setMinutes] = useState<Minutes | null>(() => {
        if (!meeting) {
            return null;
        }

        const record = structuredClone(
            MINUTES.find((item) => item.meeting_id === meeting.id) ??
                blankMinutes(meeting, new Date(now).toISOString()),
        );

        return forceFinal ? { ...record, status: 'final' } : record;
    });
    const [saving, setSaving] = useState(false);
    const [problems, setProblems] = useState<string[]>([]);
    const [reminded, setReminded] = useState(false);
    const timer = useRef<number | null>(null);
    const mutation = useFakeMutation();

    useEffect(
        () => () => {
            if (timer.current) {
                window.clearTimeout(timer.current);
            }
        },
        [],
    );

    const readOnly = !minutes || minutes.status === 'final';

    /** Apply an edit and schedule the simulated autosave. */
    const edit = (change: (current: Minutes) => Minutes) => {
        if (readOnly) {
            return;
        }

        setMinutes((current) => (current ? change(current) : current));
        setSaving(true);

        if (timer.current) {
            window.clearTimeout(timer.current);
        }

        timer.current = window.setTimeout(() => {
            setSaving(false);
            setMinutes((current) =>
                current
                    ? {
                          ...current,
                          saved_at: new Date().toISOString(),
                          version_count: current.version_count + 1,
                      }
                    : current,
            );
        }, AUTOSAVE_MS);
    };

    const updateItem = (id: string, patch: Partial<ActionItem>) =>
        edit((current) => ({
            ...current,
            action_items: current.action_items.map((item) =>
                item.id === id ? { ...item, ...patch } : item,
            ),
        }));

    const makeTasks = (ids: string[]) => {
        if (!minutes) {
            return;
        }

        const result = convertToTasks(
            minutes.action_items,
            ids,
            minutes.task_prefix,
            minutes.next_task_number,
        );

        if (result.created.length === 0) {
            return;
        }

        void mutation.run(
            () =>
                setMinutes((current) =>
                    current
                        ? {
                              ...current,
                              action_items: result.items,
                              next_task_number: result.nextNumber,
                          }
                        : current,
                ),
            {
                delay: 400,
                success:
                    result.created.length === 1
                        ? `Tugas ${result.created[0]} dibuat dan masuk ke Tugas saya penanggung jawab`
                        : `${result.created.length} tugas dibuat: ${result.created.join(', ')}`,
            },
        );
    };

    const finalize = () => {
        if (!minutes) {
            return;
        }

        const found = minutesProblems(minutes);
        setProblems(found);

        if (found.length > 0) {
            toast.error('Notulen belum bisa difinalkan', {
                description: found[0],
            });

            return;
        }

        const count = minutes.attendance.length;

        void mutation.run(
            () => {
                if (timer.current) {
                    window.clearTimeout(timer.current);
                }

                setSaving(false);
                setMinutes((current) =>
                    current
                        ? {
                              ...current,
                              status: 'final',
                              saved_at: new Date().toISOString(),
                              version_count: current.version_count + 1,
                          }
                        : current,
                );
            },
            {
                success: `Notulen difinalkan dan dibagikan ke ${count} peserta lewat Inbox & email`,
                fail: state === 'galat',
                error: 'Gagal membagikan notulen. Coba lagi sebentar.',
            },
        );
    };

    const reopen = () =>
        setMinutes((current) =>
            current ? { ...current, status: 'draft' } : current,
        );

    const openOwners = minutes
        ? [
              ...new Set(
                  minutes.action_items
                      .filter((item) => !item.done)
                      .map((item) => item.assignee_id),
              ),
          ]
        : [];

    const remind = () =>
        mutation.run(() => setReminded(true), {
            success: `Pengingat terkirim ke ${openOwners.map((id) => firstName(personById(PEOPLE, id)?.name ?? id)).join(' & ')}`,
        });

    return {
        state,
        now,
        today,
        meeting,
        minutes,
        readOnly,
        saving,
        problems,
        processing: mutation.processing,
        canEdit: Boolean(
            meeting &&
            (meeting.minute_taker_id === ME || meeting.organizer_id === ME),
        ),
        toggleAttendance: (userId: string) =>
            edit((current) => ({
                ...current,
                attendance: current.attendance.map((mark) =>
                    mark.user_id === userId
                        ? { ...mark, present: !mark.present, reason: undefined }
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
        addItem: () =>
            edit((current) => ({
                ...current,
                action_items: [
                    ...current.action_items,
                    {
                        id: `new-${Date.now()}`,
                        text: '',
                        assignee_id: ME,
                        due_date: addDays(today, 2),
                        task_key: null,
                        done: false,
                    },
                ],
            })),
        updateItem,
        removeItem: (id: string) =>
            edit((current) => ({
                ...current,
                action_items: current.action_items.filter(
                    (item) => item.id !== id,
                ),
            })),
        toggleDone: (id: string) =>
            setMinutes((current) =>
                current
                    ? {
                          ...current,
                          action_items: current.action_items.map((item) =>
                              item.id === id
                                  ? { ...item, done: !item.done }
                                  : item,
                          ),
                      }
                    : current,
            ),
        makeTask: (id: string) => makeTasks([id]),
        makeAllTasks: () =>
            minutes && makeTasks(minutes.action_items.map((item) => item.id)),
        finalize,
        reopen,
        exportDocs: () =>
            mutation.run(() => {}, {
                delay: 500,
                success: 'Notulen diekspor ke Google Docs di folder workspace',
            }),
        openOwners,
        remind,
        reminded,
    };
}

export type MinutesData = ReturnType<typeof useMinutes>;
