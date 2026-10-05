<?php

namespace App\Domain\Search\Providers;

use App\Domain\Search\Contracts\SearchProvider;
use App\Domain\Search\Data\SearchResult;
use App\Domain\Search\Support\LikePattern;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Builder;

/**
 * "Tugas" (Sprint 5): tasks of workspaces the viewer may see
 * (Task::visibleTo → WorkspacePolicy rules, personal workspaces only for
 * their owner). Matches the id ("PLQ-21"), the title or the description text;
 * open tasks first. Links to the board filtered on the task until the task
 * detail (Sprint 6) exists.
 */
final class TaskSearchProvider implements SearchProvider
{
    public function key(): string
    {
        return 'tasks';
    }

    public function label(): string
    {
        return 'Tugas';
    }

    public function minQueryLength(): int
    {
        return 2;
    }

    public function search(User $viewer, string $query, int $limit): array
    {
        $pattern = LikePattern::contains($query);
        $reference = preg_match('/^([A-Za-z][A-Za-z0-9]{1,9})-(\d{1,9})$/', trim($query), $match) === 1 ? $match : null;

        $tasks = Task::query()
            ->visibleTo($viewer)
            ->where(function (Builder $scope) use ($pattern, $reference): void {
                $scope->where('tasks.title', 'ilike', $pattern)
                    ->orWhere('tasks.description_text', 'ilike', $pattern);

                if ($reference !== null) {
                    $scope->orWhere(fn (Builder $id) => $id
                        ->where('tasks.number', (int) $reference[2])
                        ->whereIn('tasks.workspace_id', Workspace::query()->where('key', mb_strtoupper($reference[1]))->select('id')));
                }
            })
            ->with(['workspace:id,key,name,type', 'status:id,name'])
            ->orderByRaw("CASE WHEN tasks.status_category IN ('done', 'canceled') THEN 1 ELSE 0 END")
            ->orderByDesc('tasks.updated_at')
            ->limit($limit)
            ->get();

        $results = [];

        foreach ($tasks as $task) {
            $workspace = $task->workspace;
            $key = $workspace->key.'-'.$task->number;

            $results[] = new SearchResult(
                id: 'task:'.$task->id,
                title: $task->title,
                icon: $task->status_category === TaskStatusCategory::Done ? 'circle-check' : 'circle',
                url: '/w/'.$workspace->key.'?q='.rawurlencode($key),
                code: $key,
                subtitle: $workspace->isPersonal() ? 'Pribadi' : $workspace->name,
                meta: $task->status->name,
            );
        }

        return $results;
    }
}
