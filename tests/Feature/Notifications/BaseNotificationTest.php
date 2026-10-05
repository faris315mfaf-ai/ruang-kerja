<?php

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Channels\InAppChannel;
use App\Domain\Notifications\Channels\WhatsAppChannel;
use App\Domain\Notifications\Contracts\UserAvailability;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationChannel;
use App\Domain\Notifications\Enums\NotificationEvent;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Notifications\SystemAnnouncement;
use App\Models\InboxNotification;
use App\Models\NotificationPreference;
use App\Models\NotificationSetting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Contracts\Queue\ShouldQueueAfterCommit;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;
use Tests\Support\FakeModuleNotification;

function fakeNotification(NotificationType $type, ?User $actor = null, ?User $subject = null): BaseNotification
{
    return new FakeModuleNotification($type, $actor, $subject);
}

function preference(User $user, NotificationEvent $event, NotificationChannel $channel, bool $enabled): void
{
    NotificationPreference::query()->create([
        'user_id' => $user->id,
        'event' => $event->value,
        'channel' => $channel->value,
        'enabled' => $enabled,
    ]);
}

it('queues after the surrounding transaction commits', function () {
    expect(fakeNotification(NotificationType::TaskAssigned))->toBeInstanceOf(ShouldQueueAfterCommit::class);
});

it('uses the config defaults when the user has no preference rows', function (NotificationType $type, array $expected) {
    $user = User::factory()->create();

    expect(fakeNotification($type)->via($user))->toBe($expected);
})->with([
    'assigned: in-app + email' => [NotificationType::TaskAssigned, [InAppChannel::class, 'broadcast', 'mail']],
    'mention: in-app + email' => [NotificationType::Mention, [InAppChannel::class, 'broadcast', 'mail']],
    'comment: in-app only' => [NotificationType::TaskCommented, [InAppChannel::class, 'broadcast']],
    'due soon: in-app only' => [NotificationType::TaskDueSoon, [InAppChannel::class, 'broadcast']],
    'overdue: in-app + email' => [NotificationType::TaskOverdue, [InAppChannel::class, 'broadcast', 'mail']],
    'request submitted: in-app + email' => [NotificationType::RequestSubmitted, [InAppChannel::class, 'broadcast', 'mail']],
    'request rejected: in-app + email' => [NotificationType::RequestRejected, [InAppChannel::class, 'broadcast', 'mail']],
    'check-in reminder: in-app only' => [NotificationType::CheckInReminder, [InAppChannel::class, 'broadcast']],
    'system: in-app only' => [NotificationType::SystemAnnouncement, [InAppChannel::class, 'broadcast']],
]);

it('reads defaults from config/notifications.php', function () {
    config(['notifications.defaults' => [...config('notifications.defaults'), 'task.commented' => ['in_app' => true, 'email' => true]]]);
    $user = User::factory()->create();

    expect(fakeNotification(NotificationType::TaskCommented)->via($user))->toContain('mail');
});

it('drops email when the user switched email off', function () {
    $user = User::factory()->create();
    preference($user, NotificationEvent::TaskAssigned, NotificationChannel::Email, false);

    expect(fakeNotification(NotificationType::TaskAssigned)->via($user))->toBe([InAppChannel::class, 'broadcast']);
});

it('adds email when the user switched it on', function () {
    $user = User::factory()->create();
    preference($user, NotificationEvent::TaskCommented, NotificationChannel::Email, true);

    expect(fakeNotification(NotificationType::TaskCommented)->via($user))->toContain('mail');
});

it('drops in-app and the realtime broadcast when in-app is switched off', function () {
    $user = User::factory()->create();
    preference($user, NotificationEvent::Mention, NotificationChannel::InApp, false);

    expect(fakeNotification(NotificationType::Mention)->via($user))->toBe(['mail']);
});

it('keeps locked in-app channels on even if a preference row says off', function (NotificationType $type) {
    $user = User::factory()->create();
    preference($user, $type->event(), NotificationChannel::InApp, false);

    expect(fakeNotification($type)->via($user))->toContain(InAppChannel::class, 'broadcast');
})->with([NotificationType::RequestSubmitted, NotificationType::SystemAnnouncement]);

it('applies one preference row to every type of the same event', function (NotificationType $type) {
    $user = User::factory()->create();
    preference($user, NotificationEvent::RequestDecided, NotificationChannel::Email, false);

    expect(fakeNotification($type)->via($user))->not->toContain('mail');
})->with([NotificationType::RequestApproved, NotificationType::RequestRejected, NotificationType::RequestRevisionRequested]);

it('never uses WhatsApp while the channel is disabled (Phase 2)', function () {
    $user = User::factory()->create();
    preference($user, NotificationEvent::TaskAssigned, NotificationChannel::WhatsApp, true);

    expect(fakeNotification(NotificationType::TaskAssigned)->via($user))->not->toContain(WhatsAppChannel::class);
});

it('uses WhatsApp once the channel is enabled and the user opted in', function () {
    config(['notifications.channels.whatsapp.enabled' => true]);
    $user = User::factory()->create();
    preference($user, NotificationEvent::TaskAssigned, NotificationChannel::WhatsApp, true);

    expect(fakeNotification(NotificationType::TaskAssigned)->via($user))->toContain(WhatsAppChannel::class);
});

it('only keeps the Inbox record while the user is on leave and holds notifications', function () {
    app()->instance(UserAvailability::class, new class implements UserAvailability
    {
        public function isOnLeave(User $user, CarbonInterface $at): bool
        {
            return true;
        }
    });
    $user = User::factory()->create();
    NotificationSetting::query()->create(['user_id' => $user->id, 'pause_while_on_leave' => true]);

    expect(fakeNotification(NotificationType::TaskAssigned)->via($user))->toBe([InAppChannel::class]);
});

it('ignores leave when the user did not ask to hold notifications', function () {
    app()->instance(UserAvailability::class, new class implements UserAvailability
    {
        public function isOnLeave(User $user, CarbonInterface $at): bool
        {
            return true;
        }
    });
    $user = User::factory()->create();

    expect(fakeNotification(NotificationType::TaskAssigned)->via($user))->toContain('mail', 'broadcast');
});

it('does not notify non-user notifiables', function () {
    expect(fakeNotification(NotificationType::TaskAssigned)->via(new AnonymousNotifiable))->toBe([]);
});

describe('quiet hours', function () {
    it('delays email outside working hours until 07.00 WIB', function () {
        // Monday 20:00 WIB = 13:00 UTC.
        $this->travelTo(CarbonImmutable::parse('2026-10-05 13:00:00', 'UTC'));
        $user = User::factory()->create();

        $delay = fakeNotification(NotificationType::TaskAssigned)->withDelay($user, 'mail');

        expect($delay)->not->toBeNull()
            ->and(CarbonImmutable::instance($delay)->setTimezone('Asia/Jakarta')->format('Y-m-d H:i'))->toBe('2026-10-06 07:00');
    });

    it('delays weekend email until Monday 07.00 WIB', function () {
        // Saturday 10:00 WIB.
        $this->travelTo(CarbonImmutable::parse('2026-10-10 03:00:00', 'UTC'));
        $user = User::factory()->create();

        $delay = fakeNotification(NotificationType::TaskAssigned)->withDelay($user, 'mail');

        expect(CarbonImmutable::instance($delay)->setTimezone('Asia/Jakarta')->format('D Y-m-d H:i'))->toBe('Mon 2026-10-12 07:00');
    });

    it('sends immediately during working hours', function () {
        // Monday 10:00 WIB.
        $this->travelTo(CarbonImmutable::parse('2026-10-05 03:00:00', 'UTC'));

        expect(fakeNotification(NotificationType::TaskAssigned)->withDelay(User::factory()->create(), 'mail'))->toBeNull();
    });

    it('sends immediately when the user turned quiet hours off', function () {
        $this->travelTo(CarbonImmutable::parse('2026-10-05 13:00:00', 'UTC'));
        $user = User::factory()->create();
        NotificationSetting::query()->create(['user_id' => $user->id, 'quiet_hours' => false]);

        expect(fakeNotification(NotificationType::TaskAssigned)->withDelay($user, 'mail'))->toBeNull();
    });

    it('never delays in-app or broadcast', function () {
        $this->travelTo(CarbonImmutable::parse('2026-10-05 13:00:00', 'UTC'));
        $user = User::factory()->create();

        expect(fakeNotification(NotificationType::TaskAssigned)->withDelay($user, InAppChannel::class))->toBeNull()
            ->and(fakeNotification(NotificationType::TaskAssigned)->withDelay($user, 'broadcast'))->toBeNull();
    });
});

it('builds the uniform payload shape', function () {
    $actor = User::factory()->create(['name' => 'Sari Wulandari']);
    $recipient = User::factory()->create();
    $subject = User::factory()->create();

    $payload = fakeNotification(NotificationType::Mention, $actor, $subject)->toArray($recipient);

    expect($payload)->toBe([
        'type' => 'mention',
        'title' => 'Judul Disebut',
        'body' => 'Isi notifikasi',
        'url' => '/tugas',
        'actor' => ['id' => $actor->id, 'name' => 'Sari Wulandari', 'avatar' => null],
        'subject' => ['type' => $subject->getMorphClass(), 'id' => $subject->id, 'code' => 'PLQ-15', 'title' => 'Siaran pers'],
        'meta' => ['context' => 'lewat 1 hari kerja', 'context_tone' => 'danger'],
    ]);
});

it('stores the Inbox row with type, subject and the action flag', function () {
    $recipient = User::factory()->create();
    $subject = User::factory()->create();

    $recipient->notify(fakeNotification(NotificationType::RequestSubmitted, subject: $subject));

    $row = InboxNotification::query()->sole();

    expect($row->type)->toBe('request.submitted')
        ->and($row->notifiable_id)->toBe($recipient->id)
        ->and($row->subject_type)->toBe($subject->getMorphClass())
        ->and($row->subject_id)->toBe($subject->id)
        ->and($row->action_required)->toBeTrue()
        ->and($row->read_at)->toBeNull()
        ->and($row->data['title'])->toBe('Judul Pengajuan baru');
});

it('broadcasts the payload with display hints on the user channel', function () {
    $recipient = User::factory()->create();
    $notification = fakeNotification(NotificationType::TaskOverdue);

    $message = $notification->toBroadcast($recipient);

    expect($message->data)->toMatchArray([
        'type' => 'task.overdue',
        'category' => 'task',
        'icon' => 'alert',
        'tone' => 'danger',
        'action_required' => true,
    ])->and($notification->broadcastType())->toBe('task.overdue');
});

it('sends the branded email only when email is enabled', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 03:00:00', 'UTC')); // Monday 10:00 WIB.
    $on = User::factory()->create();
    $off = User::factory()->create();
    preference($off, NotificationEvent::TaskAssigned, NotificationChannel::Email, false);

    $on->notify(fakeNotification(NotificationType::TaskAssigned));
    $off->notify(fakeNotification(NotificationType::TaskAssigned));

    $messages = app('mailer')->getSymfonyTransport()->messages();

    expect($messages)->toHaveCount(1)
        ->and($messages[0]->getEnvelope()->getRecipients()[0]->getAddress())->toBe($on->email)
        ->and($messages[0]->getOriginalMessage()->getSubject())->toBe('Judul Ditugaskan')
        ->and($messages[0]->getOriginalMessage()->getHtmlBody())->toContain('Atur notifikasi', 'Isi notifikasi');

    expect(InboxNotification::query()->count())->toBe(2);
});

it('routes channels through the notification facade as expected', function () {
    Notification::fake();
    $user = User::factory()->create();

    $user->notify(new SystemAnnouncement('Selamat datang', url: '/dashboard'));

    Notification::assertSentTo($user, SystemAnnouncement::class, fn (SystemAnnouncement $n, array $channels) => $channels === [InAppChannel::class, 'broadcast']);
});

it('rejects external URLs in payloads (no open redirect)', function (string $url) {
    new NotificationPayload('x', url: $url);
})->with(['https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)'])->throws(InvalidArgumentException::class);
