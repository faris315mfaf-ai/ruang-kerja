<?php

namespace App\Domain\Workspaces\Actions;

use App\Domain\Tasks\Actions\RecordActivity;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Domain\Workspaces\Services\RemovedMembersCleanup;
use App\Events\Workspaces\WorkspaceMembersChanged;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Removes a member. The owner cannot be removed; members synced from a
 * division/team come back on the next sync, so they cannot be removed here.
 * A removed PIC (and a sponsor who loses access) is cleared from the project and
 * overdue reminders of people who lose access are settled (RemovedMembersCleanup).
 */
final class RemoveWorkspaceMember
{
    public function __construct(
        private readonly RecordActivity $recordActivity,
        private readonly RemovedMembersCleanup $cleanup,
    ) {}

    public function handle(Workspace $workspace, User $actor, User $member): void
    {
        $row = WorkspaceMember::query()
            ->where('workspace_id', $workspace->id)
            ->where('user_id', $member->id)
            ->first();

        if ($row === null) {
            return;
        }

        if ($member->id === $workspace->owner_id) {
            throw ValidationException::withMessages(['user_id' => 'Owner tidak dapat dikeluarkan.']);
        }

        if ($row->is_synced) {
            throw ValidationException::withMessages(['user_id' => "{$member->name} tersinkron dari struktur organisasi. Ubah divisi/timnya di data karyawan."]);
        }

        DB::transaction(function () use ($workspace, $actor, $member): void {
            WorkspaceMember::query()
                ->where('workspace_id', $workspace->id)
                ->where('user_id', $member->id)
                ->delete();

            $this->cleanup->handle($workspace, [$member->id]);

            $this->recordActivity->handle($workspace, $workspace, $actor, ActivityEvent::MemberRemoved, [
                'user_id' => $member->id,
                'name' => $member->name,
            ]);

            WorkspaceMembersChanged::dispatch($workspace, [], [$member->id]);
        });
    }
}
