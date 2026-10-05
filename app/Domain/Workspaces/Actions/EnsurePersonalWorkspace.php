<?php

namespace App\Domain\Workspaces\Actions;

use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Domain\Workspaces\Services\WorkspaceKeyGenerator;
use App\Models\User;
use App\Models\Workspace;

/**
 * Every employee has exactly one personal workspace ("Pribadi"), visible only
 * to them. Idempotent; safe to call on every sign-up or from the seeder.
 */
final class EnsurePersonalWorkspace
{
    public function __construct(private readonly CreateWorkspace $createWorkspace) {}

    public function handle(User $user): Workspace
    {
        $existing = Workspace::withTrashed()
            ->where('type', WorkspaceType::Personal->value)
            ->where('owner_id', $user->id)
            ->first();

        if ($existing !== null) {
            if ($existing->trashed()) {
                $existing->restore();
            }

            return $existing;
        }

        return $this->createWorkspace->handle($user, [
            'type' => WorkspaceType::Personal,
            'name' => 'Pribadi',
            'key' => WorkspaceKeyGenerator::fromName($user->name),
            'visibility' => WorkspaceVisibility::Private,
        ]);
    }
}
