<?php

use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\MoveTask;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Tasks\Services\Lexorank;
use App\Domain\Tasks\Services\TaskPositioner;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Events\Tasks\TaskMoved;
use App\Models\Activity;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Event;

require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'PLQ']);
    $this->move = app(MoveTask::class);
    $this->task = fn (string $title, string $category = 'todo') => app(CreateTask::class)->handle(
        $this->workspace, $this->owner, ['title' => $title, 'status_id' => statusOf($this->workspace, $category)->id],
    );
});

it('syncs status_category, started_at and completed_at across moves', function () {
    $this->travelTo('2026-10-05 02:00:00');
    $task = ($this->task)('Landing page');

    $this->travelTo('2026-10-05 03:00:00');
    $task = $this->move->handle($task, $this->owner, statusOf($this->workspace, 'in_progress'));
    expect($task->status_category)->toBe(TaskStatusCategory::InProgress)
        ->and($task->started_at?->toDateTimeString())->toBe('2026-10-05 03:00:00')
        ->and($task->completed_at)->toBeNull();

    $this->travelTo('2026-10-06 04:00:00');
    $task = $this->move->handle($task, $this->owner, statusOf($this->workspace, 'done'));
    expect($task->status_category)->toBe(TaskStatusCategory::Done)
        ->and($task->completed_at?->toDateTimeString())->toBe('2026-10-06 04:00:00')
        ->and($task->started_at?->toDateTimeString())->toBe('2026-10-05 03:00:00');

    // Reopening clears completed_at; started_at keeps the first start.
    $this->travelTo('2026-10-07 05:00:00');
    $task = $this->move->handle($task, $this->owner, statusOf($this->workspace, 'review'));
    expect($task->status_category)->toBe(TaskStatusCategory::Review)
        ->and($task->completed_at)->toBeNull()
        ->and($task->started_at?->toDateTimeString())->toBe('2026-10-05 03:00:00')
        ->and($task->fresh()?->status_category)->toBe(TaskStatusCategory::Review);
});

it('places the card between its new neighbours', function () {
    $a = ($this->task)('A', 'in_progress');
    $b = ($this->task)('B', 'in_progress');
    $c = ($this->task)('C', 'in_progress');
    $column = statusOf($this->workspace, 'in_progress');
    // Created at the top each time: C, B, A.
    expect(columnIds($column))->toBe([$c->id, $b->id, $a->id]);

    $x = ($this->task)('X');
    $this->move->handle($x, $this->owner, $column, afterId: $c->id, beforeId: $b->id);
    expect(columnIds($column))->toBe([$c->id, $x->id, $b->id, $a->id]);

    // Reorder inside the column: A to the top.
    $this->move->handle($a, $this->owner, $column, afterId: null, beforeId: $c->id);
    expect(columnIds($column))->toBe([$a->id, $c->id, $x->id, $b->id]);

    // Only "after" given: goes right below it.
    $this->move->handle($a, $this->owner, $column, afterId: $b->id);
    expect(columnIds($column))->toBe([$c->id, $x->id, $b->id, $a->id]);
});

it('trusts the database when the client sends stale neighbours', function () {
    $a = ($this->task)('A', 'review');
    $b = ($this->task)('B', 'review');
    $column = statusOf($this->workspace, 'review');
    $x = ($this->task)('X');

    // Client thought A was directly above C (no longer true): X lands right below B.
    $this->move->handle($x, $this->owner, $column, afterId: $b->id, beforeId: 'zzzzzzzzzzzzzzzzzzzzzzzzzz');
    expect(columnIds($column))->toBe([$b->id, $x->id, $a->id]);

    // Unknown neighbours → top of the column.
    $y = ($this->task)('Y');
    $this->move->handle($y, $this->owner, $column, afterId: '01aaaaaaaaaaaaaaaaaaaaaaaa');
    expect(columnIds($column)[0])->toBe($y->id);
});

it('rebalances a column when keys collide or grow too long', function () {
    $column = statusOf($this->workspace, 'todo');
    $a = ($this->task)('A');
    $b = ($this->task)('B');
    // Simulate two concurrent writers that produced the same key.
    Task::query()->whereKey([$a->id, $b->id])->update(['position' => 'V']);
    $x = ($this->task)('X', 'backlog');

    $this->move->handle($x, $this->owner, $column, afterId: $a->id < $b->id ? $a->id : $b->id);

    $positions = Task::query()->where('status_id', $column->id)->orderBy('position')->pluck('position')->all();
    expect(array_unique($positions))->toHaveCount(3)
        ->and(columnIds($column))->toHaveCount(3);

    // Very long keys are spread out again.
    Task::query()->whereKey($a->id)->update(['position' => str_repeat('V', Lexorank::MAX_LENGTH)]);
    Task::query()->whereKey($b->id)->update(['position' => str_repeat('V', Lexorank::MAX_LENGTH).'1']);
    app(TaskPositioner::class)->rebalance($column);

    expect(Task::query()->where('status_id', $column->id)->get()->every(fn (Task $task) => strlen($task->position) <= 2))->toBeTrue();
});

it('logs the status change and broadcasts TaskMoved', function () {
    Event::fake([TaskMoved::class]);
    $task = ($this->task)('Rencana logistik');

    $this->move->handle($task, $this->owner, statusOf($this->workspace, 'review'));
    $this->move->handle($task->fresh(), $this->owner, statusOf($this->workspace, 'review'));

    $activities = Activity::query()->where('subject_id', $task->id)->where('event', 'task.status_changed')->get();

    expect($activities)->toHaveCount(1)
        ->and($activities->first()->properties)->toMatchArray([
            'key' => 'PLQ-1',
            'from' => ['id' => statusOf($this->workspace, 'todo')->id, 'name' => 'Todo', 'category' => 'todo'],
            'to' => ['id' => statusOf($this->workspace, 'review')->id, 'name' => 'Review', 'category' => 'review'],
        ]);

    Event::assertDispatchedTimes(TaskMoved::class, 2);
});

it('moves over PATCH /tugas/{id}/move and answers with the task', function () {
    $member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $task = ($this->task)('Skrip video');
    $done = statusOf($this->workspace, 'done');

    $this->actingAs($member)
        ->patchJson("/tugas/{$task->id}/move", ['status_id' => $done->id])
        ->assertOk()
        ->assertJsonPath('task.id', $task->id)
        ->assertJsonPath('task.status_id', $done->id)
        ->assertJsonPath('task.status_category', 'done')
        ->assertJsonPath('task.key', 'PLQ-1');

    expect($task->fresh()?->completed_at)->not->toBeNull();
});

it('rejects moves by viewers (403), outsiders (404) and into foreign columns (422)', function () {
    $task = ($this->task)('Kontrak vendor');
    $viewer = memberWithRole($this->workspace, WorkspaceRole::Viewer);
    $foreign = statusOf(Workspace::factory()->ownedBy($this->owner)->create(), 'done');

    $this->actingAs($viewer)->patchJson("/tugas/{$task->id}/move", ['status_id' => statusOf($this->workspace, 'done')->id])->assertForbidden();
    $this->actingAs(User::factory()->create())->patchJson("/tugas/{$task->id}/move", ['status_id' => statusOf($this->workspace, 'done')->id])->assertNotFound();
    $this->actingAs($this->owner)->patchJson("/tugas/{$task->id}/move", ['status_id' => $foreign->id])->assertUnprocessable()->assertJsonValidationErrors('status_id');

    expect($task->fresh()?->status_category)->toBe(TaskStatusCategory::Todo);
});

it('refuses to move tasks of an archived workspace', function () {
    $task = ($this->task)('Arsip');
    $this->workspace->update(['archived_at' => now()]);

    $this->actingAs($this->owner)
        ->patchJson("/tugas/{$task->id}/move", ['status_id' => statusOf($this->workspace, 'done')->id])
        ->assertForbidden();
});
