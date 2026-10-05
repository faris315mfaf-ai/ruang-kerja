<?php

namespace Tests\Support;

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Synthetic data for metric tests. Instants are written in office time
 * (Asia/Jakarta) and stored as UTC like the application does.
 */
final class AnalyticsFixtures
{
    /** @var array<string, TaskStatus> */
    private static array $statuses = [];

    public static function reset(): void
    {
        self::$statuses = [];
    }

    /**
     * @param  list<User>  $assignees
     * @param  array<string, mixed>  $attributes  due_date "Y-m-d", created/completed "Y-m-d H:i" office time
     */
    public static function task(Workspace $workspace, TaskStatusCategory $category, array $assignees, array $attributes = []): Task
    {
        $status = self::status($workspace, $category);

        foreach (['created_at', 'completed_at', 'canceled_at'] as $column) {
            if (isset($attributes[$column]) && is_string($attributes[$column])) {
                $attributes[$column] = self::at($attributes[$column]);
            }
        }

        if ($category === TaskStatusCategory::Done && ! array_key_exists('completed_at', $attributes)) {
            $attributes['completed_at'] = now();
        }

        $task = Task::factory()->inStatus($status)->create($attributes);

        foreach ($assignees as $user) {
            DB::table('task_assignees')->insert(['task_id' => $task->id, 'user_id' => $user->id, 'assigned_at' => now()]);
        }

        return $task;
    }

    public static function status(Workspace $workspace, TaskStatusCategory $category): TaskStatus
    {
        $key = $workspace->id.'|'.$category->value;

        if (! isset(self::$statuses[$key]) || ! self::$statuses[$key]->exists) {
            self::$statuses[$key] = TaskStatus::query()->where('workspace_id', $workspace->id)->where('category', $category->value)->first()
                ?? TaskStatus::factory()->category($category)->create(['workspace_id' => $workspace->id]);
        }

        return self::$statuses[$key];
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public static function day(User $user, string $date, AttendanceStatus $status, array $attributes = []): AttendanceDay
    {
        return AttendanceDay::factory()->for($user)->on($date)->status($status)->create([
            'shift_id' => array_key_exists('shift_id', $attributes) ? $attributes['shift_id'] : self::shift()->id,
            ...$attributes,
        ]);
    }

    public static function shift(): Shift
    {
        return Shift::query()->where('name', 'Reguler Uji')->first() ?? Shift::factory()->create(['name' => 'Reguler Uji']);
    }

    /** "2026-10-05 08:30" office time → UTC instant. */
    public static function at(string $officeTime): CarbonImmutable
    {
        return CarbonImmutable::parse($officeTime, config()->string('app.office_timezone'))->utc();
    }
}
