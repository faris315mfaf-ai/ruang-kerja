<?php

use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Domain\Tasks\Enums\TaskPriority;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Events\Tasks\TaskCreated;
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
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'OPS']);
    $this->create = app(CreateTask::class);
});

it('numbers tasks per workspace with KEY-n and never reuses numbers', function () {
    $other = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'KEU']);

    $first = $this->create->handle($this->workspace, $this->owner, ['title' => 'Pertama']);
    $second = $this->create->handle($this->workspace, $this->owner, ['title' => 'Kedua']);
    $elsewhere = $this->create->handle($other, $this->owner, ['title' => 'Di workspace lain']);

    $second->delete();
    $third = $this->create->handle($this->workspace, $this->owner, ['title' => 'Ketiga']);

    expect([$first->number, $second->number, $third->number])->toBe([1, 2, 3])
        ->and($first->displayKey())->toBe('OPS-1')
        ->and($elsewhere->displayKey())->toBe('KEU-1')
        ->and($this->workspace->fresh()->task_sequence)->toBe(3);
});

it('puts new tasks in the todo column, at the top, with denormalized status', function () {
    $first = $this->create->handle($this->workspace, $this->owner, ['title' => 'Lama']);
    $second = $this->create->handle($this->workspace, $this->owner, ['title' => 'Baru']);
    $todo = statusOf($this->workspace, 'todo');

    expect($first->status_id)->toBe($todo->id)
        ->and($first->status_category)->toBe(TaskStatusCategory::Todo)
        ->and($first->started_at)->toBeNull()
        ->and(columnIds($todo))->toBe([$second->id, $first->id]);
});

it('fills lifecycle timestamps when created straight into a later column', function () {
    $doing = $this->create->handle($this->workspace, $this->owner, ['title' => 'Jalan', 'status_id' => statusOf($this->workspace, 'in_progress')->id]);
    $done = $this->create->handle($this->workspace, $this->owner, ['title' => 'Beres', 'status_id' => statusOf($this->workspace, 'done')->id]);

    expect($doing->started_at)->not->toBeNull()
        ->and($doing->completed_at)->toBeNull()
        ->and($done->status_category)->toBe(TaskStatusCategory::Done)
        ->and($done->completed_at)->not->toBeNull();
});

it('only assigns workspace members and only uses workspace labels', function () {
    $member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $stranger = User::factory()->create();
    $label = Label::factory()->create(['workspace_id' => $this->workspace->id]);
    $foreignLabel = Label::factory()->create();

    $task = $this->create->handle($this->workspace, $this->owner, [
        'title' => 'Verifikasi tagihan',
        'priority' => TaskPriority::High,
        'due_date' => '2026-10-09',
        'description_text' => "Baris satu\nBaris dua",
        'assignee_ids' => [$member->id, $stranger->id],
        'label_ids' => [$label->id, $foreignLabel->id],
    ]);

    expect($task->assignees()->pluck('users.id')->all())->toBe([$member->id])
        ->and($task->labels()->pluck('labels.id')->all())->toBe([$label->id])
        ->and($task->watchers()->pluck('users.id')->sort()->values()->all())->toBe(collect([$member->id, $this->owner->id])->sort()->values()->all())
        ->and($task->priority)->toBe(TaskPriority::High)
        ->and($task->due_date?->toDateString())->toBe('2026-10-09')
        ->and($task->description_text)->toBe("Baris satu\nBaris dua")
        ->and($task->description['content'])->toHaveCount(2);
});

it('records activities and dispatches TaskCreated after commit', function () {
    Event::fake([TaskCreated::class]);
    $member = memberWithRole($this->workspace, WorkspaceRole::Member);

    $task = $this->create->handle($this->workspace, $this->owner, ['title' => 'Siaran pers', 'assignee_ids' => [$member->id]]);

    $events = Activity::query()->where('subject_id', $task->id)->orderBy('event')->pluck('event')->all();

    expect($events)->toBe([ActivityEvent::TaskAssigned->value, ActivityEvent::TaskCreated->value])
        ->and(Activity::query()->where('event', 'task.created')->first()?->properties)->toMatchArray(['key' => 'OPS-1', 'title' => 'Siaran pers']);

    Event::assertDispatched(TaskCreated::class, fn (TaskCreated $event) => $event->task->is($task)
        && $event->broadcastOn()[0]->name === 'private-workspace.'.$this->workspace->id);
});

it('creates tasks over HTTP for members and returns to the board', function () {
    $member = memberWithRole($this->workspace, WorkspaceRole::Member);

    $this->actingAs($member)
        ->from('/w/OPS')
        ->post('/w/OPS/tugas', ['title' => 'Rekap stok gudang', 'priority' => 2, 'assignee_ids' => [$member->id]])
        ->assertRedirect('/w/OPS')
        ->assertSessionHasNoErrors();

    $task = Task::query()->where('workspace_id', $this->workspace->id)->sole();

    expect($task->title)->toBe('Rekap stok gudang')
        ->and($task->created_by)->toBe($member->id);
});

it('returns the created task as JSON for API callers', function () {
    $this->actingAs($this->owner)
        ->postJson('/w/OPS/tugas', ['title' => 'Lewat API'])
        ->assertCreated()
        ->assertJsonPath('task.key', 'OPS-1')
        ->assertJsonPath('task.status_category', 'todo');
});

it('validates task input in Indonesian', function () {
    $outsider = User::factory()->create();

    $this->actingAs($this->owner)
        ->postJson('/w/OPS/tugas', [
            'title' => '',
            'priority' => 9,
            'due_date' => '05-10-2026',
            'assignee_ids' => [$outsider->id],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'title' => 'Judul tugas wajib diisi.',
            'priority' => 'Prioritas tidak valid.',
            'due_date' => 'Tenggat tidak valid.',
            'assignee_ids.0' => 'Penanggung jawab harus anggota workspace.',
        ]);
});

it('blocks viewers (403) and hides private workspaces from outsiders (404)', function () {
    $viewer = memberWithRole($this->workspace, WorkspaceRole::Viewer);

    $this->actingAs($viewer)->post('/w/OPS/tugas', ['title' => 'Tidak boleh'])->assertForbidden();
    $this->actingAs(User::factory()->create())->post('/w/OPS/tugas', ['title' => 'Tidak boleh'])->assertNotFound();

    expect(Task::query()->count())->toBe(0);
});
