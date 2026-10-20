<?php

namespace App\Domain\HrHub\Queries;

use App\Domain\Analytics\Data\Period;
use App\Domain\HrHub\Actions\EnsureHrWorkspaces;
use App\Domain\HrHub\Enums\SystemWorkspace;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Models\Division;
use App\Models\Task;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Ruang HR › Penugasan (keputusan pemilik 20 Okt 2026): tasks of the
 * "Penugasan HR" workspace with their status as HR sees it —
 * not_started (backlog/todo), in_progress (in progress/review), overdue
 * (open past the due date) and done (done, canceled left out) — plus the
 * pickers of "Beri tugas". Always through Task::visibleTo (HR are admins
 * of the workspace, so they see every task there).
 */
final class HrAssignments
{
    public const array STATUSES = ['not_started', 'in_progress', 'overdue', 'done'];

    /** Rows listed per page view (newest due first within a status). */
    public const int LIMIT = 200;

    public function __construct(private readonly EnsureHrWorkspaces $ensure) {}

    public function workspace(User $viewer): ?Workspace
    {
        return $this->ensure->handle($viewer->company_id)[SystemWorkspace::HrAssignments->value] ?? null;
    }

    /**
     * @return array{workspace: array{id: string, key: string, name: string}|null, status: string|null, counts: array<string, int>, rows: list<array<string, mixed>>}
     */
    public function list(User $viewer, ?string $status, ?CarbonImmutable $now = null, ?Workspace $workspace = null): array
    {
        $workspace ??= $this->workspace($viewer);
        $status = in_array($status, self::STATUSES, true) ? $status : null;
        $counts = array_fill_keys(self::STATUSES, 0);

        if ($workspace === null) {
            return ['workspace' => null, 'status' => $status, 'counts' => [...$counts, 'all' => 0], 'rows' => []];
        }

        $today = Period::officeDate($now ?? CarbonImmutable::now())->toDateString();
        $base = fn (): Builder => Task::query()
            ->visibleTo($viewer)
            ->where('tasks.workspace_id', $workspace->id)
            ->whereNull('tasks.parent_id')
            ->where('tasks.status_category', '!=', TaskStatusCategory::Canceled->value);

        $row = $base()->toBase()
            ->selectRaw("COUNT(*) FILTER (WHERE status_category IN ('backlog','todo') AND (due_date IS NULL OR due_date >= ?)) AS not_started", [$today])
            ->selectRaw("COUNT(*) FILTER (WHERE status_category IN ('in_progress','review') AND (due_date IS NULL OR due_date >= ?)) AS in_progress", [$today])
            ->selectRaw("COUNT(*) FILTER (WHERE status_category NOT IN ('done','canceled') AND due_date < ?) AS overdue", [$today])
            ->selectRaw("COUNT(*) FILTER (WHERE status_category = 'done') AS done")
            ->first();

        foreach (self::STATUSES as $key) {
            $counts[$key] = (int) ($row->{$key} ?? 0);
        }

        $tasks = $this->filter($base(), $status, $today)
            ->with(['workspace:id,key', 'assignees:id,name,avatar_url'])
            ->withCount([
                'checklistItems',
                'checklistItems as checklist_done_count' => fn (Builder $query) => $query->where('is_done', true),
            ])
            ->orderByRaw("CASE WHEN tasks.status_category = 'done' THEN 1 ELSE 0 END")
            ->orderByRaw('tasks.due_date ASC NULLS LAST')
            ->orderByDesc('tasks.created_at')
            ->limit(self::LIMIT)
            ->get();

        return [
            'workspace' => ['id' => $workspace->id, 'key' => $workspace->key, 'name' => $workspace->name],
            'status' => $status,
            'counts' => [...$counts, 'all' => array_sum($counts)],
            'rows' => array_values($tasks->map(fn (Task $task): array => self::row($task, $today))->all()),
        ];
    }

    /**
     * Open assignments due first (Ruang HR › Ringkasan), with counts.
     *
     * @return array{open: int, overdue: int, top: list<array<string, mixed>>}
     */
    public function summary(User $viewer, CarbonImmutable $now, int $limit = 3, ?Workspace $workspace = null): array
    {
        $workspace ??= $this->workspace($viewer);

        if ($workspace === null) {
            return ['open' => 0, 'overdue' => 0, 'top' => []];
        }

        $today = Period::officeDate($now)->toDateString();
        $open = fn (): Builder => Task::query()
            ->visibleTo($viewer)
            ->where('tasks.workspace_id', $workspace->id)
            ->whereNull('tasks.parent_id')
            ->open();

        $row = $open()->toBase()
            ->selectRaw('COUNT(*) AS open')
            ->selectRaw('COUNT(*) FILTER (WHERE due_date < ?) AS overdue', [$today])
            ->first();

        $top = $open()
            ->with(['workspace:id,key', 'assignees:id,name,avatar_url'])
            ->withCount([
                'checklistItems',
                'checklistItems as checklist_done_count' => fn (Builder $query) => $query->where('is_done', true),
            ])
            ->orderByRaw('tasks.due_date ASC NULLS LAST')
            ->orderByDesc('tasks.created_at')
            ->limit($limit)
            ->get();

        return [
            'open' => (int) ($row->open ?? 0),
            'overdue' => (int) ($row->overdue ?? 0),
            'top' => array_values($top->map(fn (Task $task): array => self::row($task, $today))->all()),
        ];
    }

    /**
     * "Beri tugas" pickers: active employees, divisions, teams of the company.
     *
     * @return array{people: list<array{id: string, name: string, division: string|null}>, divisions: list<array{id: string, name: string, people: int}>, teams: list<array{id: string, name: string, division: string|null, people: int}>}
     */
    public function pickers(User $viewer): array
    {
        $people = User::query()
            ->visibleTo($viewer)
            ->active()
            ->with('division:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'division_id', 'team_id', 'company_id']);

        $perDivision = $people->countBy('division_id');
        $perTeam = $people->countBy('team_id');

        return [
            'people' => array_values($people->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'division' => $user->division?->name,
            ])->all()),
            'divisions' => array_values(Division::query()
                ->where('company_id', $viewer->company_id)
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (Division $division): array => ['id' => $division->id, 'name' => $division->name, 'people' => (int) ($perDivision[$division->id] ?? 0)])
                ->all()),
            'teams' => array_values(Team::query()
                ->whereIn('division_id', Division::query()->where('company_id', $viewer->company_id)->select('id'))
                ->with('division:id,name')
                ->orderBy('name')
                ->get(['id', 'name', 'division_id'])
                ->map(fn (Team $team): array => ['id' => $team->id, 'name' => $team->name, 'division' => $team->division?->name, 'people' => (int) ($perTeam[$team->id] ?? 0)])
                ->all()),
        ];
    }

    /**
     * @param  Builder<Task>  $query
     * @return Builder<Task>
     */
    private function filter(Builder $query, ?string $status, string $today): Builder
    {
        return match ($status) {
            'not_started' => $query->whereIn('tasks.status_category', ['backlog', 'todo'])->where(fn (Builder $due) => $due->whereNull('tasks.due_date')->orWhere('tasks.due_date', '>=', $today)),
            'in_progress' => $query->whereIn('tasks.status_category', ['in_progress', 'review'])->where(fn (Builder $due) => $due->whereNull('tasks.due_date')->orWhere('tasks.due_date', '>=', $today)),
            'overdue' => $query->open()->where('tasks.due_date', '<', $today),
            'done' => $query->where('tasks.status_category', 'done'),
            default => $query,
        };
    }

    /**
     * @return array<string, mixed>
     */
    public static function row(Task $task, string $today): array
    {
        $due = $task->due_date?->toDateString();
        $closed = $task->status_category->isClosed();
        $overdueDays = ! $closed && $due !== null && $due < $today
            ? (int) CarbonImmutable::parse($due)->diffInDays(CarbonImmutable::parse($today))
            : 0;

        $status = match (true) {
            $task->status_category === TaskStatusCategory::Done => 'done',
            $overdueDays > 0 => 'overdue',
            in_array($task->status_category, [TaskStatusCategory::InProgress, TaskStatusCategory::Review], true) => 'in_progress',
            default => 'not_started',
        };

        $assignees = $task->assignees->sortBy('name')->values();

        return [
            'id' => $task->id,
            'key' => $task->displayKey(),
            'title' => $task->title,
            'url' => $task->url(),
            'assignees' => array_values($assignees->take(5)->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'initials' => self::initials($user->name),
                'avatar' => $user->avatar_url,
            ])->all()),
            'assignee_count' => $assignees->count(),
            'due_date' => $due,
            'status' => $status,
            'status_label' => match ($status) {
                'done' => 'Selesai',
                'overdue' => 'Terlambat',
                'in_progress' => 'Dikerjakan',
                default => 'Belum mulai',
            },
            'overdue_days' => $overdueDays,
            'checklist' => [
                'done' => (int) ($task->getAttribute('checklist_done_count') ?? 0),
                'total' => (int) ($task->getAttribute('checklist_items_count') ?? 0),
            ],
            'completed_at' => $task->completed_at?->toIso8601String(),
        ];
    }

    public static function initials(string $name): string
    {
        $words = preg_split('/\s+/', trim($name)) ?: [];
        $letters = array_map(fn (string $word): string => mb_strtoupper(mb_substr($word, 0, 1)), array_slice(array_values(array_filter($words)), 0, 2));

        return implode('', $letters);
    }
}
