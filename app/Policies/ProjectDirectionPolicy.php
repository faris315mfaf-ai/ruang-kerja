<?php

namespace App\Policies;

use App\Models\ProjectDirection;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Auth\Access\Response;

/**
 * "Beri arahan": Direksi write, everyone who sees the project reads.
 */
class ProjectDirectionPolicy
{
    public function __construct(private readonly WorkspacePolicy $workspaces) {}

    public function view(User $user, ProjectDirection $direction): Response
    {
        return $this->workspaces->view($user, $direction->workspace);
    }

    public function create(User $user, Workspace $workspace): Response
    {
        return $this->workspaces->steerProject($user, $workspace);
    }
}
