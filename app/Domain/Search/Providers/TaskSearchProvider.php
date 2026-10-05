<?php

namespace App\Domain\Search\Providers;

use App\Domain\Search\Contracts\SearchProvider;
use App\Domain\Search\Data\SearchResult;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Builder;

/**
 * "Tugas" (Sprint 5): tasks of workspaces the viewer may see
 * (Task::visibleTo → WorkspacePolicy rules, personal workspaces only for
 * their owner). Matches the id ("PLQ-21") or, through the GIN-indexed
 * `search_vector` (title A, description B, config 'simple'), the words of the
 * query: `websearch_to_tsquery` (quotes, OR, -word) plus a prefix query so
 * partly typed words still match ("lapor" → "laporan"). Open tasks first, then
 * by rank. A description match comes with a `ts_headline` excerpt as snippet.
 * Links to the full-screen task detail /w/{KEY}/tasks/{n} (Sprint 6).
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
        $reference = preg_match('/^([A-Za-z][A-Za-z0-9]{1,9})-(\d{1,9})$/', trim($query), $match) === 1 ? $match : null;
        $prefix = self::prefixQuery($query);
        // Same tsquery for matching, ranking and the excerpt.
        $tsQuery = $prefix === null
            ? "websearch_to_tsquery('simple', ?)"
            : "(websearch_to_tsquery('simple', ?) || to_tsquery('simple', ?))";
        $bindings = $prefix === null ? [$query] : [$query, $prefix];

        $tasks = Task::query()
            ->visibleTo($viewer)
            ->select('tasks.*')
            ->selectRaw(
                "CASE WHEN to_tsvector('simple', coalesce(tasks.description_text, '')) @@ {$tsQuery}"
                ." THEN ts_headline('simple', tasks.description_text, {$tsQuery}, 'MaxWords=18, MinWords=6, ShortWord=2, MaxFragments=1, FragmentDelimiter=\" … \", StartSel=\"\", StopSel=\"\"') END AS search_snippet",
                [...$bindings, ...$bindings],
            )
            ->where(function (Builder $scope) use ($tsQuery, $bindings, $reference): void {
                $scope->whereRaw("tasks.search_vector @@ {$tsQuery}", $bindings);

                if ($reference !== null) {
                    $scope->orWhere(fn (Builder $id) => $id
                        ->where('tasks.number', (int) $reference[2])
                        ->whereIn('tasks.workspace_id', Workspace::query()->where('key', mb_strtoupper($reference[1]))->select('id')));
                }
            })
            ->with(['workspace:id,key,name,type', 'status:id,name'])
            ->orderByRaw("CASE WHEN tasks.status_category IN ('done', 'canceled') THEN 1 ELSE 0 END")
            ->orderByRaw("ts_rank(tasks.search_vector, {$tsQuery}) DESC", $bindings)
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
                url: '/w/'.$workspace->key.'/tasks/'.$task->number,
                code: $key,
                subtitle: $workspace->isPersonal() ? 'Pribadi' : $workspace->name,
                meta: $task->status->name,
                snippet: self::snippet($task->getAttribute('search_snippet')),
            );
        }

        return $results;
    }

    /**
     * "lapor ming" → "lapor:* & ming:*" (letters and digits only, so the
     * to_tsquery input is always valid); null when nothing is left or when the
     * query uses web search syntax ("phrase", -exclude, or), which must win.
     */
    public static function prefixQuery(string $query): ?string
    {
        if (preg_match('/"|(^|\s)-\S|\sor\s/iu', $query) === 1) {
            return null;
        }

        $words = preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($query), -1, PREG_SPLIT_NO_EMPTY);

        if ($words === false || $words === []) {
            return null;
        }

        return implode(' & ', array_map(fn (string $word): string => $word.':*', array_slice($words, 0, 8)));
    }

    private static function snippet(mixed $headline): ?string
    {
        if (! is_string($headline)) {
            return null;
        }

        $headline = trim((string) preg_replace('/\s+/u', ' ', $headline));

        return $headline === '' ? null : $headline;
    }
}
