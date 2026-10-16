<?php

namespace App\Http\Controllers\Api\Projects;

use App\Domain\Projects\Actions\PostProjectUpdate;
use App\Domain\Projects\Actions\ResolveProjectDecision;
use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\ProjectUpdateRequest;
use App\Http\Resources\Api\Manajemen\ProjectApi;
use App\Models\ProjectUpdate;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * "Update proyek" (PIC / workspace admin; snapshot of actual and planned
 * progress filled by PostProjectUpdate) and "Tandai keputusan selesai"
 * (Direksi) — the web Actions, Policies and FormRequest.
 */
class ProjectUpdateController extends Controller
{
    public function store(ProjectUpdateRequest $request, Workspace $workspace, #[CurrentUser] User $user, PostProjectUpdate $action): JsonResponse
    {
        Gate::authorize('create', [ProjectUpdate::class, $workspace]);

        $update = $action->handle($workspace, $user, $request->payload());

        return response()->json([
            'message' => 'Update proyek terkirim.',
            'update' => ProjectApi::update(self::fresh($update), Gate::forUser($user)->allows('steerProject', $workspace)),
        ], 201);
    }

    public function resolveDecision(Workspace $workspace, ProjectUpdate $projectUpdate, #[CurrentUser] User $user, ResolveProjectDecision $action): JsonResponse
    {
        Gate::authorize('resolveDecision', $projectUpdate);

        $update = $action->handle($projectUpdate, $user);

        return response()->json([
            'message' => 'Keputusan ditandai selesai.',
            'update' => ProjectApi::update(self::fresh($update), true),
        ]);
    }

    private static function fresh(ProjectUpdate $update): ProjectUpdate
    {
        return $update->refresh()->load(['author:id,name,avatar_url', 'resolver:id,name', 'directions' => fn ($query) => $query->oldest('created_at'), 'directions.author:id,name,avatar_url']);
    }
}
