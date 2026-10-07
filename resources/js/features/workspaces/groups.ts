import type { WorkspaceType } from '@/features/tasks/types';

/**
 * Workspace groups (keputusan pemilik 6 Okt 2026) on /workspace, the mobile
 * Menu and the Dock/Rail Workspace stack. The query string value is the key
 * (`/workspace?jenis=proyek`). Mirrors WorkspaceGroup (PHP).
 */
export type WorkspaceGroupKey = 'pribadi' | 'divisi' | 'proyek' | 'lainnya';

export type WorkspaceFilter = WorkspaceGroupKey | 'semua';

export type WorkspaceGroupDefinition = {
    key: WorkspaceGroupKey;
    /** Section heading. */
    label: string;
    /** Filter chip text. */
    chip: string;
    /** Dot colour (token utility, never hex). */
    dot: string;
    /** Small empty state of the section. */
    empty: string;
};

export const WORKSPACE_GROUPS: readonly WorkspaceGroupDefinition[] = [
    {
        key: 'pribadi',
        label: 'Pribadi',
        chip: 'Pribadi',
        dot: 'bg-text-muted',
        empty: 'Workspace pribadi Anda belum dibuat.',
    },
    {
        key: 'divisi',
        label: 'Divisi & tim',
        chip: 'Divisi & tim',
        dot: 'bg-fill-teal',
        empty: 'Belum ada workspace divisi atau tim untuk Anda.',
    },
    {
        key: 'proyek',
        label: 'Proyek yang diikuti',
        chip: 'Proyek',
        dot: 'bg-accent-blue',
        empty: 'Anda belum menjadi anggota proyek.',
    },
    {
        key: 'lainnya',
        label: 'Lainnya (lihat saja)',
        chip: 'Lainnya',
        dot: 'bg-fill-warning',
        empty: 'Tidak ada workspace lain.',
    },
];

type Groupable = { type: WorkspaceType; is_member?: boolean };

/**
 * Pribadi = the personal workspace; Divisi & tim = division/team workspaces
 * the user belongs to; Proyek = projects the user is a member of; Lainnya =
 * workspaces seen without membership (Direksi, internal, Kepala Divisi).
 */
export function workspaceGroup(workspace: Groupable): WorkspaceGroupKey {
    if (workspace.type === 'personal') {
        return 'pribadi';
    }

    if (workspace.is_member === false) {
        return 'lainnya';
    }

    return workspace.type === 'project' ? 'proyek' : 'divisi';
}

export type WorkspaceSection<T> = {
    group: WorkspaceGroupDefinition;
    items: T[];
};

/**
 * Sections in a fixed order; "Lainnya" only when it has items (members never
 * see it). With a filter, only that section.
 */
export function groupWorkspaces<T extends Groupable>(
    workspaces: readonly T[],
    filter: WorkspaceFilter = 'semua',
): WorkspaceSection<T>[] {
    return WORKSPACE_GROUPS.map((group) => ({
        group,
        items: workspaces.filter(
            (workspace) => workspaceGroup(workspace) === group.key,
        ),
    })).filter(
        (section) =>
            (filter === 'semua' || section.group.key === filter) &&
            (section.group.key !== 'lainnya' ||
                section.items.length > 0 ||
                filter === 'lainnya'),
    );
}

/** Items per filter chip, "semua" included. */
export function groupCounts<T extends Groupable>(
    workspaces: readonly T[],
): Record<WorkspaceFilter, number> {
    const counts: Record<WorkspaceFilter, number> = {
        semua: workspaces.length,
        pribadi: 0,
        divisi: 0,
        proyek: 0,
        lainnya: 0,
    };

    for (const workspace of workspaces) {
        counts[workspaceGroup(workspace)] += 1;
    }

    return counts;
}

export function parseWorkspaceFilter(value: unknown): WorkspaceFilter {
    return value === 'pribadi' ||
        value === 'divisi' ||
        value === 'proyek' ||
        value === 'lainnya'
        ? value
        : 'semua';
}
