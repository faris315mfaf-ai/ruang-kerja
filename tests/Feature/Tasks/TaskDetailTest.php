<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Search\Providers\TaskSearchProvider;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\PostComment;
use App\Domain\Tasks\Actions\UpdateTask;
use App\Domain\Tasks\Notifications\TaskAssignedNotification;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Events\Tasks\TaskUpdated;
use App\Models\Activity;
use App\Models\ChecklistItem;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\TaskPolicy;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->create(['name' => 'Dimas Pratama']);
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'PLQ', 'name' => 'Proyek Peluncuran Q4']);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->viewer = memberWithRole($this->workspace, WorkspaceRole::Viewer);
    $this->task = app(CreateTask::class)->handle($this->workspace, $this->owner, [
        'title' => 'Landing page produk baru',
        'assignee_ids' => [$this->member->id],
        'due_date' => '2026-10-09',
    ]);
});

it('returns the detail with properties, timeline and abilities', function () {
    Notification::fake();
    app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Teks hero', 'parent_id' => $this->task->id]);
    app(PostComment::class)->handle($this->task, $this->member, richDoc('Sudah naik ke staging'));

    $this->actingAs($this->viewer)
        ->getJson("/tugas/{$this->task->id}")
        ->assertOk()
        ->assertJsonPath('task.key', 'PLQ-1')
        ->assertJsonPath('url', '/w/PLQ/tasks/1')
        ->assertJsonPath('workspace.key', 'PLQ')
        ->assertJsonPath('assignees.0.id', $this->member->id)
        ->assertJsonPath('subtasks.0.key', 'PLQ-2')
        ->assertJsonPath('subtasks.0.parent_key', 'PLQ-1')
        ->assertJsonPath('timeline.0.kind', 'activity')
        ->assertJsonPath('timeline.0.event', 'task.created')
        ->assertJsonPath('timeline.3.kind', 'comment')
        ->assertJsonPath('timeline.3.body_text', 'Sudah naik ke staging')
        ->assertJsonPath('can.edit', false)
        ->assertJsonPath('can.comment', true)
        ->assertJsonPath('can.moderate', false)
        ->assertJsonPath('watching', false);

    expect(Activity::query()->where('subject_id', $this->task->id)->where('event', 'task.subtask_added')->exists())->toBeTrue();

    $this->actingAs(User::factory()->create())->getJson("/tugas/{$this->task->id}")->assertNotFound();
});

it('renders the full-screen page /w/{key}/tasks/{number}', function () {
    // The task was assigned to the member by the owner: since 9 Okt 2026 the
    // assignee cannot edit it anymore, only the creator (or a superior) can.
    $this->actingAs($this->member)
        ->get('/w/PLQ/tasks/1')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('tasks/show')
            ->where('detail.task.title', 'Landing page produk baru')
            ->where('detail.can.edit', false));

    $this->actingAs($this->owner)
        ->get('/w/PLQ/tasks/1')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('tasks/show')
            ->where('detail.can.edit', true));

    $this->actingAs($this->member)->get('/w/plq/tasks/1')->assertRedirect('/w/PLQ/tasks/1');
    $this->actingAs($this->member)->get('/w/PLQ/tasks/99')->assertNotFound();
    $this->actingAs(User::factory()->create())->get('/w/PLQ/tasks/1')->assertNotFound();
});

it('deep-links task search results to the task detail', function () {
    $results = app(TaskSearchProvider::class)->search($this->member, 'landing', 5);

    expect($results[0]->url)->toBe('/w/PLQ/tasks/1');
});

it('keeps description references visible only to those who can see the referenced task', function () {
    $secret = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'SEC']);
    $hidden = app(CreateTask::class)->handle($secret, $this->owner, ['title' => 'Rahasia']);
    $visible = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Aset visual']);

    app(UpdateTask::class)->handle($this->task, $this->owner, ['description' => richDoc('Lihat ', ['#', $visible], ' dan ', ['#', $hidden])]);

    $this->actingAs($this->member)
        ->getJson("/tugas/{$this->task->id}")
        ->assertJsonPath("references.{$visible->id}.key", 'PLQ-2')
        ->assertJsonMissingPath("references.{$hidden->id}");

    // The owner sees both.
    $this->actingAs($this->owner)
        ->getJson("/tugas/{$this->task->id}")
        ->assertJsonPath("references.{$hidden->id}.title", 'Rahasia');
});

it('saves a rich description and logs it', function () {
    $doc = ['type' => 'doc', 'content' => [
        ['type' => 'heading', 'attrs' => ['level' => 2], 'content' => [['type' => 'text', 'text' => 'Ruang lingkup']]],
        ['type' => 'bulletList', 'content' => [['type' => 'listItem', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Hero section']]]]]]],
    ]];

    $this->actingAs($this->owner)
        ->patchJson("/tugas/{$this->task->id}", ['description' => $doc, 'start_date' => '2026-10-01', 'estimate_hours' => 12])
        ->assertOk()
        ->assertJsonPath('task.description_text', "Ruang lingkup\nHero section");

    expect($this->task->fresh()?->description)->toEqual($doc)
        ->and(Activity::query()->where('subject_id', $this->task->id)->pluck('event')->all())
        ->toContain('task.description_changed', 'task.start_date_changed', 'task.estimate_changed');

    $this->actingAs($this->member)
        ->patchJson("/tugas/{$this->task->id}", ['description' => $doc])
        ->assertForbidden()
        ->assertJsonPath('message', TaskPolicy::ASSIGNED_BY_OTHER);

    $this->actingAs($this->owner)
        ->patchJson("/tugas/{$this->task->id}", ['description' => ['type' => 'nope']])
        ->assertUnprocessable();
});

it('adds, ticks, renames and removes checklist lines', function () {
    Event::fake([TaskUpdated::class]);

    $first = $this->actingAs($this->owner)->postJson("/tugas/{$this->task->id}/checklist", ['title' => 'Hero section'])
        ->assertCreated()->json('item');
    $second = $this->actingAs($this->owner)->postJson("/tugas/{$this->task->id}/checklist", ['title' => 'Navigasi'])
        ->assertCreated()->json('item');

    expect(strcmp($first['position'], $second['position']))->toBeLessThan(0);

    $this->actingAs($this->owner)->patchJson("/checklist/{$first['id']}", ['is_done' => true])
        ->assertOk()->assertJsonPath('item.is_done', true)->assertJsonPath('item.done_by', $this->owner->id);
    $this->actingAs($this->owner)->patchJson("/checklist/{$second['id']}", ['title' => 'Navigasi & footer'])
        ->assertOk()->assertJsonPath('item.title', 'Navigasi & footer');
    $this->actingAs($this->owner)->deleteJson("/checklist/{$second['id']}")->assertNoContent();

    expect(ChecklistItem::query()->where('task_id', $this->task->id)->count())->toBe(1)
        ->and(Activity::query()->where('event', 'task.checklist_completed')->value('properties'))->toMatchArray(['item' => 'Hero section']);

    $this->actingAs($this->viewer)->postJson("/tugas/{$this->task->id}/checklist", ['title' => 'Tidak boleh'])->assertForbidden();
    $this->actingAs($this->viewer)->patchJson("/checklist/{$first['id']}", ['is_done' => false])->assertForbidden();
    // The assignee may not edit the checklist either: the task was assigned
    // to them by the owner (keputusan pemilik 9 Okt 2026).
    $this->actingAs($this->member)->postJson("/tugas/{$this->task->id}/checklist", ['title' => 'Dari penerima'])->assertForbidden();
    $this->actingAs($this->owner)->postJson("/tugas/{$this->task->id}/checklist", ['title' => '   '])->assertUnprocessable();

    Event::assertDispatched(TaskUpdated::class);
});

it('follows and unfollows a task', function () {
    $this->actingAs($this->viewer)->postJson("/tugas/{$this->task->id}/pantau")->assertOk()->assertJsonPath('watching', true);
    expect($this->task->watchers()->where('users.id', $this->viewer->id)->exists())->toBeTrue();

    $this->actingAs($this->viewer)->deleteJson("/tugas/{$this->task->id}/pantau")->assertOk()->assertJsonPath('watching', false);
    expect($this->task->watchers()->where('users.id', $this->viewer->id)->exists())->toBeFalse();

    $this->actingAs(User::factory()->create())->postJson("/tugas/{$this->task->id}/pantau")->assertNotFound();
});

it('notifies new assignees but not the actor assigning themselves', function () {
    Notification::fake();
    $other = memberWithRole($this->workspace, WorkspaceRole::Member);

    app(UpdateTask::class)->handle($this->task, $this->owner, ['assignee_ids' => [$this->member->id, $other->id, $this->owner->id]]);
    $task = app(CreateTask::class)->handle($this->workspace, $other, ['title' => 'Sendiri', 'assignee_ids' => [$other->id]]);

    Notification::assertSentTo($other, TaskAssignedNotification::class, fn (TaskAssignedNotification $n) => $n->payload($other)->title === 'Dimas Pratama menugaskan PLQ-1 kepada Anda'
        && $n->payload($other)->url === '/w/PLQ/tasks/1'
        && $n->payload($other)->meta['plan_url'] === '/dashboard/saya#ruang-saya'
        && $n->payload($other)->meta['plan_label'] === 'Rencanakan di Ruang saya');
    Notification::assertNotSentTo($this->owner, TaskAssignedNotification::class);
    // Already assigned before → no second notification.
    Notification::assertNotSentTo($this->member, TaskAssignedNotification::class);
    Notification::assertSentToTimes($other, TaskAssignedNotification::class, 1);
    expect($task->number)->toBe(2);
});

it('lets Direksi read the detail but not edit', function () {
    $direksi = User::factory()->withRole(Role::Direksi)->create();

    $this->actingAs($direksi)->getJson("/tugas/{$this->task->id}")->assertOk()->assertJsonPath('can.edit', false)->assertJsonPath('can.comment', false)->assertJsonPath('can.watch', false);
    $this->actingAs($direksi)->patchJson("/tugas/{$this->task->id}", ['title' => 'X'])->assertForbidden();
});

it('answers 404 (not 500) for checklist lines of a deleted task', function () {
    // The creator stays an editor even after the task is gone.
    $item = $this->actingAs($this->owner)->postJson("/tugas/{$this->task->id}/checklist", ['title' => 'Hero section'])->json('item');
    $this->task->delete();

    $this->actingAs($this->owner)->patchJson("/checklist/{$item['id']}", ['is_done' => true])->assertNotFound();
    $this->actingAs($this->owner)->deleteJson("/checklist/{$item['id']}")->assertNotFound();
    expect(Gate::forUser($this->owner)->inspect('view', ChecklistItem::query()->findOrFail($item['id']))->status())->toBe(404);
});
