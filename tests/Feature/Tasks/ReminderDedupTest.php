<?php

use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Services\NotificationDispatchLog;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\SendDeadlineNotifications;
use App\Domain\Tasks\Actions\UpdateTask;
use App\Domain\Tasks\Notifications\TaskDueSoonNotification;
use App\Domain\Tasks\Notifications\TaskOverdueNotification;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\InboxNotification;
use App\Models\NotificationPreference;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
 * Deadline reminders are de-duplicated independently of channels: a person
 * with in-app notifications off (e-mail only) gets the overdue e-mail once,
 * not every day.
 */

beforeEach(function () {
    // Monday 6 Oct 2026, 07:00 WIB.
    $this->travelTo(CarbonImmutable::parse('2026-10-06 00:00:00', 'UTC'));
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->create();
    $this->workspace = Workspace::factory()->ownedBy($this->owner)->create(['key' => 'OPS']);
    $this->rizky = memberWithRole($this->workspace, WorkspaceRole::Member);

    foreach (['task.overdue', 'task.due_soon'] as $event) {
        NotificationPreference::query()->create(['user_id' => $this->rizky->id, 'event' => $event, 'channel' => 'in_app', 'enabled' => false]);
        NotificationPreference::query()->create(['user_id' => $this->rizky->id, 'event' => $event, 'channel' => 'email', 'enabled' => true]);
    }

    $this->late = app(CreateTask::class)->handle($this->workspace, $this->owner, [
        'title' => 'Verifikasi tagihan vendor', 'due_date' => '2026-10-05', 'assignee_ids' => [$this->rizky->id],
    ]);
    $this->tomorrow = app(CreateTask::class)->handle($this->workspace, $this->owner, [
        'title' => 'Laporan mingguan', 'due_date' => '2026-10-07', 'assignee_ids' => [$this->rizky->id],
    ]);
    Notification::fake();
});

it('e-mails an overdue reminder once even without an Inbox row', function () {
    app(SendDeadlineNotifications::class)->handle();
    $this->travel(1)->day();
    app(SendDeadlineNotifications::class)->handle();
    $this->travel(1)->day();
    app(SendDeadlineNotifications::class)->handle();

    Notification::assertSentToTimes($this->rizky, TaskOverdueNotification::class, 2); // OPS-1, then OPS-2 once it is late
    Notification::assertSentTo($this->rizky, TaskOverdueNotification::class, fn (TaskOverdueNotification $n, array $channels) => $channels === ['mail']);
    expect(InboxNotification::query()->visibleTo($this->rizky)->ofType(NotificationType::TaskOverdue)->count())->toBe(0);
});

it('sends the H-1 reminder once when the job runs twice the same day', function () {
    app(SendDeadlineNotifications::class)->handle();
    app(SendDeadlineNotifications::class)->handle();

    Notification::assertSentToTimes($this->rizky, TaskDueSoonNotification::class, 1);
});

it('reminds again after the reminder was settled and the task is late again', function () {
    app(SendDeadlineNotifications::class)->handle();

    // Due date moved to the future → settled; later late again with a new due date.
    app(UpdateTask::class)->handle($this->late, $this->owner, ['due_date' => '2026-10-08']);
    $this->travelTo(CarbonImmutable::parse('2026-10-09 00:00:00', 'UTC'));
    app(SendDeadlineNotifications::class)->handle();

    Notification::assertSentTimes(TaskOverdueNotification::class, 3);
});

it('claims a reminder slot atomically', function () {
    $log = app(NotificationDispatchLog::class);

    expect($log->claim($this->rizky, NotificationType::TaskOverdue, $this->late, '2026-10-05'))->toBeTrue()
        ->and($log->claim($this->rizky, NotificationType::TaskOverdue, $this->late, '2026-10-05'))->toBeFalse()
        ->and($log->claim($this->rizky, NotificationType::TaskOverdue, $this->late, '2026-10-08'))->toBeTrue();
});
