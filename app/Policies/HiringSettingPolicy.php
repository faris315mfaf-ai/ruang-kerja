<?php

namespace App\Policies;

use App\Domain\Hiring\Services\HiringAccess;
use App\Models\HiringSetting;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Hiring defaults (default final approvers, checklist template): HR & Super
 * Admin only. Reviewers get 403, everyone else 404.
 */
class HiringSettingPolicy
{
    public function __construct(private readonly HiringAccess $access) {}

    public function view(User $user, ?HiringSetting $setting = null): Response
    {
        return $this->manage($user, $setting);
    }

    public function update(User $user, ?HiringSetting $setting = null): Response
    {
        return $this->manage($user, $setting);
    }

    private function manage(User $user, ?HiringSetting $setting): Response
    {
        if ($setting !== null && $setting->company_id !== $user->company_id) {
            return Response::denyAsNotFound();
        }

        if ($this->access->isManager($user)) {
            return Response::allow();
        }

        return $this->access->canEnter($user)
            ? Response::deny('Hanya HR yang dapat mengubah pengaturan hiring.')
            : Response::denyAsNotFound();
    }
}
