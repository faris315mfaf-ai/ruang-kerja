<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\MoveTask;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->internal()->create(['key' => 'PLQ', 'name' => 'Proyek Peluncuran Q4']);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->travelTo('2026-10-05 03:00:00');
});

it('renders the board with statuses, labels, tasks and abilities', function () {
    $task = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Siaran pers', 'assignee_ids' => [$this->member->id], 'due_date' => '2026-10-06']);

    $this->actingAs($this->member)->get('/w/PLQ')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('workspaces/tasks')
        ->where('view', 'board')
        ->where('today', '2026-10-05')
        ->where('workspace.key', 'PLQ')
        ->where('workspace.members_count', 2)
        ->where('can.edit_tasks', true)
        ->where('can.manage', false)
        ->has('statuses', 5)
        ->has('members', 2)
        ->has('tasks', 1)
        ->where('tasks.0.id', $task->id)
        ->where('tasks.0.key', 'PLQ-1')
        ->where('tasks.0.due_date', '2026-10-06')
        ->where('tasks.0.assignee_ids', [$this->member->id]));
});

it('shows internal workspaces read-only to other employees', function () {
    $this->actingAs(User::factory()->create())->get('/w/PLQ?view=list')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('view', 'list')
        ->where('can.edit_tasks', false)
        ->where('can.favorite', false));
});

it('hides closed tasks older than 30 days but keeps them for the calendar month', function () {
    $old = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Lama', 'due_date' => '2026-08-20']);
    app(MoveTask::class)->handle($old, $this->owner, statusOf($this->workspace, 'done'));
    Task::query()->whereKey($old->id)->update(['completed_at' => now()->subDays(40)]);

    $this->actingAs($this->owner)->get('/w/PLQ')->assertInertia(fn (Assert $page) => $page->has('tasks', 0)->where('hidden_closed_count', 1));
    $this->actingAs($this->owner)->get('/w/PLQ?view=calendar&month=2026-08')->assertInertia(fn (Assert $page) => $page
        ->where('month', '2026-08-01')
        ->has('tasks', 1));
});

it('renders the other tabs, the directory and the settings page', function () {
    foreach (['dokumen' => 'workspaces/documents', 'file' => 'workspaces/files', 'aktivitas' => 'workspaces/activity'] as $path => $component) {
        $this->actingAs($this->member)->get("/w/PLQ/{$path}")->assertOk()->assertInertia(fn (Assert $page) => $page->component($component));
    }

    $this->actingAs($this->owner)->get('/w/PLQ/pengaturan')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('workspaces/settings')
        ->has('member_details', 2)
        ->has('statuses', 5)
        ->has('role_options', 3)
        ->where('can.manage_members', true)
        ->has('candidates'));

    $this->actingAs($this->member)->get('/workspace')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('workspaces/index')
        ->where('can_create.project', false)
        ->where('workspaces', fn ($list) => collect($list)->pluck('key')->contains('PLQ'))
        ->where('workspaces', fn ($list) => collect($list)->firstWhere('key', 'PLQ')['my_role'] === 'member'));
});

it('lists the activity feed newest first', function () {
    app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Satu']);

    $this->actingAs($this->member)->get('/w/PLQ/aktivitas')->assertInertia(fn (Assert $page) => $page
        ->where('activities.data.0.event', 'task.created')
        ->where('activities.data.0.causer.name', 'Dimas Pratama'));
});

it('shows "Tugas saya" across workspaces with counts per tab', function () {
    $other = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'OPS']);
    addMember($other, $this->member);
    $create = app(CreateTask::class);

    $create->handle($this->workspace, $this->owner, ['title' => 'Untuk saya', 'assignee_ids' => [$this->member->id], 'due_date' => '2026-10-04']);
    $create->handle($other, $this->owner, ['title' => 'Juga untuk saya', 'assignee_ids' => [$this->member->id]]);
    $create->handle($this->workspace, $this->member, ['title' => 'Saya buat sendiri']);
    $create->handle($this->workspace, $this->owner, ['title' => 'Bukan urusan saya']);

    $this->actingAs($this->member)->get('/tugas')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('tasks/mine')
        ->where('tab', 'assigned')
        ->where('counts', ['assigned' => 2, 'watching' => 1, 'created' => 1]) // the creator watches own tasks
        ->has('tasks', 2)
        ->where('tasks.0.title', 'Untuk saya')
        ->where('tasks.0.workspace.key', 'PLQ')
        ->where('tasks.0.status.category', 'todo')
        ->where('tasks.0.done_status_id', statusOf($this->workspace, 'done')->id));

    $this->actingAs($this->member)->get('/tugas?tab=created')->assertInertia(fn (Assert $page) => $page->has('tasks', 1)->where('tasks.0.title', 'Saya buat sendiri'));
});

it('excludes archived workspaces and personal workspaces of others from "Tugas saya"', function () {
    app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Diarsipkan', 'assignee_ids' => [$this->member->id]]);
    $this->workspace->update(['archived_at' => now()]);

    $this->actingAs($this->member)->get('/tugas')->assertInertia(fn (Assert $page) => $page->has('tasks', 0)->where('counts.assigned', 0));
});

it('serves quick-create options only for workspaces the user can edit', function () {
    $viewerOnly = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'KEU']);
    addMember($viewerOnly, $this->member, WorkspaceRole::Viewer);

    $keys = collect($this->actingAs($this->member)->getJson('/tugas/opsi-form')->assertOk()->json('workspaces'))->pluck('key');

    expect($keys)->toContain('PLQ')->not->toContain('KEU')
        ->and($keys->count())->toBe(2);
});

it('serves quick-create options with a fixed number of queries (review #13)', function () {
    $queries = function (int $extra): array {
        foreach (range(1, $extra) as $i) {
            $workspace = Workspace::factory()->ownedBy($this->owner)->create();
            addMember($workspace, $this->member, WorkspaceRole::Member);
            addMember($workspace, User::factory()->create(), WorkspaceRole::Viewer);
        }

        $this->actingAs($this->member)->getJson('/tugas/opsi-form')->assertOk(); // warm caches
        DB::flushQueryLog();
        DB::enableQueryLog();
        $count = count($this->actingAs($this->member)->getJson('/tugas/opsi-form')->assertOk()->json('workspaces'));
        DB::disableQueryLog();

        return ['queries' => count(DB::getQueryLog()), 'workspaces' => $count];
    };

    $few = $queries(1);
    $many = $queries(5);

    expect($many['workspaces'])->toBeGreaterThan($few['workspaces'])
        ->and($many['queries'])->toBe($few['queries']);

    $members = collect($this->actingAs($this->member)->getJson('/tugas/opsi-form')->json('workspaces'))->firstWhere('key', 'PLQ')['members'];
    expect(collect($members)->pluck('id'))->toContain($this->owner->id, $this->member->id);
});
