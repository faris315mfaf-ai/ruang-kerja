<?php

namespace App\Policies;

use App\Models\ProjectProgressSnapshot;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Snapshots are written by the nightly job only; readable with the project.
 */
class ProjectProgressSnapshotPolicy
{
    public function __construct(private readonly WorkspacePolicy $workspaces) {}

    public function view(User $user, ProjectProgressSnapshot $snapshot): Response
    {
        return $this->workspaces->view($user, $snapshot->workspace);
    }
}
