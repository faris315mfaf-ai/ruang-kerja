<?php

namespace App\Http\Controllers\Workspaces;

use App\Domain\Tasks\Queries\BoardTasks;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Domain\Workspaces\Queries\WorkspacePage;
use App\Http\Controllers\Controller;
use App\Http\Resources\LabelResource;
use App\Http\Resources\SavedViewResource;
use App\Http\Resources\TaskResource;
use App\Http\Resources\TaskStatusResource;
use App\Models\SavedView;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Tab "Tugas": board, list or calendar (?view=board|list|calendar&month=YYYY-MM).
 */
class WorkspaceTaskController extends Controller
{
    public const array VIEWS = ['board', 'list', 'calendar'];

    public function show(Request $request, Workspace $workspace, #[CurrentUser] User $user, WorkspacePage $page, BoardTasks $boardTasks): Response
    {
        Gate::authorize('view', $workspace);

        $view = in_array($request->query('view'), self::VIEWS, true) ? (string) $request->query('view') : 'board';
        $today = CarbonImmutable::now(CurrentCompany::timezone())->startOfDay();
        $month = self::month($request->query('month'), $today);
        $range = $view === 'calendar'
            ? [$month->startOfWeek(CarbonImmutable::MONDAY), $month->endOfMonth()->endOfWeek(CarbonImmutable::SUNDAY)]
            : null;

        return Inertia::render('workspaces/tasks', [
            ...$page->props($workspace, $user),
            'statuses' => fn (): array => TaskStatusResource::collection($workspace->statuses()->get())->resolve(),
            'labels' => fn (): array => LabelResource::collection($workspace->labels()->get())->resolve(),
            'tasks' => fn (): array => TaskResource::collection($boardTasks->for($workspace, $range, $user))->resolve(),
            'hidden_closed_count' => fn (): int => $boardTasks->hiddenClosedCount($workspace),
            'saved_views' => fn (): array => SavedView::query()
                ->visibleTo($user)
                ->where('workspace_id', $workspace->id)
                ->with('user:id,name')
                ->orderByDesc('is_shared')
                ->orderBy('name')
                ->get()
                ->map(fn (SavedView $view): array => SavedViewResource::from($view, $user))
                ->values()
                ->all(),
            'view' => $view,
            'month' => $month->toDateString(),
            'today' => $today->toDateString(),
        ]);
    }

    private static function month(mixed $value, CarbonImmutable $today): CarbonImmutable
    {
        if (is_string($value) && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $value) === 1) {
            return CarbonImmutable::createFromFormat('!Y-m', $value, $today->getTimezone()) ?: $today->startOfMonth();
        }

        return $today->startOfMonth();
    }
}
