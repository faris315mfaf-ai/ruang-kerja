<?php

namespace App\Domain\Tasks\Enums;

/**
 * activities.event values (append-only feed). Sprint 6 adds the detail edits.
 */
enum ActivityEvent: string
{
    case TaskCreated = 'task.created';
    case TaskStatusChanged = 'task.status_changed';
    case TaskAssigned = 'task.assigned';
    case TaskUnassigned = 'task.unassigned';
    case TaskDueDateChanged = 'task.due_date_changed';
    case TaskPriorityChanged = 'task.priority_changed';
    case TaskRenamed = 'task.renamed';
    case TaskDeleted = 'task.deleted';
    case TaskStartDateChanged = 'task.start_date_changed';
    case TaskEstimateChanged = 'task.estimate_changed';
    case TaskDescriptionChanged = 'task.description_changed';
    case ChecklistItemCompleted = 'task.checklist_completed';
    case SubtaskAdded = 'task.subtask_added';
    case WorkspaceCreated = 'workspace.created';
    case WorkspaceUpdated = 'workspace.updated';
    case WorkspaceArchived = 'workspace.archived';
    case WorkspaceRestored = 'workspace.restored';
    case MemberAdded = 'workspace.member_added';
    case MemberRemoved = 'workspace.member_removed';
    case MemberRoleChanged = 'workspace.member_role_changed';
}
