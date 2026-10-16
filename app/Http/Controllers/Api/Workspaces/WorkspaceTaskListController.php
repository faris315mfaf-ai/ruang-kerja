<?php

namespace App\Http\Controllers\Api\Workspaces;

use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Tasks\Queries\BoardTasks;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\WorkspaceAccess;
use App\Http\Resources\Api\WorkspaceCard;
use App\Models\Label;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\WorkspacePolicy;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * GET /api/v1/workspace/{workspace}/tugas — the List view of a workspace
 * (mockup 17): the same card as the board (BoardTasks::query, comment badge
 * included) with the filters of the web toolbar and pagination.
 *
 * Default scope = the board's: open tasks plus tasks closed in the last 30
 * days; `selesai=1` lists every closed task too, `kategori=` / `status=`
 * narrow to one category or column (no 30-day window then).
 *
 * Query: status (column id) · kategori (backlog|todo|in_progress|review|done|
 * canceled) · assignee (`me`, `none` or a user id) · prioritas (csv of 0–4) ·
 * label (csv of label ids) · tenggat (overdue|today|week|none) · q (title,
 * description or KEY-12) · urut (tenggat|prioritas|terbaru|nomor, default
 * tenggat) · selesai (bool) · page · per_page (default 40, max 100).
 */
class WorkspaceTaskListController extends Controller
{
    public const int PER_PAGE = 40;

    public function __invoke(Request $request, Workspace $workspace, #[CurrentUser] User $user, WorkspacePolicy $policy): JsonResponse
    {
        Gate::authorize('view', $workspace);

        $filters = $request->validate([
            'status' => ['nullable', 'string', 'size:26'],
            'kategori' => ['nullable', Rule::in(array_map(fn (TaskStatusCategory $category): string => $category->value, TaskStatusCategory::cases()))],
            'assignee' => ['nullable', 'string', 'max:26'],
            'prioritas' => ['nullable', 'string', 'regex:/^[0-4](,[0-4]){0,4}$/'],
            'label' => ['nullable', 'string', 'max:300'],
            'tenggat' => ['nullable', Rule::in(['overdue', 'today', 'week', 'none'])],
            'q' => ['nullable', 'string', 'max:100'],
            'urut' => ['nullable', Rule::in(['tenggat', 'prioritas', 'terbaru', 'nomor'])],
            'selesai' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ], [
            'kategori.in' => 'Kategori status tidak valid.',
            'prioritas.regex' => 'Prioritas tidak valid.',
            'tenggat.in' => 'Filter tenggat tidak valid.',
            'urut.in' => 'Urutan tidak valid.',
        ]);

        $canMove = $policy->canEditTasks($user, $workspace);
        $query = BoardTasks::query($user)
            ->with(['assignees:id,name', 'status:id,name,category,color'])
            ->where('tasks.workspace_id', $workspace->id);

        $this->scope($query, $filters);
        $this->narrow($query, $filters, $user);
        $this->order($query, (string) ($filters['urut'] ?? 'tenggat'));

        $page = $query->paginate((int) ($filters['per_page'] ?? self::PER_PAGE));

        return response()->json([
            'workspace' => ['id' => $workspace->id, 'key' => $workspace->key, 'name' => $workspace->name],
            'tasks' => array_map(fn (Task $task): array => WorkspaceCard::make($task, $canMove), $page->items()),
            'statuses' => TaskStatus::query()->where('workspace_id', $workspace->id)->orderBy('position')->get()
                ->map(fn (TaskStatus $status): array => [
                    'id' => $status->id,
                    'name' => $status->name,
                    'kategori' => $status->category->value,
                    'color' => $status->color,
                    'posisi' => $status->position,
                ])->values()->all(),
            'labels' => Label::query()->where('workspace_id', $workspace->id)->orderBy('name')->get(['id', 'name', 'color'])
                ->map(fn (Label $label): array => ['id' => $label->id, 'name' => $label->name, 'color' => $label->color])
                ->values()->all(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'has_more' => $page->hasMorePages(),
            ],
            'can' => ['move' => $canMove],
            'read_only' => WorkspaceAccess::readOnly($workspace, $user, $policy),
        ]);
    }

    /**
     * Board window: open tasks + closed in the last 30 days, unless the
     * caller asked for closed work explicitly.
     *
     * @param  Builder<Task>  $query
     * @param  array<string, mixed>  $filters
     */
    private function scope(Builder $query, array $filters): void
    {
        if (! empty($filters['selesai']) || ! empty($filters['kategori']) || ! empty($filters['status'])) {
            return;
        }

        $since = now()->subDays(BoardTasks::CLOSED_DAYS);
        $query->where(fn (Builder $window) => $window
            ->whereNotIn('tasks.status_category', TaskStatusCategory::closedValues())
            ->orWhere('tasks.completed_at', '>=', $since)
            ->orWhere('tasks.canceled_at', '>=', $since));
    }

    /**
     * @param  Builder<Task>  $query
     * @param  array<string, mixed>  $filters
     */
    private function narrow(Builder $query, array $filters, User $user): void
    {
        $today = CarbonImmutable::now(config()->string('app.office_timezone'))->startOfDay();
        $closed = TaskStatusCategory::closedValues();

        if (! empty($filters['status'])) {
            $query->where('tasks.status_id', strtolower((string) $filters['status']));
        }

        if (! empty($filters['kategori'])) {
            $query->where('tasks.status_category', $filters['kategori']);
        }

        if (! empty($filters['assignee'])) {
            $assignee = strtolower((string) $filters['assignee']);

            match ($assignee) {
                'none' => $query->whereDoesntHave('assignees'),
                'me' => $query->whereHas('assignees', fn (Builder $who) => $who->where('users.id', $user->id)),
                default => $query->whereHas('assignees', fn (Builder $who) => $who->where('users.id', $assignee)),
            };
        }

        if (! empty($filters['prioritas'])) {
            $query->whereIn('tasks.priority', array_map('intval', explode(',', (string) $filters['prioritas'])));
        }

        if (! empty($filters['label'])) {
            $ids = array_values(array_filter(array_map(fn (string $id): string => strtolower(trim($id)), explode(',', (string) $filters['label']))));
            $query->whereHas('labels', fn (Builder $label) => $label->whereIn('labels.id', $ids));
        }

        match ($filters['tenggat'] ?? null) {
            'none' => $query->whereNull('tasks.due_date'),
            'overdue' => $query->whereDate('tasks.due_date', '<', $today->toDateString())->whereNotIn('tasks.status_category', $closed),
            'today' => $query->whereDate('tasks.due_date', $today->toDateString()),
            'week' => $query->whereBetween('tasks.due_date', [$today->toDateString(), $today->endOfWeek(CarbonImmutable::SUNDAY)->toDateString()]),
            default => null,
        };

        $term = trim((string) ($filters['q'] ?? ''));

        if ($term !== '') {
            $this->search($query, $term);
        }
    }

    /**
     * @param  Builder<Task>  $query
     */
    private function search(Builder $query, string $term): void
    {
        $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], mb_strtolower($term)).'%';
        $number = preg_match('/^[A-Za-z][A-Za-z0-9]*-(\d+)$/', $term, $matches) === 1 ? (int) $matches[1] : null;

        $query->where(function (Builder $match) use ($like, $number): void {
            $match->whereRaw('lower(tasks.title) like ?', [$like])
                ->orWhereRaw("lower(coalesce(tasks.description_text, '')) like ?", [$like]);

            if ($number !== null) {
                $match->orWhere('tasks.number', $number);
            }
        });
    }

    /**
     * @param  Builder<Task>  $query
     */
    private function order(Builder $query, string $sort): void
    {
        match ($sort) {
            'prioritas' => $query->orderByRaw('case when tasks.priority = 0 then 5 else tasks.priority end')
                ->orderByRaw('tasks.due_date asc nulls last'),
            'terbaru' => $query->orderByDesc('tasks.created_at'),
            'nomor' => $query->orderBy('tasks.number'),
            default => $query->orderByRaw('tasks.due_date asc nulls last')
                ->orderByRaw('case when tasks.priority = 0 then 5 else tasks.priority end'),
        };

        $query->orderBy('tasks.number')->orderBy('tasks.id');
    }
}
