<?php

use App\Domain\Notifications\Actions\ArchiveNotification;
use App\Domain\Notifications\Actions\MarkAllNotificationsRead;
use App\Domain\Notifications\Actions\MarkNotificationRead;
use App\Domain\Notifications\Actions\MarkNotificationUnread;
use App\Domain\Notifications\Actions\PruneNotifications;
use App\Domain\Notifications\Actions\ResolveNotificationsForSubject;
use App\Domain\Notifications\Actions\SendTestNotification;
use App\Domain\Notifications\Actions\UnarchiveNotification;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Services\NotificationHistory;
use App\Models\InboxNotification;
use App\Models\User;
use Carbon\CarbonImmutable;
use Tests\Support\FakeModuleNotification;

it('marks read idempotently without moving the first read time', function () {
    $notification = InboxNotification::factory()->create();

    $this->travelTo(CarbonImmutable::parse('2026-10-05 01:00:00'));
    app(MarkNotificationRead::class)->handle($notification);
    $this->travelTo(CarbonImmutable::parse('2026-10-05 02:00:00'));
    app(MarkNotificationRead::class)->handle($notification);

    expect($notification->refresh()->read_at?->toDateTimeString())->toBe('2026-10-05 01:00:00');

    app(MarkNotificationUnread::class)->handle($notification);
    expect($notification->refresh()->read_at)->toBeNull();
});

it('archives and unarchives', function () {
    $notification = InboxNotification::factory()->create();

    app(ArchiveNotification::class)->handle($notification);
    expect($notification->refresh()->archived_at)->not->toBeNull()->and($notification->read_at)->not->toBeNull();

    app(UnarchiveNotification::class)->handle($notification);
    expect($notification->refresh()->archived_at)->toBeNull()->and($notification->read_at)->not->toBeNull();
});

it('marks all of one user\'s notifications read', function () {
    $user = User::factory()->create();
    InboxNotification::factory()->recipient($user)->count(2)->create();
    $other = InboxNotification::factory()->create();

    expect(app(MarkAllNotificationsRead::class)->handle($user))->toBe(2)
        ->and($other->refresh()->read_at)->toBeNull();
});

it('resolves "Perlu tindakan" items for a subject, for every recipient', function () {
    $approverA = User::factory()->create();
    $approverB = User::factory()->create();
    $subject = User::factory()->create(); // any model works as subject
    $otherSubject = User::factory()->create();

    $approverA->notify(new FakeModuleNotification(NotificationType::RequestSubmitted, subject: $subject));
    $approverB->notify(new FakeModuleNotification(NotificationType::RequestSubmitted, subject: $subject));
    $approverA->notify(new FakeModuleNotification(NotificationType::RequestSubmitted, subject: $otherSubject));

    $resolved = app(ResolveNotificationsForSubject::class)->handle($subject, NotificationType::RequestSubmitted);

    expect($resolved)->toBe(2)
        ->and(InboxNotification::query()->visibleTo($approverA)->needsAction()->count())->toBe(1)
        ->and(InboxNotification::query()->visibleTo($approverB)->needsAction()->count())->toBe(0)
        ->and(InboxNotification::query()->whereNull('read_at')->count())->toBe(3);
});

it('only resolves the given types', function () {
    $user = User::factory()->create();
    $subject = User::factory()->create();
    $user->notify(new FakeModuleNotification(NotificationType::TaskOverdue, subject: $subject));

    expect(app(ResolveNotificationsForSubject::class)->handle($subject, NotificationType::RequestSubmitted))->toBe(0)
        ->and(app(ResolveNotificationsForSubject::class)->handle($subject))->toBe(1);
});

it('prunes old notifications but keeps unresolved action items', function () {
    $now = CarbonImmutable::parse('2026-10-05 00:00:00');
    $old = InboxNotification::factory()->create(['created_at' => $now->subDays(31)]);
    $recent = InboxNotification::factory()->create(['created_at' => $now->subDays(29)]);
    $oldAction = InboxNotification::factory()->needsAction()->create(['created_at' => $now->subDays(40)]);
    $oldResolved = InboxNotification::factory()->needsAction()->create(['created_at' => $now->subDays(40), 'resolved_at' => $now->subDays(35)]);

    expect(app(PruneNotifications::class)->handle($now))->toBe(2);

    expect(InboxNotification::query()->pluck('id')->sort()->values()->all())
        ->toBe(collect([$recent->id, $oldAction->id])->sort()->values()->all());
    expect(InboxNotification::query()->find($old->id))->toBeNull()
        ->and(InboxNotification::query()->find($oldResolved->id))->toBeNull();
});

it('runs the prune command', function () {
    InboxNotification::factory()->create(['created_at' => now()->subDays(60)]);

    $this->artisan('notifications:prune')->expectsOutput('1 notifikasi dihapus.')->assertSuccessful();
});

it('tells scheduled jobs whether a notification was already sent (no duplicates)', function () {
    $user = User::factory()->create();
    $task = User::factory()->create();
    $history = app(NotificationHistory::class);

    expect($history->wasSent($user, NotificationType::TaskDueSoon, $task))->toBeFalse();

    $user->notify(new FakeModuleNotification(NotificationType::TaskDueSoon, subject: $task));

    expect($history->wasSent($user, NotificationType::TaskDueSoon, $task))->toBeTrue()
        ->and($history->wasSent($user, NotificationType::TaskOverdue, $task))->toBeFalse()
        ->and($history->wasSent(User::factory()->create(), NotificationType::TaskDueSoon, $task))->toBeFalse()
        ->and($history->wasSent($user, NotificationType::TaskDueSoon, $task, now()->addMinute()))->toBeFalse();
});

it('sends a test notification to the user', function () {
    $user = User::factory()->create();

    app(SendTestNotification::class)->handle($user);

    $row = InboxNotification::query()->visibleTo($user)->sole();
    expect($row->type)->toBe('system.test')
        ->and($row->dataString('url'))->toBe('/pengaturan/notifikasi');
});
