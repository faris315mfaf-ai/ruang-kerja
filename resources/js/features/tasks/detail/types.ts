import type {
    AttachmentData,
    AttachmentsPayload,
} from '@/features/drive/types';
import type { RichDoc, TaskReferenceInfo } from '../editor/types';
import type {
    Label,
    Person,
    StatusCategory,
    Task,
    TaskStatus,
    WorkspaceMember,
    WorkspaceRef,
} from '../types';

export type ReactionGroup = {
    emoji: string;
    count: number;
    user_ids: string[];
    names: string[];
};

export type TaskComment = {
    kind: 'comment';
    id: string;
    task_id: string;
    author: Person;
    body: RichDoc | null;
    body_text: string | null;
    created_at: string;
    edited_at: string | null;
    deleted: boolean;
    reactions: ReactionGroup[];
    /** Drive attachments shown under the comment (empty when deleted). */
    attachments: AttachmentData[];
};

export type TaskActivity = {
    kind: 'activity';
    id: string;
    event: string;
    properties: Record<string, unknown>;
    causer: Person | null;
    created_at: string;
};

export type TimelineItem = TaskComment | TaskActivity;

export type ChecklistEntry = {
    id: string;
    title: string;
    is_done: boolean;
    position: string;
    done_by: string | null;
    done_at: string | null;
};

export type DetailTask = Task & {
    description: RichDoc | null;
    updated_at: string | null;
    started_at: string | null;
    attachments_count: number;
};

/** GET /tugas/{id} (App\Domain\Tasks\Queries\TaskDetail). */
export type TaskDetail = {
    task: DetailTask;
    url: string;
    workspace: WorkspaceRef;
    statuses: TaskStatus[];
    labels: Label[];
    members: WorkspaceMember[];
    creator: Person | null;
    assignees: Person[];
    watchers: Person[];
    watching: boolean;
    parent: {
        id: string;
        key: string;
        title: string;
        status_category: StatusCategory;
    } | null;
    subtasks: Task[];
    checklist: ChecklistEntry[];
    /** Task-level Drive attachments as GET /lampiran/task/{id} returns them. */
    attachments: AttachmentsPayload;
    timeline: TimelineItem[];
    references: Record<string, TaskReferenceInfo>;
    reactions: string[];
    can: {
        edit: boolean;
        delete: boolean;
        comment: boolean;
        /** Follow / unfollow; false for view-only management (keputusan pemilik 6 Okt 2026). */
        watch: boolean;
        moderate: boolean;
    };
};
