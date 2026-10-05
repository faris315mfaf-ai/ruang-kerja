import type { WorkspaceType } from '@/features/tasks/types';

const TYPE_PREFIXES = ['divisi ', 'tim ', 'proyek ', 'project ', 'team '];

/**
 * Avatar initial as in the mockups: the first letter after the type word
 * ("Divisi Operasional" → O, "Tim Gudang" → G, "Proyek Peluncuran Q4" → P);
 * personal workspaces use the owner's initial.
 */
export function workspaceInitial(
    name: string,
    type: WorkspaceType,
    ownerName?: string | null,
): string {
    if (type === 'personal' && ownerName) {
        return ownerName.trim().charAt(0).toUpperCase() || '?';
    }

    const trimmed = name.trim();
    const lower = trimmed.toLowerCase();
    const prefix = TYPE_PREFIXES.find(
        (candidate) =>
            lower.startsWith(candidate) && trimmed.length > candidate.length,
    );
    const rest = prefix ? trimmed.slice(prefix.length) : trimmed;

    return rest.charAt(0).toUpperCase() || '?';
}

/** "PLQ · Proyek · Internal · 9 anggota dari 3 divisi" */
export function workspaceMeta(workspace: {
    key: string;
    type_label: string;
    visibility: 'private' | 'internal';
    members_count: number;
    divisions_count: number;
    type: WorkspaceType;
}): string {
    const parts = [
        workspace.key,
        workspace.type_label,
        workspace.visibility === 'internal' ? 'Internal' : 'Private',
    ];

    if (workspace.type !== 'personal') {
        parts.push(
            workspace.divisions_count > 1
                ? `${workspace.members_count} anggota dari ${workspace.divisions_count} divisi`
                : `${workspace.members_count} anggota`,
        );
    }

    return parts.join(' · ');
}
