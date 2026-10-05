<?php

namespace App\Events\Workspaces;

use App\Models\Workspace;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * A workspace was created (Sprint 7 queues CreateDriveFolder for non-personal ones).
 */
final class WorkspaceCreated implements ShouldDispatchAfterCommit
{
    use Dispatchable, SerializesModels;

    public function __construct(public Workspace $workspace) {}
}
