<?php

namespace App\Domain\Chat\Queries;

use App\Models\Task;
use App\Models\User;

/**
 * "#KEY-n" suggestions of the composer: tasks the viewer can see, by exact
 * key (`PLQ-18`) or by title.
 */
final class TaskReferenceSuggestions
{
    /**
     * @return list<array{id: string, key: string, title: string, status_category: string, url: string}>
     */
    public function handle(User $viewer, string $search): array
    {
        $search = trim($search);
        $query = Task::query()->visibleTo($viewer)->with('workspace:id,key');

        if (preg_match('/^#?([A-Za-z][A-Za-z0-9]{1,9})-(\d+)$/', $search, $match) === 1) {
            $query->whereHas('workspace', fn ($workspace) => $workspace->where('key', strtoupper($match[1])))
                ->where('tasks.number', (int) $match[2]);
        } elseif ($search !== '') {
            $query->where('tasks.title', 'ilike', '%'.addcslashes(ltrim($search, '#'), '%_\\').'%');
        }

        return array_values($query->orderByDesc('tasks.updated_at')->limit(8)
            ->get(['tasks.id', 'tasks.workspace_id', 'tasks.number', 'tasks.title', 'tasks.status_category'])
            ->map(fn (Task $task): array => [
                'id' => $task->id,
                'key' => $task->displayKey(),
                'title' => $task->title,
                'status_category' => $task->status_category->value,
                'url' => $task->url(),
            ])
            ->all());
    }
}
