<?php

use App\Domain\Notifications\Actions\PruneNotifications;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\DeleteTask;
use App\Domain\Tasks\Actions\SendDeadlineNotifications;
use App\Domain\Tasks\Actions\UpdateTask;
use App\Domain\Workspaces\Actions\ArchiveWorkspace;
use App\Domain\Workspaces\Actions\RemoveWorkspaceMember;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\InboxNotification;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * "melewati tenggat" is "Perlu tindakan" until settled. Besides closing the task
 * or moving the due date, it is settled when the task is deleted, the assignee
 * is unassigned or loses access, or the workspace is archived; orphans are
 * resolved (and later pruned) by notifications:prune.
 */

beforeEach(function () {
    // Monday 6 Oct 2026, 07:00 WIB.
    $this->travelTo(CarbonImmutable::parse('2026-10-06 00:00:00', 'UTC'));
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'OPS']);
    $this->rizky = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->sari = memberWithRole($this->workspace, WorkspaceRole::Member);
    $this->late = app(CreateTask::class)->handle($this->workspace, $this->owner, [
        'title' => 'Verifikasi tagihan vendor', 'due_date' => '2026-10-05', 'assignee_ids' => [$this->rizky->id, $this->sari->id],
    ]);
    InboxNotification::query()->delete();
    app(SendDeadlineNotifications::class)->handle();
});

function openOverdue(User $user): int
{
    return InboxNotification::query()->visibleTo($user)->ofType(NotificationType::TaskOverdue)
        ->where('action_required', true)->whereNull('resolved_at')->count();
}

it('starts with one open overdue reminder per assignee', function () {
    expect(openOverdue($this->rizky))->toBe(1)->and(openOverdue($this->sari))->toBe(1);
});

it('settles the reminders when the task is deleted', function () {
    app(DeleteTask::class)->handle($this->late, $this->owner);

    expect(openOverdue($this->rizky))->toBe(0)->and(openOverdue($this->sari))->toBe(0);
});

it('settles only the unassigned person\'s reminder', function () {
    app(UpdateTask::class)->handle($this->late, $this->owner, ['assignee_ids' => [$this->sari->id]]);

    expect(openOverdue($this->rizky))->toBe(0)->and(openOverdue($this->sari))->toBe(1);
});

it('settles the reminders when the workspace is archived', function () {
    app(ArchiveWorkspace::class)->handle($this->workspace, $this->owner);

    expect(openOverdue($this->rizky))->toBe(0)->and(openOverdue($this->sari))->toBe(0);
});

it('settles the reminder of a member who loses access', function () {
    app(RemoveWorkspaceMember::class)->handle($this->workspace, $this->owner, $this->rizky);

    expect(openOverdue($this->rizky))->toBe(0)->and(openOverdue($this->sari))->toBe(1);
});

it('keeps the reminder of a removed member who still sees an internal workspace', function () {
    $this->workspace->forceFill(['visibility' => 'internal'])->save();

    app(RemoveWorkspaceMember::class)->handle($this->workspace, $this->owner, $this->rizky);

    expect(openOverdue($this->rizky))->toBe(1);
});

it('resolves orphaned items on prune and deletes them once past retention', function () {
    // A task removed without DeleteTask (e.g. force-deleted) leaves its reminders behind.
    Task::query()->whereKey($this->late->id)->delete();
    expect(openOverdue($this->rizky))->toBe(1);

    app(PruneNotifications::class)->handle(CarbonImmutable::now());

    expect(openOverdue($this->rizky))->toBe(0)
        ->and(InboxNotification::query()->visibleTo($this->rizky)->exists())->toBeTrue();

    app(PruneNotifications::class)->handle(CarbonImmutable::now()->addDays(31));

    expect(InboxNotification::query()->visibleTo($this->rizky)->ofType(NotificationType::TaskOverdue)->exists())->toBeFalse();
});

it('keeps unresolved items whose subject still exists', function () {
    app(PruneNotifications::class)->handle(CarbonImmutable::now()->addDays(31));

    expect(openOverdue($this->rizky))->toBe(1);
});
