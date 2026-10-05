<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Planner\Enums\PlanBucket;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Events\Tasks\TaskMoved;
use App\Models\Activity;
use App\Models\Task;
use App\Models\TaskPlan;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

require_once __DIR__.'/../../Support/workspace-helpers.php';
require_once __DIR__.'/planner-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00', 'Asia/Jakarta'));
    $this->lead = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $this->me = User::factory()->withRole(Role::Anggota)->create();
    $this->ops = Workspace::factory()->ownedBy($this->lead)->create(['key' => 'OPS']);
    addMember($this->ops, $this->me);
    $this->personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->me->id)->firstOrFail();
    $this->task = assignTask($this->ops, $this->lead, $this->me, 'Rekap stok', '2026-10-09');
});

it('accepts a new assignment into a lane and answers with the fresh planner', function () {
    expect($this->actingAs($this->me)->getJson('/ruang-saya')->json('planner.incoming.0.title'))->toBe('Rekap stok');

    $response = $this->actingAs($this->me)
        ->putJson("/ruang-saya/tugas/{$this->task->id}", ['bucket' => 'today'])
        ->assertOk()
        ->assertJsonPath('planner.incoming', [])
        ->assertJsonPath('planner.lanes.today.0.id', $this->task->id)
        ->assertJsonPath('planner.lanes.today.0.auto', false);

    $plan = TaskPlan::query()->where('user_id', $this->me->id)->sole();
    expect($plan->bucket)->toBe(PlanBucket::Today)
        ->and($plan->planned_for?->toDateString())->toBe('2026-10-07')
        ->and($plan->seen_at?->toIso8601String())->toBe(now()->toIso8601String())
        ->and($response->json('planner.counts.today'))->toBe(1);

    // The task itself is untouched.
    expect($this->task->fresh()?->status_category)->toBe(TaskStatusCategory::Todo);
});

it('moves and reorders between lanes with neighbours', function () {
    $other = selfTask($this->ops, $this->me, 'Kedua');
    $this->actingAs($this->me)->putJson("/ruang-saya/tugas/{$this->task->id}", ['bucket' => 'week'])->assertOk();
    $this->actingAs($this->me)->putJson("/ruang-saya/tugas/{$other->id}", ['bucket' => 'week', 'before_id' => $this->task->id])
        ->assertOk()
        ->assertJsonPath('planner.lanes.week.0.title', 'Kedua')
        ->assertJsonPath('planner.lanes.week.1.title', 'Rekap stok');

    $this->actingAs($this->me)->putJson("/ruang-saya/tugas/{$other->id}", ['bucket' => 'later'])
        ->assertOk()
        ->assertJsonPath('planner.lanes.later.0.title', 'Kedua');
});

it('validates the lane', function () {
    $this->actingAs($this->me)->putJson("/ruang-saya/tugas/{$this->task->id}", ['bucket' => 'besok'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['bucket' => 'Pilih Hari ini, Minggu ini, atau Nanti.']);

    $this->actingAs($this->me)->putJson("/ruang-saya/tugas/{$this->task->id}", ['bucket' => 'today', 'after_id' => 'x'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('after_id');
});

it('returns a task to automatic placement without making it new again', function () {
    $this->actingAs($this->me)->putJson("/ruang-saya/tugas/{$this->task->id}", ['bucket' => 'today'])->assertOk();

    $this->actingAs($this->me)->deleteJson("/ruang-saya/tugas/{$this->task->id}")
        ->assertOk()
        ->assertJsonPath('planner.incoming', [])
        ->assertJsonPath('planner.lanes.week.0.id', $this->task->id)
        ->assertJsonPath('planner.lanes.week.0.auto', true);

    $plan = TaskPlan::query()->sole();
    expect($plan->bucket)->toBeNull()->and($plan->position)->toBeNull()->and($plan->seen_at)->not->toBeNull();
});

it('refuses tasks that are not the user\'s to plan', function () {
    $colleague = User::factory()->withRole(Role::Anggota)->create();
    addMember($this->ops, $colleague);
    $notMine = assignTask($this->ops, $this->lead, $colleague, 'Milik rekan');
    $theirPersonal = Workspace::query()->where('type', 'personal')->where('owner_id', $colleague->id)->firstOrFail();
    $theirNote = selfTask($theirPersonal, $colleague, 'Catatan rekan');
    $secret = Workspace::factory()->ownedBy($this->lead)->create();
    $hidden = assignTask($secret, $this->lead, $this->lead, 'Rahasia');
    $archived = Workspace::factory()->ownedBy($this->lead)->create();
    addMember($archived, $this->me);
    $frozen = assignTask($archived, $this->lead, $this->me, 'Beku');
    $archived->update(['archived_at' => now()]);

    $as = $this->actingAs($this->me);
    $as->putJson("/ruang-saya/tugas/{$notMine->id}", ['bucket' => 'today'])->assertForbidden()
        ->assertJsonPath('message', 'Hanya tugas yang ditugaskan kepada Anda atau catatan pribadi Anda yang bisa direncanakan.');
    $as->putJson("/ruang-saya/tugas/{$theirNote->id}", ['bucket' => 'today'])->assertNotFound();
    $as->putJson("/ruang-saya/tugas/{$hidden->id}", ['bucket' => 'today'])->assertNotFound();
    $as->putJson("/ruang-saya/tugas/{$frozen->id}", ['bucket' => 'today'])->assertForbidden();
    $as->deleteJson("/ruang-saya/tugas/{$theirNote->id}")->assertNotFound();
    $as->postJson("/ruang-saya/tugas/{$theirNote->id}/selesai")->assertNotFound();
    $as->postJson("/ruang-saya/tugas/{$notMine->id}/selesai")->assertForbidden();

    expect(TaskPlan::query()->count())->toBe(0)
        ->and($notMine->fresh()?->status_category)->toBe(TaskStatusCategory::Todo);

    $this->getJson('/ruang-saya')->assertOk();
    auth()->logout();
    $this->getJson('/ruang-saya')->assertUnauthorized();
});

it('sends a task to Review first when the workspace has a Review column', function () {
    Event::fake([TaskMoved::class]);

    $response = $this->actingAs($this->me)->postJson("/ruang-saya/tugas/{$this->task->id}/selesai")
        ->assertOk()
        ->assertJsonPath('outcome', 'review')
        ->assertJsonPath('previous_status_id', statusOf($this->ops, 'todo')->id)
        ->assertJsonPath('status.name', statusOf($this->ops, 'review')->name);

    $task = $this->task->fresh();
    expect($task?->status_category)->toBe(TaskStatusCategory::Review)
        ->and($task?->completed_at)->toBeNull()
        ->and($response->json('planner.lanes.week.0.status.category'))->toBe('review')
        ->and($response->json('planner.lanes.week.0.completes_to'))->toBe('done');

    // Same path as the board: activity log + realtime event.
    expect(Activity::query()->where('event', 'task.status_changed')->where('subject_id', $this->task->id)->count())->toBe(1);
    Event::assertDispatched(TaskMoved::class);

    // Already in review: the next tick completes it.
    $this->actingAs($this->me)->postJson("/ruang-saya/tugas/{$this->task->id}/selesai")
        ->assertOk()
        ->assertJsonPath('outcome', 'done')
        ->assertJsonPath('planner.lanes.week.0.done', true);

    expect($this->task->fresh()?->completed_at?->toIso8601String())->toBe(now()->toIso8601String());

    $this->actingAs($this->me)->postJson("/ruang-saya/tugas/{$this->task->id}/selesai")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['task' => 'Tugas ini sudah selesai.']);
});

it('completes directly without a Review column and in the personal workspace', function () {
    TaskStatus::query()->where('workspace_id', $this->ops->id)->where('category', 'review')->delete();
    $note = selfTask($this->personal, $this->me, 'Perpanjang SIM');

    $this->actingAs($this->me)->postJson("/ruang-saya/tugas/{$this->task->id}/selesai")->assertOk()->assertJsonPath('outcome', 'done');
    $this->actingAs($this->me)->postJson("/ruang-saya/tugas/{$note->id}/selesai")->assertOk()->assertJsonPath('outcome', 'done');

    expect($this->task->fresh()?->status_category)->toBe(TaskStatusCategory::Done)
        ->and($note->fresh()?->status_category)->toBe(TaskStatusCategory::Done);
});

it('undoes a completion through the board move endpoint', function () {
    $previous = $this->actingAs($this->me)->postJson("/ruang-saya/tugas/{$this->task->id}/selesai")->json('previous_status_id');

    $this->actingAs($this->me)->patchJson("/tugas/{$this->task->id}/move", ['status_id' => $previous])->assertOk();

    expect($this->task->fresh()?->status_id)->toBe($previous);
});

it('refuses completion for a viewer even when assigned', function () {
    $viewerWs = Workspace::factory()->ownedBy($this->lead)->create();
    addMember($viewerWs, $this->me, WorkspaceRole::Viewer);
    $task = assignTask($viewerWs, $this->lead, $this->lead, 'Hanya lihat');
    DB::table('task_assignees')->insert(['task_id' => $task->id, 'user_id' => $this->me->id, 'assigned_at' => now(), 'assigned_by' => $this->lead->id]);

    // Planning is personal and allowed; changing the team's status is not.
    $this->actingAs($this->me)->putJson("/ruang-saya/tugas/{$task->id}", ['bucket' => 'today'])->assertOk();
    $this->actingAs($this->me)->postJson("/ruang-saya/tugas/{$task->id}/selesai")->assertForbidden();

    expect($task->fresh()?->status_category)->toBe(TaskStatusCategory::Todo);
});

it('quick-adds a personal note planned for today', function () {
    $response = $this->actingAs($this->me)->postJson('/ruang-saya/catatan', ['title' => '  Perpanjang SIM  '])
        ->assertCreated()
        ->assertJsonPath('planner.lanes.today.0.title', 'Perpanjang SIM')
        ->assertJsonPath('planner.lanes.today.0.is_personal', true)
        ->assertJsonPath('planner.lanes.today.0.auto', false);

    $task = Task::query()->where('title', 'Perpanjang SIM')->sole();
    expect($task->workspace_id)->toBe($this->personal->id)
        ->and($task->created_by)->toBe($this->me->id)
        ->and($task->assignees()->pluck('users.id')->all())->toBe([$this->me->id])
        ->and($response->json('task.key'))->toBe($this->personal->key.'-'.$task->number)
        ->and(TaskPlan::query()->where('task_id', $task->id)->sole()->bucket)->toBe(PlanBucket::Today);

    $this->actingAs($this->me)->postJson('/ruang-saya/catatan', ['title' => 'Minggu depan', 'bucket' => 'week'])
        ->assertCreated()
        ->assertJsonPath('planner.lanes.week.0.title', 'Minggu depan');

    $this->actingAs($this->me)->postJson('/ruang-saya/catatan', ['title' => '   '])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['title' => 'Tulis catatannya dulu.']);
});

it('creates the personal workspace when it is missing', function () {
    $this->personal->forceDelete();

    $this->actingAs($this->me)->postJson('/ruang-saya/catatan', ['title' => 'Catatan pertama'])->assertCreated();

    $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->me->id)->sole();
    expect(Task::query()->where('title', 'Catatan pertama')->sole()->workspace_id)->toBe($personal->id);
});
