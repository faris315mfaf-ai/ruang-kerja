<?php

namespace Database\Factories;

use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Attendance\Models\Shift;
use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Shift>
 */
class ShiftFactory extends Factory
{
    protected $model = Shift::class;

    /**
     * Regular office hours 08.00–17.00.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn (): string => CompanyFactory::defaultId(),
            'name' => 'Reguler',
            'start_time' => '08:00',
            'end_time' => '17:00',
            'break_minutes' => 60,
            'crosses_midnight' => false,
            'late_tolerance_min' => 10,
            'early_leave_tolerance_min' => 0,
            'check_in_window_before_min' => 120,
            'office_location_id' => null,
        ];
    }

    public function forCompany(Company $company): static
    {
        return $this->state(fn (): array => ['company_id' => $company->id]);
    }

    public function hours(string $start, string $end): static
    {
        return $this->state(fn (): array => [
            'start_time' => $start,
            'end_time' => $end,
            'crosses_midnight' => Shift::timesCrossMidnight($start, $end),
        ]);
    }

    /**
     * Night shift 22.00–06.00 (crosses midnight).
     */
    public function night(): static
    {
        return $this->hours('22:00', '06:00')->state(fn (): array => ['name' => 'Malam', 'break_minutes' => 30]);
    }

    public function atLocation(OfficeLocation $location): static
    {
        return $this->state(fn (): array => ['office_location_id' => $location->id, 'company_id' => $location->company_id]);
    }
}
