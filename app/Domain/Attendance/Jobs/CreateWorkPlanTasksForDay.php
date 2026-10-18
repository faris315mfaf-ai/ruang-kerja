<?php

namespace App\Domain\Attendance\Jobs;

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Tasks\Actions\CreateWorkPlanTasks;
use App\Domain\Tenancy\Concerns\CompanyAware;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

/**
 * Turns the work plan of a committed check-in into tasks ("rencana kerja jadi
 * tugas otomatis", keputusan pemilik 9 Okt 2026). Dispatched by CheckIn after
 * its transaction commits, so a failure in the task chain can never roll the
 * check-in back or be mistaken for "already checked in". CreateWorkPlanTasks
 * is idempotent per day; the row lock serializes parallel runs for one day,
 * so retries never duplicate tasks.
 */
final class CreateWorkPlanTasksForDay implements ShouldQueue
{
    use CompanyAware;
    use Queueable;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [10, 60];

    public function __construct(public readonly string $attendanceDayId) {}

    public function handle(CreateWorkPlanTasks $workPlanTasks): void
    {
        DB::transaction(function () use ($workPlanTasks): void {
            $day = AttendanceDay::query()->whereKey($this->attendanceDayId)->lockForUpdate()->first();

            if ($day === null || $day->check_in_at === null) {
                return;
            }

            $workPlanTasks->handle($day);
        });
    }
}
