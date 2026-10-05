<?php

namespace App\Domain\Workspaces\Services;

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Gate;

/**
 * Keeps a project's PIC (`lead_user_id`) and sponsor (`sponsor_user_id`)
 * consistent with its members after people are removed (manually or by the
 * division/team sync):
 *
 * - the PIC must be a member (ProjectAttributesRequest), so a removed PIC is
 *   cleared;
 * - the sponsor need not be a member (Direksi), so a removed sponsor is only
 *   cleared when they can no longer see the project at all.
 *
 * Otherwise a former PIC/sponsor would keep the project on their portfolio and
 * keep receiving its reminders and directions.
 */
final class ProjectRolesReleaser
{
    /**
     * @param  list<string>  $removedUserIds
     */
    public function release(Workspace $workspace, array $removedUserIds): void
    {
        if ($removedUserIds === [] || ! $workspace->isProject()) {
            return;
        }

        $changes = [];

        if ($workspace->lead_user_id !== null && in_array($workspace->lead_user_id, $removedUserIds, true)) {
            $changes['lead_user_id'] = null;
        }

        if ($workspace->sponsor_user_id !== null && in_array($workspace->sponsor_user_id, $removedUserIds, true)) {
            $sponsor = User::query()->find($workspace->sponsor_user_id);

            if ($sponsor === null || Gate::forUser($sponsor)->denies('view', $workspace)) {
                $changes['sponsor_user_id'] = null;
            }
        }

        if ($changes === []) {
            return;
        }

        $workspace->forceFill($changes)->save();
    }
}
