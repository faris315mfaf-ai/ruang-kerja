<?php

namespace App\Http\Controllers\Api\Task;

use App\Domain\Tasks\Actions\SaveView;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\TaskViewRequest;
use App\Http\Resources\SavedViewResource;
use App\Models\SavedView;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * Saved views of "Tugas saya" (saved_views, docs/DATABASE.md §4): personal
 * cross-workspace views (workspace_id null, only their owner) and — with
 * `workspace_id` — the web workspace views under the same SavedViewPolicy
 * (personal for the owner, shared for everyone who can see the workspace,
 * sharing needs task edit rights, a shared view is also removable by a
 * workspace admin). An unseen view or workspace is a 404.
 */
class TaskViewController extends Controller
{
    /** Personal cross-workspace views per user. */
    public const int MAX_PERSONAL = 20;

    public function index(Request $request, #[CurrentUser] User $user): JsonResponse
    {
        $data = $request->validate(['workspace_id' => ['sometimes', 'nullable', 'string', 'size:26']]);

        $query = SavedView::query()->with('user:id,name');

        if (filled($data['workspace_id'] ?? null)) {
            $workspace = $this->workspace((string) $data['workspace_id']);
            Gate::authorize('view', $workspace);
            $query->visibleTo($user)->where('workspace_id', $workspace->id);
        } else {
            $query->where('user_id', $user->id)->whereNull('workspace_id');
        }

        return response()->json(['views' => $query->orderBy('name')->orderBy('id')->get()
            ->map(fn (SavedView $view): array => self::present($view, $user))
            ->values()
            ->all()]);
    }

    public function store(TaskViewRequest $request, #[CurrentUser] User $user, SaveView $save): JsonResponse
    {
        $workspace = filled($request->input('workspace_id')) ? $this->workspace($request->string('workspace_id')->toString()) : null;

        if ($workspace !== null) {
            Gate::authorize('create', [SavedView::class, $workspace, $request->shared()]);
        } else {
            $this->assertPersonal($request, $user);
        }

        $view = $save->handle($user, $workspace, [
            'name' => $request->string('name')->toString(),
            'layout' => $request->input('layout', 'list'),
            'filters' => $request->filters(),
            'is_shared' => $request->shared(),
        ]);

        return response()->json(['view' => self::present($view->load('user:id,name'), $user)], 201);
    }

    public function update(TaskViewRequest $request, SavedView $view, #[CurrentUser] User $user, SaveView $save): JsonResponse
    {
        $shared = $request->has('is_shared') ? $request->shared() : $view->is_shared;

        // Owner and visibility first (404 / 403), then the sharing rules.
        Gate::authorize('update', [$view, false]);

        if ($view->workspace_id === null && $shared) {
            $this->assertPersonal($request, $user, false);
        }

        if ($shared) {
            Gate::authorize('update', [$view, true]);
        }

        $view = $save->handle($user, $view->workspace, [
            'name' => $request->has('name') ? $request->string('name')->toString() : $view->name,
            'layout' => $request->has('layout') ? $request->string('layout')->toString() : $view->layout,
            'filters' => $request->has('filters') ? $request->filters() : $view->filters,
            'is_shared' => $shared,
        ], $view);

        return response()->json(['view' => self::present($view->load('user:id,name'), $user)]);
    }

    public function destroy(SavedView $view): JsonResponse
    {
        Gate::authorize('delete', $view);

        $view->delete();

        return response()->json(status: 204);
    }

    /**
     * A view without workspace is personal and capped.
     */
    private function assertPersonal(TaskViewRequest $request, User $user, bool $creating = true): void
    {
        if ($request->shared()) {
            throw ValidationException::withMessages(['is_shared' => 'Tampilan lintas workspace hanya bisa pribadi.']);
        }

        if ($creating && SavedView::query()->where('user_id', $user->id)->whereNull('workspace_id')->count() >= self::MAX_PERSONAL) {
            throw ValidationException::withMessages(['name' => 'Maksimal '.self::MAX_PERSONAL.' tampilan tersimpan. Hapus yang tidak terpakai dulu.']);
        }
    }

    private function workspace(string $id): Workspace
    {
        // ULIDs are stored lowercase; the app may send the canonical uppercase form.
        $workspace = Workspace::query()->find(strtolower($id));

        abort_if($workspace === null, 404);

        return $workspace;
    }

    /**
     * @return array<string, mixed>
     */
    private static function present(SavedView $view, User $viewer): array
    {
        return [
            ...SavedViewResource::from($view, $viewer),
            'workspace_id' => $view->workspace_id,
            'sort' => $view->sort,
        ];
    }
}
