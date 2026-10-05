<?php

namespace App\Policies;

use App\Models\Milestone;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Auth\Access\Response;

/**
 * Milestones follow their project: everyone who sees the project reads them;
 * the PIC and workspace admins change them (WorkspacePolicy::manageProject).
 */
class MilestonePolicy
{
    public function __construct(private readonly WorkspacePolicy $workspaces) {}

    public function view(User $user, Milestone $milestone): Response
    {
        return $this->workspaces->view($user, $milestone->workspace);
    }

    public function create(User $user, Workspace $workspace): Response
    {
        return $this->workspaces->manageProject($user, $workspace);
    }

    public function update(User $user, Milestone $milestone): Response
    {
        return $this->workspaces->manageProject($user, $milestone->workspace);
    }

    public function delete(User $user, Milestone $milestone): Response
    {
        return $this->workspaces->manageProject($user, $milestone->workspace);
    }
}
