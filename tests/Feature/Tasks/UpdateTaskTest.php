<?php

use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\UpdateTask;
use App\Domain\Tasks\Enums\TaskPriority;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Events\Tasks\TaskDeleted;
use App\Events\Tasks\TaskUpdated;
use App\Models\Activity;
use App\Models\Label;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Event;

require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'GDG']);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->task = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Stock opname', 'due_date' => '2026-10-08']);
});

it('updates only the given fields and logs rename, priority, due date and assignment', function () {
    Event::fake([TaskUpdated::class]);

    $task = app(UpdateTask::class)->handle($this->task, $this->owner, [
        'title' => 'Stock opname mingguan',
        'priority' => 2,
        'due_date' => '2026-10-09',
        'assignee_ids' => [$this->member->id],
    ]);

    expect($task->title)->toBe('Stock opname mingguan')
        ->and($task->priority)->toBe(TaskPriority::High)
        ->and($task->due_date?->toDateString())->toBe('2026-10-09')
        ->and($task->assignees()->pluck('users.id')->all())->toBe([$this->member->id]);

    $events = Activity::query()->where('subject_id', $task->id)->pluck('properties', 'event');

    expect($events->keys()->sort()->values()->all())->toBe([
        'task.assigned', 'task.created', 'task.due_date_changed', 'task.priority_changed', 'task.renamed',
    ])->and($events['task.due_date_changed'])->toMatchArray(['from' => '2026-10-08', 'to' => '2026-10-09'])
        ->and($events['task.priority_changed'])->toMatchArray(['from' => 0, 'to' => 2]);

    // Unassigning is logged too; an unchanged due date is not.
    app(UpdateTask::class)->handle($task->fresh(), $this->owner, ['assignee_ids' => [], 'due_date' => '2026-10-09']);

    expect(Activity::query()->where('subject_id', $task->id)->where('event', 'task.unassigned')->count())->toBe(1)
        ->and(Activity::query()->where('subject_id', $task->id)->where('event', 'task.due_date_changed')->count())->toBe(1);

    Event::assertDispatched(TaskUpdated::class);
});

it('moves the task when the status changes through an update', function () {
    $done = statusOf($this->workspace, 'done');

    $task = app(UpdateTask::class)->handle($this->task, $this->member, ['status_id' => $done->id]);

    expect($task->status_id)->toBe($done->id)
        ->and($task->status_category)->toBe(TaskStatusCategory::Done)
        ->and($task->completed_at)->not->toBeNull();
});

it('updates over HTTP and replaces labels within the workspace', function () {
    $label = Label::factory()->create(['workspace_id' => $this->workspace->id]);

    $this->actingAs($this->member)
        ->patchJson("/tugas/{$this->task->id}", ['label_ids' => [$label->id], 'description_text' => 'Catatan'])
        ->assertOk()
        ->assertJsonPath('task.label_ids', [$label->id])
        ->assertJsonPath('task.description_text', 'Catatan');

    $this->actingAs(memberWithRole($this->workspace, WorkspaceRole::Viewer))
        ->patchJson("/tugas/{$this->task->id}", ['title' => 'Viewer tidak boleh'])
        ->assertForbidden();
});

it('soft-deletes tasks for the creator or an admin only', function () {
    Event::fake([TaskDeleted::class]);
    $mine = app(CreateTask::class)->handle($this->workspace, $this->member, ['title' => 'Punya member']);

    $this->actingAs($this->member)->delete("/tugas/{$this->task->id}")->assertForbidden();
    $this->actingAs($this->member)->delete("/tugas/{$mine->id}")->assertRedirect();
    $this->actingAs($this->owner)->deleteJson("/tugas/{$this->task->id}")->assertNoContent();

    expect(Task::query()->count())->toBe(0)
        ->and(Task::withTrashed()->count())->toBe(2)
        ->and(Activity::query()->where('event', 'task.deleted')->count())->toBe(2);

    Event::assertDispatchedTimes(TaskDeleted::class, 2);
});
