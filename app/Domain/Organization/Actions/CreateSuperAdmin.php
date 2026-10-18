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
 * - $newCompany: a new company named $companyName, Google domain $domain or
 *   the e-mail's domain (companies.google_domain is unique: a domain already
 *   used by another company is refused with a clear message);
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
    public function handle(string $email, string $name, string $password, ?string $companyName = null, ?string $company = null, bool $newCompany = false, ?string $domain = null): User
    {
        $email = Str::lower(trim($email));
        $domain = $domain === null || trim($domain) === '' ? null : Str::lower(trim($domain));

        return DB::transaction(function () use ($email, $name, $password, $companyName, $company, $newCompany, $domain): User {
            $existing = User::query()->where('email', $email)->first();
            $target = $this->company($email, $existing, $companyName, $company, $newCompany, $domain);

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

    private function company(string $email, ?User $existing, ?string $companyName, ?string $key, bool $newCompany, ?string $domain): Company
    {
        $count = Company::query()->count();

        // --domain only names the Google domain of a company created here.
        if ($domain !== null && ! $newCompany && ($existing !== null || $count > 0)) {
            throw new InvalidArgumentException('--domain hanya untuk perusahaan baru (--new-company=<nama>).');
        }

        if ($existing !== null) {
            $company = Company::query()->findOrFail($existing->company_id);

            if ($newCompany || ($key !== null && ! $this->matches($company, $key))) {
                throw new InvalidArgumentException("{$email} sudah terdaftar di perusahaan {$company->name}.");
            }

            return $company;
        }

        if ($newCompany) {
            return $this->create($email, $companyName, $domain);
        }

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
            $count === 0 => $this->create($email, $companyName ?? $key, $domain),
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

    private function create(string $email, ?string $name, ?string $domain): Company
    {
        $domain ??= Str::lower(Str::after($email, '@'));

        if (preg_match('/^(?=.{1,150}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/', $domain) !== 1) {
            throw new InvalidArgumentException("Domain \"{$domain}\" tidak sah; contoh: perusahaan.co.id.");
        }

        // companies.google_domain is unique across companies (deleted ones included).
        $owner = Company::withTrashed()->where('google_domain', $domain)->first();

        if ($owner !== null) {
            throw new InvalidArgumentException("Domain {$domain} sudah dipakai perusahaan {$owner->name}; gunakan --domain=<domain lain>.");
        }

        return Company::query()->create([
            'name' => $name ?? (string) config('branding.company_name'),
            'google_domain' => $domain,
        ]);
    }
}
