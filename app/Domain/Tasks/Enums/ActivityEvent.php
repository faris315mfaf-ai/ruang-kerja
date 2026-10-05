<?php

namespace App\Domain\Tasks\Enums;

/**
 * activities.event values written in Sprint 5 (append-only feed).
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
    case WorkspaceCreated = 'workspace.created';
    case WorkspaceUpdated = 'workspace.updated';
    case WorkspaceArchived = 'workspace.archived';
    case WorkspaceRestored = 'workspace.restored';
    case MemberAdded = 'workspace.member_added';
    case MemberRemoved = 'workspace.member_removed';
    case MemberRoleChanged = 'workspace.member_role_changed';

    // Project tracking (Sprint 9, PRD M10).
    case ProjectAttributesChanged = 'project.attributes_changed';
    case ProjectUpdatePosted = 'project.update_posted';
    case ProjectUpdateRequested = 'project.update_requested';
    case ProjectDirectionGiven = 'project.direction_given';
    case ProjectDecisionResolved = 'project.decision_resolved';
    case MilestoneCreated = 'milestone.created';
    case MilestoneUpdated = 'milestone.updated';
    case MilestoneCompleted = 'milestone.completed';
    case MilestoneReopened = 'milestone.reopened';
    case MilestoneDeleted = 'milestone.deleted';
    case RiskCreated = 'risk.created';
    case RiskUpdated = 'risk.updated';
    case RiskResolved = 'risk.resolved';
    case RiskDeleted = 'risk.deleted';
}
