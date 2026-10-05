<?php

namespace Database\Factories;

use App\Domain\Attendance\Enums\HolidayType;
use App\Domain\Attendance\Models\Holiday;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Holiday>
 */
class HolidayFactory extends Factory
{
    protected $model = Holiday::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn (): string => CompanyFactory::defaultId(),
            'date' => fake()->unique()->dateTimeBetween('now', '+1 year')->format('Y-m-d'),
            'name' => 'Libur '.fake()->word(),
            'type' => HolidayType::National,
        ];
    }

    public function on(string $date, string $name = 'Hari libur'): static
    {
        return $this->state(fn (): array => ['date' => $date, 'name' => $name]);
    }
}
