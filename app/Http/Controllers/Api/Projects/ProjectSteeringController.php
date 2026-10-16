<?php

namespace App\Http\Controllers\Api\Projects;

use App\Domain\Projects\Actions\GiveProjectDirection;
use App\Domain\Projects\Actions\RequestProjectUpdate;
use App\Domain\Projects\Services\ProjectPresenter;
use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\ProjectDirectionRequest;
use App\Http\Requests\Projects\RequestProjectUpdateRequest;
use App\Http\Resources\Api\Manajemen\ProjectApi;
use App\Models\ProjectDirection;
use App\Models\ProjectUpdate;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Direksi actions on a project: "Minta update" (notifies the PIC, or the
 * owner without a PIC) and "Beri arahan" (optionally replying to one update).
 * WorkspacePolicy::steerProject through the web Policies.
 */
class ProjectSteeringController extends Controller
{
    public function requestUpdate(RequestProjectUpdateRequest $request, Workspace $workspace, #[CurrentUser] User $user, RequestProjectUpdate $action): JsonResponse
    {
        Gate::authorize('steerProject', $workspace);

        $recipient = $action->handle($workspace, $user, $request->note());

        return response()->json([
            'message' => "Permintaan update dikirim ke {$recipient->name}.",
            'recipient' => ProjectPresenter::person($recipient),
        ]);
    }

    public function direct(ProjectDirectionRequest $request, Workspace $workspace, #[CurrentUser] User $user, GiveProjectDirection $action): JsonResponse
    {
        Gate::authorize('create', [ProjectDirection::class, $workspace]);

        $updateId = $request->updateId();
        $update = $updateId !== null ? ProjectUpdate::query()->where('workspace_id', $workspace->id)->findOrFail($updateId) : null;

        $direction = $action->handle($workspace, $user, $request->body(), $update);
        $direction->load('author:id,name,avatar_url');

        return response()->json([
            'message' => 'Arahan terkirim ke PIC.',
            'direction' => ProjectApi::direction($direction),
        ], 201);
    }
}
