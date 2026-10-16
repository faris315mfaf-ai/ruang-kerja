<?php

namespace App\Http\Controllers\Api\Projects;

use App\Domain\Projects\Actions\DeleteProjectRisk;
use App\Domain\Projects\Actions\SaveProjectRisk;
use App\Domain\Projects\Enums\RiskStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Manajemen\RiskStatusRequest;
use App\Http\Requests\Projects\ProjectRiskRequest;
use App\Http\Resources\Api\Manajemen\ProjectApi;
use App\Models\ProjectRisk;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Risk CRUD of the Android app (PIC / workspace admin, ProjectRiskPolicy):
 * the web SaveProjectRisk / DeleteProjectRisk. `status` changes only the
 * state ("Tandai teratasi" / "Buka lagi") and keeps the other fields.
 */
class ProjectRiskController extends Controller
{
    public function store(ProjectRiskRequest $request, Workspace $workspace, #[CurrentUser] User $user, SaveProjectRisk $action): JsonResponse
    {
        Gate::authorize('create', [ProjectRisk::class, $workspace]);

        $risk = $action->handle($workspace, $user, $request->payload());

        return response()->json(['message' => 'Risiko ditambahkan.', 'risk' => ProjectApi::risk($workspace, $risk->refresh())], 201);
    }

    public function update(ProjectRiskRequest $request, Workspace $workspace, ProjectRisk $risk, #[CurrentUser] User $user, SaveProjectRisk $action): JsonResponse
    {
        Gate::authorize('update', $risk);

        $risk = $action->handle($workspace, $user, $request->payload(), $risk);

        return response()->json(['message' => 'Risiko disimpan.', 'risk' => ProjectApi::risk($workspace, $risk->refresh())]);
    }

    public function status(RiskStatusRequest $request, Workspace $workspace, ProjectRisk $risk, #[CurrentUser] User $user, SaveProjectRisk $action): JsonResponse
    {
        Gate::authorize('update', $risk);

        $status = $request->status();
        $risk = $action->handle($workspace, $user, [
            'title' => $risk->title,
            'level' => $risk->level,
            'owner_id' => $risk->owner_id,
            'task_id' => $risk->task_id,
            'status' => $status,
        ], $risk);

        return response()->json([
            'message' => $status === RiskStatus::Resolved ? 'Risiko ditandai teratasi.' : 'Risiko dibuka lagi.',
            'risk' => ProjectApi::risk($workspace, $risk->refresh()),
        ]);
    }

    public function destroy(Workspace $workspace, ProjectRisk $risk, #[CurrentUser] User $user, DeleteProjectRisk $action): JsonResponse
    {
        Gate::authorize('delete', $risk);

        $action->handle($risk, $user);

        return response()->json(status: 204);
    }
}
