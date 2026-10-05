<?php

namespace App\Policies;

use App\Models\TaskStatus;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Board columns are part of the workspace settings.
 */
class TaskStatusPolicy
{
    public function __construct(private readonly WorkspacePolicy $workspaces) {}

    public function update(User $user, TaskStatus $status): Response
    {
        return $this->workspaces->update($user, $status->workspace);
    }

    public function delete(User $user, TaskStatus $status): Response
    {
        return $this->workspaces->update($user, $status->workspace);
    }
}
