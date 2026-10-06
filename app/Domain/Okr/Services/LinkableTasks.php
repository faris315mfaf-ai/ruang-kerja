<?php

namespace App\Domain\Okr\Services;

use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\KeyResult;
use App\Models\Task;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Tasks a key result may be linked to: visible to the user (Task::visibleTo)
 * and in a workspace of the objective's division — the division workspace,
 * its team workspaces and projects whose primary division it is. Personal
 * workspaces never count.
 */
final class LinkableTasks
{
    /**
     * @return Builder<Task>
     */
    public function query(KeyResult $keyResult, User $user): Builder
    {
        $divisionId = $keyResult->objective->division_id;

        $workspaces = Workspace::query()
            ->where('company_id', $keyResult->objective->company_id)
            ->where('type', '!=', WorkspaceType::Personal->value)
            ->whereNull('archived_at')
            ->where(function (Builder $division) use ($divisionId): void {
                $division->where('division_id', $divisionId)
                    ->orWhereIn('team_id', Team::query()->where('division_id', $divisionId)->select('id'));
            })
            ->select('id');

        return Task::query()
            ->visibleTo($user)
            ->whereIn('tasks.workspace_id', $workspaces);
    }

    /**
     * Search for the picker: "#KEY-12", "KEY-12" or a title fragment; tasks
     * already linked are left out.
     *
     * @return Builder<Task>
     */
    public function search(KeyResult $keyResult, User $user, string $search): Builder
    {
        $query = $this->query($keyResult, $user)
            ->whereNotIn('tasks.id', DB::table('key_result_tasks')->where('key_result_id', $keyResult->id)->select('task_id'));
        $search = trim($search);

        if (preg_match('/^#?([A-Za-z][A-Za-z0-9]{1,9})-(\d+)$/', $search, $match) === 1) {
            $query->whereHas('workspace', fn (Builder $workspace) => $workspace->where('key', strtoupper($match[1])))
                ->where('tasks.number', (int) $match[2]);
        } elseif ($search !== '') {
            $query->where('tasks.title', 'ilike', '%'.addcslashes(ltrim($search, '#'), '%_\\').'%');
        }

        return $query;
    }
}
