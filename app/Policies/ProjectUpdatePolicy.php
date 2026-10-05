<?php

namespace App\Policies;

use App\Models\ProjectUpdate;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Auth\Access\Response;

/**
 * Weekly updates: written only by the PIC / workspace admins, never edited
 * afterwards (history). Direksi resolve the decision an update asks for.
 */
class ProjectUpdatePolicy
{
    public function __construct(private readonly WorkspacePolicy $workspaces) {}

    public function view(User $user, ProjectUpdate $update): Response
    {
        return $this->workspaces->view($user, $update->workspace);
    }

    public function create(User $user, Workspace $workspace): Response
    {
        return $this->workspaces->manageProject($user, $workspace);
    }

    /**
     * "Tandai keputusan selesai" / "Setujui".
     */
    public function resolveDecision(User $user, ProjectUpdate $update): Response
    {
        $steer = $this->workspaces->steerProject($user, $update->workspace);

        if ($steer->denied()) {
            return $steer;
        }

        return $update->hasOpenDecision()
            ? Response::allow()
            : Response::deny('Keputusan ini sudah ditandai selesai.');
    }
}
