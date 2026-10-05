/**
 * Linear-style shortcuts of the board and list (docs/PROMPTS.md Sprint 6).
 * Pure helpers so the key handling can be unit-tested.
 */
export type ShortcutAction =
    | 'next'
    | 'previous'
    | 'assign-me'
    | 'status'
    | 'priority'
    | 'due'
    | 'help';

export const SHORTCUTS: { keys: string[]; label: string }[] = [
    { keys: ['J'], label: 'Tugas berikutnya' },
    { keys: ['K'], label: 'Tugas sebelumnya' },
    { keys: ['Enter'], label: 'Buka tugas' },
    { keys: ['C'], label: 'Buat tugas' },
    { keys: ['A'], label: 'Tugaskan ke saya / lepas' },
    { keys: ['S'], label: 'Ubah status' },
    { keys: ['P'], label: 'Ubah prioritas' },
    { keys: ['D'], label: 'Ubah tenggat' },
    { keys: ['Shift', '←'], label: 'Pindah ke kolom sebelumnya (board)' },
    { keys: ['Shift', '→'], label: 'Pindah ke kolom berikutnya (board)' },
    { keys: ['Esc'], label: 'Tutup panel / batal' },
    { keys: ['?'], label: 'Daftar pintasan' },
];

export function shortcutFor(event: {
    key: string;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
}): ShortcutAction | null {
    if (event.metaKey || event.ctrlKey || event.altKey) {
        return null;
    }

    if (event.key === '?') {
        return 'help';
    }

    if (event.shiftKey) {
        return null;
    }

    switch (event.key.toLowerCase()) {
        case 'j':
            return 'next';
        case 'k':
            return 'previous';
        case 'a':
            return 'assign-me';
        case 's':
            return 'status';
        case 'p':
            return 'priority';
        case 'd':
            return 'due';
        default:
            return null;
    }
}

/** Next/previous id in display order; starts at the first/last when none is focused. */
export function stepId(
    ids: string[],
    current: string | null,
    direction: 1 | -1,
): string | null {
    if (ids.length === 0) {
        return null;
    }

    const index = current ? ids.indexOf(current) : -1;

    if (index === -1) {
        return direction === 1 ? ids[0] : ids[ids.length - 1];
    }

    return ids[Math.min(ids.length - 1, Math.max(0, index + direction))];
}

/** Toggle the viewer in the assignee list (shortcut A). */
export function toggleAssignee(ids: string[], userId: string): string[] {
    return ids.includes(userId)
        ? ids.filter((id) => id !== userId)
        : [...ids, userId];
}
