<?php

use App\Domain\Automation\Actions\RunAutomationRule;
use App\Domain\Automation\Jobs\RunOverdueAutomations;
use App\Domain\Automation\Notifications\AutomationNotification;
use App\Domain\Organization\Enums\Role;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\MoveTask;
use App\Domain\Tasks\Actions\UpdateTask;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\AutomationRule;
use App\Models\AutomationRun;
use App\Models\Division;
use App\Models\Label;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Rule execution (F2-4): every trigger and action, conditions, the loop
 * guard (chain + depth), the run log and the daily "lewat tenggat" job.
 */
beforeEach(function () {
    $this->seed(RoleSeeder::class);
    config(['features.automation' => true]);
    Notification::fake();
    $this->owner = User::factory()->withRole(Role::KepalaDivisi)->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'OPS', 'type' => WorkspaceType::Team]);
    $this->member = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->task = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Laporan stok', 'assignee_ids' => [$this->member->id]]);
});

/**
 * @param  array<string, mixed>  $trigger
 * @param  list<array<string, mixed>>  $actions
 * @param  array<string, mixed>|null  $condition
 */
function automationRule(array $trigger, array $actions, ?array $condition = null, string $name = 'Aturan uji'): AutomationRule
{
    return AutomationRule::factory()->forWorkspace(test()->workspace)->trigger($trigger)->actions($actions)->create([
        'name' => $name,
        'condition' => $condition,
    ]);
}

function moveTo(Task $task, string $category, ?User $actor = null): Task
{
    return app(MoveTask::class)->handle($task->fresh(), $actor ?? test()->owner, statusOf(test()->workspace, $category));
}

it('notifies the assignees when a task moves into the trigger category', function () {
    $rule = automationRule(['type' => 'task_moved', 'category' => 'review'], [['type' => 'notify', 'target' => ['kind' => 'assignees']]], name: 'Review ke PJ');

    moveTo($this->task, 'review');

    Notification::assertSentTo($this->member, AutomationNotification::class, function (AutomationNotification $notification): bool {
        return $notification->ruleName === 'Review ke PJ' && $notification->reason === 'pindah ke kolom Review';
    });

    $run = AutomationRun::query()->sole();
    expect($run->result->value)->toBe('success')
        ->and($run->task_key)->toBe('OPS-1')
        ->and($run->detail)->toContain($this->member->name)
        ->and($run->depth)->toBe(0)
        ->and($rule->fresh()->run_count)->toBe(1)
        ->and($rule->fresh()->last_run_at)->not->toBeNull();
});

it('ignores reorders inside the same column and other categories', function () {
    automationRule(['type' => 'task_moved', 'category' => 'review'], [['type' => 'notify', 'target' => ['kind' => 'assignees']]]);

    moveTo($this->task, 'todo');
    moveTo($this->task, 'in_progress');

    expect(AutomationRun::query()->count())->toBe(0);
    Notification::assertNotSentTo($this->member, AutomationNotification::class);
});

it('also fires when the status changes through the task detail (UpdateTask)', function () {
    automationRule(['type' => 'task_moved', 'category' => 'done'], [['type' => 'notify', 'target' => ['kind' => 'user', 'id' => $this->owner->id]]]);

    app(UpdateTask::class)->handle($this->task->fresh(), $this->member, [
        'status_id' => statusOf($this->workspace, 'done')->id,
        'title' => 'Laporan stok final',
    ]);

    Notification::assertSentTo($this->owner, AutomationNotification::class);
    expect(AutomationRun::query()->count())->toBe(1);
});

it('runs only when the condition holds', function () {
    automationRule(
        ['type' => 'task_moved', 'category' => 'review'],
        [['type' => 'notify', 'target' => ['kind' => 'assignees']]],
        ['type' => 'priority', 'priority' => 1],
    );

    moveTo($this->task, 'review');
    expect(AutomationRun::query()->count())->toBe(0);

    app(UpdateTask::class)->handle($this->task->fresh(), $this->owner, ['priority' => 1]);
    moveTo($this->task, 'todo');
    moveTo($this->task, 'review');

    expect(AutomationRun::query()->count())->toBe(1);
});

it('checks the assignee condition', function () {
    $other = memberWithRole($this->workspace, WorkspaceRole::Member);
    automationRule(
        ['type' => 'task_moved', 'category' => 'review'],
        [['type' => 'notify', 'target' => ['kind' => 'user', 'id' => $this->owner->id]]],
        ['type' => 'assignee', 'user_id' => $other->id],
    );

    moveTo($this->task, 'review');

    expect(AutomationRun::query()->count())->toBe(0);
});

it('labels and assigns tasks created with a label', function () {
    $client = Label::factory()->create(['workspace_id' => $this->workspace->id, 'name' => 'Klien']);
    $reviewed = Label::factory()->create(['workspace_id' => $this->workspace->id, 'name' => 'Ditinjau']);
    $reviewer = memberWithRole($this->workspace, WorkspaceRole::Member);
    automationRule(['type' => 'task_created_with_label', 'label_id' => $client->id], [
        ['type' => 'add_label', 'label_id' => $reviewed->id],
        ['type' => 'assign', 'user_id' => $reviewer->id],
    ]);

    $plain = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Tanpa label']);
    $task = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Kunjungan klien', 'label_ids' => [$client->id]]);

    expect($task->labels()->pluck('labels.id')->sort()->values()->all())->toBe(collect([$client->id, $reviewed->id])->sort()->values()->all())
        ->and($task->assignees()->pluck('users.id')->all())->toBe([$reviewer->id])
        ->and($plain->labels()->count())->toBe(0);

    $run = AutomationRun::query()->sole();
    expect($run->result->value)->toBe('success')
        ->and($run->detail)->toContain('abel "Ditinjau" ditambahkan')
        ->and($run->detail)->toContain("ditugaskan ke {$reviewer->name}");
});

it('logs a skipped run when every action had nothing to do', function () {
    $label = Label::factory()->create(['workspace_id' => $this->workspace->id, 'name' => 'Klien']);
    automationRule(['type' => 'task_moved', 'category' => 'review'], [
        ['type' => 'assign', 'user_id' => $this->member->id],
    ]);
    app(UpdateTask::class)->handle($this->task->fresh(), $this->owner, ['label_ids' => [$label->id]]);

    moveTo($this->task, 'review');

    $run = AutomationRun::query()->sole();
    expect($run->result->value)->toBe('skipped')
        ->and($run->detail)->toContain('sudah penanggung jawab');
});

it('moves the task to the first column of the target category', function () {
    automationRule(['type' => 'task_moved', 'category' => 'review'], [['type' => 'move_status', 'category' => 'done']]);

    moveTo($this->task, 'review');

    expect($this->task->fresh()->status_category->value)->toBe('done')
        ->and($this->task->fresh()->completed_at)->not->toBeNull();
});

it('stops a rule from running twice in one chain', function () {
    $toDone = automationRule(['type' => 'task_moved', 'category' => 'review'], [['type' => 'move_status', 'category' => 'done']], name: 'A');
    automationRule(['type' => 'task_moved', 'category' => 'done'], [['type' => 'move_status', 'category' => 'in_progress']], name: 'B');
    automationRule(['type' => 'task_moved', 'category' => 'in_progress'], [['type' => 'move_status', 'category' => 'review']], name: 'C');

    moveTo($this->task, 'review');

    // A (depth 0) → B (1) → C (2) → A again: refused, the chain ends in Review.
    expect($this->task->fresh()->status_category->value)->toBe('review');

    $runs = AutomationRun::query()->where('rule_id', $toDone->id)->orderBy('ran_at')->orderBy('id')->get();
    // The refused second run is logged inside the first one (queued inline in tests).
    expect($runs->pluck('result')->map->value->sort()->values()->all())->toBe(['skipped', 'success'])
        ->and($runs->firstWhere('result.value', 'skipped')?->detail)->toContain('rantai yang sama')
        ->and(AutomationRun::query()->max('depth'))->toBe(3);
});

it('stops a chain after three rules', function () {
    automationRule(['type' => 'task_moved', 'category' => 'review'], [['type' => 'move_status', 'category' => 'done']], name: 'R1');
    automationRule(['type' => 'task_moved', 'category' => 'done'], [['type' => 'move_status', 'category' => 'in_progress']], name: 'R2');
    automationRule(['type' => 'task_moved', 'category' => 'in_progress'], [['type' => 'move_status', 'category' => 'todo']], name: 'R3');
    $fourth = automationRule(['type' => 'task_moved', 'category' => 'todo'], [['type' => 'move_status', 'category' => 'backlog']], name: 'R4');

    moveTo($this->task, 'review');

    expect($this->task->fresh()->status_category->value)->toBe('todo');
    $run = AutomationRun::query()->where('rule_id', $fourth->id)->sole();
    expect($run->result->value)->toBe('skipped')
        ->and($run->depth)->toBe(3)
        ->and($run->detail)->toContain('3 aturan');
});

it('does not run paused rules or rules of other workspaces', function () {
    AutomationRule::factory()->forWorkspace($this->workspace)->paused()->create();
    $other = Workspace::factory()->ownedBy($this->owner)->create();
    AutomationRule::factory()->forWorkspace($other)->create();

    moveTo($this->task, 'review');

    expect(AutomationRun::query()->count())->toBe(0);
});

it('does nothing while the feature is off', function () {
    automationRule(['type' => 'task_moved', 'category' => 'review'], [['type' => 'notify', 'target' => ['kind' => 'assignees']]]);
    config(['features.automation' => false]);

    moveTo($this->task, 'review');

    expect(AutomationRun::query()->count())->toBe(0);
});

it('falls back to the owner and fails when nobody may edit the tasks', function () {
    $admin = memberWithRole($this->workspace, WorkspaceRole::Admin);
    $rule = automationRule(['type' => 'task_moved', 'category' => 'review'], [['type' => 'move_status', 'category' => 'done']]);
    $rule->update(['created_by' => $admin->id]);
    $admin->update(['status' => 'inactive']);

    moveTo($this->task, 'review');
    expect($this->task->fresh()->status_category->value)->toBe('done');

    $this->owner->update(['status' => 'inactive']);
    moveTo($this->task, 'review', $this->member);

    $failed = AutomationRun::query()->where('result', 'failed')->sole();
    expect($failed->detail)->toContain('tidak lagi bisa mengubah tugas');
});

it('notifies roles only when they can see the task', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();
    $direksi = User::factory()->withRole(Role::Direksi)->create();
    automationRule(['type' => 'task_moved', 'category' => 'review'], [
        ['type' => 'notify', 'target' => ['kind' => 'role', 'role' => 'hr']],
        ['type' => 'notify', 'target' => ['kind' => 'role', 'role' => 'direksi']],
    ]);

    moveTo($this->task, 'review');

    // Direksi and HR see every shared workspace (read only, keputusan pemilik 6 Okt 2026).
    Notification::assertSentTo($hr, AutomationNotification::class);
    Notification::assertSentTo($direksi, AutomationNotification::class);
});

it('skips a role that cannot see the task', function () {
    $outsider = User::factory()->withRole(Role::KepalaDivisi)->create();
    Division::factory()->headedBy($outsider)->create();
    automationRule(['type' => 'task_moved', 'category' => 'review'], [
        ['type' => 'notify', 'target' => ['kind' => 'role', 'role' => 'kepala_divisi']],
    ]);

    moveTo($this->task, 'review');

    // Private workspace, not a member and not their division: skipped.
    Notification::assertNotSentTo($outsider, AutomationNotification::class);
});

it('notifies the head of the division and the whole workspace', function () {
    $head = User::factory()->withRole(Role::KepalaDivisi)->create();
    $division = Division::factory()->headedBy($head)->create();
    $this->member->update(['division_id' => $division->id]);
    addMember($this->workspace, $head);
    automationRule(['type' => 'task_moved', 'category' => 'review'], [
        ['type' => 'notify', 'target' => ['kind' => 'role', 'role' => 'kepala_divisi']],
    ]);
    automationRule(['type' => 'task_moved', 'category' => 'done'], [
        ['type' => 'notify', 'target' => ['kind' => 'role', 'role' => 'anggota']],
    ]);

    moveTo($this->task, 'review');
    Notification::assertSentTo($head, AutomationNotification::class);
    Notification::assertNotSentTo($this->member, AutomationNotification::class);

    moveTo($this->task, 'done');
    Notification::assertSentTo([$this->owner, $this->member], AutomationNotification::class);
});

it('runs overdue rules once per task and due date', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-07 07:05', 'Asia/Jakarta'));
    $rule = automationRule(['type' => 'task_overdue'], [['type' => 'notify', 'target' => ['kind' => 'assignees']]]);
    app(UpdateTask::class)->handle($this->task->fresh(), $this->owner, ['due_date' => '2026-10-05']);
    $done = app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Sudah selesai', 'due_date' => '2026-10-01']);
    moveTo($done, 'done');
    app(CreateTask::class)->handle($this->workspace, $this->owner, ['title' => 'Tenggat nanti', 'due_date' => '2026-10-20']);

    expect(app(RunOverdueAutomations::class)->handle(app(RunAutomationRule::class)))->toBe(1);
    expect(app(RunOverdueAutomations::class)->handle(app(RunAutomationRule::class)))->toBe(0);

    $this->travelTo(CarbonImmutable::parse('2026-10-08 07:05', 'Asia/Jakarta'));
    expect(app(RunOverdueAutomations::class)->handle(app(RunAutomationRule::class)))->toBe(0);

    // Due date moved and missed again: a new cycle.
    app(UpdateTask::class)->handle($this->task->fresh(), $this->owner, ['due_date' => '2026-10-07']);
    expect(app(RunOverdueAutomations::class)->handle(app(RunAutomationRule::class)))->toBe(1);

    expect(AutomationRun::query()->where('rule_id', $rule->id)->pluck('cycle')->sort()->values()->all())
        ->toBe(['overdue:2026-10-05', 'overdue:2026-10-07']);
    Notification::assertSentToTimes($this->member, AutomationNotification::class, 2);
});

it('skips overdue rules in archived workspaces', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-07 07:05', 'Asia/Jakarta'));
    automationRule(['type' => 'task_overdue'], [['type' => 'notify', 'target' => ['kind' => 'assignees']]]);
    app(UpdateTask::class)->handle($this->task->fresh(), $this->owner, ['due_date' => '2026-10-05']);
    $this->workspace->update(['archived_at' => now()]);

    expect(app(RunOverdueAutomations::class)->handle(app(RunAutomationRule::class)))->toBe(0);
});
