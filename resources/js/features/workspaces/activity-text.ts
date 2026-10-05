import { PRIORITY_LABELS } from '@/components/priority-icon';
import { HEALTH_LABELS } from '@/features/portfolio/lib';
import type { Priority } from '@/features/tasks/types';
import { formatDayMonth } from '@/features/tasks/lib/due-date';
import type { ActivityItem } from './types';
import { ROLE_LABELS } from './types';

function str(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function count(value: unknown): number {
    return Array.isArray(value) ? value.length : 0;
}

function nested(value: unknown, key: string): string {
    return typeof value === 'object' && value !== null && key in value
        ? str((value as Record<string, unknown>)[key])
        : '';
}

/**
 * Indonesian sentence (without the actor) for a feed entry, e.g.
 * "memindahkan OPS-142 dari Todo ke Sedang dikerjakan".
 */
export function describeActivity(
    item: ActivityItem,
    names: Record<string, string> = {},
): string {
    const p = item.properties;
    const key = str(p.key);
    const people = (value: unknown) =>
        Array.isArray(value)
            ? value.map((id) => names[String(id)] ?? 'seseorang').join(', ')
            : '';

    switch (item.event) {
        case 'task.created':
            return `membuat ${key} “${str(p.title)}”`;
        case 'task.status_changed':
            return `memindahkan ${key} dari ${nested(p.from, 'name')} ke ${nested(p.to, 'name')}`;
        case 'task.assigned':
            return `menugaskan ${key} ke ${people(p.user_ids) || `${count(p.user_ids)} orang`}`;
        case 'task.unassigned':
            return `melepas ${people(p.user_ids) || `${count(p.user_ids)} orang`} dari ${key}`;
        case 'task.due_date_changed':
            return p.to
                ? `mengubah tenggat ${key} menjadi ${formatDayMonth(str(p.to))}`
                : `menghapus tenggat ${key}`;
        case 'task.priority_changed':
            return `mengubah prioritas ${key} menjadi ${PRIORITY_LABELS[Number(p.to) as Priority] ?? '–'}`;
        case 'task.renamed':
            return `mengganti judul ${key} menjadi “${str(p.to)}”`;
        case 'task.start_date_changed':
            return p.to
                ? `mengubah tanggal mulai ${key} menjadi ${formatDayMonth(str(p.to))}`
                : `menghapus tanggal mulai ${key}`;
        case 'task.estimate_changed':
            return typeof p.to === 'number'
                ? `mengubah estimasi ${key} menjadi ${String(p.to).replace('.', ',')} jam`
                : `menghapus estimasi ${key}`;
        case 'task.description_changed':
            return `memperbarui deskripsi ${key}`;
        case 'task.checklist_completed':
            return `menyelesaikan “${str(p.item)}” di ${key}`;
        case 'task.subtask_added':
            return `menambahkan sub-tugas ${nested(p.subtask, 'key')} ke ${key}`;
        case 'task.attachment_added':
            return `melampirkan ${str(p.filename)} di ${key}`;
        case 'task.attachment_removed':
            return `melepas lampiran ${str(p.filename)} dari ${key}`;
        case 'task.deleted':
            return `menghapus ${key} “${str(p.title)}”`;
        case 'workspace.created':
            return 'membuat workspace ini';
        case 'workspace.updated':
            return 'mengubah pengaturan workspace';
        case 'workspace.archived':
            return 'mengarsipkan workspace';
        case 'workspace.restored':
            return 'memulihkan workspace dari arsip';
        case 'workspace.member_added':
            return `menambahkan ${str(p.name)} sebagai ${ROLE_LABELS[str(p.role) as keyof typeof ROLE_LABELS] ?? str(p.role)}`;
        case 'workspace.member_removed':
            return `mengeluarkan ${str(p.name)}`;
        case 'workspace.member_role_changed':
            return `mengubah peran ${str(p.name)} menjadi ${ROLE_LABELS[str(p.to) as keyof typeof ROLE_LABELS] ?? str(p.to)}`;
        // Project tracking (Sprint 9).
        case 'project.attributes_changed':
            return 'mengubah atribut proyek';
        case 'project.update_posted':
            return `menulis update proyek (${HEALTH_LABELS[str(p.health) as keyof typeof HEALTH_LABELS] ?? str(p.health)})${p.decision_needed ? ' dan meminta keputusan Direksi' : ''}`;
        case 'project.update_requested':
            return `meminta update proyek dari ${str(p.recipient)}`;
        case 'project.direction_given':
            return `memberi arahan: “${str(p.body)}”`;
        case 'project.decision_resolved':
            return `menandai keputusan selesai: “${str(p.decision)}”`;
        case 'milestone.created':
            return `menambahkan milestone “${str(p.name)}”`;
        case 'milestone.updated':
            return `mengubah milestone “${str(p.name)}”`;
        case 'milestone.completed':
            return `menandai milestone “${str(p.name)}” selesai`;
        case 'milestone.reopened':
            return `membuka kembali milestone “${str(p.name)}”`;
        case 'milestone.deleted':
            return `menghapus milestone “${str(p.name)}”`;
        case 'risk.created':
            return `mencatat risiko “${str(p.title)}”`;
        case 'risk.updated':
            return `mengubah risiko “${str(p.title)}”`;
        case 'risk.resolved':
            return `menandai risiko “${str(p.title)}” teratasi`;
        case 'risk.deleted':
            return `menghapus risiko “${str(p.title)}”`;
        default:
            return item.event;
    }
}
