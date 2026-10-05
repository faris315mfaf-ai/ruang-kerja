<?php

namespace Database\Factories;

use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Attendance\Models\OfficeLocation;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Kiosk>
 */
class KioskFactory extends Factory
{
    protected $model = Kiosk::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn (): string => CompanyFactory::defaultId(),
            'office_location_id' => fn (array $attributes): string => OfficeLocation::factory()->create(['company_id' => $attributes['company_id']])->id,
            'name' => 'Lobi '.fake()->unique()->numberBetween(1, 9999),
            'code' => 'K-'.fake()->unique()->bothify('????##'),
            'is_active' => true,
        ];
    }

    public function at(OfficeLocation $location): static
    {
        return $this->state(fn (): array => ['company_id' => $location->company_id, 'office_location_id' => $location->id]);
    }

    /**
     * A device that already completed activation.
     */
    public function paired(): static
    {
        return $this->afterMaking(function (Kiosk $kiosk): void {
            $kiosk->activated_at = CarbonImmutable::now()->subDay();
        });
    }

    public function inactive(): static
    {
        return $this->state(fn (): array => ['is_active' => false]);
    }
}
