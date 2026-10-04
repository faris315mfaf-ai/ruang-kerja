<?php

namespace App\Domain\Workspaces\Actions;

use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Domain\Workspaces\Services\MemberSynchronizer;
use App\Models\Division;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;

/**
 * Keeps the division workspace in line with the organization (PRD M3): every
 * active employee of the division is a member, the Kepala Divisi is the owner.
 * Creates the workspace when the division has none yet. Runs when a division
 * is created/changed and when an employee moves division or changes status.
 */
final class SyncDivisionMembers
{
    public function __construct(
        private readonly CreateWorkspace $createWorkspace,
        private readonly MemberSynchronizer $synchronizer,
    ) {}

    public function handle(Division $division, ?User $actor = null): ?Workspace
    {
        return DB::transaction(function () use ($division, $actor): ?Workspace {
            $workspace = Workspace::query()
                ->where('type', WorkspaceType::Division->value)
                ->where('division_id', $division->id)
                ->lockForUpdate()
                ->first();

            $head = $division->head_user_id !== null
                ? User::query()->active()->find($division->head_user_id)
                : null;

            if ($workspace === null) {
                $owner = $head ?? $actor ?? $this->fallbackOwner($division);

                if ($owner === null) {
                    return null;
                }

                $workspace = $this->createWorkspace->handle($owner, [
                    'type' => WorkspaceType::Division,
                    'name' => self::nameFor($division),
                    'key' => $division->code,
                    'visibility' => WorkspaceVisibility::Private,
                    'division_id' => $division->id,
                ], $actor);
            }

            if ($head !== null && $workspace->owner_id !== $head->id) {
                $workspace->owner_id = $head->id;
                $workspace->save();
            }

            /** @var list<string> $memberIds */
            $memberIds = User::query()
                ->active()
                ->where('division_id', $division->id)
                ->pluck('id')
                ->all();

            $desired = array_fill_keys($memberIds, WorkspaceRole::Member);
            $desired[$workspace->owner_id] = WorkspaceRole::Owner;

            $this->synchronizer->sync($workspace, $desired);

            return $workspace;
        });
    }

    /**
     * "Divisi Operasional"; the board unit keeps its own name ("Direksi").
     */
    public static function nameFor(Division $division): string
    {
        return $division->is_board ? $division->name : 'Divisi '.$division->name;
    }

    /**
     * Without a head or a signed-in actor, a Super Admin of the company owns it.
     */
    private function fallbackOwner(Division $division): ?User
    {
        return User::query()
            ->active()
            ->where('company_id', $division->company_id)
            ->role(Role::SuperAdmin->value)
            ->orderBy('id')
            ->first();
    }
}
