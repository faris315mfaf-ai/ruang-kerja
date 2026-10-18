<?php

use App\Domain\Notifications\Actions\DispatchDueDailyDigests;
use App\Domain\Notifications\Actions\UpdateNotificationSettings;
use App\Domain\Notifications\Contracts\UserAvailability;
use App\Domain\Notifications\Contracts\WorkdayCalendar;
use App\Domain\Notifications\Digest\Contracts\DigestSection;
use App\Domain\Notifications\Digest\DailyDigestMail;
use App\Domain\Notifications\Digest\Data\DigestItem;
use App\Domain\Notifications\Digest\Data\DigestSectionData;
use App\Domain\Notifications\Digest\DigestBuilder;
use App\Domain\Notifications\Digest\Sections\InboxActionSection;
use App\Domain\Notifications\Jobs\SendDailyDigest;
use App\Models\InboxNotification;
use App\Models\NotificationPreference;
use App\Models\NotificationSetting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Console\Scheduling\Event;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Mail::fake();
});

/**
 * Office-local wall clock (Asia/Jakarta) → test clock.
 */
function atJakarta(string $local): void
{
    test()->travelTo(CarbonImmutable::parse($local, 'Asia/Jakarta'));
}

function userWithPendingAction(?string $digestTime = null): User
{
    $user = User::factory()->create(['name' => 'Dimas Pratama']);
    InboxNotification::factory()->recipient($user)->needsAction()->withData(['title' => 'Maya Lestari mengajukan cuti'])->create();

    if ($digestTime !== null) {
        NotificationSetting::query()->create(['user_id' => $user->id, 'digest_time' => $digestTime]);
    }

    return $user;
}

function runDigests(): int
{
    return app(DispatchDueDailyDigests::class)->handle(CarbonImmutable::now());
}

it('sends the digest at 07.30 Asia/Jakarta on a working day', function () {
    $user = userWithPendingAction();
    atJakarta('2026-10-05 07:30'); // Monday; 00:30 UTC

    expect(runDigests())->toBe(1);

    Mail::assertSent(DailyDigestMail::class, function (DailyDigestMail $mail) use ($user) {
        return $mail->hasTo($user->email)
            && $mail->digest->date->toDateString() === '2026-10-05'
            && $mail->envelope()->subject === 'Ringkasan harian · Senin, 5 Okt 2026';
    });
});

it('does not send before the user\'s time', function () {
    userWithPendingAction();
    atJakarta('2026-10-05 07:25');

    expect(runDigests())->toBe(0);
    Mail::assertNothingSent();
});

it('uses the office timezone, not UTC', function () {
    userWithPendingAction();
    // 07:30 UTC = 14:30 WIB: far past the catch-up window, so nothing is sent.
    test()->travelTo(CarbonImmutable::parse('2026-10-05 07:30:00', 'UTC'));

    expect(runDigests())->toBe(0);
});

it('catches up when the scheduler runs late, within the window', function () {
    userWithPendingAction();
    atJakarta('2026-10-05 08:25');
    expect(runDigests())->toBe(1);
});

it('skips once the catch-up window has passed', function () {
    userWithPendingAction();
    atJakarta('2026-10-05 08:31');
    expect(runDigests())->toBe(0);
});

it('honours a custom digest time', function () {
    userWithPendingAction('09:00');

    atJakarta('2026-10-05 07:30');
    expect(runDigests())->toBe(0);

    atJakarta('2026-10-05 09:00');
    expect(runDigests())->toBe(1);
});

it('is idempotent within a day and runs again the next working day', function () {
    userWithPendingAction();

    atJakarta('2026-10-05 07:30');
    expect(runDigests())->toBe(1);
    atJakarta('2026-10-05 07:35');
    expect(runDigests())->toBe(0);

    atJakarta('2026-10-06 07:30');
    expect(runDigests())->toBe(1);

    Mail::assertSent(DailyDigestMail::class, 2);
});

it('does not send on weekends', function () {
    userWithPendingAction();
    atJakarta('2026-10-10 07:30'); // Saturday

    expect(runDigests())->toBe(0);
    Mail::assertNothingSent();
});

it('respects a holiday-aware workday calendar bound by another module', function () {
    app()->instance(WorkdayCalendar::class, new class implements WorkdayCalendar
    {
        public function isWorkday(CarbonImmutable $date, ?string $companyId = null): bool
        {
            return $date->toDateString() !== '2026-10-05';
        }
    });
    userWithPendingAction();
    atJakarta('2026-10-05 07:30');

    expect(runDigests())->toBe(0);
});

it('does not send an empty digest', function () {
    $user = User::factory()->create();
    atJakarta('2026-10-05 07:30');

    expect(runDigests())->toBe(1); // queued and recorded…
    Mail::assertNothingSent();      // …but nothing to report

    expect(NotificationSetting::query()->findOrFail($user->id)->digest_last_run_on?->toDateString())->toBe('2026-10-05');
});

it('does not send when the user switched the digest off', function () {
    $user = userWithPendingAction();
    NotificationPreference::query()->create(['user_id' => $user->id, 'event' => 'digest.daily', 'channel' => 'email', 'enabled' => false]);
    atJakarta('2026-10-05 07:30');

    expect(runDigests())->toBe(0);
    Mail::assertNothingSent();
});

it('does not send while the user is on leave and holds notifications', function () {
    app()->instance(UserAvailability::class, new class implements UserAvailability
    {
        public function isOnLeave(User $user, CarbonInterface $at): bool
        {
            return true;
        }
    });
    $user = userWithPendingAction();
    NotificationSetting::query()->create(['user_id' => $user->id, 'pause_while_on_leave' => true]);
    atJakarta('2026-10-05 07:30');

    runDigests();
    Mail::assertNothingSent();
});

it('renders the email like the mockup', function () {
    $user = userWithPendingAction();
    atJakarta('2026-10-05 07:30');

    $digest = app(DigestBuilder::class)->build($user, CarbonImmutable::parse('2026-10-05', 'Asia/Jakarta'));
    $html = (new DailyDigestMail($digest, '07:30'))->render();

    expect($html)
        ->toContain('Selamat pagi, Dimas.')
        ->toContain('Ini ringkasan Senin, 5 Okt 2026.')
        ->toContain('Perlu tindakan di Inbox (1)')
        ->toContain('Maya Lestari mengajukan cuti')
        ->toContain('Buka RuangKerja')
        ->toContain('Email ini dikirim pukul 07.30 karena Anda mengaktifkan ringkasan harian.');
});

it('builds sections from the registry in order and skips empty ones', function () {
    $user = User::factory()->create();
    config(['notifications.digest.sections' => [FakeDueTodaySection::class, InboxActionSection::class]]);

    $digest = app(DigestBuilder::class)->build($user, CarbonImmutable::parse('2026-10-05', 'Asia/Jakarta'));

    expect($digest->sections)->toHaveCount(1)
        ->and($digest->sections[0]->key)->toBe('tasks.due_today')
        ->and($digest->toArray()['sections'][0]['items'][0])->toMatchArray(['code' => 'OPS-145', 'trailing' => '17.00']);
});

it('rejects section classes that do not implement the contract', function () {
    config(['notifications.digest.sections' => [stdClass::class]]);

    app(DigestBuilder::class)->build(User::factory()->create(), CarbonImmutable::now());
})->throws(InvalidArgumentException::class);

it('runs from the scheduled command every five minutes', function () {
    userWithPendingAction();
    atJakarta('2026-10-05 07:30');

    $this->artisan('notifications:send-daily-digests')->expectsOutput('1 ringkasan harian diantrekan.')->assertSuccessful();

    $events = collect(app(Schedule::class)->events())
        ->filter(fn (Event $event) => str_contains((string) $event->command, 'notifications:send-daily-digests'));

    expect($events)->toHaveCount(1)
        ->and($events->first()->expression)->toBe('*/5 * * * *');
});

final class FakeDueTodaySection implements DigestSection
{
    public function build(User $user, CarbonImmutable $date): DigestSectionData
    {
        return new DigestSectionData(
            key: 'tasks.due_today',
            title: 'Tenggat hari ini (1)',
            tileLabel: 'Tenggat hari ini',
            count: 1,
            items: [new DigestItem('Laporan mingguan operasional', code: 'OPS-145', trailing: '17.00')],
        );
    }
}

it('claims the day atomically so an overlapping run cannot queue a second digest', function () {
    Queue::fake();
    $user = userWithPendingAction('07:30');
    atJakarta('2026-10-05 07:30');

    // Another run (other server / overlapping process) claims the day right after
    // this run has read the settings.
    NotificationSetting::retrieved(function (NotificationSetting $setting) {
        DB::table('notification_settings')->where('user_id', $setting->user_id)->update(['digest_last_run_on' => '2026-10-05']);
    });

    expect(runDigests())->toBe(0);
    Queue::assertNotPushed(SendDailyDigest::class);
});

it('claims the day for people without a settings row too', function () {
    Queue::fake();
    $user = userWithPendingAction();
    atJakarta('2026-10-05 07:30');

    expect(runDigests())->toBe(1)
        ->and(runDigests())->toBe(0)
        ->and(NotificationSetting::query()->findOrFail($user->id)->digest_last_run_on?->toDateString())->toBe('2026-10-05');
    Queue::assertPushed(SendDailyDigest::class, 1);
});

it('does not send a second digest the same day after the digest time changes', function () {
    $user = userWithPendingAction('07:30');
    atJakarta('2026-10-05 07:30');
    expect(runDigests())->toBe(1);

    app(UpdateNotificationSettings::class)->handle($user, ['digest_time' => '09:00']);
    atJakarta('2026-10-05 09:00');

    expect(runDigests())->toBe(0);
    Mail::assertSent(DailyDigestMail::class, 1);
});

it('runs the digest and prune commands on one server without overlapping', function () {
    $events = collect(app(Schedule::class)->events());

    foreach (['notifications:send-daily-digests', 'notifications:prune'] as $command) {
        $event = $events->first(fn (Event $event) => str_contains((string) $event->command, $command));

        expect($event)->not->toBeNull()
            ->and($event->onOneServer)->toBeTrue()
            ->and($event->withoutOverlapping)->toBeTrue();
    }
});
