<?php

namespace Database\Factories;

use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\Company;
use App\Models\Division;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role as RoleModel;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn (): string => CompanyFactory::defaultId(),
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
            'work_mode' => WorkMode::Office,
            'status' => UserStatus::Active,
            'joined_at' => fake()->dateTimeBetween('-5 years', '-1 month')->format('Y-m-d'),
        ];
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }

    /**
     * Indicate that the model has two-factor authentication configured.
     */
    public function withTwoFactor(): static
    {
        return $this->state(fn (array $attributes) => [
            'two_factor_secret' => encrypt('secret'),
            'two_factor_recovery_codes' => encrypt(json_encode(['recovery-code-1'])),
            'two_factor_confirmed_at' => now(),
        ]);
    }

    public function inactive(): static
    {
        return $this->state(fn (): array => ['status' => UserStatus::Inactive]);
    }

    public function resigned(): static
    {
        return $this->state(fn (): array => ['status' => UserStatus::Resigned]);
    }

    public function forCompany(Company $company): static
    {
        return $this->state(fn (): array => ['company_id' => $company->id]);
    }

    public function inDivision(Division $division, ?Team $team = null): static
    {
        return $this->state(fn (): array => [
            'company_id' => $division->company_id,
            'division_id' => $division->id,
            'team_id' => $team?->id,
        ]);
    }

    public function managedBy(User $manager): static
    {
        return $this->state(fn (): array => ['manager_id' => $manager->id, 'company_id' => $manager->company_id]);
    }

    public function workMode(WorkMode $mode): static
    {
        return $this->state(fn (): array => ['work_mode' => $mode]);
    }

    /**
     * Assign global roles after creation (creates missing roles; seed RoleSeeder
     * first when permissions matter).
     */
    public function withRole(Role ...$roles): static
    {
        return $this->afterCreating(function (User $user) use ($roles): void {
            foreach ($roles as $role) {
                RoleModel::findOrCreate($role->value, 'web');
            }

            $user->assignRole(array_map(fn (Role $role): string => $role->value, $roles));
        });
    }
}
