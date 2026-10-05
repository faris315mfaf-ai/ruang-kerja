<?php

namespace App\Domain\Tasks\Services;

use App\Models\Label;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Carbon\CarbonImmutable;

/**
 * Assignees, labels and watchers of a task, restricted to the workspace
 * (assignees must be members; labels must belong to the workspace).
 */
final class TaskRelations
{
    /**
     * @param  list<string>  $userIds
     * @return list<string>
     */
    public function memberIds(Workspace $workspace, array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        /** @var list<string> */
        return WorkspaceMember::query()
            ->where('workspace_id', $workspace->id)
            ->whereIn('user_id', array_values(array_unique($userIds)))
            ->pluck('user_id')
            ->all();
    }

    /**
     * @param  list<string>  $labelIds
     * @return list<string>
     */
    public function labelIds(Workspace $workspace, array $labelIds): array
    {
        if ($labelIds === []) {
            return [];
        }

        /** @var list<string> */
        return Label::query()
            ->where('workspace_id', $workspace->id)
            ->whereIn('id', array_values(array_unique($labelIds)))
            ->pluck('id')
            ->all();
    }

    /**
     * Replaces the assignees; returns [added ids, removed ids]. New assignees
     * also become watchers.
     *
     * @param  list<string>  $userIds  already filtered with memberIds()
     * @return array{0: list<string>, 1: list<string>}
     */
    public function syncAssignees(Task $task, array $userIds, ?User $actor, CarbonImmutable $now): array
    {
        /** @var list<string> $current */
        $current = $task->assignees()->pluck('users.id')->all();
        $added = array_values(array_diff($userIds, $current));
        $removed = array_values(array_diff($current, $userIds));

        if ($removed !== []) {
            $task->assignees()->detach($removed);
        }

        foreach ($added as $userId) {
            $task->assignees()->attach($userId, ['assigned_at' => $now, 'assigned_by' => $actor?->id]);
        }

        $this->watch($task, $added, $now);

        return [$added, $removed];
    }

    /**
     * @param  list<string>  $labelIds  already filtered with labelIds()
     */
    public function syncLabels(Task $task, array $labelIds): void
    {
        $task->labels()->sync($labelIds);
    }

    /**
     * @param  list<string>  $userIds
     */
    public function watch(Task $task, array $userIds, CarbonImmutable $now): void
    {
        $rows = array_map(fn (string $userId): array => [
            'task_id' => $task->id,
            'user_id' => $userId,
            'created_at' => $now,
        ], array_values(array_unique($userIds)));

        if ($rows !== []) {
            $task->watchers()->newPivotStatement()->insertOrIgnore($rows);
        }
    }
}
