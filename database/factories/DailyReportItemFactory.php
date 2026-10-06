<?php

namespace Database\Factories;

use App\Models\DailyReport;
use App\Models\DailyReportItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DailyReportItem>
 */
class DailyReportItemFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'daily_report_id' => DailyReport::factory(),
            'task_id' => null,
            'task_key' => null,
            'task_title' => null,
            'progress_note' => fake()->sentence(),
            'status_category_after' => null,
            'percent' => null,
            'hours' => null,
            'position' => 0,
        ];
    }
}
