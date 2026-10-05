<?php

namespace App\Policies;

use App\Models\ProjectRisk;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Auth\Access\Response;

/**
 * Risks follow their project (see MilestonePolicy).
 */
class ProjectRiskPolicy
{
    public function __construct(private readonly WorkspacePolicy $workspaces) {}

    public function view(User $user, ProjectRisk $risk): Response
    {
        return $this->workspaces->view($user, $risk->workspace);
    }

    public function create(User $user, Workspace $workspace): Response
    {
        return $this->workspaces->manageProject($user, $workspace);
    }

    public function update(User $user, ProjectRisk $risk): Response
    {
        return $this->workspaces->manageProject($user, $risk->workspace);
    }

    public function delete(User $user, ProjectRisk $risk): Response
    {
        return $this->workspaces->manageProject($user, $risk->workspace);
    }
}
