<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Projects\Enums\ProjectFlag;
use App\Domain\Projects\Enums\ProjectStatus;
use App\Domain\Projects\Queries\ProjectMetrics;
use App\Models\Milestone;
use App\Models\Task;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;

require_once __DIR__.'/../../Support/project-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    // Monday 5 Oct 2026, 10.00 WIB.
    $this->travelTo('2026-10-05 03:00:00');
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->project = makeProject($this->owner);
});

it('computes actual and planned progress from the workspace tasks', function () {
    projectTasks($this->project, 'done', 3);
    projectTasks($this->project, 'todo', 4);
    projectTasks($this->project, 'canceled', 2);
    projectTasks($this->project, 'in_progress', 1, ['due_date' => '2026-10-04']);
    Task::factory()->inStatus(statusOf($this->project, 'done'))->create(['deleted_at' => now()]);

    $metrics = app(ProjectMetrics::class)->forWorkspace($this->project);

    // 3 done of 8 (canceled & deleted excluded); planned 34/56 days.
    expect($metrics->actual)->toBe(37.5)
        ->and($metrics->planned)->toBe(60.71)
        ->and($metrics->variance)->toBe(-23.2)
        ->and($metrics->totals->overdue)->toBe(1)
        ->and($metrics->daysLeft)->toBe(22)
        ->and($metrics->hasFlag(ProjectFlag::Behind))->toBeTrue();
});

it('weights by estimate_hours when at least 80% of the tasks have one', function () {
    projectTasks($this->project, 'done', 1, ['estimate_hours' => 30]);
    projectTasks($this->project, 'todo', 3, ['estimate_hours' => 10]);
    projectTasks($this->project, 'todo', 1);

    $metrics = app(ProjectMetrics::class)->forWorkspace($this->project);

    // 4 of 5 estimated; avg 15h for the unestimated task → 30 / 75 = 40%.
    expect($metrics->usesEstimates)->toBeTrue()->and($metrics->actual)->toBe(40.0);
});

it('raises the behind flag exactly at −15 points', function () {
    // Planned on 2026-10-05: start 2026-09-05, target 2026-11-04 → 30/60 = 50%.
    $this->project->forceFill(['start_date' => '2026-09-05', 'target_date' => '2026-11-04', 'last_update_at' => now()])->save();
    projectTasks($this->project, 'done', 7);
    projectTasks($this->project, 'todo', 13);

    // 7/20 = 35% → −15.
    expect(app(ProjectMetrics::class)->forWorkspace($this->project)->flags)->toBe([ProjectFlag::Behind]);

    // 8/20 = 40% → −10: no flag.
    Task::query()->where('workspace_id', $this->project->id)->where('status_category', 'todo')->first()?->forceFill([
        'status_id' => statusOf($this->project, 'done')->id, 'status_category' => 'done',
    ])->save();

    expect(app(ProjectMetrics::class)->forWorkspace($this->project)->flags)->toBe([]);
});

it('flags a missed milestone only while it is open and past its target', function () {
    $this->project->forceFill(['last_update_at' => now()])->save();
    projectTasks($this->project, 'done', 6);
    projectTasks($this->project, 'todo', 4);
    $milestone = Milestone::factory()->for($this->project, 'workspace')->create(['target_date' => '2026-10-05']);

    expect(app(ProjectMetrics::class)->forWorkspace($this->project)->flags)->toBe([]);

    $milestone->update(['target_date' => '2026-10-04']);
    $metrics = app(ProjectMetrics::class)->forWorkspace($this->project);
    expect($metrics->flags)->toBe([ProjectFlag::MissedMilestone])
        ->and($metrics->missedMilestones())->toHaveCount(1);

    $milestone->update(['completed_at' => now()]);
    expect(app(ProjectMetrics::class)->forWorkspace($this->project)->flags)->toBe([]);
});

it('marks the update stale after more than 7 office days', function () {
    projectTasks($this->project, 'done', 6);
    projectTasks($this->project, 'todo', 4);

    // Monday 28 Sep 00.30 WIB = 7 days.
    $this->project->forceFill(['last_update_at' => '2026-09-27 17:30:00'])->save();
    expect(app(ProjectMetrics::class)->forWorkspace($this->project->fresh())->flags)->toBe([]);

    // Sunday 27 Sep 23.30 WIB = 8 days.
    $this->project->forceFill(['last_update_at' => '2026-09-27 16:30:00'])->save();
    $metrics = app(ProjectMetrics::class)->forWorkspace($this->project->fresh());
    expect($metrics->flags)->toBe([ProjectFlag::StaleUpdate])->and($metrics->updateAgeDays)->toBe(8);
});

it('counts a project never updated as stale once tracked for more than 7 days', function () {
    projectTasks($this->project, 'done', 6);
    projectTasks($this->project, 'todo', 4);

    $this->project->forceFill(['start_date' => '2026-09-28', 'target_date' => '2026-12-28'])->save();
    expect(app(ProjectMetrics::class)->forWorkspace($this->project)->flags)->toBe([]);

    $this->project->forceFill(['start_date' => '2026-09-27'])->save();
    expect(app(ProjectMetrics::class)->forWorkspace($this->project)->flags)->toBe([ProjectFlag::StaleUpdate]);
});

it('does not flag projects that are not running', function () {
    projectTasks($this->project, 'todo', 5);
    Milestone::factory()->for($this->project, 'workspace')->create(['target_date' => '2026-09-10']);

    expect(app(ProjectMetrics::class)->forWorkspace($this->project)->flags)->toHaveCount(3);

    $this->project->forceFill(['project_status' => ProjectStatus::OnHold])->save();
    expect(app(ProjectMetrics::class)->forWorkspace($this->project)->flags)->toBe([]);
});

it('uses a constant number of queries for many projects', function () {
    $projects = collect(range(1, 8))->map(function () {
        $project = makeProject($this->owner);
        projectTasks($project, 'done', 2);
        Milestone::factory()->for($project, 'workspace')->create();

        return $project;
    });

    DB::enableQueryLog();
    app(ProjectMetrics::class)->forWorkspaces($projects);

    expect(DB::getQueryLog())->toHaveCount(2);
});
