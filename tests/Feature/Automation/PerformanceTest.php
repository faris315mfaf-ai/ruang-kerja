<?php

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Organization\Enums\Role;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\AuditLog;
use App\Models\Division;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Kinerja saya (F2-4): the PRD M7 metrics on a small, hand-checked data set
 * (today = Wednesday 7 Oct 2026), the period switch, and who may open whose page.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.automation' => true]);
    $this->travelTo(CarbonImmutable::parse('2026-10-07 09:00', 'Asia/Jakarta'));

    $this->manager = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->division = Division::factory()->headedBy($this->manager)->create();
    $this->subject = User::factory()->inDivision($this->division)->managedBy($this->manager)->create(['name' => 'Rizky Aditya']);
    $this->colleague = User::factory()->inDivision($this->division)->create();
    $this->workspace = Workspace::factory()->ownedBy($this->manager)->create(['key' => 'OPS', 'name' => 'Operasional', 'type' => WorkspaceType::Team, 'color' => 'teal']);
    addMember($this->workspace, $this->subject);
    addMember($this->workspace, $this->colleague);
    TaskStatus::query()->create(['workspace_id' => $this->workspace->id, 'name' => 'Batal', 'category' => 'canceled', 'color' => 'gray', 'position' => 'z']);

    $task = function (User $assignee, Workspace $workspace, string $category, ?string $due, string $created, ?string $completed = null): Task {
        $task = Task::factory()->inStatus(statusOf($workspace, $category))->create([
            'workspace_id' => $workspace->id,
            'due_date' => $due,
            'created_at' => CarbonImmutable::parse($created, 'Asia/Jakarta')->utc(),
            'completed_at' => $completed !== null ? CarbonImmutable::parse($completed, 'Asia/Jakarta')->utc() : null,
        ]);
        $task->assignees()->attach($assignee->id, ['assigned_at' => now()]);

        return $task;
    };

    // T1 on time (lead 4 days), T2 late (lead 2 days), T3 overdue, T4 September, T5 canceled.
    $task($this->subject, $this->workspace, 'done', '2026-10-05', '2026-10-01 10:00', '2026-10-05 10:00');
    $task($this->subject, $this->workspace, 'done', '2026-10-02', '2026-10-04 10:00', '2026-10-06 10:00');
    $this->overdue = $task($this->subject, $this->workspace, 'in_progress', '2026-10-06', '2026-10-01 10:00');
    $task($this->subject, $this->workspace, 'done', '2026-09-10', '2026-09-08 10:00', '2026-09-10 10:00');
    $task($this->subject, $this->workspace, 'canceled', '2026-10-03', '2026-10-01 10:00');
    // Personal to-do (lead 1 day): counts on the person's own page only.
    $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->subject->id)->first()
        ?? Workspace::factory()->personal($this->subject)->create();
    $task($this->subject, $personal, 'done', null, '2026-10-02 10:00', '2026-10-03 10:00');
    // Division context: a colleague's task with a 10-day lead time.
    $task($this->colleague, $this->workspace, 'done', null, '2026-09-26 10:00', '2026-10-06 10:00');

    $shift = Shift::factory()->create();
    foreach ([
        ['2026-10-01', AttendanceStatus::Present, '07:50'],
        ['2026-10-02', AttendanceStatus::Late, '08:10'],
        ['2026-10-05', AttendanceStatus::Present, '07:40'],
        ['2026-10-06', AttendanceStatus::Sick, null],
    ] as [$date, $status, $time]) {
        AttendanceDay::factory()->on($date)->status($status)->create([
            'user_id' => $this->subject->id,
            'shift_id' => $shift->id,
            'check_in_at' => $time !== null ? CarbonImmutable::parse("{$date} {$time}", 'Asia/Jakarta')->utc() : null,
        ]);
    }
});

it('computes this month from the PRD formulas', function () {
    $this->actingAs($this->subject)
        ->get('/kinerja?periode=bulan')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('automation/performance')
            ->where('performance.person.is_self', true)
            ->where('performance.period', 'month')
            ->where('performance.counts.due', 3)
            ->where('performance.counts.done_of_due', 2)
            ->where('performance.counts.done_with_due', 2)
            ->where('performance.counts.on_time', 1)
            // median of 4, 2 and 1 (personal) days
            ->where('performance.counts.lead_time', 2)
            ->where('performance.counts.lead_time_samples', 3)
            // division: 4, 2, 10 (personal to-dos never count for the division)
            ->where('performance.counts.division_lead_time', 4)
            ->where('performance.counts.scheduled_days', 3)
            ->where('performance.counts.on_time_days', 2)
            ->where('performance.attendance.on_time_rate', 67)
            ->where('performance.attendance.average_check_in', '07.53')
            ->has('performance.weeks', 2)
            ->where('performance.weeks.1', ['week_start' => '2026-10-05', 'on_time' => 1, 'late' => 1])
            ->where('performance.overdue_count', 1)
            ->where('performance.overdue.0.key', $this->overdue->fresh('workspace')->displayKey())
            ->where('performance.by_workspace.0.workspace.name', 'Operasional')
            ->where('performance.by_workspace.0.done', 2)
            ->where('performance.by_workspace.1.workspace.name', 'Pribadi')
            ->where('performance.by_workspace.1.done', 1));
});

it('defaults to 8 weeks with an 8-bar chart', function () {
    $this->actingAs($this->subject)
        ->get('/kinerja')
        ->assertInertia(fn (Assert $page) => $page
            ->where('performance.period', '8w')
            ->where('performance.counts.label', '8 minggu')
            ->where('performance.counts.due', 4)
            ->where('performance.counts.done_with_due', 3)
            ->where('performance.counts.on_time', 2)
            ->has('performance.weeks', 8)
            ->where('performance.weeks.0.week_start', '2026-08-17')
            ->where('performance.weeks.3', ['week_start' => '2026-09-07', 'on_time' => 1, 'late' => 0]));
});

it('covers the quarter week by week', function () {
    $this->actingAs($this->subject)
        ->get('/kinerja?periode=kuartal')
        ->assertInertia(fn (Assert $page) => $page
            ->where('performance.period', 'quarter')
            ->where('performance.counts.label', 'Kuartal')
            ->where('performance.weeks.0.week_start', '2026-09-28')
            ->has('performance.weeks', 2));
});

it('lets the direct manager open the page without the personal workspace and audits it', function () {
    $this->actingAs($this->manager)
        ->get("/kinerja/{$this->subject->id}?periode=bulan")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('performance.person.name', 'Rizky Aditya')
            ->where('performance.person.is_self', false)
            ->where('performance.counts.lead_time', 3)
            ->has('performance.by_workspace', 1));

    expect(AuditLog::query()->where('action', 'performance.viewed')->where('auditable_id', $this->subject->id)->where('user_id', $this->manager->id)->exists())->toBeTrue();
});

it('hides workspaces the viewer cannot see', function () {
    $private = Workspace::factory()->create(['key' => 'RHS', 'name' => 'Rahasia', 'type' => WorkspaceType::Team, 'visibility' => 'private']);
    addMember($private, $this->subject);
    $task = Task::factory()->inStatus(statusOf($private, 'done'))->create(['workspace_id' => $private->id, 'completed_at' => now()->subDay()]);
    $task->assignees()->attach($this->subject->id, ['assigned_at' => now()]);
    $this->actingAs($this->manager)
        ->get("/kinerja/{$this->subject->id}?periode=bulan")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            // The manager owns OPS but is not in RHS (private): its name is hidden.
            ->has('performance.by_workspace', 2)
            ->where('performance.by_workspace.1.workspace.name', 'Workspace lain')
            ->where('performance.overdue_count', 1)
            ->has('performance.overdue', 1)); // OPS overdue task: the manager can see it
});

it('answers 404 to everyone else', function () {
    $this->actingAs($this->colleague)->get("/kinerja/{$this->subject->id}")->assertNotFound();
    $this->actingAs(User::factory()->withRole(Role::Direksi)->create())->get("/kinerja/{$this->subject->id}")->assertNotFound();
    $this->actingAs(User::factory()->withRole(Role::SuperAdmin)->create())->get("/kinerja/{$this->subject->id}")->assertNotFound();
});
