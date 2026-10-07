<?php

use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Okr\Jobs\SendKeyResultCheckinReminders;
use App\Domain\Okr\Notifications\KeyResultCheckinReminderNotification;
use App\Models\KeyResult;
use App\Models\KeyResultCheckin;
use App\Models\Objective;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Notification;

require_once __DIR__.'/../../Support/okr-helpers.php';

beforeEach(function () {
    // Friday 9 Oct 2026, 15.00 WIB (week 2 of Q4).
    $this->travelTo(CarbonImmutable::parse('2026-10-09 15:00', 'Asia/Jakarta'));
    Notification::fake();
    $this->w = okrWorld();
});

function runOkrReminders(): int
{
    return app()->call([new SendKeyResultCheckinReminders, 'handle']);
}

it('is scheduled on Friday 15.00 office time', function () {
    $event = collect(app(Schedule::class)->events())
        ->first(fn ($event) => str_contains((string) $event->description, SendKeyResultCheckinReminders::class));

    expect($event?->expression)->toBe('0 15 * * 5')
        ->and($event?->timezone)->toBe('Asia/Jakarta');
});

it('reminds each owner once a week about key results without a check-in', function () {
    // A second pending key result of the same owner: still one notification.
    KeyResult::factory()->for($this->w->objective)->ownedBy($this->w->member)->create(['title' => 'Bug kritis terbuka']);
    // Checked in on Monday of this week: no reminder for Sari.
    $done = KeyResult::factory()->for($this->w->objective)->ownedBy($this->w->colleague)->create();
    KeyResultCheckin::factory()->for($done)->create(['checked_on' => '2026-10-05']);

    expect(runOkrReminders())->toBe(1)
        ->and(runOkrReminders())->toBe(0);

    Notification::assertSentToTimes($this->w->member, KeyResultCheckinReminderNotification::class, 1);
    Notification::assertSentTo($this->w->member, KeyResultCheckinReminderNotification::class, function ($notification, $channels, $notifiable) {
        $payload = $notification->payload($notifiable);

        return count($notification->keyResultIds) === 2
            && $payload->title === '2 key result menunggu check-in minggu ini'
            && $payload->url === '/okr/'.$this->w->objective->id
            && $notification->type() === NotificationType::OkrCheckinReminder;
    });
    Notification::assertNotSentTo($this->w->colleague, KeyResultCheckinReminderNotification::class);

    // Next Friday: a new cycle.
    $this->travelTo(CarbonImmutable::parse('2026-10-16 15:00', 'Asia/Jakarta'));

    expect(runOkrReminders())->toBe(2);
});

it('skips draft, closed and other-quarter objectives and inactive owners', function () {
    $this->w->objective->forceFill(['status' => 'draft'])->save();
    KeyResult::factory()->for(Objective::factory()->forDivision($this->w->ops)->ownedBy($this->w->kadiv)->closed()->create())->ownedBy($this->w->colleague)->create();
    KeyResult::factory()->for(Objective::factory()->forDivision($this->w->ops)->ownedBy($this->w->kadiv)->create(['quarter' => '2026-Q3']))->ownedBy($this->w->colleague)->create();
    $active = Objective::factory()->forDivision($this->w->ops)->ownedBy($this->w->kadiv)->create();
    KeyResult::factory()->for($active)->ownedBy($this->w->inactive)->create();

    expect(runOkrReminders())->toBe(0);
    Notification::assertNothingSent();
});

it('drops the reminder when the key results were checked in before delivery', function () {
    $notification = new KeyResultCheckinReminderNotification($this->w->member, [$this->w->keyResult->id]);
    $notifiable = User::query()->findOrFail($this->w->member->id);

    expect($notification->shouldSend($notifiable, 'database'))->toBeTrue()
        ->and($notification->payload($notifiable)->title)->toBe('Check-in key result "Skenario UAT lulus"');

    $this->w->keyResult->delete();

    expect($notification->shouldSend($notifiable, 'database'))->toBeFalse();
});
