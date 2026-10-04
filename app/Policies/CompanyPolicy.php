<?php

namespace App\Policies;

use App\Domain\Organization\Enums\Permission;
use App\Models\Company;
use App\Models\User;

/**
 * Phase 1 has exactly one company: it is created by setup/seeders, never via UI.
 */
class CompanyPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission(Permission::SettingsManage);
    }

    public function view(User $actor, Company $company): bool
    {
        return $actor->company_id === $company->id;
    }

    public function create(User $actor): bool
    {
        return false;
    }

    /**
     * Name, Google domain, timezone and settings (Super Admin).
     */
    public function update(User $actor, Company $company): bool
    {
        return $actor->company_id === $company->id && $actor->hasPermission(Permission::SettingsManage);
    }

    public function delete(User $actor, Company $company): bool
    {
        return false;
    }
}
