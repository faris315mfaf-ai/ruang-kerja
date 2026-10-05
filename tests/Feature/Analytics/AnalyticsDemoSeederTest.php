<?php

use Database\Seeders\AnalyticsDemoSeeder;
use Database\Seeders\AttendanceSeeder;
use Database\Seeders\DemoUserSeeder;
use Database\Seeders\OrganizationSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\WorkspaceSeeder;
use Illuminate\Support\Facades\DB;

function analyticsSeeder(): AnalyticsDemoSeeder
{
    $seeder = app(AnalyticsDemoSeeder::class);
    $seeder->force = true;
    $seeder->targetEmployees = 25;
    $seeder->days = 21;
    $seeder->tasksPerWeek = 1;

    return $seeder;
}

it('is skipped outside APP_ENV=local', function () {
    $this->seed([RoleSeeder::class, DemoUserSeeder::class, OrganizationSeeder::class]);
    $before = DB::table('users')->count();

    $this->seed(AnalyticsDemoSeeder::class);

    expect(DB::table('users')->count())->toBe($before)
        ->and(DB::table('tasks')->where('description_text', AnalyticsDemoSeeder::TASK_MARKER)->count())->toBe(0);
});

it('tops up employees and writes attendance and tasks idempotently', function () {
    $this->seed([RoleSeeder::class, DemoUserSeeder::class, OrganizationSeeder::class, WorkspaceSeeder::class, AttendanceSeeder::class]);

    analyticsSeeder()->run();

    $counts = fn (): array => [
        'active' => DB::table('users')->where('status', 'active')->count(),
        'days' => DB::table('attendance_days')->count(),
        'tasks' => DB::table('tasks')->where('description_text', AnalyticsDemoSeeder::TASK_MARKER)->count(),
        'assignees' => DB::table('task_assignees')->count(),
    ];
    $first = $counts();

    expect($first['active'])->toBe(25)
        ->and($first['tasks'])->toBeGreaterThan(50)
        ->and(DB::table('attendance_days')->where('work_date', '<', now()->subDays(30)->toDateString())->count())->toBe(0); // only 21 days asked

    analyticsSeeder()->run();

    expect($counts())->toBe($first);
});
