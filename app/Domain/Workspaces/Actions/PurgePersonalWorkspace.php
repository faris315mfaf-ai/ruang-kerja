<?php

namespace App\Domain\Workspaces\Actions;

use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;

/**
 * Hard-deletes the personal workspace (and its tasks) of a user that is being
 * deleted — personal data leaves with its owner. Shared workspaces they own
 * keep blocking the deletion (workspaces.owner_id restricts).
 */
final class PurgePersonalWorkspace
{
    public function handle(User $user): void
    {
        DB::transaction(function () use ($user): void {
            $workspaceIds = Workspace::withTrashed()
                ->where('type', WorkspaceType::Personal->value)
                ->where('owner_id', $user->id)
                ->pluck('id');

            if ($workspaceIds->isEmpty()) {
                return;
            }

            Task::withTrashed()->whereIn('workspace_id', $workspaceIds)->forceDelete();
            Workspace::withTrashed()->whereIn('id', $workspaceIds)->forceDelete();
        });
    }
}
