<?php

namespace App\Http\Controllers\Workspaces;

use App\Domain\Tasks\Actions\SaveView;
use App\Http\Controllers\Controller;
use App\Http\Requests\Tasks\SavedViewRequest;
use App\Http\Resources\SavedViewResource;
use App\Models\SavedView;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Saved views of a workspace (filters + layout, personal or shared).
 */
class SavedViewController extends Controller
{
    public function store(SavedViewRequest $request, Workspace $workspace, #[CurrentUser] User $user, SaveView $save): JsonResponse
    {
        Gate::authorize('create', [SavedView::class, $workspace, $request->shared()]);

        $view = $save->handle($user, $workspace, [
            'name' => $request->string('name')->toString(),
            'layout' => $request->string('layout')->toString(),
            'filters' => self::filters($request),
            'is_shared' => $request->shared(),
        ]);

        return response()->json(['view' => SavedViewResource::from($view, $user)], 201);
    }

    public function update(SavedViewRequest $request, Workspace $workspace, SavedView $view, #[CurrentUser] User $user, SaveView $save): JsonResponse
    {
        abort_unless($view->workspace_id === $workspace->id, 404);
        $shared = $request->has('is_shared') ? $request->shared() : $view->is_shared;
        Gate::authorize('update', [$view, $shared]);

        $view = $save->handle($user, $workspace, [
            'name' => $request->has('name') ? $request->string('name')->toString() : $view->name,
            'layout' => $request->has('layout') ? $request->string('layout')->toString() : $view->layout,
            'filters' => $request->has('filters') ? self::filters($request) : $view->filters,
            'is_shared' => $shared,
        ], $view);

        return response()->json(['view' => SavedViewResource::from($view, $user)]);
    }

    public function destroy(Workspace $workspace, SavedView $view): JsonResponse
    {
        abort_unless($view->workspace_id === $workspace->id, 404);
        Gate::authorize('delete', $view);

        $view->delete();

        return response()->json(status: 204);
    }

    /**
     * @return array<string, mixed>
     */
    private static function filters(SavedViewRequest $request): array
    {
        $filters = $request->input('filters', []);

        return is_array($filters) ? array_filter($filters, fn (mixed $key): bool => is_string($key), ARRAY_FILTER_USE_KEY) : [];
    }
}
