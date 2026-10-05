<?php

namespace Tests\Fixtures\Google;

use App\Domain\Google\Contracts\WorkspaceDriveAccess;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Grants access per (user id, workspace id) for policy tests.
 */
class StubWorkspaceDriveAccess implements WorkspaceDriveAccess
{
    /** @var array<string, string> "userId|workspaceId" => viewer|contributor|manager */
    private array $grants = [];

    public function grant(User $user, string $workspaceId, string $level): self
    {
        $this->grants[$user->id.'|'.$workspaceId] = $level;

        return $this;
    }

    public function canView(User $user, string $workspaceId): bool
    {
        return isset($this->grants[$user->id.'|'.$workspaceId]);
    }

    public function canContribute(User $user, string $workspaceId): bool
    {
        return in_array($this->grants[$user->id.'|'.$workspaceId] ?? null, ['contributor', 'manager'], true);
    }

    public function canManage(User $user, string $workspaceId): bool
    {
        return ($this->grants[$user->id.'|'.$workspaceId] ?? null) === 'manager';
    }

    public function constrainVisible(Builder $query, User $user, string $workspaceColumn): Builder
    {
        $ids = [];

        foreach (array_keys($this->grants) as $key) {
            [$userId, $workspaceId] = explode('|', $key);

            if ($userId === $user->id) {
                $ids[] = $workspaceId;
            }
        }

        return $query->whereIn($workspaceColumn, $ids);
    }
}
