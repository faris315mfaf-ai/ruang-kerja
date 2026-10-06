<?php

namespace App\Domain\Automation\Actions;

use App\Domain\Tasks\Enums\TaskPriority;
use App\Models\RecurringTask;
use App\Models\User;
use App\Models\Workspace;

/**
 * Creates a recurring task in $workspace, or updates $recurring. Input is
 * validated by RecurringTaskRequest (pattern, bounds, at least one date).
 */
final class SaveRecurringTask
{
    /**
     * @param  array{title: string, assignee_id: string|null, priority: int, pattern: array<string, mixed>, starts_on: string, ends_on: string|null}  $data
     */
    public function handle(Workspace $workspace, User $actor, array $data, ?RecurringTask $recurring = null): RecurringTask
    {
        $recurring ??= new RecurringTask(['created_by' => $actor->id, 'is_active' => true]);

        $recurring->fill([
            'company_id' => $workspace->company_id,
            'workspace_id' => $workspace->id,
            'title' => trim($data['title']),
            'assignee_id' => $data['assignee_id'],
            'priority' => TaskPriority::from($data['priority']),
            'pattern' => $data['pattern'],
            'starts_on' => $data['starts_on'],
            'ends_on' => $data['ends_on'],
        ]);
        $recurring->save();

        return $recurring;
    }
}
