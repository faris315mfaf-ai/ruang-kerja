<?php

namespace App\Domain\Organization\Actions;

use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Models\Company;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Bootstraps (or promotes) a super_admin. Roles must be seeded first
 * (`php artisan db:seed --force` runs RoleSeeder in production).
 *
 * Company (Fase 1 multi-perusahaan — never "the first company" by accident):
 * - an existing user stays in their company;
 * - $newCompany: a new company named $companyName (domain from the e-mail);
 * - $company: an existing company by id, Google domain or name;
 * - otherwise the only company, or a new one on a fresh installation. With
 *   several companies the caller must choose.
 */
final readonly class CreateSuperAdmin
{
    public function __construct(private SyncUserRoles $syncRoles) {}

    /**
     * @throws InvalidArgumentException when the company cannot be determined
     */
    public function handle(string $email, string $name, string $password, ?string $companyName = null, ?string $company = null, bool $newCompany = false): User
    {
        $email = Str::lower(trim($email));

        return DB::transaction(function () use ($email, $name, $password, $companyName, $company, $newCompany): User {
            $existing = User::query()->where('email', $email)->first();
            $target = $this->company($email, $existing, $companyName, $company, $newCompany);

            $user = $existing ?? new User(['email' => $email]);

            $user->fill([
                'company_id' => $user->company_id ?? $target->id,
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

    private function company(string $email, ?User $existing, ?string $companyName, ?string $key, bool $newCompany): Company
    {
        if ($existing !== null) {
            $company = Company::query()->findOrFail($existing->company_id);

            if ($newCompany || ($key !== null && ! $this->matches($company, $key))) {
                throw new InvalidArgumentException("{$email} sudah terdaftar di perusahaan {$company->name}.");
            }

            return $company;
        }

        if ($newCompany) {
            return $this->create($email, $companyName);
        }

        $count = Company::query()->count();

        if ($key !== null && $count > 0) {
            $found = Company::query()->get()->filter(fn (Company $company): bool => $this->matches($company, $key));

            return match ($found->count()) {
                1 => $found->firstOrFail(),
                0 => throw new InvalidArgumentException("Perusahaan \"{$key}\" tidak ditemukan (pakai id, domain Google, atau nama)."),
                default => throw new InvalidArgumentException("\"{$key}\" cocok dengan beberapa perusahaan; pakai id atau domain Google."),
            };
        }

        return match (true) {
            // Fresh installation: --company is the new company's name.
            $count === 0 => $this->create($email, $companyName ?? $key),
            $count === 1 => Company::query()->firstOrFail(),
            default => throw new InvalidArgumentException('Ada beberapa perusahaan: pilih dengan --company=<id|domain> atau buat baru dengan --new-company=<nama>.'),
        };
    }

    private function matches(Company $company, string $key): bool
    {
        $key = trim($key);

        return $company->id === $key
            || Str::lower((string) $company->google_domain) === Str::lower($key)
            || Str::lower($company->name) === Str::lower($key);
    }

    private function create(string $email, ?string $name): Company
    {
        return Company::query()->create([
            'name' => $name ?? (string) config('branding.company_name'),
            'google_domain' => Str::after($email, '@'),
        ]);
    }
}
