<?php

namespace App\Listeners\Chat;

use App\Domain\Chat\Actions\SyncWorkspaceChannel;
use App\Events\Workspaces\WorkspaceCreated;
use App\Events\Workspaces\WorkspaceMembersChanged;

/**
 * Keeps the automatic Obrolan channel of a workspace in step with the
 * workspace (creation, members added/removed, roles). Both events fire after
 * commit; the sync itself is idempotent (SyncWorkspaceChannel).
 */
final class SyncWorkspaceChannelMembers
{
    public function __construct(private readonly SyncWorkspaceChannel $sync) {}

    public function handle(WorkspaceCreated|WorkspaceMembersChanged $event): void
    {
        $this->sync->handle($event->workspace);
    }
}
