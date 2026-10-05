import checklistRoutes from '@/routes/checklist';
import comments from '@/routes/comments';
import tasks from '@/routes/tasks';
import taskChecklist from '@/routes/tasks/checklist';
import { requestJson } from '../lib/api';
import type { RichDoc } from '../editor/types';
import type { Task } from '../types';
import type { ChecklistEntry, TaskComment, TaskDetail } from './types';

export type TaskChanges = Partial<{
    title: string;
    description: RichDoc | null;
    status_id: string;
    priority: number;
    assignee_ids: string[];
    label_ids: string[];
    due_date: string | null;
    start_date: string | null;
    estimate_hours: number | null;
}>;

export const taskApi = {
    detail: (taskId: string) => requestJson<TaskDetail>(tasks.show(taskId)),
    update: (taskId: string, changes: TaskChanges) =>
        requestJson<{ task: Task }>(tasks.update(taskId), changes),
    destroy: (taskId: string) => requestJson<null>(tasks.destroy(taskId)),
    createSubtask: (workspaceKey: string, parentId: string, title: string) =>
        requestJson<{ task: Task }>(tasks.store(workspaceKey), {
            title,
            parent_id: parentId,
        }),
    watch: (taskId: string, watching: boolean) =>
        requestJson<{ watching: boolean }>(
            watching ? tasks.watch(taskId) : tasks.unwatch(taskId),
        ),
    addChecklistItem: (taskId: string, title: string) =>
        requestJson<{ item: ChecklistEntry }>(taskChecklist.store(taskId), {
            title,
        }),
    updateChecklistItem: (
        itemId: string,
        changes: { title?: string; is_done?: boolean },
    ) =>
        requestJson<{ item: ChecklistEntry }>(
            checklistRoutes.update(itemId),
            changes,
        ),
    deleteChecklistItem: (itemId: string) =>
        requestJson<null>(checklistRoutes.destroy(itemId)),
    postComment: (taskId: string, body: RichDoc) =>
        requestJson<{ comment: TaskComment }>(comments.store(taskId), {
            body,
        }),
    updateComment: (commentId: string, body: RichDoc) =>
        requestJson<{ comment: TaskComment }>(comments.update(commentId), {
            body,
        }),
    deleteComment: (commentId: string) =>
        requestJson<{ comment: TaskComment }>(comments.destroy(commentId)),
    react: (commentId: string, emoji: string) =>
        requestJson<{ added: boolean; comment: TaskComment }>(
            comments.react(commentId),
            { emoji },
        ),
};
