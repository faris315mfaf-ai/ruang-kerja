import type { DriveAccessMember } from '@/features/drive/types';
import type { WorkspaceGroupKey } from '@/features/workspaces/groups';
import type {
    Label,
    TaskStatus,
    WorkspaceMember,
    WorkspaceRef,
    WorkspaceRole,
} from '@/features/tasks/types';

/** Shared Inertia prop `workspaces` (sidebar + mobile Menu). */
export type SidebarWorkspace = WorkspaceRef & {
    favorite: boolean;
    /** Pribadi · Divisi & tim · Proyek (SidebarWorkspaces, keputusan pemilik 6 Okt 2026). */
    group?: WorkspaceGroupKey;
};

export type WorkspaceDetail = WorkspaceRef & {
    type_label: string;
    visibility: 'private' | 'internal';
    description: string | null;
    owner_id: string;
    archived: boolean;
    members_count: number;
    divisions_count: number;
};

export type WorkspaceAbilities = {
    edit_tasks: boolean;
    manage: boolean;
    manage_members: boolean;
    archive: boolean;
    favorite: boolean;
};

/** Props every workspace tab receives (WorkspacePage::props). */
export type WorkspacePageProps = {
    workspace: WorkspaceDetail;
    can: WorkspaceAbilities;
    members: WorkspaceMember[];
    /** Tab badges "Dokumen 6 · File 24" (Sprint 7). */
    drive_counts?: { documents: number; files: number };
};

export type WorkspaceTab =
    | 'summary'
    | 'tasks'
    | 'documents'
    | 'files'
    | 'notes'
    | 'activity'
    | 'settings';

export type MemberDetail = WorkspaceMember & {
    is_synced: boolean;
    /** "Akses Drive" (Sprint 7); null when the row could not be resolved. */
    drive: DriveAccessMember | null;
    division: string | null;
    position: string | null;
    joined_at: string | null;
};

export type StatusWithCount = TaskStatus & { tasks_count: number };

export type LabelWithCount = Label & { tasks_count: number };

export type Option<T extends string = string> = { value: T; label: string };

export type MemberCandidate = {
    id: string;
    name: string;
    email: string;
    division: string | null;
};

export type ActivityItem = {
    id: string;
    event: string;
    properties: Record<string, unknown>;
    subject_id: string;
    created_at: string;
    causer: { id: string; name: string; avatar: string | null } | null;
};

export type WorkspaceRoleLabel = Record<WorkspaceRole, string>;

export const ROLE_LABELS: WorkspaceRoleLabel = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
    viewer: 'Viewer',
};
