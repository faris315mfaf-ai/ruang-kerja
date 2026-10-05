<?php

namespace App\Domain\Workspaces\Services;

use App\Domain\Tasks\Actions\ResolveOverdueNotices;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Gate;

/**
 * Runs after people leave a workspace (RemoveWorkspaceMember and the
 * division/team MemberSynchronizer), inside the same transaction:
 *
 * - releases their project PIC/sponsor role (ProjectRolesReleaser);
 * - settles their "melewati tenggat" reminders of this workspace when they
 *   can no longer see it (in an internal workspace they still can, and the
 *   daily job keeps reminding assignees with access).
 */
final readonly class RemovedMembersCleanup
{
    public function __construct(
        private ProjectRolesReleaser $projectRoles,
        private ResolveOverdueNotices $overdueNotices,
    ) {}

    /**
     * @param  list<string>  $removedUserIds
     */
    public function handle(Workspace $workspace, array $removedUserIds): void
    {
        if ($removedUserIds === []) {
            return;
        }

        $this->projectRoles->release($workspace, $removedUserIds);

        $lostAccess = [];

        foreach (User::query()->whereKey($removedUserIds)->get() as $user) {
            if (Gate::forUser($user)->denies('view', $workspace)) {
                $lostAccess[] = $user->id;
            }
        }

        $this->overdueNotices->handle($workspace, $lostAccess);
    }
}
