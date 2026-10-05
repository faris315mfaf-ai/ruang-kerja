<?php

namespace App\Domain\Projects\Actions;

use App\Domain\Tasks\Actions\RecordActivity;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Domain\Tasks\Services\Lexorank;
use App\Models\Milestone;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;

/**
 * Creates or edits a milestone and syncs its linked tasks (only tasks of the
 * same workspace are kept). New milestones go last.
 */
final class SaveMilestone
{
    public function __construct(private readonly RecordActivity $recordActivity) {}

    /**
     * @param  array{name: string, description?: string|null, target_date: string, task_ids?: list<string>}  $data
     */
    public function handle(Workspace $workspace, User $actor, array $data, ?Milestone $milestone = null): Milestone
    {
        return DB::transaction(function () use ($workspace, $actor, $data, $milestone): Milestone {
            $creating = $milestone === null;

            if ($milestone === null) {
                $last = Milestone::query()->where('workspace_id', $workspace->id)->lockForUpdate()->orderByDesc('position')->value('position');
                $milestone = new Milestone([
                    'workspace_id' => $workspace->id,
                    'position' => Lexorank::between(is_string($last) ? $last : null, null),
                    'created_by' => $actor->id,
                ]);
            }

            $milestone->fill([
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'target_date' => $data['target_date'],
            ]);

            $dirty = $milestone->getDirty();
            $milestone->save();

            $changedTasks = false;

            if (array_key_exists('task_ids', $data)) {
                $taskIds = Task::query()->where('workspace_id', $workspace->id)->whereKey($data['task_ids'])->pluck('id')->all();
                $changes = $milestone->tasks()->sync($taskIds);
                $changedTasks = $changes['attached'] !== [] || $changes['detached'] !== [];
            }

            if ($creating || $dirty !== [] || $changedTasks) {
                $this->recordActivity->handle($workspace, $milestone, $actor, $creating ? ActivityEvent::MilestoneCreated : ActivityEvent::MilestoneUpdated, [
                    'name' => $milestone->name,
                    'target_date' => $milestone->target_date->toDateString(),
                ]);
            }

            return $milestone;
        });
    }
}
