import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useEffect, useSyncExternalStore } from 'react';
import type { Person } from '../types';

type Entry = {
    count: number;
    members: Person[];
    listeners: Set<() => void>;
};

const channels = new Map<string, Entry>();
const EMPTY: Person[] = [];

function entryFor(taskId: string): Entry {
    let entry = channels.get(taskId);

    if (!entry) {
        entry = { count: 0, members: EMPTY, listeners: new Set() };
        channels.set(taskId, entry);
    }

    return entry;
}

function publish(entry: Entry, members: Person[]): void {
    entry.members = members;
    entry.listeners.forEach((listener) => listener());
}

function join(taskId: string): () => void {
    const entry = entryFor(taskId);
    entry.count++;

    if (entry.count === 1 && echoIsConfigured()) {
        try {
            echo()
                .join(`task.${taskId}`)
                .here((members: Person[]) => publish(entry, members))
                .joining((member: Person) =>
                    publish(entry, [
                        ...entry.members.filter((m) => m.id !== member.id),
                        member,
                    ]),
                )
                .leaving((member: Person) =>
                    publish(
                        entry,
                        entry.members.filter((m) => m.id !== member.id),
                    ),
                );
        } catch {
            // No WebSocket: nobody is shown as viewing.
        }
    }

    return () => {
        entry.count--;

        if (entry.count <= 0) {
            channels.delete(taskId);

            try {
                if (echoIsConfigured()) {
                    echo().leave(`task.${taskId}`);
                }
            } catch {
                // Already disconnected.
            }
        }
    };
}

/**
 * People (other than the viewer) who have this task open right now, from
 * the presence channel `presence-task.{id}` ("Sari sedang melihat").
 * Mounting several times for the same task shares one subscription.
 */
export function useTaskPresence(
    taskId: string | null | undefined,
    viewerId: string | null | undefined,
): Person[] {
    useEffect(() => (taskId ? join(taskId) : undefined), [taskId]);

    const members = useSyncExternalStore(
        (listener) => {
            if (!taskId) {
                return () => {};
            }

            const entry = entryFor(taskId);
            entry.listeners.add(listener);

            return () => entry.listeners.delete(listener);
        },
        () => (taskId ? (channels.get(taskId)?.members ?? EMPTY) : EMPTY),
        () => EMPTY,
    );

    return othersThan(members, viewerId);
}

const filtered = new WeakMap<Person[], Map<string, Person[]>>();

/** Stable filtered list (same input → same array) for React rendering. */
export function othersThan(
    members: Person[],
    viewerId: string | null | undefined,
): Person[] {
    const key = viewerId ?? '';
    const cache = filtered.get(members) ?? new Map<string, Person[]>();
    filtered.set(members, cache);
    const hit = cache.get(key);

    if (hit) {
        return hit;
    }

    const others = members.filter((member) => member.id !== viewerId);
    cache.set(key, others);

    return others;
}

/** "Sari sedang melihat", "Sari dan Rizky sedang melihat", "Sari +2 sedang melihat". */
export function presenceLabel(people: Person[]): string | null {
    if (people.length === 0) {
        return null;
    }

    const first = people[0].name.split(' ')[0];

    if (people.length === 1) {
        return `${first} sedang melihat`;
    }

    if (people.length === 2) {
        return `${first} dan ${people[1].name.split(' ')[0]} sedang melihat`;
    }

    return `${first} +${people.length - 1} sedang melihat`;
}
