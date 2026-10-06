import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { HttpRequestError, requestJson } from '@/lib/http';
import { moveNote, openIds, orderNotes, toggleNote } from './lib';
import type { ActionNote } from './types';

const BASE = '/catatan-tindakan';

function message(error: unknown, fallback: string): string {
    if (error instanceof HttpRequestError && error.status === 422) {
        const body = error.body as {
            errors?: Record<string, string[]>;
        } | null;
        const first = body?.errors ? Object.values(body.errors)[0]?.[0] : null;

        if (first) {
            return first;
        }
    }

    return fallback;
}

/**
 * "Catatan tindakan" state: optimistic changes, saved through the JSON
 * endpoints, rolled back with a toast when the server refuses. New props
 * (an Inertia reload) replace the local copy.
 */
export function useActionNotes(initial: ActionNote[], today: string) {
    const [notes, setNotes] = useState<ActionNote[]>(() => orderNotes(initial));
    const latest = useRef(notes);
    latest.current = notes;

    useEffect(() => {
        setNotes(orderNotes(initial));
    }, [initial]);

    /** Applies `next` now and reverts to the previous list if `save` fails. */
    const optimistic = async (
        next: ActionNote[],
        save: () => Promise<unknown>,
        fallback: string,
    ): Promise<boolean> => {
        const previous = latest.current;
        setNotes(next);

        try {
            await save();

            return true;
        } catch (error) {
            setNotes(previous);
            toast.error(message(error, fallback));

            return false;
        }
    };

    const add = async (
        body: string,
        dueOn: string | null,
    ): Promise<boolean> => {
        try {
            const { note } = await requestJson<{ note: ActionNote }>(BASE, {
                method: 'POST',
                body: { body, due_on: dueOn },
            });
            setNotes((current) => [note, ...current]);

            return true;
        } catch (error) {
            toast.error(message(error, 'Catatan gagal disimpan. Coba lagi.'));

            return false;
        }
    };

    const update = (
        id: string,
        changes: { body?: string; due_on?: string | null },
    ) => {
        const next = latest.current.map((note) => {
            if (note.id !== id) {
                return note;
            }

            const due =
                'due_on' in changes ? (changes.due_on ?? null) : note.due_on;

            return {
                ...note,
                ...changes,
                due_on: due,
                overdue: !note.done && due !== null && due < today,
            };
        });

        return optimistic(
            next,
            () =>
                requestJson(`${BASE}/${id}`, {
                    method: 'PATCH',
                    body: changes,
                }),
            'Catatan gagal diubah.',
        );
    };

    const toggle = (id: string, done: boolean) =>
        optimistic(
            toggleNote(
                latest.current,
                id,
                done,
                new Date().toISOString(),
                today,
            ),
            () =>
                requestJson(`${BASE}/${id}`, {
                    method: 'PATCH',
                    body: { done },
                }),
            'Status catatan gagal disimpan.',
        );

    const remove = (id: string) =>
        optimistic(
            latest.current.filter((note) => note.id !== id),
            () => requestJson(`${BASE}/${id}`, { method: 'DELETE' }),
            'Catatan gagal dihapus.',
        );

    const move = (id: string, direction: -1 | 1) => {
        const next = moveNote(latest.current, id, direction);

        if (next === latest.current) {
            return Promise.resolve(false);
        }

        return optimistic(
            next,
            () =>
                requestJson(`${BASE}/urutan`, {
                    method: 'PUT',
                    body: { ids: openIds(next) },
                }),
            'Urutan catatan gagal disimpan.',
        );
    };

    return { notes, add, update, toggle, remove, move };
}
