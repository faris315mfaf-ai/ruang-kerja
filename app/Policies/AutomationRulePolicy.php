<?php

namespace App\Policies;

use App\Domain\Automation\Services\AutomationAccess;
use App\Models\AutomationRule;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Auth\Access\Response;

/**
 * Automation rules (F2-4): seen by the workspace's members, created, changed,
 * paused and deleted by its owner/admin. No global role (Direksi, HR, Super
 * Admin) reads or manages another workspace's rules. Not a member → 404.
 */
class AutomationRulePolicy
{
    private const string MANAGE = 'Hanya owner atau admin workspace yang bisa mengatur otomasi.';

    public function __construct(private readonly AutomationAccess $access) {}

    /**
     * Lists are always scoped with AutomationRule::visibleTo().
     */
    public function viewAny(User $user): bool
    {
        return $user->isActive();
    }

    public function view(User $user, AutomationRule $rule): Response
    {
        return $this->access->isMember($user, $rule->workspace) ? Response::allow() : Response::denyAsNotFound();
    }

    public function create(User $user, Workspace $workspace): Response
    {
        return $this->access->gate($user, $workspace, $this->access->canManage($user, $workspace), self::MANAGE);
    }

    public function update(User $user, AutomationRule $rule): Response
    {
        return $this->create($user, $rule->workspace);
    }

    public function delete(User $user, AutomationRule $rule): Response
    {
        return $this->create($user, $rule->workspace);
    }
}
