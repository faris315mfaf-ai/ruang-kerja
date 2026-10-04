<?php

namespace App\Policies;

use App\Models\Activity;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * The feed is readable by whoever can see the workspace; it is append-only.
 */
class ActivityPolicy
{
    public function __construct(private readonly WorkspacePolicy $workspaces) {}

    public function view(User $user, Activity $activity): Response
    {
        return $this->workspaces->view($user, $activity->workspace);
    }

    public function update(User $user, Activity $activity): bool
    {
        return false;
    }

    public function delete(User $user, Activity $activity): bool
    {
        return false;
    }
}
