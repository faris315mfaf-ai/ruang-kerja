<?php

use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\MoveTask;
use App\Domain\Tasks\Actions\SendDeadlineNotifications;
use App\Domain\Tasks\Actions\UpdateTask;
use App\Domain\Tasks\Digest\TasksDueTodaySection;
use App\Domain\Tasks\Digest\TasksOverdueSection;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\InboxNotification;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Collection;

require_once __DIR__.'/../../Support/workspace-helpers.php';

beforeEach(function () {
    // Monday 6 Oct 2026, 07:00 WIB.
    $this->travelTo(CarbonImmutable::parse('2026-10-06 00:00:00', 'UTC'));
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'OPS']);
    $this->assignee = memberWithRole($this->workspace, WorkspaceRole::Member);
    $create = fn (string $title, ?string $due, array $assignees = []) => app(CreateTask::class)->handle($this->workspace, $this->owner, [
        'title' => $title, 'due_date' => $due, 'assignee_ids' => $assignees,
    ]);
    $this->tomorrow = $create('Laporan mingguan', '2026-10-07', [$this->assignee->id]);
    $this->late = $create('Verifikasi tagihan vendor', '2026-10-05', [$this->assignee->id]);
    $this->today = $create('Rapat koordinasi', '2026-10-06', [$this->assignee->id]);
    $create('Tanpa penanggung jawab', '2026-10-01');
    InboxNotification::query()->delete();
});

function inboxOf(User $user, NotificationType $type): Collection
{
    return InboxNotification::query()->where('notifiable_id', $user->id)->where('type', $type->value)->get();
}

it('sends H-1 and overdue reminders once to assignees', function () {
    $report = app(SendDeadlineNotifications::class)->handle();

    expect($report)->toBe(['due_soon' => 1, 'overdue' => 1]);

    $dueSoon = inboxOf($this->assignee, NotificationType::TaskDueSoon);
    $overdue = inboxOf($this->assignee, NotificationType::TaskOverdue);

    expect($dueSoon)->toHaveCount(1)
        ->and($dueSoon->first()?->data['title'])->toBe('OPS-1 jatuh tempo besok')
        ->and($dueSoon->first()?->data['url'])->toBe('/w/OPS/tasks/1')
        ->and($overdue)->toHaveCount(1)
        ->and($overdue->first()?->data['title'])->toBe('OPS-2 melewati tenggat')
        ->and($overdue->first()?->data['meta']['context'])->toBe('lewat 1 hari')
        ->and($overdue->first()?->action_required)->toBeTrue()
        ->and(InboxNotification::query()->where('notifiable_id', $this->owner->id)->count())->toBe(0);

    // Idempotent.
    expect(app(SendDeadlineNotifications::class)->handle())->toBe(['due_soon' => 0, 'overdue' => 0]);

    // Next day: the overdue task is not repeated, tomorrow's task is now due today (no H-1).
    $this->travel(1)->days();
    expect(app(SendDeadlineNotifications::class)->handle())->toBe(['due_soon' => 0, 'overdue' => 1]); // OPS-3 (today) became overdue
});

it('resolves the overdue reminder when the task is done or the due date moves', function () {
    app(SendDeadlineNotifications::class)->handle();
    $notification = inboxOf($this->assignee, NotificationType::TaskOverdue)->firstOrFail();

    expect($notification->resolved_at)->toBeNull();

    app(UpdateTask::class)->handle($this->late, $this->owner, ['due_date' => '2026-10-10']);
    expect($notification->fresh()?->resolved_at)->not->toBeNull();

    // After moving back into the past it may remind again; closing resolves it.
    app(UpdateTask::class)->handle($this->late->fresh(), $this->owner, ['due_date' => '2026-10-02']);
    app(SendDeadlineNotifications::class)->handle();
    $again = inboxOf($this->assignee, NotificationType::TaskOverdue)->whereNull('resolved_at')->first();
    expect($again)->not->toBeNull();

    app(MoveTask::class)->handle($this->late->fresh(), $this->owner, statusOf($this->workspace, 'done'));
    expect($again?->fresh()?->resolved_at)->not->toBeNull();
});

it('skips archived workspaces and closed tasks', function () {
    app(MoveTask::class)->handle($this->late, $this->owner, statusOf($this->workspace, 'done'));
    $this->workspace->forceFill(['archived_at' => now()])->save();

    expect(app(SendDeadlineNotifications::class)->handle())->toBe(['due_soon' => 0, 'overdue' => 0]);
});

it('builds the digest sections "Tenggat hari ini" and "Terlambat"', function () {
    $date = CarbonImmutable::parse('2026-10-06', config('app.office_timezone'));

    $today = app(TasksDueTodaySection::class)->build($this->assignee, $date);
    $overdue = app(TasksOverdueSection::class)->build($this->assignee, $date);

    expect($today?->title)->toBe('Tenggat hari ini (1)')
        ->and($today?->items[0]->code)->toBe('OPS-3')
        ->and($today?->note)->toContain('OPS-1 Laporan mingguan')
        ->and($overdue?->title)->toBe('Terlambat (1)')
        ->and($overdue?->tone)->toBe('danger')
        ->and($overdue?->items[0]->badge)->toBe('Lewat 1 hari')
        ->and(app(TasksDueTodaySection::class)->build($this->owner, $date))->toBeNull()
        ->and(app(TasksOverdueSection::class)->build($this->owner, $date))->toBeNull();
});

it('is scheduled as tasks:notify-deadlines', function () {
    $this->artisan('tasks:notify-deadlines')->expectsOutputToContain('1 pengingat tenggat besok, 1 pengingat terlambat.')->assertSuccessful();
});
