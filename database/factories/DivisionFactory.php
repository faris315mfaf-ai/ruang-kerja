<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Division;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Division>
 */
class DivisionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn (): string => CompanyFactory::defaultId(),
            'parent_id' => null,
            'name' => 'Divisi '.fake()->unique()->word(),
            'code' => strtoupper(fake()->unique()->bothify('??##')),
            'head_user_id' => null,
            'is_board' => false,
        ];
    }

    public function forCompany(Company $company): static
    {
        return $this->state(fn (): array => ['company_id' => $company->id]);
    }

    /**
     * The Direksi unit.
     */
    public function board(): static
    {
        return $this->state(fn (): array => ['name' => 'Direksi', 'code' => 'DIR', 'is_board' => true]);
    }

    public function headedBy(User $head): static
    {
        return $this->state(fn (): array => ['head_user_id' => $head->id, 'company_id' => $head->company_id]);
    }

    public function childOf(Division $parent): static
    {
        return $this->state(fn (): array => ['parent_id' => $parent->id, 'company_id' => $parent->company_id]);
    }
}
