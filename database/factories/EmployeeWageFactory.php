<?php

namespace Database\Factories;

use App\Domain\Payroll\Models\EmployeeWage;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EmployeeWage>
 */
class EmployeeWageFactory extends Factory
{
    protected $model = EmployeeWage::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn (): string => CompanyFactory::defaultId(),
            'user_id' => fn (array $attributes): string => User::factory()->create(['company_id' => $attributes['company_id']])->id,
            'daily_wage' => 150_000,
            'effective_from' => '2026-01-01',
            'note' => null,
            'created_by' => null,
        ];
    }

    public function forEmployee(User $user): static
    {
        return $this->state(fn (): array => ['company_id' => $user->company_id, 'user_id' => $user->id]);
    }

    public function amount(int $dailyWage, string $effectiveFrom = '2026-01-01'): static
    {
        return $this->state(fn (): array => ['daily_wage' => $dailyWage, 'effective_from' => $effectiveFrom]);
    }
}
