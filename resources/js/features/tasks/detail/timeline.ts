import { PRIORITY_LABELS } from '@/components/priority-icon';
import { formatDayMonth } from '../lib/due-date';
import type { Priority } from '../types';
import type { TaskActivity, TaskComment, TimelineItem } from './types';

/** Insert or replace a comment, keeping chronological order. */
export function upsertComment(
    items: TimelineItem[],
    comment: TaskComment,
): TimelineItem[] {
    const index = items.findIndex(
        (item) => item.kind === 'comment' && item.id === comment.id,
    );

    if (index >= 0) {
        const next = [...items];
        next[index] = comment;

        return next;
    }

    return [...items, comment].sort((a, b) =>
        a.created_at === b.created_at
            ? a.id.localeCompare(b.id)
            : a.created_at < b.created_at
              ? -1
              : 1,
    );
}

export function commentCount(items: TimelineItem[]): number {
    return items.filter((item) => item.kind === 'comment' && !item.deleted)
        .length;
}

/** Toggle `userId` in the reaction group of `emoji` (optimistic update). */
export function toggleReaction(
    comment: TaskComment,
    emoji: string,
    userId: string,
    userName: string,
): TaskComment {
    const groups = comment.reactions.map((group) => ({ ...group }));
    const group = groups.find((item) => item.emoji === emoji);

    if (!group) {
        return {
            ...comment,
            reactions: [
                ...groups,
                { emoji, count: 1, user_ids: [userId], names: [userName] },
            ],
        };
    }

    const mine = group.user_ids.includes(userId);
    group.user_ids = mine
        ? group.user_ids.filter((id) => id !== userId)
        : [...group.user_ids, userId];
    group.names = mine
        ? group.names.filter((name) => name !== userName)
        : [...group.names, userName];
    group.count = group.user_ids.length;

    return {
        ...comment,
        reactions: groups.filter((item) => item.count > 0),
    };
}

function str(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function nested(value: unknown, key: string): string {
    return typeof value === 'object' && value !== null && key in value
        ? str((value as Record<string, unknown>)[key])
        : '';
}

/**
 * Sentence for a timeline activity inside the task (without the actor and
 * without repeating the task id), e.g. "mengubah status Todo → Sedang dikerjakan".
 */
export function describeTaskActivity(
    item: TaskActivity,
    names: Record<string, string> = {},
): string {
    const p = item.properties;
    const people = (value: unknown) =>
        Array.isArray(value)
            ? value.map((id) => names[String(id)] ?? 'seseorang').join(', ')
            : 'seseorang';

    switch (item.event) {
        case 'task.created':
            return 'membuat tugas ini';
        case 'task.status_changed':
            return `mengubah status ${nested(p.from, 'name')} → ${nested(p.to, 'name')}`;
        case 'task.assigned':
            return `menugaskan ${people(p.user_ids)}`;
        case 'task.unassigned':
            return `melepas ${people(p.user_ids)}`;
        case 'task.due_date_changed':
            return p.to
                ? `mengubah tenggat menjadi ${formatDayMonth(str(p.to))}`
                : 'menghapus tenggat';
        case 'task.start_date_changed':
            return p.to
                ? `mengubah tanggal mulai menjadi ${formatDayMonth(str(p.to))}`
                : 'menghapus tanggal mulai';
        case 'task.estimate_changed':
            return typeof p.to === 'number'
                ? `mengubah estimasi menjadi ${String(p.to).replace('.', ',')} jam`
                : 'menghapus estimasi';
        case 'task.priority_changed':
            return `mengubah prioritas menjadi ${PRIORITY_LABELS[Number(p.to) as Priority] ?? '–'}`;
        case 'task.renamed':
            return `mengganti judul menjadi “${str(p.to)}”`;
        case 'task.description_changed':
            return 'memperbarui deskripsi';
        case 'task.checklist_completed':
            return `menyelesaikan “${str(p.item)}”`;
        case 'task.subtask_added':
            return `menambahkan sub-tugas ${nested(p.subtask, 'key')}`;
        default:
            return item.event;
    }
}
