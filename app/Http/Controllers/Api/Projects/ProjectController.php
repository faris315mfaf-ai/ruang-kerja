<?php

namespace App\Http\Controllers\Api\Projects;

use App\Domain\Projects\Queries\ProjectSummary;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\Manajemen\ProjectApi;
use App\Models\ProjectUpdate;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Project detail of the Android app (Bagian 5 / B5-A): the web tab
 * "Ringkasan" (ProjectSummary — KPIs, burn-up, milestones with their derived
 * status, latest updates, open + resolved risks, overdue tasks, team load,
 * directions) plus `can` abilities, and the full update history paginated.
 * Whoever sees the project reads it (WorkspacePolicy::view; the {workspace}
 * binder answers 404 first); a non-project workspace is a 404 like the web.
 */
class ProjectController extends Controller
{
    public const int HISTORY_PAGE = 10;

    public function show(Workspace $workspace, #[CurrentUser] User $user, ProjectSummary $summary): JsonResponse
    {
        Gate::authorize('view', $workspace);
        abort_unless($workspace->isProject(), 404);

        $data = $summary->build($workspace, $user);
        $can = ProjectApi::abilities($user, $workspace);

        /** @var list<array<string, mixed>> $updates */
        $updates = $data['updates'];
        $data['updates'] = array_map(fn (array $update): array => [
            ...$update,
            'can_resolve' => $can['resolve_decision'] && $update['decision_needed'] !== null && $update['decision_resolved_at'] === null,
        ], $updates);

        return response()->json([
            ...$data,
            'updates_total' => ProjectUpdate::query()->where('workspace_id', $workspace->id)->count(),
            'can' => $can,
        ]);
    }

    /**
     * GET /proyek/{key}/update?filter=semua|keputusan|arahan&sebelum={update id}
     * — newest first, HISTORY_PAGE per page, each with its directions.
     */
    /**
     * @param  Builder<ProjectUpdate>  $query
     */
    private static function olderThan(Builder $query, ProjectUpdate $cursor): void
    {
        $query->where(fn (Builder $older) => $older
            ->where('created_at', '<', $cursor->created_at)
            ->orWhere(fn (Builder $same) => $same->where('created_at', $cursor->created_at)->where('id', '<', $cursor->id)));
    }

    public function updates(Request $request, Workspace $workspace, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('view', $workspace);
        abort_unless($workspace->isProject(), 404);

        $filter = $request->query('filter');
        $filter = is_string($filter) && in_array($filter, ['keputusan', 'arahan'], true) ? $filter : 'semua';
        $before = $request->query('sebelum');
        $cursor = is_string($before) && strlen($before) === 26
            ? ProjectUpdate::query()->where('workspace_id', $workspace->id)->find(strtolower($before))
            : null;

        $rows = ProjectUpdate::query()
            ->where('workspace_id', $workspace->id)
            ->when($filter === 'keputusan', fn (Builder $query) => $query->whereNotNull('decision_needed'))
            ->when($filter === 'arahan', fn (Builder $query) => $query->whereHas('directions'))
            ->when($cursor, fn (Builder $query, ProjectUpdate $after) => self::olderThan($query, $after))
            ->with(['author:id,name,avatar_url', 'resolver:id,name', 'directions' => fn ($query) => $query->oldest('created_at'), 'directions.author:id,name,avatar_url'])
            ->latest('created_at')
            ->latest('id')
            ->limit(self::HISTORY_PAGE + 1)
            ->get();

        $more = $rows->count() > self::HISTORY_PAGE;
        $page = $rows->take(self::HISTORY_PAGE);
        $steer = Gate::forUser($user)->allows('steerProject', $workspace);
        $last = $page->last();

        return response()->json([
            'filter' => $filter,
            'updates' => $page->map(fn (ProjectUpdate $update): array => ProjectApi::update($update, $steer))->values()->all(),
            'next_cursor' => $more && $last instanceof ProjectUpdate ? $last->id : null,
        ]);
    }
}
