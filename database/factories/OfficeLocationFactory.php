<?php

namespace Database\Factories;

use App\Domain\Attendance\Models\OfficeLocation;
use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OfficeLocation>
 */
class OfficeLocationFactory extends Factory
{
    protected $model = OfficeLocation::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn (): string => CompanyFactory::defaultId(),
            'name' => 'Kantor '.fake()->unique()->city(),
            'address' => fake()->streetAddress(),
            // Around Jakarta.
            'latitude' => fake()->randomFloat(7, -6.30, -6.10),
            'longitude' => fake()->randomFloat(7, 106.70, 106.95),
            'radius_m' => 100,
            'is_active' => true,
        ];
    }

    public function forCompany(Company $company): static
    {
        return $this->state(fn (): array => ['company_id' => $company->id]);
    }

    public function at(float $latitude, float $longitude, int $radius = 100): static
    {
        return $this->state(fn (): array => ['latitude' => $latitude, 'longitude' => $longitude, 'radius_m' => $radius]);
    }

    public function inactive(): static
    {
        return $this->state(fn (): array => ['is_active' => false]);
    }
}
