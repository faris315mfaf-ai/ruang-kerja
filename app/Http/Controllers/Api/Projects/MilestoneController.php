<?php

namespace App\Http\Controllers\Api\Projects;

use App\Domain\Projects\Actions\DeleteMilestone;
use App\Domain\Projects\Actions\SaveMilestone;
use App\Domain\Projects\Actions\SetMilestoneCompletion;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Manajemen\MilestoneCompletionRequest;
use App\Http\Requests\Projects\MilestoneRequest;
use App\Http\Resources\Api\Manajemen\ProjectApi;
use App\Models\Milestone;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Milestone CRUD of the Android app (PIC / workspace admin, MilestonePolicy
 * → WorkspacePolicy::manageProject), the web Actions and FormRequest.
 */
class MilestoneController extends Controller
{
    public function store(MilestoneRequest $request, Workspace $workspace, #[CurrentUser] User $user, SaveMilestone $action): JsonResponse
    {
        Gate::authorize('create', [Milestone::class, $workspace]);

        $milestone = $action->handle($workspace, $user, $request->payload());

        return response()->json(['message' => 'Milestone ditambahkan.', 'milestone' => ProjectApi::milestone($workspace, $milestone->refresh())], 201);
    }

    public function update(MilestoneRequest $request, Workspace $workspace, Milestone $milestone, #[CurrentUser] User $user, SaveMilestone $action): JsonResponse
    {
        Gate::authorize('update', $milestone);

        $milestone = $action->handle($workspace, $user, $request->payload(), $milestone);

        return response()->json(['message' => 'Milestone disimpan.', 'milestone' => ProjectApi::milestone($workspace, $milestone->refresh())]);
    }

    public function complete(MilestoneCompletionRequest $request, Workspace $workspace, Milestone $milestone, #[CurrentUser] User $user, SetMilestoneCompletion $action): JsonResponse
    {
        Gate::authorize('update', $milestone);

        $completed = $request->boolean('completed');
        $milestone = $action->handle($milestone, $user, $completed);

        return response()->json([
            'message' => $completed ? 'Milestone ditandai selesai.' : 'Milestone dibuka kembali.',
            'milestone' => ProjectApi::milestone($workspace, $milestone->refresh()),
        ]);
    }

    public function destroy(Workspace $workspace, Milestone $milestone, #[CurrentUser] User $user, DeleteMilestone $action): JsonResponse
    {
        Gate::authorize('delete', $milestone);

        $action->handle($milestone, $user);

        return response()->json(status: 204);
    }
}
