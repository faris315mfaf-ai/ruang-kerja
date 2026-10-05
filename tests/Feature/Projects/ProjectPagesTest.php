<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Projects\Enums\ProjectHealth;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Milestone;
use App\Models\ProjectRisk;
use App\Models\ProjectUpdate;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/project-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo('2026-10-05 03:00:00');
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->direksi = User::factory()->withRole(Role::Direksi)->create();
    $this->project = makeProject($this->owner, ['key' => 'PLQ', 'name' => 'Proyek Peluncuran Q4', 'sponsor_user_id' => $this->direksi->id, 'lead_user_id' => $this->owner->id]);
});

it('renders the project summary with KPIs, burn-up, milestones, updates and risks', function () {
    projectTasks($this->project, 'done', 3);
    projectTasks($this->project, 'todo', 2, ['due_date' => '2026-10-01']);
    Milestone::factory()->for($this->project, 'workspace')->create(['name' => 'Siaran pers final', 'target_date' => '2026-10-01']);
    ProjectRisk::factory()->for($this->project, 'workspace')->create(['title' => 'Kutipan direksi belum diterima']);
    ProjectUpdate::factory()->for($this->project, 'workspace')->withDecision()->create(['author_id' => $this->owner->id, 'health' => ProjectHealth::AtRisk]);
    $this->project->forceFill(['last_update_at' => now()])->save();
    DB::table('project_progress_snapshots')->insert([
        ['workspace_id' => $this->project->id, 'date' => '2026-09-01', 'scope_count' => 4, 'done_count' => 0, 'created_at' => now(), 'updated_at' => now()],
        ['workspace_id' => $this->project->id, 'date' => '2026-09-20', 'scope_count' => 5, 'done_count' => 2, 'created_at' => now(), 'updated_at' => now()],
    ]);

    $this->actingAs($this->direksi)->get('/w/PLQ/ringkasan')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('workspaces/summary')
        ->where('project.key', 'PLQ')
        ->where('project.metrics.actual', 60)
        ->where('project.metrics.overdue', 2)
        ->where('project.metrics.flags', ['missed_milestone'])
        ->where('project_can.steer', true)
        ->where('project_can.manage', false)
        ->has('milestones', 1)
        ->where('milestones.0.status', 'missed')
        ->has('updates', 1)
        ->has('risks', 1)
        ->has('overdue_tasks', 2)
        ->where('task_options', [])
        // Weekly points 1, 8, 15, 22, 29 Sep + today.
        ->has('burnup.points', 6)
        ->where('burnup.points.0.scope', 4)
        ->where('burnup.points.3.scope', 5)
        ->where('burnup.points.5.done', 3)
        ->where('burnup.initial_scope', 4));
});

it('answers 404 for the summary of a non-project workspace', function () {
    $team = Workspace::factory()->ownedBy($this->owner)->team()->create(['key' => 'GDG']);

    $this->actingAs($this->owner)->get('/w/GDG/ringkasan')->assertNotFound();
});

it('sends project attributes to the settings page of projects only', function () {
    $this->actingAs($this->owner)->get('/w/PLQ/pengaturan')->assertInertia(fn (Assert $page) => $page
        ->where('project_settings.attributes.project_status', 'active')
        ->where('project_settings.attributes.lead_user_id', $this->owner->id)
        ->has('project_settings.sponsor_options', 1));

    Workspace::factory()->ownedBy($this->owner)->team()->create(['key' => 'GDG']);
    $this->actingAs($this->owner)->get('/w/GDG/pengaturan')->assertInertia(fn (Assert $page) => $page->where('project_settings', null));
});

it('builds the portfolio KPIs, decisions, attention list, roadmap and feed', function () {
    $member = memberWithRole($this->project, WorkspaceRole::Member);
    projectTasks($this->project, 'done', 1);
    projectTasks($this->project, 'todo', 3, ['due_date' => '2026-10-02']);
    Milestone::factory()->for($this->project, 'workspace')->create(['target_date' => '2026-10-09']);
    ProjectUpdate::factory()->for($this->project, 'workspace')->withDecision('Tambahan anggaran.')->create(['author_id' => $member->id, 'created_at' => '2026-09-20 09:00:00']);
    $this->project->forceFill(['health' => ProjectHealth::OffTrack, 'last_update_at' => '2026-09-20 09:00:00'])->save();
    $done = makeProject($this->owner, ['name' => 'Selesai Q3', 'project_status' => 'completed', 'completed_at' => '2026-09-15 09:00:00']);

    $this->actingAs($this->direksi)->get('/portofolio')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('projects/portfolio')
        ->where('period_label', 'Q4 2026')
        ->where('kpis.active.count', 1)
        ->where('kpis.active.health.off_track', 1)
        ->where('kpis.upcoming_milestones.count', 1)
        ->where('kpis.overdue_tasks.count', 3)
        ->where('kpis.overdue_tasks.top.key', 'PLQ')
        ->has('projects', 1)
        ->where('projects.0.metrics.flags', ['behind', 'stale_update'])
        ->has('decisions', 1)
        ->where('decisions.0.decision', 'Tambahan anggaran.')
        ->has('attention', 1)
        ->where('attention.0.is_sponsor', true)
        ->has('feed', 1)
        ->has('completed', 1)
        ->where('completed.0.key', $done->key)
        ->where('completed.0.quarter', 'Q3')
        ->where('roadmap.from', '2026-08-01')
        ->where('roadmap.to', '2026-12-31')
        ->has('roadmap.months', 5)
        // Nobody has a shift in this fixture: nobody is expected today.
        ->where('attendance.total', 0));

    // Filters live in the URL.
    $this->actingAs($this->direksi)->get('/portofolio?status=on_track&periode=bulan')->assertInertia(fn (Assert $page) => $page
        ->where('filters.status', 'on_track')
        ->where('filters.periode', 'bulan')
        ->where('period_label', 'Oktober 2026')
        ->has('projects', 0)
        ->where('kpis.active.count', 1));

    $this->actingAs($this->direksi)->get('/portofolio?arsip=1')->assertInertia(fn (Assert $page) => $page->has('projects', 1)->where('projects.0.key', $done->key));
});
