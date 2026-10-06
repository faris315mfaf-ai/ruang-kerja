<?php

namespace Database\Factories;

use App\Models\DailyReport;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DailyReport>
 */
class DailyReportFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn (): string => CompanyFactory::defaultId(),
            'user_id' => fn (array $attributes): string => User::factory()->create(['company_id' => $attributes['company_id']])->id,
            'report_date' => now(config()->string('app.office_timezone'))->toDateString(),
            'summary' => fake()->sentence(),
            'blockers' => null,
            'notes' => null,
            'submitted_at' => now(),
        ];
    }

    public function draft(): static
    {
        return $this->state(fn (): array => ['submitted_at' => null]);
    }

    public function on(string $date): static
    {
        return $this->state(fn (): array => ['report_date' => $date]);
    }
}
