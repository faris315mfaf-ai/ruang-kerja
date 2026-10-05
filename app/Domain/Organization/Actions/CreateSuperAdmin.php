<?php

namespace App\Domain\Organization\Actions;

use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Models\Company;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Bootstraps (or promotes) a super_admin on a fresh installation. Creates the
 * company from the e-mail domain when none exists yet. Roles must be seeded
 * first (`php artisan db:seed --force` runs RoleSeeder in production).
 */
final readonly class CreateSuperAdmin
{
    public function __construct(private SyncUserRoles $syncRoles) {}

    public function handle(string $email, string $name, string $password, ?string $companyName = null): User
    {
        $email = Str::lower(trim($email));

        return DB::transaction(function () use ($email, $name, $password, $companyName): User {
            $company = Company::query()->orderBy('id')->first()
                ?? Company::query()->create([
                    'name' => $companyName ?? (string) config('branding.company_name'),
                    'google_domain' => Str::after($email, '@'),
                ]);

            $user = User::query()->firstOrNew(['email' => $email]);

            $user->fill([
                'company_id' => $user->company_id ?? $company->id,
                'name' => $name,
                'password' => $password,
                'status' => UserStatus::Active,
            ]);

            if ($user->email_verified_at === null) {
                $user->forceFill(['email_verified_at' => now()]);
            }

            $user->save();

            // Keep the roles the user already has, add super_admin.
            $roles = [Role::SuperAdmin];

            foreach ($user->roles()->pluck('name') as $name) {
                $role = Role::tryFrom((string) $name);

                if ($role !== null && $role !== Role::SuperAdmin) {
                    $roles[] = $role;
                }
            }

            $this->syncRoles->handle($user, $roles);

            return $user;
        });
    }
}
