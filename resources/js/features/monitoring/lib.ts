import type {
    ActionNote,
    DayState,
    DirectoryWorkspace,
    MonitoredProject,
    WorkspaceKind,
} from './types';

/** "2026-10-05" ± days, calendar arithmetic in UTC (no timezone drift). */
export function shiftDate(date: string, days: number): string {
    const [year, month, day] = date.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + days));

    return next.toISOString().slice(0, 10);
}

/** Share in percent (0–100), 0 when nothing to divide. */
export function percentOf(part: number, total: number): number {
    return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** Label and tone of a day cell in the weekly matrix. */
export const DAY_STATES: Record<
    DayState,
    { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
    reported: { label: 'Sudah lapor', tone: 'success' },
    draft: { label: 'Draf', tone: 'warning' },
    missing: { label: 'Belum lapor', tone: 'danger' },
    off: { label: 'Tidak terjadwal', tone: 'neutral' },
    future: { label: 'Belum tiba', tone: 'neutral' },
};

export type WorkspaceFilter = 'all' | WorkspaceKind;

/** Quick-access grid: type chip + name/key search (case-insensitive). */
export function filterWorkspaces(
    workspaces: DirectoryWorkspace[],
    type: WorkspaceFilter,
    query: string,
): DirectoryWorkspace[] {
    const needle = query.trim().toLocaleLowerCase('id-ID');

    return workspaces.filter(
        (workspace) =>
            (type === 'all' || workspace.type === type) &&
            (needle === '' ||
                `${workspace.name} ${workspace.key}`
                    .toLocaleLowerCase('id-ID')
                    .includes(needle)),
    );
}

/** "Sesuai jalur" / "Berisiko" / "Bermasalah" / "Belum ada update". */
export const HEALTH: Record<
    NonNullable<MonitoredProject['health']> | 'none',
    { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
    on_track: { label: 'Sesuai jalur', tone: 'success' },
    at_risk: { label: 'Berisiko', tone: 'warning' },
    off_track: { label: 'Bermasalah', tone: 'danger' },
    none: { label: 'Belum ada update', tone: 'neutral' },
};

/** Gap actual − planned in points, rounded; null when either is unknown. */
export function variancePoints(project: MonitoredProject): number | null {
    const { actual, planned } = project.metrics;

    return actual === null || planned === null
        ? null
        : Math.round(actual - planned);
}

/* ---------------------------------------------------- catatan tindakan */

/** Open notes first (list order), then done ones (latest first). */
export function orderNotes(notes: ActionNote[]): ActionNote[] {
    const open = notes.filter((note) => !note.done);
    const done = notes
        .filter((note) => note.done)
        .sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''));

    return [...open, ...done];
}

/** Marks a note done / open in place; a reopened note goes to the end of the open ones. */
export function toggleNote(
    notes: ActionNote[],
    id: string,
    done: boolean,
    now: string,
    today: string,
): ActionNote[] {
    const target = notes.find((note) => note.id === id);

    if (!target) {
        return notes;
    }

    const changed: ActionNote = {
        ...target,
        done,
        done_at: done ? now : null,
        overdue: !done && target.due_on !== null && target.due_on < today,
    };
    const rest = notes.filter((note) => note.id !== id);

    if (done) {
        return orderNotes([...rest, changed]);
    }

    const open = rest.filter((note) => !note.done);
    const closed = rest.filter((note) => note.done);

    return [...open, changed, ...closed];
}

/** Moves an open note one place up (-1) or down (+1) among the open notes. */
export function moveNote(
    notes: ActionNote[],
    id: string,
    direction: -1 | 1,
): ActionNote[] {
    const open = notes.filter((note) => !note.done);
    const index = open.findIndex((note) => note.id === id);
    const target = index + direction;

    if (index < 0 || target < 0 || target >= open.length) {
        return notes;
    }

    const next = [...open];
    [next[index], next[target]] = [next[target], next[index]];

    return [...next, ...notes.filter((note) => note.done)];
}

/** Ids of the open notes in order (payload of PUT /catatan-tindakan/urutan). */
export function openIds(notes: ActionNote[]): string[] {
    return notes.filter((note) => !note.done).map((note) => note.id);
}
